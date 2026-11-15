'use strict';
/* Resume Tailor: runs fully in the browser. No data leaves the page except the
   optional AI request, which goes straight to the provider (or your proxy). */

const $ = (id) => document.getElementById(id);

// ---------- text helpers ----------
const STOP = new Set(('a an the and or of to in on for with by at from as is are be been was were will would can could should must may this that these those it its our your their we you they he she his her them us i me my not no nor but if then than so such into over under per via etc also able ability using use used within across all any each other more most well good strong excellent including include includes like work working job role candidate candidates years year experience experienced required requirement requirements preferred plus knowledge understanding responsible responsibilities duties key skills skill looking join team company apply opportunity location salary benefits about who what where when how new day days time per hands handson basic minimum min max least etc. eg e.g i.e should have has had do does doing make makes ensure ensuring maintain maintaining provide providing manage managing support supporting').split(' '));
const BLACKWORDS = new Set(['job', 'description', 'responsibility', 'responsibilities', 'requirement', 'requirements', 'qualification', 'qualifications', 'title', 'location', 'salary', 'company', 'candidate', 'apply', 'benefits', 'about', 'role', 'position', 'opening', 'experience', 'years', 'preferred', 'required', 'key', 'skills', 'we', 'you', 'our', 'the', 'ctc', 'lpa', 'immediate', 'joiner', 'joiners', 'industry', 'type', 'department', 'employment', 'full', 'education', 'must', 'good', 'should']);
const ACR_BLACK = new Set(['JD', 'CTC', 'LPA', 'HR', 'NA', 'N/A', 'I', 'A', 'OR', 'AND', 'THE', 'TO', 'OF', 'IN', 'ON', 'AT', 'BY', 'WE', 'US', 'IT', 'IS', 'AS', 'BE', 'NO', 'CV', 'ID', 'OK', 'PM', 'AM', 'UG', 'PG', 'YRS', 'YR']);

// Common terms in stores, inventory, supply chain, SAP and office roles.
const DICT = ['SAP', 'SAP MM', 'SAP S/4HANA', 'S/4HANA', 'SAP ECC', 'SAP WM', 'SAP EWM', 'Materials Management', 'Inventory Management', 'Inventory Control', 'Stock Management', 'Store Management', 'Stores Management', 'Warehouse Management', 'Warehouse Operations', 'Goods Receipt', 'Goods Issue', 'GRN', 'Material Receipt', 'Material Issue', 'Stock Transfer', 'Stock Reconciliation', 'Stock Audit', 'Physical Verification', 'Cycle Count', 'Cycle Counting', 'Inventory Audit', 'FIFO', 'FEFO', 'LIFO', 'ABC Analysis', 'XYZ Analysis', 'VED Analysis', 'MRP', 'Reorder Level', 'Safety Stock', 'Min Max', 'Purchase Order', 'Purchase Requisition', 'Procurement', 'Purchasing', 'Vendor Management', 'Vendor Development', 'Supplier Management', 'Vendor Evaluation', 'Invoice Verification', 'Three Way Match', 'MIGO', 'MIRO', 'ME21N', 'ME51N', 'MB51', 'MB52', 'MMBE', 'MB1A', 'MB1B', 'ME2M', 'MB5B', 'Logistics', 'Supply Chain', 'Supply Chain Management', 'Dispatch', 'Inward', 'Outward', 'Material Handling', 'Material Planning', 'Spare Parts', 'Spares', 'Consumables', 'Raw Material', 'Packing Material', 'Finished Goods', 'Scrap', 'Scrap Disposal', 'Non Moving', 'Slow Moving', 'Obsolete Stock', 'Bin Location', 'Barcode', 'ERP', 'Tally', 'MS Excel', 'Advanced Excel', 'Excel', 'VLOOKUP', 'Pivot Table', 'MS Office', 'Power BI', 'MIS', 'MIS Reporting', 'Documentation', 'Record Keeping', 'Compliance', 'Statutory Compliance', 'GST', 'E-Way Bill', 'Gate Pass', 'Delivery Challan', 'Audit', 'Internal Audit', 'Cost Control', 'Cost Reduction', 'Budgeting', 'Costing', 'Inventory Valuation', 'Safety', '5S', 'Kaizen', 'Lean', 'ISO', 'Quality Control', 'Quality Inspection', 'Team Management', 'Team Leadership', 'Coordination', 'Communication', 'Negotiation', 'Problem Solving', 'Reporting', 'Data Analysis', 'Forecasting', 'Demand Planning', 'Production Planning', 'Fertilizer', 'Chemicals', 'Manufacturing', 'Plant'];

