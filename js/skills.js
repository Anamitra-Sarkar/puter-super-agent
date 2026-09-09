/* Skills manager: built-in presets + user-created editable skills (localStorage). */
(function () {
  const KEY = "spa_skills_v1";
  const SEL_KEY = "spa_skill_sel";
  const BUILTINS = {
    coder: { name: "Coder", builtin: true, prompt: "You are an expert coding assistant running a strict build loop: PLAN first (use ask_user for open decisions) → BUILD multi-file apps with save_code_files (index.html + styles.css + app.js at minimum for anything non-trivial; one mono file ONLY for tiny snippets) → VERIFY (you automatically receive a verify report: console errors, responsive overflow at 375/768/1440px, click-sweep errors, security scan, vision design review) → FIX every ❌ by saving complete files again → repeat until all ✅ → final summary of what was built and verified. Every file you send must be COMPLETE — never partial, never truncated. If output was cut, say CONTINUE and finish before previewing. Design taste: fresh design every time, but AVOID purple/blue gradients, neon glows, glassy AI-slop cards, robot emojis, lorem ipsum, gray-on-gray text, cramped spacing; PREFER warm paper/cream or clean white, ONE confident accent, whitespace, hierarchy, real copy, 4.5:1+ contrast. For complex or lengthy builds, ORCHESTRATE SUBAGENTS: split the work and call spawn_subagent (researcher/coder/critic/tester/designer — they cannot spawn further) for parallelizable parts, or spawn_swarm for hard decisions; then YOU integrate, verify, and deliver. Always define the exact goal first, then goal-check at the end: re-read the original task requirement by requirement and confirm each is met before reporting done. Check security, privacy and bugs against the goal; improvise when stuck — never stall. There are no tool-step limits, but every call spends the user's allowance, so work efficiently." },
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
  function slug(s) {
    return String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  }
  function renderList() {
    const box = document.getElementById("skillList");
    if (!box) return;
    box.innerHTML = "";
    const cur = new Set(selected());
    const head = document.createElement("div");
    head.className = "muted small";
    head.style.margin = "0 0 6px";
    box.appendChild(head);
    const paintHead = () => {
      const n = selected().length;
      head.textContent = n ? `${n} active — all are injected together. Tap a row's switch to toggle.` : "None active (general assistant). Toggle several at once, or add your own below.";
    };
    paintHead();
    const newBtn = document.createElement("button");
    newBtn.className = "btn sm";
    newBtn.textContent = "＋ New skill";
    newBtn.onclick = () => openEditor(box, null, paintHead);
    box.appendChild(newBtn);
    for (const [id, s] of Object.entries(all())) {
      const on = cur.has(id);
      const d = document.createElement("div");
      d.className = "skill-row" + (on ? " active" : "");
      d.innerHTML = `<button class="skill-switch" title="Toggle">${on ? "✓" : ""}</button>
        <div><b>${esc(s.name)}</b> <span class="muted small">${s.builtin ? "built-in" : "custom · " + esc(id)}</span>
        <div class="muted small">${esc(s.prompt.slice(0, 90))}${s.prompt.length > 90 ? "…" : ""}</div></div>
        <span class="spacer"></span>`;
      d.querySelector(".skill-switch").onclick = () => { select(id); renderSelect(); note(); };
      if (s.builtin) {
        const dup = document.createElement("button");
        dup.className = "btn sm ghost"; dup.textContent = "⧉ Copy";
        dup.title = "Duplicate as an editable custom skill";
        dup.onclick = () => openEditor(box, { id: "", name: s.name + " (mine)", prompt: s.prompt }, paintHead);
        d.appendChild(dup);
      } else {
        const ed = document.createElement("button");
        ed.className = "btn sm ghost"; ed.textContent = "Edit";
        ed.onclick = () => openEditor(box, { id, name: s.name, prompt: s.prompt }, paintHead);
        const del = document.createElement("button");
        del.className = "btn sm ghost"; del.textContent = "✕";
        del.onclick = async () => {
          if (await window.PuterUI.confirmModal("Delete skill?", `"${s.name}" will be removed from this browser.`, "Delete")) remove(id);
        };
        d.append(ed, del);
      }
      box.appendChild(d);
    }
    function note() {
      if (window.PuterUI) window.PuterUI.toast("Skills updated (" + selected().length + " active)", "info");
    }
  }
  /** Inline editor card (new or editing). Validates live; Save/Cancel inline. */
  function openEditor(box, existing, repaint) {
    if (box.querySelector(".skill-editor")) return;
    const ed = document.createElement("div");
    ed.className = "skill-editor";
    ed.innerHTML = `
      <label class="side-label">Name</label>
      <input class="se-name" placeholder="e.g. SQL Expert" />
      <label class="side-label" style="margin-top:6px">System prompt <span class="se-count muted small"></span></label>
      <textarea class="se-prompt" rows="4" placeholder="You are an expert that… (this text steers every AI reply while active)"></textarea>
      <div class="se-err muted small" style="color:var(--err)"></div>
      <div class="row"><button class="btn primary sm se-save">Save skill</button><button class="btn ghost sm se-cancel">Cancel</button></div>`;
    const nameEl = ed.querySelector(".se-name");
    const prEl = ed.querySelector(".se-prompt");
    const errEl = ed.querySelector(".se-err");
    const cntEl = ed.querySelector(".se-count");
    if (existing) { nameEl.value = existing.name || ""; prEl.value = existing.prompt || ""; ed.dataset.editId = existing.id || ""; }
    const validate = () => {
      const id = ed.dataset.editId || slug(nameEl.value);
      cntEl.textContent = `${prEl.value.length}/4000`;
      if (!nameEl.value.trim()) { errEl.textContent = "Give the skill a name."; return null; }
      if (!prEl.value.trim()) { errEl.textContent = "The prompt is empty — the AI would learn nothing."; return null; }
      if (!ed.dataset.editId && (BUILTINS[id] || custom[id])) { errEl.textContent = `id "${id}" is taken — rename slightly.`; return null; }
      errEl.textContent = `id: ${id}`;
      errEl.style.color = "var(--muted)";
      return { id: ed.dataset.editId || id, name: nameEl.value.trim().slice(0, 60), prompt: prEl.value.trim().slice(0, 4000) };
    };
    nameEl.oninput = validate; prEl.oninput = validate;
    validate();
    ed.querySelector(".se-cancel").onclick = () => ed.remove();
    ed.querySelector(".se-save").onclick = () => {
      const v = validate();
      if (!v) return;
      custom[v.id] = { name: v.name, prompt: v.prompt };
      save(); renderList(); renderSelect();
      if (repaint) repaint();
      window.PuterUI.toast(`Skill "${v.name}" saved`, "ok");
    };
    box.insertBefore(ed, box.children[1] || null);
    nameEl.focus();
  }
  load();
  window.PuterSkills = { all, get, selected, select, setSelected, upsert, remove, renderList, renderSelect };
})();
