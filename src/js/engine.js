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
    { name: "DocForge Sans",       stem: "DocForgeSans",     family: "swiss",  pitch: "variable",
      cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 } },
    { name: "DocForge Serif",      stem: "DocForgeSerif",    family: "roman",  pitch: "variable",
      cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 } },
    { name: "DocForge Mono",       stem: "DocForgeMono",     family: "modern", pitch: "fixed",
      cuts: { regular: 1, bold: 1 } },
    { name: "DocForge Inter",      stem: "DocForgeInter",    family: "swiss",  pitch: "variable",
      cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 } },
    { name: "DocForge Montserrat", stem: "DocForgeMont",     family: "swiss",  pitch: "variable",
      cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 } },
    { name: "DocForge Garamond",   stem: "DocForgeGaramond", family: "roman",  pitch: "variable",
      cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 } },
    { name: "DocForge Crimson",    stem: "DocForgeCrimson",  family: "roman",  pitch: "variable",
      cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 } },
  ];

  /* Selectable text faces. `key` is what settings.fontHead / fontBody store;
     "theme" (the default) follows the theme's own pairing. */
  const FACES = {
    sans:      { name: "DocForge Sans",       kind: "sans",  label: "Source Sans — humanist" },
    serif:     { name: "DocForge Serif",      kind: "serif", label: "Source Serif — contemporary" },
    inter:     { name: "DocForge Inter",      kind: "sans",  label: "Inter — neutral" },
    mont:      { name: "DocForge Montserrat", kind: "sans",  label: "Montserrat — geometric" },
    garamond:  { name: "DocForge Garamond",   kind: "serif", label: "Garamond — classic book" },
    crimson:   { name: "DocForge Crimson",    kind: "serif", label: "Crimson — scholarly" },
  };
  const faceStack = key => {
    if (FACES[key]) return `"${FACES[key].name}", ${FACES[key].kind === "serif" ? "Georgia, serif" : "Arial, sans-serif"}`;
    if (typeof key === "string" && key.startsWith("sys:")) return sysStack(key.slice(4));
    return null;
  };
  /* The .docx writes fonts by name; embedded faces map to their real family,
     `sys:` keys pass the system family name straight through. */
  const faceName = key => FACES[key] ? FACES[key].name
    : (typeof key === "string" && key.startsWith("sys:") ? key.slice(4) : null);
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

  /* ---------- the Word font menu ----------
     The classic Office families. None of these can travel inside the file (they are
     proprietary), so the preview uses the locally installed face and the .docx names
     the family — Word supplies its own copy, which is exact parity on any machine
     with Office. `kind` only drives the CSS fallback when the face is missing. */
  const WORD_CATALOG = [
    ["Aptos", "sans"], ["Calibri", "sans"], ["Calibri Light", "sans"], ["Candara", "sans"],
    ["Corbel", "sans"], ["Segoe UI", "sans"], ["Arial", "sans"], ["Arial Black", "sans"],
    ["Arial Narrow", "sans"], ["Tahoma", "sans"], ["Verdana", "sans"], ["Trebuchet MS", "sans"],
    ["Century Gothic", "sans"], ["Franklin Gothic Medium", "sans"], ["Gill Sans MT", "sans"],
    ["Tw Cen MT", "sans"], ["Bahnschrift", "sans"], ["Berlin Sans FB", "sans"],
    ["Lucida Sans Unicode", "sans"], ["Comic Sans MS", "sans"],
    ["Cambria", "serif"], ["Constantia", "serif"], ["Times New Roman", "serif"],
    ["Georgia", "serif"], ["Garamond", "serif"], ["Book Antiqua", "serif"],
    ["Palatino Linotype", "serif"], ["Bookman Old Style", "serif"],
    ["Baskerville Old Face", "serif"], ["Bell MT", "serif"], ["Bodoni MT", "serif"],
    ["Calisto MT", "serif"], ["Century", "serif"], ["Century Schoolbook", "serif"],
    ["Goudy Old Style", "serif"], ["High Tower Text", "serif"], ["Perpetua", "serif"],
    ["Rockwell", "serif"], ["Sitka Text", "serif"], ["Elephant", "serif"],
    ["Consolas", "mono"], ["Courier New", "mono"], ["Lucida Console", "mono"], ["Cascadia Code", "mono"],
    ["Segoe Script", "script"], ["Segoe Print", "script"], ["Brush Script MT", "script"],
    ["Lucida Handwriting", "script"], ["Bradley Hand ITC", "script"], ["Mistral", "script"],
    ["Ink Free", "script"], ["Freestyle Script", "script"], ["French Script MT", "script"],
    ["Edwardian Script ITC", "script"], ["Monotype Corsiva", "script"],
    ["Impact", "display"], ["Papyrus", "display"], ["Copperplate Gothic Bold", "display"], ["Castellar", "display"],
  ];
  const GENERIC = {
    sans: "Arial, sans-serif", serif: "Georgia, serif", mono: "Consolas, monospace",
    script: '"Segoe Script", cursive', display: "Impact, sans-serif",
  };
  function sysStack(name) {
    // A typed family name lands inside generated CSS — strip anything that could
    // terminate the declaration, not just quotes.
    const clean = String(name || "").replace(/["'{};\\]/g, "").trim();
    if (!clean) return GENERIC.sans;
    if (EMBEDDED.some(f => f.name === clean)) {
      return `"${clean}", ${/Serif|Garamond|Crimson/i.test(clean) ? SERIF_FALLBACK : SANS_FALLBACK}`;
    }
    const cat = WORD_CATALOG.find(w => w[0].toLowerCase() === clean.toLowerCase());
    return `"${clean}", ${GENERIC[cat ? cat[1] : "sans"]}`;
  }

  /* ---------- Word-ribbon inline marks ----------
     Tokenizer extensions rather than preprocess regexes: an extension can never reach
     inside HTML that preprocess injected, so a `^` in a formula's data-tex or a `~`
     inside a code span stays untouched. Content is kept to one line — a stray `==` three
     paragraphs later must not swallow everything in between. */

  /* Word's fixed highlighter palette — the same names the .docx run property takes. */
  const HL_COLORS = {
    yellow: "FFFF00", green: "00FF00", cyan: "00FFFF", magenta: "FF00FF",
    blue: "0000FF", red: "FF0000", darkBlue: "00008B", darkCyan: "008B8B",
    darkGreen: "006400", darkMagenta: "8B008B", darkRed: "8B0000",
    darkYellow: "808000", darkGray: "808080", lightGray: "D3D3D3", black: "000000",
  };
  const hlKey = name =>
    Object.keys(HL_COLORS).find(k => k.toLowerCase() === String(name || "").toLowerCase());

  /* `[text]{color=#e11 bg=#ff0 size=14 font="Georgia" u sc caps}` — hex colours only,
     because that is what survives into the .docx unchanged. */
  function parseSpanAttrs(str) {
    const o = {};
    const re = /([a-z]+)(?:=("[^"]*"|\S+))?/gi;
    let m;
    while ((m = re.exec(str))) {
      const k = m[1].toLowerCase();
      let v = m[2] || "";
      if (v.startsWith('"')) v = v.slice(1, -1);
      if (k === "color" || k === "bg") {
        v = v.trim();
        if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(v)) v = "#" + v;
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) o[k] = v.toLowerCase();
      } else if (k === "size") {
        const n = parseFloat(v);
        if (n >= 5 && n <= 96) o.size = n;
      } else if (k === "font") {
        if (v.trim()) o.font = v.trim();
      } else if (k === "u" || k === "sc" || k === "caps") o[k] = true;
    }
    return o;
  }

  const expand3 = h => h.length === 4 ? "#" + [...h.slice(1)].map(c => c + c).join("") : h;

  marked.use({
    extensions: [
      {
        name: "dfUnder", level: "inline",
        start(src) { const i = src.indexOf("++"); return i < 0 ? undefined : i; },
        tokenizer(src) {
          // The closer must not run into a word — `i++ +j++` in prose stays literal.
          const m = /^\+\+(\S(?:[^\n]*?\S)?)\+\+(?!\w)/.exec(src);
          if (m) return { type: "dfUnder", raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
        },
        renderer(tok) { return `<u>${this.parser.parseInline(tok.tokens)}</u>`; },
      },
      {
        name: "dfMark", level: "inline",
        start(src) { const i = src.indexOf("=="); return i < 0 ? undefined : i; },
        tokenizer(src) {
          // The closer must end the phrase — `done==1 and i==n` in prose stays literal.
          const m = /^==(?:\{([A-Za-z]+)\})?(\S(?:[^\n]*?\S)?)==(?![=\w])/.exec(src);
          if (!m) return;
          const key = hlKey(m[1]) || "yellow";
          return { type: "dfMark", raw: m[0], hl: key, tokens: this.lexer.inlineTokens(m[2]) };
        },
        renderer(tok) {
          return `<mark data-hl="${tok.hl}" style="background:#${HL_COLORS[tok.hl]}">` +
            `${this.parser.parseInline(tok.tokens)}</mark>`;
        },
      },
      {
        name: "dfSup", level: "inline",
        start(src) { const i = src.indexOf("^"); return i < 0 ? undefined : i; },
        tokenizer(src) {
          const m = /^\^([^\s^]+)\^/.exec(src);
          if (m) return { type: "dfSup", raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
        },
        renderer(tok) { return `<sup>${this.parser.parseInline(tok.tokens)}</sup>`; },
      },
      {
        name: "dfSub", level: "inline",
        start(src) { const i = src.indexOf("~"); return i < 0 ? undefined : i; },
        tokenizer(src) {
          if (src.startsWith("~~")) return; // GFM strikethrough owns the doubled form
          const m = /^~([^\s~]+)~(?!~)/.exec(src);
          if (m) return { type: "dfSub", raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
        },
        renderer(tok) { return `<sub>${this.parser.parseInline(tok.tokens)}</sub>`; },
      },
      {
        name: "dfSpan", level: "inline",
        start(src) { const i = src.indexOf("["); return i < 0 ? undefined : i; },
        tokenizer(src) {
          const m = /^\[((?:\\.|[^\[\]\\])+)\]\{([^}\n]*)\}/.exec(src);
          if (!m) return;
          const attrs = parseSpanAttrs(m[2]);
          if (!Object.keys(attrs).length) return; // not ours — the link tokenizer can have it
          return { type: "dfSpan", raw: m[0], attrs, tokens: this.lexer.inlineTokens(m[1]) };
        },
        renderer(tok) {
          const a = tok.attrs;
          let style = "", data = "";
          if (a.color) { style += `color:${a.color};`; data += ` data-color="${expand3(a.color).slice(1)}"`; }
          if (a.bg) { style += `background:${a.bg};`; data += ` data-bg="${expand3(a.bg).slice(1)}"`; }
          if (a.size) { style += `font-size:${a.size}pt;`; data += ` data-size="${a.size}"`; }
          if (a.font) { style += `font-family:${sysStack(a.font)};`; data += ` data-font="${esc(a.font)}"`; }
          if (a.u) { style += "text-decoration:underline;"; data += ` data-u="1"`; }
          if (a.sc) { style += "font-variant:small-caps;"; data += ` data-sc="1"`; }
          if (a.caps) { style += "text-transform:uppercase;"; data += ` data-caps="1"`; }
          // esc(): the font stack carries double quotes that would end the attribute.
          return `<span class="dfspan"${data} style="${esc(style)}">${this.parser.parseInline(tok.tokens)}</span>`;
        },
      },
    ],
  });

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
  const RE_AL_OPEN = /^:::(center|right|left|justify)\s*$/i;
  /* Any line the parser would actually open a container on — and only those.
     `:::center trailing words` is plain text, so it must not count as nesting. */
  const RE_BLOCK_OPEN = /^:::(note|tip|warning|important)\b|^:::(center|right|left|justify)\s*$/i;
  const RE_CO_CLOSE = /^:::\s*$/;
  const CO_LABELS = { note: "Note", tip: "Tip", warning: "Warning", important: "Important" };

  /* Collect the lines of a ::: container starting after `i`; returns the body and the
     index of the closing ::: (or EOF). Fences and nested containers are respected. */
  function collectContainer(lines, i) {
    const inner = [];
    let j = i + 1, innerFence = null, depth = 0;
    for (; j < lines.length; j++) {
      const l2 = lines[j];
      const f2 = l2.match(/^(```+|~~~+)/);
      if (innerFence) { if (f2 && f2[1][0] === innerFence[0] && f2[1].length >= innerFence.length) innerFence = null; }
      else if (f2) innerFence = f2[1];
      else if (RE_BLOCK_OPEN.test(l2)) depth++;      // a nested container opens
      else if (RE_CO_CLOSE.test(l2)) { if (!depth) break; depth--; }
      inner.push(l2);
    }
    return { inner, end: j };
  }

  /* Run `fn` over the parts of a line that sit OUTSIDE `inline code` spans, so the
     math and citation rewrites can never corrupt code. */
  function outsideCode(line, fn) {
    return line.split(/(`+[^`]*`+)/).map((seg, i) => (i % 2 ? seg : fn(seg))).join("");
  }

  /* ---------- math ----------
     $…$ inline, $$…$$ display. Rewritten to empty spans carrying the TeX before marked
     runs (markdown must never see the TeX — underscores inside it are emphasis to
     marked); postprocess renders them with KaTeX for the page while the .docx path
     reads the same data-tex and emits real Word equations. */
  const RE_MATH_INLINE = /\$(?!\s)((?:\\.|[^$\\\n])+?)(?<![\s\\])\$/g;

  function mathToSpans(seg) {
    return seg.replace(RE_MATH_INLINE, (m, tex) => `<span class="math-inline" data-tex="${esc(tex)}"></span>`);
  }

  /* ---------- citations ----------
     `[@key]: Full reference entry` defines; `[@key]` or `[@key, p. 3]` cites.
     `[references]` places the list (appended automatically if omitted). */
  const RE_CITE_DEF = /^\[@([^\]\s,]+)\]:[ \t]*(.*)$/;
  const RE_REFS = /^\[references\]\s*$/i;

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
    const cites = {};
    const out = [];
    let fence = null, current = null; // current: {store, key} while a definition continues
    for (const line of lines) {
      const fm = line.match(/^(```+|~~~+)/);
      if (fence) { out.push(line); if (fm && fm[1][0] === fence[0] && fm[1].length >= fence.length) fence = null; continue; }
      if (fm) { fence = fm[1]; current = null; out.push(line); continue; }

      const def = line.match(RE_FN_DEF);
      if (def) { current = { store: notes, key: def[1] }; notes[def[1]] = def[2]; continue; }
      const cdef = line.match(RE_CITE_DEF);
      if (cdef) { current = { store: cites, key: cdef[1] }; cites[cdef[1]] = cdef[2]; continue; }
      // an indented line directly under a definition continues it
      if (current && /^[ \t]+\S/.test(line)) { current.store[current.key] += " " + line.trim(); continue; }
      if (current && !line.trim()) { current = null; continue; }
      current = null;
      out.push(line);
    }
    return { lines: out, notes, cites };
  }

  /* Pre-process custom tokens outside code fences. `inherited` carries footnote and
     citation definitions down into callout recursion, and `inherited.citeDefs` collects
     every citation entry back up for postprocess to build the references list from. */
  function preprocess(src, settings, inherited) {
    const raw = String(src).replace(/\r\n?/g, "\n").split("\n");
    // Definitions are lifted out first so `[^1]:` never reaches marked as a link label.
    const fx = extractFootnotes(raw);
    // Notes defined outside a callout are still callable from inside it.
    const notes = Object.assign({}, inherited && inherited.notes, fx.notes);
    const cites = Object.assign({}, inherited && inherited.cites, fx.cites);
    if (inherited && inherited.citeDefs) Object.assign(inherited.citeDefs, fx.cites);
    const lines = fx.lines;
    const out = [];
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const fm = line.match(/^(```+|~~~+)/);
      if (fence) { out.push(line); if (fm && fm[1][0] === fence[0] && fm[1].length >= fence.length) fence = null; continue; }
      if (fm) { fence = fm[1]; out.push(line); continue; }

      // Display math: a standalone $$ … $$ block, possibly spanning several lines.
      if (/^\s*\$\$/.test(line)) {
        let body = line.replace(/^\s*\$\$/, "");
        if (/\$\$\s*$/.test(body)) body = body.replace(/\$\$\s*$/, "");
        else {
          let j = i + 1;
          for (; j < lines.length && !/\$\$\s*$/.test(lines[j]); j++) body += "\n" + lines[j];
          if (j < lines.length) body += "\n" + lines[j].replace(/\$\$\s*$/, "");
          i = j;
        }
        out.push("", `<div class="math-display" data-tex="${esc(body.trim())}"></div>`, "");
        continue;
      }

      // Call sites become the note itself, inline, where the reader's eye is.
      if (line.includes("[^")) {
        line = outsideCode(line, seg => seg.replace(/\[\^([^\]\s]+)\]/g, (m, id) =>
          notes[id] == null ? m
            : `<span class="footnote">${marked.parseInline(notes[id], mdOpts(settings))}</span>`));
      }

      // Citations: [@key] / [@key, p. 3] become empty spans postprocess fills in.
      if (line.includes("[@")) {
        line = outsideCode(line, seg => seg.replace(/\[@([^\]\s,]+)(?:,\s*([^\]]+))?\]/g,
          (m, key, loc) => `<span class="cite" data-key="${esc(key)}"${loc ? ` data-loc="${esc(loc)}"` : ""}></span>`));
      }

      // Cross-references: [#fig:setup] resolves to "Figure 3" once numbering is known.
      if (line.includes("[#")) {
        line = outsideCode(line, seg =>
          seg.replace(/\[#([A-Za-z][\w:.-]*)\]/g, (m, id) => `<a class="xref" href="#${esc(id)}"></a>`));
      }

      // Inline math, outside code spans.
      if (line.includes("$")) line = outsideCode(line, mathToSpans);

      if (RE_REFS.test(line)) { out.push("", `<div data-refs="1"></div>`, ""); continue; }

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
      // Flatten to one line so the block survives re-parsing, but keep the newlines
      // inside <pre> as character references — a code block must stay a code block.
      const flatten = inner => marked.parse(
        preprocess(inner.join("\n"), settings, { notes, cites, citeDefs: inherited && inherited.citeDefs }),
        mdOpts(settings))
        .replace(/<pre[\s\S]*?<\/pre>/gi, m => m.replace(/\n/g, "&#10;"))
        .replace(/\n/g, " ");
      const cm = line.match(RE_CO_OPEN);
      if (cm) {
        const type = cm[1].toLowerCase();
        const title = (cm[2] || "").trim() || CO_LABELS[type];
        const { inner, end } = collectContainer(lines, i);
        i = end; // skip past close (or EOF)
        out.push("", `<div class="callout ${type}"><div class="co-title">${esc(title)}</div><div class="co-body">${flatten(inner)}</div></div>`, "");
        continue;
      }
      // :::center / :::right / :::left / :::justify — Word's paragraph alignment group.
      const am = line.match(RE_AL_OPEN);
      if (am) {
        const dir = am[1].toLowerCase();
        const { inner, end } = collectContainer(lines, i);
        i = end;
        out.push("", `<div class="align-${dir}">${flatten(inner)}</div>`, "");
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

  /* ---------- citations ---------- */
  function apaLabel(entry, loc) {
    // Surname = the entry up to the first comma; year = its first plausible 4-digit year.
    const surname = (entry.split(",")[0] || "").trim().replace(/\s+[A-Z]\.?$/, "") || "Anon";
    const year = (entry.match(/\b(19|20)\d{2}[a-z]?\b/) || ["n.d."])[0];
    return `(${surname}, ${year}${loc ? ", " + loc : ""})`;
  }

  function resolveCitations(root, settings, defs) {
    const spans = [...root.querySelectorAll("span.cite")];
    const refsDiv = root.querySelector("div[data-refs]");
    if (!spans.length && !refsDiv) return;

    const apa = settings.citeStyle === "apa";
    const order = [];               // keys in first-appearance order
    spans.forEach(s => {
      const key = s.dataset.key;
      if (defs[key] != null && !order.includes(key)) order.push(key);
    });

    spans.forEach(s => {
      const key = s.dataset.key, loc = s.dataset.loc || "";
      if (defs[key] == null) {
        s.textContent = `[@${key}?]`;
        s.classList.add("cite-missing");
        return;
      }
      s.textContent = apa
        ? apaLabel(defs[key], loc)
        : `[${order.indexOf(key) + 1}${loc ? ", " + loc : ""}]`;
    });

    // The references list: citation order for numeric style, alphabetical for APA.
    const keys = apa ? [...order].sort((a, b) => defs[a].localeCompare(defs[b])) : order;
    let host = refsDiv;
    if (!host && keys.length) {
      host = document.createElement("div");
      host.setAttribute("data-refs", "1");
      root.appendChild(host);
    }
    if (!host) return;
    if (!keys.length) { host.remove(); return; }

    // Labels are baked in as text, not list markers, so the PDF and the .docx print
    // exactly the same thing.
    const wrap = document.createElement("section");
    wrap.className = "refs";
    wrap.innerHTML = `<div class="refs-title">References</div>` + keys.map((k, i) =>
      `<p class="ref">${apa ? "" : `<span class="ref-n">[${i + 1}]</span> `}${marked.parseInline(smartText(defs[k]))}</p>`
    ).join("");
    host.replaceWith(wrap);
  }

  /* ---------- post-processing of rendered DOM ---------- */
  function postprocess(root, settings, attachments, citeDefs) {
    smartTypography(root);

    /* 0a. mathematics — KaTeX renders the page copy; the TeX itself stays on the node
       for the Word exporter, which turns it into a real editable equation. */
    if (typeof katex !== "undefined") {
      root.querySelectorAll(".math-inline, .math-display").forEach(el => {
        const display = el.classList.contains("math-display");
        try {
          el.innerHTML = katex.renderToString(el.dataset.tex || "", {
            output: "html", displayMode: display, throwOnError: false, strict: "ignore",
          });
        } catch (e) {
          el.textContent = el.dataset.tex || "";
          el.classList.add("math-error");
        }
      });
    }

    /* 0b. syntax highlighting — only when the fence names a language hljs knows;
       an unlabelled block stays plain, which prints better than a wrong guess. */
    if (typeof hljs !== "undefined") {
      root.querySelectorAll("pre > code[class*='language-']").forEach(code => {
        const lang = (code.className.match(/language-([\w+-]+)/) || [])[1];
        if (!lang || !hljs.getLanguage(lang)) return;
        try {
          code.innerHTML = hljs.highlight(code.textContent, { language: lang, ignoreIllegals: true }).value;
          code.classList.add("hljs");
        } catch (e) { /* leave plain */ }
      });
    }

    /* 0c. citations — numbers assigned in reading order (numeric style) or author–year
       labels (APA-ish), plus the references list itself. */
    resolveCitations(root, settings, citeDefs || {});
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
    const citeDefs = {};
    const body = marked.parse(preprocess(source, settings, { citeDefs }), mdOpts(settings));
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
    const meta = postprocess(content, settings, attachments, citeDefs);
    return { doc, meta };
  }

  /* ---------- dynamic CSS (@page + vars) ---------- */
  function dynamicCss(settings) {
    const t = tints(settings.accent);
    const themeF = FONTS[settings.theme] || FONTS.modern;
    // A chosen face overrides the theme's pairing; "theme" (or absent) follows it.
    const f = {
      head: faceStack(settings.fontHead) || themeF.head,
      body: faceStack(settings.fontBody) || themeF.body,
    };
    const pg = PAGES[settings.page] || PAGES.A4;
    const m = MARGINS[settings.margins] || MARGINS.normal;
    const title = cssStr(settings.title || "");

    /* Word's document-wide knobs: base size in points; line spacing as Word multiples
       (240 twips = single). ×1.18 is the single-space factor most faces get in Word,
       so the preview's rhythm stays honest to the .docx. Absent/legacy settings keep
       the original 11pt / 1.59 from doc.css. */
    const baseSize = parseFloat(settings.baseSize) || 11;
    const lineH = ({ "1": 1.18, "1.15": 1.36, "1.5": 1.77, "2": 2.36 })[settings.lineSpacing];

    let css = `
.doc, .pagedjs_page{--a50:${t.a50};--a75:${t.a75};--a100:${t.a100};--a200:${t.a200};--a300:${t.a300};--a400:${t.a400};--a500:${t.a500};--a600:${t.a600};--a700:${t.a700};--a800:${t.a800};--a900:${t.a900};--font-head:${f.head};--font-body:${f.body};--page-w:${pg.w}mm;--page-h:${pg.h}mm;}
@page {
  size: ${pg.label};
  margin: ${m.t}mm ${m.r}mm ${m.b}mm ${m.l}mm;`;
    if (settings.header) {
      css += `
  @top-left { content: "${title}"; font-family:${f.head}; font-size:7.6pt; letter-spacing:0.13em; text-transform:uppercase; color:#828a99; margin-bottom:6mm; }
  @top-right { content: string(sect); font-family:${f.body}; font-size:7.6pt; color:#828a99; margin-bottom:6mm; max-width:60mm; overflow:hidden; }`;
    }
    if (settings.pageNums) {
      // The folio text is written per page by the PageNumbering handler in main.js, because
      // front matter and the body run on two different sequences and the body's "of N" must
      // count body pages only — neither of which a CSS page counter can express.
      css += `
  @bottom-center { content: var(--df-foot, " "); font-family:${f.body}; font-size:8.2pt; color:#71798a; margin-top:6mm; font-variant-numeric: tabular-nums; }`;
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
    if (baseSize !== 11 || lineH) {
      css += `.doc .content{${baseSize !== 11 ? `font-size:${baseSize}pt;` : ""}${lineH ? `line-height:${lineH};` : ""}}\n`;
    }

    // Decorative page border — an overlay drawn just inside the paper edge (between
    // the edge and the running header), so it frames the page without disturbing the
    // margin boxes. The cover keeps its own full-bleed design and is exempt.
    // The styles mirror Word's page-border repertoire; the white rings inside the
    // compound styles read as gaps because the paper is always white.
    // 0.75pt = 1px, 1.5pt = 2px, 2.25pt = 3px — Chrome floors fractional border
    // widths to whole CSS pixels, so weights must land on distinct integers.
    const W = ({ fine: 0.75, medium: 1.5, bold: 2.25 })[settings.borderWeight] || 1.5;
    const C = settings.borderColor === "accent" ? t.a600 : "#3c434e";
    const bp = n => (Math.round(n * W * 100) / 100) + "pt";
    const BORDERS = {
      rule:      `border: ${bp(1)} solid ${C};`,
      double:    `border: ${bp(3)} double ${C};`,
      // three real lines: the border plus two inset rings, white gaps between
      triple:    `border: ${bp(0.8)} solid ${C}; box-shadow: inset 0 0 0 ${bp(1.6)} #fff, inset 0 0 0 ${bp(2.4)} ${C}, inset 0 0 0 ${bp(3.2)} #fff, inset 0 0 0 ${bp(4)} ${C};`,
      dashed:    `border: ${bp(1.4)} dashed ${C};`,
      dotted:    `border: ${bp(1.4)} dotted ${C};`,
      thickthin: `border: ${bp(2)} solid ${C}; box-shadow: inset 0 0 0 ${bp(1.2)} #fff, inset 0 0 0 ${bp(1.8)} ${C};`,
      thinthick: `border: ${bp(0.7)} solid ${C}; box-shadow: inset 0 0 0 ${bp(1.2)} #fff, inset 0 0 0 ${bp(3.2)} ${C};`,
    };
    if (BORDERS[settings.borderStyle]) {
      css += `
.pagedjs_page { position: relative; }
.pagedjs_page::after {
  content: "";
  position: absolute;
  inset: 3mm;   /* the outer edge; every style grows inward from here, clear of the header */
  ${BORDERS[settings.borderStyle]}
  pointer-events: none;
  z-index: 5;
}
.pagedjs_page:has(.cover)::after { content: none; }
`;
    }
    return css;
  }

  return { render, dynamicCss, fontFaceCss, tints, PAGES, MARGINS, FONTS, FACES, EMBEDDED, CUT_FILE, fmtDate, esc, RE_SHOT, WORD_CATALOG, HL_COLORS, sysStack, faceName };
})();
