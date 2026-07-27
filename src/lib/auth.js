import { OURA_API_BASE, OURA_CLIENT_ID } from './config.js';

const TOKEN_KEY = 'oura-analytics-tokens';
const STATE_KEY = 'oura-analytics-oauth-state';
const SCOPE = 'email personal daily heartrate tag workout session spo2 ring_configuration stress heart_health';

export function redirectUri() {
  const url = new URL(location.href);
  url.hash = '';
  url.search = '';
  let path = url.pathname;
  if (path.endsWith('/index.html')) path = path.slice(0, -10) || '/';
  if (!path.endsWith('/')) path += '/';
  return `${url.origin}${path}`;
}

export function getClientId() {
  return OURA_CLIENT_ID;
}

export function getApiBase() {
  if (import.meta.env.DEV) return '/oura-api';
  return OURA_API_BASE;
}

export function loadTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveTokens(tokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isConnected() {
  const tokens = loadTokens();
  return Boolean(tokens?.access_token);
}

export function startOuraLogin() {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Oura Client ID is not configured for this build.');
  }
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  const auth = new URL('https://cloud.ouraring.com/oauth/authorize');
  auth.search = new URLSearchParams({
    response_type: 'token',
    client_id: clientId,
    redirect_uri: redirectUri(),
    scope: SCOPE,
    state,
  });
  location.assign(auth.toString());
}

/** Capture implicit-grant tokens from the URL hash after Oura redirects back. */
export function consumeOAuthRedirect() {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const error = params.get('error');
  const accessToken = params.get('access_token');
  if (!error && !accessToken) return null;

  history.replaceState(null, '', `${location.pathname}${location.search}`);

  if (error) {
    throw new Error(params.get('error_description') || `Oura authorization failed (${error}).`);
  }

  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  const state = params.get('state');
  if (expected && state && expected !== state) {
    throw new Error('Authorization failed. Please try connecting again.');
  }

  const expiresIn = Number(params.get('expires_in') || 0);
  const tokens = {
    access_token: accessToken,
    token_type: params.get('token_type') || 'bearer',
    expires_in: expiresIn,
    expires_at: expiresIn ? Date.now() + expiresIn * 1000 : Date.now() + 30 * 86_400_000,
    scope: params.get('scope') || SCOPE,
  };
  saveTokens(tokens);
  return tokens;
}

export async function accessToken() {
  const tokens = loadTokens();
  if (!tokens?.access_token) throw new Error('Connect your Oura account to continue.');
  if (tokens.expires_at && Date.now() >= tokens.expires_at - 60_000) {
    clearTokens();
    throw new Error('Your session expired. Please connect again.');
  }
  return tokens.access_token;
}
