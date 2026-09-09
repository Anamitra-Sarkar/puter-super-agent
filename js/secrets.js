/* Secrets vault (Manus-style): browser-local only, never leaves except into agent tool calls you approve. */
(function () {
  const KEY = "spa_secrets_v1";
  let vault = {};

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (raw && typeof raw === "object") vault = raw;
    } catch {}
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(vault)); } catch {}
  }
  function names() { return Object.keys(vault).sort(); }
  function get(name) { return vault[name]; }
  function set(name, value) {
    name = String(name || "").trim().slice(0, 64);
    if (!name) return;
    vault[name] = String(value || "");
    save(); render();
  }
  function remove(name) { delete vault[name]; save(); render(); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function render() {
    const box = document.getElementById("secretList");
    if (!box) return;
    box.innerHTML = "";
    const list = names();
    if (!list.length) {
      box.innerHTML = '<div class="muted small" style="padding:8px">No secrets yet. Add API keys here so the agent can verify builds with real credentials.<br>Stored <b>only in this browser</b> — never in the repo or cloud.</div>';
    }
    for (const n of list) {
      const v = vault[n] || "";
      const d = document.createElement("div");
      d.className = "secret-row";
      d.innerHTML = `<code>${esc(n)}</code><span class="muted">••••${esc(v.slice(-4))}</span><span class="spacer"></span>
        <button class="btn sm ghost" data-act="show">show</button>
        <button class="btn sm ghost" data-act="del">✕</button>`;
      const [showBtn, delBtn] = d.querySelectorAll("button");
      showBtn.onclick = () => window.PuterUI.confirmModal("Secret: " + n, v || "(empty)", "Close").catch(() => {});
      delBtn.onclick = () => { remove(n); window.PuterUI.toast("Deleted " + n, "info"); };
      box.appendChild(d);
    }
  }
  function addFromInputs() {
    const n = document.getElementById("secretName");
    const v = document.getElementById("secretValue");
    if (!n || !n.value.trim()) { window.PuterUI.toast("Name the secret first", "err"); return; }
    set(n.value, v ? v.value : "");
    n.value = "";
    if (v) v.value = "";
    window.PuterUI.toast("Secret saved in this browser", "ok");
  }
  load();
  window.PuterSecrets = { names, get, set, remove, render, addFromInputs };
})();
