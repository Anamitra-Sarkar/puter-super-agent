/* Live token accounting: server usage when present, char/4 estimate while streaming. */
(function () {
  function est(text) { return Math.ceil(String(text || "").length / 4); }
  function estMessages(messages) {
    let n = 0;
    for (const m of messages || []) {
      const c = m.content;
      if (typeof c === "string") n += est(c);
      else if (Array.isArray(c)) for (const b of c) n += est(b.text || b.encrypted_content || "");
      n += 4; // role overhead
    }
    return n;
  }
  /** Merge provider usage (either vocabulary) into {in, out}. */
  function readUsage(resp) {
    if (!resp || typeof resp !== "object") return null;
    const u = resp.usage;
    if (!u) return null;
    const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
    const input = num(u.prompt_tokens ?? u.input_tokens);
    const out = num(u.completion_tokens ?? u.output_tokens);
    if (!input && !out) return null;
    return { in: input, out: out, cached: num(u.cached_tokens) };
  }
  function fmt(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  }
  window.PuterTokens = { est, estMessages, readUsage, fmt };
})();
