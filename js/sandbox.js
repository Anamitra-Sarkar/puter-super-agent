/* Sandbox preview + verify engine: console/overflow/interaction/security checks,
 * screenshot → vision design review. Report feeds back to the agent so it fixes issues. */
(function () {
  let lastHtml = "";
  let consoleErrors = [];

  const DESIGN_TASTE = `You are a senior product designer doing a ruthless visual review of a UI screenshot.
Hate list (call these out hard): purple/blue linear gradients; generic "AI slop" (glassy purple cards, neon glows, robot emojis, lorem ipsum, "Lorem", "Delve", "Unlock the power"); tiny gray-on-gray text; cramped spacing; default unstyled buttons; centered everything; stock-looking hero with floating blobs; more than 2 font families; pure black backgrounds with neon accents.
Love list: warm paper/cream or clean white surfaces, ONE confident accent color, generous whitespace, clear hierarchy, real-feeling copy, consistent 8pt rhythm, tasteful borders/shadows, readable contrast (4.5:1+), responsive behavior.
Reply in 6 bullets max: 3 biggest visual problems with concrete fixes, then a 1-10 score. Be blunt, no flattery.`;

  function render(html, title) {
    lastHtml = String(html);
    consoleErrors = [];
    const frame = document.getElementById("previewFrame");
    const log = document.getElementById("previewLog");
    const dock = document.getElementById("previewDock");
    if (dock) dock.classList.remove("hidden");
    const doc = lastHtml.includes("<html")
      ? lastHtml
      : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title || "preview")}</title></head><body>${lastHtml}</body></html>`;
    const shim = `<script>try{const _l=(...a)=>parent.postMessage({__pvlog:a.map(String).join(" ")},"*");["log","warn","error"].forEach(k=>{const o=console[k].bind(console);console[k]=(...a)=>{o(...a);_l("["+k+"]",...a);};});window.onerror=(m)=>_l("[error]",m);}catch(e){}<\/script>`;
    frame.srcdoc = doc.replace(/<head[^>]*>/i, (m) => m + shim);
    if (log) log.textContent = `[preview] rendered${title ? ": " + title : ""} @ ${new Date().toLocaleTimeString()}\n` + log.textContent;
    const dd = document.getElementById("previewDock");
    if (dd && dd.scrollIntoView) dd.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function clear() {
    document.getElementById("previewFrame").removeAttribute("srcdoc");
    document.getElementById("previewFrame").src = "about:blank";
    document.getElementById("previewLog").textContent = "";
    lastHtml = "";
    consoleErrors = [];
    const dock = document.getElementById("previewDock");
    if (dock) dock.classList.add("hidden");
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  window.addEventListener("message", (ev) => {
    if (ev.data && ev.data.__pvlog !== undefined) {
      const msg = String(ev.data.__pvlog);
      if (/^\[(error|warn)\]/.test(msg) && !consoleErrors.includes(msg)) consoleErrors.push(msg);
      const log = document.getElementById("previewLog");
      if (log) log.textContent += msg + "\n";
    }
  });

  function doc() {
    try { return document.getElementById("previewFrame").contentDocument; } catch { return null; }
  }
  function securityScan(src) {
    const hits = [];
    const pats = [
      [/sk-[A-Za-z0-9]{10,}/, "possible OpenAI key in code"],
      [/ghp_[A-Za-z0-9]{10,}/, "possible GitHub token in code"],
      [/AKIA[0-9A-Z]{16}/, "possible AWS key in code"],
      [/http:\/\/(?!localhost|127\.0\.0\.1)/, "insecure http:// URL (mixed content)"],
      [/\beval\s*\(/, "eval() usage"],
      [/document\.write\s*\(/, "document.write usage"],
    ];
    for (const [re, label] of pats) if (re.test(src)) hits.push(label);
    return hits;
  }
  async function interactionSweep(d) {
    let clicked = 0;
    const before = consoleErrors.length;
    try {
      const els = [...d.querySelectorAll("button, a[href], input[type=submit]")].slice(0, 20);
      for (const b of els) {
        try { b.click(); clicked++; } catch {}
        await new Promise((r) => setTimeout(r, 120));
      }
    } catch {}
    return { clicked, newErrors: consoleErrors.slice(before) };
  }
  async function responsiveCheck(frame, d) {
    const out = [];
    const prev = frame.style.width;
    for (const w of [375, 768, 1440]) {
      frame.style.width = w + "px";
      await new Promise((r) => setTimeout(r, 250));
      try {
        const de = d.documentElement;
        if (de.scrollWidth > de.clientWidth + 2) out.push(`${w}px: horizontal overflow (${de.scrollWidth}px)`);
      } catch {}
    }
    frame.style.width = prev;
    return out;
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-cdn="${src}"]`)) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.dataset.cdn = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("CDN blocked: " + src));
      document.head.appendChild(s);
    });
  }
  async function snapshot() {
    const frame = document.getElementById("previewFrame");
    const d = doc();
    if (!d || !d.body) return null;
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
      const canvas = await window.html2canvas(d.body, { backgroundColor: "#ffffff", scale: 0.6, logging: false });
      return canvas.toDataURL("image/jpeg", 0.72);
    } catch {
      return null;
    }
  }
  async function designReview(dataURL, model) {
    const m = window.PuterModels.supportsVision(model) ? model : window.PuterModels.VISION_FALLBACK;
    try {
      const resp = await puter.ai.chat(DESIGN_TASTE + "\n\nReview this UI screenshot.", dataURL, false, { model: m, normalize: true });
      return window.PuterModels.extractText(resp) + (m !== model ? `\n(reviewed with ${m} — ${model} is text-only)` : "");
    } catch (e) {
      return "visual review skipped: " + (e.message || e);
    }
  }
  /** Full verify pass. Returns a markdown report for the agent to act on. */
  async function verify(model) {
    const frame = document.getElementById("previewFrame");
    const d = doc();
    const lines = ["## Verify report (automated) — fix every issue, then re-preview"];
    if (!d || !d.body || !d.body.innerText.trim()) {
      lines.push("- ❌ preview renders EMPTY. Fix: output real visible content.");
      return lines.join("\n");
    }
    lines.push("- ✅ preview renders non-empty content");
    if (consoleErrors.length) lines.push("- ❌ console errors:\n  " + consoleErrors.slice(0, 8).join("\n  "));
    else lines.push("- ✅ zero console errors/warnings");
    const over = await responsiveCheck(frame, d);
    if (over.length) lines.push("- ❌ responsive issues:\n  " + over.join("\n  "));
    else lines.push("- ✅ no horizontal overflow at 375 / 768 / 1440px");
    const sweep = await interactionSweep(d);
    lines.push(`- ✅ interaction sweep: clicked ${sweep.clicked} controls` +
      (sweep.newErrors.length ? `\n- ❌ errors after clicking:\n  ${sweep.newErrors.slice(0, 6).join("\n  ")}` : " with no new errors"));
    const sec = securityScan(lastHtml);
    if (sec.length) lines.push("- ❌ SECURITY (must fix before shipping):\n  " + sec.join("\n  "));
    else lines.push("- ✅ no secrets / mixed-content / eval issues found");
    const shot = await snapshot();
    if (shot) {
      lines.push("- 📸 screenshot captured — vision review:");
      lines.push(await designReview(shot, model || "gpt-5.6-luna"));
    } else lines.push("- ⚠️ screenshot unavailable (CDN blocked) — visual review skipped");
    lines.push("If anything above is ❌: fix the code, call run_code_preview again, and repeat until all ✅.");
    return lines.join("\n");
  }

  window.PuterSandbox = { render, clear, verify, snapshot, DESIGN_TASTE, getLastHtml: () => lastHtml };
})();
