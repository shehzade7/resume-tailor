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
      // Models get retired over time, so pick from the provider's live model list.
      const models = (await pickModels(p, env)).slice(0, 2);
      for (const model of models) {
        try {
          const text = (await CALL[p](env, system, user, model) || '').replace(/<think>[\s\S]*?<\/think>/g, '');
          if (text.includes('{')) return json({ text, provider: p, model });
          errors.push(`${p} ${model}: empty reply`);
        } catch (e) {
          errors.push(`${p} ${model}: ` + (e.name === 'TimeoutError' ? 'timed out' : e.message));
        }
      }
    }
    return json({ error: 'All AI providers failed. ' + errors.join(' | ') }, 502);
  }
};

// Preferred models, best first. Only ones the provider still offers are used.
const PREFS = {
  groq: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'qwen/qwen3-32b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'],
  gemini: ['gemini-2.5-flash', 'gemini-flash-latest'],
  nvidia: ['mistralai/mistral-large-2-instruct', 'deepseek-ai/deepseek-v4.1-flash', 'nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b']
};
const LIST = {
  groq: (env) => ['https://api.groq.com/openai/v1/models', { Authorization: 'Bearer ' + env.GROQ_KEY }],
  nvidia: (env) => ['https://integrate.api.nvidia.com/v1/models', { Authorization: 'Bearer ' + env.NVIDIA_KEY }]
};
async function pickModels(p, env) {
  const override = env[p.toUpperCase() + '_MODEL'];
  let prefs = PREFS[p];
  if (LIST[p]) {
    try {
      const [url, headers] = LIST[p](env);
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      const ids = new Set(((await res.json()).data || []).map((m) => m.id));
      if (ids.size) prefs = prefs.filter((m) => ids.has(m));
    } catch { /* fall back to the preference list */ }
  }
  return override ? [override, ...prefs.filter((m) => m !== override)] : prefs;
}

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
  async groq(env, system, user, model) {
    const d = await post('https://api.groq.com/openai/v1/chat/completions', { Authorization: 'Bearer ' + env.GROQ_KEY },
      chat(system, user, model, { response_format: { type: 'json_object' } }));
    return d.choices?.[0]?.message?.content;
  },
  async gemini(env, system, user, model) {
    const d = await post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { 'x-goog-api-key': env.GEMINI_KEY }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
    });
    return (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  },
  async nvidia(env, system, user, model) {
    const d = await post('https://integrate.api.nvidia.com/v1/chat/completions', { Authorization: 'Bearer ' + env.NVIDIA_KEY },
      chat(system, user, model));
    return d.choices?.[0]?.message?.content;
  }
};
