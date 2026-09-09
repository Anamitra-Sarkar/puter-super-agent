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
        description: "Render HTML (optionally with inline JS/CSS) into the live sandbox preview panel so the user can SEE it. Pass full HTML document or snippet. Optionally pass path (e.g. index.html) to also save it into the Code tab codebase.",
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
        name: "make_file",
        description: "Generate and download a file: zip (JSON map of filename->content), pdf, docx, pptx (slides split by lines containing only ---), tex/md/txt/html/csv/json (raw text).",
        parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] },
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

  async function execute(name, args, ctx) {
    args = args || {};
    switch (name) {
      case "web_fetch": {
        const r = await puter.net.fetch(args.url);
        const t = await r.text();
        return t.slice(0, 12000);
      }
      case "generate_image": {
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
      case "memory_read": {
        const m = window.PuterMemory ? await window.PuterMemory.load() : "";
        return m || "(MEMORY.md is empty)";
      }
      case "memory_write": {
        if (window.PuterMemory) await window.PuterMemory.append(String(args.entry || "").slice(0, 500));
        return "Recorded in MEMORY.md.";
      }
      default:
        throw new Error("Unknown tool: " + name);
    }
  }

  function needsApproval(toolName, approvalMode) {
    if (approvalMode === "yolo") return false;
    if (approvalMode === "plan") return true; // plan = dry-run everything
    const def = TOOLS.find((t) => t.function.name === toolName);
    if (!def) return true;
    if (def._ask) return true; // sensitive tools always ask (e.g. secrets)
    return def._kind !== "read"; // auto: reads run, writes ask
  }

  window.PuterTools = { TOOLS, schemaForChat, execute, needsApproval };
})();
