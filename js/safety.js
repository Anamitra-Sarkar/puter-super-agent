/* Safety + honesty: spend estimates, budget guard, topic disclaimers. */
(function () {
  const BUDGET_KEY = "spa_budget_tok";
  const SPENT_KEY = "spa_spent_mo"; // {month:"2026-09", used:12345}

  function budgetCap() {
    try { return parseInt(localStorage.getItem(BUDGET_KEY) || "", 10) || 0; } catch { return 0; }
  }
  function setBudgetCap(n) {
    try { localStorage.setItem(BUDGET_KEY, String(n > 0 ? n : "")); } catch {}
  }
  function spentMonth() {
    const mo = new Date().toISOString().slice(0, 7);
    try {
      const raw = JSON.parse(localStorage.getItem(SPENT_KEY) || "{}");
      if (raw.month !== mo) return { month: mo, used: 0 };
      return raw;
    } catch { return { month: mo, used: 0 }; }
  }
  function addSpent(n) {
    const s = spentMonth();
    s.used += n;
    try { localStorage.setItem(SPENT_KEY, JSON.stringify(s)); } catch {}
    checkBudget(s);
  }
  function checkBudget(s) {
    const cap = budgetCap();
    if (!cap) return "none";
    const pct = s.used / cap;
    if (pct >= 1) {
      window.PuterUI.confirmModal("Monthly budget reached",
        `You've used ~${Math.round(s.used).toLocaleString()} of your ${cap.toLocaleString()} token budget this month. ` +
        `Further AI calls will keep spending your allowance. Raise the cap in Settings to continue quietly.`,
        "I understand");
      return "hit";
    }
    if (pct >= 0.8 && !checkBudget._w80) {
      checkBudget._w80 = true;
      window.PuterUI.toast(`80% of monthly token budget used (~${Math.round(s.used).toLocaleString()})`, "err");
      return "warn";
    }
    return "ok";
  }
  /** Non-blocking pre-flight note for pricey calls. Returns true always (warns, never blocks). */
  function spendNote(kind) {
    const msgs = {
      video: "🎬 Video generation takes minutes and is one of the priciest calls — start with a short simple prompt.",
      image: "🎨 Image generation costs more than chat — low quality is cheapest.",
      premium: "💎 Premium model selected — burns allowance much faster than Luna/Nano. Switch to Low if this is routine.",
    };
    if (msgs[kind] && !spendNote["seen_" + kind]) {
      spendNote["seen_" + kind] = true;
      window.PuterAgent.timeline(msgs[kind]);
    }
    return true;
  }
  const SENSITIVE = [
    { re: /\b(doctor|diagnos|disease|symptom|medicine|dosage|treatment|therapy|cancer|diabet|pregnan|mental health|depress|anxiety)\b/i, label: "health" },
    { re: /\b(lawyer|lawsuit|sue|court|legal advice|contract|divorce|custody|arrest|bail)\b/i, label: "legal" },
    { re: /\b(invest|stocks|trading|crypto|loan|mortgage|tax filing|insurance claim|retirement fund)\b/i, label: "money" },
  ];
  function disclaimerFor(text) {
    const t = String(text || "");
    const hit = SENSITIVE.find((s) => s.re.test(t));
    if (!hit) return "";
    return `<div class="notice">⚕️ <b>Heads-up:</b> this touches on ${hit.label} topics. I'm an AI, not a ${hit.label === "health" ? "doctor" : hit.label === "legal" ? "lawyer" : "financial adviser"} — consider a qualified professional for important decisions. <span class="muted">Why am I seeing this? → automatic topic notice, not a judgment.</span></div>`;
  }
  window.PuterSafety = { budgetCap, setBudgetCap, spentMonth, addSpent, spendNote, disclaimerFor };
})();
