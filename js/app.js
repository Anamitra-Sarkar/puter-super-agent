/* App shell wiring: auth gate, model pill + library, palette composer, drawers. */
(function () {
  function el(id) { return document.getElementById(id); }
  function toast(m, k) { if (window.PuterUI) window.PuterUI.toast(m, k); }

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
  }

  function setPill(state, text) {
    const p = el("statusPill");
    p.className = "pill" + (state ? " " + state : "");
    p.textContent = text;
  }

  async function sendCurrent() {
    const text = el("userInput").value.trim();
    if (!text && !el("fileInput").files.length) return;
    if (await window.PuterCommands.handle(text)) { el("userInput").value = ""; return; }
    el("userInput").value = "";
    window.PuterCommands.hide();
    const atts = await window.PuterFiles.readAttachments(el("fileInput").files);
    el("fileInput").value = "";
    window.PuterAgent.send(text, atts);
  }

  function toggleDrawer(id) {
    for (const d of ["historyPanel", "studioPanel"]) {
      if (d === id) el(d).classList.toggle("hidden");
      else el(d).classList.add("hidden");
    }
  }

  window.addEventListener("DOMContentLoaded", async () => {
    // Auth gate: app requires sign-in.
    if (!(await window.PuterAuth.isSignedIn())) {
      toast("Sign in to continue", "info");
      location.href = "index.html";
      return;
    }
    fillModels();
    window.PuterSessions.load();
    setPill("ok", "● signed in");
    const u = await window.PuterAuth.currentUser();
    const name = (u && (u.username || u.uuid)) || "you";
    el("accountName").textContent = name;
    el("accountName2").textContent = name;
    el("accountAvatar").textContent = String(name).slice(0, 1).toUpperCase();
    el("accountUsage").textContent = (await window.PuterAuth.usageLines()).join(" · ");

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
    el("accountChip").onclick = (e) => { e.stopPropagation(); el("accountMenu").classList.toggle("hidden"); };
    document.onclick = () => el("accountMenu").classList.add("hidden");
    el("btnSignOut").onclick = async () => {
      await window.PuterAuth.signOut();
      location.href = "index.html";
    };

    // Drawers + settings
    el("btnHistory").onclick = () => toggleDrawer("historyPanel");
    el("btnHistoryClose").onclick = () => el("historyPanel").classList.add("hidden");
    el("btnStudio").onclick = () => toggleDrawer("studioPanel");
    el("btnStudioClose").onclick = () => el("studioPanel").classList.add("hidden");
    el("btnSettings").onclick = () => el("settingsModal").classList.remove("hidden");
    el("btnSettingsClose").onclick = () => el("settingsModal").classList.add("hidden");
    el("settingsModal").onclick = (e) => { if (e.target === el("settingsModal")) el("settingsModal").classList.add("hidden"); };
    el("temperature").oninput = (e) => (el("tempVal").textContent = e.target.value);

    // Composer + palette
    el("btnSend").onclick = sendCurrent;
    el("btnStop").onclick = () => window.PuterAgent.stop();
    el("userInput").addEventListener("input", () => window.PuterCommands.renderPalette());
    el("userInput").addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" && !el("palette").classList.contains("hidden")) { e.preventDefault(); window.PuterCommands.move(1); }
      else if (e.key === "ArrowUp" && !el("palette").classList.contains("hidden")) { e.preventDefault(); window.PuterCommands.move(-1); }
      else if (e.key === "Enter" && !e.shiftKey) {
        if (!el("palette").classList.contains("hidden") && el("userInput").value.startsWith("/")) {
          const v = el("userInput").value;
          if (!v.includes(" ")) { e.preventDefault(); window.PuterCommands.enter(); return; }
        }
        e.preventDefault(); sendCurrent();
      } else if (e.key === "Escape") window.PuterCommands.hide();
    });
    document.querySelectorAll(".suggest").forEach((b) => b.onclick = () => {
      el("userInput").value = b.dataset.prompt;
      sendCurrent();
    });

    // Sessions / studio / preview
    el("btnNewChat").onclick = () => { window.PuterSessions.newSession(); toast("New chat started", "info"); };
    el("btnExportSession").onclick = () => window.PuterSessions.export();
    el("btnVision").onclick = () => window.PuterFiles.doVision();
    el("btnTTS").onclick = () => window.PuterFiles.doTTS();
    el("btnFsList").onclick = () => window.PuterFiles.fsList();
    el("btnFsRead").onclick = () => window.PuterFiles.fsRead();
    el("btnFsWrite").onclick = () => window.PuterFiles.fsWrite();
    el("btnFetch").onclick = () => window.PuterFiles.doFetch(false);
    el("btnSummarize").onclick = () => window.PuterFiles.doFetch(true);
    el("btnDeploy").onclick = () => window.PuterDeploy.deploy();
    el("btnWorkerHealth").onclick = () => window.PuterDeploy.workerHealth();
    el("btnPreviewClear").onclick = () => window.PuterSandbox.clear();
    el("btnPreviewFull").onclick = () => { const f = el("previewFrame"); if (f.requestFullscreen) f.requestFullscreen(); };

    window.PuterAgent.timeline("Ready — chat, or type / for commands.");
  });
})();
