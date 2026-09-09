/* Model catalog: all OpenAI + Claude models available via Puter.js (User-Pays, no keys).
 * Plus live refresh via puter.ai.listModels(). */
(function () {
  const OPENAI_CHAT = [
    ["gpt-6-astra", "flagship reasoning/coding, newest, most expensive"],
    ["gpt-6-astra-pro", "astra pro-reasoning variant, same context/pricing"],
    ["gpt-5.6-sol", "GPT-5.6 flagship"],
    ["gpt-5.6-sol-pro", "sol pro-reasoning, same price as base"],
    ["gpt-5.6-terra", "GPT-5.6 mid-tier"],
    ["gpt-5.6-terra-pro", "terra pro-reasoning, same price"],
    ["gpt-5.6-luna", "GPT-5.6 smallest/cheapest"],
    ["gpt-5.6-luna-pro", "luna pro-reasoning, same price"],
    ["gpt-5.5", "previous-gen general"],
    ["gpt-5.5-pro", "previous-gen pro reasoning"],
    ["gpt-5.4", "general"],
    ["gpt-5.4-mini", "fast/cheap general"],
    ["gpt-5.4-nano", "fastest/cheapest text"],
    ["gpt-5.4-pro", "pro reasoning"],
    ["gpt-5.2", "older general"],
    ["openai/gpt-5.3-codex", "code generation specialist"],
    ["openai/gpt-oss-120b", "open-source reasoning family"],
  ];
  const CLAUDE = [
    ["claude-fable-5-1", "most capable: multi-step reasoning/agents"],
    ["claude-fable-5", "fable reasoning"],
    ["claude-opus-5", "opus flagship"],
    ["claude-opus-5-fast", "opus 2.5x faster, 2x price"],
    ["claude-sonnet-5", "balanced sonnet"],
    ["claude-opus-4-8", "opus 4.8"],
    ["claude-opus-4.8-fast", "opus 4.8 fast"],
    ["claude-opus-4-7", "opus 4.7"],
    ["claude-sonnet-4-6", "sonnet 4.6"],
    ["claude-opus-4-6", "opus 4.6"],
    ["claude-opus-4-5", "opus 4.5"],
    ["claude-sonnet-4-5", "sonnet 4.5"],
    ["claude-haiku-4-5", "fastest/cheapest claude"],
    ["claude-opus-4", "opus 4"],
    ["claude-sonnet-4", "sonnet 4"],
  ];
  const META = {};
  OPENAI_CHAT.forEach(([id, d]) => (META[id] = { vendor: "OpenAI", desc: d }));
  CLAUDE.forEach(([id, d]) => (META[id] = { vendor: "Claude", desc: d }));

  function optionGroups() {
    return [
      { label: "OpenAI", ids: OPENAI_CHAT.map((x) => x[0]) },
      { label: "Claude", ids: CLAUDE.map((x) => x[0]) },
    ];
  }

  function describe(id) {
    return META[id] || { vendor: "?", desc: "" };
  }

  /** Extract text from any puter.ai.chat non-stream response shape. */
  function extractText(resp) {
    if (resp == null) return "";
    if (typeof resp === "string") return resp;
    if (typeof resp.text === "string" && resp.message === undefined) return resp.text;
    const msg = resp.message || resp;
    const c = msg.content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) {
      return c.map((b) => (typeof b === "string" ? b : b.text || "")).join("");
    }
    if (typeof msg.text === "string") return msg.text;
    return String(resp);
  }

  function toolCallsOf(resp) {
    const msg = (resp && resp.message) || {};
    return msg.tool_calls || msg.toolCalls || [];
  }

  async function liveModelIds() {
    try {
      const list = await puter.ai.listModels();
      if (Array.isArray(list)) {
        return list.map((m) => (typeof m === "string" ? m : m.id || m.name)).filter(Boolean);
      }
      return [];
    } catch {
      return [];
    }
  }

  window.PuterModels = { OPENAI_CHAT, CLAUDE, META, optionGroups, describe, extractText, toolCallsOf, liveModelIds };
})();
