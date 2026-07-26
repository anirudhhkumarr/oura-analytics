#!/usr/bin/env node
/**
 * Local-only Oura bridge for the GitHub Pages UI.
 * OAuth secrets and tokens never enter the published site.
 */
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const root = new URL('..', import.meta.url);
const envPath = new URL('../.env', import.meta.url);
const env = Object.fromEntries(
  (await readFile(envPath, 'utf8').catch(() => '')).split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }),
);
const config = { ...env, ...process.env };
const port = Number(config.LOCAL_BRIDGE_PORT || 8780);
const redirectUri = config.OURA_REDIRECT_URI || `http://127.0.0.1:${port}/api/auth/callback`;
const dashboardOrigin = config.DASHBOARD_ORIGIN || 'https://anirudhhkumarr.github.io';
const tokenPath = config.OURA_TOKEN_PATH || join(homedir(), '.config', 'oura-analytics', 'tokens.json');
let oauthState = null;

function send(res, status, body, contentType = 'application/json') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function originAllowed(req) {
  const origin = req.headers.origin;
  return !origin || origin === dashboardOrigin || origin === 'http://localhost:5173';
}
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Chrome requires this response to a Private Network Access preflight
  // before an HTTPS public site (GitHub Pages) may call 127.0.0.1.
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}
async function loadTokens() {
  try { return JSON.parse(await readFile(tokenPath, 'utf8')); } catch { return null; }
}
async function saveTokens(tokens) {
  await mkdir(dirname(tokenPath), { recursive: true, mode: 0o700 });
  const tmp = `${tokenPath}.tmp`;
  await writeFile(tmp, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  await rename(tmp, tokenPath);
}
async function exchangeCode(code) {
  const basic = Buffer.from(`${config.OURA_CLIENT_ID}:${config.OURA_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });
  if (!response.ok) throw new Error(`Oura token exchange failed (${response.status}).`);
  const value = await response.json();
  await saveTokens({ ...value, expires_at: Date.now() + value.expires_in * 1000 });
}
async function accessToken() {
  const tokens = await loadTokens();
  if (!tokens?.access_token) throw new Error('Connect your Oura account first.');
  if (Date.now() < (tokens.expires_at || 0) - 60_000) return tokens.access_token;
  const basic = Buffer.from(`${config.OURA_CLIENT_ID}:${config.OURA_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }),
  });
  if (!response.ok) throw new Error('Oura token refresh failed; please connect again.');
  const next = await response.json();
  await saveTokens({ ...next, expires_at: Date.now() + next.expires_in * 1000 });
  return next.access_token;
}
async function oura(path, query = {}) {
  const url = new URL(`https://api.ouraring.com/v2${path}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!response.ok) throw new Error(`Oura API request failed (${response.status}).`);
  return response.json();
}
function dateBefore(days) { return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10); }
function avg(rows, field) {
  const values = rows.map((row) => row[field]).filter((value) => Number.isFinite(value));
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}
async function dashboard(days) {
  const query = { start_date: dateBefore(days), end_date: new Date().toISOString().slice(0, 10) };
  const [sleep, readiness, activity, workouts] = await Promise.all([
    oura('/usercollection/daily_sleep', query),
    oura('/usercollection/daily_readiness', query),
    oura('/usercollection/daily_activity', query),
    oura('/usercollection/workout', query),
  ]);
  const byDay = new Map();
  for (const [key, collection] of [['sleep_score', sleep.data], ['readiness_score', readiness.data], ['activity_score', activity.data]]) {
    for (const item of collection || []) byDay.set(item.day, { ...(byDay.get(item.day) || { day: item.day }), [key]: item.score });
  }
  const daily = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  return { daily, workouts: workouts.data || [], summary: { sleep: avg(daily, 'sleep_score'), readiness: avg(daily, 'readiness_score'), activity: avg(daily, 'activity_score') } };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/api/auth/callback') {
    if (!url.searchParams.get('code') || url.searchParams.get('state') !== oauthState) return send(res, 400, '<h1>Sign-in failed</h1><p>Please return to the dashboard and try again.</p>', 'text/html');
    try {
      await exchangeCode(url.searchParams.get('code'));
      oauthState = null;
      return send(res, 200, '<h1>Oura connected</h1><p>Return to the GitHub Pages dashboard and press Refresh data.</p>', 'text/html');
    } catch (error) { return send(res, 500, `<h1>Sign-in failed</h1><p>${error.message}</p>`, 'text/html'); }
  }
  if (!originAllowed(req)) return send(res, 403, { error: 'Origin is not allowed.' });
  cors(req, res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (url.pathname === '/api/health') return send(res, 200, { ok: true });
  if (url.pathname === '/api/auth/status') return send(res, 200, { connected: Boolean((await loadTokens())?.access_token) });
  if (url.pathname === '/api/auth/login') {
    if (!config.OURA_CLIENT_ID || !config.OURA_CLIENT_SECRET) return send(res, 400, { error: 'Add OURA_CLIENT_ID and OURA_CLIENT_SECRET to .env first.' });
    if (redirectUri !== `http://127.0.0.1:${port}/api/auth/callback`) return send(res, 400, { error: `Set the Oura Redirect URI to ${redirectUri} and ensure it points to this bridge.` });
    oauthState = randomBytes(24).toString('hex');
    const auth = new URL('https://cloud.ouraring.com/oauth/authorize');
    auth.search = new URLSearchParams({ response_type: 'code', client_id: config.OURA_CLIENT_ID, redirect_uri: redirectUri, scope: 'daily workout', state: oauthState });
    return send(res, 200, { authorization_url: auth.toString() });
  }
  if (url.pathname === '/api/dashboard') {
    try { return send(res, 200, await dashboard(Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 7), 90))); }
    catch (error) { return send(res, 500, { error: error.message }); }
  }
  return send(res, 404, { error: 'Not found.' });
});
server.listen(port, '127.0.0.1', () => console.log(`Oura local bridge: http://127.0.0.1:${port}`));
