/* Skills manager: built-in presets + user-created editable skills (localStorage). */
(function () {
  const KEY = "spa_skills_v1";
  const SEL_KEY = "spa_skill_sel";
  const BUILTINS = {
    coder: { name: "Coder", builtin: true, prompt: "You are an expert coding assistant running a strict build loop: BUILD (full runnable code via run_code_preview with a path) → VERIFY (you automatically receive a verify report: console errors, responsive overflow at 375/768/1440px, click-sweep errors, security scan, vision design review) → FIX every ❌ by re-calling run_code_preview → repeat until all ✅ → final summary of what was built and verified. Never declare done with failing checks. Design taste (non-negotiable, never hardcode a look — design each UI fresh but AVOID: purple/blue linear gradients, neon glows, glassy AI-slop cards, robot emojis, lorem ipsum, tiny gray-on-gray text, cramped spacing, default unstyled buttons; PREFER: warm paper/cream or clean white, ONE confident accent, generous whitespace, clear hierarchy, real copy, 4.5:1+ contrast, responsive everywhere)." },
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
    try { return localStorage.getItem(SEL_KEY) || ""; } catch { return ""; }
  }
  function select(id) {
    try { localStorage.setItem(SEL_KEY, id || ""); } catch {}
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
    if (selected() === id) select("");
    save(); renderList(); renderSelect();
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function renderSelect() {
    const sel = document.getElementById("skillSelect");
    if (!sel) return;
    const cur = selected();
    sel.innerHTML = '<option value="">General assistant</option>';
    for (const [id, s] of Object.entries(all())) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = s.name + (s.builtin ? "" : " (custom)");
      sel.appendChild(o);
    }
    sel.value = cur;
  }
  function renderList() {
    const box = document.getElementById("skillList");
    if (!box) return;
    box.innerHTML = "";
    const cur = selected();
    for (const [id, s] of Object.entries(all())) {
      const d = document.createElement("div");
      d.className = "skill-row" + (cur === id ? " active" : "");
      d.innerHTML = `<div><b>${esc(s.name)}</b> <span class="muted small">${s.builtin ? "built-in" : "custom"}</span>
        <div class="muted small">${esc(s.prompt.slice(0, 90))}${s.prompt.length > 90 ? "…" : ""}</div></div>
        <span class="spacer"></span>`;
      const use = document.createElement("button");
      use.className = "btn sm" + (cur === id ? " primary" : "");
      use.textContent = cur === id ? "✓ Active" : "Use";
      use.onclick = () => { select(cur === id ? "" : id); renderSelect(); toast(); };
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
    function toast() {
      if (window.PuterUI) window.PuterUI.toast(cur === selected() ? "Skill deactivated" : "Skill activated", "info");
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
