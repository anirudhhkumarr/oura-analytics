const TOKEN_KEY = 'oura-analytics-tokens';
const CLIENT_KEY = 'oura-analytics-client-id';
const API_BASE_KEY = 'oura-analytics-api-base';
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
  try {
    const stored = localStorage.getItem(CLIENT_KEY);
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return import.meta.env.VITE_OURA_CLIENT_ID || '';
}

export function setClientId(clientId) {
  const value = String(clientId || '').trim();
  if (value) localStorage.setItem(CLIENT_KEY, value);
  else localStorage.removeItem(CLIENT_KEY);
  return value;
}

export function getApiBase() {
  try {
    const stored = localStorage.getItem(API_BASE_KEY);
    if (stored) return stored.replace(/\/$/, '');
  } catch {
    /* ignore */
  }
  if (import.meta.env.VITE_OURA_API_BASE) {
    return String(import.meta.env.VITE_OURA_API_BASE).replace(/\/$/, '');
  }
  return import.meta.env.DEV ? '/oura-api' : 'https://api.ouraring.com';
}

export function setApiBase(base) {
  const value = String(base || '').trim().replace(/\/$/, '');
  if (value) localStorage.setItem(API_BASE_KEY, value);
  else localStorage.removeItem(API_BASE_KEY);
  return getApiBase();
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
    throw new Error('Add your Oura Client ID first (from cloud.ouraring.com/oauth/applications).');
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
    throw new Error('OAuth state mismatch. Try Connect Oura again.');
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
  if (!tokens?.access_token) throw new Error('Connect your Oura account first.');
  if (tokens.expires_at && Date.now() >= tokens.expires_at - 60_000) {
    clearTokens();
    throw new Error('Oura access token expired. Select Connect Oura to authorize again.');
  }
  return tokens.access_token;
}
