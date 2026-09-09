/* Swarm: parallel compare + planner/builder/critic pipeline, rendered into chat. */
(function () {
  const DEFAULT_TEAM = ["gpt-5.6-sol", "claude-sonnet-5", "gpt-6-astra"];
  const AGG = "gpt-5.6-luna";

  function md(t) { try { if (window.marked) return marked.parse(String(t)); } catch {} return String(t); }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function baseOpts() {
    const o = { normalize: true };
    const tEl = document.getElementById("temperature");
    const t = tEl ? parseFloat(tEl.value) : NaN;
    if (!Number.isNaN(t)) o.temperature = t;
    return o;
  }
  function promptOf(p) {
    if (p && p.trim()) return p.trim();
    const u = document.getElementById("userInput");
    return u ? u.value.trim() : "";
  }

  async function runCompare(promptText) {
    const prompt = promptOf(promptText);
    if (!prompt) return window.PuterUI.toast("Usage: /swarm <question>", "info");
    window.PuterAgent.addMsg("user", "🌀 <b>/swarm</b> " + esc(prompt));
    const body = window.PuterAgent.addMsg("assistant", "🌀 <i>asking 3 models in parallel…</i>");
    const t0 = Date.now();
    const state = Object.fromEntries(DEFAULT_TEAM.map((m) => [m, null]));
    const paint = () => {
      body.innerHTML = DEFAULT_TEAM.map((m) =>
        `<details open><summary><b>${esc(m)}</b> ${state[m] === null ? "… <i>thinking</i>" : state[m].error ? "— failed" : "✓"}</summary>` +
        (state[m] === null ? "" : state[m].error ? `<i>${esc(state[m].error)}</i>` : md(state[m].text.slice(0, 3000))) +
        `</details>`).join("");
    };
    await Promise.all(DEFAULT_TEAM.map(async (model) => {
      try {
        const resp = await puter.ai.chat(prompt, { ...baseOpts(), model, stream: true });
        let full = "";
        for await (const part of resp) { if (part && part.text) full += part.text; }
        state[model] = { text: full };
      } catch (e) { state[model] = { text: "", error: String((e && e.message) || e).slice(0, 300) }; }
      paint();
    }));
    paint();
    window.PuterAgent.timeline(`swarm done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    const ok = DEFAULT_TEAM.map((m) => ({ model: m, ...state[m] })).filter((r) => r.text);
    if (ok.length >= 2) {
      window.PuterAgent.timeline("synthesizing best answer…");
      const bundle = ok.map((r) => `--- ${r.model} ---\n${r.text.slice(0, 3500)}`).join("\n\n");
      try {
        const resp = await puter.ai.chat(
          [{ role: "system", content: "Merge the candidate answers into one best answer. Keep agreed facts, resolve conflicts sensibly, keep code runnable." },
           { role: "user", content: `Original question: ${prompt}\n\n${bundle}` }],
          { ...baseOpts(), model: AGG });
        const t = window.PuterModels.extractText(resp);
        body.innerHTML += `<hr><p><b>✨ Synthesized (${AGG})</b></p>` + md(t);
        window.PuterSessions.note("assistant", t);
      } catch (e) {
        body.innerHTML += `<p><i>Synthesis failed: ${esc(e.message || e)}</i></p>`;
      }
    }
    window.PuterUI.toast("Swarm complete", "ok");
  }

  async function runPipeline(promptText) {
    const prompt = promptOf(promptText);
    if (!prompt) return window.PuterUI.toast("Usage: /pipeline <task>", "info");
    window.PuterAgent.addMsg("user", "⛓ <b>/pipeline</b> " + esc(prompt));
    const say = async (model, msgs, label) => {
      window.PuterAgent.timeline(label + " (" + model + ")…");
      const r = await puter.ai.chat(msgs, { ...baseOpts(), model });
      return window.PuterModels.extractText(r);
    };
    try {
      const plan = await say("claude-fable-5-1",
        [{ role: "system", content: "You are the planner. Output a short numbered plan." }, { role: "user", content: prompt }], "📝 planning");
      const build = await say("openai/gpt-5.3-codex",
        [{ role: "system", content: "You are the builder. Follow the plan and produce the deliverable (code must be runnable; if UI, include full HTML)." },
         { role: "user", content: `Task: ${prompt}\n\nPlan:\n${plan}` }], "🔨 building");
      const crit = await say("gpt-5.6-luna",
        [{ role: "system", content: "You are the critic. List concrete issues and fixes, or say APPROVED." },
         { role: "user", content: `Task: ${prompt}\n\nDeliverable:\n${build}` }], "🔍 critiquing");
      let final = build;
      if (!/approved/i.test(crit.slice(0, 200))) {
        const cur = (document.getElementById("modelSelect") || {}).value || "gpt-5.6-sol";
        final = await say(cur,
          [{ role: "system", content: "Revise the deliverable addressing the critique." },
           { role: "user", content: `Task: ${prompt}\n\nDraft:\n${build}\n\nCritique:\n${crit}` }], "✏️ revising");
      }
      const html = `<h4>📝 Plan (fable-5-1)</h4>${md(plan)}<h4>🔨 Build (codex)</h4>${md(build)}<h4>🔍 Critique (luna)</h4>${md(crit)}<h4>✅ Final</h4>${md(final)}`;
      window.PuterAgent.addMsg("assistant", html, `Pipeline result for: ${prompt}\n\n${final.slice(0, 3000)}`);
      if (/<html|<!doctype/i.test(final)) {
        const m = final.match(/```html([\s\S]*?)```/i);
        window.PuterSandbox.render(m ? m[1] : final, "pipeline result");
      }
      window.PuterUI.toast("Pipeline complete", "ok");
    } catch (e) {
      window.PuterAgent.addMsg("assistant", window.PuterUI.errorCard(e, "pipeline"));
    }
  }

  window.PuterSwarm = { runCompare, runPipeline };
})();
