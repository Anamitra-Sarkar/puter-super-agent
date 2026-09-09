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

// ---- Task outbox: checkpoint long work in the cloud so any device can resume.
// Honest scope: workers only run when called (no cron) — this stores task state
// durably; the app (or any pinger hitting these endpoints) drives progress.
router.post("/tasks", async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const id = "t" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const task = {
    id,
    kind: String(body.kind || "chat").slice(0, 20),
    text: String(body.text || "").slice(0, 4000),
    model: String(body.model || "").slice(0, 80),
    status: "queued",
    progress: "",
    result: "",
    created: Date.now(),
    updated: Date.now(),
  };
  await me.puter.kv.set("task_" + id, JSON.stringify(task));
  return task;
});
router.get("/tasks/:id", async ({ params }) => {
  const raw = await me.puter.kv.get("task_" + params.id);
  if (!raw) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  return JSON.parse(raw);
});
router.post("/tasks/:id/advance", async ({ request, params }) => {
  const raw = await me.puter.kv.get("task_" + params.id);
  if (!raw) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  const task = JSON.parse(raw);
  const body = await request.json().catch(() => ({}));
  if (body.status) task.status = String(body.status).slice(0, 20);
  if (body.progress !== undefined) task.progress = String(body.progress).slice(0, 2000);
  if (body.result !== undefined) task.result = String(body.result).slice(0, 20000);
  task.updated = Date.now();
  await me.puter.kv.set("task_" + params.id, JSON.stringify(task));
  return task;
});
