/**
 * Cloudflare Worker: Oura API CORS proxy + webhook receiver.
 *
 * Deploy:
 *   npx wrangler secret put OURA_CLIENT_ID
 *   npx wrangler secret put OURA_CLIENT_SECRET
 *   npx wrangler secret put OURA_WEBHOOK_VERIFICATION_TOKEN
 *   npx wrangler deploy
 *
 * Create subscriptions (once per data_type × event_type) with client id/secret:
 *   POST https://api.ouraring.com/v2/webhook/subscription
 *   Headers: x-client-id, x-client-secret
 *   Body: {
 *     callback_url: "https://<worker>/webhook",
 *     verification_token: "<same as OURA_WEBHOOK_VERIFICATION_TOKEN>",
 *     event_type: "create",
 *     data_type: "daily_sleep"
 *   }
 *
 * GitHub Pages cannot receive webhooks directly. This worker is the callback.
 * The SPA checks GET /sync-status and refreshes only when Oura pushed an event.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(request) });
    }

    if (url.pathname === '/webhook') {
      return handleWebhook(request, env);
    }

    if (url.pathname === '/sync-status') {
      const lastEventAt = await env.SYNC?.get('last_event_at');
      return Response.json(
        { last_event_at: lastEventAt ? Number(lastEventAt) : null },
        { headers: cors(request) },
      );
    }

    if (url.pathname === '/webhook/setup' && request.method === 'POST') {
      return setupSubscriptions(request, env);
    }

    const target = new URL(url.pathname + url.search, 'https://api.ouraring.com');
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
    cors(request).forEach((value, key) => response.headers.set(key, value));
    return response;
  },
};

async function handleWebhook(request, env) {
  const url = new URL(request.url);
  const verification = env.OURA_WEBHOOK_VERIFICATION_TOKEN || '';

  // Subscription verification handshake (GET).
  if (request.method === 'GET') {
    const token = url.searchParams.get('verification_token');
    const challenge = url.searchParams.get('challenge');
    if (!challenge || (verification && token !== verification)) {
      return new Response('Invalid verification', { status: 401 });
    }
    return Response.json({ challenge });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const raw = await request.text();
  if (env.OURA_CLIENT_SECRET) {
    const signature = request.headers.get('x-oura-signature') || '';
    const timestamp = request.headers.get('x-oura-timestamp') || '';
    const valid = await verifySignature(env.OURA_CLIENT_SECRET, timestamp, raw, signature);
    if (!valid) return new Response('Invalid signature', { status: 401 });
  }

  let event = null;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  if (env.SYNC) {
    await env.SYNC.put('last_event_at', String(Date.now()));
    await env.SYNC.put('last_event', JSON.stringify(event), { expirationTtl: 60 * 60 * 24 * 7 });
  }

  // Acknowledge quickly; the SPA will refresh its mutable window via /sync-status.
  return new Response('ok', { status: 200 });
}

async function setupSubscriptions(request, env) {
  if (!env.OURA_CLIENT_ID || !env.OURA_CLIENT_SECRET || !env.OURA_WEBHOOK_VERIFICATION_TOKEN) {
    return Response.json(
      { error: 'Set OURA_CLIENT_ID, OURA_CLIENT_SECRET, and OURA_WEBHOOK_VERIFICATION_TOKEN worker secrets.' },
      { status: 400, headers: cors(request) },
    );
  }

  const origin = new URL(request.url).origin;
  const callbackUrl = `${origin}/webhook`;
  const dataTypes = [
    'daily_sleep', 'daily_readiness', 'daily_activity', 'daily_stress',
    'daily_resilience', 'daily_spo2', 'daily_cardiovascular_age',
    'vo2_max', 'sleep', 'sleep_time', 'workout', 'session', 'rest_mode_period',
    'tag', 'enhanced_tag', 'ring_configuration', 'blood_glucose', 'activation_status',
  ];
  const eventTypes = ['create', 'update'];
  const created = [];
  const errors = [];

  for (const data_type of dataTypes) {
    for (const event_type of eventTypes) {
      const response = await fetch('https://api.ouraring.com/v2/webhook/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': env.OURA_CLIENT_ID,
          'x-client-secret': env.OURA_CLIENT_SECRET,
        },
        body: JSON.stringify({
          callback_url: callbackUrl,
          verification_token: env.OURA_WEBHOOK_VERIFICATION_TOKEN,
          event_type,
          data_type,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) created.push(body);
      else errors.push({ data_type, event_type, status: response.status, body });
    }
  }

  return Response.json({ callback_url: callbackUrl, created, errors }, { headers: cors(request) });
}

async function verifySignature(secret, timestamp, rawBody, signatureHeader) {
  if (!signatureHeader || !timestamp) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const data = encoder.encode(`${timestamp}${rawBody}`);
  const digest = await crypto.subtle.sign('HMAC', key, data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return hex === signatureHeader.toUpperCase();
}

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
