/* Beautiful model library overlay: search + vendor filter + cards. */
(function () {
  const KEY = "spa_model";
  let vendor = "All";

  function el(id) { return document.getElementById(id); }
  function current() {
    const sel = el("modelSelect");
    return (sel && sel.value) || localStorage.getItem(KEY) || window.PuterModels.DEFAULT_MODEL;
  }
  function apply(id) {
    const sel = el("modelSelect");
    if (sel) sel.value = id;
    try { localStorage.setItem(KEY, id); } catch {}
    const pill = el("modelPillLabel");
    if (pill) pill.textContent = `${id} ${window.PuterModels.costOf(id)}`;
    render();
  }
  function restore(sel) {
    let want = null;
    try { want = localStorage.getItem(KEY); } catch {}
    const valid = [...sel.querySelectorAll("option")].some((o) => o.value === want);
    sel.value = (valid && want) || window.PuterModels.DEFAULT_MODEL;
    const pill = el("modelPillLabel");
    if (pill) pill.textContent = `${sel.value} ${window.PuterModels.costOf(sel.value)}`;
  }
  function allModels() {
    const out = [];
    for (const g of window.PuterModels.optionGroups()) {
      for (const id of g.ids) {
        const m = window.PuterModels.describe(id);
        out.push({ id, vendor: m.vendor, desc: m.desc, cost: window.PuterModels.costOf(id) });
      }
    }
    return out;
  }
  function render() {
    const grid = el("libraryGrid");
    if (!grid) return;
    const q = (el("librarySearch").value || "").toLowerCase();
    const sel = current();
    grid.innerHTML = "";
    for (const m of allModels()) {
      if (vendor !== "All" && m.vendor !== vendor) continue;
      if (q && !(m.id.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q))) continue;
      const d = document.createElement("button");
      d.className = "lib-card" + (m.id === sel ? " selected" : "");
      d.innerHTML = `<div class="lib-top"><span class="lib-name">${m.id}</span>${m.id === sel ? '<span class="lib-check">✓</span>' : ""}</div>
        <div class="lib-sub"><span class="lib-vendor ${m.vendor === "OpenAI" ? "v-openai" : "v-claude"}">${m.vendor}</span>
        <span class="lib-cost">${m.cost}</span></div>
        <div class="lib-desc">${m.desc}</div>`;
      d.onclick = () => {
        apply(m.id);
        close();
        if (window.PuterUI) window.PuterUI.toast("Model: " + m.id, "ok");
      };
      grid.appendChild(d);
    }
    if (!grid.children.length) grid.innerHTML = '<div class="muted" style="padding:16px">No models match.</div>';
  }
  function open() {
    el("libraryOverlay").classList.remove("hidden");
    el("librarySearch").value = "";
    render();
    setTimeout(() => el("librarySearch").focus(), 50);
  }
  function close() { el("libraryOverlay").classList.add("hidden"); }

  window.PuterLibrary = { open, close, render, apply, restore, current, setVendor: (v) => { vendor = v; render(); } };
})();