// Words that mean the same thing for matching purposes.
const SYN = [
  ['goods receipt', 'grn', 'goods receipt note', 'material receipt', 'migo'],
  ['purchase order', 'po', 'purchase orders'],
  ['purchase requisition', 'pr', 'indent'],
  ['inventory', 'stock'],
  ['inventory management', 'stock management', 'inventory control', 'stock control'],
  ['store management', 'stores management', 'store operations', 'stores operations'],
  ['warehouse', 'store', 'stores', 'godown'],
  ['materials management', 'material management', 'sap mm', 'mm'],
  ['s/4hana', 's4hana', 's/4 hana', 'sap s/4hana'],
  ['ms excel', 'excel', 'microsoft excel', 'advanced excel'],
  ['vendor', 'supplier'],
  ['vendor management', 'supplier management'],
  ['physical verification', 'stock verification', 'stock taking', 'stocktaking'],
  ['fifo', 'first in first out'],
  ['mrp', 'material requirement planning', 'material requirements planning'],
  ['invoice verification', 'miro'],
  ['goods issue', 'material issue', 'gi'],
  ['reconciliation', 'reconcile', 'reconciled'],
  ['mis', 'mis reporting', 'mis reports'],
  ['procurement', 'purchasing', 'purchase']
];

function stem(t) {
  if (t.length <= 4 || /\d/.test(t)) return t;
  if (t.endsWith('ies')) t = t.slice(0, -3) + 'y';
  else if (t.endsWith('ing') && t.length > 5) t = t.slice(0, -3);
  else if (t.endsWith('ed')) t = t.slice(0, -2);
  else if (t.endsWith('es')) t = t.slice(0, -2);
  else if (t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  if (t.endsWith('e') && t.length > 3) t = t.slice(0, -1);
  return t;
}
function tokens(s) {
  return String(s).replace(/\b([A-Z]{2,5})s\b/g, '$1').toLowerCase().replace(/\//g, '').replace(/[^a-z0-9+#]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}
const norm = (s) => tokens(s).map(stem).join(' ');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const titleCase = (s) => s.replace(/\b([a-z])([a-z]*)/g, (m, a, b) => a.toUpperCase() + b);

const SYN_N = SYN.map((g) => g.map(norm));
function variants(k) {
  const n = norm(k), out = new Set([n]);
  for (const g of SYN_N) if (g.includes(n)) g.forEach((v) => out.add(v));
  return [...out];
}
function hasPhrase(hay, n) { return n && hay.includes(' ' + n + ' '); }
function matchInfo(kw, hay) { // hay = ' ' + norm(text) + ' '
  if (hasPhrase(hay, kw.n)) return 'exact';
  return kw.vars.some((v) => hasPhrase(hay, v)) ? 'synonym' : null;
}

// ---------- keyword extraction ----------
function extractKeywords(jd) {
  const found = new Map();
  const add = (term, w) => {
    term = term.trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+#]+$/g, '');
    const n = norm(term);
    if (!n || n.length < 2) return;
    const toks = tokens(term);
    if (toks.some((t) => BLACKWORDS.has(t))) return;
    if (toks.every((t) => STOP.has(t))) return;
    const cur = found.get(n);
    if (cur) cur.w = Math.max(cur.w, w); else found.set(n, { term, n, w });
  };
  const njd = ' ' + norm(jd) + ' ';
  for (const d of DICT) {
    if (hasPhrase(njd, norm(d))) {
      const m = jd.match(new RegExp('\\b' + reEsc(d).replace(/\\\//g, '\\/?').replace(/ /g, '[\\s-]+') + '\\b', 'i'));
      add(m ? m[0] : d, 3);
    }
  }
  for (const a of jd.match(/\b[A-Z][A-Z0-9&\/]{1,9}\b/g) || []) if (!ACR_BLACK.has(a)) add(a, 2);
  const titleLine = ' ' + norm((jd.match(/title\s*:\s*(.+)/i) || [])[1] || jd.split('\n')[0]) + ' ';
  const capsRe =/\b[A-Z][a-zA-Z]+(?:\s+(?:&\s+)?[A-Z][a-zA-Z]+){1,3}\b/g;
  let cm;
  while ((cm = capsRe.exec(jd))) {
    let p = cm[0];
    // At the start of a line or sentence the first word is usually a verb ("Handle Goods Receipt").
    if (/(^|[\n.:;•*\-–]\s*)$/.test(jd.slice(Math.max(0, cm.index - 3), cm.index)) || cm.index === 0) p = p.replace(/^\S+\s+/, '');
    if (p.includes(' ') && !hasPhrase(titleLine, norm(p)) && !STOP.has(p.split(/\s+/)[0].toLowerCase())) add(p, 2);
  }
  const words = tokens(jd), count = {};
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i], b = words[i + 1];
    if (STOP.has(a) || STOP.has(b) || a.length < 3 || b.length < 3 || /^\d+$/.test(a + b)) continue;
    const k = a + ' ' + b; count[k] = (count[k] || 0) + 1;
  }
  for (const [k, c] of Object.entries(count)) if (c >= 2) add(k, 1);
  const uni = {};
  for (const w of words) if (!STOP.has(w) && w.length > 3 && !/^\d+$/.test(w)) uni[w] = (uni[w] || 0) + 1;
  for (const [w, c] of Object.entries(uni)) if (c >= 3) add(w, 1);

  let list = [...found.values()];
  // Drop weak single words that are already part of a longer keyword.
  list = list.filter((k) => !(k.w < 3 && !k.n.includes(' ') && list.some((o) => o !== k && o.n.includes(' ') && (' ' + o.n + ' ').includes(' ' + k.n + ' '))));
  // The job title itself isn't a skill keyword.
  list = list.filter((k) => k.w >= 3 || !hasPhrase(titleLine, k.n));
  // Count how often each appears in the JD for ranking.
  list.forEach((k) => { k.freq = njd.split(' ' + k.n + ' ').length - 1; k.vars = variants(k.term); });
  list.sort((a, b) => b.w - a.w || b.freq - a.freq);
  return list.slice(0, 40);
}

// ---------- resume parsing ----------
const HEADINGS = [
  ['summary', /^(professional\s+|career\s+|executive\s+)?(summary|profile|objective|about me|overview)$|^career objective$/],
  ['skills', /skill|competenc|expertise|strengths|key areas|areas of expertise|it proficiency|technical proficiency/],
  ['experience', /experience|employment|work history|career history|professional background/],
  ['education', /education|qualification|academic/],
  ['projects', /project/],
  ['achievements', /achievement|award|accomplishment|recognition/],
  ['additional', /additional|personal|languages?|certification|training|interests|hobbies|declaration|extra|software|tools/]
];
const BULLET_RE = /^\s*(?:[•\-*▪●◦➢➤✓✔–·►■□o]\s+|[•▪●◦➢➤✓✔·►■]|\d+[.)]\s+)/;
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?,?\\s*';
const DATE_RE = new RegExp('(?:' + MONTH + '|\\d{1,2}[\\/.-])?(?:19|20)\\d{2}\\s*(?:-|–|—|to|till)\\s*(?:(?:' + MONTH + '|\\d{1,2}[\\/.-])?(?:19|20)\\d{2}|present|till date|to date|current|now|date)', 'i');

function headingOf(line) {
  const t = line.trim().replace(/[:\-–_=*#]+$/, '').replace(/^[#*_=\s]+/, '').trim();
  if (!t || t.length > 40 || /[\d:,]/.test(t) || t.split(/\s+/).length > 4 || BULLET_RE.test(line)) return null;
  const l = t.toLowerCase().replace(/&/g, 'and');
  for (const [key, re] of HEADINGS) if (re.test(l)) return { key, title: t };
  return null;
}
function splitLabel(text) {
  const m = text.match(/^([A-Za-z][^:]{1,40}):\s+(.+)$/);
  if (m && m[1].split(/\s+/).length <= 5) return { label: m[1].trim(), text: m[2].trim() };
  return { label: '', text: text.trim() };
}
const stripBullet = (l) => l.replace(BULLET_RE, '').trim();

function parseResume(raw) {
  const lines = raw.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, ''));
  const sec = { header: [] }, order = [];
  let cur = 'header';
  for (const line of lines) {
    if (!line.trim()) continue;
    const h = headingOf(line);
    if (h) {
      cur = h.key === 'additional' || h.key === 'projects' || h.key === 'achievements' ? h.key + ':' + h.title : h.key;
      if (!sec[cur]) { sec[cur] = []; order.push(cur); }
      continue;
    }
    sec[cur].push(line);
  }
  const R = { name: '', contact: '', summary: '', skills: [], roles: [], education: [], extras: [], additional: [] };
  const head = sec.header.map((l) => l.trim());
  R.name = head[0] || '';
  R.contact = head.slice(1).join(' | ');

  R.summary = (sec.summary || []).map(stripBullet).join(' ').replace(/\s+/g, ' ').trim();

  for (const l of sec.skills || []) {
    const t = stripBullet(l);
    const s = splitLabel(t);
    if (s.label) R.skills.push(s);
    else t.split(/\s*[,|•;▪●]\s*|\s{3,}|\t/).map((x) => x.trim()).filter(Boolean).forEach((x) => R.skills.push({ label: '', text: x }));
  }

  let role = null, lastWasBullet = false;
  const newRole = () => { role = { headerLines: [], bullets: [] }; R.roles.push(role); };
  for (const l of sec.experience || []) {
    const isBullet = BULLET_RE.test(l) || (l.trim().length > 90 && !DATE_RE.test(l));
    if (isBullet) {
      if (!role) newRole();
      role.bullets.push(splitLabel(stripBullet(l)));
      lastWasBullet = true;
    } else if (lastWasBullet && /^\s*[a-z(]/.test(l) && role && role.bullets.length) {
      role.bullets[role.bullets.length - 1].text += ' ' + l.trim();
    } else {
      if (!role || lastWasBullet) newRole();
      role.headerLines.push(l.trim());
      lastWasBullet = false;
    }
  }
  R.roles = R.roles.map(finishRole);

  R.education = (sec.education || []).map(stripBullet);
  for (const key of order) {
    if (!key.includes(':')) continue;
    const [kind, title] = [key.split(':')[0], key.slice(key.indexOf(':') + 1)];
    const items = sec[key].map(stripBullet);
    if (kind === 'additional') {
      if (/^additional|^personal/i.test(title)) R.additional.push(...items);
      else R.additional.push(titleCase(title.toLowerCase()) + ': ' + items.join('; '));
    } else R.extras.push({ heading: title, items });
  }
  return R;
}
function finishRole(r) {
  let dates = '';
  const rest = [];
  for (const h of r.headerLines) {
    const m = h.match(DATE_RE);
    if (m && !dates) { dates = m[0].trim(); const t = h.replace(m[0], '').replace(/[\s|,()\-–—]+$/, '').replace(/^[\s|,()\-–—]+/, '').replace(/\(\s*\)/g, '').trim(); if (t) rest.push(t); }
    else rest.push(h);
  }
  const parts = (rest[0] || '').split(/\s+\|\s+|\s+[-–—]\s+|\s*,\s+(?=[A-Z])/);
  return { title: parts[0] || rest[0] || '', org: [...parts.slice(1), ...rest.slice(1)].join(' | '), dates, bullets: r.bullets };
}

// ---------- tailoring (keyword mode) ----------
function scoreText(text, kws) {
  const hay = ' ' + norm(text) + ' ';
  let s = 0; const hits = [];
  for (const k of kws) if (matchInfo(k, hay)) { s += k.w; hits.push(k); }
  return { s, hits };
}
const stableSort = (arr, key) => arr.map((x, i) => [x, i]).sort((a, b) => key(b[0]) - key(a[0]) || a[1] - b[1]).map((x) => x[0]);

function tailorKeyword(R, kws) {
  const T = JSON.parse(JSON.stringify(R));
  const matched = kws.filter((k) => matchInfo(k, ' ' + norm(resumeText(R)) + ' '));
  // Summary: lead with the most relevant sentences, then name matched strengths.
  const sentences = (T.summary.match(/[^.!?]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean);
  T.summary = stableSort(sentences, (s) => scoreText(s, kws).s).join(' ');
  const sumHay = ' ' + norm(T.summary) + ' ';
  const strengths = matched.filter((k) => k.w >= 2 && !matchInfo(k, sumHay)).slice(0, 6).map((k) => k.term);
  if (strengths.length >= 2) {
    T.summary += (T.summary ? ' ' : '') + 'Key strengths include ' + strengths.slice(0, -1).join(', ') + ' and ' + strengths[strengths.length - 1] + '.';
  }
  // Skills: matched first; show the JD's wording next to a synonym.
  T.skills = stableSort(T.skills, (sk) => scoreText(sk.label + ' ' + sk.text, kws).s).map((sk) => {
    if (sk.label) return sk;
    const hay = ' ' + norm(sk.text) + ' ';
    const syn = kws.find((k) => matchInfo(k, hay) === 'synonym' && !hasPhrase(' ' + norm(resumeText(R)) + ' ', k.n));
    return syn ? { label: '', text: sk.text + ' (' + syn.term + ')' } : sk;
  });
  // Experience: most relevant bullets first, labelled with the JD keyword they show.
  T.roles.forEach((r) => {
    r.bullets = stableSort(r.bullets, (b) => scoreText(b.label + ' ' + b.text, kws).s).map((b) => {
      if (b.label) return b;
      const hits = scoreText(b.text, kws).hits;
      const top = hits.find((k) => k.n.includes(' ')) || hits.find((k) => k.w >= 3) || hits[0];
      return top ? { label: top.term.length <= 4 ? top.term : titleCase(top.term), text: b.text } : b;
    });
  });
  return T;
}

function resumeText(R) {
  return [R.name, R.contact, R.summary, ...R.skills.map((s) => s.label + ' ' + s.text),
    ...R.roles.flatMap((r) => [r.title, r.org, r.dates, ...r.bullets.map((b) => b.label + ' ' + b.text)]),
    ...R.education, ...R.extras.flatMap((e) => [e.heading, ...e.items]), ...R.additional].join('\n');
}

// ---------- AI mode ----------
const PROVIDERS = {
  groq: { model: 'llama-3.3-70b-versatile' },
  gemini: { model: 'gemini-2.5-flash' },
  nvidia: { model: 'meta/llama-3.3-70b-instruct' }
};
const SYSTEM_PROMPT = `You are an expert resume writer who tailors resumes for ATS systems.
STRICT RULES:
- Use ONLY facts from the ORIGINAL RESUME. Never invent employers, job titles, dates, numbers, percentages, tools, software, certifications, degrees or responsibilities.
- You MAY reword, reorder and use the job description's vocabulary only where the original resume already shows the same thing (e.g. "stock" -> "inventory").
- If a job keyword has no evidence in the resume, do NOT add it; list it in "gaps".
- Keep every role, employer, date and education entry from the original.
- Write the summary in 3-4 lines, focused on the target job, using only resume facts.
- Order competencies and bullets so the most job-relevant come first. Each bullet gets a short bold label (2-4 words) and starts with an action verb.
- Keep it to one A4 page: at most 6 bullets per role.
Return ONLY valid JSON in this exact shape:
{"name":"","contact":"","summary":"","competencies":[{"label":"","text":""}],"experience":[{"title":"","company":"","location":"","dates":"","bullets":[{"label":"","text":""}]}],"education":[""],"other":[{"heading":"","items":[""]}],"additional":[""],"gaps":[""]}`;

async function callAI(jd, resume, kws, matchedTerms, missingTerms) {
  const provider = $('provider').value, model = $('model').value.trim() || PROVIDERS[provider].model;
  const key = $('apiKey').value.trim();
  if (!key) throw new Error('Please paste your API key first.');
  const user = `JOB DESCRIPTION:\n${jd}\n\nORIGINAL RESUME:\n${resume}\n\nJob keywords already supported by the resume (use the job's wording for these): ${matchedTerms.join(', ') || 'none'}\nJob keywords NOT in the resume (do not add; list as gaps): ${missingTerms.join(', ') || 'none'}`;
  let res, data, text;
  if (provider === 'gemini') {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } })
    });
    data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || 'Gemini error ' + res.status);
    text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  } else {
    let url = 'https://api.groq.com/openai/v1/chat/completions';
    if (provider === 'nvidia') {
      const p = $('proxyUrl').value.trim().replace(/\/+$/, '');
      if (!p) throw new Error('NVIDIA needs your proxy URL (see the README to set one up for free).');
      url = p + '/v1/chat/completions';
    }
    const body = { model, temperature: 0.2, max_tokens: 4096, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: user }] };
    if (provider === 'groq') body.response_format = { type: 'json_object' };
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(body) });
    data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || data.detail || data.title || 'API error ' + res.status);
    text = data.choices?.[0]?.message?.content || '';
  }
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('The AI did not return a resume. Try again.');
  const j = JSON.parse(text.slice(s, e + 1));
  const lab = (x) => (typeof x === 'string' ? splitLabel(x) : { label: x.label || '', text: x.text || '' });
  return {
    name: j.name || '', contact: j.contact || '', summary: j.summary || '',
    skills: (j.competencies || []).map(lab),
    roles: (j.experience || []).map((r) => ({ title: r.title || '', org: [r.company, r.location].filter(Boolean).join(' | '), dates: r.dates || '', bullets: (r.bullets || []).map(lab) })),
    education: (j.education || []).map(String),
    extras: (j.other || []).filter((o) => o.heading && o.items?.length),
    additional: (j.additional || []).map(String),
    aiGaps: j.gaps || []
  };
}

