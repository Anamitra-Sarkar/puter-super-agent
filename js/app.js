/* App wiring: model select, tabs, composer, auth, buttons. */
(function () {
  function el(id) { return document.getElementById(id); }

  function fillModels(extra) {
    const sel = el("modelSelect");
    sel.innerHTML = "";
    for (const g of window.PuterModels.optionGroups()) {
      const og = document.createElement("optgroup");
      og.label = g.label;
      for (const id of g.ids) {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = id;
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
    sel.value = "gpt-5.6-luna";
    updMeta();
    const agg = el("aggregatorModel");
    agg.innerHTML = "";
    for (const id of ["gpt-5.6-luna", "gpt-5.6-sol", "claude-sonnet-5", "claude-haiku-4-5"]) {
      const o = document.createElement("option"); o.value = id; o.textContent = id; agg.appendChild(o);
    }
  }
  function updMeta() {
    const m = window.PuterModels.describe(el("modelSelect").value);
    el("modelMeta").textContent = `${m.vendor} · ${m.desc}`;
  }

  async function refreshAuth() {
    const box = el("authBox");
    try {
      const signed = await puter.auth.isSignedIn();
      if (signed) {
        const u = await puter.auth.getUser();
        box.textContent = `Signed in as ${u.username || u.uuid || "user"} (User-Pays active)`;
      } else box.textContent = "Not signed in — first AI call will prompt sign-in (User-Pays).";
    } catch { box.textContent = "Auth unknown — calls will prompt if needed."; }
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
    el("btnSignIn").onclick = async () => { try { await puter.auth.signIn(); } catch {} refreshAuth(); };
    el("btnSignOut").onclick = async () => { try { await puter.auth.signOut(); } catch {} refreshAuth(); };
    el("btnRefreshModels").onclick = async () => {
      el("btnRefreshModels").textContent = "loading…";
      const ids = await window.PuterModels.liveModelIds();
      fillModels(ids);
      el("btnRefreshModels").textContent = `↻ live list${ids.length ? " (" + ids.length + ")" : ""}`;
    };
    el("btnNewChat").onclick = () => window.PuterSessions.newSession();
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
    window.PuterAgent.timeline("Ready. Pick a model and send — or try Swarm. Sign-in happens on first AI call.");
  });
})();
