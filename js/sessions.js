/* Sessions: localStorage-backed chat sessions (opencode/codex style: new/fork/export). */
(function () {
  const KEY = "puter-super-agent-sessions-v1";
  let sessions = [];
  let current = null;
  function load() {
    try { sessions = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { sessions = []; }
    if (!sessions.length) { current = mk("Session 1"); sessions.push(current); }
    else current = sessions[0];
    render();
  }
  function mk(name) { return { id: "s" + Date.now().toString(36), name, turns: [], created: Date.now() }; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(sessions.slice(0, 30))); } catch {} }
  function note(role, text, think) {
    if (!current) return;
    current.turns.push({ role, text: String(text).slice(0, 4000), think: think ? String(think).slice(0, 8000) : null, at: Date.now() });
    if (current.turns.length === 2 && role === "assistant") {
      const first = current.turns.find((t) => t.role === "user");
      if (first) current.name = first.text.slice(0, 42);
    }
    save(); render();
  }
  function newSession() {
    current = mk("Session " + (sessions.length + 1));
    sessions.unshift(current);
    document.getElementById("chatLog").innerHTML = "";
    const tl = document.getElementById("timeline");
    if (tl) tl.innerHTML = "";
    const h = document.getElementById("emptyState");
    if (h) h.classList.remove("bye");
    const app = document.getElementById("app");
    if (app) app.classList.add("starting");
    if (window.PuterAgent) window.PuterAgent.clearHistory();
    if (window.PuterMeter) window.PuterMeter.reset();
    save(); render();
  }
  function setPreview(p) {
    if (!current) return;
    if (p && p.html && p.html.length > 100000) p = { file: p.file || null, html: null };
    current.preview = p || null;
    save();
  }
  function thinkHTML(t) {
    if (!t || !t.think) return "";
    return `<div class="think"><button class="think-head">💭 Thought · ~${Math.ceil(t.think.length / 4)} tokens <span class="chev">⌄</span></button><div class="think-body">${t.think.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div></div>`;
  }
  function open(id) {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    current = s;
    const log = document.getElementById("chatLog");
    log.innerHTML = "";
    const hero = document.getElementById("emptyState");
    if (hero && s.turns.length) hero.classList.add("bye");
    const appEl = document.getElementById("app");
    if (appEl) appEl.classList.toggle("starting", !s.turns.length);
    for (const t of s.turns) window.PuterAgent.addMsg(t.role === "user" ? "user" : "assistant", thinkHTML(t) + window.PuterAgent.md(t.text), "__skip__");
    // remove the duplicate notes just added
    current.turns = s.turns;
    if (window.PuterAgent) {
      window.PuterAgent.clearHistory();
      const hist = window.PuterAgent.getHistory();
      for (const t of s.turns.slice(-20)) {
        if (t.role === "user" || t.role === "assistant") hist.push({ role: t.role, content: t.text });
      }
    }
    // Restore the preview the user last saw (immediately visible, like they never left).
    try {
      const pv = s.preview;
      const CB = window.PuterCodebase;
      if (pv && CB) {
        const f = pv.file && CB.get(pv.file);
        const html = (f && f.content) || pv.html;
        if (html) {
          if (pv.file && f) CB.setEntry(pv.file);
          window.PuterSandbox.render(html, pv.file || "preview");
          if (window.PuterDock) window.PuterDock.open("preview");
        }
      }
    } catch {}
    render();
  }
  function render() {
    const box = document.getElementById("sessionList");
    box.innerHTML = "";
    for (const s of sessions.slice(0, 20)) {
      const b = document.createElement("button");
      b.className = "btn small" + (s === current ? " primary" : " ghost");
      b.textContent = (s === current ? "● " : "") + s.name;
      b.onclick = () => open(s.id);
      box.appendChild(b);
    }
  }
  function exp() {
    const blob = new Blob([JSON.stringify(current, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "puter-session.json";
    a.click();
  }
  // guard: addMsg calls note(); skip re-note on restore
  const _note = note;
  window.PuterSessions = {
    note(role, text, think) { if (text === "__skip__") return; _note(role, text, think || null); },
    newSession, export: exp, load, setPreview,
    getTurns() { return current ? current.turns : []; },
  };
})();