// Flag anything in the AI version that the original resume doesn't support.
function checkInvented(orig, T, kws) {
  const oHay = ' ' + norm(orig) + ' ', tText = resumeText(T), tHay = ' ' + norm(tText) + ' ';
  const flags = new Set();
  for (const k of kws) if (!matchInfo(k, oHay) && matchInfo(k, tHay)) flags.add(k.term);
  const origNums = new Set((orig.match(/\d+(?:\.\d+)?/g) || []));
  for (const n of tText.match(/\d+(?:\.\d+)?/g) || []) if (!origNums.has(n)) flags.add(n);
  for (const a of tText.match(/\b[A-Z][A-Z0-9&\/]{1,9}\b/g) || []) if (!hasPhrase(oHay, norm(a)) && !ACR_BLACK.has(a)) flags.add(a);
  for (const r of T.roles) for (const part of [r.title, r.org]) {
    const missing = tokens(part).map(stem).filter((t) => !STOP.has(t) && !oHay.includes(' ' + t + ' '));
    if (missing.length) flags.add(part);
  }
  return [...flags];
}

// ---------- rendering ----------
function li(b) { return `<li>${b.label ? `<strong>${esc(b.label)}:</strong> ` : ''}${esc(b.text)}</li>`; }
function renderResume(T) {
  const labelled = T.skills.filter((s) => s.label), plain = T.skills.filter((s) => !s.label);
  let h = `<h1>${esc(T.name)}</h1>`;
  if (T.contact) h += `<p class="contact">${esc(T.contact)}</p>`;
  if (T.summary) h += `<h2>Professional Summary</h2><p>${esc(T.summary)}</p>`;
  if (T.skills.length) {
    h += '<h2>Core Competencies</h2>';
    if (labelled.length) h += '<ul>' + labelled.map(li).join('') + '</ul>';
    if (plain.length) h += `<p>${plain.map((s) => esc(s.text)).join(' | ')}</p>`;
  }
  if (T.roles.length) {
    h += '<h2>Professional Experience</h2>';
    for (const r of T.roles) {
      h += `<div class="role"><span>${esc(r.title)}</span><span>${esc(r.dates)}</span></div>`;
      if (r.org) h += `<div class="org">${esc(r.org)}</div>`;
      if (r.bullets.length) h += '<ul>' + r.bullets.map(li).join('') + '</ul>';
    }
  }
  if (T.education.length) h += '<h2>Education</h2><ul>' + T.education.map((e) => li(splitLabel(e))).join('') + '</ul>';
  for (const e of T.extras) h += `<h2>${esc(e.heading)}</h2><ul>` + e.items.map((x) => li(splitLabel(x))).join('') + '</ul>';
  if (T.additional.length) h += '<h2>Additional Information</h2><ul>' + T.additional.map((a) => li(splitLabel(a))).join('') + '</ul>';
  return h;
}
const chips = (el, arr) => { el.innerHTML = arr.length ? arr.map((x) => `<span class="chip">${esc(x)}</span>`).join('') : '<span class="hint">None</span>'; };

