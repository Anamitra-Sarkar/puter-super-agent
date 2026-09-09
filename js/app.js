/* App shell: auth gate, library, queue + unified send/stop, meter, effort, dock. */
(function () {
  function el(id) { return document.getElementById(id); }
  function toast(m, k) { if (window.PuterUI) window.PuterUI.toast(m, k); }
  const queue = []; // [{text, atts}]

  /* ---------- token meter ---------- */
  const Meter = {
    used: 0, win: 128000, exact: false,
    update(used, win, exact, parts) {
      this.used = used; this.win = win || this.win; this.exact = !!exact;
      const pct = Math.min(100, (used / this.win) * 100);
      el("tokenText").textContent = `◉ ~${window.PuterTokens.fmt(Math.round(used))} / ${window.PuterTokens.fmt(this.win)} · ${pct.toFixed(0)}%`;
      const fill = el("tokenFill");
      fill.style.width = pct + "%";
      const pill = el("tokenPill");
      let tip = "Total context incl. history (estimate). Exact per-reply counts sit under each answer.";
      if (parts && (parts.hist || parts.mem)) {
        const rest = Math.max(0, Math.round(used - (parts.hist || 0) - (parts.mem || 0)));
        tip = `Total context ~${window.PuterTokens.fmt(Math.round(used))} = history ~${window.PuterTokens.fmt(parts.hist || 0)} + memory ~${window.PuterTokens.fmt(parts.mem || 0)} + this turn ~${window.PuterTokens.fmt(rest)}. Codebase files are NOT counted until the agent reads them.`;
      }
      pill.title = tip;
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
      const d = el("dock");
      d.classList.remove("hidden");
      requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add("open")));
      if (tab) Dock.tab(tab);
      if (window.PuterCodebase) window.PuterCodebase.render();
      if (window.PuterSecrets) window.PuterSecrets.render();
      if (window.PuterMemory) window.PuterMemory.render();
    },
    close() {
      const d = el("dock");
      d.classList.remove("open");
      setTimeout(() => { if (!d.classList.contains("open")) d.classList.add("hidden"); }, 380);
    },
    toggle(tab) {
      const d = el("dock");
      if (d.classList.contains("hidden") || !d.classList.contains("open")) Dock.open(tab || "preview");
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
    const all = [...el("fileInput").files];
    const zips = all.filter((f) => /\.zip$/i.test(f.name));
    for (const z of zips) handleZipUpload(z);
    const rest = all.filter((f) => !/\.zip$/i.test(f.name));
    const atts = await window.PuterFiles.readAttachments(rest);
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

  function queueOrSend(text, atts) {
    if (!navigator.onLine) {
      window.PuterCloud.stash(text);
      toast("Offline — queued on this device", "err");
      return;
    }
    window.PuterCloud.checkpointStart(text, el("modelSelect").value);
    window.__hadSend = true;
    if (window.PuterAgent.isBusy()) {
      queue.push({ text, atts: atts || [] });
      renderQueue();
      toast(`Queued (#${queue.length})`, "info");
      return;
    }
    window.PuterAgent.send(text, atts || []);
  }

  async function handleZipUpload(file) {
    window.PuterAgent.addMsg("user", `📦 <b>Uploaded ${String(file.name).replace(/</g, "&lt;")}</b>`);
    toast("Unzipping into codebase…", "info");
    try {
      const { count, tree, skipped } = await window.PuterFilegen.unzipToCodebase(file);
      if (!count) { toast("No readable code files found in zip", "err"); return; }
      toast(`Added ${count} files to the Code tab`, "ok");
      if (window.PuterDock) window.PuterDock.open("code");
      queueOrSend(
        `I uploaded a codebase zip (${file.name}): ${count} files are now in your Code tab${skipped ? ` (${skipped} binaries/build artifacts skipped)` : ""}.\n` +
        `Key files:\n${tree.slice(0, 40).join("\n")}\n\nFirst ANALYZE this codebase, then write a step-by-step plan. ` +
        `After the plan, use ask_user to ask me anything you need (give options with a recommended one each) and WAIT for my confirmation before changing anything.`,
        []);
    } catch (e) {
      toast("Unzip failed: " + String(e.message || e).slice(0, 120), "err");
    }
  }

  let sending = false; // sync re-entrancy lock: double-Enter can never double-send
  async function sendCurrent(interrupt) {
    if (sending) return;
    const text = el("userInput").value.trim();
    const hasFiles = el("fileInput").files.length > 0;
    if (!text && !hasFiles) return;
    el("userInput").value = ""; // clear immediately, no matter what happens next
    window.PuterCommands.hide();
    sending = true;
    try {
      if (!navigator.onLine) {
        window.PuterCloud.stash(text || "[attachment]");
        el("fileInput").value = "";
        renderAttachChips([]);
        toast("Offline — queued on this device, sends on reconnect", "err");
        return;
      }
      if (await window.PuterCommands.handle(text)) return;
      window.PuterCloud.checkpointStart(text, el("modelSelect").value);
      window.__hadSend = true;
      const atts = await collectAttachments();
      if (!text && !atts.length) return; // zip-only sends are handled by the unzip flow
      if (interrupt && window.PuterAgent.isBusy()) {
        window.PuterAgent.stop(); // invalidate in-flight work via generation counter
        queue.length = 0; renderQueue();
        // route via queue so it fires only after the old turn fully settles
        queue.unshift({ text, atts });
        renderQueue();
        return;
      }
      if (window.PuterAgent.isBusy()) {
        queue.push({ text, atts });
        renderQueue();
        toast(`Queued (#${queue.length}) — sends when the current answer finishes`, "info");
        return;
      }
      queueOrSend(text, atts);
    } finally {
      sending = false;
    }
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
      if (!busy) {
        if (window.__hadSend) { window.__hadSend = false; window.PuterCloud.checkpointDone(); }
        setTimeout(drainQueue, 120);
      }
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
    const _apply = window.PuterLibrary.applyCombo.bind(window.PuterLibrary);
    window.PuterLibrary.applyCombo = (fid, r, f) => { _apply(fid, r, f); paint(); };
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
    // Skills (multi-toggle list renders itself)
    // Skills (inline editor lives in the list itself)

    // Codebase + secrets
    el("btnCodeUpload").onclick = () => el("codeFileInput").click();
    el("codeFileInput").onchange = async (e) => {
      for (const f of e.target.files) {
        if (/\.zip$/i.test(f.name)) { handleZipUpload(f); continue; }
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
    el("btnCodeZip").onclick = () => window.PuterFilegen.downloadCodebaseZip();
    // Mic → speech-to-text straight into the composer
    let recorder = null, recChunks = [];
    el("btnMic").onclick = async () => {
      if (recorder) {
        recorder.stop();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recChunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          recorder = null;
          el("btnMic").classList.remove("rec");
          const blob = new Blob(recChunks, { type: recorder.mimeType || "audio/webm" });
          if (!blob.size) return;
          toast("Transcribing…", "info");
          try {
            const out = await puter.ai.speech2txt(blob, { response_format: "text" });
            const text = typeof out === "string" ? out : out.text || "";
            if (text.trim()) {
              el("userInput").value = (el("userInput").value + " " + text.trim()).trim();
              el("userInput").focus();
            } else toast("Heard nothing — try again", "err");
          } catch (e) {
            toast("Transcription failed: " + (e.message || e).slice(0, 120), "err");
          }
        };
        recorder.start();
        el("btnMic").classList.add("rec");
        toast("Listening… tap 🎙 again to stop", "info");
      } catch {
        toast("Mic unavailable — check browser permission", "err");
      }
    };
    el("btnSecretAdd").onclick = () => window.PuterSecrets.addFromInputs();

    // Effort
    document.querySelectorAll(".effort-btn").forEach((b) => (b.onclick = () => {
      Effort.set(b.dataset.e);
      toast("Effort: " + b.dataset.e, "info");
    }));

    // Composer
    el("btnAttach").onclick = () => el("fileInput").click();
    el("fileInput").onchange = (e) => renderAttachChips(
      [...e.target.files].filter((f) => !/\.zip$/i.test(f.name)).map((f) => f.name));
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

    // Approval mode (persisted)
    try {
      const saved = localStorage.getItem("spa_approval");
      if (saved && [...el("approvalMode").options].some((o) => o.value === saved)) el("approvalMode").value = saved;
    } catch {}
    // Toggles + system prompt (persisted — survive relogin, shared by all chats)
    try {
      const prefs = JSON.parse(localStorage.getItem("spa_prefs") || "{}");
      if (typeof prefs.stream === "boolean") el("streamToggle").checked = prefs.stream;
      if (typeof prefs.search === "boolean") el("webSearchToggle").checked = prefs.search;
      if (typeof prefs.sys === "string") el("systemPrompt").value = prefs.sys;
    } catch {}
    const savePrefs = () => {
      try {
        localStorage.setItem("spa_prefs", JSON.stringify({
          stream: el("streamToggle").checked,
          search: el("webSearchToggle").checked,
          sys: el("systemPrompt").value,
        }));
      } catch {}
    };
    el("streamToggle").onchange = savePrefs;
    el("webSearchToggle").onchange = savePrefs;
    el("systemPrompt").oninput = savePrefs;
    el("approvalMode").onchange = (e) => {
      try { localStorage.setItem("spa_approval", e.target.value); } catch {}
      toast(e.target.value === "beast"
        ? "Beast mode: agent runs everything, no permission popups"
        : "Approval: " + e.target.value, "info");
    };
    el("btnNewChat").onclick = () => { window.PuterSessions.newSession(); toast("New chat started", "info"); };
    el("btnExportSession").onclick = () => window.PuterSessions.export();

    // Templates, notes, budget, onboarding, data controls
    el("btnTemplates").onclick = () => window.PuterTemplates.open();
    el("notesSearch").oninput = (e) => window.PuterNotes.render(e.target.value);
    window.PuterNotes.render();
    const bi = el("budgetInput");
    bi.value = window.PuterSafety.budgetCap() || "";
    bi.onchange = () => {
      const n = parseInt(bi.value, 10) || 0;
      window.PuterSafety.setBudgetCap(n);
      toast(n ? `Budget: ${n.toLocaleString()} tokens/mo` : "Budget off", "info");
    };
    let hideOb = false;
    try { hideOb = localStorage.getItem("spa_onboard") === "1"; } catch {}
    if (!hideOb) el("onboardOverlay").classList.remove("hidden");
    el("btnOnboardGo").onclick = () => {
      if (el("onboardHide").checked) { try { localStorage.setItem("spa_onboard", "1"); } catch {} }
      el("onboardOverlay").classList.add("hidden");
    };
    el("btnDataControls").onclick = () => { el("accountMenu").classList.add("hidden"); el("dataModal").classList.remove("hidden"); };
    el("btnDataClose").onclick = () => el("dataModal").classList.add("hidden");
    el("dataModal").onclick = (e) => { if (e.target === el("dataModal")) el("dataModal").classList.add("hidden"); };
    el("btnWipeAll").onclick = async () => {
      if (!(await window.PuterUI.confirmModal("Delete everything?",
        "Clears browser data (sessions, skills, secrets, codebase, notes mirror, settings) AND your cloud keys (MEMORY.md, notes, agent memory). Cannot be undone.", "Delete all"))) return;
      try {
        Object.keys(localStorage).filter((k) => k.startsWith("spa_") || k.startsWith("puter-super-agent")).forEach((k) => localStorage.removeItem(k));
        let keys = [];
        try { keys = await puter.kv.list(); } catch {}
        const arr = Array.isArray(keys) ? keys : (keys && keys.keys) || [];
        for (const k of arr) {
          const name = typeof k === "string" ? k : k.key;
          if (/^(agent_memory_md|agentmem_|note_|pv_|site_)/.test(name || "")) { try { await puter.kv.del(name); } catch {} }
        }
      } catch {}
      toast("Wiped. Reloading…", "info");
      setTimeout(() => location.reload(), 900);
    };
    el("btnPreviewClear").onclick = () => window.PuterSandbox.clear();
    el("previewFileSel").onchange = (e) => {
      const f = window.PuterCodebase.get(e.target.value);
      if (!f) return;
      window.PuterCodebase.setEntry(e.target.value);
      window.PuterSandbox.render(f.content, e.target.value);
      window.PuterCodebase.render();
      if (window.PuterSessions) window.PuterSessions.setPreview({ file: e.target.value, html: null });
    };
    el("btnPreviewFull").onclick = () => { const f = el("previewFrame"); if (f.requestFullscreen) f.requestFullscreen(); };
    el("btnPreviewExit").onclick = () => { if (document.exitFullscreen) document.exitFullscreen(); };
    document.addEventListener("fullscreenchange", () => {
      el("btnPreviewExit").classList.toggle("show", !!document.fullscreenElement);
    });

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

    // Answer-action toolbar (delegated)
    const excerpt = (t, n) => String(t || "").slice(0, n || 2000);
    document.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-act]");
      if (b) {
        const full = window.PuterAgent.getFull(b.dataset.mid);
        if (!full) return toast("Answer expired from memory", "err");
        if (b.dataset.act === "copy") {
          try { await navigator.clipboard.writeText(full); toast("Copied", "ok"); }
          catch { toast("Copy blocked by browser", "err"); }
        } else if (b.dataset.act === "speak") {
          try {
            const a = await puter.ai.txt2speech(full.slice(0, 2900), { provider: "openai", model: "gpt-4o-mini-tts", voice: "alloy" });
            a.play().catch(() => {});
            toast("Reading aloud", "ok");
          } catch (err) { toast("Speech failed", "err"); }
        } else if (b.dataset.act === "simple") {
          sendText("Explain simply, like I'm 12 (short):\n\n" + excerpt(full));
        } else if (b.dataset.act === "translate") {
          const langs = ["Spanish", "Hindi", "French", "Bengali", "German", "Tamil"];
          const i = await window.PuterUI.chooseModal("Translate answer", "Pick a target language:", langs);
          if (i >= 0) sendText(`Translate into ${langs[i]}, keep formatting:\n\n` + excerpt(full, 3000));
        } else if (b.dataset.act === "note") {
          window.PuterNotes.save(full.split("\n")[0].slice(0, 60) || "Note", full);
        } else if (b.dataset.act === "regen") {
          const p = window.PuterAgent.getLastPrompt();
          if (p) sendText(p);
          else toast("Nothing to regenerate", "err");
        }
        return;
      }
      const ob = e.target.closest("[data-open-code]");
      if (ob) {
        if (window.PuterCodebase) window.PuterCodebase.setActive(ob.dataset.openCode);
        window.PuterDock.open("code");
      }
    });
    function sendText(text) {
      if (window.PuterAgent.isBusy()) {
        toast("Busy — queued after current answer", "info");
        (function q() {
          if (window.PuterAgent.isBusy()) return setTimeout(q, 800);
          window.PuterAgent.send(text, []);
        })();
        return;
      }
      window.PuterAgent.send(text, []);
    }

    window.PuterAgent.timeline("Ready — chat, or type / for commands.");
    window.PuterCloud.flush();
    setTimeout(() => window.PuterCloud.checkResume(), 1500);
  });
})();
