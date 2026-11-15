# Resume Tailor

Paste a job description and a resume, and get an ATS-friendly version tailored to that job. You can preview it and download it as PDF or Word. Everything runs in your browser.

- **Keyword mode** (free, no key): reorders skills and bullets around the job's keywords, adds bold labels and shows matched and missing keywords.
- **AI mode** (free key): rewrites the summary and bullets using only facts from your resume. Anything the AI adds that isn't in the original is flagged under "Please double-check".
- It never adds experience you don't have. Missing keywords are listed as gaps.

## Free API keys
| Provider | Get a key | Notes |
|---|---|---|
| Groq (default) | console.groq.com → API Keys | Fast, works directly |
| Google Gemini | aistudio.google.com → Get API key | Works directly |
| NVIDIA | build.nvidia.com → Get API Key | Needs the free proxy below |

Your key is sent only from your browser to the provider. If you tick "Remember", it's stored only in that browser.

## Shared AI server (one-time, free) so visitors need no key
The Cloudflare Worker in `proxy/worker.js` keeps your keys secret and tries Groq → Gemini → NVIDIA, moving to the next one on an error or timeout.
1. Sign up at dash.cloudflare.com (free) → **Workers & Pages** → **Create** → **Create Worker** → name it `resume-tailor-ai` → **Deploy**.
2. Click **Edit code**, replace everything with `proxy/worker.js`, then **Deploy**.
3. Go to **Settings → Variables and Secrets → Add**. Choose type **Secret** and add `GROQ_KEY`, `GEMINI_KEY` and `NVIDIA_KEY` (any you have). Then **Deploy**.
4. Copy the worker address (like `https://resume-tailor-ai.xxx.workers.dev`) into `WORKER_URL` at the top of the AI section in `app.js`, then push.

Anyone with the site link uses your free quota. The Worker only answers requests from your site.

Resumes can be uploaded as PDF, Word (.docx) or .txt. They're read in the browser and never uploaded.

## Hosting
The site is static (`index.html`, `style.css`, `app.js`), so it runs on GitHub Pages, Netlify or Cloudflare Pages. You can also just open `index.html` locally.

## Tips
- Keep section headings (SUMMARY, SKILLS, EXPERIENCE, EDUCATION) on their own lines.
- For PDF, click **Download PDF** and choose **Save as PDF**. Turn off "Headers and footers" in the print options.
