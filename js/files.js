/* Files: attachments (vision/file context) + Puter FS explorer + vision/speech/browser tabs. */
(function () {
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  async function readAttachments(fileList) {
    const out = [];
    for (const f of fileList || []) {
      if (f.type.startsWith("image/")) out.push({ kind: "image", name: f.name, payload: f });
      else if (/text|json|markdown|javascript|python|csv/.test(f.type) || /\.(txt|md|json|js|ts|py|csv|html|css)$/i.test(f.name)) {
        out.push({ kind: "text", name: f.name, text: await f.text() });
      } else if (f.type === "application/pdf") {
        out.push({ kind: "text", name: f.name, text: "[PDF attached: " + f.name + " — pasted text unavailable client-side; describe what you need from it]" });
      } else {
        out.push({ kind: "text", name: f.name, text: "[binary file attached: " + f.name + ", " + f.size + " bytes]" });
      }
    }
    return out;
  }

  async function doVision() {
    const out = el("visionOut"); out.textContent = "Analyzing…";
    const q = el("visionQ").value || "What do you see in this image?";
    const model = el("modelSelect").value;
    try {
      const f = el("visionFile").files[0];
      const media = f || el("visionUrl").value.trim();
      if (!media) { out.textContent = "Provide an image URL or file."; return; }
      const resp = await puter.ai.chat(q, media, false, { model, normalize: true });
      out.innerHTML = window.PuterAgent.md(window.PuterModels.extractText(resp));
    } catch (e) { out.innerHTML = "<b>Error:</b> " + esc(e.message || e); }
  }

  async function doTTS() {
    const out = el("ttsOut"); out.textContent = "Synthesizing…";
    try {
      const audio = await puter.ai.txt2speech(el("ttsText").value.slice(0, 2900),
        { provider: "openai", model: el("ttsModel").value, voice: el("ttsVoice").value });
      audio.setAttribute("controls", "");
      out.innerHTML = "";
      out.appendChild(audio);
      audio.play().catch(() => {});
    } catch (e) { out.innerHTML = "<b>Error:</b> " + esc(e.message || e); }
  }

  async function doGenImg() {
    const out = el("imgOut"); out.innerHTML = "<i>Generating…</i>";
    try {
      const img = await puter.ai.txt2img(el("imgPrompt").value.trim(), { model: el("imgModel").value, quality: el("imgQuality").value });
      img.style.maxWidth = "100%";
      out.innerHTML = "";
      out.appendChild(img);
    } catch (e) { out.innerHTML = "<b>Error:</b> " + esc(e.message || e); }
  }

  async function doFetch(summarize) {
    const out = el("browserOut"); out.textContent = "Fetching…";
    const url = el("browserUrl").value.trim();
    try {
      const r = await puter.net.fetch(url);
      const text = (await r.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 8000);
      if (!summarize) { out.textContent = text.slice(0, 4000); return; }
      out.textContent = "Summarizing…";
      const resp = await puter.ai.chat(
        [{ role: "system", content: "Summarize the fetched page content concisely with key points." },
         { role: "user", content: `URL: ${url}\n\nContent:\n${text}` }],
        { model: el("modelSelect").value, normalize: true });
      out.innerHTML = window.PuterAgent.md(window.PuterModels.extractText(resp));
    } catch (e) { out.innerHTML = "<b>Error:</b> " + esc(e.message || e); }
  }

  async function fsList() {
    const out = el("fsOut");
    try {
      const items = await puter.fs.readdir(".");
      out.textContent = items.map((i) => i.path || i.name).join("\n") || "(empty)";
    } catch (e) { out.textContent = "Error: " + (e.message || e); }
  }
  async function fsRead() {
    const out = el("fsOut");
    try {
      const blob = await puter.fs.read(el("fsPath").value.trim());
      el("fsBody").value = await blob.text();
      out.textContent = "Loaded into editor.";
    } catch (e) { out.textContent = "Error: " + (e.message || e); }
  }
  async function fsWrite() {
    const out = el("fsOut");
    const p = el("fsPath").value.trim();
    if (!p) { out.textContent = "Enter a path first."; return; }
    try { await puter.fs.write(p, el("fsBody").value); out.textContent = "Wrote " + p; }
    catch (e) { out.textContent = "Error: " + (e.message || e); }
  }

  window.PuterFiles = { readAttachments, doVision, doTTS, doGenImg, doFetch, fsList, fsRead, fsWrite };
})();
