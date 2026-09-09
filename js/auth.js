/* Shared auth helpers for landing + app (Puter User-Pays: sign in to enter). */
(function () {
  async function isSignedIn() {
    try { return await puter.auth.isSignedIn(); } catch { return false; }
  }
  async function currentUser() {
    try { return await puter.auth.getUser(); } catch { return null; }
  }
  async function signIn() {
    toast("Opening Puter sign-in — allow the popup", "info");
    try {
      await puter.auth.signIn();
      toast("Signed in — welcome", "ok");
      return true;
    } catch {
      toast("Sign-in blocked or cancelled — allow popups and retry", "err");
      return false;
    }
  }
  async function signOut() {
    try { await puter.auth.signOut(); } catch {}
    toast("Signed out", "info");
  }
  async function usageLines() {
    try {
      const usage = await puter.auth.getMonthlyUsage();
      if (!usage || typeof usage !== "object") return ["Usage unavailable"];
      const parts = [];
      for (const [k, v] of Object.entries(usage)) {
        if (v && typeof v === "object" && (v.used !== undefined || v.allowance !== undefined)) {
          parts.push(`${k}: ${v.used ?? "?"}${v.allowance ? " / " + v.allowance : ""}`);
        }
      }
      return parts.length ? parts.slice(0, 4) : ["Usage: within free allowance"];
    } catch {
      return ["Usage unavailable"];
    }
  }
  function toast(msg, kind) {
    if (window.PuterUI) window.PuterUI.toast(msg, kind);
  }
  window.PuterAuth = { isSignedIn, currentUser, signIn, signOut, usageLines };
})();
