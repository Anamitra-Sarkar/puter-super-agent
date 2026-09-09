/* Notes vault: save answers to Puter KV + local mirror. Search, export, delete. */
(function () {
  const LS = "spa_notes_v1";
  function all() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  }
  function persist(list) {
    try { localStorage.setItem(LS, JSON.stringify(list).slice(0, 400000)); } catch {}
  }
  async function save(title, text) {
    const note = { id: "n" + Date.now().toString(36), title: String(title || "Note").slice(0, 80), text: String(text || "").slice(0, 20000), at: Date.now() };
    const list = [note, ...all()].slice(0, 100);
    persist(list);
    try { await puter.kv.set("note_" + note.id, { title: note.title, text: note.text, at: note.at }); } catch {}
    if (window.PuterUI) window.PuterUI.toast("Saved to Notes", "ok");
    render();
    return note;
  }
  async function remove(id) {
    persist(all().filter((n) => n.id !== id));
    try { await puter.kv.del("note_" + id); } catch {}
    render();
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function render(filter) {
    const box = document.getElementById("notesList");
    if (!box) return;
    box.innerHTML = "";
    const q = (filter || "").toLowerCase();
    const list = all().filter((n) => !q || (n.title + " " + n.text).toLowerCase().includes(q));
    if (!list.length) { box.innerHTML = '<div class="muted small" style="padding:6px">No notes yet — use 📝 under any answer.</div>'; return; }
    for (const n of list.slice(0, 30)) {
      const d = document.createElement("div");
      d.className = "note-row";
      d.innerHTML = `<div><b>${esc(n.title)}</b><div class="muted small">${esc(n.text.slice(0, 80))}…</div></div><span class="spacer"></span>`;
      const open = document.createElement("button");
      open.className = "btn sm ghost"; open.textContent = "Open";
      open.onclick = () => {
        window.PuterAgent.addMsg("assistant", `<b>📝 ${esc(n.title)}</b>` + window.PuterAgent.md(n.text), n.text.slice(0, 3000));
      };
      const exp = document.createElement("button");
      exp.className = "btn sm ghost"; exp.textContent = "↓";
      exp.title = "Download .md";
      exp.onclick = () => window.PuterFilegen.makeFile(n.title.replace(/[^\w\- ]+/g, "") + ".md", `# ${n.title}\n\n${n.text}`);
      const del = document.createElement("button");
      del.className = "btn sm ghost"; del.textContent = "✕";
      del.onclick = () => remove(n.id);
      d.append(open, exp, del);
      box.appendChild(d);
    }
  }
  window.PuterNotes = { save, remove, render, all };
})();
