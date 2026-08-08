/* ============================================================
   pdf-editor.js — format-preserving edits over an existing PDF

   The original file is never re-generated. pdf.js paints each page onto
   a canvas for display; the user's edits (text boxes, whiteout, highlight,
   images) live in an overlay layer above it. Export loads the ORIGINAL
   bytes into pdf-lib and draws only the overlay on top, so the source
   layout, fonts and vector content stay byte-identical underneath.

   Every edit is stored in PDF user-space points with a TOP-LEFT origin —
   natural for the screen — and flipped to pdf-lib's bottom-left origin
   only at export time.

   pdf-lib ships embedded as a string on window.__PDFLIB_SRC__ and is
   eval'd on first export; pdf.js arrives via PdfImport.ensureLib().
   ============================================================ */
"use strict";

const PdfEditor = (() => {

  /* ---------- pdf-lib bootstrap ---------- */

  function lib() {
    if (window.PDFLib) return window.PDFLib;
    if (window.__PDFLIB_SRC__) {
      // Indirect eval runs in global scope, so the UMD bundle lands on window.
      (0, eval)(window.__PDFLIB_SRC__);
      window.__PDFLIB_SRC__ = null; // the string is dead weight once eval'd
      return window.PDFLib;
    }
    throw new Error("PDF editing is not bundled in this build");
  }

  const PDF_FONT = {
    helv: "Helvetica", helvB: "HelveticaBold", times: "TimesRoman",
    timesB: "TimesRomanBold", timesI: "TimesRomanItalic", courier: "Courier",
  };
  const CSS_FONT = {
    helv:   ["Arial,Helvetica,sans-serif", "400", "normal"],
    helvB:  ["Arial,Helvetica,sans-serif", "700", "normal"],
    times:  ["Georgia,'Times New Roman',serif", "400", "normal"],
    timesB: ["Georgia,'Times New Roman',serif", "700", "normal"],
    timesI: ["Georgia,'Times New Roman',serif", "400", "italic"],
    courier: ["'Courier New',monospace", "400", "normal"],
  };

  /* ---------- state ---------- */

  let els = null, bound = false;
  let bytes = null, task = null, doc = null, name = "";
  let pages = [];               // { pg, w, h, el, canvas, layer, renderTask }
  const edits = new Map();      // pageIndex -> Edit[]
  let opened = false, dirty = false, gen = 0;
  let tool = "select", zoom = 1, zoomTimer = 0;
  let sel = null, selPage = -1, drag = null, pendingImg = null;
  const nodeOf = new WeakMap(); // edit -> element
  const elToEdit = new WeakMap();

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- display ---------- */

  function sizePage(i) {
    const p = pages[i], cw = p.w * zoom + "px", ch = p.h * zoom + "px";
    p.el.style.width = cw; p.el.style.height = ch;
    p.canvas.style.width = cw; p.canvas.style.height = ch;
    p.layer.style.width = cw; p.layer.style.height = ch;
  }

  async function paint(i) {
    const p = pages[i], g = gen;
    // Above 2 the extra pixels are invisible and quadruple the memory bill.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = p.pg.getViewport({ scale: zoom * dpr });
    if (p.renderTask) { try { p.renderTask.cancel(); } catch { /* settled */ } }
    p.canvas.width = Math.floor(vp.width); p.canvas.height = Math.floor(vp.height);
    const t = p.pg.render({ canvasContext: p.canvas.getContext("2d"), viewport: vp });
    p.renderTask = t;
    try { await t.promise; } catch { /* cancelled by a newer zoom */ }
    if (gen === g && p.renderTask === t) p.renderTask = null;
  }

  function place(ed) {
    const el = nodeOf.get(ed);
    if (!el) return;
    Object.assign(el.style, { left: ed.x * zoom + "px", top: ed.y * zoom + "px", width: ed.w * zoom + "px" });
    if (ed.type === "text") {
      const [fontFamily, fontWeight, fontStyle] = CSS_FONT[ed.font] || CSS_FONT.helv;
      Object.assign(el.style, { height: "auto", fontFamily, fontWeight, fontStyle,
        fontSize: ed.size * zoom + "px", color: ed.color });
    } else {
      el.style.height = ed.h * zoom + "px";
    }
  }

  function buildNode(ed, i) {
    const el = document.createElement("div");
    el.style.position = "absolute"; // geometry must hold even before app.css does
    elToEdit.set(el, ed);
    if (ed.type === "text") {
      el.className = "pe-edit pe-text";
      el.contentEditable = "true";
      el.spellcheck = false;
      el.textContent = ed.text;
      // line-height 1.25 matches the 1.25em line advance used at export
      Object.assign(el.style, { whiteSpace: "pre-wrap", minWidth: "40px", lineHeight: "1.25" });
      el.addEventListener("input", () => { ed.text = el.innerText; dirty = true; });
      el.addEventListener("blur", () => {
        // Whitespace-only boxes evaporate rather than exporting invisible edits.
        if (!ed.text.trim() && (edits.get(i) || []).includes(ed)) removeEdit(i, ed);
      });
    } else if (ed.type === "image") {
      el.className = "pe-edit pe-img";
      const img = document.createElement("img");
      Object.assign(img, { src: ed.dataUrl, draggable: false });
      Object.assign(img.style, { width: "100%", height: "100%" });
      el.appendChild(img);
    } else if (ed.type === "whiteout") {
      el.className = "pe-edit pe-white";
      el.style.background = "#fff";
    } else {
      el.className = "pe-edit pe-hl";
      el.style.background = "rgba(245,213,10,.42)";
      el.style.mixBlendMode = "multiply";
    }
    return el;
  }

  function decorate(ed, el) {
    const on = sel === ed;
    el.classList.toggle("sel", on);
    let h = el.querySelector(":scope > .pe-resize");
    if (on && !h) {
      h = document.createElement("div");
      h.className = "pe-resize";
      h.contentEditable = "false"; // keeps the caret and Select-All out of the handle
      el.appendChild(h);
    } else if (!on && h) h.remove();
  }

  function syncLayer(i) {
    const p = pages[i];
    if (!p) return;
    const keep = new Set();
    for (const ed of edits.get(i) || []) {
      let el = nodeOf.get(ed);
      if (!el) { el = buildNode(ed, i); nodeOf.set(ed, el); }
      if (el.parentNode !== p.layer) p.layer.appendChild(el);
      place(ed);
      decorate(ed, el);
      keep.add(el);
    }
    for (const el of [...p.layer.children]) if (!keep.has(el)) el.remove();
  }

  /* ---------- selection ---------- */

  function select(ed, i) {
    if (sel === ed) return;
    const prev = sel;
    sel = ed; selPage = i;
    if (prev && nodeOf.get(prev)) decorate(prev, nodeOf.get(prev));
    if (nodeOf.get(ed)) decorate(ed, nodeOf.get(ed));
    if (ed.type === "text") { // controls mirror the selection they now steer
      els.font.value = ed.font; els.size.value = ed.size; els.color.value = ed.color;
    }
  }

  function deselect() {
    if (!sel) return;
    const ed = sel;
    sel = null; selPage = -1;
    const el = nodeOf.get(ed);
    if (el) decorate(ed, el);
  }

  function pushEdit(i, ed) {
    let list = edits.get(i);
    if (!list) edits.set(i, list = []);
    list.push(ed);
    dirty = true;
    syncLayer(i);
  }

  function removeEdit(i, ed) {
    const list = edits.get(i);
    const at = list ? list.indexOf(ed) : -1;
    if (at < 0) return;
    list.splice(at, 1);
    if (sel === ed) { sel = null; selPage = -1; }
    dirty = true;
    syncLayer(i);
  }

  /* ---------- pointer interactions (delegated on #peDeck) ---------- */

  const dropFocus = () => {
    // preventDefault below suppresses native focus moves, so a still-focused
    // text box would keep swallowing keystrokes — blur it by hand.
    const a = document.activeElement;
    if (a && a.isContentEditable) a.blur();
  };

  function onDown(e) {
    if (e.button !== 0) return;
    const pageEl = e.target.closest(".pe-page");
    if (!pageEl) return;
    const i = +pageEl.dataset.n, p = pages[i];
    const r = p.layer.getBoundingClientRect();
    const px = (e.clientX - r.left) / zoom, py = (e.clientY - r.top) / zoom;
    const handle = e.target.closest(".pe-resize");
    const editEl = e.target.closest(".pe-edit");

    if (handle && editEl) {
      const ed = elToEdit.get(editEl);
      select(ed, i);
      drag = { kind: "resize", i, ed, sx: px, sy: py, ow: ed.w, oh: ed.h || 0 };
      els.deck.setPointerCapture(e.pointerId);
      e.preventDefault();
      dropFocus();
    } else if (editEl) {
      const ed = elToEdit.get(editEl);
      select(ed, i);
      const editing = ed.type === "text" &&
        (document.activeElement === editEl || editEl.contains(document.activeElement));
      if (tool === "select" && !editing) {
        drag = { kind: "move", i, ed, sx: px, sy: py, ox: ed.x, oy: ed.y, moved: false };
        els.deck.setPointerCapture(e.pointerId);
        e.preventDefault(); // a drag must not start native text selection; clean clicks re-focus on up
        dropFocus();
      }
    } else if (tool === "text") {
      e.preventDefault(); // default mousedown focus would steal the caret placed below
      const ed = {
        type: "text", x: px, y: py, w: Math.max(40, Math.min(180, p.w - px - 6)), text: "",
        size: clamp(parseFloat(els.size.value) || 12, 6, 96),
        color: els.color.value || "#111111", font: els.font.value || "helv",
      };
      pushEdit(i, ed);
      select(ed, i);
      const el = nodeOf.get(ed);
      if (el) el.focus();
    } else if (tool === "whiteout" || tool === "highlight") {
      e.preventDefault();
      dropFocus();
      const ed = { type: tool, x: px, y: py, w: 0, h: 0 };
      pushEdit(i, ed);
      drag = { kind: "draw", i, ed, sx: px, sy: py };
      els.deck.setPointerCapture(e.pointerId);
    } else if (tool === "image") {
      pendingImg = { i, x: px, y: py };
      els.imgInput.value = "";
      els.imgInput.click();
    } else {
      deselect();
    }
  }

  function onMove(e) {
    if (!drag) return;
    const p = pages[drag.i], ed = drag.ed;
    const r = p.layer.getBoundingClientRect();
    const px = clamp((e.clientX - r.left) / zoom, 0, p.w);
    const py = clamp((e.clientY - r.top) / zoom, 0, p.h);
    if (drag.kind === "move") {
      const dx = px - drag.sx, dy = py - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) * zoom > 3) drag.moved = true;
      if (!drag.moved) return;
      ed.x = clamp(drag.ox + dx, 8 - ed.w, p.w - 8); // keep at least a sliver on-page
      ed.y = clamp(drag.oy + dy, 0, p.h - 8);
    } else if (drag.kind === "resize") {
      ed.w = Math.max(ed.type === "text" ? 40 : 12, drag.ow + (px - drag.sx));
      if (ed.type !== "text") ed.h = Math.max(12, drag.oh + (py - drag.sy));
    } else { // draw
      ed.x = Math.min(drag.sx, px); ed.y = Math.min(drag.sy, py);
      ed.w = Math.abs(px - drag.sx); ed.h = Math.abs(py - drag.sy);
    }
    place(ed);
  }

  function onUp(e) {
    const d = drag;
    drag = null;
    if (!d) return;
    if (d.kind === "draw" && (d.ed.w < 4 || d.ed.h < 4)) {
      removeEdit(d.i, d.ed); // an accidental twitch is not an edit
      return;
    }
    if (d.kind === "move" && !d.moved) {
      // A clean click on an unfocused text box: hand it the caret we withheld.
      if (d.ed.type === "text" && e.type !== "pointercancel") nodeOf.get(d.ed)?.focus();
      return;
    }
    if (d.kind === "draw") select(d.ed, d.i);
    dirty = true;
    syncLayer(d.i);
  }

  function onKey(e) {
    if (!opened || !document.body.classList.contains("pdf-mode")) return;
    const a = document.activeElement;
    if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
    if (e.key === "Escape") {
      if (a && a.isContentEditable) a.blur();
      deselect();
    } else if ((e.key === "Delete" || e.key === "Backspace") && sel) {
      const el = nodeOf.get(sel);
      if (sel.type === "text" && el && (a === el || el.contains(a))) return; // typing, not deleting the box
      e.preventDefault();
      removeEdit(selPage, sel);
    }
  }

  /* ---------- image tool ---------- */

  async function onImageFile() {
    const f = els.imgInput.files && els.imgInput.files[0];
    const at = pendingImg;
    pendingImg = null;
    if (!f || !at || !pages[at.i]) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) {
      api.hooks.toast("PNG or JPEG images only", "warn");
      return;
    }
    try {
      const dataUrl = await new Promise((res, rej) => {
        const rd = new FileReader();
        rd.onload = () => res(rd.result); rd.onerror = () => rej(new Error("read failed"));
        rd.readAsDataURL(f);
      });
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
      const p = pages[at.i];
      // CSS px → pt, then cap at 40% of the page width.
      let w = Math.max(12, img.naturalWidth * 0.75);
      if (w > p.w * 0.4) w = p.w * 0.4;
      const h = Math.max(12, w * img.naturalHeight / img.naturalWidth);
      const ed = {
        type: "image", w, h, dataUrl, kind: f.type === "image/png" ? "png" : "jpg",
        x: clamp(at.x, 0, Math.max(0, p.w - w)), y: clamp(at.y, 0, Math.max(0, p.h - h)),
      };
      pushEdit(at.i, ed);
      select(ed, at.i);
    } catch {
      api.hooks.toast("Could not read that image", "warn");
    }
  }

  /* ---------- zoom ---------- */

  function applyZoom(now) {
    els.zoomPct.textContent = Math.round(zoom * 100) + "%";
    for (let i = 0; i < pages.length; i++) { sizePage(i); syncLayer(i); }
    // The stretched canvases hold the fort until the debounced re-render.
    clearTimeout(zoomTimer);
    const repaint = () => { for (let i = 0; i < pages.length; i++) paint(i).catch(() => {}); };
    if (now) repaint();
    else zoomTimer = setTimeout(repaint, 150);
  }

  function setZoom(z) {
    z = clamp(Math.round(z * 100) / 100, 0.5, 3);
    if (!opened || z === zoom) return;
    zoom = z;
    applyZoom(false);
  }

  /* ---------- one-time DOM binding ---------- */

  function bindOnce() {
    if (bound) return;
    bound = true;
    els = {
      root: $("pdfEditor"), name: $("peName"), pages: $("pePages"),
      tools: [...document.querySelectorAll("#peTools .pe-tool")],
      font: $("peFont"), size: $("peSize"), color: $("peColor"),
      zoomOut: $("peZoomOut"), zoomPct: $("peZoomPct"), zoomIn: $("peZoomIn"),
      scroll: $("peScroll"), deck: $("peDeck"), imgInput: $("peImgInput"),
    };
    for (const b of els.tools) b.addEventListener("click", () => setTool(b.dataset.tool));
    const restyle = (fn) => {
      if (!sel || sel.type !== "text") return; // unselected, the controls are just defaults
      fn(sel);
      dirty = true;
      syncLayer(selPage);
    };
    els.font.addEventListener("change", () => restyle((ed) => { ed.font = els.font.value; }));
    els.size.addEventListener("input", () => restyle((ed) => { ed.size = clamp(parseFloat(els.size.value) || 12, 6, 96); }));
    els.color.addEventListener("input", () => restyle((ed) => { ed.color = els.color.value; }));
    els.zoomIn.addEventListener("click", () => setZoom(zoom + 0.1));
    els.zoomOut.addEventListener("click", () => setZoom(zoom - 0.1));
    els.scroll.addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(zoom + (e.deltaY < 0 ? 0.1 : -0.1));
    }, { passive: false });
    els.imgInput.addEventListener("change", onImageFile);
    els.deck.addEventListener("pointerdown", onDown);
    els.deck.addEventListener("pointermove", onMove);
    els.deck.addEventListener("pointerup", onUp);
    els.deck.addEventListener("pointercancel", onUp);
    document.addEventListener("keydown", onKey);
  }

  function setTool(t) {
    tool = t;
    for (const b of els.tools) b.classList.toggle("on", b.dataset.tool === t);
  }

  /* ---------- open / close ---------- */

  async function open(buf, fname) {
    bindOnce();
    if (opened || task) await close();
    const g = ++gen;
    // pdf.js hands its buffer to the (fake) worker, which may detach it —
    // export needs the original bytes intact, so both sides get a copy.
    bytes = buf.slice(0);
    name = fname || "document.pdf";
    const pdfjs = await PdfImport.ensureLib();
    task = pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false, useSystemFonts: true });
    try {
      doc = await task.promise;
    } catch (err) {
      task = null;
      if (err?.name === "PasswordException") {
        throw new Error("This PDF is password-protected — remove the password and try again.");
      }
      throw err;
    }
    if (gen !== g) return; // closed while loading
    edits.clear();
    dirty = false; sel = null; selPage = -1; drag = null; pendingImg = null;
    setTool("select");
    els.name.textContent = name;
    els.pages.textContent = doc.numPages + (doc.numPages === 1 ? " page" : " pages");

    pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      if (gen !== g) return;
      const vp = pg.getViewport({ scale: 1 });
      pages.push({ pg, w: vp.width, h: vp.height, renderTask: null });
    }
    els.deck.innerHTML = "";
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      p.el = document.createElement("div");
      p.el.className = "pe-page";
      p.el.dataset.n = i;
      p.el.style.position = "relative"; // geometry must hold even before app.css does
      p.canvas = document.createElement("canvas");
      p.canvas.style.display = "block";
      p.layer = document.createElement("div");
      p.layer.className = "pe-layer";
      Object.assign(p.layer.style, { position: "absolute", left: "0", top: "0" });
      p.el.append(p.canvas, p.layer);
      els.deck.appendChild(p.el);
    }
    // Fit-width by default, but never open past 150% — reading zoom, not loupe zoom.
    const avail = (els.scroll.clientWidth || document.documentElement.clientWidth) - 48;
    zoom = clamp(Math.round((avail / pages[0].w) * 100) / 100, 0.5, 1.5);
    opened = true;
    applyZoom(true);
  }

  async function close() {
    gen++;
    opened = false;
    for (const p of pages) { if (p.renderTask) { try { p.renderTask.cancel(); } catch { /* settled */ } } }
    const t = task, d = doc;
    task = null; doc = null; bytes = null; name = "";
    pages = [];
    edits.clear();
    dirty = false; sel = null; selPage = -1; drag = null; pendingImg = null;
    clearTimeout(zoomTimer);
    if (els) els.deck.innerHTML = "";
    if (t) {
      // v6 keeps destroy() on the loading task; older builds had it on the proxy.
      try { await t.destroy(); }
      catch { try { await (d && d.destroy()); } catch { /* already torn down */ } }
    }
  }

  /* ---------- export ---------- */

  function hexRgb(hex, rgb) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    const n = m ? parseInt(m[1], 16) : 0;
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }

  function wrapLines(text, font, size, maxW) {
    // Un-encodable glyphs blow up measurement too, not just drawing.
    const width = (s) => {
      try { return font.widthOfTextAtSize(s, size); }
      catch { return font.widthOfTextAtSize(s.replace(/[^\x20-\xFF]/g, "?"), size); }
    };
    const out = [];
    for (const raw of String(text).split(/\r?\n/)) {
      const words = raw.split(/\s+/).filter(Boolean);
      if (!words.length) { out.push(""); continue; }
      let line = "";
      for (const w of words) {
        const cand = line ? line + " " + w : w;
        if (line && width(cand) > maxW) { out.push(line); line = w; }
        else line = cand;
      }
      out.push(line);
    }
    return out;
  }

  async function exportPdf() {
    const { PDFDocument, StandardFonts, rgb } = lib();
    let out;
    try {
      out = await PDFDocument.load(bytes);
    } catch (err) {
      api.hooks.toast("Could not rebuild this PDF — it may be encrypted", "warn");
      throw err;
    }
    const fonts = new Map();
    const getFont = async (k) => {
      let f = fonts.get(k);
      if (!f) { f = await out.embedFont(StandardFonts[PDF_FONT[k]] || StandardFonts.Helvetica); fonts.set(k, f); }
      return f;
    };
    const images = new Map();
    const pageArr = out.getPages();
    for (const [i, list] of edits) {
      const page = pageArr[i];
      if (!page || !list.length) continue;
      const { height: H } = page.getSize();
      // Screen coords are top-left; pdf-lib's are bottom-left: y_pdf = H - y - h.
      // Whiteout under everything, text on top, so a box over a whiteout survives.
      for (const ed of list.filter((x) => x.type === "whiteout")) {
        page.drawRectangle({ x: ed.x, y: H - ed.y - ed.h, width: ed.w, height: ed.h, color: rgb(1, 1, 1) });
      }
      for (const ed of list.filter((x) => x.type === "image")) {
        let img = images.get(ed.dataUrl);
        if (!img) {
          img = ed.kind === "png" ? await out.embedPng(ed.dataUrl) : await out.embedJpg(ed.dataUrl);
          images.set(ed.dataUrl, img);
        }
        page.drawImage(img, { x: ed.x, y: H - ed.y - ed.h, width: ed.w, height: ed.h });
      }
      for (const ed of list.filter((x) => x.type === "highlight")) {
        const box = { x: ed.x, y: H - ed.y - ed.h, width: ed.w, height: ed.h, color: rgb(0.96, 0.84, 0.04) };
        // Multiply keeps the text legible under the tint (pdf-lib ≥1.17);
        // if this build rejects the option, plain translucency will do.
        try { page.drawRectangle({ ...box, blendMode: "Multiply" }); }
        catch { page.drawRectangle({ ...box, opacity: 0.35 }); }
      }
      for (const ed of list.filter((x) => x.type === "text")) {
        const font = await getFont(ed.font);
        const color = hexRgb(ed.color, rgb);
        const lines = wrapLines(ed.text, font, ed.size, ed.w);
        for (let li = 0; li < lines.length; li++) {
          if (!lines[li]) continue;
          // 0.83 ≈ ascent fraction: drops the baseline so print lands where the screen box implied.
          const opts = { x: ed.x, y: H - ed.y - ed.size * 0.83 - li * ed.size * 1.25, size: ed.size, font, color };
          try { page.drawText(lines[li], opts); }
          catch {
            // The standard fonts speak WinAnsi only — swap what they can't encode.
            try { page.drawText(lines[li].replace(/[^\x20-\xFF]/g, "?"), opts); }
            catch { /* even the fallback failed; skip the line */ }
          }
        }
      }
    }
    const saved = await out.save();
    return {
      blob: new Blob([saved], { type: "application/pdf" }),
      name: name.replace(/\.pdf$/i, "") + "-edited.pdf",
    };
  }

  /* ---------- public surface ---------- */

  const api = {
    hooks: { toast() {}, async confirm() { return true; } },
    open, close, exportPdf,
    isOpen: () => opened,
    hasEdits: () => dirty && [...edits.values()].some((l) => l.length),
    addEdit: pushEdit, // programmatic path shares the interactive one (QA leans on this)
    getEdits: () => edits,
  };
  return api;
})();
