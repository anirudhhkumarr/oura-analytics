/**
 * Optional Cloudflare Worker: same-origin-style CORS proxy for the Oura API.
 * Deploy with: npx wrangler deploy cloudflare/oura-proxy.js --name oura-analytics-proxy
 * Then set VITE_OURA_API_BASE to the worker URL when building the site.
 */
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(request) });
    }

    const incoming = new URL(request.url);
    const target = new URL(incoming.pathname + incoming.search, 'https://api.ouraring.com');
    if (!target.hostname.endsWith('ouraring.com')) {
      return Response.json({ error: 'Forbidden host.' }, { status: 403, headers: cors(request) });
    }

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('origin');
    headers.delete('referer');

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'follow',
    });

    const response = new Response(upstream.body, upstream);
    const allow = cors(request);
    allow.forEach((value, key) => response.headers.set(key, value));
    return response;
  },
};

function cors(request) {
  const origin = request.headers.get('Origin') || '*';
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
}
