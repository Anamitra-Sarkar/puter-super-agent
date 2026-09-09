/* Tool definitions (JSON-schema style, mmx export-schema inspired) + executors.
 * Read-only tools auto-run in Auto mode; write/deploy tools ask first. */
(function () {
  const TOOLS = [
    {
      type: "function",
      function: {
        name: "web_fetch",
        description: "Fetch a URL's text content (CORS-free via puter.net.fetch). Use for docs, pages, APIs returning text.",
        parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
      },
      _kind: "read",
    },
    {
      type: "function",
      function: {
        name: "generate_image",
        description: "Generate an image with GPT Image and show it in the Image tab.",
        parameters: { type: "object", properties: { prompt: { type: "string" }, model: { type: "string" } }, required: ["prompt"] },
      },
      _kind: "write",
    },
    {
      type: "function",
      function: {
        name: "speak",
        description: "Speak text aloud with OpenAI TTS (gpt-4o-mini-tts).",
        parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      },
      _kind: "write",
    },
    {
      type: "function",
      function: {
        name: "run_code_preview",
        description: "Render HTML into the live sandbox preview (YOU choose what to preview — full control). The preview is a REAL full-stack app environment: your JS can call window.PuterBackend.kv.get/set/del/list, .fs.read/write, and .ai.chat(prompt) — all promise-based, backed by real Puter KV/files/AI through a secure bridge. Example: const user = await PuterBackend.kv.get('user'). CRITICAL: always send the COMPLETE file content — never partial/truncated. Optionally pass path to save into the Code tab.",
        parameters: { type: "object", properties: { html: { type: "string" }, title: { type: "string" }, path: { type: "string" } }, required: ["html"] },
      },
      _kind: "write",
    },
    {
      type: "function",
      function: {
        name: "memory_read",
        description: "Read the persistent MEMORY.md notes from earlier work (also auto-injected into context).",
        parameters: { type: "object", properties: {} },
      },
      _kind: "read",
    },
    {
      type: "function",
      function: {
        name: "spawn_subagent",
        description: "Orchestrate a SUB-AGENT for part of a complex task (it cannot spawn further agents). Roles: researcher (web-first brief), coder (runnable code), critic (review + fixes), tester (edge cases + test plan), designer (visual direction). Returns its result for you to integrate. Run independent subagents one after another; each call is one subagent.",
        parameters: {
          type: "object",
          properties: {
            role: { type: "string", description: "researcher | coder | critic | tester | designer" },
            task: { type: "string" },
            model: { type: "string", description: "optional override, default cheap" },
          },
          required: ["role", "task"],
        },
      },
      _kind: "read",
    },
    {
      type: "function",
      function: {
        name: "spawn_swarm",
        description: "Ask 2-3 models the SAME question in parallel and get all answers back to synthesize. Best for hard decisions and second opinions.",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string" },
            models: { type: "array", items: { type: "string" }, description: "optional, default sol+sonnet5+luna" },
          },
          required: ["question"],
        },
      },
      _kind: "read",
    },
    {
      type: "function",
      function: {
        name: "read_code",
        description: "Read files from the Code tab codebase INTO CONTEXT (or list them when path is omitted). ALWAYS use this instead of guessing at uploaded/built code — files do not sit in your context until you read them.",
        parameters: { type: "object", properties: { path: { type: "string" } } },
      },
      _kind: "read",
    },
    {
      type: "function",
      function: {
        name: "ask_user",
        description: "Ask the user an interactive question mid-task: show options (first can be marked recommended) plus a free-text field and a confirm step. Use after analyzing/planning, before doing the work. ALWAYS use this instead of guessing when a decision affects what you will build.",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string" },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  description: { type: "string" },
                  recommended: { type: "boolean" },
                },
                required: ["label"],
              },
            },
          },
          required: ["question", "options"],
        },
      },
      _kind: "read",
    },
    {
      type: "function",
      function: {
        name: "save_code_files",
        description: "Save a MULTI-FILE app to the Code tab codebase: pass a map of path->COMPLETE file content (e.g. index.html, styles.css, app.js). Optionally set preview to the entry file to render it (verifies automatically). The previewed app is full-stack: its JS can use window.PuterBackend (kv/fs/ai) for real persistence and AI. Use this for any non-trivial build instead of one mono file. Every file must be complete, never truncated.",
        parameters: {
          type: "object",
          properties: {
            files: { type: "object", description: "path -> complete content" },
            preview: { type: "string", description: "entry file to preview, e.g. index.html" },
          },
          required: ["files"],
        },
      },
      _kind: "write",
    },
    {
      type: "function",
      function: {
        name: "make_file",
        description: "Generate and download a file: zip (JSON map of filename->content), pdf, docx, pptx (slides split by lines containing only ---), tex/md/txt/html/csv/json (raw text).",
        parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] },
      },
      _kind: "write",
    },
    {
      type: "function",
      function: {
        name: "set_theme",
        description: "Generate an aesthetic background image and apply it LIVE to this app's UI (body background + hero accents). Describe mood/colors, e.g. 'warm paper texture with terracotta sun'. Use sparingly — one theme at a time.",
        parameters: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] },
      },
      _kind: "write",
    },
    {
      type: "function",
      function: {
        name: "fetch_file",
        description: "Download any public file (data, image, doc) via CORS-free fetch and save it into the Code tab codebase and optionally Puter cloud storage. No restrictions beyond public URLs.",
        parameters: { type: "object", properties: { url: { type: "string" }, saveAs: { type: "string" }, toCloud: { type: "boolean" } }, required: ["url", "saveAs"] },
      },
      _kind: "write",
    },
    {
      type: "function",
      function: {
        name: "extract_text",
        description: "Cheap OCR: extract raw printed/handwritten text from an image or multi-page PDF (URL or codebase path). Use for scans, receipts, documents. For questions ABOUT an image, analyze it with vision instead.",
        parameters: { type: "object", properties: { source: { type: "string" } }, required: ["source"] },
      },
      _kind: "read",
    },
    {
      type: "function",
      function: {
        name: "memory_write",
        description: "Append an important fact to persistent MEMORY.md (decisions, file paths, credentials locations, things that must survive compaction). Keep it short.",
        parameters: { type: "object", properties: { entry: { type: "string" } }, required: ["entry"] },
      },
      _kind: "write",
    },
    {
      type: "function",
      function: {
        name: "get_secret",
        description: "Read a named secret from the user's browser-local vault (Secrets tab) for verifying builds with real credentials. The user must approve each read. Never print secret values in chat.",
        parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      },
      _kind: "write",
      _ask: true,
    },
    {
      type: "function",
      function: {
        name: "fs_list",
        description: "List files in the app's Puter cloud directory.",
        parameters: { type: "object", properties: { path: { type: "string" } } },
      },
      _kind: "read",
    },
    {
      type: "function",
      function: {
        name: "fs_read",
        description: "Read a text file from Puter cloud storage.",
        parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      },
      _kind: "read",
    },
    {
      type: "function",
      function: {
        name: "fs_write",
        description: "Write a text file to Puter cloud storage.",
        parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      },
      _kind: "write",
    },
    {
      type: "function",
      function: {
        name: "kv_remember",
        description: "Remember a fact across sessions (Puter KV).",
        parameters: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] },
      },
      _kind: "write",
    },
    {
      type: "function",
      function: {
        name: "kv_recall",
        description: "Recall a remembered fact (Puter KV).",
        parameters: { type: "object", properties: { key: { type: "string" } }, required: ["key"] },
      },
      _kind: "read",
    },
  ];

  function schemaForChat(withWebSearch) {
    const base = TOOLS.map(({ _kind, ...rest }) => rest);
    if (withWebSearch) base.push({ type: "web_search" });
    return base;
  }

  /** Interactive question card: option buttons (recommended first) + free text + confirm. */
  function askUserCard(question, options) {
    return new Promise((resolve) => {
      const A = window.PuterAgent;
      const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const opts = (Array.isArray(options) ? options : []).slice(0, 6).map((o, i) =>
        typeof o === "string" ? { label: o, recommended: i === 0 } : o);
      const body = A.addMsg("assistant",
        `<div class="ask-card"><b>❓ ${esc(question)}</b><div class="ask-opts"></div>
         <div class="row"><input class="ask-custom" placeholder="Or type your own answer…" />
         <button class="btn primary sm ask-go">Confirm →</button></div></div>`,
        "[awaiting user answer]");
      const box = body.querySelector(".ask-opts");
      const input = body.querySelector(".ask-custom");
      let picked = null;
      const lock = () => {
        box.querySelectorAll("button").forEach((b) => (b.disabled = true));
        input.disabled = true;
        body.querySelector(".ask-go").disabled = true;
      };
      const done = (val) => { lock(); resolve(val); };
      opts.forEach((o, i) => {
        const b = document.createElement("button");
        b.className = "ask-opt" + (o.recommended || i === 0 ? " rec" : "");
        b.innerHTML = `<b>${esc(o.label)}${o.recommended || i === 0 ? ' <span class="tag">recommended</span>' : ""}</b>` +
          (o.description ? `<span class="muted small">${esc(o.description)}</span>` : "");
        b.onclick = () => { picked = o.label; input.value = o.label; b.classList.add("picked"); };
        box.appendChild(b);
      });
      body.querySelector(".ask-go").onclick = () => {
        const v = (input.value || picked || (opts[0] && opts[0].label) || "").trim();
        if (!v) return;
        done(v);
      };
      body.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (window.PuterUI) window.PuterUI.toast("The agent needs your input ⬇", "info");
    });
  }

  async function execute(name, args, ctx) {
    args = args || {};
    switch (name) {
      case "web_fetch": {
        const r = await puter.net.fetch(args.url);
        const t = await r.text();
        return t.slice(0, 12000);
      }
      case "generate_image": {
        if (window.PuterSafety) window.PuterSafety.spendNote("image");
        const img = await puter.ai.txt2img(args.prompt, { model: args.model || "gpt-image-1-mini" });
        if (ctx && ctx.onImage) ctx.onImage(img, args.prompt);
        return "Image generated and shown in the Image tab.";
      }
      case "speak": {
        const audio = await puter.ai.txt2speech(args.text.slice(0, 2900), { provider: "openai", model: "gpt-4o-mini-tts", voice: "alloy" });
        if (ctx && ctx.onAudio) ctx.onAudio(audio);
        return "Audio played in the Speech tab.";
      }
      case "run_code_preview": {
        let extra = "";
        if (ctx && ctx.onPreview) extra = await ctx.onPreview(args.html, args.title, args.path);
        return "Preview rendered in the sandbox panel." + (args.path ? " Saved to codebase as " + args.path + "." : "") + (extra || "");
      }
      case "save_code_files": {
        const map = (args && args.files) || {};
        const names = Object.keys(map).slice(0, 40);
        if (!names.length) throw new Error("files map was empty");
        for (const n of names) {
          if (window.PuterCodebase) window.PuterCodebase.put(n, String(map[n] == null ? "" : map[n]));
        }
        let extra = "";
        if (args.preview && ctx && ctx.onPreview) {
          const entry = names.includes(args.preview) ? args.preview : names[0];
          const html = String(map[entry] || "");
          extra = await ctx.onPreview(html, entry, entry);
        } else if (window.PuterDock) {
          window.PuterDock.open("code");
        }
        return `Saved ${names.length} files to the Code tab (${names.slice(0, 12).join(", ")}${names.length > 12 ? ", …" : ""}).` + (extra || "");
      }
      case "get_secret": {
        const v = window.PuterSecrets ? window.PuterSecrets.get(args.name) : undefined;
        if (v === undefined) return `No secret named "${args.name}". Ask the user to add it in the Secrets tab. Do NOT invent a value.`;
        return `Secret "${args.name}" value:\n${v}\nUse it for verification calls; never print it in chat responses.`;
      }
      case "fs_list": {
        const items = await puter.fs.readdir(args.path || ".");
        return JSON.stringify(items.map((i) => i.path || i.name).slice(0, 100));
      }
      case "fs_read": {
        const blob = await puter.fs.read(args.path);
        const text = await blob.text();
        return text.slice(0, 12000);
      }
      case "fs_write": {
        await puter.fs.write(args.path, args.content);
        return "Wrote " + args.path;
      }
      case "kv_remember": {
        await puter.kv.set("agentmem_" + args.key, args.value);
        return "Remembered " + args.key;
      }
      case "kv_recall": {
        const v = await puter.kv.get("agentmem_" + args.key);
        return v == null ? "(nothing stored)" : String(v);
      }
      case "make_file": {
        return await window.PuterFilegen.makeFile(args.filename, args.content);
      }
      case "set_theme": {
        const url = await window.PuterTheme.generate(args.prompt || "warm minimal abstract");
        return url ? "Theme applied live to the app UI." : "Theme generation failed; UI unchanged.";
      }
      case "fetch_file": {
        const r = await puter.net.fetch(args.url);
        if (!r.ok) throw new Error("fetch failed: HTTP " + r.status);
        const buf = await r.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const mime = (r.headers.get("content-type") || "application/octet-stream").split(";")[0];
        const name = String(args.saveAs || "download.bin").slice(0, 120);
        const looksText = /^text\/|json|javascript|xml|csv/.test(mime) || /\.(txt|md|csv|json|js|ts|py|html|css|tex)$/i.test(name);
        if (window.PuterCodebase) {
          if (looksText) {
            window.PuterCodebase.put(name, new TextDecoder().decode(buf).slice(0, 300000));
          } else {
            let b64 = "";
            const CH = 32768;
            for (let i = 0; i < bytes.length && b64.length < 240000; i += CH) {
              b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
            }
            window.PuterCodebase.put(name, `data:${mime};base64,${btoa(b64)}`);
          }
        }
        if (args.toCloud) await puter.fs.write(name, new Blob([buf], { type: mime }));
        return `Downloaded ${args.url} (${buf.byteLength} bytes) → codebase as ${name}` + (args.toCloud ? " + Puter cloud" : "");
      }
      case "extract_text": {
        let src = args.source;
        const cb = window.PuterCodebase && window.PuterCodebase.get(args.source);
        if (cb && /^data:/.test(cb.content)) src = cb.content;
        const text = await puter.ai.img2txt(src);
        return String(text).slice(0, 12000) || "(no text found in image)";
      }
      case "spawn_subagent": {
        const roles = {
          researcher: "You are a researcher subagent. Web-first: use short queries, cite URLs, return a tight brief with sources.",
          coder: "You are a coder subagent. Return correct runnable code only, complete files, no truncation.",
          critic: "You are a critic subagent. Find bugs, edge cases, security issues; propose concrete fixes.",
          tester: "You are a tester subagent. List edge cases and a step-by-step test plan with expected results.",
          designer: "You are a designer subagent. Give concrete visual direction: layout, palette (no purple/blue gradients), type, spacing.",
        };
        const role = roles[args.role] || roles.researcher;
        const r = await puter.ai.chat(
          [{ role: "system", content: role + " Keep it focused and under 800 words." },
           { role: "user", content: String(args.task || "").slice(0, 4000) }],
          { model: args.model || "gpt-5.6-luna", normalize: true });
        return `[subagent:${args.role}]\n` + window.PuterModels.extractText(r).slice(0, 6000);
      }
      case "spawn_swarm": {
        const team = (Array.isArray(args.models) && args.models.length ? args.models : ["gpt-5.6-sol", "claude-sonnet-5", "gpt-5.6-luna"]).slice(0, 3);
        const jobs = team.map(async (m) => {
          try {
            const r = await puter.ai.chat(String(args.question || "").slice(0, 3000), { model: m, normalize: true });
            return `--- ${m} ---\n` + window.PuterModels.extractText(r).slice(0, 4000);
          } catch (e) { return `--- ${m} --- FAILED: ${String((e && e.message) || e).slice(0, 200)}`; }
        });
        return (await Promise.all(jobs)).join("\n\n");
      }
      case "memory_read": {
        const m = window.PuterMemory ? await window.PuterMemory.load() : "";
        return m || "(MEMORY.md is empty)";
      }
      case "read_code": {
        if (!window.PuterCodebase) return "(no codebase available)";
        if (!args.path) {
          const names = window.PuterCodebase.names();
          return names.length ? "Codebase files (use read_code with a path to pull one into context):\n" + names.join("\n") : "(codebase is empty)";
        }
        const f = window.PuterCodebase.get(args.path);
        if (!f) return `No file "${args.path}". Available: ${window.PuterCodebase.names().slice(0, 30).join(", ")}`;
        return `--- ${args.path} (now in context) ---\n` + String(f.content).slice(0, 15000);
      }
      case "memory_write": {
        if (window.PuterMemory) await window.PuterMemory.append(String(args.entry || "").slice(0, 500));
        return "Recorded in MEMORY.md.";
      }
      case "ask_user": {
        const ans = await askUserCard(args.question || "A question for you:", args.options || []);
        return "User answered: " + ans;
      }
      default:
        throw new Error("Unknown tool: " + name);
    }
  }

  function needsApproval(toolName, approvalMode) {
    if (approvalMode === "beast" || approvalMode === "yolo") return false; // beast: never ask, not even once
    if (approvalMode === "plan") return true; // plan = dry-run everything
    const def = TOOLS.find((t) => t.function.name === toolName);
    if (!def) return true;
    if (def._ask) return true; // sensitive tools always ask (e.g. secrets)
    return def._kind !== "read"; // auto: reads run, writes ask
  }

  window.PuterTools = { TOOLS, schemaForChat, execute, needsApproval };
})();
