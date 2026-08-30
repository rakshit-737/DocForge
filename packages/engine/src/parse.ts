/* ============================================================
   parse.ts — dialect parsing: the marked tokenizer extensions
   (Word-ribbon inline marks) and the line-based preprocess that
   rewrites custom constructs to HTML carriers before marked runs.

   Extracted 1:1 from src/js/engine.js (lines 8, 234–588). This module
   carries the ONLY top-level side effects of the package — the two
   marked.use() calls — in the same relative order as the original
   IIFE: gfm first, extensions second. Everything in themes.ts and
   util.ts is pure, so ESM evaluation order (util → themes → parse →
   render → index) cannot reorder anything observable.
   ============================================================ */

import { sysStack } from "./themes.js";
import type {
  DfMarkToken,
  DfSpanToken,
  DfSubToken,
  DfSupToken,
  DfUnderToken,
  HlColorName,
  MarkedToken,
  PreprocessInherited,
  Settings,
  SpanAttrs,
} from "./types.js";
import { esc, mdOpts } from "./util.js";

marked.use({ gfm: true });

/* `this` shapes marked hands to tokenizer/renderer extension callbacks. */
interface TokenizerThis {
  lexer: { inlineTokens(src: string): MarkedToken[] };
}
interface RendererThis {
  parser: { parseInline(tokens: MarkedToken[]): string };
}

/* ---------- Word-ribbon inline marks ----------
   Tokenizer extensions rather than preprocess regexes: an extension can never reach
   inside HTML that preprocess injected, so a `^` in a formula's data-tex or a `~`
   inside a code span stays untouched. Content is kept to one line — a stray `==` three
   paragraphs later must not swallow everything in between. */

/* Word's fixed highlighter palette — the same names the .docx run property takes. */
export const HL_COLORS: Record<HlColorName, string> = {
  yellow: "FFFF00",
  green: "00FF00",
  cyan: "00FFFF",
  magenta: "FF00FF",
  blue: "0000FF",
  red: "FF0000",
  darkBlue: "00008B",
  darkCyan: "008B8B",
  darkGreen: "006400",
  darkMagenta: "8B008B",
  darkRed: "8B0000",
  darkYellow: "808000",
  darkGray: "808080",
  lightGray: "D3D3D3",
  black: "000000",
};
export const hlKey = (name: unknown): HlColorName | undefined =>
  (Object.keys(HL_COLORS) as HlColorName[]).find(
    (k) => k.toLowerCase() === String(name || "").toLowerCase(),
  );

/* `[text]{color=#e11 bg=#ff0 size=14 font="Georgia" u sc caps}` — hex colours only,
   because that is what survives into the .docx unchanged. */
export function parseSpanAttrs(str: string): SpanAttrs {
  const o: SpanAttrs = {};
  const re = /([a-z]+)(?:=("[^"]*"|\S+))?/gi;
  let m;
  while ((m = re.exec(str))) {
    const k = m[1].toLowerCase();
    let v = m[2] || "";
    if (v.startsWith('"')) v = v.slice(1, -1);
    if (k === "color" || k === "bg") {
      v = v.trim();
      if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(v)) v = "#" + v;
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) o[k as "color" | "bg"] = v.toLowerCase();
    } else if (k === "size") {
      const n = parseFloat(v);
      if (n >= 5 && n <= 96) o.size = n;
    } else if (k === "font") {
      if (v.trim()) o.font = v.trim();
    } else if (k === "u" || k === "sc" || k === "caps") o[k as "u" | "sc" | "caps"] = true;
  }
  return o;
}

const expand3 = (h: string) =>
  h.length === 4 ? "#" + [...h.slice(1)].map((c) => c + c).join("") : h;

