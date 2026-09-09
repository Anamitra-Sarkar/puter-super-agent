/* Slash-command palette: type "/" for code, swarm, image, vision, speak, browse... */
(function () {
  const COMMANDS = [
    { name: "code", hint: "<task> — build with the coder skill + live preview" },
    { name: "swarm", hint: "<question> — ask 3 models in parallel + synthesis" },
    { name: "pipeline", hint: "<task> — planner → builder → critic" },
    { name: "image", hint: "<prompt> — generate (or attach an image to edit it)" },
    { name: "video", hint: "<prompt> — generate a short AI video (takes minutes)" },
    { name: "zip", hint: "— download the whole codebase as .zip" },
    { name: "theme", hint: "<prompt|reset> — AI paints this app's background" },
    { name: "vision", hint: "<question> — analyze the attached image" },
    { name: "speak", hint: "<text> — read aloud (OpenAI voice)" },
    { name: "browse", hint: "<url> — fetch + summarize a page" },
    { name: "plan", hint: "<task> — draft a plan, approve, then build" },
    { name: "build", hint: "<app idea> — full pipeline: plan → build → verify → security → goal-check" },
    { name: "deploy", hint: "[subdomain] — ship this app to *.puter.site" },
    { name: "files", hint: "— list your Puter cloud files" },
    { name: "compact", hint: "— summarize history to free context" },
    { name: "model", hint: "— open the model library" },
    { name: "note", hint: "[text] — save to Notes (or last answer)" },
    { name: "template", hint: "— everyday task starters" },
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
        window.PuterSafety.spendNote("image");
        window.PuterAgent.timeline("🎨 generating image…");
        try {
          const editImg = atts.find((a) => a.kind === "image");
          let inputImage = null;
          if (editImg && editImg.payload instanceof File) {
            inputImage = await new Promise((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(r.result);
              r.onerror = rej;
              r.readAsDataURL(editImg.payload);
            });
          }
          const img = inputImage
            ? await puter.ai.txt2img(arg, { model: "gpt-image-1-mini", input_image: inputImage })
            : await puter.ai.txt2img(arg, { model: "gpt-image-1-mini" });
          img.style.maxWidth = "100%";
          const body = window.PuterAgent.addMsg("assistant", `<p><b>🎨 ${arg.replace(/</g, "&lt;")}</b>${editImg ? " (edited from attachment)" : ""}</p>`, "[image] " + arg);
          body.appendChild(img);
          if (window.PuterCodebase && img.src && img.src.length < 250000) {
            window.PuterCodebase.put("images/gen-" + Date.now() + ".png", img.src);
          }
          toast("Image ready", "ok");
        } catch (e) {
          window.PuterAgent.addMsg("assistant", window.PuterUI.errorCard(e, "gpt-image-1-mini"));
        }
        return true;
      }
      case "video": {
        if (!arg) return toast("Usage: /video <prompt> (takes minutes, uses credits)", "info"), true;
        window.PuterSafety.spendNote("video");
        window.PuterAgent.addMsg("user", "🎬 <b>/video</b> " + arg.replace(/</g, "&lt;"));
        window.PuterAgent.timeline("🎬 generating video — this takes minutes, keep chatting…");
        toast("Video generating in background", "info");
        try {
          const video = await puter.ai.txt2vid(arg);
          video.setAttribute("controls", "");
          video.style.maxWidth = "100%";
          const body = window.PuterAgent.addMsg("assistant", `<p><b>🎬 ${arg.replace(/</g, "&lt;")}</b></p>`, "[video] " + arg);
          body.appendChild(video);
          toast("Video ready", "ok");
        } catch (e) {
          window.PuterAgent.addMsg("assistant", window.PuterUI.errorCard(e, "sora-2"));
        }
        return true;
      }
      case "zip": {
        window.PuterFilegen.downloadCodebaseZip();
        return true;
      }
      case "theme": {
        if (!arg || /^reset|off|remove$/i.test(arg)) { window.PuterTheme.reset(); return true; }
        window.PuterAgent.addMsg("user", "🎨 <b>/theme</b> " + arg.replace(/</g, "&lt;"));
        await window.PuterTheme.generate(arg);
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
          let vm = el("modelSelect").value;
          if (!window.PuterModels.supportsVision(vm)) {
            vm = window.PuterModels.VISION_FALLBACK;
            window.PuterAgent.timeline(`(gpt-oss is text-only — analyzing with ${vm})`);
          }
          const resp = await puter.ai.chat(q, media.payload, false, { model: vm, normalize: true });
          const t = window.PuterModels.extractText(resp);
          window.PuterAgent.addMsg("user", "/vision " + q.replace(/</g, "&lt;"));
          window.PuterAgent.addMsg("assistant", window.PuterAgent.md(t), t);
        } catch (e) {
          window.PuterAgent.addMsg("assistant", window.PuterUI.errorCard(e, "vision"));
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
        window.PuterFiles.doFetch(arg, true);
        toast("Fetching + summarizing…", "info");
        return true;
      }
      case "plan": {
        if (!arg) return toast("Usage: /plan <task>", "info"), true;
        runPlan(arg);
        return true;
      }
      case "build": {
        if (!arg) return toast("Usage: /build <describe the app or goal>", "info"), true;
        window.PuterAgent.timeline("🏗 full-build mode: plan → your confirm → build → verify → security/privacy → goal-check → report");
        runPlan(arg);
        return true;
      }
      case "deploy": {
        askDeploy(arg);
        return true;
      }
      case "files": {
        try {
          const items = await puter.fs.readdir(".");
          const list = items.map((i) => i.path || i.name).slice(0, 60);
          window.PuterAgent.addMsg("assistant",
            "<b>📁 Puter cloud files</b><br>" + (list.length ? list.map((p) => `<code>${p.replace(/</g, "&lt;")}</code>`).join("<br>") : "(empty)"));
        } catch (e) {
          window.PuterAgent.addMsg("assistant", window.PuterUI.errorCard(e, "files"));
        }
        return true;
      }
      case "compact": {
        await window.PuterAgent.compactHistory("manual /compact");
        return true;
      }
      case "model":
        window.PuterLibrary.open();
        return true;
      case "note": {
        if (arg) window.PuterNotes.save(arg.slice(0, 60), arg);
        else {
          const turns = window.PuterSessions.getTurns().filter((t) => t.role === "assistant");
          const last = turns[turns.length - 1];
          if (!last) return toast("Nothing to save yet", "err"), true;
          window.PuterNotes.save(last.text.split("\n")[0].slice(0, 60) || "Note", last.text);
        }
        return true;
      }
      case "template":
        window.PuterTemplates.open();
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

  async function runPlan(task) {
    const A = window.PuterAgent;
    A.addMsg("user", "📋 <b>/plan</b> " + task.replace(/</g, "&lt;"));
    A.timeline("📋 drafting plan…");
    const model = (document.getElementById("modelSelect") || {}).value || "gpt-5.6-sol";
    try {
      const resp = await puter.ai.chat(
        [{ role: "system", content: "Draft a short numbered implementation plan for the task. Be concrete. Do NOT implement yet — end by stopping." },
         { role: "user", content: task }],
        { model, normalize: true });
      const plan = window.PuterModels.extractText(resp);
      const body = A.addMsg("assistant", `<b>📋 Proposed plan</b>` + A.md(plan),
        "Plan:\n" + plan.slice(0, 3000));
      const row = document.createElement("div");
      row.className = "row plan-btns";
      row.innerHTML = `<button class="btn primary sm" data-a="go">Approve & build</button>
        <button class="btn sm" data-a="edit">Edit</button>
        <button class="btn ghost sm" data-a="no">Discard</button>`;
      body.appendChild(row);
      const lock = () => row.querySelectorAll("button").forEach((b) => (b.disabled = true));
      row.querySelector('[data-a="go"]').onclick = () => {
        lock();
        A.send(`Build this approved plan step by step. If UI, preview it.\n\nPLAN:\n${plan}\n\nORIGINAL TASK: ${task}`, [], "coder");
      };
      row.querySelector('[data-a="edit"]').onclick = () => {
        lock();
        const inp = document.getElementById("userInput");
        inp.value = "Build this (edited plan):\n" + plan + "\n\nOriginal task: " + task;
        inp.focus();
        toast("Plan dropped into the composer — edit then Send", "info");
      };
      row.querySelector('[data-a="no"]').onclick = () => { lock(); toast("Plan discarded", "info"); };
    } catch (e) {
      A.addMsg("assistant", window.PuterUI.errorCard(e, model));
    }
  }

  function askDeploy(preset) {
    const A = window.PuterAgent;
    const body = A.addMsg("assistant",
      `<b>🚀 Deploy to Puter</b><p class="muted">Ship this app to a public <code>*.puter.site</code> (backend worker rides along).</p>
       <div class="row"><input id="deploySubInline" placeholder="subdomain e.g. my-agent" value="${(preset || "").replace(/"/g, "")}" />
       <button class="btn primary sm" id="deployGoInline">Deploy</button></div><div class="md" id="deployInlineOut" style="display:none"></div>`,
      "[deploy]");
    const go = () => {
      const sub = (document.getElementById("deploySubInline") || {}).value || "";
      const out = document.getElementById("deployInlineOut");
      if (out) out.style.display = "";
      window.PuterDeploy.deploy(sub, null, out);
    };
    body.querySelector("#deployGoInline").onclick = go;
  }

  window.PuterCommands = { renderPalette, hide, handle, pick, COMMANDS, runPlan,
    move: (d) => { const m = matches() || []; activeIdx = (activeIdx + d + m.length) % Math.max(1, m.length); renderPalette(); },
    enter: () => { const m = matches() || []; if (m[activeIdx]) pick(m[activeIdx].name); } };
})();
