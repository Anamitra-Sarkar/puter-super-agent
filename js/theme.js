/* AI-generated UI themes: image backgrounds applied live to the app shell. */
(function () {
  let current = null; // {url, prompt} in-memory (data URLs can be huge — not persisted)

  function toast(m, k) { if (window.PuterUI) window.PuterUI.toast(m, k); }
  function apply(url, prompt) {
    current = { url, prompt: prompt || "" };
    document.body.classList.add("themed");
    document.body.style.setProperty("--theme-img", `url("${url}")`);
    toast("Theme applied — /theme reset to remove", "ok");
  }
  function reset() {
    current = null;
    document.body.classList.remove("themed");
    document.body.style.removeProperty("--theme-img");
    toast("Theme removed", "info");
  }
  async function generate(prompt) {
    window.PuterAgent.timeline("🎨 dreaming a theme… (soft abstract background, no text)");
    try {
      const img = await puter.ai.txt2img(
        `Soft abstract app background, ${prompt}. Muted warm tones, very subtle, no text, no logos, smooth gradients okay for artwork, dreamy, high quality`,
        { model: "gpt-image-1-mini" });
      apply(img.src, prompt);
      return img.src;
    } catch (e) {
      toast("Theme generation failed: " + String(e.message || e).slice(0, 120), "err");
      return null;
    }
  }
  window.PuterTheme = { apply, reset, generate, get: () => current };
})();
