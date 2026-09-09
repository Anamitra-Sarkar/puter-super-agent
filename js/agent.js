/* Core agent: multi-turn history, think/reasoning split, usage, compaction,
 * effort, loop guards, queue hooks. Temperature/max_tokens intentionally omitted
 * (model defaults = best; effectively unlimited output). */
(function () {
  const M = () => window.PuterModels;
  const T = () => window.PuterTools;
  const TK = () => window.PuterTokens;
  let stopFlag = false;
  let busy = false;
  let busyHandler = null;
  let gen = 0; // generation counter: stale in-flight work aborts when gen changes
  let activeGen = 0;
  let history = []; // persistent multi-turn memory (user/assistant/tool only)
  let pendingCompaction = null; // {artifact, text}
  let ledger = []; // task ledger: every attempted tool call {sig,name,args,ok,denied,note,at}
  let lastTurn = null; // {user, tools:[]} for MEMORY.md learning
  let verifyFails = 0; // consecutive failing verify rounds this send (3 strikes → stop auto-fix)
  let thinkDelegateOn = false;

  function el(id) { return document.getElementById(id); }
  function md(text) {
    try { if (window.marked) return marked.parse(String(text)); } catch {}
    return escapeHtml(String(text));
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function setBusy(v) {
    busy = v;
    if (busyHandler) { try { busyHandler(v); } catch {} }
  }
  function isBusy() { return busy; }
  function setBusyHandler(fn) { busyHandler = fn; }
  function stop() { stopFlag = true; gen++; }

  function ensureThinkDelegate() {
    if (thinkDelegateOn) return;
    thinkDelegateOn = true;
    document.addEventListener("click", (e) => {
      const h = e.target.closest(".think-head");
      if (!h) return;
      h.parentElement.classList.toggle("open");
    });
  }

  function thinkHTML(think, secs, done) {
    if (!think) return "";
    const toks = TK().fmt(TK().est(think));
    const label = done ? `Thought for ${secs}s · ~${toks} tokens` : "Thinking…";
    return `<div class="think${done ? "" : " live"}"><button class="think-head">💭 ${label} <span class="chev">⌄</span></button>` +
      `<div class="think-body">${escapeHtml(think)}</div></div>`;
  }
  function paintThink(msgEl, think, t0, done) {
    let box = msgEl.querySelector(".think-slot");
    if (!box) {
      box = document.createElement("div");
      box.className = "think-slot";
      msgEl.insertBefore(box, msgEl.firstChild);
    }
    const secs = ((performance.now() - t0) / 1000).toFixed(0);
    box.innerHTML = thinkHTML(think, secs, done);
  }

  function addMsg(role, html, raw, think) {
    ensureThinkDelegate();
    const hero = document.getElementById("emptyState");
    if (hero) hero.classList.add("bye");
    const app = document.getElementById("app");
    if (app) app.classList.remove("starting");
    const log = el("chatLog");
    const d = document.createElement("div");
    d.className = "msg " + role;
    const label = role === "user" ? "You" : "Assistant · " + escapeHtml(model());
    d.innerHTML = `<div class="role">${label}</div>` +
      (think ? thinkHTML(think, "–", true) : "") +
      `<div class="body">${html}</div>`;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    if (window.PuterSessions && raw !== "__skip__") window.PuterSessions.note(role, raw != null ? raw : d.textContent, think || null);
    return d.querySelector(".body");
  }

  function model() { const s = el("modelSelect"); return s ? s.value : M().DEFAULT_MODEL; }

  function opts() {
    const o = { model: model(), normalize: true };
    const win = M().contextWindow(o.model).size;
    o.compaction = { trigger_tokens: Math.max(20000, win - 30000) };
    try {
      const eff = window.PuterEffort && window.PuterEffort.value();
      if (eff && M().supportsEffort(o.model)) o.reasoning_effort = eff;
    } catch {}
    return o;
  }

  function skillPrompt(override) {
    const customEl = document.getElementById("systemPrompt");
    const custom = customEl ? customEl.value.trim() : "";
    let skilText = "";
    if (window.PuterSkills) {
      const ids = override ? [override] : window.PuterSkills.selected();
      skilText = ids
        .map((id) => { const s = window.PuterSkills.get(id); return s ? `[Skill: ${s.name}]\n${s.prompt}` : ""; })
        .filter(Boolean)
        .join("\n\n");
    } else {
      const sel = document.getElementById("skillSelect");
      const s = override || (sel && sel.value) || "";
      const presets = {
        coder: "You are an expert coding assistant. Write correct, runnable code. When asked for a UI, ALSO call run_code_preview with the full HTML (and a path like index.html) so the user can see it.",
        researcher: "You are a research assistant. Prefer fresh info: use web_search results and web_fetch for sources, cite URLs.",
        writer: "You are a professional writer. Clear, structured, engaging prose with headings.",
        reviewer: "You are a strict code reviewer. Find bugs, edge cases, and suggest concrete fixes.",
      };
      skilText = presets[s] || "";
    }
    return [skilText, custom].filter(Boolean).join("\n\n") || null;
  }

  function timeline(text) {
    // Activity rows live INSIDE the chat flow so they interleave chronologically
    // with messages instead of floating in a detached strip.
    const log = el("chatLog");
    if (!log) return null;
    const d = document.createElement("div");
    d.className = "t";
    d.textContent = text;
    log.appendChild(d);
    while (log.querySelectorAll(":scope > .t").length > 60) {
      const first = log.querySelector(":scope > .t");
      if (first) first.remove();
    }
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function clearTimeline() {
    yoloApproved = false;
  }
  let yoloApproved = false;

  function approvalMode() {
    const s = document.getElementById("approvalMode");
    return s ? s.value : "auto";
  }
  async function confirmTool(name, args) {
    const mode = approvalMode();
    if (mode === "plan") {
      timeline(`[dry-run] would call ${name} ${JSON.stringify(args).slice(0, 200)}`);
      return false;
    }
    if (!T().needsApproval(name, mode)) {
      if (mode === "beast" || mode === "yolo") timeline(`⚙ ${name} — auto-approved (${mode})`);
      return true;
    }
    if (mode === "yolo") {
      if (yoloApproved) return true;
      const ok = await window.PuterUI.confirmModal(
        "Yolo mode: allow all tool calls this turn?",
        "First call:\n" + name + "\n" + JSON.stringify(args, null, 1).slice(0, 600),
        "Allow all");
      yoloApproved = ok;
      return ok;
    }
    return window.PuterUI.confirmModal(
      "Agent wants to call a tool",
      name + "\n" + JSON.stringify(args, null, 1).slice(0, 800),
      "Allow");
  }

  function meter(usedEst, exact, win) {
    // Pill shows CONTEXT fill (estimate). Breakdown (history/memory) rides along for the tooltip.
    if (window.PuterMeter) { try { window.PuterMeter.update(usedEst, win, !!exact, ctxParts); } catch {} }
  }
  let ctxParts = null; // {hist, mem} token estimates behind the current context total
  function present(fullText, userText) {
    const ex = window.PuterCodebase ? window.PuterCodebase.extractCode(fullText, userText) : { text: fullText, files: [] };
    if (ex.files.length) timeline("Saved " + ex.files.length + " code file(s) to the Code tab — open them from the cards below");
    return ex.text;
  }

  const fullStore = {};
  let fullSeq = 0;
  let lastUserPrompt = "";
  function storeFull(text) {
    const id = "m" + (++fullSeq) + Date.now().toString(36);
    fullStore[id] = String(text || "");
    const keys = Object.keys(fullStore);
    if (keys.length > 30) delete fullStore[keys[0]];
    return id;
  }
  function actionsBar(id) {
    return `<div class="actions-bar">
      <button data-act="copy" data-mid="${id}" title="Copy answer">📋</button>
      <button data-act="speak" data-mid="${id}" title="Read aloud">🔊</button>
      <button data-act="simple" data-mid="${id}" title="Explain simply">🪄</button>
      <button data-act="translate" data-mid="${id}" title="Translate">🌐</button>
      <button data-act="note" data-mid="${id}" title="Save as note">📝</button>
      <button data-act="regen" data-mid="${id}" title="Regenerate">🔁</button>
    </div>`;
  }
  function withActions(bodyEl, fullText) {
    if (!bodyEl) return;
    try {
      const d = document.createElement("div");
      d.innerHTML = actionsBar(storeFull(fullText));
      bodyEl.appendChild(d.firstChild);
    } catch {}
  }

  let currentUserText = "";
  function safe(html, userText) {
    try {
      const n = window.PuterSafety ? window.PuterSafety.disclaimerFor(userText) : "";
      return (n || "") + html;
    } catch { return html; }
  }
  function spent(u) {
    if (!u || !window.PuterSafety) return;
    try { window.PuterSafety.addSpent((u.in || 0) + (u.out || 0)); } catch {}
  }

  function tokFooter(usage, fallbackText) {
    if (usage) return `<div class="tok-foot">⚡ this reply: ${usage.in.toLocaleString()} in · ${usage.out.toLocaleString()} out (exact)</div>`;
    return `<div class="tok-foot">⚡ ~${TK().fmt(TK().est(fallbackText))} tokens this reply (est.)</div>`;
  }

  async function learnLast(fullText) {
    if (!lastTurn || !window.PuterMemory) return;
    try { await window.PuterMemory.learnFromTurn(lastTurn.user, fullText, lastTurn.tools); } catch {}
    lastTurn = null;
  }

  /** Summarize history into a compact replacement (manual /compact + auto). */
  async function compactHistory(reason) {
    if (!history.length) return false;
    timeline(`🗜 compacting context (${reason})…`);
    const transcript = history.map((m) => {
      const c = typeof m.content === "string" ? m.content : JSON.stringify(m.content).slice(0, 500);
      return `${m.role.toUpperCase()}: ${c.slice(0, 1500)}`;
    }).join("\n\n").slice(0, 24000);
    try {
      const resp = await puter.ai.chat(
        [{ role: "system", content: "Summarize this conversation densely: key facts, decisions, code/files produced, open tasks. Under 1500 words." },
         { role: "user", content: transcript }],
        { model: "gpt-5.4-nano", normalize: true });
      const summary = M().extractText(resp);
      const recent = history.slice(-6);
      history = [
        { role: "user", content: "[Context compacted. Summary of earlier conversation:]\n" + summary },
        ...recent,
      ];
      pendingCompaction = null;
      timeline("🗜 compacted — kept summary + last 6 turns");
      if (window.PuterUI) window.PuterUI.toast("Context compacted", "ok");
      meter(TK().estMessages(history), false, M().contextWindow(model()).size);
      return true;
    } catch (e) {
      timeline("compact failed: " + (e.message || e));
      return false;
    }
  }

  async function autoCompactCheck() {
    const win = M().contextWindow(model()).size;
    const used = TK().estMessages(history);
    meter(used, false, win);
    if (used > win - 30000) {
      await compactHistory("auto (context nearly full, 30k spared)");
    }
  }

  async function send(text, attachments, skill) {
    if (busy) return false;
    const my = ++gen;
    const alive = () => !stopFlag && my === gen;
    activeGen = my;
    verifyFails = 0;
    stopFlag = false;
    setBusy(true);
    const stopBtn = document.getElementById("btnStop");
    if (stopBtn) stopBtn.disabled = false;
    clearTimeline();
    const withSearch = (() => { const s = document.getElementById("webSearchToggle"); return !!(s && s.checked); })();
    const streamOn = (() => { const s = document.getElementById("streamToggle"); return !s || s.checked; })();
    const base = opts();
    const sys = skillPrompt(skill);

    try {
      await autoCompactCheck();
      const textCtx = (attachments || []).filter((a) => a.kind === "text")
        .map((a) => `\n\n[attached ${a.name}]:\n${a.text.slice(0, 8000)}`).join("");
      const media = attachments && attachments.find((a) => a.kind === "image");
      const userMsg = { role: "user", content: text + textCtx };
      lastTurn = { user: text, tools: [] };
      lastUserPrompt = text;
      currentUserText = text;
      addMsg("user", md(text) + (attachments && attachments.length ? `<p class="muted">📎 ${attachments.length} attachment(s)</p>` : ""));

      // Vision fast-path (single turn, no tools). Text-only models can't see: fall back.
      if (media) {
        if (!M().supportsVision(base.model)) {
          base.model = M().VISION_FALLBACK;
          timeline(`(${model()} is text-only — analyzing with ${base.model})`);
        }
        timeline(`vision via ${base.model} …`);
        await runSingle(text + textCtx, media.payload, base, streamOn);
        return true;
      }

      // Build working messages: system + MEMORY.md + compaction artifact + history + new user turn
      const working = [];
      if (sys) working.push({ role: "system", content: sys });
      try {
        const mem = window.PuterMemory ? await window.PuterMemory.load() : "";
        if (mem) working.push({ role: "system", content: "[MEMORY.md — persistent notes from earlier work. Trust this over guesses; do not redo completed/failed items without a new approach.]\n" + mem.slice(0, 3000) });
        ctxParts = { hist: TK().estMessages(history), mem: TK().est(mem) };
      } catch { ctxParts = null; }
      if (pendingCompaction) {
        working.push({ role: "assistant", content: [pendingCompaction.artifact, { type: "text", text: pendingCompaction.text }] });
        pendingCompaction = null;
      }
      working.push(...history, userMsg);

      const tools = T().schemaForChat(withSearch);
      const seenTools = {};
      let steps = 0;
      let exactUsage = null;
      for (;;) {
        if (stopFlag || activeGen !== gen) break;
        if (steps >= 200) {
          // No hard tool budget — but after very long runs, confirm instead of silently spending.
          const go = await window.PuterUI.chooseModal("Long task — keep going?",
            `200 tool steps used on this turn. The task may need breaking down. Continue anyway?`,
            ["Keep going", "Wrap up now"]);
          if (go !== 0) { timeline("wrapping up after long run."); break; }
          steps = 0;
        }
        steps++;
        timeline(`thinking (step ${steps}, ${base.model})…`);
        const resp = await puter.ai.chat(working, { ...base, tools });
        if (resp && resp.finish_reason === "length") timeline("⚠ output was cut by the model's limit — say 'continue' if the answer looks cut off");
        const u = TK().readUsage(resp);
        if (u) exactUsage = u; // per-reply totals go to the message footer only
        meter(TK().estMessages(working), false, M().contextWindow(base.model).size); // pill = context fill estimate
        if (resp && resp.compaction) pendingCompaction = { artifact: resp.compaction, text: M().extractText(resp) };
        const calls = M().toolCallsOf(resp);
        if (!calls.length) {
          const finalText = M().extractText(resp);
          const think = resp && resp.message ? resp.message.reasoning : null;
          working.push({ role: "assistant", content: finalText });
          history = working.filter((m) => m.role !== "system");
          finish(finalText, think, exactUsage, resp && resp.finish_reason);
          return true;
        }
        working.push(toAssistantMsg(resp));
        for (const c of calls) {
          const name = c.function ? c.function.name : c.name;
          let args = {};
          try { args = JSON.parse(c.function ? c.function.arguments : JSON.stringify(c.input || {})); } catch {}
          const sig = name + ":" + JSON.stringify(args);
          // Task ledger: never blindly redo what was already tried.
          const prior = ledger.filter((e) => e.sig === sig).slice(-1)[0];
          if (prior && !prior.ok) {
            const note = prior.denied
              ? `You already tried ${name} with identical arguments and the USER DENIED it (${prior.note || "no reason given"}). Do NOT call it again — ask the user or try a different approach.`
              : `You already tried ${name} with identical arguments and it FAILED (${prior.note || "no output"}). Do NOT repeat the same call — diagnose and try a different approach.`;
            timeline(`↩ ledger: skipped repeat ${name} (previously ${prior.denied ? "denied" : "failed"})`);
            working.push({ role: "tool", tool_call_id: c.id || c.tool_call_id, content: note });
            continue;
          }
          if (prior && prior.ok) {
            timeline(`↩ ledger: reused prior result for ${name}`);
            working.push({ role: "tool", tool_call_id: c.id || c.tool_call_id, content: `Already completed earlier with the same arguments. Result was: ${prior.note || "(done)"}. Do not redo it — build on it.` });
            continue;
          }
          seenTools[sig] = (seenTools[sig] || 0) + 1;
          if (seenTools[sig] >= 3) {
            // Loop detector: ask the user before stopping (or continuing).
            const choice = await window.PuterUI.chooseModal(
              "🔁 Possible loop detected",
              `${name} was called 3× with identical arguments in this turn.\n\nStop the agent, or let it continue 3 more attempts?`,
              ["Stop agent", "Continue 3 more"]);
            if (choice !== 1) {
              timeline(`⛔ loop stopped by user at ${name} ×3`);
              working.push({ role: "tool", tool_call_id: c.id || c.tool_call_id, content: "Stopped: the user judged this a loop. Summarize what was tried and ask how to proceed." });
              steps = 99; // force exit to final answer
              break;
            }
            timeline(`▶ user allowed 3 more attempts of ${name}`);
            seenTools[sig] = 0;
          }
          const ok = await confirmTool(name, args);
          if (!ok) {
            working.push({ role: "tool", tool_call_id: c.id || c.tool_call_id, content: "User denied this tool call." });
            timeline(`denied ${name}`);
            ledger.push({ sig, name, args, ok: false, denied: true, note: "denied by user", at: Date.now() });
            if (lastTurn) lastTurn.tools.push({ name, args, failed: false, denied: true });
            continue;
          }
          const tick = timeline(`⚙ ${name} …`);
          try {
            const out = await T().execute(name, args, ctxHooks());
            working.push({ role: "tool", tool_call_id: c.id || c.tool_call_id, content: String(out).slice(0, 12000) });
            if (tick) tick.textContent = `⚙ ${name} — done`;
            ledger.push({ sig, name, args, ok: true, note: String(out).slice(0, 300), at: Date.now() });
            if (lastTurn) lastTurn.tools.push({ name, args });
          } catch (e) {
            working.push({ role: "tool", tool_call_id: c.id || c.tool_call_id, content: "Tool error: " + (e && e.message || e) });
            if (tick) tick.textContent = `⚙ ${name} — error: ${(e && e.message) || e}`;
            ledger.push({ sig, name, args, ok: false, note: String((e && e.message) || e).slice(0, 300), at: Date.now() });
            if (lastTurn) lastTurn.tools.push({ name, args, failed: true, note: String((e && e.message) || e).slice(0, 200) });
          }
        }
        if (steps >= 99) {
          timeline("writing final answer…");
          try {
            const last = await puter.ai.chat(working, { ...base });
            const finalText = M().extractText(last);
            working.push({ role: "assistant", content: finalText });
            history = working.filter((m) => m.role !== "system");
            finish(finalText, null, TK().readUsage(last), null);
          } catch (e) {
            addMsg("assistant", window.PuterUI.errorCard(e, base.model));
          }
          return true;
        }
      }
      if (activeGen !== gen) return true; // superseded by a newer send
      if (stopFlag) { timeline("stopped."); return true; }
      // Streamed final answer after tool rounds
      timeline("writing final answer…");
      await runStreamed(working, base, streamOn);
      return true;
    } catch (e) {
      if (activeGen !== gen) return true; // stale send, stay silent
      addMsg("assistant", window.PuterUI.errorCard(e, base.model));
      window.PuterUI.toast("Request failed — see error card", "err");
      return true;
    } finally {
      if (stopBtn) stopBtn.disabled = true;
      if (my === gen) setBusy(false);
    }
  }

  function ctxHooks() {
    return {
      onImage: (img, p) => {
        img.style.maxWidth = "100%";
        const b = addMsg("assistant", `<p><b>🎨 ${escapeHtml(p || "")}</b></p>`, "[image] " + (p || ""));
        b.appendChild(img);
        window.PuterUI.toast("Image ready", "ok");
      },
      onAudio: (a) => {
        const o = document.getElementById("ttsOut");
        if (o) { o.innerHTML = ""; a.setAttribute("controls", ""); o.appendChild(a); }
        else {
          const b = addMsg("assistant", "<p>🔊 <i>audio</i></p>", "[audio]");
          b.appendChild(a);
        }
        a.setAttribute("controls", "");
        a.play().catch(() => {});
        window.PuterUI.toast("Playing audio", "ok");
      },
      onPreview: async (html, title, path) => {
        const CB = window.PuterCodebase;
        html = String(html || "");
        // The MODEL chooses what to preview — we never substitute. Safety nets only:
        // codebase.put() quarantines truncated overwrites, verify reports issues.
        if (CB && path) {
          CB.put(path, html);
          CB.setEntry(path);
        }
        let note = path ? `Entry file: ${path}. ` : "";
        if (window.PuterSessions) window.PuterSessions.setPreview({ file: CB ? CB.getEntry() : null, html: path ? null : html });
        window.PuterSandbox.render(html, title || path || "preview");
        if (window.PuterDock) window.PuterDock.open("preview");
        window.PuterUI.toast("Preview opened — verifying…", "info");
        timeline("🔍 verifying build (console · responsive · clicks · security · design)…");
        await new Promise((r) => setTimeout(r, 1800)); // let the preview boot
        let report = "";
        try {
          report = await window.PuterSandbox.verify(model());
        } catch (e) {
          report = "Verify harness error: " + (e.message || e);
        }
        const bad = /❌/.test(report);
        if (bad) {
          verifyFails++;
          if (verifyFails >= 3) {
            timeline("🔍 verify still failing after 3 fix rounds — stopping auto-fix, showing you the state");
            window.PuterUI.toast("Verify stuck after 3 rounds — review needed", "err");
            report += "\n\nSTOP: 3 consecutive verify rounds still show ❌. Do NOT call preview tools again this turn. Summarize honestly for the user: what works, what fails, and what input you need (or suggest they say 'keep fixing' for 3 more rounds).";
          } else {
            timeline(`🔍 verify found issues — fixing… (round ${verifyFails}/3)`);
            window.PuterUI.toast("Issues found — agent is fixing", "err");
          }
        } else {
          verifyFails = 0;
          timeline("🔍 verify: all checks green");
          window.PuterUI.toast("Build verified clean", "ok");
        }
        return "\n\n" + (note ? note + "\n" : "") + "Previewing: " + (title || path || "preview") + "\n" + report;
      },
    };
  }

  function toAssistantMsg(resp) {
    if (resp && resp.message && resp.message.role) return resp.message;
    return { role: "assistant", content: M().extractText(resp) };
  }

  function finish(finalText, think, usage, finishReason) {
    const userText = lastTurn ? lastTurn.user : "";
    const ex = window.PuterCodebase ? window.PuterCodebase.extractCode(finalText, userText) : { text: finalText, files: [] };
    if (ex.files.length) timeline(`📁 saved ${ex.files.length} code file(s) to the Code tab — open them from the cards below`);
    spent(usage);
    let html = safe(md(ex.text), userText);
    if (finishReason === "length") {
      html += `<div class="err-card" style="margin-top:8px"><p><b>Output hit the model's limit</b> — say "continue" and I'll pick up where I stopped.</p></div>`;
    }
    html += tokFooter(usage, finalText);
    const body = addMsg("assistant", html, ex.text, think || null);
    void body;
    withActions(body, finalText);
    learnLast(finalText);
  }

  /** Single-turn call (vision / simple), with think + usage handling. */
  async function runSingle(prompt, mediaPayload, base, streamOn) {
    currentUserText = typeof prompt === "string" ? prompt : "";
    const t0 = performance.now();
    const msgEl = addMsg("assistant", "", "").parentElement;
    const body = msgEl.querySelector(".body");
    body.classList.add("streaming");
    let think = "", full = "", usage = null, display = null;
    const renderAll = (done) => {
      paintThink(msgEl, think, t0, done);
      body.innerHTML = safe(md(done && display !== null ? display : full) + (done ? tokFooter(usage, full) : ""), currentUserText);
    };
    if (streamOn) {
      try {
        const resp = await puter.ai.chat(prompt, mediaPayload, false, { ...base, stream: true });
        if (resp && typeof resp[Symbol.asyncIterator] === "function") {
          for await (const part of resp) {
            if (stopFlag || activeGen !== gen) break;
            if (!part) continue;
            if (part.type === "error") throw new Error(part.message || "stream error");
            if (part.type === "reasoning" && part.reasoning) { think += part.reasoning; renderAll(false); }
            else if (part.text) { full += part.text; renderAll(false); }
            else if (part.reasoning) { think += part.reasoning; renderAll(false); }
            if (part.type === "usage" && part.usage) usage = TK().readUsage({ usage: part.usage });
          }
          body.classList.remove("streaming");
          display = present(full, prompt);
          renderAll(true);
          withActions(body, full);
          spent(usage);
          meter(TK().est(prompt) + TK().est(full) + TK().est(think), false, M().contextWindow(base.model).size);
          history.push({ role: "user", content: prompt }, { role: "assistant", content: full });
          if (window.PuterSessions) window.PuterSessions.note("assistant", display !== null ? display : full, think || null);
          learnLast(full);
          return;
        }
      } catch (e) {
        if (!full) throw e;
      }
    }
    const resp = await puter.ai.chat(prompt, mediaPayload, false, base);
    full = M().extractText(resp);
    think = (resp && resp.message && resp.message.reasoning) || "";
    usage = TK().readUsage(resp);
    body.classList.remove("streaming");
    display = present(full, prompt);
    renderAll(true);
    withActions(body, full);
    spent(usage);
    meter(TK().est(prompt) + TK().est(full), false, M().contextWindow(base.model).size);
    history.push({ role: "user", content: prompt }, { role: "assistant", content: full });
    if (window.PuterSessions) window.PuterSessions.note("assistant", display !== null ? display : full, think || null);
          learnLast(full);
  }

  /** Streamed final answer after tool rounds; collects think + usage + compaction. */
  async function runStreamed(working, base, streamOn) {
    const t0 = performance.now();
    const msgEl = addMsg("assistant", "", "").parentElement;
    const body = msgEl.querySelector(".body");
    body.classList.add("streaming");
    let think = "", full = "", usage = null, display = null;
    const renderAll = (done) => {
      paintThink(msgEl, think, t0, done);
      body.innerHTML = safe(md(done && display !== null ? display : full) + (done ? tokFooter(usage, full) : ""), currentUserText);
    };
    if (streamOn) {
      try {
        const resp = await puter.ai.chat(working, { ...base, stream: true });
        if (resp && typeof resp[Symbol.asyncIterator] === "function") {
          for await (const part of resp) {
            if (stopFlag || activeGen !== gen) break;
            if (!part) continue;
            if (part.type === "error") throw new Error(part.message || "stream error");
            if (part.type === "reasoning" && part.reasoning) { think += part.reasoning; renderAll(false); }
            else if (part.text) { full += part.text; renderAll(false); }
            else if (part.reasoning) { think += part.reasoning; renderAll(false); }
            if (part.type === "usage" && part.usage) usage = TK().readUsage({ usage: part.usage });
            if (part.type === "compaction" && part.id) {
              pendingCompaction = { artifact: { type: "compaction", id: part.id, encrypted_content: part.encrypted_content }, text: full };
            }
          }
          body.classList.remove("streaming");
          display = present(full, lastTurn ? lastTurn.user : "");
          renderAll(true);
          withActions(body, full);
          working.push({ role: "assistant", content: full });
          history = working.filter((m) => m.role !== "system");
          if (window.PuterSessions) window.PuterSessions.note("assistant", display !== null ? display : full, think || null);
          learnLast(full);
          spent(usage);
          meter(TK().estMessages(working), false, M().contextWindow(base.model).size);
          return;
        }
      } catch (e) {
        if (!full) throw e;
      }
    }
    const resp = await puter.ai.chat(working, base);
    full = M().extractText(resp);
    think = (resp && resp.message && resp.message.reasoning) || "";
    usage = TK().readUsage(resp);
    if (resp && resp.compaction) pendingCompaction = { artifact: resp.compaction, text: full };
    body.classList.remove("streaming");
    display = present(full, lastTurn ? lastTurn.user : "");
    renderAll(true);
    withActions(body, full);
    working.push({ role: "assistant", content: full });
    history = working.filter((m) => m.role !== "system");
    if (window.PuterSessions) window.PuterSessions.note("assistant", display !== null ? display : full, think || null);
          learnLast(full);
    spent(usage);
    meter(TK().estMessages(working), false, M().contextWindow(base.model).size);
  }

  window.PuterAgent = {
    send, stop, timeline, addMsg, opts, escapeHtml, md,
    isBusy, setBusyHandler,
    getHistory: () => history,
    getFull: (id) => fullStore[id] || "",
    getLastPrompt: () => lastUserPrompt,
    clearHistory: () => { history = []; pendingCompaction = null; ledger = []; lastTurn = null; },
    compactHistory,
  };
})();
