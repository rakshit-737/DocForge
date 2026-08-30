/* ============================================================
   render.ts — the rendered-DOM half of the pipeline: render() itself,
   micro-typography, citation resolution, and the postprocess walk
   (headings/TOC/xref/figures/tables/footnote islands).

   Extracted 1:1 from src/js/engine.js (lines 349–357, 590–990).
   Pure function/const declarations — no top-level side effects.
   NOTE this half touches the DOM (document.createElement, TreeWalker,
   template.innerHTML) — accepted for Phase 1, the boundary moves with
   the AST redesign (MASTER-PROMPT §4.1).
   ============================================================ */

import { preprocess } from "./parse.js";
import { MARGINS, PAGES } from "./themes.js";
import type {
  Attachments,
  LineSpan,
  MarkedToken,
  RenderMeta,
  RenderResult,
  Settings,
} from "./types.js";
import { esc, mdOpts, slugify } from "./util.js";

/* Printable width of the text column, in CSS px — the reference both exporters
   size images against, so a figure is the same size in the PDF and in Word. */
export const contentWidthPx = (s: Settings): number => {
  const pg = PAGES[s.page as string] || PAGES.A4;
  const m = MARGINS[s.margins as string] || MARGINS.normal;
  return ((pg.w - m.l - m.r) * 96) / 25.4;
};

const CAMERA_SVG = `<svg class="shot-ic" viewBox="0 0 24 24" fill="none" stroke="var(--a500)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.2-1.8A1.5 1.5 0 0 1 9.55 3.5h4.9a1.5 1.5 0 0 1 1.25.7L16.9 6h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.6"/></svg>`;

/* ---------- micro-typography ----------
   Applied to text nodes of the rendered DOM, so it reaches the PDF and the .docx
   alike and can never corrupt markdown syntax or the inside of a code block. */
const UNIT =
  "kg|g|mg|µg|t|km|cm|mm|nm|µm|m|ms|min|h|s|px|pt|em|rem|dpi|ppi|kB|KB|MB|GB|TB|bit|bps|Hz|kHz|MHz|GHz|W|kW|kWh|V|mA|A|N|J|Pa|bar|ml|L|mol|K";
const LABEL =
  "Figures?|Tables?|Sections?|Chapters?|Appendix|Appendices|Equations?|Eq|Fig|Steps?|Parts?|Volumes?|Notes?|Nos?";
const ISO_DATE = /\d{4}-\d{2}-\d{2}/;
const NBSP = "\u00A0";

