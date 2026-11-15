// Free Cloudflare Worker that lets the Resume Tailor site call the NVIDIA API from a browser.
// It only forwards /v1/chat/completions to NVIDIA and adds CORS headers. It stores nothing.
// Set ALLOWED_ORIGIN below to your site's address (for example https://yourname.github.io).
const ALLOWED_ORIGIN = 'https://shehzade7.github.io';
const NVIDIA = 'https://integrate.api.nvidia.com/v1/chat/completions';

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const okOrigin = origin === ALLOWED_ORIGIN || origin.startsWith('http://localhost') || origin === 'null';
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/v1/chat/completions' || !okOrigin) {
      return new Response('Not allowed', { status: 403, headers: cors });
    }
    const upstream = await fetch(NVIDIA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: request.headers.get('Authorization') || '' },
      body: await request.text()
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' }
    });
  }
};
