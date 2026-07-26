#!/usr/bin/env node
/**
 * Local-only Oura bridge for the published dashboard.
 * OAuth secrets and tokens never enter the static site.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

const envPath = new URL('../.env', import.meta.url);
const env = Object.fromEntries(
  (await readFile(envPath, 'utf8').catch(() => '')).split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }),
);
const config = { ...env, ...process.env };
const port = Number(config.LOCAL_BRIDGE_PORT || 8780);
const redirectUri = config.OURA_REDIRECT_URI || `http://localhost:${port}/api/auth/callback`;
const dashboardOrigin = config.DASHBOARD_ORIGIN || 'https://anirudhhkumarr.github.io';
const tokenPath = config.OURA_TOKEN_PATH || join(homedir(), '.config', 'oura-analytics', 'tokens.json');
let oauthState = null;

function send(res, status, body, contentType = 'application/json') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function originAllowed(req) {
  const origin = req.headers.origin;
  return !origin
    || origin === dashboardOrigin
    || origin === `http://localhost:${port}`
    || origin === 'http://localhost:5173';
}
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Chrome requires this response to a Private Network Access preflight
  // before an HTTPS public site may call 127.0.0.1.
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
  const token = await accessToken();
  const data = [];
  let nextToken;
  // Follow pagination so a 90-day dashboard does not silently omit data.
  do {
    const url = new URL(`https://api.ouraring.com/v2${path}`);
    Object.entries({ ...query, ...(nextToken ? { next_token: nextToken } : {}) }).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Oura API request failed (${response.status}) for ${path}.`);
    const page = await response.json();
    if (Array.isArray(page.data)) data.push(...page.data);
    else return page;
    nextToken = page.next_token;
  } while (nextToken);
  return { data };
}
function dateBefore(days) { return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10); }
function avg(rows, field) {
  const values = rows.map((row) => row[field]).filter((value) => Number.isFinite(value));
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}
async function dashboard(days) {
  const endDate = new Date().toISOString().slice(0, 10);
  const query = { start_date: dateBefore(days), end_date: endDate };
  const heartRateStart = new Date(Date.now() - Math.min(days, 30) * 86_400_000).toISOString();
  const collections = [
    ['daily_sleep', '/usercollection/daily_sleep', query],
    ['daily_readiness', '/usercollection/daily_readiness', query],
    ['daily_activity', '/usercollection/daily_activity', query],
    ['daily_stress', '/usercollection/daily_stress', query],
    ['daily_resilience', '/usercollection/daily_resilience', query],
    ['daily_spo2', '/usercollection/daily_spo2', query],
    ['daily_cardiovascular_age', '/usercollection/daily_cardiovascular_age', query],
    ['vo2_max', '/usercollection/vO2_max', query],
    ['sleep_time', '/usercollection/sleep_time', query],
    ['sleep', '/usercollection/sleep', query],
    ['workout', '/usercollection/workout', query],
    ['session', '/usercollection/session', query],
    ['rest_mode_period', '/usercollection/rest_mode_period', query],
    ['enhanced_tag', '/usercollection/enhanced_tag', query],
    ['heartrate', '/usercollection/heartrate', { start_datetime: heartRateStart, end_datetime: new Date().toISOString() }],
    ['personal_info', '/usercollection/personal_info', {}],
  ];
  const raw = {};
  const errors = {};
  // Fetch in order to be kind to Oura's API limits, while keeping failures
  // isolated: an unavailable metric must not hide every other metric.
  for (const [name, path, params] of collections) {
    try { raw[name] = await oura(path, params); }
    catch (error) { raw[name] = { data: [] }; errors[name] = error.message; }
  }
  const byDay = new Map();
  for (const [key, collection] of [['sleep_score', raw.daily_sleep.data], ['readiness_score', raw.daily_readiness.data], ['activity_score', raw.daily_activity.data]]) {
    for (const item of collection || []) byDay.set(item.day, { ...(byDay.get(item.day) || { day: item.day }), [key]: item.score });
  }
  const daily = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  const latest = (rows) => rows?.[rows.length - 1] || {};
  const latestSleep = latest(raw.sleep?.data);
  const latestActivity = latest(raw.daily_activity.data);
  const latestSpo2 = latest(raw.daily_spo2.data);
  return {
    daily,
    raw,
    errors,
    collection_counts: Object.fromEntries(Object.entries(raw).map(([name, value]) => [name, Array.isArray(value.data) ? value.data.length : value ? 1 : 0])),
    summary: {
      sleep: avg(daily, 'sleep_score'), readiness: avg(daily, 'readiness_score'), activity: avg(daily, 'activity_score'),
      steps: latestActivity.steps ?? null,
      hrv: latestSleep.average_hrv ?? latestSleep.contributors?.hrv_balance ?? null,
      spo2: latestSpo2.spo2_percentage?.average ?? null,
    },
  };
}

async function serveStatic(res, pathname) {
  let path = decodeURIComponent(pathname);
  if (path === '/') path = '/index.html';
  const filePath = join(distDir, path.replace(/^\//, ''));
  if (!filePath.startsWith(distDir)) {
    send(res, 403, { error: 'Forbidden.' });
    return true;
  }
  try {
    const body = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': path.endsWith('index.html') ? 'no-store' : 'public, max-age=86400',
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`);
  if (url.pathname === '/api/auth/callback') {
    if (!url.searchParams.get('code') || url.searchParams.get('state') !== oauthState) {
      return send(res, 400, '<!doctype html><html><head><meta charset="utf-8"><title>Sign-in failed</title></head><body><h1>Sign-in failed</h1><p><a href="/">Return to the dashboard</a> and try again.</p></body></html>', 'text/html; charset=utf-8');
    }
    try {
      await exchangeCode(url.searchParams.get('code'));
      oauthState = null;
      res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' });
      return res.end();
    } catch (error) {
      return send(res, 500, `<!doctype html><html><head><meta charset="utf-8"><title>Sign-in failed</title></head><body><h1>Sign-in failed</h1><p>${error.message}</p><p><a href="/">Return to the dashboard</a></p></body></html>`, 'text/html; charset=utf-8');
    }
  }
  if (url.pathname.startsWith('/api/') && url.pathname !== '/api/auth/callback') {
    if (!originAllowed(req)) return send(res, 403, { error: 'Origin is not allowed.' });
    cors(req, res);
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (url.pathname === '/api/health') return send(res, 200, { ok: true });
    if (url.pathname === '/api/auth/status') return send(res, 200, { connected: Boolean((await loadTokens())?.access_token) });
    if (url.pathname === '/api/auth/login') {
      if (!config.OURA_CLIENT_ID || !config.OURA_CLIENT_SECRET) return send(res, 400, { error: 'Add OURA_CLIENT_ID and OURA_CLIENT_SECRET to .env first.' });
      if (redirectUri !== `http://localhost:${port}/api/auth/callback`) return send(res, 400, { error: `Set the Oura Redirect URI to ${redirectUri} and ensure it points to this bridge.` });
      oauthState = randomBytes(24).toString('hex');
      const auth = new URL('https://cloud.ouraring.com/oauth/authorize');
      auth.search = new URLSearchParams({ response_type: 'code', client_id: config.OURA_CLIENT_ID, redirect_uri: redirectUri, scope: 'email personal daily heartrate tag workout session spo2 ring_configuration stress heart_health', state: oauthState });
      return send(res, 200, { authorization_url: auth.toString() });
    }
    if (url.pathname === '/api/dashboard') {
      try { return send(res, 200, await dashboard(Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 7), 90))); }
      catch (error) { return send(res, 500, { error: error.message }); }
    }
    return send(res, 404, { error: 'Not found.' });
  }
  // Serve the Vite build so the dashboard and private-data bridge are same-origin.
  if (await serveStatic(res, url.pathname)) return;
  if (url.pathname !== '/' && await serveStatic(res, '/')) return;
  return send(
    res,
    503,
    '<!doctype html><html><head><meta charset="utf-8"><title>Build required</title></head><body><h1>Dashboard build missing</h1><p>Run <code>npm run build</code>, then reload.</p></body></html>',
    'text/html; charset=utf-8',
  );
});
server.listen(port, 'localhost', () => console.log(`Oura local bridge: http://localhost:${port}`));