export function smartText(s: string): string {
  return (
    s
      .replace(/\.\.\./g, "…")
      .replace(/---/g, "—")
      .replace(/(^|[^-])--(?!-)/g, "$1–")
      // numeric ranges take an en dash, but an ISO date keeps its hyphens
      .replace(/(\d)-(?=\d)/g, (m: string, a: string, off: number, str: string) =>
        ISO_DATE.test(str.slice(Math.max(0, off - 5), off + 9)) ? m : a + "–",
      )
      .replace(/(^|[\s([{–—])"/g, "$1“")
      .replace(/"/g, "”")
      .replace(/(^|[\s([{–—])'/g, "$1‘")
      .replace(/'/g, "’")
      // things that must not break across a line
      .replace(new RegExp(`\\b(${LABEL})\\.?[ \\t]+(?=[\\d(])`, "g"), `$1${NBSP}`)
      .replace(new RegExp(`(\\d)[ \\t]+(?=(?:${UNIT})\\b)`, "g"), `$1${NBSP}`)
      .replace(/(\d)[ \t]+(?=[%‰°])/g, `$1${NBSP}`)
  );
}

const NO_SMART = new Set(["CODE", "PRE", "KBD", "SAMP", "SCRIPT", "STYLE", "TEXTAREA"]);

export function smartTypography(root: Element): void {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Node[] = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    let p = n.parentElement,
      skip = false;
    while (p && p !== root) {
      if (NO_SMART.has(p.tagName)) {
        skip = true;
        break;
      }
      p = p.parentElement;
    }
    if (!skip) nodes.push(n);
  }
  nodes.forEach((n) => {
    const v = smartText(n.nodeValue as string);
    if (v !== n.nodeValue) n.nodeValue = v;
  });
}

/* ---------- citations ---------- */
export function apaLabel(entry: string, loc: string): string {
  // Surname = the entry up to the first comma; year = its first plausible 4-digit year.
  const surname = (entry.split(",")[0] || "").trim().replace(/\s+[A-Z]\.?$/, "") || "Anon";
  const year = (entry.match(/\b(19|20)\d{2}[a-z]?\b/) || ["n.d."])[0];
  return `(${surname}, ${year}${loc ? ", " + loc : ""})`;
}

export function resolveCitations(
  root: Element,
  settings: Settings,
  defs: Record<string, string>,
): void {
  const spans = [...root.querySelectorAll<HTMLSpanElement>("span.cite")];
  const refsDiv = root.querySelector<HTMLDivElement>("div[data-refs]");
  if (!spans.length && !refsDiv) return;

  const apa = settings.citeStyle === "apa";
  const order: string[] = []; // keys in first-appearance order
  spans.forEach((s) => {
    const key = s.dataset.key as string;
    if (defs[key] != null && !order.includes(key)) order.push(key);
  });

  spans.forEach((s) => {
    const key = s.dataset.key as string,
      loc = s.dataset.loc || "";
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
  let host: HTMLElement | null = refsDiv;
  if (!host && keys.length) {
    host = document.createElement("div");
    host.setAttribute("data-refs", "1");
    root.appendChild(host);
  }
  if (!host) return;
  if (!keys.length) {
    host.remove();
    return;
  }

  // Labels are baked in as text, not list markers, so the PDF and the .docx print
  // exactly the same thing.
  const wrap = document.createElement("section");
  wrap.className = "refs";
  wrap.innerHTML =
    `<div class="refs-title">References</div>` +
    keys
      .map(
        (k, i) =>
          `<p class="ref">${apa ? "" : `<span class="ref-n">[${i + 1}]</span> `}${marked.parseInline(smartText(defs[k]))}</p>`,
      )
      .join("");
  if (host.dataset && host.dataset.ss != null) {
    wrap.dataset.ss = host.dataset.ss;
    wrap.dataset.se = host.dataset.se;
  }
  host.replaceWith(wrap);
}

/* ---------- post-processing of rendered DOM ---------- */
export function postprocess(
  root: HTMLElement,
  settings: Settings,
  attachments: Attachments,
  citeDefs?: Record<string, string>,
): RenderMeta {
  smartTypography(root);

  /* 0a. mathematics — KaTeX renders the page copy; the TeX itself stays on the node
     for the Word exporter, which turns it into a real editable equation. */
  if (typeof katex !== "undefined") {
    root.querySelectorAll<HTMLElement>(".math-inline, .math-display").forEach((el) => {
      const display = el.classList.contains("math-display");
      try {
        el.innerHTML = katex.renderToString(el.dataset.tex || "", {
          output: "html",
          displayMode: display,
          throwOnError: false,
          strict: "ignore",
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
    root.querySelectorAll<HTMLElement>("pre > code[class*='language-']").forEach((code) => {
      const lang = (code.className.match(/language-([\w+-]+)/) || [])[1];
      if (!lang || !hljs.getLanguage(lang)) return;
      try {
        code.innerHTML = hljs.highlight(code.textContent as string, {
          language: lang,
          ignoreIllegals: true,
        }).value;
        code.classList.add("hljs");
      } catch (e) {
        /* leave plain */
      }
    });
  }

  /* 0c. citations — numbers assigned in reading order (numeric style) or author–year
     labels (APA-ish), plus the references list itself. */
  resolveCitations(root, settings, citeDefs || {});
  // 1. heading ids. An explicit `{#sec:method}` label wins over the slug, so a
  //    cross-reference keeps working when the wording of the heading changes.
  const seen: Record<string, number> = {};
  const heads = [...root.querySelectorAll<HTMLHeadingElement>("h1,h2,h3,h4,h5,h6")];
  heads.forEach((h) => {
    const m = (h.textContent as string).match(/\s*\{#([A-Za-z][\w:.-]*)\}\s*$/);
    if (m) {
      h.id = m[1];
      h.dataset.label = m[1]; // an explicit label must survive a round-trip through direct editing
      // strip the label out of the visible text, wherever it ended up
      const last = [...h.childNodes]
        .reverse()
        .find((n) => n.nodeType === 3 && /\{#/.test(n.nodeValue as string));
      if (last)
        last.nodeValue = (last.nodeValue as string).replace(/\s*\{#[A-Za-z][\w:.-]*\}\s*$/, "");
      else h.textContent = (h.textContent as string).replace(/\s*\{#[A-Za-z][\w:.-]*\}\s*$/, "");
      return;
    }
    let id = slugify(h.textContent as string);
    if (seen[id] != null) id = id + "-" + ++seen[id];
    else seen[id] = 0;
    h.id = id;
  });

  // 2. heading numbering
  if (settings.numbered) {
    // Number relative to the shallowest heading in the document, so a document that
    // opens on an H2 numbers 1, 1.1, 2 — not 0.1, 0.1.1, 0.2.
    const levels = heads.map((h) => +h.tagName[1]).filter((l) => l <= 3);
    const base = levels.length ? Math.min(...levels) : 1;
    const c = [0, 0, 0];
    heads.forEach((h) => {
      const raw = +h.tagName[1];
      if (raw > 3) return;
      const lvl = raw - base + 1;
      c[lvl - 1]++;
      for (let k = lvl; k < 3; k++) c[k] = 0;
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
  root.querySelectorAll("table").forEach((tb, i) => {
    tb.dataset.tid = i as unknown as string;
  });

  /* 2b. table captions — `[table: …]` on the line above the table. Numbered in their
     own sequence, so Figure 3 and Table 3 can both exist. */
  let tblNo = 0;
  root.querySelectorAll<HTMLDivElement>("div[data-tablecap]").forEach((marker) => {
    const tb = marker.nextElementSibling as HTMLTableElement | null;
    const capText = marker.dataset.tablecap || "";
    if (!tb || tb.tagName !== "TABLE") {
      marker.remove();
      return;
    }
    tblNo++;
    const cap = document.createElement("caption");
    cap.innerHTML = `<span class="tbl-label">Table${NBSP}${tblNo}</span>${capText ? " — " + esc(capText) : ""}`;
    tb.prepend(cap);
    tb.dataset.tbl = tblNo as unknown as string;
    tb.dataset.caption = capText;
    if (marker.dataset.id) {
      tb.id = marker.dataset.id;
      tb.dataset.explicitId = "1";
    }
    // the caption line belongs to the table's source span from here on
    if (marker.dataset.ss != null) tb.dataset.ss = marker.dataset.ss;
    marker.remove();
  });

  // 3. images typed in markdown → figures
  root.querySelectorAll<HTMLImageElement>("p > img:only-child").forEach((img) => {
    const p = img.parentElement as HTMLElement;
    if (p.childNodes.length !== 1) return;
    const fig = document.createElement("figure");
    fig.className = "img";
    if (p.dataset.ss != null) {
      fig.dataset.ss = p.dataset.ss;
      fig.dataset.se = p.dataset.se;
    }
    p.replaceWith(fig);
    fig.appendChild(img);
    if (img.alt) fig.dataset.caption = img.alt;
  });

  // 4. figure numbering + screenshot placeholder content
  let fig = 0,
    shotIdx = 0;
  const colPx = contentWidthPx(settings);
  root.querySelectorAll("figure").forEach((f) => {
    const isShot = f.classList.contains("shot");
    const cap = f.dataset.caption || "";
    if (isShot) {
      f.dataset.idx = shotIdx++ as unknown as string;
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
          img.width = att.w;
          img.height = att.h;
          img.style.width = pct + "%";
          img.style.height = "auto";
          f.dataset.w = pct.toFixed(2);
        }
        if (cap) img.alt = cap; // accessibility, and it reaches the .docx
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
      f.dataset.fig = fig as unknown as string;
    }
  });

  /* 4b. cross-references. Numbering is settled by now, so [#fig:setup] can be filled in
     with the real "Figure 3" / "Table 4" / "Section 2.1". The label is written into the
     DOM rather than left to CSS so the Word exporter gets the same text. */
  root.querySelectorAll<HTMLAnchorElement>("a.xref").forEach((a) => {
    const id = (a.getAttribute("href") || "").slice(1);
    const target = id && root.querySelector<HTMLElement>(`[id="${id.replace(/"/g, '\\"')}"]`);
    let label = "";
    if (!target) label = "??";
    else if (target.dataset && target.dataset.fig) label = `Figure${NBSP}${target.dataset.fig}`;
    else if (target.dataset && target.dataset.tbl) label = `Table${NBSP}${target.dataset.tbl}`;
    else if (/^H[1-6]$/.test(target.tagName)) {
      label = target.dataset.num
        ? `Section${NBSP}${target.dataset.num}`
        : (target.textContent as string).trim();
    } else label = "??";
    a.textContent = label;
    if (label === "??") a.classList.add("xref-missing");
  });

  /* 4c. list of figures / list of tables, the companions to [toc] */
  root.querySelectorAll<HTMLDivElement>("div[data-list]").forEach((marker) => {
    const kind = marker.dataset.list;
    const isFig = kind === "fig";
    const items = isFig
      ? [...root.querySelectorAll<HTMLElement>("figure[data-fig]")]
      : [...root.querySelectorAll<HTMLElement>("table[data-tbl]")];
    const wrap = document.createElement("div");
    wrap.className = "toc-wrap list-wrap";
    let html = `<div class="toc-title">${isFig ? "Figures" : "Tables"}</div><nav class="toc lst">`;
    items.forEach((el) => {
      const n = isFig ? el.dataset.fig : el.dataset.tbl;
      const cap = el.dataset.caption || "";
      if (!el.id) el.id = `${isFig ? "fig" : "tbl"}-auto-${n}`;
      html +=
        `<a class="l2" href="#${el.id}"><span class="t">` +
        `<span class="hnum">${isFig ? "Figure" : "Table"}${NBSP}${n}</span>${esc(smartText(cap))}` +
        `</span><span class="dots"></span></a>`;
    });
    html += `</nav>`;
    wrap.innerHTML = html;
    if (!items.length) wrap.innerHTML = "";
    if (marker.dataset.ss != null) {
      wrap.dataset.ss = marker.dataset.ss;
      wrap.dataset.se = marker.dataset.se;
    }
    wrap.dataset.kind = kind as string; // the serializer emits [lof] / [lot] from this
    marker.replaceWith(wrap);
  });

  // 5. TOC
  const tocMarker = root.querySelector<HTMLDivElement>("div[data-toc]");
  if (tocMarker) {
    const wrap = document.createElement("div");
    wrap.className = "toc-wrap";
    const entries = heads.filter((h) => +h.tagName[1] <= 3 && !wrap.contains(h));
    let html = `<div class="toc-title">Contents</div><nav class="toc">`;
    entries.forEach((h) => {
      const lvl = +h.tagName[1];
      const num = h.dataset.num ? `<span class="hnum">${h.dataset.num}</span>` : "";
      const txt = esc(
        (h.textContent as string).replace(/^[\d.]+\s*/, settings.numbered ? "" : "$&").trim(),
      );
      html += `<a class="l${lvl}" href="#${h.id}"><span class="t">${num}${txt}</span><span class="dots"></span></a>`;
    });
    html += `</nav>`;
    wrap.innerHTML = html;
    if (tocMarker.dataset.ss != null) {
      wrap.dataset.ss = tocMarker.dataset.ss;
      wrap.dataset.se = tocMarker.dataset.se;
    }
    tocMarker.replaceWith(wrap);
  }

  /* 6. direct-editing prep: generated or non-invertible islands must not take
     the caret — their text is derived (TOC folios, reference labels, resolved
     cross-references, KaTeX output, figure furniture, auto heading numbers),
     so an edit there could never be written back to source. */
  root
    .querySelectorAll(
      ".toc-wrap, .refs, figure, .math-display, .math-inline, span.footnote, a.xref, span.cite, .hnum, .page-break",
    )
    .forEach((el) => el.setAttribute("contenteditable", "false"));

  return { figures: fig, headings: heads.length };
}

/* ---------- cover ---------- */
export function coverHtml(s: Settings): string {
  const dateStr = fmtDate(s.date);
  const meta = [
    s.author ? `<div class="m-strong">${esc(s.author)}</div>` : "",
    s.metaExtra ? `<div>${esc(s.metaExtra)}</div>` : "",
    dateStr ? `<div class="m-dim">${esc(dateStr)}</div>` : "",
  ].join("");
  return (
    `<section class="cover" contenteditable="false">` +
    (s.kicker ? `<div class="cv-kicker">${esc(s.kicker)}</div>` : "") +
    `<h1 class="cv-title">${esc(s.title || "Untitled document")}</h1>` +
    (s.subtitle ? `<div class="cv-sub">${esc(s.subtitle)}</div>` : "") +
    `<div class="cv-spacer"></div><div class="cv-rule"></div>` +
    `<div class="cv-meta">${meta}</div></section>`
  );
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

/* ---------- main render ----------
   The body is assembled token by token rather than in one marked.parse pass,
   so every top-level block can carry its span of ORIGINAL source lines
   (data-ss / data-se). That stamp is what lets the manuscript be edited
   directly: a changed block serializes back to Markdown and splices into
   exactly those lines. One lexer pass first (inline tokens and reference
   links resolve there), then each top-level token renders separately. */
export function render(
  source: string,
  settings: Settings,
  attachments?: Attachments,
): RenderResult {
  const citeDefs: Record<string, string> = {};
  const lineMap: LineSpan[] = [];
  const pre = preprocess(source, settings, { citeDefs, lineMap });
  /* marked.parse merges options over its defaults, but the low-level
     lexer/parser pair REPLACES them — spread the defaults back in or
     gfm (tables, strikethrough) silently switches off. */
  const opts = { ...marked.defaults, ...mdOpts(settings) };
  const tokens = marked.lexer(pre, opts);
  const doc = document.createElement("div");
  doc.className =
    "doc" + (settings.justify ? " justify" : "") + (settings.h1break ? " h1break" : "");
  doc.dataset.theme = settings.theme as string;
  // Chrome cannot hyphenate without a language, so justified text had rivers of space.
  doc.lang = settings.lang || "en";
  if (settings.cover) doc.insertAdjacentHTML("beforeend", coverHtml(settings));
  const content = document.createElement("div");
  content.className = "content";
  const tpl = document.createElement("template");
  let preLine = 0;
  for (const tok of tokens as MarkedToken[]) {
    const nl = (tok.raw.match(/\n/g) || []).length;
    const startLine = preLine;
    const endLine = preLine + Math.max(0, nl - (tok.raw.endsWith("\n") ? 1 : 0));
    preLine += nl;
    const html = marked.parser([tok], opts);
    if (!html) continue;
    tpl.innerHTML = html;
    const s = lineMap[Math.min(startLine, lineMap.length - 1)];
    const e = lineMap[Math.min(endLine, lineMap.length - 1)];
    if (s && e) {
      for (const el of tpl.content.children) {
        (el as HTMLElement).dataset.ss = s.s as unknown as string;
        (el as HTMLElement).dataset.se = e.e as unknown as string;
      }
    }
    content.appendChild(tpl.content);
  }
  doc.appendChild(content);
  const meta = postprocess(content, settings, attachments as Attachments, citeDefs);
  return { doc, meta };
}
