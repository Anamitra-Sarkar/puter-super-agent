/* Sandbox preview + verify engine: console/overflow/interaction/security checks,
 * screenshot → vision design review. Report feeds back to the agent so it fixes issues. */
(function () {
  let lastHtml = "";
  let consoleErrors = [];

  const DESIGN_TASTE = `You are a senior product designer doing a ruthless visual review of a UI screenshot.
Hate list (call these out hard): purple/blue linear gradients; generic "AI slop" (glassy purple cards, neon glows, robot emojis, lorem ipsum, "Lorem", "Delve", "Unlock the power"); tiny gray-on-gray text; cramped spacing; default unstyled buttons; centered everything; stock-looking hero with floating blobs; more than 2 font families; pure black backgrounds with neon accents.
Love list: warm paper/cream or clean white surfaces, ONE confident accent color, generous whitespace, clear hierarchy, real-feeling copy, consistent 8pt rhythm, tasteful borders/shadows, readable contrast (4.5:1+), responsive behavior.
Reply in 6 bullets max: 3 biggest visual problems with concrete fixes, then a 1-10 score. Be blunt, no flattery.`;

  function render(html, title) {
    lastHtml = String(html);
    consoleErrors = [];
    const frame = document.getElementById("previewFrame");
    const log = document.getElementById("previewLog");
    const dock = document.getElementById("previewDock");
    if (dock) dock.classList.remove("hidden");
    const doc = lastHtml.includes("<html")
      ? lastHtml
      : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title || "preview")}</title></head><body>${lastHtml}</body></html>`;
    const shim = `<script>try{
    const _errs=[];
    const _l=(...a)=>{const m=a.map(String).join(" ");if(/^\[(error|warn)\]/.test(m)&&!_errs.includes(m))_errs.push(m);parent.postMessage({__pvlog:m},"*");};
    ["log","warn","error"].forEach(k=>{const o=console[k].bind(console);console[k]=(...a)=>{o(...a);_l("["+k+"]",...a);};});
    window.onerror=(m)=>_l("[error]",m);
    window.addEventListener("message",async(ev)=>{
      const d=ev.data||{};
      if(d.__pvverify!==undefined){
        let clicked=0;const before=_errs.length;
        try{
          const els=[...document.querySelectorAll("button, a[href], input[type=submit]")].slice(0,15);
          for(const b of els){try{b.click();clicked++;}catch(e){}await new Promise(r=>setTimeout(r,100));}
        }catch(e){}
        parent.postMessage({__pvverify:d.__pvverify,report:{
          empty:!(document.body&&(document.body.innerText||"").trim()),
          textLen:((document.body&&(document.body.innerText||""))||"").length,
          scrollW:document.documentElement?document.documentElement.scrollWidth:0,
          clientW:document.documentElement?document.documentElement.clientWidth:0,
          clicked,clickErrors:_errs.slice(before).slice(0,6),consoleErrors:_errs.slice(0,8)
        }},"*");
      }
      if(d.__pvshot!==undefined){
        try{
          if(!window.html2canvas){await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
          const c=await window.html2canvas(document.body,{backgroundColor:"#ffffff",scale:0.5,logging:false});
          parent.postMessage({__pvshot:d.__pvshot,dataURL:c.toDataURL("image/jpeg",0.65)},"*");
        }catch(e){parent.postMessage({__pvshot:d.__pvshot,error:String((e&&e.message)||e).slice(0,150)},"*");}
      }
    });}catch(e){}<\/script>`;
    frame.srcdoc = doc.replace(/<head[^>]*>/i, (m) => m + shim + `<script>${BRIDGE_JS}<\/script>`);
    if (log) log.textContent = `[preview] rendered${title ? ": " + title : ""} @ ${new Date().toLocaleTimeString()}\n` + log.textContent;
    if (window.PuterDock) window.PuterDock.open("preview");
    else {
      const dd = document.getElementById("previewDock");
      if (dd && dd.scrollIntoView) dd.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
  function clear() {
    document.getElementById("previewFrame").removeAttribute("srcdoc");
    document.getElementById("previewFrame").src = "about:blank";
    document.getElementById("previewLog").textContent = "";
    lastHtml = "";
    consoleErrors = [];
    const dock = document.getElementById("previewDock");
    if (dock) dock.classList.add("hidden");
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  const BRIDGE_JS = `(function(){
    if(window.PuterBackend)return;
    let seq=0;const waiters={};
    window.addEventListener("message",(ev)=>{
      const d=ev.data||{};
      if(d.__pvapi!==undefined&&waiters[d.__pvapi]){waiters[d.__pvapi](d);delete waiters[d.__pvapi];}
    });
    function call(op,args){
      return new Promise((resolve,reject)=>{
        const id="b"+(++seq)+Date.now().toString(36);
        waiters[id]=(d)=>(d.ok?resolve(d.result):reject(new Error(d.error||"backend error")));
        parent.postMessage({__pvapi:id,op,args:args||{}},"*");
        setTimeout(()=>{if(waiters[id]){delete waiters[id];reject(new Error("backend timeout: "+op));}},60000);
      });
    }
    window.PuterBackend={
      kv:{get:(k)=>call("kv.get",{k}),set:(k,v)=>call("kv.set",{k,v}),del:(k)=>call("kv.del",{k}),list:()=>call("kv.list",{})},
      fs:{read:(p)=>call("fs.read",{p}),write:(p,c)=>call("fs.write",{p,c})},
      ai:{chat:(prompt,model)=>call("ai.chat",{prompt,model})}
    };
  })();`;
  async function handleBridge(ev) {
    const frame = document.getElementById("previewFrame");
    let win = null;
    try { win = frame.contentWindow; } catch {}
    const { __pvapi: id, op, args } = ev.data || {};
    const reply = (ok, result, error) => {
      try { (ev.source || win).postMessage({ __pvapi: id, ok, result, error }, "*"); } catch {}
    };
    if (!win || ev.source !== win) return; // only our own preview frame
    const log = (m) => { const l = document.getElementById("previewLog"); if (l) l.textContent += "[backend] " + m + "\n"; };
    try {
      let result = null;
      const A = args || {};
      if (op === "kv.get") result = await puter.kv.get("pv_" + A.k);
      else if (op === "kv.set") {
        const v = typeof A.v === "string" ? A.v : JSON.stringify(A.v == null ? "" : A.v);
        await puter.kv.set("pv_" + A.k, String(v).slice(0, 100000));
        result = true;
      }
      else if (op === "kv.del") { await puter.kv.del("pv_" + A.k); result = true; }
      else if (op === "kv.list") result = await puter.kv.list();
      else if (op === "fs.read") { const b = await puter.fs.read(A.p); result = (await b.text()).slice(0, 100000); }
      else if (op === "fs.write") { await puter.fs.write(A.p, String(A.c == null ? "" : A.c)); result = true; }
      else if (op === "ai.chat") {
        const resp = await puter.ai.chat(String(A.prompt || "").slice(0, 6000), { model: A.model || "gpt-5.4-nano", normalize: true });
        result = window.PuterModels.extractText(resp).slice(0, 12000);
      }
      else return reply(false, null, "unknown op: " + op);
      log(op + " ok");
      reply(true, result === undefined ? null : result, null);
    } catch (e) {
      log(op + " error");
      reply(false, null, String((e && e.message) || e).slice(0, 300));
    }
  }
  const pending = {};
  let reqSeq = 0;
  window.addEventListener("message", (ev) => {
    if (ev.data && ev.data.__pvapi !== undefined && ev.data.op) {
      handleBridge(ev);
      return;
    }
    if (ev.data && ev.data.__pvlog !== undefined) {
      const msg = String(ev.data.__pvlog);
      if (/^\[(error|warn)\]/.test(msg) && !consoleErrors.includes(msg)) consoleErrors.push(msg);
      const log = document.getElementById("previewLog");
      if (log) log.textContent += msg + "\n";
    }
    if (ev.data && ev.data.__pvverify !== undefined && pending[ev.data.__pvverify]) {
      pending[ev.data.__pvverify](ev.data.report || null);
      delete pending[ev.data.__pvverify];
    }
    if (ev.data && ev.data.__pvshot !== undefined && pending[ev.data.__pvshot]) {
      pending[ev.data.__pvshot](ev.data);
      delete pending[ev.data.__pvshot];
    }
  });
  function frameWin() {
    try { return document.getElementById("previewFrame").contentWindow; } catch { return null; }
  }
  function askFrame(kind, timeoutMs) {
    return new Promise((resolve) => {
      const w = frameWin();
      if (!w) return resolve(null);
      const id = "r" + (++reqSeq) + Date.now().toString(36);
      pending[id] = resolve;
      try { w.postMessage({ [kind]: id }, "*"); }
      catch { delete pending[id]; return resolve(null); }
      setTimeout(() => {
        if (pending[id]) { delete pending[id]; resolve(null); }
      }, timeoutMs || 5000);
    });
  }

  /** Full verify pass via the in-frame harness (sandbox stays locked down).
   *  Unavailable pieces are reported as warnings — never failures. */
  async function verify(model) {
    const frame = document.getElementById("previewFrame");
    const lines = ["## Verify report (automated) — fix every ❌, then re-preview"];
    if (!frame || !lastHtml.trim()) {
      lines.push("- ❌ preview is EMPTY (no content rendered). Fix: output real visible content.");
      return lines.join("\n");
    }
    const first = await askFrame("__pvverify", 5000);
    if (!first) {
      lines.push("- ⚠️ in-frame checks unreachable (preview still booting or blocked) — verify manually in the Preview tab");
      const sec0 = securityScan(lastHtml);
      if (sec0.length) lines.push("- ❌ SECURITY (must fix before shipping):\n  " + sec0.join("\n  "));
      lines.push("If anything above is ❌: fix the code and re-preview.");
      return lines.join("\n");
    }
    if (first.empty) {
      lines.push("- ❌ preview renders EMPTY but the page booted. Fix: output real visible content (check for JS errors below).");
    } else {
      lines.push(`- ✅ preview renders visible content (~${first.textLen} chars)`);
    }
    const errs = [...new Set([...consoleErrors, ...(first.consoleErrors || [])])];
    if (errs.length) lines.push("- ❌ console errors:\n  " + errs.slice(0, 8).join("\n  "));
    else lines.push("- ✅ zero console errors/warnings");
    const over = [];
    if (frame) {
      const prev = frame.style.width;
      for (const w of [375, 768, 1440]) {
        frame.style.width = w + "px";
        await new Promise((r) => setTimeout(r, 300));
        const m = await askFrame("__pvverify", 5000);
        if (m && m.scrollW > m.clientW + 2) over.push(`${w}px: horizontal overflow (${m.scrollW}px)`);
      }
      frame.style.width = prev;
    }
    if (over.length) lines.push("- ❌ responsive issues:\n  " + over.join("\n  "));
    else lines.push("- ✅ no horizontal overflow at 375 / 768 / 1440px");
    lines.push(`- ✅ interaction sweep: clicked ${first.clicked || 0} controls` +
      (first.clickErrors && first.clickErrors.length ? `\n- ❌ errors after clicking:\n  ${first.clickErrors.slice(0, 6).join("\n  ")}` : " with no new errors"));
    const sec = securityScan(lastHtml);
    if (sec.length) lines.push("- ❌ SECURITY (must fix before shipping):\n  " + sec.join("\n  "));
    else lines.push("- ✅ no secrets / mixed-content / eval issues found");
    const shot = await askFrame("__pvshot", 12000);
    if (shot && shot.dataURL) {
      lines.push("- 📸 screenshot captured — vision review:");
      lines.push(await designReview(shot.dataURL, model));
    } else {
      lines.push("- ⚠️ screenshot unavailable (" + ((shot && shot.error) || "harness busy") + ") — visual review skipped, check the Preview tab by eye");
    }
    lines.push("If anything above is ❌: fix the code, call the preview tool again with COMPLETE files, and repeat until all ✅.");
    return lines.join("\n");
  }
  function securityScan(src) {
    const hits = [];
    const pats = [
      [/sk-[A-Za-z0-9]{10,}/, "possible OpenAI key in code"],
      [/ghp_[A-Za-z0-9]{10,}/, "possible GitHub token in code"],
      [/AKIA[0-9A-Z]{16}/, "possible AWS key in code"],
      [/http:\/\/(?!localhost|127\.0\.0\.1)/, "insecure http:// URL (mixed content)"],
      [/\beval\s*\(/, "eval() usage"],
      [/document\.write\s*\(/, "document.write usage"],
    ];
    for (const [re, label] of pats) if (re.test(src)) hits.push(label);
    return hits;
  }
  async function designReview(dataURL, model) {
    const m = window.PuterModels.supportsVision(model) ? model : window.PuterModels.VISION_FALLBACK;
    try {
      const resp = await puter.ai.chat(DESIGN_TASTE + "\n\nReview this UI screenshot.", dataURL, false, { model: m, normalize: true });
      return window.PuterModels.extractText(resp) + (m !== model ? `\n(reviewed with ${m} — ${model} is text-only)` : "");
    } catch (e) {
      return "visual review skipped: " + (e.message || e);
    }
  }
  window.PuterSandbox = { render, clear, verify, designReview, DESIGN_TASTE, getLastHtml: () => lastHtml };
})();
