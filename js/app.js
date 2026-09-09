/* App shell: auth gate, library, queue + unified send/stop, meter, effort, dock. */
(function () {
  function el(id) { return document.getElementById(id); }
  function toast(m, k) { if (window.PuterUI) window.PuterUI.toast(m, k); }
  const queue = []; // [{text, atts}]

  /* ---------- token meter ---------- */
  const Meter = {
    used: 0, win: 128000, exact: false,
    update(used, win, exact) {
      this.used = used; this.win = win || this.win; this.exact = !!exact;
      const pct = Math.min(100, (used / this.win) * 100);
      el("tokenText").textContent = `◉ ${exact ? "" : "~"}${window.PuterTokens.fmt(Math.round(used))} / ${window.PuterTokens.fmt(this.win)} · ${pct.toFixed(0)}%`;
      const fill = el("tokenFill");
      fill.style.width = pct + "%";
      const pill = el("tokenPill");
      pill.classList.toggle("warn", pct >= 70 && pct < 90);
      pill.classList.toggle("crit", pct >= 90);
    },
    reset() { this.update(0, this.win, false); },
  };
  window.PuterMeter = Meter;

  /* ---------- effort ---------- */
  const Effort = {
    value() {
      try { return localStorage.getItem("spa_effort") || "medium"; } catch { return "medium"; }
    },
    set(v) {
      try { localStorage.setItem("spa_effort", v); } catch {}
      paint();
    },
    refresh() { paint(); },
  };
  function paint() {
    const model = el("modelSelect").value;
    const ok = window.PuterModels.supportsEffort(model);
    const row = el("effortRow");
    row.classList.toggle("off", !ok);
    row.title = ok ? "Reasoning effort (OpenAI models)" : "Reasoning effort is OpenAI-only — hidden for Claude";
    const cur = Effort.value();
    row.querySelectorAll(".effort-btn").forEach((b) => b.classList.toggle("active", b.dataset.e === cur));
  }
  window.PuterEffort = Effort;

  /* ---------- dock ---------- */
  const Dock = {
    open(tab) {
      el("dock").classList.remove("hidden");
      if (tab) Dock.tab(tab);
      if (window.PuterCodebase) window.PuterCodebase.render();
      if (window.PuterSecrets) window.PuterSecrets.render();
      if (window.PuterMemory) window.PuterMemory.render();
    },
    close() { el("dock").classList.add("hidden"); },
    toggle(tab) {
      const d = el("dock");
      if (d.classList.contains("hidden")) Dock.open(tab || "preview");
      else if (tab) Dock.tab(tab);
      else Dock.close();
    },
    tab(name) {
      document.querySelectorAll(".dock-tab").forEach((t) => t.classList.toggle("active", t.dataset.dtab === name));
      document.querySelectorAll(".dock-pane").forEach((p) => p.classList.toggle("active", p.id === "dpane-" + name));
      if (name === "code" && window.PuterCodebase) window.PuterCodebase.render();
      if (name === "secrets" && window.PuterSecrets) window.PuterSecrets.render();
    },
  };
  window.PuterDock = Dock;

  function fillModels(extra) {
    const sel = el("modelSelect");
    const keep = sel.value || null;
    sel.innerHTML = "";
    for (const g of window.PuterModels.optionGroups()) {
      const og = document.createElement("optgroup");
      og.label = g.label;
      for (const id of g.ids) {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = `${id}  ${window.PuterModels.costOf(id)}`;
        og.appendChild(o);
      }
      sel.appendChild(og);
    }
    if (extra && extra.length) {
      const og = document.createElement("optgroup");
      og.label = "Live (Puter)";
      for (const id of extra.slice(0, 60)) {
        if ([...sel.querySelectorAll("option")].some((o) => o.value === id)) continue;
        const o = document.createElement("option");
        o.value = id; o.textContent = id;
        og.appendChild(o);
      }
      if (og.children.length) sel.appendChild(og);
    }
    if (keep && [...sel.querySelectorAll("option")].some((o) => o.value === keep)) sel.value = keep;
    else window.PuterLibrary.restore(sel);
    paint();
  }

  function setPill(state, text) {
    const p = el("statusPill");
    p.className = "pill" + (state ? " " + state : "");
    p.textContent = text;
  }
  function setSendBtn(mode) {
    const b = el("btnSend");
    if (mode === "stop") { b.innerHTML = "■"; b.classList.add("stop"); b.title = "Stop generating"; }
    else { b.innerHTML = "→"; b.classList.remove("stop"); b.title = "Send (Enter) · queue while busy · Ctrl+Enter sends now"; }
  }

  function renderQueue() {
    const row = el("queueRow"), list = el("queueList");
    list.innerHTML = "";
    row.classList.toggle("hidden", !queue.length);
    queue.forEach((q, i) => {
      const s = document.createElement("span");
      s.className = "queue-chip";
      s.innerHTML = `<span>${(i + 1)}. ${q.text.slice(0, 40).replace(/</g, "&lt;")}${q.text.length > 40 ? "…" : ""}</span>`;
      const x = document.createElement("button");
      x.textContent = "✕"; x.title = "Remove from queue";
      x.onclick = () => { queue.splice(i, 1); renderQueue(); };
      s.appendChild(x);
      list.appendChild(s);
    });
  }

  async function collectAttachments() {
    const atts = await window.PuterFiles.readAttachments(el("fileInput").files);
    el("fileInput").value = "";
    renderAttachChips([]);
    return atts;
  }
  let stagedNames = [];
  function renderAttachChips(names) {
    stagedNames = names;
    const row = el("attachRow"), list = el("attachList");
    list.innerHTML = "";
    row.classList.toggle("hidden", !names.length);
    names.forEach((n) => {
      const s = document.createElement("span");
      s.className = "queue-chip";
      s.textContent = "📎 " + n;
      list.appendChild(s);
    });
  }

  async function sendCurrent(interrupt) {
    const text = el("userInput").value.trim();
    const hasFiles = el("fileInput").files.length > 0;
    if (!text && !hasFiles) return;
    if (await window.PuterCommands.handle(text)) { el("userInput").value = ""; return; }
    const atts = await collectAttachments();
    el("userInput").value = "";
    window.PuterCommands.hide();
    if (interrupt && window.PuterAgent.isBusy()) {
      window.PuterAgent.stop(); // invalidate in-flight work via generation counter
      queue.length = 0; renderQueue();
      // small beat so the old loop observes the stop before the new send starts
      setTimeout(() => window.PuterAgent.send(text, atts), 60);
      return;
    }
    if (window.PuterAgent.isBusy()) {
      queue.push({ text, atts });
      renderQueue();
      toast(`Queued (#${queue.length}) — sends when the current answer finishes`, "info");
      return;
    }
    window.PuterAgent.send(text, atts);
  }

  function drainQueue() {
    if (!queue.length || window.PuterAgent.isBusy()) return;
    const next = queue.shift();
    renderQueue();
    window.PuterAgent.send(next.text, next.atts);
  }

  window.addEventListener("DOMContentLoaded", async () => {
    if (!(await window.PuterAuth.isSignedIn())) {
      toast("Sign in to continue", "info");
      location.href = "../";
      return;
    }
    fillModels();
    window.PuterSessions.load();
    window.PuterSkills.renderSelect();
    window.PuterSkills.renderList();
    window.PuterMemory.render();
    Meter.reset();
    setPill("ok", "● signed in");
    const u = await window.PuterAuth.currentUser();
    const name = (u && (u.username || u.uuid)) || "you";
    el("accountName").textContent = name;
    el("accountName2").textContent = name;
    el("accountAvatar").textContent = String(name).slice(0, 1).toUpperCase();
    el("accountUsage").textContent = (await window.PuterAuth.usageLines()).join(" · ");

    window.PuterAgent.setBusyHandler((busy) => {
      setSendBtn(busy ? "stop" : "send");
      if (!busy) setTimeout(drainQueue, 120);
    });

    // Header
    el("modelPill").onclick = () => window.PuterLibrary.open();
    el("btnLibraryClose").onclick = () => window.PuterLibrary.close();
    el("libraryOverlay").onclick = (e) => { if (e.target === el("libraryOverlay")) window.PuterLibrary.close(); };
    el("librarySearch").oninput = () => window.PuterLibrary.render();
    document.querySelectorAll(".lib-filter").forEach((b) => b.onclick = () => {
      document.querySelectorAll(".lib-filter").forEach((x) => x.classList.add("ghost"));
      b.classList.remove("ghost");
      window.PuterLibrary.setVendor(b.dataset.v);
    });
    el("btnLibRefresh").onclick = async () => {
      const ids = await window.PuterModels.liveModelIds();
      fillModels(ids);
      window.PuterLibrary.render();
      toast(ids.length ? `Merged ${ids.length} live models` : "Live list unavailable", ids.length ? "ok" : "err");
    };
    const _apply = window.PuterLibrary.apply.bind(window.PuterLibrary);
    window.PuterLibrary.apply = (id) => { _apply(id); paint(); };
    el("accountChip").onclick = (e) => { e.stopPropagation(); el("accountMenu").classList.toggle("hidden"); };
    document.onclick = () => el("accountMenu").classList.add("hidden");
    el("btnSignOut").onclick = async () => { await window.PuterAuth.signOut(); location.href = "../"; };

    // Dock + drawers + modals
    el("btnDock").onclick = () => Dock.toggle();
    el("btnDockClose").onclick = () => Dock.close();
    document.querySelectorAll(".dock-tab").forEach((t) => (t.onclick = () => Dock.tab(t.dataset.dtab)));
    el("btnHistory").onclick = () => el("historyPanel").classList.toggle("hidden");
    el("btnHistoryClose").onclick = () => el("historyPanel").classList.add("hidden");
    el("btnSettings").onclick = () => el("settingsModal").classList.remove("hidden");
    el("btnSettingsClose").onclick = () => el("settingsModal").classList.add("hidden");
    el("settingsModal").onclick = (e) => { if (e.target === el("settingsModal")) el("settingsModal").classList.add("hidden"); };
    el("btnMemory").onclick = async () => {
      await window.PuterMemory.load();
      window.PuterMemory.render();
      el("memoryModal").classList.remove("hidden");
    };
    el("btnMemoryClose").onclick = () => el("memoryModal").classList.add("hidden");
    el("memoryModal").onclick = (e) => { if (e.target === el("memoryModal")) el("memoryModal").classList.add("hidden"); };
    el("btnMemorySave").onclick = async () => {
      await window.PuterMemory.save(el("memoryView").value);
      toast("MEMORY.md saved", "ok");
    };
    el("btnMemoryClear").onclick = async () => {
      if (await window.PuterUI.confirmModal("Clear MEMORY.md?", "The agent will forget all persistent notes.", "Clear")) {
        await window.PuterMemory.save("");
        toast("Memory cleared", "info");
      }
    };

    // Skills
    el("skillSelect").onchange = (e) => {
      window.PuterSkills.select(e.target.value);
      toast(e.target.value ? "Skill active" : "Back to general assistant", "info");
    };
    el("btnSkillSave").onclick = () => window.PuterSkills.saveFromInputs();

    // Codebase + secrets
    el("btnCodeUpload").onclick = () => el("codeFileInput").click();
    el("codeFileInput").onchange = async (e) => {
      for (const f of e.target.files) {
        if (/text|json|javascript|python|html|css|markdown|csv/.test(f.type) || /\.(txt|md|js|ts|py|html|css|json|csv)$/i.test(f.name)) {
          window.PuterCodebase.put(f.name, await f.text());
        } else toast(f.name + " skipped (text files only)", "err");
      }
      e.target.value = "";
      toast("Added to codebase", "ok");
    };
    el("btnCodeClear").onclick = async () => {
      if (await window.PuterUI.confirmModal("Clear codebase?", "Removes all files from the Code tab.", "Clear")) window.PuterCodebase.clear();
    };
    el("btnSecretAdd").onclick = () => window.PuterSecrets.addFromInputs();

    // Effort
    document.querySelectorAll(".effort-btn").forEach((b) => (b.onclick = () => {
      Effort.set(b.dataset.e);
      toast("Effort: " + b.dataset.e, "info");
    }));

    // Composer
    el("btnAttach").onclick = () => el("fileInput").click();
    el("fileInput").onchange = (e) => renderAttachChips([...e.target.files].map((f) => f.name));
    el("btnSend").onclick = () => {
      if (window.PuterAgent.isBusy() && !el("userInput").value.trim() && !el("fileInput").files.length) {
        window.PuterAgent.stop();
        toast("Stopped", "info");
        return;
      }
      sendCurrent(false);
    };
    el("userInput").addEventListener("input", () => {
      window.PuterCommands.renderPalette();
      if (window.PuterAgent.isBusy() && el("userInput").value.trim()) setSendBtn("send");
      else if (window.PuterAgent.isBusy()) setSendBtn("stop");
    });
    el("userInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.ctrlKey && !e.shiftKey) { e.preventDefault(); sendCurrent(true); return; }
      if (e.key === "ArrowDown" && !el("palette").classList.contains("hidden")) { e.preventDefault(); window.PuterCommands.move(1); }
      else if (e.key === "ArrowUp" && !el("palette").classList.contains("hidden")) { e.preventDefault(); window.PuterCommands.move(-1); }
      else if (e.key === "Enter" && !e.shiftKey) {
        if (!el("palette").classList.contains("hidden") && el("userInput").value.startsWith("/")) {
          const v = el("userInput").value;
          if (!v.includes(" ")) { e.preventDefault(); window.PuterCommands.enter(); return; }
        }
        e.preventDefault(); sendCurrent(false);
      } else if (e.key === "Escape") window.PuterCommands.hide();
    });
    document.querySelectorAll(".suggest").forEach((b) => (b.onclick = () => {
      el("userInput").value = b.dataset.prompt;
      sendCurrent(false);
    }));

    // Sessions / preview leftovers
    el("btnNewChat").onclick = () => { window.PuterSessions.newSession(); toast("New chat started", "info"); };
    el("btnExportSession").onclick = () => window.PuterSessions.export();
    el("btnPreviewClear").onclick = () => window.PuterSandbox.clear();
    el("btnPreviewFull").onclick = () => { const f = el("previewFrame"); if (f.requestFullscreen) f.requestFullscreen(); };

    // 402 fallback: one-click retry with nano (claude --fallback-model idea)
    document.addEventListener("click", (e) => {
      if (e.target && e.target.id === "retryCheap") {
        const sel = el("modelSelect");
        if ([...sel.options].some((o) => o.value === "gpt-5.4-nano")) sel.value = "gpt-5.4-nano";
        paint();
        const inp = el("userInput");
        if (inp.value.trim()) sendCurrent(false);
        else toast("Switched to gpt-5.4-nano — type your message", "ok");
      }
    });

    window.PuterAgent.timeline("Ready — chat, or type / for commands.");
  });
})();