// ---------- Word export ----------
async function downloadDocx(T) {
  if (!window.docx) { alert('The Word export library could not load. Check your internet connection and try again.'); return; }
  const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, TabStopType } = window.docx;
  const F = 'Calibri', SZ = 21;
  const run = (text, o = {}) => new TextRun({ text, font: F, size: SZ, ...o });
  const heading = (t) => new Paragraph({ children: [run(t.toUpperCase(), { bold: true, size: 23 })], spacing: { before: 160, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } } });
  const bullet = (b) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 30 }, children: [...(b.label ? [run(b.label + ': ', { bold: true })] : []), run(b.text)] });
  const kids = [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(T.name, { bold: true, size: 36 })] })];
  if (T.contact) kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run(T.contact, { size: 19 })] }));
  if (T.summary) kids.push(heading('Professional Summary'), new Paragraph({ children: [run(T.summary)] }));
  if (T.skills.length) {
    kids.push(heading('Core Competencies'));
    T.skills.filter((s) => s.label).forEach((s) => kids.push(bullet(s)));
    const plain = T.skills.filter((s) => !s.label).map((s) => s.text);
    if (plain.length) kids.push(new Paragraph({ children: [run(plain.join(' | '))] }));
  }
  if (T.roles.length) {
    kids.push(heading('Professional Experience'));
    for (const r of T.roles) {
      kids.push(new Paragraph({ spacing: { before: 80 }, tabStops: [{ type: TabStopType.RIGHT, position: 10200 }], children: [run(r.title, { bold: true }), run('\t' + r.dates, { bold: true })] }));
      if (r.org) kids.push(new Paragraph({ children: [run(r.org, { italics: true })] }));
      r.bullets.forEach((b) => kids.push(bullet(b)));
    }
  }
  if (T.education.length) { kids.push(heading('Education')); T.education.forEach((e) => kids.push(bullet(splitLabel(e)))); }
  for (const e of T.extras) { kids.push(heading(e.heading)); e.items.forEach((x) => kids.push(bullet(splitLabel(x)))); }
  if (T.additional.length) { kids.push(heading('Additional Information')); T.additional.forEach((a) => kids.push(bullet(splitLabel(a)))); }
  const doc = new Document({ sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 800, bottom: 800, left: 850, right: 850 } } }, children: kids }] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileBase(T) + '.docx';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const fileBase = (T) => ((T.name || 'Resume').replace(/[^\w ]+/g, '').trim().replace(/\s+/g, '_') || 'Resume') + '_Tailored_Resume';

