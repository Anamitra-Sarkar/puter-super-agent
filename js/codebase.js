/* Virtual codebase store: files the agent builds + user uploads. Rendered in dock Code tab. */
(function () {
  const KEY = "spa_codebase_v1";
  let files = {}; // name -> {content, updated}
  let active = null;

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (raw && typeof raw === "object") files = raw;
    } catch {}
    const names = Object.keys(files);
    if (!active && names.length) active = names[0];
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(files).slice(0, 400000)); } catch {}
  }
  function put(name, content) {
    name = String(name || "untitled.txt").replace(/^\.\//, "").slice(0, 120);
    files[name] = { content: String(content || ""), updated: Date.now() };
    active = name;
    save();
    render();
  }
  function get(name) { return files[name || active]; }
  function names() { return Object.keys(files).sort(); }
  function remove(name) {
    delete files[name];
    if (active === name) active = names()[0] || null;
    save(); render();
  }
  function clear() { files = {}; active = null; save(); render(); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function render() {
    const tree = document.getElementById("codeTree");
    const view = document.getElementById("codeView");
    if (!tree || !view) return;
    const list = names();
    tree.innerHTML = "";
    if (!list.length) {
      tree.innerHTML = '<div class="muted small" style="padding:8px">No files yet — ask the AI to build, or upload with +</div>';
      view.innerHTML = "";
      return;
    }
    for (const n of list) {
      const b = document.createElement("button");
      b.className = "code-file" + (n === active ? " active" : "");
      b.innerHTML = `<span>📄 ${esc(n)}</span><span class="code-del" data-f="${esc(n)}" title="delete">✕</span>`;
      b.onclick = (e) => {
        const del = e.target.closest(".code-del");
        if (del) { remove(del.dataset.f); return; }
        active = n; render();
      };
      tree.appendChild(b);
    }
    const f = files[active];
    if (!f) { view.innerHTML = ""; return; }
    view.innerHTML = "";
    const bar = document.createElement("div");
    bar.className = "code-bar";
    const lines = f.content.split("\n").length;
    bar.innerHTML = `<b>${esc(active)}</b><span class="muted small">${lines} lines · ~${window.PuterTokens.fmt(window.PuterTokens.est(f.content))} tok</span><span class="spacer"></span>`;
    const cp = document.createElement("button");
    cp.className = "btn sm ghost"; cp.textContent = "Copy";
    cp.onclick = () => { navigator.clipboard.writeText(f.content).then(() => window.PuterUI.toast("Copied " + active, "ok")); };
    const dl = document.createElement("button");
    dl.className = "btn sm ghost"; dl.textContent = "Download";
    dl.onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([f.content], { type: "text/plain" }));
      a.download = active.split("/").pop();
      a.click();
    };
    const sv = document.createElement("button");
    sv.className = "btn sm"; sv.textContent = "Save";
    bar.append(cp, dl, sv);
    const ta = document.createElement("textarea");
    ta.className = "code-editor";
    ta.value = f.content;
    ta.spellcheck = false;
    sv.onclick = () => { put(active, ta.value); window.PuterUI.toast("Saved " + active, "ok"); };
    view.append(bar, ta);
  }
  load();
  window.PuterCodebase = { put, get, names, remove, clear, render, getActive: () => active };
})();
