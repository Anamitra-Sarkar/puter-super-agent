/* Virtual codebase store: files the agent builds + user uploads. Rendered in dock Code tab. */
(function () {
  const KEY = "spa_codebase_v1";
  let files = {}; // name -> {content, updated}
  let revs = {}; // name -> [previous contents, newest-first], cap 5 — protects against truncated overwrites
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
    const next = String(content || "");
    if (files[name] && files[name].content !== next) {
      (revs[name] = revs[name] || []).unshift({ content: files[name].content, at: files[name].updated || Date.now() });
      revs[name] = revs[name].slice(0, 5);
      // Never replace a fuller file with a suspiciously truncated one silently:
      if (next.length < files[name].content.length * 0.5) {
        (revs[name]).unshift({ content: next, at: Date.now(), flagged: true });
        // keep the fuller version live, stash the short one for inspection
        save(); render();
        if (window.PuterUI) window.PuterUI.toast(`Kept fuller ${name} — short update stashed in history`, "info");
        return;
      }
    }
    files[name] = { content: next, updated: Date.now() };
    active = name;
    save(); render();
  }
  function undo(name) {
    name = name || active;
    const stack = revs[name];
    if (!name || !stack || !stack.length) {
      if (window.PuterUI) window.PuterUI.toast("No earlier revision", "info");
      return;
    }
    const prev = stack.shift();
    files[name] = { content: prev.content, updated: Date.now() };
    active = name;
    save(); render();
    if (window.PuterUI) window.PuterUI.toast(`Restored previous ${name}${prev.flagged ? " (was a truncated update)" : ""}`, "ok");
  }
  function get(name) { return files[name || active]; }
  function names() { return Object.keys(files).sort(); }
  function remove(name) {
    delete files[name];
    if (active === name) active = names()[0] || null;
    save(); render();
  }
  function setActive(name) {
    if (files[name]) { active = name; render(); }
  }
  function clear() { files = {}; active = null; save(); render(); }
  function askedInline(userText) {
    return /(show|print|display|write|paste|give|transcribe|extract|copy|type|list).{0,30}(code|here|inline|in (the )?chat|full|all|command)/i.test(userText || "");
  }
  function guessName(lang, hint, taken) {
    if (hint) return hint.trim().slice(0, 80);
    const base = { html: "index.html", css: "styles.css", javascript: "script.js", js: "script.js", python: "main.py", py: "main.py", bash: "run.sh", sh: "run.sh", shell: "run.sh", json: "data.json", markdown: "notes.md", md: "notes.md", sql: "query.sql", yaml: "config.yaml", yml: "config.yaml" }[(lang || "").toLowerCase()] || "snippet.txt";
    if (!taken.has(base) && !files[base]) return base;
    let i = 2;
    while (taken.has(base.replace(/(\.\w+)?$/, `-${i}$1`)) || files[base.replace(/(\.\w+)?$/, `-${i}$1`)]) i++;
    return base.replace(/(\.\w+)?$/, `-${i}$1`);
  }
  /** Move long fenced code/command blocks out of chat into codebase files + cards.
   *  Returns {text, files}. Short snippets and explicit asks stay inline. */
  function extractCode(fullText, userText) {
    if (!fullText || askedInline(userText)) return { text: fullText, files: [] };
    const taken = new Set();
    const saved = [];
    const out = String(fullText).replace(/```(\w*)(?::([^\n`]*))?\n([\s\S]*?)```/g, (m, lang, hint, code) => {
      const lines = code.replace(/\n$/, "").split("\n").length;
      if (lines <= 6) return m; // short snippets stay inline
      const name = guessName(lang, hint, taken);
      taken.add(name);
      put(name, code.replace(/\n$/, "") + "\n");
      saved.push(name);
      const isCmd = /^(bash|sh|shell)$/i.test(lang || "");
      return `\n<div class="file-card"><span>${isCmd ? "⌨️" : "📄"} <b>${esc(name)}</b> · ${lines} lines</span><span class="muted small">saved to Code tab</span><button class="btn sm" data-open-code="${esc(name)}">Open</button></div>\n`;
    });
    return { text: out, files: saved };
  }
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
    const un = document.createElement("button");
    un.className = "btn sm ghost"; un.textContent = "↩ Undo";
    un.title = "Restore previous revision (protects against truncated overwrites)";
    bar.append(cp, dl, sv, un);
    const ta = document.createElement("textarea");
    ta.className = "code-editor";
    ta.value = f.content;
    ta.spellcheck = false;
    sv.onclick = () => { put(active, ta.value); window.PuterUI.toast("Saved " + active, "ok"); };
    un.onclick = () => undo();
    view.append(bar, ta);
  }
  load();
  window.PuterCodebase = { put, get, names, remove, clear, render, setActive, undo, extractCode, getActive: () => active };
})();