// ---------- settings ----------
const store = {
  get(k) { try { return localStorage.getItem('rt_' + k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem('rt_' + k) : localStorage.setItem('rt_' + k, v); } catch { /* storage blocked */ } }
};
function loadSettings() {
  const p = store.get('provider'); if (p && PROVIDERS[p]) $('provider').value = p;
  $('proxyUrl').value = store.get('proxy') || '';
  $('rememberKey').checked = store.get('remember') === '1';
  if (store.get('mode') === 'ai') document.querySelector('input[value=ai]').checked = true;
  providerChanged();
  modeChanged();
}
function providerChanged() {
  const p = $('provider').value;
  $('model').value = store.get('model_' + p) || PROVIDERS[p].model;
  $('apiKey').value = $('rememberKey').checked ? store.get('key_' + p) || '' : '';
  $('proxyRow').classList.toggle('hidden', p !== 'nvidia');
  store.set('provider', p);
}
function saveSettings() {
  const p = $('provider').value;
  store.set('model_' + p, $('model').value.trim() || null);
  store.set('proxy', $('proxyUrl').value.trim() || null);
  store.set('remember', $('rememberKey').checked ? '1' : null);
  store.set('key_' + p, $('rememberKey').checked ? $('apiKey').value.trim() || null : null);
}
const isAI = () => document.querySelector('input[name=mode]:checked').value === 'ai';
function modeChanged() { $('aiSettings').classList.toggle('hidden', !isAI()); store.set('mode', isAI() ? 'ai' : 'keyword'); }

// ---------- main ----------
let current = null;
function setStatus(msg, err) { $('status').textContent = msg; $('status').classList.toggle('error', !!err); }

async function run() {
  const jd = $('jd').value.trim(), resume = $('resume').value.trim();
  if (!jd || !resume) { setStatus('Please paste both the job description and your resume.', true); return; }
  const kws = extractKeywords(jd);
  const R = parseResume(resume);
  const oHay = ' ' + norm(resume) + ' ';
  const matched = kws.filter((k) => matchInfo(k, oHay)), missing = kws.filter((k) => !matchInfo(k, oHay));
  let T, warnings = [];
  $('tailorBtn').disabled = true;
  try {
    if (isAI()) {
      saveSettings();
      setStatus('Rewriting with AI...');
      T = await callAI(jd, resume, kws, matched.map((k) => k.term), missing.map((k) => k.term));
      warnings = checkInvented(resume, T, kws);
    } else {
      T = tailorKeyword(R, kws);
    }
    const tHay = ' ' + norm(resumeText(T)) + ' ';
    const after = kws.filter((k) => matchInfo(k, tHay));
    const pct = (n) => (kws.length ? Math.round((n / kws.length) * 100) : 0);
    $('scoreBefore').textContent = pct(matched.length);
    $('scoreAfter').textContent = pct(after.length);
    chips($('matched'), after.map((k) => k.term));
    chips($('missing'), kws.filter((k) => !matchInfo(k, tHay)).map((k) => k.term));
    $('warnBox').classList.toggle('hidden', !warnings.length);
    chips($('warnings'), warnings);
    $('preview').innerHTML = renderResume(T);
    current = T;
    $('results').classList.remove('hidden');
    $('previewWrap').classList.remove('hidden');
    setStatus(R.roles.length || T.roles.length ? 'Done. Review the preview below before downloading.' : 'Done, but no experience section was found. Put headings like EXPERIENCE on their own line.');
    $('results').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    setStatus(e.message || String(e), true);
  } finally {
    $('tailorBtn').disabled = false;
  }
}

const SAMPLE_JD = `Job Title: Store Executive - SAP MM
Location: Hyderabad
We are looking for a Store Executive to manage stores and inventory at our manufacturing plant.
Key Responsibilities:
- Handle Goods Receipt (GRN) and Goods Issue in SAP MM / S/4HANA using MIGO.
- Maintain inventory accuracy through physical verification and cycle counting.
- Follow FIFO and maintain bin locations for spares, consumables and raw material.
- Coordinate with Purchase, Quality and Accounts teams for Purchase Orders and invoice verification.
- Prepare MIS reports in MS Excel (VLOOKUP, Pivot Table).
- Ensure documentation and compliance for internal audit.
Requirements:
- 3-5 years experience in stores / inventory management.
- Hands-on SAP MM experience. Knowledge of Power BI is a plus.
- Graduate / MBA preferred.`;
const SAMPLE_RESUME = `Ravi Kumar
Hyderabad, Telangana | +91 90000 00000 | ravi.kumar@example.com

PROFILE
Store officer with 4 years of experience in stores and stock management at a fertilizer plant. Experienced in SAP S/4HANA MM. MBA in Finance.

SKILLS
SAP S/4HANA MM, Stock management, GRN, Material issue, Physical verification, MS Excel, Vendor coordination, Documentation

WORK EXPERIENCE
Store Officer | ABC Fertilizers Ltd | Kakinada
Jul 2021 - Present
• Prepared monthly stock reports in Excel for plant management.
• Posted goods receipts and material issues in SAP S/4HANA (MIGO) for spares and consumables.
• Conducted quarterly physical verification of stock and reconciled differences with SAP records.
• Followed FIFO for chemicals and maintained bin locations for over 2,000 items.
• Coordinated with purchase and quality teams on pending POs and rejected material.

EDUCATION
MBA (Finance), XYZ University, 2021
B.Com, PQR College, 2019

PERSONAL DETAILS
Languages: English, Hindi, Telugu`;

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', modeChanged));
  $('provider').addEventListener('change', providerChanged);
  $('rememberKey').addEventListener('change', saveSettings);
  $('tailorBtn').addEventListener('click', run);
  $('sampleBtn').addEventListener('click', () => { $('jd').value = SAMPLE_JD; $('resume').value = SAMPLE_RESUME; setStatus('Sample loaded. Click "Tailor my resume".'); });
  $('pdfBtn').addEventListener('click', () => {
    if (!current) return;
    const old = document.title; document.title = fileBase(current);
    window.print(); document.title = old;
  });
  $('docxBtn').addEventListener('click', () => current && downloadDocx(current).catch((e) => setStatus('Word export failed: ' + e.message, true)));
});
