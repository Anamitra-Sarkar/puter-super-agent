/* Swarm: parallel compare fan-out + planner/builder/critic pipeline. */
(function () {
  function el(id) { return document.getElementById(id); }
  function md(t) { try { if (window.marked) return marked.parse(String(t)); } catch {} return String(t); }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function selModels() {
    return [...document.querySelectorAll(".swarm-model:checked")].map((c) => c.value).slice(0, 4);
  }
  function baseOpts() {
    const o = { normalize: true };
    const t = parseFloat(document.getElementById("temperature").value);
    if (!Number.isNaN(t)) o.temperature = t;
    return o;
  }

  async function runCompare() {
    const prompt = el("swarmPrompt").value.trim() || document.getElementById("userInput").value.trim();
    if (!prompt) return alert("Enter a swarm prompt first.");
    const models = selModels();
    if (!models.length) return alert("Pick at least 1 swarm model.");
    const cards = el("swarmCards"); cards.innerHTML = "";
    el("swarmResult").innerHTML = "";
    const t0 = Date.now();
    const jobs = models.map(async (model) => {
      const card = document.createElement("div");
      card.className = "swarm-card";
      card.innerHTML = `<h4>${esc(model)} <span class="muted">…</span></h4><div class="cbody muted">streaming…</div>`;
      cards.appendChild(card);
      const body = card.querySelector(".cbody");
      const head = card.querySelector("h4");
      const start = Date.now();
      try {
        const resp = await puter.ai.chat(prompt, { ...baseOpts(), model, stream: true });
        let full = "";
        for await (const part of resp) {
          if (part && part.text) { full += part.text; body.innerHTML = md(full); }
        }
        head.innerHTML = `${esc(model)} <span class="muted">· ${((Date.now() - start) / 1000).toFixed(1)}s</span>`;
        return { model, text: full };
      } catch (e) {
        body.innerHTML = `<b>Error:</b> ${esc((e && e.message) || e)}`;
        head.innerHTML = `${esc(model)} <span class="muted">· failed</span>`;
        return { model, text: "", error: String((e && e.message) || e) };
      }
    });
    const results = await Promise.all(jobs);
    window.PuterAgent.timeline(`swarm compare done: ${models.join(", ")} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    if (el("swarmSynth").checked) {
      const ok = results.filter((r) => r.text);
      if (ok.length < 2) { el("swarmResult").innerHTML = "<i>Need 2+ good answers to synthesize.</i>"; return; }
      el("swarmResult").innerHTML = "<i>Synthesizing best answer…</i>";
      const agg = el("aggregatorModel").value;
      const bundle = ok.map((r) => `--- ${r.model} ---\n${r.text.slice(0, 4000)}`).join("\n\n");
      try {
        const resp = await puter.ai.chat(
          [{ role: "system", content: "Merge the candidate answers into one best answer. Keep facts all agree on, resolve conflicts sensibly, keep code runnable." },
           { role: "user", content: `Original question: ${prompt}\n\n${bundle}` }],
          { ...baseOpts(), model: agg });
        el("swarmResult").innerHTML = `<h4>Synthesized (${esc(agg)})</h4>` + md(window.PuterModels.extractText(resp));
      } catch (e) {
        el("swarmResult").innerHTML = `<b>Synthesis failed:</b> ${esc(e.message || e)}`;
      }
    }
  }

  async function runPipeline() {
    const prompt = el("swarmPrompt").value.trim() || document.getElementById("userInput").value.trim();
    if (!prompt) return alert("Enter a swarm prompt first.");
    const out = el("swarmResult"); out.innerHTML = "<i>Pipeline running: plan → build → critique…</i>";
    const say = async (model, msgs, label) => {
      window.PuterAgent.timeline(label + " (" + model + ")…");
      const r = await puter.ai.chat(msgs, { ...baseOpts(), model });
      return window.PuterModels.extractText(r);
    };
    try {
      const plan = await say("claude-fable-5-1",
        [{ role: "system", content: "You are the planner. Output a short numbered plan." }, { role: "user", content: prompt }], "planning");
      const build = await say("openai/gpt-5.3-codex",
        [{ role: "system", content: "You are the builder. Follow the plan and produce the deliverable (code must be runnable; if UI, include full HTML)." },
         { role: "user", content: `Task: ${prompt}\n\nPlan:\n${plan}` }], "building");
      const crit = await say("gpt-5.6-luna",
        [{ role: "system", content: "You are the critic. List concrete issues and fixes, or say APPROVED." },
         { role: "user", content: `Task: ${prompt}\n\nDeliverable:\n${build}` }], "critiquing");
      let final = build;
      if (!/approved/i.test(crit.slice(0, 200))) {
        final = await say(document.getElementById("modelSelect").value,
          [{ role: "system", content: "Revise the deliverable addressing the critique." },
           { role: "user", content: `Task: ${prompt}\n\nDraft:\n${build}\n\nCritique:\n${crit}` }], "revising");
      }
      out.innerHTML = `<h4>Plan (fable-5-1)</h4>${md(plan)}<h4>Build (codex)</h4>${md(build)}<h4>Critique (luna)</h4>${md(crit)}<h4>Final</h4>${md(final)}`;
      if (/<html|<!doctype/i.test(final)) {
        const m = final.match(/```html([\s\S]*?)```/i);
        window.PuterSandbox.render(m ? m[1] : final, "pipeline result");
      }
    } catch (e) {
      out.innerHTML = `<b>Pipeline failed:</b> ${esc(e.message || e)}`;
    }
  }

  window.PuterSwarm = { runCompare, runPipeline };
})();