marked.use({
  extensions: [
    {
      name: "dfUnder",
      level: "inline",
      start(src: string) {
        const i = src.indexOf("++");
        return i < 0 ? undefined : i;
      },
      tokenizer(this: TokenizerThis, src: string) {
        // The closer must not run into a word — `i++ +j++` in prose stays literal.
        const m = /^\+\+(\S(?:[^\n]*?\S)?)\+\+(?!\w)/.exec(src);
        if (m) return { type: "dfUnder", raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
      },
      renderer(this: RendererThis, tok: DfUnderToken) {
        return `<u>${this.parser.parseInline(tok.tokens)}</u>`;
      },
    },
    {
      name: "dfMark",
      level: "inline",
      start(src: string) {
        const i = src.indexOf("==");
        return i < 0 ? undefined : i;
      },
      tokenizer(this: TokenizerThis, src: string) {
        // The closer must end the phrase — `done==1 and i==n` in prose stays literal.
        const m = /^==(?:\{([A-Za-z]+)\})?(\S(?:[^\n]*?\S)?)==(?![=\w])/.exec(src);
        if (!m) return;
        const key = hlKey(m[1]) || "yellow";
        return { type: "dfMark", raw: m[0], hl: key, tokens: this.lexer.inlineTokens(m[2]) };
      },
      renderer(this: RendererThis, tok: DfMarkToken) {
        return (
          `<mark data-hl="${tok.hl}" style="background:#${HL_COLORS[tok.hl]}">` +
          `${this.parser.parseInline(tok.tokens)}</mark>`
        );
      },
    },
    {
      name: "dfSup",
      level: "inline",
      start(src: string) {
        const i = src.indexOf("^");
        return i < 0 ? undefined : i;
      },
      tokenizer(this: TokenizerThis, src: string) {
        const m = /^\^([^\s^]+)\^/.exec(src);
        if (m) return { type: "dfSup", raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
      },
      renderer(this: RendererThis, tok: DfSupToken) {
        return `<sup>${this.parser.parseInline(tok.tokens)}</sup>`;
      },
    },
    {
      name: "dfSub",
      level: "inline",
      start(src: string) {
        const i = src.indexOf("~");
        return i < 0 ? undefined : i;
      },
      tokenizer(this: TokenizerThis, src: string) {
        if (src.startsWith("~~")) return; // GFM strikethrough owns the doubled form
        const m = /^~([^\s~]+)~(?!~)/.exec(src);
        if (m) return { type: "dfSub", raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
      },
      renderer(this: RendererThis, tok: DfSubToken) {
        return `<sub>${this.parser.parseInline(tok.tokens)}</sub>`;
      },
    },
    {
      name: "dfSpan",
      level: "inline",
      start(src: string) {
        const i = src.indexOf("[");
        return i < 0 ? undefined : i;
      },
      tokenizer(this: TokenizerThis, src: string) {
        const m = /^\[((?:\\.|[^[\]\\])+)\]\{([^}\n]*)\}/.exec(src);
        if (!m) return;
        const attrs = parseSpanAttrs(m[2]);
        if (!Object.keys(attrs).length) return; // not ours — the link tokenizer can have it
        return { type: "dfSpan", raw: m[0], attrs, tokens: this.lexer.inlineTokens(m[1]) };
      },
      renderer(this: RendererThis, tok: DfSpanToken) {
        const a = tok.attrs;
        let style = "",
          data = "";
        if (a.color) {
          style += `color:${a.color};`;
          data += ` data-color="${expand3(a.color).slice(1)}"`;
        }
        if (a.bg) {
          style += `background:${a.bg};`;
          data += ` data-bg="${expand3(a.bg).slice(1)}"`;
        }
        if (a.size) {
          style += `font-size:${a.size}pt;`;
          data += ` data-size="${a.size}"`;
        }
        if (a.font) {
          style += `font-family:${sysStack(a.font)};`;
          data += ` data-font="${esc(a.font)}"`;
        }
        if (a.u) {
          style += "text-decoration:underline;";
          data += ` data-u="1"`;
        }
        if (a.sc) {
          style += "font-variant:small-caps;";
          data += ` data-sc="1"`;
        }
        if (a.caps) {
          style += "text-transform:uppercase;";
          data += ` data-caps="1"`;
        }
        // esc(): the font stack carries double quotes that would end the attribute.
        return `<span class="dfspan"${data} style="${esc(style)}">${this.parser.parseInline(tok.tokens)}</span>`;
      },
    },
  ],
});

/* ---------- token regexes (line-based) ---------- */
/* [screenshot: caption | img:key | w:60% | #fig:id | noborder] — options in any order. */
export const RE_SHOT = /^\[screenshot(?::\s*([^\]|]*?))?((?:\s*\|\s*[^\]|]+)*)\]\s*$/i;
const RE_TABLE_CAP = /^\[table:\s*([^\]|]*?)((?:\s*\|\s*[^\]|]+)*)\]\s*$/i;
const RE_TOC = /^\[toc\]\s*$/i;
const RE_LOF = /^\[lof\]\s*$/i;
const RE_LOT = /^\[lot\]\s*$/i;
const RE_BREAK = /^\[pagebreak\]\s*$/i;

