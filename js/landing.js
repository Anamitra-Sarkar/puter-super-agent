/* Landing page logic: auth-aware CTA, FAQ accordion, scroll reveals. */
(function () {
  function el(id) { return document.getElementById(id); }

  async function refreshCTA() {
    const cta = el("ctaBtn"), open = el("openAppBtn"), chip = el("landingChip");
    const signed = await window.PuterAuth.isSignedIn();
    if (signed) {
      if (cta) cta.classList.add("hidden");
      if (open) open.classList.remove("hidden");
      if (chip) {
        chip.classList.remove("hidden");
        const u = await window.PuterAuth.currentUser();
        const name = (u && (u.username || u.uuid)) || "you";
        el("landingUser").textContent = name;
        el("landingAvatar").textContent = String(name).slice(0, 1).toUpperCase();
      }
    } else {
      if (cta) cta.classList.remove("hidden");
      if (open) open.classList.add("hidden");
      if (chip) chip.classList.add("hidden");
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    refreshCTA();
    if (el("ctaBtn")) el("ctaBtn").onclick = async () => {
      if (await window.PuterAuth.signIn()) location.href = "app.html";
      else refreshCTA();
    };
    if (el("ctaBtn2")) el("ctaBtn2").onclick = () => el("ctaBtn").click();
    if (el("openAppBtn")) el("openAppBtn").onclick = () => (location.href = "app.html");
    if (el("btnLandingOut")) el("btnLandingOut").onclick = async () => {
      await window.PuterAuth.signOut();
      refreshCTA();
    };
    document.querySelectorAll(".faq-q").forEach((b) => b.onclick = () => {
      const item = b.parentElement;
      const wasOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach((i) => i.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((n) => io.observe(n));
  });
})();
