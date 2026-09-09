/* MEMORY.md: persistent agent memory (Puter KV + local mirror).
 * Re-injected every send so nothing is lost to compaction; auto-updated after work. */
(function () {
  const KV_KEY = "agent_memory_md";
  const LS_KEY = "spa_memory_md";
  const MAX_CHARS = 6000;
  let cache = null;

  function local() {
    try { return localStorage.getItem(LS_KEY) || ""; } catch { return ""; }
  }
  async function load() {
    if (cache !== null) return cache;
    cache = local();
    try {
      const v = await puter.kv.get(KV_KEY);
      if (typeof v === "string" && v) { cache = v; persistLocal(v); }
    } catch {}
    return cache;
  }
  function persistLocal(v) {
    try { localStorage.setItem(LS_KEY, v); } catch {}
  }
  async function save(text) {
    cache = String(text || "").slice(-MAX_CHARS);
    persistLocal(cache);
    try { await puter.kv.set(KV_KEY, cache); } catch {}
    render();
  }
  async function append(entry) {
    const cur = await load();
    const line = `\n- [${new Date().toISOString().slice(0, 16).replace("T", " ")}] ${entry}`.slice(0, 500);
    await save((cur + line).slice(-MAX_CHARS));
  }
  /** Auto-learn from a finished turn: outcomes, files, failures. */
  async function learnFromTurn(userText, assistantText, toolSummaries) {
    const bits = [];
    if (toolSummaries && toolSummaries.length) {
      const files = toolSummaries.filter((t) => t.name === "run_code_preview" && t.args && t.args.path)
        .map((t) => t.args.path);
      const uniq = [...new Set(files)].slice(0, 8);
      if (uniq.length) bits.push(`built/updated files: ${uniq.join(", ")}`);
      const fails = toolSummaries.filter((t) => t.failed).slice(0, 4)
        .map((t) => `${t.name} failed (${String(t.note || "").slice(0, 120)})`);
      if (fails.length) bits.push(`FAILED (do not blindly retry same way): ${fails.join("; ")}`);
      const denied = toolSummaries.filter((t) => t.denied).map((t) => t.name);
      if (denied.length) bits.push(`user denied tools: ${[...new Set(denied)].join(", ")}`);
    }
    const u = String(userText || "").slice(0, 160);
    if (!bits.length && !u) return;
    await append(`task "${u}" → ${bits.join(" | ") || "answered"}`);
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function render() {
    const view = document.getElementById("memoryView");
    if (view && document.activeElement !== view) view.value = cache !== null ? cache : local();
    const hint = document.getElementById("memoryMeta");
    if (hint) hint.textContent = `~${Math.ceil(((cache !== null ? cache : local()) || "").length / 4)} tokens · auto-saved after each task · survives compaction`;
  }
  window.PuterMemory = { load, save, append, learnFromTurn, render, get: () => cache !== null ? cache : local() };
})();