/* "| w:60% | #fig:setup | noborder" → { w:"60%", id:"fig:setup", noborder:true } */
export function parseOpts(str: string | undefined): {
  img?: string;
  w?: string;
  id?: string;
  noborder?: boolean;
  border?: boolean;
} {
  const o: { img?: string; w?: string; id?: string; noborder?: boolean; border?: boolean } = {};
  String(str || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((part) => {
      const kv = part.match(/^([a-z]+):(.+)$/i);
      if (part.startsWith("#")) o.id = part.slice(1);
      else if (kv && /^(img|w|width)$/i.test(kv[1]))
        o[(kv[1].toLowerCase() === "width" ? "w" : kv[1].toLowerCase()) as "img" | "w"] =
          kv[2].trim();
      else if (/^noborder$/i.test(part)) o.noborder = true;
      else if (/^border$/i.test(part)) o.border = true;
    });
  return o;
}
const RE_CO_OPEN = /^:::(note|tip|warning|important)(?:\s+(.*))?$/i;
const RE_AL_OPEN = /^:::(center|right|left|justify)\s*$/i;
/* A title plate: a filled band the full width of the text block, first line set
   large, the rest small in a light accent tint. The fill is a fixed deep slate
   rather than an accent tint, so it reads as a plate under every accent colour. */
const RE_BN_OPEN = /^:::banner\s*$/i;
/* Any line the parser would actually open a container on — and only those.
   `:::center trailing words` is plain text, so it must not count as nesting. */
const RE_BLOCK_OPEN =
  /^:::(note|tip|warning|important)\b|^:::(center|right|left|justify|banner)\s*$/i;
const RE_CO_CLOSE = /^:::\s*$/;
const CO_LABELS: Record<string, string> = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
  important: "Important",
};

/* Collect the lines of a ::: container starting after `i`; returns the body and the
   index of the closing ::: (or EOF). Fences and nested containers are respected. */
