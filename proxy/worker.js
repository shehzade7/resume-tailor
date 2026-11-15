// Resume Tailor shared AI server (free Cloudflare Worker).
// Holds your API keys as Cloudflare secrets (never visible to visitors) and tries
// Groq -> Gemini -> NVIDIA, moving to the next one on an error or a timeout.
//
// Secrets to add in Cloudflare (Settings -> Variables and Secrets -> type "Secret"):
//   GROQ_KEY, GEMINI_KEY, NVIDIA_KEY   (add the ones you have; empty ones are skipped)
// Optional plain variables: ALLOWED_ORIGIN, GROQ_MODEL, GEMINI_MODEL, NVIDIA_MODEL

const DEFAULT_ORIGIN = 'https://shehzade7.github.io';
const TIMEOUT_MS = 40000;
const MAX_BODY = 60000;

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
    const origin = request.headers.get('Origin') || '';
    const okOrigin = origin === allowed || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : allowed,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const providers = [
      env.GROQ_KEY && 'groq', env.GEMINI_KEY && 'gemini', env.NVIDIA_KEY && 'nvidia'
    ].filter(Boolean);
    if (request.method === 'GET') return json({ ok: true, providers });
    if (!okOrigin) return json({ error: 'Not allowed from this site.' }, 403);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'Request too large.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Bad request.' }, 400); }
    const { system, user } = body || {};
    if (!system || !user) return json({ error: 'Bad request.' }, 400);
    if (!providers.length) return json({ error: 'No API keys are set on the server yet.' }, 500);

    const errors = [];
    for (const p of providers) {
      try {
        const text = await CALL[p](env, system, user);
        if (text && text.includes('{')) return json({ text, provider: p });
        errors.push(p + ': empty reply');
      } catch (e) {
        errors.push(p + ': ' + (e.name === 'TimeoutError' ? 'timed out' : e.message));
      }
    }
    return json({ error: 'All AI providers failed. ' + errors.join(' | ') }, 502);
  }
};

async function post(url, headers, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || data.detail || data.title || 'HTTP ' + res.status);
  return data;
}
const chat = (system, user, model, extra = {}) => ({
  model, temperature: 0.2, max_tokens: 4096, ...extra,
  messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
});

const CALL = {
  async groq(env, system, user) {
    const d = await post('https://api.groq.com/openai/v1/chat/completions', { Authorization: 'Bearer ' + env.GROQ_KEY },
      chat(system, user, env.GROQ_MODEL || 'llama-3.3-70b-versatile', { response_format: { type: 'json_object' } }));
    return d.choices?.[0]?.message?.content;
  },
  async gemini(env, system, user) {
    const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
    const d = await post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { 'x-goog-api-key': env.GEMINI_KEY }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
    });
    return (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  },
  async nvidia(env, system, user) {
    const d = await post('https://integrate.api.nvidia.com/v1/chat/completions', { Authorization: 'Bearer ' + env.NVIDIA_KEY },
      chat(system, user, env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct'));
    return d.choices?.[0]?.message?.content;
  }
};
