/* UI primitives: toasts, modal confirm (replaces native confirm()), error cards. */
(function () {
  function toast(msg, kind) {
    const box = document.getElementById("toasts");
    const d = document.createElement("div");
    d.className = "toast " + (kind || "info");
    const icon = kind === "ok" ? "✅ " : kind === "err" ? "⛔ " : "💡 ";
    d.textContent = icon + msg;
    box.appendChild(d);
    setTimeout(() => { d.classList.add("out"); setTimeout(() => d.remove(), 320); }, 4200);
  }

  /** Multi-choice modal. Resolves the index of the clicked button (or -1 on dismiss). */
  function chooseModal(title, bodyText, buttons) {
    return new Promise((resolve) => {
      const wrap = document.getElementById("modalWrap");
      document.getElementById("modalTitle").textContent = title;
      document.getElementById("modalBody").textContent = bodyText;
      const btnRow = wrap.querySelector(".modal-btns");
      const old = btnRow.innerHTML;
      btnRow.innerHTML = "";
      const done = (v) => {
        btnRow.innerHTML = old;
        document.getElementById("modalOk").onclick = null;
        document.getElementById("modalCancel").onclick = null;
        wrap.onclick = null;
        wrap.classList.add("hidden");
        resolve(v);
      };
      (buttons || ["OK"]).forEach((label, i) => {
        const b = document.createElement("button");
        b.className = "btn" + (i === 0 ? " primary" : " ghost");
        b.textContent = label;
        b.onclick = () => done(i);
        btnRow.appendChild(b);
      });
      wrap.classList.remove("hidden");
      wrap.onclick = (e) => { if (e.target === wrap) done(-1); };
    });
  }
  function confirmModal(title, bodyText, okLabel) {
    return new Promise((resolve) => {
      const wrap = document.getElementById("modalWrap");
      document.getElementById("modalTitle").textContent = title;
      document.getElementById("modalBody").textContent = bodyText;
      document.getElementById("modalOk").textContent = okLabel || "Allow";
      wrap.classList.remove("hidden");
      const done = (v) => {
        wrap.classList.add("hidden");
        document.getElementById("modalOk").onclick = null;
        document.getElementById("modalCancel").onclick = null;
        wrap.onclick = null;
        resolve(v);
      };
      document.getElementById("modalOk").onclick = () => done(true);
      document.getElementById("modalCancel").onclick = () => done(false);
      wrap.onclick = (e) => { if (e.target === wrap) done(false); };
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /** Friendly, honest error card for chat. Handles 402 credits + auth specially. */
  function errorCard(e, model) {
    const raw = String((e && e.message) || e || "Unknown error");
    const is402 = /402|insufficient|credits|balance|payment/i.test(raw);
    const isAuth = /auth|sign.?in|unauthorized|401|forbidden|403/i.test(raw) && !is402;
    if (is402) {
      return `<div class="err-card"><h4>💳 Out of credits for “${esc(model)}”</h4>
        <p>Puter routed this request to a paid provider and the available balance couldn't cover it.
        Premium models (Astra Pro, Opus) burn allowance fast.</p>
        <p><b>Fix now:</b> switch to a cheap model — <b>gpt-5.4-nano</b>, <b>gpt-5.6-luna</b> or
        <b>claude-haiku-4-5</b> — and retry. Check your allowance in the account menu.</p>
        <p><button id="retryCheap" class="btn primary sm">⚡ Retry with gpt-5.4-nano</button></p>
        <p class="muted">Details: ${esc(raw.slice(0, 300))}</p></div>`;
    }
    if (isAuth) {
      return `<div class="err-card"><h4>🔑 Sign-in needed</h4>
        <p>Puter's User-Pays model needs you signed in so usage bills to your own allowance, not the developer.</p>
        <p><b>Fix:</b> click <b>Sign in</b> (top-right), allow the popup, then retry.</p>
        <p class="muted">Details: ${esc(raw.slice(0, 300))}</p></div>`;
    }
    return `<div class="err-card"><h4>⚠️ Request failed</h4><p>${esc(raw.slice(0, 600))}</p>
      <p class="muted">Tip: retry once; if it persists, try another model (some vendors have outages).</p></div>`;
  }

  window.PuterUI = { toast, confirmModal, chooseModal, errorCard, esc };
})();
