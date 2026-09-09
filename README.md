# Puter Super-Agent (OpenAI + Claude, free via Puter.js)

Keyless AI chat + agent + swarm app. All AI runs through Puter.js User-Pays —
no API keys, users cover their own usage via their Puter account.

## Run locally (HTTP required — not file://)

```bash
cd puter-ai-chat-app
python3 -m http.server 8080
# open http://localhost:8080
```

Alternative: `npx serve .` (serve is installed on this machine).

## What's inside

- Chat with ALL OpenAI + Claude models (grouped picker + live refresh via `puter.ai.listModels()`)
- Agent mode: function tools (web_fetch, generate_image, speak, run_code_preview, fs_*, kv_*) with Plan/Auto/Yolo approval
- Swarm compare (parallel fan-out + aggregator synthesis) and Pipeline (planner → builder → critic)
- Image (GPT Image), Vision (URL + file upload), Speech (OpenAI TTS), Files (Puter FS), Browser (puter.net.fetch + summarize), Deploy
- Live sandbox preview iframe (Manus-style — agent HTML renders visibly)
- Sessions: new / switch / export JSON (localStorage)
- `__workers/api.worker.js`: dynamic worker demo (health, KV, fetch)

## Self-deploy to Puter

1. Open the app → Deploy tab → enter subdomain → Create/update site (uses `puter.hosting.create/update`).
2. Visit `https://<sub>.puter.site` and `https://<sub>.puter.site/__workers/api/health`.
3. CLI alternative: `npm i -g @heyputer/cli && puter worker deploy __workers/api.worker.js <name>` → `*.puter.work`.

## Local CLI bridge ideas (optional, not required)

- `mmx speech synthesize --text-file answer.txt --out answer.mp3` — narrate an answer
- `codex exec "review this code: ..."` — second opinion on agent code
- `opencode run "implement feature X"` — continue locally what the agent drafted

Powered by [Puter](https://developer.puter.com).
