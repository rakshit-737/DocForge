/* ============================================================
   engine.js — markdown → document DOM pipeline
   ============================================================ */
"use strict";

const Engine = (() => {

  marked.use({ gfm: true });

  /* Whether a lone newline inside a paragraph is a hard line break. Off by default:
     authors wrap their source, and burning those wraps into the printed page is the
     single loudest "generated" signal there is. The Formal letter template — an address
     block, where every line really is its own line — turns it back on. */
  const mdOpts = s => ({ breaks: !!(s && s.hardWrap) });

  const esc = s => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const cssStr = s => String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const slugify = t => (t.toLowerCase().replace(/[^\w\s-]/g, "").trim()
    .replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60)) || "sec";

  /* ---------- color math ---------- */
  function hexRgb(hex) {
    const m = hex.replace("#", "");
    const v = m.length === 3 ? m.split("").map(c => c + c).join("") : m;
    return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) || 0);
  }
  const rgbHex = (r, g, b) => "#" + [r, g, b].map(v =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  function mix(hex, other, k) { // k = amount of `other`
    const a = hexRgb(hex), b = hexRgb(other);
    return rgbHex(...a.map((v, i) => v + (b[i] - v) * k));
  }
  function tints(accent) {
    return {
      a50:  mix(accent, "#ffffff", 0.955),
      a75:  mix(accent, "#ffffff", 0.93),
      a100: mix(accent, "#ffffff", 0.88),
      a200: mix(accent, "#ffffff", 0.74),
      a300: mix(accent, "#ffffff", 0.55),
      a400: mix(accent, "#ffffff", 0.32),
      a500: accent,
      a600: mix(accent, "#000000", 0.12),
      a700: mix(accent, "#000000", 0.26),
      a800: mix(accent, "#000000", 0.4),
      a900: mix(accent, "#000000", 0.55),
    };
  }

  /* ---------- page geometry ---------- */
  const PAGES = {
    A4:     { w: 210,   h: 297,   label: "A4" },
    Letter: { w: 215.9, h: 279.4, label: "Letter" },
  };
  const MARGINS = {
    normal: { t: 22, r: 20, b: 24, l: 20 },
    narrow: { t: 15, r: 14, b: 18, l: 14 },
    wide:   { t: 28, r: 26, b: 30, l: 26 },
  };
  /* The embedded typefaces. Every cut is a real drawn weight — nothing is synthesised —
     and the same TTF bytes are inlined here and embedded into the .docx, so a document
     has one identity on every machine and in both formats.
     Source Sans 3 / Source Serif 4 / Source Code Pro, SIL OFL 1.1 (see fonts/). */
  const EMBEDDED = [
    { name: "DocForge Sans",  stem: "DocForgeSans",  family: "swiss",  pitch: "variable",
      cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 } },
    { name: "DocForge Serif", stem: "DocForgeSerif", family: "roman",  pitch: "variable",
      cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 } },
    { name: "DocForge Mono",  stem: "DocForgeMono",  family: "modern", pitch: "fixed",
      cuts: { regular: 1, bold: 1 } },
  ];
  const CUT_STYLE = {
    regular:    { weight: 400, style: "normal" },
    bold:       { weight: 700, style: "normal" },
    italic:     { weight: 400, style: "italic" },
    boldItalic: { weight: 700, style: "italic" },
  };
  const CUT_FILE = { regular: "Regular", bold: "Bold", italic: "Italic", boldItalic: "BoldItalic" };

  /* Built once at runtime from the single base64 copy the bundle carries. */
  function fontFaceCss() {
    const data = (typeof window !== "undefined" && window.__FONT_DATA__) || {};
    let css = "";
    for (const fam of EMBEDDED) {
      for (const cut of Object.keys(fam.cuts)) {
        const b64 = data[`${fam.stem}-${CUT_FILE[cut]}`];
        if (!b64) continue;
        const s = CUT_STYLE[cut];
        css += `@font-face{font-family:"${fam.name}";font-style:${s.style};font-weight:${s.weight};` +
          `font-display:block;src:url(data:font/ttf;base64,${b64}) format("truetype")}\n`;
      }
    }
    return css;
  }

  const SANS_FALLBACK = `"Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif`;
  const SERIF_FALLBACK = `Cambria, Georgia, "Times New Roman", serif`;
  const SANS = `"DocForge Sans", ${SANS_FALLBACK}`;
  const SERIF = `"DocForge Serif", ${SERIF_FALLBACK}`;

  const FONTS = {
    modern:    { head: SANS,  body: SANS },
    executive: { head: SERIF, body: SANS },
    academic:  { head: SERIF, body: SERIF },
    minimal:   { head: SANS,  body: SANS },
  };

  /* Printable width of the text column, in CSS px — the reference both exporters
     size images against, so a figure is the same size in the PDF and in Word. */
  const contentWidthPx = s => {
    const pg = PAGES[s.page] || PAGES.A4;
    const m = MARGINS[s.margins] || MARGINS.normal;
    return (pg.w - m.l - m.r) * 96 / 25.4;
  };

  const CAMERA_SVG = `<svg class="shot-ic" viewBox="0 0 24 24" fill="none" stroke="var(--a500)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.2-1.8A1.5 1.5 0 0 1 9.55 3.5h4.9a1.5 1.5 0 0 1 1.25.7L16.9 6h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.6"/></svg>`;

  /* ---------- token regexes (line-based) ---------- */
  /* [screenshot: caption | img:key | w:60% | #fig:id | noborder] — options in any order. */
  const RE_SHOT = /^\[screenshot(?::\s*([^\]|]*?))?((?:\s*\|\s*[^\]|]+)*)\]\s*$/i;
  const RE_TABLE_CAP = /^\[table:\s*([^\]|]*?)((?:\s*\|\s*[^\]|]+)*)\]\s*$/i;
  const RE_TOC = /^\[toc\]\s*$/i;
  const RE_LOF = /^\[lof\]\s*$/i;
  const RE_LOT = /^\[lot\]\s*$/i;
  const RE_BREAK = /^\[pagebreak\]\s*$/i;

  /* "| w:60% | #fig:setup | noborder" → { w:"60%", id:"fig:setup", noborder:true } */
  function parseOpts(str) {
    const o = {};
    String(str || "").split("|").map(s => s.trim()).filter(Boolean).forEach(part => {
      const kv = part.match(/^([a-z]+):(.+)$/i);
      if (part.startsWith("#")) o.id = part.slice(1);
      else if (kv && /^(img|w|width)$/i.test(kv[1])) o[kv[1].toLowerCase() === "width" ? "w" : kv[1].toLowerCase()] = kv[2].trim();
      else if (/^noborder$/i.test(part)) o.noborder = true;
      else if (/^border$/i.test(part)) o.border = true;
    });
    return o;
  }
  const RE_CO_OPEN = /^:::(note|tip|warning|important)(?:\s+(.*))?$/i;
  const RE_CO_CLOSE = /^:::\s*$/;
  const CO_LABELS = { note: "Note", tip: "Tip", warning: "Warning", important: "Important" };

  /* ---------- footnotes ----------
     `[^id]` in the prose, `[^id]: text` anywhere in the document (conventionally at the
     end). The note text is emitted INLINE at the call site as <span class="footnote">,
     which is the shape both consumers want: Paged.js moves it into the footnote area of
     whichever page the call lands on, and docx-export turns it into a real Word footnote.
     Numbering is never written into the DOM — CSS counters do it in the PDF and Word does
     it itself, so the two always agree. */
  const RE_FN_DEF = /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/;

  function extractFootnotes(lines) {
    const notes = {};
    const out = [];
    let fence = null, current = null;
    for (const line of lines) {
      const fm = line.match(/^(```+|~~~+)/);
      if (fence) { out.push(line); if (fm && fm[1][0] === fence[0] && fm[1].length >= fence.length) fence = null; continue; }
      if (fm) { fence = fm[1]; current = null; out.push(line); continue; }

      const def = line.match(RE_FN_DEF);
      if (def) { current = def[1]; notes[current] = def[2]; continue; }
      // an indented line directly under a definition continues that note
      if (current && /^[ \t]+\S/.test(line)) { notes[current] += " " + line.trim(); continue; }
      if (current && !line.trim()) { current = null; continue; }
      current = null;
      out.push(line);
    }
    return { lines: out, notes };
  }

  /* Pre-process custom tokens outside code fences. */
  function preprocess(src, settings, notesIn) {
    const raw = String(src).replace(/\r\n?/g, "\n").split("\n");
    // Definitions are lifted out first so `[^1]:` never reaches marked as a link label.
    const fx = extractFootnotes(raw);
    // Notes defined outside a callout are still callable from inside it.
    const notes = Object.assign({}, notesIn || {}, fx.notes);
    const lines = fx.lines;
    const out = [];
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const fm = line.match(/^(```+|~~~+)/);
      if (fence) { out.push(line); if (fm && fm[1][0] === fence[0] && fm[1].length >= fence.length) fence = null; continue; }
      if (fm) { fence = fm[1]; out.push(line); continue; }

      // Call sites become the note itself, inline, where the reader's eye is.
      if (line.includes("[^")) {
        line = line.replace(/\[\^([^\]\s]+)\]/g, (m, id) =>
          notes[id] == null ? m
            : `<span class="footnote">${marked.parseInline(notes[id], mdOpts(settings))}</span>`);
      }

      // Cross-references: [#fig:setup] resolves to "Figure 3" once numbering is known.
      if (line.includes("[#")) {
        line = line.replace(/\[#([A-Za-z][\w:.-]*)\]/g, (m, id) => `<a class="xref" href="#${esc(id)}"></a>`);
      }

      if (RE_TOC.test(line)) { out.push("", `<div data-toc="1"></div>`, ""); continue; }
      if (RE_LOF.test(line)) { out.push("", `<div data-list="fig"></div>`, ""); continue; }
      if (RE_LOT.test(line)) { out.push("", `<div data-list="tbl"></div>`, ""); continue; }
      if (RE_BREAK.test(line)) { out.push("", `<div class="page-break"></div>`, ""); continue; }
      const sm = line.match(RE_SHOT);
      if (sm) {
        const o = parseOpts(sm[2]);
        out.push("", `<figure class="shot${o.noborder ? " noborder" : ""}" data-caption="${esc(sm[1] || "")}" ` +
          `data-key="${esc(o.img || "")}"${o.w ? ` data-req-w="${esc(o.w)}"` : ""}${o.id ? ` id="${esc(o.id)}"` : ""}></figure>`, "");
        continue;
      }
      const tm = line.match(RE_TABLE_CAP);
      if (tm) {
        const o = parseOpts(tm[2]);
        out.push("", `<div data-tablecap="${esc(tm[1] || "")}"${o.id ? ` data-id="${esc(o.id)}"` : ""}></div>`, "");
        continue;
      }
      const cm = line.match(RE_CO_OPEN);
      if (cm) {
        const type = cm[1].toLowerCase();
        const title = (cm[2] || "").trim() || CO_LABELS[type];
        const inner = [];
        let j = i + 1, innerFence = null, depth = 0;
        for (; j < lines.length; j++) {
          const l2 = lines[j];
          const f2 = l2.match(/^(```+|~~~+)/);
          if (innerFence) { if (f2 && f2[1][0] === innerFence[0] && f2[1].length >= innerFence.length) innerFence = null; }
          else if (f2) innerFence = f2[1];
          else if (RE_CO_OPEN.test(l2)) depth++;         // a nested callout opens
          else if (RE_CO_CLOSE.test(l2)) { if (!depth) break; depth--; }
          inner.push(l2);
        }
        i = j; // skip past close (or EOF)
        // Flatten to one line so the block survives re-parsing, but keep the newlines
        // inside <pre> as character references — a code block must stay a code block.
        const innerHtml = marked.parse(preprocess(inner.join("\n"), settings, notes), mdOpts(settings))
          .replace(/<pre[\s\S]*?<\/pre>/gi, m => m.replace(/\n/g, "&#10;"))
          .replace(/\n/g, " ");
        out.push("", `<div class="callout ${type}"><div class="co-title">${esc(title)}</div><div class="co-body">${innerHtml}</div></div>`, "");
        continue;
      }
      out.push(line);
    }
    return out.join("\n");
  }

  /* ---------- micro-typography ----------
     Applied to text nodes of the rendered DOM, so it reaches the PDF and the .docx
     alike and can never corrupt markdown syntax or the inside of a code block. */
  const UNIT = "kg|g|mg|µg|t|km|cm|mm|nm|µm|m|ms|min|h|s|px|pt|em|rem|dpi|ppi|kB|KB|MB|GB|TB|bit|bps|Hz|kHz|MHz|GHz|W|kW|kWh|V|mA|A|N|J|Pa|bar|ml|L|mol|K";
  const LABEL = "Figures?|Tables?|Sections?|Chapters?|Appendix|Appendices|Equations?|Eq|Fig|Steps?|Parts?|Volumes?|Notes?|Nos?";
  const ISO_DATE = /\d{4}-\d{2}-\d{2}/;
  const NBSP = "\u00A0";

  function smartText(s) {
    return s
      .replace(/\.\.\./g, "…")
      .replace(/---/g, "—")
      .replace(/(^|[^-])--(?!-)/g, "$1–")
      // numeric ranges take an en dash, but an ISO date keeps its hyphens
      .replace(/(\d)-(?=\d)/g, (m, a, off, str) =>
        ISO_DATE.test(str.slice(Math.max(0, off - 5), off + 9)) ? m : a + "–")
      .replace(/(^|[\s([{–—])"/g, "$1“").replace(/"/g, "”")
      .replace(/(^|[\s([{–—])'/g, "$1‘").replace(/'/g, "’")
      // things that must not break across a line
      .replace(new RegExp(`\\b(${LABEL})\\.?[ \\t]+(?=[\\d(])`, "g"), `$1${NBSP}`)
      .replace(new RegExp(`(\\d)[ \\t]+(?=(?:${UNIT})\\b)`, "g"), `$1${NBSP}`)
      .replace(/(\d)[ \t]+(?=[%‰°])/g, `$1${NBSP}`);
  }

  const NO_SMART = new Set(["CODE", "PRE", "KBD", "SAMP", "SCRIPT", "STYLE", "TEXTAREA"]);

  function smartTypography(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      let p = n.parentElement, skip = false;
      while (p && p !== root) { if (NO_SMART.has(p.tagName)) { skip = true; break; } p = p.parentElement; }
      if (!skip) nodes.push(n);
    }
    nodes.forEach(n => { const v = smartText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
  }

  /* ---------- post-processing of rendered DOM ---------- */
  function postprocess(root, settings, attachments) {
    smartTypography(root);
    // 1. heading ids. An explicit `{#sec:method}` label wins over the slug, so a
    //    cross-reference keeps working when the wording of the heading changes.
    const seen = {};
    const heads = [...root.querySelectorAll("h1,h2,h3,h4,h5,h6")];
    heads.forEach(h => {
      const m = h.textContent.match(/\s*\{#([A-Za-z][\w:.-]*)\}\s*$/);
      if (m) {
        h.id = m[1];
        // strip the label out of the visible text, wherever it ended up
        const last = [...h.childNodes].reverse().find(n => n.nodeType === 3 && /\{#/.test(n.nodeValue));
        if (last) last.nodeValue = last.nodeValue.replace(/\s*\{#[A-Za-z][\w:.-]*\}\s*$/, "");
        else h.textContent = h.textContent.replace(/\s*\{#[A-Za-z][\w:.-]*\}\s*$/, "");
        return;
      }
      let id = slugify(h.textContent);
      if (seen[id] != null) id = id + "-" + (++seen[id]); else seen[id] = 0;
      h.id = id;
    });

    // 2. heading numbering
    if (settings.numbered) {
      // Number relative to the shallowest heading in the document, so a document that
      // opens on an H2 numbers 1, 1.1, 2 — not 0.1, 0.1.1, 0.2.
      const levels = heads.map(h => +h.tagName[1]).filter(l => l <= 3);
      const base = levels.length ? Math.min(...levels) : 1;
      const c = [0, 0, 0];
      heads.forEach(h => {
        const raw = +h.tagName[1];
        if (raw > 3) return;
        const lvl = raw - base + 1;
        c[lvl - 1]++; for (let k = lvl; k < 3; k++) c[k] = 0;
        const num = c.slice(0, lvl).join(".");
        const sp = document.createElement("span");
        sp.className = "hnum";
        sp.textContent = num;
        h.prepend(sp, " ");
        h.dataset.num = num;
      });
    }

    // Tag tables so the rendered column widths can be measured off the preview and
    // handed to the Word exporter (see main.js measureColumns).
    root.querySelectorAll("table").forEach((tb, i) => { tb.dataset.tid = i; });

    /* 2b. table captions — `[table: …]` on the line above the table. Numbered in their
       own sequence, so Figure 3 and Table 3 can both exist. */
    let tblNo = 0;
    root.querySelectorAll("div[data-tablecap]").forEach(marker => {
      const tb = marker.nextElementSibling;
      const capText = marker.dataset.tablecap || "";
      if (!tb || tb.tagName !== "TABLE") { marker.remove(); return; }
      tblNo++;
      const cap = document.createElement("caption");
      cap.innerHTML = `<span class="tbl-label">Table${NBSP}${tblNo}</span>${capText ? " — " + esc(capText) : ""}`;
      tb.prepend(cap);
      tb.dataset.tbl = tblNo;
      tb.dataset.caption = capText;
      if (marker.dataset.id) tb.id = marker.dataset.id;
      marker.remove();
    });

    // 3. images typed in markdown → figures
    root.querySelectorAll("p > img:only-child").forEach(img => {
      const p = img.parentElement;
      if (p.childNodes.length !== 1) return;
      const fig = document.createElement("figure");
      fig.className = "img";
      p.replaceWith(fig);
      fig.appendChild(img);
      if (img.alt) fig.dataset.caption = img.alt;
    });

    // 4. figure numbering + screenshot placeholder content
    let fig = 0, shotIdx = 0;
    const colPx = contentWidthPx(settings);
    root.querySelectorAll("figure").forEach(f => {
      const isShot = f.classList.contains("shot");
      const cap = f.dataset.caption || "";
      if (isShot) {
        f.dataset.idx = shotIdx++;
        const key = f.dataset.key;
        const att = key && attachments[key];
        f.innerHTML = "";
        if (att) {
          const img = document.createElement("img");
          img.src = att.dataUrl;
          if (att.w && att.h) {
            // An explicit `w:60%` wins; otherwise print at natural size, capped to the
            // column. height:auto keeps the ratio — the width/height attributes alone
            // would stretch the image vertically.
            const req = parseFloat(f.dataset.reqW || "");
            const pct = req > 0 ? Math.min(100, req) : Math.min(100, (att.w / colPx) * 100);
            img.width = att.w; img.height = att.h;
            img.style.width = pct + "%";
            img.style.height = "auto";
            f.dataset.w = pct.toFixed(2);
          }
          if (cap) img.alt = cap;   // accessibility, and it reaches the .docx
          f.appendChild(img);
        } else {
          const box = document.createElement("div");
          box.className = "shot-box";
          // The caption is printed once, by the figcaption below — not twice.
          box.innerHTML = `${CAMERA_SVG}<div class="shot-t">Screenshot placeholder</div>`;
          const reqBox = parseFloat(f.dataset.reqW || "");
          if (reqBox > 0) {
            box.style.width = Math.min(100, reqBox) + "%";
            box.style.marginInline = "auto";
            f.dataset.w = Math.min(100, reqBox).toFixed(2);
          }
          f.appendChild(box);
          const hint = document.createElement("div");
          hint.className = "shot-hint";
          hint.textContent = "click to attach image";
          f.appendChild(hint);
        }
      }
      if (isShot || f.dataset.caption) {
        fig++;
        const fc = document.createElement("figcaption");
        fc.innerHTML = `<span class="fig-label">Figure${NBSP}${fig}</span>${cap ? " — " + esc(smartText(cap)) : ""}`;
        f.appendChild(fc);
        f.dataset.fig = fig;
      }
    });

    /* 4b. cross-references. Numbering is settled by now, so [#fig:setup] can be filled in
       with the real "Figure 3" / "Table 4" / "Section 2.1". The label is written into the
       DOM rather than left to CSS so the Word exporter gets the same text. */
    root.querySelectorAll("a.xref").forEach(a => {
      const id = (a.getAttribute("href") || "").slice(1);
      const target = id && root.querySelector(`[id="${id.replace(/"/g, '\\"')}"]`);
      let label = "";
      if (!target) label = "??";
      else if (target.dataset && target.dataset.fig) label = `Figure${NBSP}${target.dataset.fig}`;
      else if (target.dataset && target.dataset.tbl) label = `Table${NBSP}${target.dataset.tbl}`;
      else if (/^H[1-6]$/.test(target.tagName)) {
        label = target.dataset.num ? `Section${NBSP}${target.dataset.num}` : target.textContent.trim();
      } else label = "??";
      a.textContent = label;
      if (label === "??") a.classList.add("xref-missing");
    });

    /* 4c. list of figures / list of tables, the companions to [toc] */
    root.querySelectorAll("div[data-list]").forEach(marker => {
      const kind = marker.dataset.list;
      const isFig = kind === "fig";
      const items = isFig
        ? [...root.querySelectorAll("figure[data-fig]")]
        : [...root.querySelectorAll("table[data-tbl]")];
      const wrap = document.createElement("div");
      wrap.className = "toc-wrap list-wrap";
      let html = `<div class="toc-title">${isFig ? "Figures" : "Tables"}</div><nav class="toc lst">`;
      items.forEach(el => {
        const n = isFig ? el.dataset.fig : el.dataset.tbl;
        const cap = el.dataset.caption || "";
        if (!el.id) el.id = `${isFig ? "fig" : "tbl"}-auto-${n}`;
        html += `<a class="l2" href="#${el.id}"><span class="t">` +
          `<span class="hnum">${isFig ? "Figure" : "Table"}${NBSP}${n}</span>${esc(smartText(cap))}` +
          `</span><span class="dots"></span></a>`;
      });
      html += `</nav>`;
      wrap.innerHTML = html;
      if (!items.length) wrap.innerHTML = "";
      marker.replaceWith(wrap);
    });

    // 5. TOC
    const tocMarker = root.querySelector("div[data-toc]");
    if (tocMarker) {
      const wrap = document.createElement("div");
      wrap.className = "toc-wrap";
      const entries = heads.filter(h => +h.tagName[1] <= 3 && !wrap.contains(h));
      let html = `<div class="toc-title">Contents</div><nav class="toc">`;
      entries.forEach(h => {
        const lvl = +h.tagName[1];
        const num = h.dataset.num ? `<span class="hnum">${h.dataset.num}</span>` : "";
        const txt = esc(h.textContent.replace(/^[\d.]+\s*/, settings.numbered ? "" : "$&").trim());
        html += `<a class="l${lvl}" href="#${h.id}"><span class="t">${num}${txt}</span><span class="dots"></span></a>`;
      });
      html += `</nav>`;
      wrap.innerHTML = html;
      tocMarker.replaceWith(wrap);
    }
    return { figures: fig, headings: heads.length };
  }

  /* ---------- cover ---------- */
  function coverHtml(s) {
    const dateStr = fmtDate(s.date);
    const meta = [
      s.author ? `<div class="m-strong">${esc(s.author)}</div>` : "",
      s.metaExtra ? `<div>${esc(s.metaExtra)}</div>` : "",
      dateStr ? `<div class="m-dim">${esc(dateStr)}</div>` : "",
    ].join("");
    return `<section class="cover">` +
      (s.kicker ? `<div class="cv-kicker">${esc(s.kicker)}</div>` : "") +
      `<h1 class="cv-title">${esc(s.title || "Untitled document")}</h1>` +
      (s.subtitle ? `<div class="cv-sub">${esc(s.subtitle)}</div>` : "") +
      `<div class="cv-spacer"></div><div class="cv-rule"></div>` +
      `<div class="cv-meta">${meta}</div></section>`;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso + "T12:00:00");
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    } catch { return iso; }
  }

  /* ---------- main render ---------- */
  function render(source, settings, attachments) {
    const body = marked.parse(preprocess(source, settings), mdOpts(settings));
    const doc = document.createElement("div");
    doc.className = "doc" +
      (settings.justify ? " justify" : "") +
      (settings.h1break ? " h1break" : "");
    doc.dataset.theme = settings.theme;
    // Chrome cannot hyphenate without a language, so justified text had rivers of space.
    doc.lang = settings.lang || "en";
    if (settings.cover) doc.insertAdjacentHTML("beforeend", coverHtml(settings));
    const content = document.createElement("div");
    content.className = "content";
    content.innerHTML = body;
    doc.appendChild(content);
    const meta = postprocess(content, settings, attachments);
    return { doc, meta };
  }

  /* ---------- dynamic CSS (@page + vars) ---------- */
  function dynamicCss(settings) {
    const t = tints(settings.accent);
    const f = FONTS[settings.theme] || FONTS.modern;
    const pg = PAGES[settings.page] || PAGES.A4;
    const m = MARGINS[settings.margins] || MARGINS.normal;
    const title = cssStr(settings.title || "");

    let css = `
.doc, .pagedjs_page{--a50:${t.a50};--a75:${t.a75};--a100:${t.a100};--a200:${t.a200};--a300:${t.a300};--a400:${t.a400};--a500:${t.a500};--a600:${t.a600};--a700:${t.a700};--a800:${t.a800};--a900:${t.a900};--font-head:${f.head};--font-body:${f.body};--page-w:${pg.w}mm;--page-h:${pg.h}mm;}
@page {
  size: ${pg.label};
  margin: ${m.t}mm ${m.r}mm ${m.b}mm ${m.l}mm;`;
    if (settings.header) {
      css += `
  @top-left { content: "${title}"; font-family:${f.head}; font-size:7.6pt; letter-spacing:0.13em; text-transform:uppercase; color:#828a99; margin-bottom:9mm; }
  @top-right { content: string(sect); font-family:${f.body}; font-size:7.6pt; color:#828a99; margin-bottom:9mm; max-width:60mm; overflow:hidden; }`;
    }
    if (settings.pageNums) {
      // The folio text is written per page by the PageNumbering handler in main.js, because
      // front matter and the body run on two different sequences and the body's "of N" must
      // count body pages only — neither of which a CSS page counter can express.
      css += `
  @bottom-center { content: var(--df-foot, " "); font-family:${f.body}; font-size:8.2pt; color:#71798a; margin-top:9mm; font-variant-numeric: tabular-nums; }`;
    }
    css += `
  @footnote {
    border-top: 1px solid #d7dbe0;
    padding-top: 4px;
    padding-bottom: 3px;
    margin-top: 11px;
  }
}
@page cover { margin: 0;
  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }
}
@page front {
  @top-right { content: none; }
}
.doc .content h1 { string-set: sect content(text); }
`;
    return css;
  }

  return { render, dynamicCss, fontFaceCss, tints, PAGES, MARGINS, FONTS, EMBEDDED, CUT_FILE, fmtDate, esc, RE_SHOT };
})();
