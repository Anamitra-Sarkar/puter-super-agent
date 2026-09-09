/* Manus-style live sandbox preview: renders agent HTML into a sandboxed iframe. */
(function () {
  function render(html, title) {
    const frame = document.getElementById("previewFrame");
    const log = document.getElementById("previewLog");
    const dock = document.getElementById("previewDock");
    if (dock) dock.classList.remove("hidden");
    const doc = String(html).includes("<html")
      ? String(html)
      : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title || "preview")}</title></head><body>${html}</body></html>`;
    // Capture console from inside the iframe via injected shim (same-origin srcdoc).
    const shim = `<script>try{const _l=(...a)=>parent.postMessage({__pvlog:a.map(String).join(" ")},"*");["log","warn","error"].forEach(k=>{const o=console[k].bind(console);console[k]=(...a)=>{o(...a);_l("["+k+"]",...a);};});window.onerror=(m)=>_l("[error]",m);}catch(e){}<\/script>`;
    frame.srcdoc = doc.replace(/<head[^>]*>/i, (m) => m + shim);
    if (log) log.textContent = `[preview] rendered${title ? ": " + title : ""} @ ${new Date().toLocaleTimeString()}\n` + log.textContent;
    document.getElementById("previewDock").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function clear() {
    document.getElementById("previewFrame").removeAttribute("srcdoc");
    document.getElementById("previewFrame").src = "about:blank";
    document.getElementById("previewLog").textContent = "";
    const dock = document.getElementById("previewDock");
    if (dock) dock.classList.add("hidden");
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  window.addEventListener("message", (ev) => {
    if (ev.data && ev.data.__pvlog !== undefined) {
      const log = document.getElementById("previewLog");
      if (log) log.textContent += ev.data.__pvlog + "\n";
    }
  });
  window.PuterSandbox = { render, clear };
})();
