/* File generation: zip (JSZip), pdf (jsPDF), docx, pptx, tex/md/txt/html/csv (native).
 * CDN libs load lazily; graceful fallback to source download. */
(function () {
  function loadScript(src, globalName) {
    return new Promise((resolve, reject) => {
      if (globalName && window[globalName]) return resolve();
      if (document.querySelector(`script[data-cdn="${src}"]`)) {
        let n = 0;
        const t = setInterval(() => {
          if ((globalName && window[globalName]) || ++n > 50) {
            clearInterval(t);
            return (globalName && window[globalName]) ? resolve() : reject(new Error("CDN blocked: " + src));
          }
        }, 100);
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.dataset.cdn = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("CDN blocked: " + src));
      document.head.appendChild(s);
    });
  }
  function download(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function extOf(name) { return String(name || "").split(".").pop().toLowerCase(); }

  async function makeZip(files, zipName) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", "JSZip");
    const zip = new window.JSZip();
    for (const [name, content] of Object.entries(files)) zip.file(name, content);
    const blob = await zip.generateAsync({ type: "blob" });
    download(blob, zipName || "codebase.zip");
    return Object.keys(files).length + " files zipped";
  }
  async function downloadCodebaseZip() {
    const names = window.PuterCodebase ? window.PuterCodebase.names() : [];
    if (!names.length) { window.PuterUI.toast("Codebase is empty", "err"); return; }
    const files = {};
    for (const n of names) files[n] = window.PuterCodebase.get(n).content;
    try {
      const msg = await makeZip(files, "codebase.zip");
      window.PuterUI.toast("Downloaded codebase.zip (" + msg + ")", "ok");
    } catch (e) {
      window.PuterUI.toast("ZIP failed (CDN blocked?) — use per-file Download", "err");
    }
  }
  /** Generate + download one file. content is text (or base64 with encoding flag). */
  async function makeFile(filename, content, opts) {
    opts = opts || {};
    const ext = extOf(filename);
    const text = String(content == null ? "" : content);
    if (ext === "zip") {
      let files = {};
      try { files = JSON.parse(text); } catch { files = { "file.txt": text }; }
      return makeZip(files, filename);
    }
    if (ext === "pdf") {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "jspdf");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF();
      const lines = pdf.splitTextToSize(text, 170);
      let y = 15;
      for (const ln of lines) {
        if (y > 280) { pdf.addPage(); y = 15; }
        pdf.text(ln, 15, y);
        y += 7;
      }
      pdf.save(filename);
      return "PDF saved";
    }
    if (ext === "docx") {
      await loadScript("https://unpkg.com/docx@9.1.0/build/index.umd.js", "docx");
      const doc = new window.docx.Document({
        sections: [{ children: text.split("\n").map((p) => new window.docx.Paragraph(p || " ")) }],
      });
      const blob = await window.docx.Packer.toBlob(doc);
      download(blob, filename);
      return "DOCX saved";
    }
    if (ext === "pptx") {
      await loadScript("https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js", "PptxGenJS");
      const pptx = new window.PptxGenJS();
      const slides = text.split(/\n---\n/);
      for (const s of slides) {
        const slide = pptx.addSlide();
        slide.addText(s.slice(0, 2000) || " ", { x: 0.5, y: 0.5, w: 9, h: 4.5, fontSize: 16 });
      }
      await pptx.writeFile({ fileName: filename });
      return "PPTX saved";
    }
    const mime = { md: "text/markdown", tex: "text/x-tex", html: "text/html", csv: "text/csv", json: "application/json" }[ext] || "text/plain";
    download(new Blob([text], { type: mime }), filename);
    return filename + " saved";
  }
  window.PuterFilegen = { makeFile, makeZip, downloadCodebaseZip };
})();
