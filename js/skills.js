/* Skills manager: built-in presets + user-created editable skills (localStorage). */
(function () {
  const KEY = "spa_skills_v1";
  const SEL_KEY = "spa_skill_sel";
  const BUILTINS = {
    coder: { name: "Coder", builtin: true, prompt: "You are an expert coding assistant running a strict build loop: PLAN first (use ask_user for open decisions) → BUILD multi-file apps with save_code_files (index.html + styles.css + app.js at minimum for anything non-trivial; one mono file ONLY for tiny snippets) → VERIFY (you automatically receive a verify report: console errors, responsive overflow at 375/768/1440px, click-sweep errors, security scan, vision design review) → FIX every ❌ by saving complete files again → repeat until all ✅ → final summary of what was built and verified. Every file you send must be COMPLETE — never partial, never truncated. If output was cut, say CONTINUE and finish before previewing. Design taste: fresh design every time, but AVOID purple/blue gradients, neon glows, glassy AI-slop cards, robot emojis, lorem ipsum, gray-on-gray text, cramped spacing; PREFER warm paper/cream or clean white, ONE confident accent, whitespace, hierarchy, real copy, 4.5:1+ contrast." },
    researcher: { name: "Researcher", builtin: true, prompt: "You are a research assistant. Prefer fresh info: use web_search results and web_fetch for sources, cite URLs." },
    writer: { name: "Writer", builtin: true, prompt: "You are a professional writer. Clear, structured, engaging prose with headings." },
    reviewer: { name: "Critic", builtin: true, prompt: "You are a strict code reviewer. Find bugs, edge cases, and suggest concrete fixes." },
  };
  let custom = {};

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (raw && typeof raw === "object") custom = raw;
    } catch {}
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(custom).slice(0, 60000)); } catch {}
  }
  function all() { return { ...BUILTINS, ...custom }; }
  function get(id) { return all()[id] || null; }
  function selected() {
    // Multi-select: stored as JSON array; migrates legacy single string.
    try {
      const raw = localStorage.getItem(SEL_KEY);
      if (!raw) return [];
      if (raw.startsWith("[")) {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.filter((id) => all()[id]) : [];
      }
      return all()[raw] ? [raw] : [];
    } catch { return []; }
  }
  function select(id) {
    // Toggle one skill in the multi-set.
    const cur = new Set(selected());
    if (!id) { try { localStorage.setItem(SEL_KEY, "[]"); } catch {} renderList(); return; }
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    try { localStorage.setItem(SEL_KEY, JSON.stringify([...cur])); } catch {}
    renderList();
  }
  function setSelected(ids) {
    const valid = (Array.isArray(ids) ? ids : []).filter((id) => all()[id]);
    try { localStorage.setItem(SEL_KEY, JSON.stringify(valid)); } catch {}
    renderList();
  }
  function upsert(id, name, prompt) {
    id = String(id || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
    if (!id || BUILTINS[id]) return null;
    custom[id] = { name: String(name || id).slice(0, 60), prompt: String(prompt || "").slice(0, 4000) };
    save(); renderList(); renderSelect();
    return id;
  }
  function remove(id) {
    if (BUILTINS[id]) return;
    delete custom[id];
    setSelected(selected().filter((x) => x !== id));
    save(); renderList(); renderSelect();
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function renderSelect() {
    // No-op (multi-select lives in the skill list below). Kept for compat.
  }
  function renderList() {
    const box = document.getElementById("skillList");
    if (!box) return;
    box.innerHTML = "";
    const cur = new Set(selected());
    const head = document.createElement("div");
    head.className = "muted small";
    head.style.margin = "0 0 6px";
    head.textContent = cur.size ? `${cur.size} active — all are injected together` : "None active (general assistant). Toggle several at once.";
    box.appendChild(head);
    for (const [id, s] of Object.entries(all())) {
      const on = cur.has(id);
      const d = document.createElement("div");
      d.className = "skill-row" + (on ? " active" : "");
      d.innerHTML = `<div><b>${esc(s.name)}</b> <span class="muted small">${s.builtin ? "built-in" : "custom"}</span>
        <div class="muted small">${esc(s.prompt.slice(0, 90))}${s.prompt.length > 90 ? "…" : ""}</div></div>
        <span class="spacer"></span>`;
      const use = document.createElement("button");
      use.className = "btn sm" + (on ? " primary" : "");
      use.textContent = on ? "✓ On" : "Off";
      use.title = "Toggle (multiple can be on)";
      use.onclick = () => { select(id); renderSelect(); note(); };
      d.appendChild(use);
      if (!s.builtin) {
        const ed = document.createElement("button");
        ed.className = "btn sm ghost"; ed.textContent = "Edit";
        ed.onclick = () => {
          document.getElementById("skillId").value = id;
          document.getElementById("skillName").value = s.name;
          document.getElementById("skillPrompt").value = s.prompt;
        };
        const del = document.createElement("button");
        del.className = "btn sm ghost"; del.textContent = "✕";
        del.onclick = () => { remove(id); };
        d.append(ed, del);
      }
      box.appendChild(d);
    }
    function note() {
      if (window.PuterUI) window.PuterUI.toast("Skills updated (" + selected().length + " active)", "info");
    }
  }
  function saveFromInputs() {
    const idEl = document.getElementById("skillId");
    const nEl = document.getElementById("skillName");
    const pEl = document.getElementById("skillPrompt");
    const id = upsert(idEl.value, nEl.value, pEl.value);
    if (!id) { window.PuterUI.toast("Need a unique id (lowercase, not a built-in name)", "err"); return; }
    idEl.value = ""; nEl.value = ""; pEl.value = "";
    window.PuterUI.toast("Skill saved", "ok");
  }
  load();
  window.PuterSkills = { all, get, selected, select, upsert, remove, renderList, renderSelect, saveFromInputs };
})();
