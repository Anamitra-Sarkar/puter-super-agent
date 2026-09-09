/* Core chat + agent orchestrator: streaming, tool-loop, timeline, stop. */
(function () {
  const M = () => window.PuterModels;
  const T = () => window.PuterTools;
  let stopFlag = false;
  let yoloApproved = false;

  function el(id) { return document.getElementById(id); }
  function md(text) {
    try {
      if (window.marked) return marked.parse(String(text));
    } catch {}
    return escapeHtml(String(text));
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function addMsg(role, html, raw) {
    const hero = document.getElementById("emptyState");
    if (hero) hero.classList.add("bye");
    const log = el("chatLog");
    const d = document.createElement("div");
    d.className = "msg " + role;
    d.innerHTML = `<div class="role">${role === "user" ? "You" : "Assistant · " + escapeHtml(el("modelSelect").value)}</div><div class="body">${html}</div>`;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    if (window.PuterSessions) window.PuterSessions.note(role, raw != null ? raw : d.textContent);
    return d.querySelector(".body");
  }
  function timeline(text) {
    const t = el("timeline");
    const d = document.createElement("div");
    d.className = "t";
    d.textContent = text;
    t.appendChild(d);
    return d;
  }
  function clearTimeline() { el("timeline").innerHTML = ""; yoloApproved = false; }
  function stop() { stopFlag = true; }

  function opts() {
    const o = { model: el("modelSelect").value, normalize: true };
    const t = parseFloat(el("temperature").value);
    if (!Number.isNaN(t)) o.temperature = t;
    const mt = parseInt(el("maxTokens").value, 10);
    if (!Number.isNaN(mt) && mt > 0) o.max_tokens = mt;
    return o;
  }
  function skillPrompt() {
    const s = el("skillSelect").value;
    const custom = el("systemPrompt").value.trim();
    const presets = {
      coder: "You are an expert coding assistant. Write correct, runnable code. When asked for a UI, ALSO call run_code_preview with the full HTML so the user can see it.",
      researcher: "You are a research assistant. Prefer fresh info: use web_search results and web_fetch for sources, cite URLs.",
      writer: "You are a professional writer. Clear, structured, engaging prose with headings.",
      reviewer: "You are a strict code reviewer. Find bugs, edge cases, and suggest concrete fixes.",
    };
    return [presets[s], custom].filter(Boolean).join("\n\n") || null;
  }

  async function confirmTool(name, args) {
    const mode = el("approvalMode").value;
    if (mode === "plan") {
      timeline(`[dry-run] would call ${name} ${JSON.stringify(args).slice(0, 200)}`);
      return false;
    }
    if (!T().needsApproval(name, mode)) return true;
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

  /** Non-streaming tool loop (max 6 steps), then streams the final answer. */
  async function send(text, attachments) {
    stopFlag = false;
    el("btnStop").disabled = false;
    clearTimeline();
    const mode = el("agentMode").value;
    const useTools = mode === "agent";
    const withSearch = el("webSearchToggle").checked;
    const stream = el("streamToggle").checked;
    const base = opts();
    const sys = skillPrompt();

    addMsg("user", md(text) + (attachments && attachments.length ? `<p class="muted">📎 ${attachments.length} attachment(s)</p>` : ""));
    const media = attachments && attachments.find((a) => a.kind === "image");
    let messages = [];
    if (sys) messages.push({ role: "system", content: sys });
    const textCtx = (attachments || []).filter((a) => a.kind === "text").map((a) => `\n\n[attached ${a.name}]:\n${a.text.slice(0, 8000)}`).join("");
    messages.push({ role: "user", content: text + textCtx });

    try {
      // Simple vision fast-path: image + no tools → direct media call
      if (media && !useTools && mode === "chat") {
        timeline(`vision via ${base.model} …`);
        const body = await streamOrNot(text + textCtx, media.payload, base, stream);
        if (stopFlag) timeline("stopped.");
        return;
      }
      if (!useTools || mode === "compare" || mode === "pipeline") {
        const body = await streamOrNot(messages, null, base, stream);
        if (stopFlag) timeline("stopped.");
        return;
      }
      // Agent loop
      const tools = T().schemaForChat(withSearch);
      let steps = 0;
      for (;;) {
        if (stopFlag) { timeline("stopped."); return; }
        if (++steps > 6) { timeline("tool budget (6) reached — answering with what I have."); break; }
        timeline(`thinking (step ${steps}, ${base.model})…`);
        const resp = await puter.ai.chat(messages, { ...base, tools });
        const calls = M().toolCallsOf(resp);
        // Streaming-style tool chunks can also appear; normalize defensively:
        if (!calls.length && resp && resp.type === "tool_use") calls.push(resp);
        if (!calls.length) {
          const finalText = M().extractText(resp);
          messages.push({ role: "assistant", content: finalText });
          const body = addMsg("assistant", md(finalText), finalText);
          void body;
          return;
        }
        // Execute tool calls (sequential for clarity)
        messages.push(toAssistantMsg(resp));
        for (const c of calls) {
          const name = c.function ? c.function.name : c.name;
          let args = {};
          try { args = JSON.parse(c.function ? c.function.arguments : JSON.stringify(c.input || {})); } catch {}
          if (withSearch && name === undefined && c.type === "web_search") continue;
          const ok = await confirmTool(name, args);
          if (!ok) {
            messages.push({ role: "tool", tool_call_id: c.id || c.tool_call_id, content: "User denied this tool call." });
            timeline(`denied ${name}`);
            continue;
          }
          const tick = timeline(`⚙ ${name} …`);
          try {
            const out = await T().execute(name, args, {
              onImage: (img, p) => { const o = document.getElementById("imgOut"); o.prepend(img); timeline("image shown in Image tab"); window.PuterUI.toast("Image ready — see Image tab", "ok"); },
              onAudio: (a) => { const o = document.getElementById("ttsOut"); o.innerHTML = ""; a.setAttribute("controls", ""); o.appendChild(a); a.play().catch(() => {}); window.PuterUI.toast("Playing audio", "ok"); },
              onPreview: (html, title) => { window.PuterSandbox.render(html, title); window.PuterUI.toast("Preview rendered below", "ok"); },
            });
            messages.push({ role: "tool", tool_call_id: c.id || c.tool_call_id, content: String(out).slice(0, 12000) });
            tick.textContent = `⚙ ${name} — done`;
          } catch (e) {
            messages.push({ role: "tool", tool_call_id: c.id || c.tool_call_id, content: "Tool error: " + (e && e.message || e) });
            tick.textContent = `⚙ ${name} — error: ${(e && e.message) || e}`;
          }
        }
      }
      // Final answer streamed
      timeline("writing final answer…");
      const last = await puter.ai.chat(messages, { ...base, stream });
      if (stream && last && typeof last[Symbol.asyncIterator] === "function") {
        const body = addMsg("assistant", "", "");
        body.classList.add("streaming");
        let full = "";
        for await (const part of last) {
          if (stopFlag) break;
          if (part && part.text) { full += part.text; body.innerHTML = md(full); }
        }
        body.classList.remove("streaming");
        window.PuterSessions && window.PuterSessions.note("assistant", full);
      } else {
        const finalText = M().extractText(last);
        addMsg("assistant", md(finalText), finalText);
      }
    } catch (e) {
      addMsg("assistant", window.PuterUI.errorCard(e, (typeof base !== "undefined" && base.model) || el("modelSelect").value));
      window.PuterUI.toast("Request failed — see error card", "err");
    } finally {
      el("btnStop").disabled = true;
    }
  }

  function toAssistantMsg(resp) {
    // Keep provider message verbatim when possible so tool_ids line up.
    if (resp && resp.message && resp.message.role) return resp.message;
    return { role: "assistant", content: M().extractText(resp) };
  }

  async function streamOrNot(promptOrMsgs, mediaPayload, base, stream) {
    const body = addMsg("assistant", "", "");
    body.classList.add("streaming");
    const done = () => body.classList.remove("streaming");
    if (stream) {
      try {
        const call = mediaPayload
          ? puter.ai.chat(typeof promptOrMsgs === "string" ? promptOrMsgs : M().extractText({ message: { content: "[vision]" } }), mediaPayload, false, { ...base, stream: true })
          : puter.ai.chat(promptOrMsgs, { ...base, stream: true });
        const resp = await call;
        if (resp && typeof resp[Symbol.asyncIterator] === "function") {
          let full = "";
          for await (const part of resp) {
            if (stopFlag) break;
            const t = part && (part.text != null ? part.text : part?.reasoning);
            if (t) { full += t; body.innerHTML = md(full); }
          }
          window.PuterSessions && window.PuterSessions.note("assistant", full);
          done();
          return body;
        }
      } catch (e) {
        body.innerHTML = `<b>Stream failed, retrying non-stream:</b> ${escapeHtml(e.message || e)}`;
      }
    }
    const resp = mediaPayload
      ? await puter.ai.chat(typeof promptOrMsgs === "string" ? promptOrMsgs : "Describe this.", mediaPayload, false, base)
      : await puter.ai.chat(promptOrMsgs, base);
    const text = M().extractText(resp);
    body.innerHTML = md(text);
    window.PuterSessions && window.PuterSessions.note("assistant", text);
    done();
    return body;
  }

  window.PuterAgent = { send, stop, timeline, addMsg, opts, escapeHtml, md };
})();
