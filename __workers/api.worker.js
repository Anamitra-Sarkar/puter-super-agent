// __workers/api.worker.js — dynamic worker (deploys with the hosted site).
// Served at https://<site>.puter.site/__workers/api/... (puter.site only).
router.get("/health", async () => ({ ok: true, at: Date.now() }));

router.get("/kv/:key", async ({ params }) => ({
  key: params.key,
  value: await me.puter.kv.get("site_" + params.key),
}));

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
