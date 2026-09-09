/* Slash-command palette: type "/" for code, swarm, image, vision, speak, browse... */
(function () {
  const COMMANDS = [
    { name: "code", hint: "<task> — build with the coder skill + live preview" },
    { name: "swarm", hint: "<question> — ask 3 models in parallel + synthesis" },
    { name: "pipeline", hint: "<task> — planner → builder → critic" },
    { name: "image", hint: "<prompt> — generate an image inline" },
    { name: "vision", hint: "<question> — analyze the attached image" },
    { name: "speak", hint: "<text> — read aloud (OpenAI voice)" },
    { name: "browse", hint: "<url> — fetch + summarize a page" },
    { name: "model", hint: "— open the model library" },
    { name: "new", hint: "— start a new chat" },
    { name: "help", hint: "— show all commands" },
  ];
  let activeIdx = 0;

  function el(id) { return document.getElementById(id); }
  function toast(m, k) { if (window.PuterUI) window.PuterUI.toast(m, k); }

  function matches() {
    const v = el("userInput").value;
    if (!v.startsWith("/")) return null;
    const q = v.slice(1).split(" ")[0].toLowerCase();
    return COMMANDS.filter((c) => c.name.startsWith(q));
  }
  function renderPalette() {
    const pal = el("palette"), list = el("paletteList");
    const m = matches();
    if (!m) { pal.classList.add("hidden"); return; }
    activeIdx = Math.min(activeIdx, Math.max(0, m.length - 1));
    list.innerHTML = "";
    m.forEach((c, i) => {
      const d = document.createElement("button");
      d.className = "pal-item" + (i === activeIdx ? " active" : "");
      d.innerHTML = `<span class="pal-name">/${c.name}</span><span class="pal-hint">${c.hint}</span>`;
      d.onclick = () => { pick(c.name); };
      list.appendChild(d);
    });
    pal.classList.remove("hidden");
  }
  function pick(name) {
    el("userInput").value = "/" + name + " ";
    el("palette").classList.add("hidden");
    el("userInput").focus();
  }
  function hide() { el("palette").classList.add("hidden"); }

  /** Returns true if the text was a command (handled). */
  async function handle(text) {
    if (!text.startsWith("/")) return false;
    const [cmd, ...rest] = text.slice(1).split(" ");
    const arg = rest.join(" ").trim();
    const atts = await window.PuterFiles.readAttachments(el("fileInput").files);
    el("fileInput").value = "";
    switch (cmd.toLowerCase()) {
      case "code":
        if (!arg) return toast("Usage: /code <what to build>", "info"), true;
        window.PuterAgent.send(arg, atts, "coder");
        return true;
      case "swarm":
        if (!arg) return toast("Usage: /swarm <question>", "info"), true;
        window.PuterSwarm.runCompare(arg);
        return true;
      case "pipeline":
        if (!arg) return toast("Usage: /pipeline <task>", "info"), true;
        window.PuterSwarm.runPipeline(arg);
        return true;
      case "image": {
        if (!arg) return toast("Usage: /image <prompt>", "info"), true;
        window.PuterAgent.timeline("🎨 generating image…");
        try {
          const img = await puter.ai.txt2img(arg, { model: "gpt-image-1-mini" });
          img.style.maxWidth = "100%";
          const body = window.PuterAgent.addMsg("assistant", `<p><b>🎨 ${arg.replace(/</g, "&lt;")}</b></p>`, "[image] " + arg);
          body.appendChild(img);
          toast("Image ready", "ok");
        } catch (e) {
          window.PuterAgent.addMsg("assistant", window.PuterUI.errorCard(e, "gpt-image-1-mini"));
        }
        return true;
      }
      case "vision": {
        const media = atts.find((a) => a.kind === "image");
        if (!media) {
          toast("Attach an image first, then /vision <question>", "info");
          window.PuterAgent.addMsg("user", "/" + text.slice(1).replace(/</g, "&lt;"));
          window.PuterAgent.addMsg("assistant", "📎 <b>Attach an image</b> using the file picker, then run <b>/vision</b> again.");
          return true;
        }
        const q = arg || "What do you see in this image?";
        window.PuterAgent.timeline("👁 analyzing image…");
        try {
          const resp = await puter.ai.chat(q, media.payload, false, { model: el("modelSelect").value, normalize: true });
          const t = window.PuterModels.extractText(resp);
          window.PuterAgent.addMsg("user", "/vision " + q.replace(/</g, "&lt;"));
          window.PuterAgent.addMsg("assistant", window.PuterAgent.md(t), t);
        } catch (e) {
          window.PuterAgent.addMsg("assistant", window.PuterUI.errorCard(e, el("modelSelect").value));
        }
        return true;
      }
      case "speak": {
        if (!arg) return toast("Usage: /speak <text>", "info"), true;
        try {
          const audio = await puter.ai.txt2speech(arg.slice(0, 2900), { provider: "openai", model: "gpt-4o-mini-tts", voice: "alloy" });
          audio.setAttribute("controls", "");
          const body = window.PuterAgent.addMsg("assistant", `<p>🔊 <i>${arg.slice(0, 200).replace(/</g, "&lt;")}</i></p>`, "[audio]");
          body.appendChild(audio);
          audio.play().catch(() => {});
        } catch (e) {
          window.PuterAgent.addMsg("assistant", window.PuterUI.errorCard(e, "gpt-4o-mini-tts"));
        }
        return true;
      }
      case "browse": {
        if (!arg) return toast("Usage: /browse <url>", "info"), true;
        el("browserUrl").value = arg;
        window.PuterFiles.doFetch(true);
        toast("Fetching + summarizing…", "info");
        return true;
      }
      case "model":
        window.PuterLibrary.open();
        return true;
      case "new":
        window.PuterSessions.newSession();
        return true;
      case "help":
        window.PuterAgent.addMsg("assistant",
          "<b>Commands</b><br>" + COMMANDS.map((c) => `<code>/${c.name}</code> ${c.hint}`).join("<br>"));
        return true;
      default:
        toast(`Unknown command /${cmd} — try /help`, "err");
        return true;
    }
  }

  window.PuterCommands = { renderPalette, hide, handle, pick, COMMANDS,
    move: (d) => { const m = matches() || []; activeIdx = (activeIdx + d + m.length) % Math.max(1, m.length); renderPalette(); },
    enter: () => { const m = matches() || []; if (m[activeIdx]) pick(m[activeIdx].name); } };
})();
