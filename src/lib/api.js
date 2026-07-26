const hostedPage =
  typeof location !== 'undefined'
  && location.hostname !== 'localhost'
  && location.hostname !== '127.0.0.1';

export function isHostedPage() {
  return hostedPage;
}

export function bridgeBase() {
  return hostedPage ? 'http://localhost:8780' : '';
}

export async function api(path) {
  const response = await fetch(bridgeBase() + path);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Local bridge request failed.');
  return body;
}

export async function startOuraLogin() {
  if (hostedPage) {
    location.assign('http://localhost:8780');
    return;
  }
  const result = await api('/api/auth/login');
  location.assign(result.authorization_url);
}
