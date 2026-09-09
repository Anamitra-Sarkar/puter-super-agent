/* Deploy: Puter Hosting (static) + dynamic worker health check. */
(function () {
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  async function deploy() {
    const out = el("deployOut");
    const sub = el("deploySub").value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const dir = el("deployDir").value.trim() || "super-agent-site";
    if (!sub) { out.textContent = "Enter a subdomain first."; return; }
    out.textContent = "Deploying…";
    try {
      try { await puter.fs.mkdir(dir); } catch {}
      try { await puter.fs.mkdir(dir + "/__workers"); } catch {}
      // Snapshot: copy this app's key files is not possible cross-origin; write a landing page instead.
      const landing = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(sub)}</title></head><body style="font-family:system-ui;max-width:640px;margin:40px auto"><h1>Deployed via Puter Super-Agent ✅</h1><p>Subdomain <b>${esc(sub)}.puter.site</b> is live. Worker: <a href="/__workers/api/health">/__workers/api/health</a></p><p>Powered by <a href="https://developer.puter.com">Puter</a></p></body></html>`;
      await puter.fs.write(`${dir}/index.html`, landing);
      await puter.fs.write(`${dir}/__workers/api.worker.js`, WORKER_SRC);
      let site;
      try {
        site = await puter.hosting.create(sub, dir);
      } catch (e) {
        if (/taken|exists|already/i.test(e.message || "")) {
          await puter.hosting.update(sub, dir);
          site = { subdomain: sub };
        } else throw e;
      }
      const url = `https://${site.subdomain}.puter.site`;
      out.innerHTML = `Live: <a href="${url}" target="_blank" rel="noopener">${url}</a><br>Worker: <a href="${url}/__workers/api/health" target="_blank" rel="noopener">${url}/__workers/api/health</a>`;
      window.PuterUI.toast("Deployed to " + url, "ok");
    } catch (e) { out.innerHTML = "<b>Deploy failed:</b> " + esc(e.message || e); window.PuterUI.toast("Deploy failed", "err"); }
  }

  async function workerHealth() {
    const out = el("deployOut");
    const sub = el("deploySub").value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!sub) { out.textContent = "Enter the deployed subdomain first."; return; }
    out.textContent = "Checking worker…";
    try {
      const r = await fetch(`https://${sub}.puter.site/__workers/api/health`);
      const body = (await r.text()).slice(0, 2000);
      out.textContent = `GET /__workers/api/health → ${r.status}\n` + body;
      window.PuterUI.toast(r.ok ? "Worker is healthy" : "Worker returned " + r.status, r.ok ? "ok" : "err");
    } catch (e) { out.textContent = "Worker check failed: " + (e.message || e); window.PuterUI.toast("Worker check failed", "err"); }
  }

  const WORKER_SRC = `router.get("/health", async () => ({ ok: true, at: Date.now() }));
router.get("/kv/:key", async ({ params }) => ({ key: params.key, value: await me.puter.kv.get("site_" + params.key) }));
router.post("/kv", async ({ request }) => {
  const { key, value } = await request.json();
  if (!key) return new Response(JSON.stringify({ error: "key required" }), { status: 400 });
  await me.puter.kv.set("site_" + key, value);
  return { saved: true, key };
});
router.get("/fetch", async ({ request }) => {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return new Response(JSON.stringify({ error: "url required" }), { status: 400 });
  const r = await me.puter.net.fetch(url);
  return new Response(await r.text(), { headers: { "Content-Type": "text/plain" } });
});
`;

  window.PuterDeploy = { deploy, workerHealth, WORKER_SRC };
})();
