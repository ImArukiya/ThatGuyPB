/**
 * Cloudflare Pages Function — Twitch API proxy
 * Route: /api/twitch/*
 *
 * Required environment variables (set in Cloudflare Pages → Settings → Environment variables):
 *   TWITCH_CLIENT_ID     — your Twitch app client ID
 *   TWITCH_CLIENT_SECRET — your Twitch app client secret
 *
 * Supported paths (all GET):
 *   /api/twitch/user?username=<login>
 *   /api/twitch/stream?user_login=<login>
 *   /api/twitch/channel?broadcaster_id=<id>
 *   /api/twitch/followers?broadcaster_id=<id>
 *   /api/twitch/videos?user_id=<id>
 *   /api/twitch/clips?broadcaster_id=<id>&first=4
 */

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_API       = 'https://api.twitch.tv/helix';

/** Fetch (and cache in-memory) an app access token */
let _tokenCache = null;

async function getToken(clientId, clientSecret) {
  if (_tokenCache && _tokenCache.expires > Date.now()) {
    return _tokenCache.token;
  }
  const res = await fetch(TWITCH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'client_credentials',
    }),
  });
  if (!res.ok) throw new Error('Token fetch failed: ' + res.status);
  const data = await res.json();
  _tokenCache = {
    token:   data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  };
  return _tokenCache.token;
}

/** Map our proxy paths to Helix endpoints + which query params to forward */
const ROUTES = {
  user:      { endpoint: '/users',              params: ['id', 'login', 'username'] },
  stream:    { endpoint: '/streams',            params: ['user_id', 'user_login'] },
  channel:   { endpoint: '/channels',           params: ['broadcaster_id'] },
  followers: { endpoint: '/channels/followers', params: ['broadcaster_id', 'first'] },
  videos:    { endpoint: '/videos',             params: ['user_id', 'first', 'type'] },
  clips:     { endpoint: '/clips',              params: ['broadcaster_id', 'first', 'game_id'] },
  game:      { endpoint: '/games',              params: ['id', 'name'] },
};

export async function onRequestGet({ request, env, params }) {
  const clientId     = env.TWITCH_CLIENT_ID;
  const clientSecret = env.TWITCH_CLIENT_SECRET;

  // Verify env vars are set
  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: 'Twitch credentials not configured. Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in Cloudflare Pages environment variables.' }),
      { status: 503, headers: corsHeaders({ 'Content-Type': 'application/json' }) }
    );
  }

  // Determine which proxy route was requested
  // params.path is an array like ['user'] or ['stream']
  const pathSegments = params.path || [];
  const routeKey     = pathSegments[0];
  const route        = ROUTES[routeKey];

  if (!route) {
    return new Response(
      JSON.stringify({ error: 'Unknown proxy route: ' + routeKey }),
      { status: 404, headers: corsHeaders({ 'Content-Type': 'application/json' }) }
    );
  }

  // Forward only allowed query params to Helix
  const incoming  = new URL(request.url).searchParams;
  const outgoing  = new URLSearchParams();

  // Special case: /user?username= maps to Helix /users?login=
  if (routeKey === 'user') {
    const u = incoming.get('username') || incoming.get('login');
    if (u) outgoing.set('login', u);
  } else {
    for (const key of route.params) {
      if (incoming.has(key)) outgoing.set(key, incoming.get(key));
    }
  }

  // Default 'first' to 20 if not provided (Helix default is also 20, but let's be explicit)
  if (['videos', 'clips'].includes(routeKey) && !outgoing.has('first')) {
    outgoing.set('first', '20');
  }
  if (routeKey === 'videos' && !outgoing.has('type')) {
    outgoing.set('type', 'archive');
  }

  let token;
  try {
    token = await getToken(clientId, clientSecret);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Token error: ' + err.message }),
      { status: 502, headers: corsHeaders({ 'Content-Type': 'application/json' }) }
    );
  }

  const helixUrl = `${TWITCH_API}${route.endpoint}?${outgoing.toString()}`;

  let helixRes;
  try {
    helixRes = await fetch(helixUrl, {
      headers: {
        'Client-ID':     clientId,
        'Authorization': 'Bearer ' + token,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Helix fetch error: ' + err.message }),
      { status: 502, headers: corsHeaders({ 'Content-Type': 'application/json' }) }
    );
  }

  const body = await helixRes.text();
  return new Response(body, {
    status: helixRes.status,
    headers: corsHeaders({
      'Content-Type':  'application/json',
      'Cache-Control': routeKey === 'stream' ? 'no-store' : 'public, max-age=30',
    }),
  });
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    ...extra,
  };
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
