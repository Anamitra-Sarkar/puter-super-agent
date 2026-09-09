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
  function note(role, text) {
    if (!current) return;
    current.turns.push({ role, text: String(text).slice(0, 4000), at: Date.now() });
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
    document.getElementById("timeline").innerHTML = "";
    save(); render();
  }
  function open(id) {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    current = s;
    const log = document.getElementById("chatLog");
    log.innerHTML = "";
    for (const t of s.turns) window.PuterAgent.addMsg(t.role === "user" ? "user" : "assistant", window.PuterAgent.md(t.text), "__skip__");
    // remove the duplicate notes just added
    current.turns = s.turns;
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
    note(role, text) { if (text === "__skip__") return; _note(role, text); },
    newSession, export: exp, load,
  };
})();
