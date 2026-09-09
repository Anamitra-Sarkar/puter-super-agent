/* Cloud continuity (honest edition): checkpoint tasks to Puter KV so any reopen
 * resumes; queue messages while offline and flush on reconnect. Workers only run
 * when called — nothing executes while every device is off; resume is instant. */
(function () {
  const OUTBOX = "spa_outbox_v1";

  function toast(m, k) { if (window.PuterUI) window.PuterUI.toast(m, k); }

  async function checkpointStart(text, model) {
    try {
      await puter.kv.set("cloud_last", JSON.stringify({ text: String(text || "").slice(0, 2000), model: model || "", at: Date.now(), done: false }));
    } catch {}
  }
  async function checkpointDone() {
    try {
      const raw = await puter.kv.get("cloud_last");
      if (!raw) return;
      const o = typeof raw === "string" ? JSON.parse(raw) : raw;
      o.done = true;
      await puter.kv.set("cloud_last", JSON.stringify(o));
    } catch {}
  }
  async function checkResume() {
    let last = null;
    try {
      const raw = await puter.kv.get("cloud_last");
      last = raw && (typeof raw === "string" ? JSON.parse(raw) : raw);
    } catch {}
    if (!last || last.done || !last.text) return;
    if (Date.now() - (last.at || 0) > 7 * 24 * 3600 * 1000) return;
    const turns = window.PuterSessions ? window.PuterSessions.getTurns() : [];
    const answered = turns.some((t) => t.role === "assistant" && (t.at || 0) > (last.at || 0));
    if (answered) { checkpointDone(); return; }
    const go = await window.PuterUI.confirmModal("Resume last task?",
      `Before the app closed, this was still running:\n\n"${last.text.slice(0, 300)}"\n\nResume it now?`, "Resume");
    if (go) {
      const inp = document.getElementById("userInput");
      inp.value = last.text;
      document.getElementById("btnSend").click();
    } else checkpointDone();
  }

  function outbox() {
    try { return JSON.parse(localStorage.getItem(OUTBOX) || "[]"); } catch { return []; }
  }
  function stash(text) {
    const box = outbox();
    box.push({ text, at: Date.now() });
    try { localStorage.setItem(OUTBOX, JSON.stringify(box).slice(0, 60000)); } catch {}
  }
  async function flush() {
    const box = outbox();
    if (!box.length || !navigator.onLine) return;
    try { localStorage.setItem(OUTBOX, "[]"); } catch {}
    for (const m of box.slice(0, 5)) {
      toast("Sending queued message…", "info");
      const inp = document.getElementById("userInput");
      inp.value = m.text;
      document.getElementById("btnSend").click();
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (box.length > 5) {
      try { localStorage.setItem(OUTBOX, JSON.stringify(box.slice(5))); } catch {}
    }
  }

  window.addEventListener("online", () => { toast("Back online — flushing queue", "ok"); flush(); });
  window.addEventListener("offline", () => toast("Offline — messages will queue on this device", "err"));

  window.PuterCloud = { checkpointStart, checkpointDone, checkResume, stash, flush };
})();