export function collectContainer(lines: string[], i: number): { inner: string[]; end: number } {
  const inner: string[] = [];
  let j = i + 1,
    innerFence: string | null = null,
    depth = 0;
  for (; j < lines.length; j++) {
    const l2 = lines[j];
    const f2 = l2.match(/^(```+|~~~+)/);
    if (innerFence) {
      if (f2 && f2[1][0] === innerFence[0] && f2[1].length >= innerFence.length) innerFence = null;
    } else if (f2) innerFence = f2[1];
    else if (RE_BLOCK_OPEN.test(l2))
      depth++; // a nested container opens
    else if (RE_CO_CLOSE.test(l2)) {
      if (!depth) break;
      depth--;
    }
    inner.push(l2);
  }
  return { inner, end: j };
}

/* Run `fn` over the parts of a line that sit OUTSIDE `inline code` spans, so the
   math and citation rewrites can never corrupt code. */
export function outsideCode(line: string, fn: (seg: string) => string): string {
  return line
    .split(/(`+[^`]*`+)/)
    .map((seg, i) => (i % 2 ? seg : fn(seg)))
    .join("");
}

/* ---------- math ----------
   $…$ inline, $$…$$ display. Rewritten to empty spans carrying the TeX before marked
   runs (markdown must never see the TeX — underscores inside it are emphasis to
   marked); postprocess renders them with KaTeX for the page while the .docx path
   reads the same data-tex and emits real Word equations. */
const RE_MATH_INLINE = /\$(?!\s)((?:\\.|[^$\\\n])+?)(?<![\s\\])\$/g;

export function mathToSpans(seg: string): string {
  return seg.replace(
    RE_MATH_INLINE,
    (m, tex) => `<span class="math-inline" data-tex="${esc(tex)}"></span>`,
  );
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

export function extractFootnotes(lines: string[]): {
  lines: string[];
  notes: Record<string, string>;
  cites: Record<string, string>;
  nos: number[];
} {
  const notes: Record<string, string> = {};
  const cites: Record<string, string> = {};
  const out: string[] = [];
  const nos: number[] = []; // original line index of each kept line — feeds the source map
  let fence: string | null = null,
    current: { store: Record<string, string>; key: string } | null = null; // current: {store, key} while a definition continues
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const keep = () => {
      out.push(line);
      nos.push(i);
    };
    const fm = line.match(/^(```+|~~~+)/);
    if (fence) {
      keep();
      if (fm && fm[1][0] === fence[0] && fm[1].length >= fence.length) fence = null;
      continue;
    }
    if (fm) {
      fence = fm[1];
      current = null;
      keep();
      continue;
    }

    const def = line.match(RE_FN_DEF);
    if (def) {
      current = { store: notes, key: def[1] };
      notes[def[1]] = def[2];
      continue;
    }
    const cdef = line.match(RE_CITE_DEF);
    if (cdef) {
      current = { store: cites, key: cdef[1] };
      cites[cdef[1]] = cdef[2];
      continue;
    }
    // an indented line directly under a definition continues it
    if (current && /^[ \t]+\S/.test(line)) {
      current.store[current.key] += " " + line.trim();
      continue;
    }
    if (current && !line.trim()) {
      current = null;
      continue;
    }
    current = null;
    keep();
  }
  return { lines: out, notes, cites, nos };
}

/* Pre-process custom tokens outside code fences. `inherited` carries footnote and
   citation definitions down into callout recursion, and `inherited.citeDefs` collects
   every citation entry back up for postprocess to build the references list from. */
export function preprocess(
  src: string,
  settings: Settings | undefined,
  inherited?: PreprocessInherited,
): string {
  const raw = String(src).replace(/\r\n?/g, "\n").split("\n");
  // Definitions are lifted out first so `[^1]:` never reaches marked as a link label.
  const fx = extractFootnotes(raw);
  // Notes defined outside a callout are still callable from inside it.
  const notes = Object.assign({}, inherited && inherited.notes, fx.notes);
  const cites = Object.assign({}, inherited && inherited.cites, fx.cites);
  if (inherited && inherited.citeDefs) Object.assign(inherited.citeDefs, fx.cites);
  const lines = fx.lines;
  const out: string[] = [];
  /* Source map for direct manuscript editing: one {s, e} of ORIGINAL source
     lines per emitted line, filled only when the caller passes an array
     (nested callout recursion flattens and doesn't need one). */
  const map = inherited && Array.isArray(inherited.lineMap) ? inherited.lineMap : null;
  let curS = 0,
    curE = 0;
  const push = (...ls: string[]) => {
    for (const l of ls) {
      out.push(l);
      if (map) map.push({ s: curS, e: curE });
    }
  };
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    curS = curE = fx.nos[i];
    const fm = line.match(/^(```+|~~~+)/);
    if (fence) {
      push(line);
      if (fm && fm[1][0] === fence[0] && fm[1].length >= fence.length) fence = null;
      continue;
    }
    if (fm) {
      fence = fm[1];
      push(line);
      continue;
    }

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
      curE = fx.nos[Math.min(i, fx.nos.length - 1)];
      push("", `<div class="math-display" data-tex="${esc(body.trim())}"></div>`, "");
      continue;
    }

    // Call sites become the note itself, inline, where the reader's eye is.
    if (line.includes("[^")) {
      line = outsideCode(line, (seg) =>
        seg.replace(/\[\^([^\]\s]+)\]/g, (m, id) =>
          notes[id] == null
            ? m
            : `<span class="footnote" data-fn="${esc(id)}">${marked.parseInline(notes[id], mdOpts(settings))}</span>`,
        ),
      );
    }

    // Citations: [@key] / [@key, p. 3] become empty spans postprocess fills in.
    if (line.includes("[@")) {
      line = outsideCode(line, (seg) =>
        seg.replace(
          /\[@([^\]\s,]+)(?:,\s*([^\]]+))?\]/g,
          (m, key, loc) =>
            `<span class="cite" data-key="${esc(key)}"${loc ? ` data-loc="${esc(loc)}"` : ""}></span>`,
        ),
      );
    }

    // Cross-references: [#fig:setup] resolves to "Figure 3" once numbering is known.
    if (line.includes("[#")) {
      line = outsideCode(line, (seg) =>
        seg.replace(
          /\[#([A-Za-z][\w:.-]*)\]/g,
          (m, id) => `<a class="xref" href="#${esc(id)}"></a>`,
        ),
      );
    }

    // Inline math, outside code spans.
    if (line.includes("$")) line = outsideCode(line, mathToSpans);

    if (RE_REFS.test(line)) {
      push("", `<div data-refs="1"></div>`, "");
      continue;
    }

    if (RE_TOC.test(line)) {
      push("", `<div data-toc="1"></div>`, "");
      continue;
    }
    if (RE_LOF.test(line)) {
      push("", `<div data-list="fig"></div>`, "");
      continue;
    }
    if (RE_LOT.test(line)) {
      push("", `<div data-list="tbl"></div>`, "");
      continue;
    }
    if (RE_BREAK.test(line)) {
      push("", `<div class="page-break"></div>`, "");
      continue;
    }
    const sm = line.match(RE_SHOT);
    if (sm) {
      const o = parseOpts(sm[2]);
      push(
        "",
        `<figure class="shot${o.noborder ? " noborder" : ""}" data-caption="${esc(sm[1] || "")}" ` +
          `data-key="${esc(o.img || "")}"${o.w ? ` data-req-w="${esc(o.w)}"` : ""}${o.id ? ` id="${esc(o.id)}"` : ""}></figure>`,
        "",
      );
      continue;
    }
    const tm = line.match(RE_TABLE_CAP);
    if (tm) {
      const o = parseOpts(tm[2]);
      push(
        "",
        `<div data-tablecap="${esc(tm[1] || "")}"${o.id ? ` data-id="${esc(o.id)}"` : ""}></div>`,
        "",
      );
      continue;
    }
    // Flatten to one line so the block survives re-parsing, but keep the newlines
    // inside <pre> as character references — a code block must stay a code block.
    const flatten = (inner: string[]) =>
      marked
        .parse(
          preprocess(inner.join("\n"), settings, {
            notes,
            cites,
            citeDefs: inherited && inherited.citeDefs,
          }),
          mdOpts(settings),
        )
        .replace(/<pre[\s\S]*?<\/pre>/gi, (m) => m.replace(/\n/g, "&#10;"))
        .replace(/\n/g, " ");
    const cm = line.match(RE_CO_OPEN);
    if (cm) {
      const type = cm[1].toLowerCase();
      const title = (cm[2] || "").trim() || CO_LABELS[type];
      const { inner, end } = collectContainer(lines, i);
      i = end; // skip past close (or EOF)
      curE = fx.nos[Math.min(i, fx.nos.length - 1)];
      push(
        "",
        `<div class="callout ${type}"><div class="co-title">${esc(title)}</div><div class="co-body">${flatten(inner)}</div></div>`,
        "",
      );
      continue;
    }
    // :::banner — the title plate.
    if (RE_BN_OPEN.test(line)) {
      const { inner, end } = collectContainer(lines, i);
      i = end;
      curE = fx.nos[Math.min(i, fx.nos.length - 1)];
      push("", `<div class="banner">${flatten(inner)}</div>`, "");
      continue;
    }
    // :::center / :::right / :::left / :::justify — Word's paragraph alignment group.
    const am = line.match(RE_AL_OPEN);
    if (am) {
      const dir = am[1].toLowerCase();
      const { inner, end } = collectContainer(lines, i);
      i = end;
      curE = fx.nos[Math.min(i, fx.nos.length - 1)];
      push("", `<div class="align-${dir}">${flatten(inner)}</div>`, "");
      continue;
    }
    push(line);
  }
  return out.join("\n");
}
