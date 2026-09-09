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
        description: "Render HTML (optionally with inline JS/CSS) into the live sandbox preview panel so the user can SEE it. Pass full HTML document or snippet.",
        parameters: { type: "object", properties: { html: { type: "string" }, title: { type: "string" } }, required: ["html"] },
      },
      _kind: "write",
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
        if (ctx && ctx.onPreview) ctx.onPreview(args.html, args.title);
        return "Preview rendered in the sandbox panel.";
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
      default:
        throw new Error("Unknown tool: " + name);
    }
  }

  function needsApproval(toolName, approvalMode) {
    if (approvalMode === "yolo") return false;
    if (approvalMode === "plan") return true; // plan = dry-run everything
    const def = TOOLS.find((t) => t.function.name === toolName);
    if (!def) return true;
    return def._kind !== "read"; // auto: reads run, writes ask
  }

  window.PuterTools = { TOOLS, schemaForChat, execute, needsApproval };
})();
