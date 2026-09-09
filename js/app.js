/* App wiring: model select, tabs, composer, auth, buttons. */
(function () {
  function el(id) { return document.getElementById(id); }

  function fillModels(extra) {
    const sel = el("modelSelect");
    const keep = sel.value;
    sel.innerHTML = "";
    for (const g of window.PuterModels.optionGroups()) {
      const og = document.createElement("optgroup");
      og.label = g.label;
      for (const id of g.ids) {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = `${id}  ${window.PuterModels.costOf(id)}`;
        og.appendChild(o);
      }
      sel.appendChild(og);
    }
    if (extra && extra.length) {
      const og = document.createElement("optgroup");
      og.label = "Live (Puter)";
      for (const id of extra.slice(0, 60)) {
        if ([...sel.querySelectorAll("option")].some((o) => o.value === id)) continue;
        const o = document.createElement("option");
        o.value = id; o.textContent = id;
        og.appendChild(o);
      }
      if (og.children.length) sel.appendChild(og);
    }
    sel.value = ([...sel.querySelectorAll("option")].some((o) => o.value === keep) && keep)
      || window.PuterModels.DEFAULT_MODEL;
    updMeta();
    const agg = el("aggregatorModel");
    agg.innerHTML = "";
    for (const id of ["gpt-5.6-luna", "gpt-5.6-sol", "claude-sonnet-5", "claude-haiku-4-5"]) {
      const o = document.createElement("option"); o.value = id; o.textContent = id; agg.appendChild(o);
    }
  }
  function updMeta() {
    const id = el("modelSelect").value;
    const m = window.PuterModels.describe(id);
    const vclass = m.vendor === "OpenAI" ? "vendor-openai" : "vendor-claude";
    el("modelMeta").innerHTML = "";
    const v = document.createElement("span");
    v.className = vclass;
    v.textContent = `${m.vendor} · ${window.PuterModels.costOf(id)}`;
    el("modelMeta").appendChild(v);
    el("modelMeta").appendChild(document.createTextNode(` · ${m.desc}`));
  }

  function setPill(state, text) {
    const p = el("statusPill");
    p.className = "pill" + (state ? " " + state : "");
    p.textContent = text;
  }

  async function refreshAuth() {
    const box = el("authBox");
    setPill("", "checking…");
    try {
      const signed = await puter.auth.isSignedIn();
      if (signed) {
        const u = await puter.auth.getUser();
        box.textContent = `Signed in as ${u.username || u.uuid || "user"} (User-Pays active)`;
        setPill("ok", "● signed in");
      } else {
        box.textContent = "Not signed in — click Sign in (top-right), allow the popup, then chat.";
        setPill("", "○ signed out");
      }
    } catch {
      box.textContent = "Auth unknown — calls will prompt if needed.";
      setPill("err", "auth unknown");
    }
    try {
      const usage = await puter.auth.getMonthlyUsage();
      const parts = [];
      if (usage) {
        for (const [k, v] of Object.entries(usage)) {
          if (v && typeof v === "object" && (v.used !== undefined || v.allowance !== undefined)) {
            parts.push(`${k}: ${v.used ?? "?"}${v.allowance ? " / " + v.allowance : ""}`);
          }
        }
      }
      el("usageBox").textContent = "Usage: " + (parts.length ? parts.slice(0, 4).join(" · ") : JSON.stringify(usage).slice(0, 160));
    } catch {
      el("usageBox").textContent = "Usage: unavailable (sign in to see allowance)";
    }
  }

  async function sendCurrent() {
    const text = el("userInput").value.trim();
    if (!text && !el("fileInput").files.length) return;
    el("userInput").value = "";
    const atts = await window.PuterFiles.readAttachments(el("fileInput").files);
    el("fileInput").value = "";
    const mode = el("agentMode").value;
    if (mode === "compare") { el("swarmPrompt").value = text; switchTab("swarm"); window.PuterSwarm.runCompare(); return; }
    if (mode === "pipeline") { el("swarmPrompt").value = text; switchTab("swarm"); window.PuterSwarm.runPipeline(); return; }
    window.PuterAgent.send(text, atts);
  }

  function switchTab(name) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
  }

  window.addEventListener("DOMContentLoaded", () => {
    fillModels();
    window.PuterSessions.load();
    refreshAuth();
    document.querySelectorAll(".tab").forEach((t) => t.onclick = () => switchTab(t.dataset.tab));
    el("modelSelect").onchange = updMeta;
    el("temperature").oninput = (e) => (el("tempVal").textContent = e.target.value);
    el("btnSend").onclick = sendCurrent;
    el("btnStop").onclick = () => window.PuterAgent.stop();
    el("userInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCurrent(); }
    });
    el("btnSignIn").onclick = async () => {
      window.PuterUI.toast("Opening Puter sign-in — allow the popup", "info");
      try { await puter.auth.signIn(); window.PuterUI.toast("Signed in", "ok"); }
      catch (e) { window.PuterUI.toast("Sign-in blocked or cancelled — allow popups and retry", "err"); }
      refreshAuth();
    };
    el("btnSignOut").onclick = async () => { try { await puter.auth.signOut(); } catch {} refreshAuth(); window.PuterUI.toast("Signed out", "info"); };
    el("btnRefreshModels").onclick = async () => {
      el("btnRefreshModels").textContent = "loading…";
      const ids = await window.PuterModels.liveModelIds();
      fillModels(ids);
      el("btnRefreshModels").textContent = `↻ live list${ids.length ? " (" + ids.length + ")" : ""}`;
    };
    el("btnNewChat").onclick = () => { window.PuterSessions.newSession(); const h = document.getElementById("emptyState"); if (h) h.classList.remove("bye"); window.PuterUI.toast("New chat started", "info"); };
    el("btnExportSession").onclick = () => window.PuterSessions.export();
    el("btnSwarmGo").onclick = () => window.PuterSwarm.runCompare();
    el("btnPipelineGo").onclick = () => window.PuterSwarm.runPipeline();
    el("btnGenImg").onclick = () => window.PuterFiles.doGenImg();
    el("btnVision").onclick = () => window.PuterFiles.doVision();
    el("btnTTS").onclick = () => window.PuterFiles.doTTS();
    el("btnFsList").onclick = () => window.PuterFiles.fsList();
    el("btnFsRead").onclick = () => window.PuterFiles.fsRead();
    el("btnFsWrite").onclick = () => window.PuterFiles.fsWrite();
    el("btnFetch").onclick = () => window.PuterFiles.doFetch(false);
    el("btnSummarize").onclick = () => window.PuterFiles.doFetch(true);
    el("btnDeploy").onclick = () => window.PuterDeploy.deploy();
    el("btnWorkerHealth").onclick = () => window.PuterDeploy.workerHealth();
    el("btnPreviewClear").onclick = () => window.PuterSandbox.clear();
    el("btnPreviewFull").onclick = () => {
      const f = el("previewFrame");
      if (f.requestFullscreen) f.requestFullscreen();
    };
    document.querySelectorAll(".suggest").forEach((b) => b.onclick = () => {
      el("userInput").value = b.dataset.prompt;
      sendCurrent();
    });
    window.PuterAgent.timeline("Ready. Pick a model and send — or try Swarm. Sign-in happens on first AI call.");
  });
})();
