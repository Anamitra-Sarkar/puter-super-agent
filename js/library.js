/* Model library: family cards with Low/High reasoning + Fast routing. */
(function () {
  let vendor = "All";

  function el(id) { return document.getElementById(id); }
  function sel() { return el("modelSelect"); }
  function state() { return window.PuterModels.famState(); }

  function ensureOption(id) {
    const s = sel();
    if (!s) return;
    if (![...s.querySelectorAll("option")].some((o) => o.value === id)) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = `${id}  ${window.PuterModels.costOf(id)}`;
      s.appendChild(o);
    }
    s.value = id;
  }
  function pillLabel(st) {
    const f = window.PuterModels.FAMILIES.find((x) => x.id === st.fid);
    if (!f) return st.fid;
    let label = f.name;
    if (!f.single) label += st.reasoning === "high" ? " · High" : " · Low";
    if (st.fast && (f.fastLow || f.fastHigh)) label += " · Fast";
    return label;
  }
  function current() {
    const st = state();
    return window.PuterModels.resolveFamily(st.fid, st.reasoning, st.fast);
  }
  function applyCombo(fid, reasoning, fast) {
    const st = { fid, reasoning: reasoning || "low", fast: !!fast };
    const id = window.PuterModels.resolveFamily(st.fid, st.reasoning, st.fast);
    ensureOption(id);
    window.PuterModels.setFamState(st);
    const pill = el("modelPillLabel");
    if (pill) pill.textContent = pillLabel(st);
    render();
  }
  function restore(s) {
    const st = state();
    const id = window.PuterModels.resolveFamily(st.fid, st.reasoning, st.fast);
    if (s) {
      if (![...s.querySelectorAll("option")].some((o) => o.value === id)) {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = `${id}  ${window.PuterModels.costOf(id)}`;
        s.appendChild(o);
      }
      s.value = id;
    } else ensureOption(id);
    const pill = el("modelPillLabel");
    if (pill) pill.textContent = pillLabel(st);
  }
  // Back-compat: old callers pass a raw model id.
  function apply(id) {
    const f = window.PuterModels.familyOf(id);
    if (f) {
      const st = { fid: f.id, reasoning: (f.high === id || f.fastHigh === id) ? "high" : "low", fast: !!(f.fastLow === id || f.fastHigh === id) };
      applyCombo(st.fid, st.reasoning, st.fast);
    } else {
      ensureOption(id);
      const pill = el("modelPillLabel");
      if (pill) pill.textContent = `${id} ${window.PuterModels.costOf(id)}`;
      render();
    }
  }
  function render() {
    const grid = el("libraryGrid");
    if (!grid) return;
    const q = (el("librarySearch").value || "").toLowerCase();
    const st = state();
    grid.innerHTML = "";
    for (const f of window.PuterModels.FAMILIES) {
      if (vendor !== "All" && f.vendor !== vendor) continue;
      if (q && !((f.name + " " + f.desc + " " + f.vendor).toLowerCase().includes(q))) continue;
      const selFid = st.fid === f.id;
      const d = document.createElement("div");
      d.className = "lib-card fam" + (selFid ? " selected" : "");
      const resId = window.PuterModels.resolveFamily(f.id, selFid ? st.reasoning : "low", selFid ? st.fast : false);
      d.innerHTML = `<div class="lib-top"><span class="lib-name">${f.name}</span>${selFid ? '<span class="lib-check">✓</span>' : ""}</div>
        <div class="lib-sub"><span class="lib-vendor ${f.vendor === "OpenAI" ? "v-openai" : "v-claude"}">${f.vendor}</span>
        <span class="lib-cost">${window.PuterModels.costOf(resId)}</span></div>
        <div class="lib-desc">${f.desc}</div>
        <div class="lib-route muted small">→ ${resId}</div>`;
      if (!f.single) {
        const seg = document.createElement("div");
        seg.className = "seg";
        const cur = selFid ? st.reasoning : "low";
        seg.innerHTML = `<button data-r="low" class="${cur === "low" ? "on" : ""}">Low</button><button data-r="high" class="${cur === "high" ? "on" : ""}">High</button>`;
        seg.querySelectorAll("button").forEach((b) => (b.onclick = (e) => {
          e.stopPropagation();
          applyCombo(f.id, b.dataset.r, selFid ? st.fast : false);
          ok(f.name + " · " + (b.dataset.r === "high" ? "High" : "Low"));
        }));
        d.appendChild(seg);
      }
      if (f.fastLow || f.fastHigh) {
        const ft = document.createElement("button");
        ft.className = "fast-toggle" + (selFid && st.fast ? " on" : "");
        ft.textContent = selFid && st.fast ? "⚡ Fast on" : "Fast";
        ft.onclick = (e) => {
          e.stopPropagation();
          applyCombo(f.id, selFid ? st.reasoning : "low", !(selFid && st.fast));
          ok(f.name + " fast " + (!(selFid && st.fast) ? "on" : "off"));
        };
        d.appendChild(ft);
      }
      d.onclick = () => {
        applyCombo(f.id, selFid ? st.reasoning : "low", selFid ? st.fast : false);
        close();
        ok(f.name + " selected");
      };
      grid.appendChild(d);
    }
    if (!grid.children.length) grid.innerHTML = '<div class="muted" style="padding:16px">No models match.</div>';
  }
  function ok(m) { if (window.PuterUI) window.PuterUI.toast(m, "ok"); }
  function open() {
    el("libraryOverlay").classList.remove("hidden");
    el("librarySearch").value = "";
    render();
    setTimeout(() => el("librarySearch").focus(), 50);
  }
  function close() { el("libraryOverlay").classList.add("hidden"); }

  window.PuterLibrary = { open, close, render, apply, applyCombo, restore, current, setVendor: (v) => { vendor = v; render(); } };
})();
