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

  // Cost tiers drive the $ labels and the cheap-first default (avoids 402s).
  const COST = {
    "gpt-6-astra": "$$$", "gpt-6-astra-pro": "$$$",
    "gpt-5.6-sol": "$$", "gpt-5.6-sol-pro": "$$",
    "gpt-5.6-terra": "$", "gpt-5.6-terra-pro": "$",
    "gpt-5.6-luna": "$", "gpt-5.6-luna-pro": "$",
    "gpt-5.5": "$$", "gpt-5.5-pro": "$$$",
    "gpt-5.4": "$", "gpt-5.4-mini": "$", "gpt-5.4-nano": "$", "gpt-5.4-pro": "$$",
    "gpt-5.2": "$", "openai/gpt-5.3-codex": "$$", "openai/gpt-oss-120b": "$",
    "claude-fable-5-1": "$$$", "claude-fable-5": "$$$",
    "claude-opus-5": "$$$", "claude-opus-5-fast": "$$$",
    "claude-sonnet-5": "$$",
    "claude-opus-4-8": "$$$", "claude-opus-4.8-fast": "$$$", "claude-opus-4-7": "$$$",
    "claude-sonnet-4-6": "$$", "claude-opus-4-6": "$$$",
    "claude-opus-4-5": "$$$", "claude-sonnet-4-5": "$$",
    "claude-haiku-4-5": "$", "claude-opus-4": "$$$", "claude-sonnet-4": "$$",
  };
  // ---- Model families: one card per family, Low/High (+Fast) route to real IDs ----
  // Low = cheapest/smallest sibling (avoids 402s), High = pro/flagship sibling.
  const DEFAULT_MODEL = "gpt-5.4-nano";
  const FAMILIES = [
    { id: "luna", name: "Luna", vendor: "OpenAI", desc: "Fast, cheap everyday work", low: "gpt-5.6-luna", high: "gpt-5.6-luna-pro" },
    { id: "haiku", name: "Haiku", vendor: "Claude", desc: "Fastest, cheapest Claude", single: "claude-haiku-4-5" },
    { id: "gpt54", name: "GPT-5.4", vendor: "OpenAI", desc: "General purpose, nano-cheap to pro", low: "gpt-5.4-nano", high: "gpt-5.4-pro" },
    { id: "terra", name: "Terra", vendor: "OpenAI", desc: "Balanced mid-tier", low: "gpt-5.6-terra", high: "gpt-5.6-terra-pro" },
    { id: "sonnet", name: "Sonnet", vendor: "Claude", desc: "Balanced reasoning + coding", low: "claude-sonnet-4-5", high: "claude-sonnet-5" },
    { id: "sol", name: "Sol", vendor: "OpenAI", desc: "Flagship GPT-5.6", low: "gpt-5.6-sol", high: "gpt-5.6-sol-pro" },
    { id: "gpt55", name: "GPT-5.5", vendor: "OpenAI", desc: "Previous-gen generalist", low: "gpt-5.5", high: "gpt-5.5-pro" },
    { id: "opus", name: "Opus", vendor: "Claude", desc: "Heaviest Claude reasoning", low: "claude-opus-4-8", high: "claude-opus-5", fastLow: "claude-opus-4.8-fast", fastHigh: "claude-opus-5-fast" },
    { id: "astra", name: "Astra", vendor: "OpenAI", desc: "Frontier reasoning + coding + computer use", low: "gpt-6-astra", high: "gpt-6-astra-pro" },
    { id: "fable", name: "Fable", vendor: "Claude", desc: "Multi-step agentic reasoning", low: "claude-fable-5", high: "claude-fable-5-1" },
    { id: "codex", name: "Codex", vendor: "OpenAI", desc: "Code generation specialist", single: "openai/gpt-5.3-codex" },
    { id: "oss", name: "GPT-OSS", vendor: "OpenAI", desc: "Open-source reasoning family", single: "openai/gpt-oss-120b" },
  ];
  const FAM_KEY = "spa_fam";
  function resolveFamily(fid, reasoning, fast) {
    const f = FAMILIES.find((x) => x.id === fid) || FAMILIES[0];
    if (f.single) return f.single;
    if (fast && (f.fastLow || f.fastHigh)) return reasoning === "high" ? (f.fastHigh || f.fastLow) : (f.fastLow || f.fastHigh);
    return reasoning === "high" ? (f.high || f.low) : (f.low || f.high);
  }
  function familyOf(modelId) {
    for (const f of FAMILIES) {
      if (f.single === modelId || f.low === modelId || f.high === modelId || f.fastLow === modelId || f.fastHigh === modelId) return f;
    }
    return null;
  }
  function famState() {
    try {
      const raw = JSON.parse(localStorage.getItem(FAM_KEY) || "{}");
      if (raw && raw.fid) return { fid: raw.fid, reasoning: raw.reasoning === "high" ? "high" : "low", fast: !!raw.fast };
    } catch {}
    return { fid: "luna", reasoning: "low", fast: false };
  }
  function setFamState(s) {
    try { localStorage.setItem(FAM_KEY, JSON.stringify(s)); } catch {}
  }
  function costOf(id) {
    return COST[id] || (/-fast$/.test(id || "") ? "$$$" : "$");
  }

  // Reasoning effort is OpenAI-only per Puter docs (Claude ignores it).
  function supportsEffort(id) {
    return /^(gpt-|openai\/)/i.test(id || "") && !/gpt-oss/i.test(id || "");
  }
  // Only gpt-oss is text-only; every other chat model here is multimodal (vision encoder).
  // OCR (img2txt) is NOT vision — it is a cheap text extractor for scans/PDFs.
  const TEXT_ONLY = [/gpt-oss/i];
  function supportsVision(id) {
    return !TEXT_ONLY.some((re) => re.test(id || ""));
  }
  const VISION_FALLBACK = "gpt-5.6-luna"; // cheap multimodal stand-in when current model is text-only
  // Context windows: exact only where documented (astra 1.05M per OpenAI listing);
  // everything else is a conservative estimate -> always displayed with "~".
  const CONTEXT = { "gpt-6-astra": 1050000, "gpt-6-astra-pro": 1050000 };
  const DEFAULT_WINDOW = 128000;
  function contextWindow(id) {
    return { size: CONTEXT[id] || DEFAULT_WINDOW, exact: !!CONTEXT[id] };
  }

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

  window.PuterModels = { OPENAI_CHAT, CLAUDE, META, optionGroups, describe, extractText, toolCallsOf, liveModelIds, costOf, DEFAULT_MODEL, supportsEffort, supportsVision, VISION_FALLBACK, contextWindow, FAMILIES, resolveFamily, familyOf, famState, setFamState };
})();
