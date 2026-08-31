/* ============================================================
   docx-export — rendered DOM → real .docx (docx library)
   (1:1 port of src/js/docx-export.js)

   The docx library stays the window.docx global this phase (the
   single-file build keeps inlining the same UMD bytes); Engine
   stays an ambient global; MathmlOmml arrives via the sibling
   workspace package instead of its global — the guard below is
   then constant-true, exactly as in the classic bundle where
   mathml-omml.js is always inlined ahead of this file.
   ============================================================ */

import { api as MathmlOmml } from "@docforge/mathml-omml";
import * as DocxFonts from "./docx-fonts";

/** The settings object main.js hands to build() — the same shape Engine reads. */
export interface DocxSettings {
  theme: string;
  accent: string;
  page: string;
  margins: string;
  fontHead?: string | null;
  fontBody?: string | null;
  cover?: boolean;
  h1break?: boolean;
  justify?: boolean;
  header?: boolean;
  pageNums?: boolean;
  title?: string;
  subtitle?: string;
  author?: string;
  metaExtra?: string;
  kicker?: string;
  date?: string;
  lang?: string;
  baseSize?: string | number;
  lineSpacing?: string;
  borderStyle?: string;
  borderWeight?: string;
  borderColor?: string;
}

/** Inline run formatting carried down the DOM walk. */
interface RunFmt {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  underline?: boolean;
  highlight?: string;
  sub?: boolean;
  sup?: boolean;
  sc?: boolean;
  caps?: boolean;
  code?: boolean;
  font?: string;
  size?: number;
  color?: string;
  bg?: string;
}

/** Paragraph decoration inherited by everything walk() builds inside a container. */
interface Ctx {
  indent?: { left: number };
  border?: any;
  fmt?: RunFmt;
  align?: any;
}

type HlFmt = { color?: string; bold?: boolean; italics?: boolean };
type ThemeFonts = { head: string; body: string };

const HP = (pt: number) => Math.round(pt * 2); // half-points
const hex = (c: string) => String(c).replace("#", "").toUpperCase();

/* Same three families the PDF uses, embedded in the package from the same TTF bytes. */
const WORD_FONTS: Record<string, ThemeFonts> & { modern: ThemeFonts } = {
  modern: { head: "DocForge Sans", body: "DocForge Sans" },
  executive: { head: "DocForge Serif", body: "DocForge Sans" },
  academic: { head: "DocForge Serif", body: "DocForge Serif" },
  minimal: { head: "DocForge Sans", body: "DocForge Sans" },
};
const MONO = "DocForge Mono";

/* Word-side mirror of the highlight theme in doc.css — keep the two in sync. */
const HL_WORD: [RegExp, HlFmt][] = [
  [/\bhljs-(comment|quote)\b/, { color: "62717E", italics: true }],
  [/\bhljs-(keyword|selector-tag|literal|type)\b/, { color: "8F3F9C" }],
  [/\bhljs-(string|regexp|addition)\b/, { color: "1A7F37" }],
  [/\bhljs-(number|symbol|bullet|meta)\b/, { color: "A05A00" }],
  [/\bhljs-(title|section|name)\b/, { color: "1F56B3" }],
  [/\bhljs-(attr|attribute|variable|template-variable|params)\b/, { color: "953800" }],
  [/\bhljs-(built_in)\b/, { color: "0F6F74" }],
  [/\bhljs-(deletion)\b/, { color: "BB2432" }],
  [/\bhljs-(strong)\b/, { bold: true }],
  [/\bhljs-(emphasis)\b/, { italics: true }],
];
const hlFmt = (cls: string): HlFmt | null => {
  for (const [re, fmt] of HL_WORD) if (re.test(cls)) return fmt;
  return null;
};

function b64Bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/* Hand every cut to the library under a throwaway name so it obfuscates the bytes and
   writes the parts; DocxFonts.embed regroups them into one family per typeface.
   Only the families this document actually uses are packed — embedding all seven
   would triple the size of every .docx for no benefit. */
function fontPayload(usedNames: Set<string> | null | undefined) {
  const data: Record<string, string | undefined> =
    (typeof window !== "undefined" && window.__FONT_DATA__) || {};
  const parts: { name: string; data: Uint8Array; characterSet: string }[] = [];
  const families: { name: string; family: string; pitch: string; cuts: Record<string, string> }[] =
    [];
  for (const fam of Engine.EMBEDDED) {
    if (usedNames && !usedNames.has(fam.name)) continue;
    const cuts: Record<string, string> = {};
    for (const cut of Object.keys(fam.cuts)) {
      const key = `${fam.stem}-${Engine.CUT_FILE[cut]}`;
      if (!data[key]) continue;
      cuts[cut] = key;
      parts.push({ name: key, data: b64Bytes(data[key]!), characterSet: "00" });
    }
    if (cuts.regular) families.push({ name: fam.name, family: fam.family, pitch: fam.pitch, cuts });
  }
  return { parts, families };
}

function dataUrlBytes(dataUrl: string) {
  const i = dataUrl.indexOf(",");
  const b64 = dataUrl.slice(i + 1);
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
  const mime = (dataUrl.slice(0, i).match(/image\/(\w+)/) || [])[1] || "png";
  return { arr, type: mime === "jpeg" ? "jpg" : mime };
}

export async function build(
  contentEl: HTMLElement,
  settings: DocxSettings,
  attachments?: unknown,
): Promise<Blob> {
  const D = window.docx;
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    PageNumber,
    Footer,
    Header,
    PageBreak,
    TableOfContents,
    ExternalHyperlink,
    ImageRun,
    LevelFormat,
    HeightRule,
    VerticalAlign,
    SectionType,
    TableLayoutType,
    SimpleField,
    Tab,
    TabStopType,
    NumberFormat,
    FootnoteReferenceRun,
    convertMillimetersToTwip: mm2t,
  } = D;

  const t = Engine.tints(settings.accent);
  const themeF = WORD_FONTS[settings.theme] || WORD_FONTS.modern;
  // faceName resolves embedded keys to their real family and `sys:` keys to the
  // bare system family name, which the .docx carries un-embedded.
  const f = {
    head: Engine.faceName(settings.fontHead) || themeF.head,
    body: Engine.faceName(settings.fontBody) || themeF.body,
  };
  const pg = Engine.PAGES[settings.page] || Engine.PAGES.A4;
  const mg = Engine.MARGINS[settings.margins] || Engine.MARGINS.normal;
  const availPx = Math.floor(((pg.w - mg.l - mg.r) * 96) / 25.4) - 4;
  const centeredCover = settings.theme === "academic";

  let olInstance = 0;
  let blocks: any[] = [];
  let frontEnd = -1; // index in `blocks` where the front matter ends (set by toc())
  /* Real Word footnotes: the reference run sits where the call was, Word places and
     numbers the note itself — so it lands at the foot of the right page without us
     measuring anything, exactly as Paged.js does on the PDF side. */
  const footnotes: Record<number, { children: any[] }> = {};
  let fnSeq = 0;
  const targets: any[][] = [];

  /* Run `fn` against a fresh block target and return what it produced. Nested containers
     (callouts, blockquotes, list items) reuse walk() through this instead of each
     re-implementing a flattened subset of it and losing tables, code and nesting. */
  function collect(fn: () => void): any[] {
    targets.push(blocks);
    blocks = [];
    try {
      fn();
      return blocks;
    } finally {
      blocks = targets.pop()!;
    }
  }

  /* Paragraph decoration inherited by everything walk() builds inside a container. */
  let ctx: Ctx = {};
  function withCtx<T>(patch: Ctx, fn: () => T): T {
    const prev = ctx;
    ctx = { ...ctx, ...patch, fmt: { ...prev.fmt, ...patch.fmt } };
    try {
      return fn();
    } finally {
      ctx = prev;
    }
  }
  const mkPara = (opts: any) =>
    new Paragraph({
      ...(ctx.indent ? { indent: ctx.indent } : {}),
      ...(ctx.border ? { border: ctx.border } : {}),
      ...opts,
    });
  /* A table cell must not end on a table in OOXML — Word repairs the file if it does. */
  const cellSafe = (arr: any[]) => {
    const out = arr.length ? arr.slice() : [new Paragraph({ children: [] })];
    if (out[out.length - 1] instanceof Table)
      out.push(new Paragraph({ spacing: { after: 0 }, children: [] }));
    return out;
  };

  /* ---------------- inline runs ---------------- */
  function runs(node: any, fmt: RunFmt = {}): any[] {
    const out: any[] = [];
    node.childNodes.forEach((ch: any) => {
      if (ch.nodeType === 3) {
        const txt = ch.textContent.replace(/[^\S\u00A0\u202F\u2009\u2011]+/g, " ");
        if (txt)
          out.push(
            new TextRun({
              text: txt,
              bold: fmt.bold,
              italics: fmt.italics,
              strike: fmt.strike,
              underline: fmt.underline ? {} : undefined,
              highlight: fmt.highlight,
              subScript: fmt.sub || undefined,
              superScript: fmt.sup || undefined,
              smallCaps: fmt.sc || undefined,
              allCaps: fmt.caps || undefined,
              font: fmt.code ? MONO : fmt.font,
              size: fmt.code ? HP(9.5) : fmt.size,
              color: fmt.color,
              shading: fmt.code ? { fill: "F0F2F5" } : fmt.bg ? { fill: fmt.bg } : undefined,
            }),
          );
        return;
      }
      if (ch.nodeType !== 1) return;
      const tag = ch.tagName.toLowerCase();
      if (tag === "br") {
        out.push(new TextRun({ text: "", break: 1 }));
        return;
      }
      if (tag === "span" && ch.classList.contains("math-inline")) {
        const tex = ch.dataset.tex || "";
        const omml = typeof MathmlOmml !== "undefined" ? MathmlOmml.texToOmml(tex, false) : null;
        if (omml) {
          try {
            out.push(D.ImportedXmlComponent.fromXmlString(omml).root[0]);
            return;
          } catch (e) {}
        }
        out.push(new TextRun({ text: tex, font: MONO, size: HP(9.5) }));
        return;
      }
      if (tag === "span" && ch.classList.contains("footnote")) {
        const id = ++fnSeq;
        footnotes[id] = {
          children: [
            new Paragraph({
              spacing: { after: 0, line: 240, lineRule: "auto" },
              children: runs(ch, { ...fmt, size: HP(8.5), color: "3D434D" }),
            }),
          ],
        };
        out.push(new FootnoteReferenceRun(id));
        return; // the note text must not also appear inline
      }
      if (tag === "img") return; // block-level path handles images
      const nf: RunFmt = { ...fmt };
      if (tag === "strong" || tag === "b") nf.bold = true;
      else if (tag === "em" || tag === "i") nf.italics = true;
      else if (tag === "del" || tag === "s") nf.strike = true;
      else if (tag === "u") nf.underline = true;
      else if (tag === "sub") nf.sub = true;
      else if (tag === "sup") nf.sup = true;
      else if (tag === "mark")
        nf.highlight = Engine.HL_COLORS[ch.dataset.hl] ? ch.dataset.hl : "yellow";
      else if (tag === "code") nf.code = true;
      else if (tag === "span" && ch.classList.contains("hnum")) {
        nf.color = hex(t.a600);
        nf.bold = true;
      } else if (tag === "span" && ch.classList.contains("dfspan")) {
        // The attribute span — the ribbon's colour / size / face / caps knobs.
        const d = ch.dataset;
        if (d.color) nf.color = d.color.toUpperCase();
        if (d.bg) nf.bg = d.bg.toUpperCase();
        if (d.size) nf.size = HP(parseFloat(d.size));
        if (d.font) nf.font = d.font;
        if (d.u) nf.underline = true;
        if (d.sc) nf.sc = true;
        if (d.caps) nf.caps = true;
      }
      if (tag === "a" && ch.getAttribute("href") && /^https?:/i.test(ch.getAttribute("href"))) {
        out.push(
          new ExternalHyperlink({
            link: ch.getAttribute("href"),
            children: runs(ch, { ...nf, color: hex(t.a700) }),
          }),
        );
        return;
      }
      out.push(...runs(ch, nf));
    });
    return out;
  }

  const para = (el: any, opts: any = {}) =>
    new Paragraph({ children: runs(el, opts.fmt || {}), ...opts });

  /* ---------------- block handlers ---------------- */
  function heading(el: any, first: boolean) {
    const lvl = +el.tagName[1];
    const map: Record<number, any> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6,
    };
    blocks.push(
      new Paragraph({
        heading: map[lvl],
        pageBreakBefore: lvl === 1 && settings.h1break && !first,
        // A heading must never be the last line on a page, orphaned from its own text.
        keepNext: true,
        keepLines: true,
        alignment: ctx.align,
        children: runs(el),
        border:
          lvl === 1
            ? { bottom: { style: BorderStyle.SINGLE, size: 8, color: hex(t.a600), space: 3 } }
            : undefined,
      }),
    );
  }

  const BLOCKY = /^(pre|table|blockquote|figure|h[1-6])$/i;

  function list(el: any, depth: number) {
    const ordered = el.tagName.toLowerCase() === "ol";
    if (ordered && depth === 0) olInstance++;
    const lvl = Math.min(depth, 2);
    [...el.children].forEach((li) => {
      if (li.tagName.toLowerCase() !== "li") return;
      const subs: any[] = [],
        extra: any[] = [];
      const clone = li.cloneNode(true);
      [...clone.children].forEach((c) => {
        if (/^(ul|ol)$/i.test(c.tagName)) {
          subs.push(c);
          c.remove();
        } else if (BLOCKY.test(c.tagName) || (c.classList && c.classList.contains("callout"))) {
          extra.push(c);
          c.remove();
        }
      });
      blocks.push(
        new Paragraph({
          children: runs(clone, ctx.fmt),
          numbering: ordered
            ? { reference: "ol-num", level: lvl, instance: olInstance }
            : undefined,
          bullet: ordered ? undefined : { level: lvl },
          alignment: ctx.align,
          spacing: { after: 60 },
        }),
      );
      // Block content owned by the item keeps its own formatting, indented under the marker.
      extra.forEach((c) => withCtx({ indent: { left: 620 + lvl * 500 } }, () => walk(c, false)));
      subs.forEach((s) => list(s, depth + 1));
    });
  }

  const CELL_ALIGN: Record<string, any> = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
  };

  function mdTable(el: any) {
    // A table caption sits above its table and must not be separated from it.
    const capEl = el.querySelector(":scope > caption");
    if (capEl) {
      const lbl = capEl.querySelector(".tbl-label");
      blocks.push(
        new Paragraph({
          keepNext: true,
          spacing: { before: 120, after: 60 },
          children: [
            new TextRun({
              text: lbl ? lbl.textContent : "",
              bold: true,
              size: HP(9),
              color: hex(t.a800),
            }),
            new TextRun({
              text: capEl.textContent.slice(lbl ? lbl.textContent.length : 0),
              size: HP(9),
              color: "5B6270",
            }),
          ],
        }),
      );
    }
    const rows: any[] = [];
    const trs = [...el.querySelectorAll("tr")];
    // Column widths measured from the rendered preview (main.js writes them back as
    // data-cols), so Word keeps the proportions the author actually saw.
    const measured = (el.dataset.cols || "")
      .split(",")
      .map(Number)
      .filter((n: number) => n > 0);
    const totalPx = measured.reduce((a: number, b: number) => a + b, 0);
    const totalTw = mm2t(pg.w - mg.l - mg.r);
    const colWidths =
      totalPx > 0 ? measured.map((w: number) => Math.round((w / totalPx) * totalTw)) : undefined;

    trs.forEach((tr) => {
      const isHead = !!tr.querySelector("th");
      const cells = [...tr.children].map(
        (td, i) =>
          new TableCell({
            shading: isHead ? { fill: hex(t.a75) } : undefined,
            margins: { top: 70, bottom: 70, left: 110, right: 110 },
            width: colWidths ? { size: colWidths[i], type: WidthType.DXA } : undefined,
            children: [
              new Paragraph({
                children: runs(td, isHead ? { bold: true, color: hex(t.a900) } : {}),
                alignment: CELL_ALIGN[td.getAttribute("align")],
                spacing: { after: 0 },
              }),
            ],
          }),
      );
      rows.push(new TableRow({ children: cells, cantSplit: true, tableHeader: isHead }));
    });
    blocks.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: colWidths,
        layout: D.TableLayoutType ? D.TableLayoutType.FIXED : undefined,
        indent: ctx.indent ? { size: ctx.indent.left, type: WidthType.DXA } : undefined,
        rows,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 8, color: hex(t.a600) },
          bottom: { style: BorderStyle.SINGLE, size: 8, color: hex(t.a600) },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "DFE2E7" },
        },
      }),
    );
    blocks.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
  }

  function boxTable(
    children: any[],
    {
      fill,
      border,
      dashed,
      height,
    }: { fill: string; border: string; dashed?: boolean; height?: number },
  ) {
    const bs = {
      style: dashed ? BorderStyle.DASHED : BorderStyle.SINGLE,
      size: dashed ? 12 : 4,
      color: border,
    };
    blocks.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            height: height ? { value: height, rule: HeightRule.ATLEAST } : undefined,
            cantSplit: true,
            children: [
              new TableCell({
                shading: { fill },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 130, bottom: 130, left: 170, right: 170 },
                children: cellSafe(children),
              }),
            ],
          }),
        ],
        borders: { top: bs, bottom: bs, left: bs, right: bs },
      }),
    );
    blocks.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
  }

  /* `:::banner` — the title plate, mirroring doc.css: a one-cell table shaded deep
     slate, first line large and white, the rest small in the light accent tint.
     Spans inside still override colour and size, exactly as they do on the page. */
  function banner(el: any) {
    const kids = [...el.children].filter((c) => c.textContent.trim());
    const inner = kids.map(
      (c, i) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: i === kids.length - 1 ? 0 : 70 },
          children: runs(
            c,
            i === 0
              ? { bold: true, size: HP(17), color: "FFFFFF", font: f.head }
              : { size: HP(10.5), color: hex(t.a200) },
          ),
        }),
    );
    boxTable(inner.length ? inner : [new Paragraph({ children: [] })], {
      fill: "1F2733",
      border: "1F2733",
    });
  }

  function callout(el: any) {
    const type =
      ["note", "tip", "warning", "important"].find((c) => el.classList.contains(c)) || "note";
    const colors: Record<string, string> = {
      note: "2458C5",
      tip: "0E7A52",
      warning: "B26205",
      important: "BB2432",
    };
    const fills: Record<string, string> = {
      note: "EEF3FC",
      tip: "EBF7F1",
      warning: "FDF4E7",
      important: "FCEDEE",
    };
    const titleEl = el.querySelector(".co-title");
    const bodyEl = el.querySelector(".co-body");
    const inner = [
      new Paragraph({
        spacing: { after: 60 },
        keepNext: true,
        children: [
          new TextRun({
            text: "●  " + (titleEl?.textContent || "Note").toUpperCase(),
            bold: true,
            size: HP(9),
            color: colors[type],
            font: f.head,
            characterSpacing: 16,
          }),
        ],
      }),
    ];
    // Walk the body through the normal machinery: a table stays a table, a code block
    // stays a code block, and a nested list keeps its nesting instead of being inlined.
    if (bodyEl)
      inner.push(...collect(() => [...bodyEl.children].forEach((c: any) => walk(c, false))));
    const bs = (side: string) => ({
      style: BorderStyle.SINGLE,
      size: side === "left" ? 20 : 2,
      color: side === "left" ? colors[type] : fills[type],
    });
    blocks.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: fills[type] },
                margins: { top: 110, bottom: 110, left: 170, right: 170 },
                children: cellSafe(inner),
              }),
            ],
          }),
        ],
        borders: { top: bs("t"), bottom: bs("b"), right: bs("r"), left: bs("left") },
      }),
    );
    blocks.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
  }

  function codeBlock(el: any) {
    const code = el.querySelector("code") || el;
    // Flatten the highlight markup to [text, fmt] tokens, then split into lines.
    const tokens: [string, HlFmt][] = [];
    (function harvest(node: any, fmt: HlFmt) {
      node.childNodes.forEach((ch: any) => {
        if (ch.nodeType === 3) {
          if (ch.textContent) tokens.push([ch.textContent, fmt]);
          return;
        }
        if (ch.nodeType !== 1) return;
        harvest(ch, { ...fmt, ...(hlFmt(ch.className || "") || {}) });
      });
    })(code, {});
    if (tokens.length && tokens[tokens.length - 1]![0].endsWith("\n")) {
      tokens[tokens.length - 1]![0] = tokens[tokens.length - 1]![0].replace(/\n$/, "");
    }
    const lines: [string, HlFmt][][] = [[]];
    tokens.forEach(([text, fmt]) => {
      const parts = text.split("\n");
      parts.forEach((part, i) => {
        if (i) lines.push([]);
        if (part) lines[lines.length - 1]!.push([part, fmt]);
      });
    });
    const paras = lines.map(
      (line) =>
        new Paragraph({
          spacing: { after: 0, line: 240 },
          children: line.length
            ? line.map(
                ([text, fmt]) =>
                  new TextRun({
                    text,
                    font: MONO,
                    size: HP(9),
                    color: fmt.color,
                    bold: fmt.bold,
                    italics: fmt.italics,
                  }),
              )
            : [new TextRun({ text: " ", font: MONO, size: HP(9) })],
        }),
    );
    boxTable(paras, { fill: "F6F8FA", border: "E2E5EA" });
  }

  function figureBlock(el: any) {
    const cap = el.dataset.caption || "";
    const fign = el.dataset.fig;
    const img = el.querySelector("img");
    if (img && img.src.startsWith("data:")) {
      try {
        const { arr, type } = dataUrlBytes(img.src);
        const natW = +img.getAttribute("width") || 900;
        const natH = +img.getAttribute("height") || 600;
        // engine.js works out the printed width as a percentage of the text column and
        // records it on the figure, so the PDF and Word print the figure the same size.
        const pct = +el.dataset.w;
        const w = pct > 0 ? (availPx * pct) / 100 : Math.min(natW, availPx);
        blocks.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            // Binds the image to the caption that follows it. keepNext goes on the image,
            // not the caption — it binds a paragraph to the *next* one.
            keepNext: true,
            spacing: {
              before: 120,
              after: 60,
              line: 240,
              lineRule: D.LineRuleType ? D.LineRuleType.AT_LEAST : "atLeast",
            },
            children: [
              new ImageRun({
                type,
                data: arr,
                altText: cap ? { title: cap, description: cap, name: cap } : undefined,
                transformation: { width: Math.round(w), height: Math.round((w * natH) / natW) },
              }),
            ],
          }),
        );
      } catch (e) {
        /* skip broken image */
      }
    } else if (el.classList.contains("shot")) {
      // The caption is printed once, below the box, exactly as in the PDF.
      boxTable(
        [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 50 },
            children: [
              new TextRun({
                text: "SCREENSHOT PLACEHOLDER",
                bold: true,
                size: HP(9.5),
                color: hex(t.a700),
                font: f.head,
                characterSpacing: 24,
              }),
            ],
          }),
        ],
        { fill: hex(t.a50), border: hex(t.a400), dashed: true, height: 2400 },
      );
      // remove the spacer added by boxTable so caption hugs the box
      blocks.pop();
    }
    if (fign)
      blocks.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 140 },
          children: [
            new TextRun({ text: `Figure ${fign}`, bold: true, size: HP(9), color: hex(t.a800) }),
            ...(cap ? [new TextRun({ text: " — " + cap, size: HP(9), color: "5B6270" })] : []),
          ],
        }),
      );
  }

  /* List of figures / list of tables. Rendered as real entries rather than a Word
     field, because Word's TOC field only knows about heading styles. */
  function captionList(el: any) {
    const title = el.querySelector(".toc-title");
    if (title)
      blocks.push(
        new Paragraph({
          spacing: { after: 200 },
          keepNext: true,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: hex(t.a600), space: 3 } },
          children: [
            new TextRun({ text: title.textContent, bold: true, size: HP(18), font: f.head }),
          ],
        }),
      );
    el.querySelectorAll("nav.lst > a").forEach((a: any) => {
      const label = a.querySelector(".hnum");
      const text = a.querySelector(".t");
      const rest = text ? text.textContent.slice(label ? label.textContent.length : 0) : "";
      blocks.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 340, hanging: 340 },
          children: [
            new TextRun({ text: label ? label.textContent : "", bold: true, color: hex(t.a800) }),
            new TextRun({ text: rest }),
          ],
        }),
      );
    });
    blocks.push(new Paragraph({ children: [new PageBreak()] }));
  }

  function toc() {
    blocks.push(
      new Paragraph({
        spacing: { after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: hex(t.a600), space: 3 } },
        children: [new TextRun({ text: "Contents", bold: true, size: HP(18), font: f.head })],
      }),
    );
    blocks.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" }));
    // No PageBreak: everything up to here becomes its own section, so the section
    // break does the job and the front matter can carry roman numerals.
    frontEnd = blocks.length;
  }

  /* ---------------- walk content ---------------- */
  function walk(el: any, first: boolean): any {
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (el.classList) {
      if (el.classList.contains("page-break"))
        return blocks.push(new Paragraph({ children: [new PageBreak()] }));
      if (el.classList.contains("math-display")) {
        const tex = el.dataset.tex || "";
        const omml = typeof MathmlOmml !== "undefined" ? MathmlOmml.texToOmml(tex, true) : null;
        if (omml) {
          try {
            return blocks.push(
              new Paragraph({
                spacing: { before: 120, after: 175 },
                children: [
                  D.ImportedXmlComponent.fromXmlString(MathmlOmml.oMathPara(omml)).root[0],
                ],
              }),
            );
          } catch (e) {}
        }
        return blocks.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: tex, font: MONO, size: HP(9.5) })],
          }),
        );
      }
      if (el.classList.contains("refs")) {
        [...el.children].forEach((c: any) => {
          if (c.classList.contains("refs-title")) {
            blocks.push(
              new Paragraph({
                keepNext: true,
                spacing: { before: 175, after: 132 },
                children: [
                  new TextRun({
                    text: c.textContent,
                    bold: true,
                    size: HP(14.5),
                    color: hex(t.a800),
                    font: f.head,
                  }),
                ],
              }),
            );
          } else {
            // hanging indent, the convention for reference lists
            blocks.push(
              new Paragraph({
                indent: { left: 440, hanging: 440 },
                spacing: { after: 88 },
                children: runs(c, { size: HP(10) }),
              }),
            );
          }
        });
        return;
      }
      // A list of figures/tables is a real list of entries, not Word's TOC field.
      if (el.classList.contains("list-wrap")) return captionList(el);
      if (el.classList.contains("toc-wrap")) return toc();
      if (el.classList.contains("callout")) return callout(el);
      if (el.classList.contains("banner")) return banner(el);
      // :::center / :::right / :::left / :::justify — alignment rides the context down.
      const alClass = [...el.classList].find((c: any) => c.startsWith("align-"));
      if (alClass) {
        const al = (
          {
            "align-center": AlignmentType.CENTER,
            "align-right": AlignmentType.RIGHT,
            "align-left": AlignmentType.LEFT,
            "align-justify": AlignmentType.JUSTIFIED,
          } as Record<string, any>
        )[alClass];
        if (al)
          return withCtx({ align: al }, () => [...el.children].forEach((c: any) => walk(c, false)));
      }
    }
    if (/^h[1-6]$/.test(tag)) return heading(el, first);
    if (tag === "p") {
      if (!el.textContent.trim() && !el.querySelector("img")) return;
      return blocks.push(
        mkPara({
          children: runs(el, ctx.fmt),
          alignment: ctx.align || (settings.justify ? AlignmentType.JUSTIFIED : undefined),
        }),
      );
    }
    if (tag === "ul" || tag === "ol") return list(el, 0);
    if (tag === "table") return mdTable(el);
    if (tag === "pre") return codeBlock(el);
    if (tag === "blockquote") {
      return withCtx(
        {
          indent: { left: 360 },
          border: { left: { style: BorderStyle.SINGLE, size: 16, color: hex(t.a300), space: 12 } },
          fmt: { italics: true, color: "3D434D" },
        },
        () =>
          [...el.childNodes].forEach((c: any) => {
            if (c.nodeType === 1) walk(c, false);
            else if (c.nodeType === 3 && c.textContent.trim()) {
              blocks.push(
                mkPara({
                  children: [
                    new TextRun({
                      text: c.textContent.replace(/\s+/g, " "),
                      italics: true,
                      color: "3D434D",
                    }),
                  ],
                }),
              );
            }
          }),
      );
    }
    if (tag === "figure") return figureBlock(el);
    if (tag === "hr")
      return blocks.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D7DBE0" } },
          spacing: { before: 160, after: 200 },
          children: [],
        }),
      );
    if (el.children && el.children.length)
      return [...el.children].forEach((c: any) => walk(c, false));
    // Anything else that carries text still reaches the page rather than vanishing.
    if (el.textContent && el.textContent.trim())
      blocks.push(mkPara({ children: runs(el, ctx.fmt) }));
  }

  const kids = [...contentEl.children];
  kids.forEach((el, i) => walk(el, i === 0));

  /* ---------------- cover ----------------
     The PDF cover is a full-bleed named page: the accent band runs to the paper edge.
     Word cannot do that inside a section's margins, so the cover gets its own
     zero-margin section and the whole design is laid out as one page-height table —
     that is what pins the bottom band to the bottom edge instead of to wherever the
     text happens to stop. */
  const NONE_B = { style: BorderStyle.NONE, size: 0, color: "auto" };
  const NO_BORDERS = {
    top: NONE_B,
    bottom: NONE_B,
    left: NONE_B,
    right: NONE_B,
    insideHorizontal: NONE_B,
    insideVertical: NONE_B,
  };
  const ZERO_M = { top: 0, bottom: 0, left: 0, right: 0 };
  /* An empty Paragraph is a whole line box and would blow out an EXACT-height band. */
  const tiny = () =>
    new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: "exact" }, children: [] });
  const bandCell = (fill: string) =>
    new TableCell({ shading: { fill }, margins: ZERO_M, children: [tiny()] });
  const bleedTable = (rows: any[]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      indent: { size: 0, type: WidthType.DXA }, // Word otherwise insets by ~0.08"
      margins: ZERO_M,
      borders: NO_BORDERS,
      rows,
    });

  const coverBlocks: any[] = [];
  if (settings.cover) {
    const centred = centeredCover;
    const al = centred ? AlignmentType.CENTER : AlignmentType.LEFT;
    const spine = settings.theme === "executive";
    const padL = mm2t(spine ? 10 : 24),
      padR = mm2t(24);
    const cp = (o: any) =>
      new Paragraph({ indent: { left: padL, right: padR }, alignment: al, ...o });

    const metaLines: any[] = [];
    if (settings.author)
      metaLines.push(
        new TextRun({ text: settings.author, bold: true, size: HP(11.5), color: "171C23" }),
      );
    if (settings.metaExtra)
      metaLines.push(
        new TextRun({
          text: settings.metaExtra,
          size: HP(10.5),
          color: "2A303A",
          break: settings.author ? 1 : 0,
        }),
      );
    const ds = Engine.fmtDate(settings.date);
    if (ds)
      metaLines.push(
        new TextRun({ text: ds, size: HP(10.5), color: "6A7180", break: metaLines.length ? 1 : 0 }),
      );

    // The little accent rule under the title block, indented to the text edge.
    const accentRule = new Table({
      width: { size: mm2t(22), type: WidthType.DXA },
      indent: { size: padL, type: WidthType.DXA },
      alignment: centred ? AlignmentType.CENTER : AlignmentType.LEFT,
      margins: ZERO_M,
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          height: { value: mm2t(1.2), rule: HeightRule.EXACT },
          children: [bandCell(hex(t.a600))],
        }),
      ],
    });

    const content = [
      cp({
        spacing: { before: mm2t(centred ? 40 : 26), after: 200 },
        children: settings.kicker
          ? [
              new TextRun({
                text: settings.kicker.toUpperCase(),
                bold: true,
                size: HP(10),
                color: hex(t.a700),
                characterSpacing: centred ? 60 : 36,
                font: f.head,
              }),
            ]
          : [],
      }),
      cp({
        spacing: { after: 260 },
        // The academic Oxford rule: heavy above, hairline below (sizes in eighth-points
        // — 21 ≈ 2.6 pt, 7 ≈ 0.9 pt), mirroring .cv-title in doc.css.
        border: centred
          ? {
              top: { style: BorderStyle.SINGLE, size: 21, color: "14181F", space: 10 },
              bottom: { style: BorderStyle.SINGLE, size: 7, color: "14181F", space: 10 },
            }
          : undefined,
        children: [
          new TextRun({
            text: settings.title || "Untitled document",
            bold: true,
            size: HP(centred ? 27 : 31),
            color: "10141A",
            font: f.head,
          }),
        ],
      }),
      ...(settings.subtitle
        ? [
            cp({
              spacing: { after: 300 },
              children: [new TextRun({ text: settings.subtitle, size: HP(13.5), color: "4A5160" })],
            }),
          ]
        : []),
      cp({ spacing: { before: mm2t(95), after: 0 }, children: [] }),
      accentRule,
      cp({ spacing: { before: 200, after: 0 }, children: metaLines }),
    ];

    const BAND_TOP = settings.theme === "minimal" ? 1.2 : 7;
    const BAND_BOT = settings.theme === "modern" ? 2 : 0;
    const topFill = settings.theme === "minimal" ? "14181F" : hex(t.a700);

    if (spine) {
      // Executive: a vertical accent spine down the left edge instead of a top band.
      coverBlocks.push(
        bleedTable([
          new TableRow({
            height: { value: mm2t(pg.h), rule: HeightRule.EXACT },
            children: [
              new TableCell({
                shading: { fill: hex(t.a800) },
                margins: ZERO_M,
                width: { size: mm2t(9), type: WidthType.DXA },
                children: [tiny()],
              }),
              new TableCell({
                margins: ZERO_M,
                verticalAlign: VerticalAlign.TOP,
                children: content,
              }),
            ],
          }),
        ]),
      );
    } else {
      const rows: any[] = [];
      if (!centred)
        rows.push(
          new TableRow({
            height: { value: mm2t(BAND_TOP), rule: HeightRule.EXACT },
            children: [bandCell(topFill)],
          }),
        );
      rows.push(
        new TableRow({
          height: {
            value: mm2t(pg.h - (centred ? 0 : BAND_TOP) - BAND_BOT),
            rule: HeightRule.EXACT,
          },
          children: [
            new TableCell({ margins: ZERO_M, verticalAlign: VerticalAlign.TOP, children: content }),
          ],
        }),
      );
      if (BAND_BOT)
        rows.push(
          new TableRow({
            height: { value: mm2t(BAND_BOT), rule: HeightRule.EXACT },
            children: [bandCell(hex(t.a200))],
          }),
        );
      coverBlocks.push(bleedTable(rows));
    }
  }

  /* ---------------- document ---------------- */
  // The PDF header carries the title at top-left and the current section at top-right
  // (string(sect)). STYLEREF is Word's equivalent — a live field, not a frozen copy.
  // The run properties ride on a paragraph style so the field text inherits them too.
  const headerChildren = settings.header
    ? [
        new Paragraph({
          style: "DFHeader",
          tabStops: [{ type: TabStopType.RIGHT, position: mm2t(pg.w - mg.l - mg.r) }],
          children: [
            new TextRun({ text: (settings.title || "").toUpperCase(), characterSpacing: 26 }),
            new TextRun({ children: [new Tab()] }),
            new SimpleField("STYLEREF 1 \\* MERGEFORMAT"),
          ],
        }),
      ]
    : [];
  // The contents page belongs to the front matter, which the PDF numbers in romans and
  // gives no section name — so the Word header drops the STYLEREF there too.
  const frontHeaderChildren = settings.header
    ? [
        new Paragraph({
          style: "DFHeader",
          children: [
            new TextRun({ text: (settings.title || "").toUpperCase(), characterSpacing: 26 }),
          ],
        }),
      ]
    : [];

  const pgRun = (kids2: any[]) => new TextRun({ size: HP(8.2), color: "71798A", children: kids2 });
  const footerChildren = settings.pageNums
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            pgRun(["Page "]),
            pgRun([PageNumber.CURRENT]),
            pgRun([" of "]),
            pgRun([PageNumber.TOTAL_PAGES_IN_SECTION]),
          ],
        }),
      ]
    : [];
  // Front matter shows a bare roman numeral, matching the PDF.
  const frontFooterChildren = settings.pageNums
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [pgRun([PageNumber.CURRENT])],
        }),
      ]
    : [];

  const frontBlocks = frontEnd > 0 ? blocks.slice(0, frontEnd) : [];
  const bodyBlocks = frontEnd > 0 ? blocks.slice(frontEnd) : blocks;
  const bodyMargin = {
    top: mm2t(mg.t),
    right: mm2t(mg.r),
    bottom: mm2t(mg.b),
    left: mm2t(mg.l),
    header: mm2t(12),
    footer: mm2t(12),
    gutter: 0,
  };
  const pageSize = { width: mm2t(pg.w), height: mm2t(pg.h) };

  // Mono rides along only when the document actually sets code in it.
  // System families (`sys:` keys, attribute spans naming Word fonts) simply don't
  // match any EMBEDDED entry, so fontPayload skips them — Word resolves them by name.
  const usedFonts = new Set([f.head, f.body]);
  if (contentEl.querySelector("pre, code, kbd, samp")) usedFonts.add(MONO);
  contentEl
    .querySelectorAll<HTMLElement>("span.dfspan[data-font]")
    .forEach((s) => usedFonts.add(s.dataset.font!));
  const fp = fontPayload(usedFonts);

  /* Word's Home-ribbon document knobs, mirrored from Engine.dynamicCss. */
  const baseSize = parseFloat(settings.baseSize as string) || 11;
  const lineTw = (
    { "1": 240, "1.15": 276, "1.5": 360, "2": 480 } as Record<string, number | undefined>
  )[settings.lineSpacing as string];

  const doc = new Document({
    creator: settings.author || "DocForge",
    title: settings.title || "Document",
    subject: settings.subtitle || undefined,
    description: settings.subtitle || undefined,
    keywords: [settings.kicker, settings.metaExtra].filter(Boolean).join(", ") || undefined,
    lastModifiedBy: settings.author || "DocForge",
    fonts: fp.parts,
    ...(fnSeq ? { footnotes } : {}),
    features: { updateFields: true },
    styles: {
      default: {
        // Default leading scales with the base size, as the preview's unitless 1.59 does.
        document: {
          run: {
            font: f.body,
            size: HP(baseSize),
            color: "1C2128",
            language: { value: settings.lang || "en-GB" },
          },
          paragraph: {
            spacing: lineTw
              ? { after: 175, line: lineTw, lineRule: "auto" }
              : { after: 175, line: Math.round((350 * baseSize) / 11), lineRule: "atLeast" },
          },
        },
        heading1: {
          run: { font: f.head, size: HP(20.5), bold: true, color: "12161C" },
          paragraph: { spacing: { before: 263, after: 175 } },
        },
        heading2: {
          run: { font: f.head, size: HP(14.5), bold: true, color: hex(t.a800) },
          paragraph: { spacing: { before: 175, after: 132 } },
        },
        heading3: {
          run: { font: f.head, size: HP(12), bold: true, color: "12161C" },
          paragraph: { spacing: { before: 87, after: 88 } },
        },
        heading4: {
          run: { font: f.head, size: HP(11), bold: true, italics: true, color: "333A45" },
          paragraph: { spacing: { before: 43, after: 88 } },
        },
        heading5: {
          run: { font: f.head, size: HP(10.5), bold: true, color: "333A45" },
          paragraph: { spacing: { before: 160, after: 70 } },
        },
        heading6: {
          run: { font: f.head, size: HP(10), bold: true, color: "4A5160" },
          paragraph: { spacing: { before: 140, after: 60 } },
        },
        hyperlink: { run: { color: hex(t.a700), underline: {} } },
      },
      paragraphStyles: [
        {
          // The running header. Its properties live on a style rather than on the runs
          // so the STYLEREF field text inherits them too — a field carries no run props.
          id: "DFHeader",
          name: "DocForge Header",
          basedOn: "Normal",
          quickFormat: false,
          run: { font: f.head, size: HP(7.6), color: "828A99" },
          paragraph: {
            spacing: { before: 0, after: 0, line: 240, lineRule: "auto" },
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "E3E6EB", space: 4 } },
          },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "ol-num",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 620, hanging: 320 } } },
            },
            {
              level: 1,
              format: LevelFormat.LOWER_LETTER,
              text: "%2.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 1120, hanging: 320 } } },
            },
            {
              level: 2,
              format: LevelFormat.LOWER_ROMAN,
              text: "%3.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 1620, hanging: 320 } } },
            },
          ],
        },
      ],
    },
    sections: (() => {
      /* Decorative page border, mirroring the PDF overlay: drawn a fixed distance in
       from the paper edge on front-matter and body pages; the cover stays clean.
       Word measures border size in eighth-points and offset in points (max 31). */
      // size is in eighth-points; compound styles need a larger nominal size for the
      // drawn result to match the PDF overlay's total weight.
      const BW =
        ({ fine: 6, medium: 12, bold: 18 } as Record<string, number | undefined>)[
          settings.borderWeight as string
        ] || 12;
      const BC = settings.borderColor === "accent" ? hex(t.a600) : "3C434E";
      const PB = (
        {
          rule: { style: BorderStyle.SINGLE, size: BW },
          double: { style: BorderStyle.DOUBLE, size: Math.round(BW * 0.8) },
          triple: { style: BorderStyle.TRIPLE, size: Math.round(BW * 0.8) },
          dashed: { style: BorderStyle.DASHED, size: BW },
          dotted: { style: BorderStyle.DOTTED, size: BW },
          thickthin: { style: BorderStyle.THICK_THIN_SMALL_GAP, size: BW * 2 },
          thinthick: { style: BorderStyle.THIN_THICK_SMALL_GAP, size: BW * 2 },
        } as Record<string, { style: any; size: number; color?: string } | undefined>
      )[settings.borderStyle as string];
      if (PB) PB.color = BC;
      const pageBorders = PB
        ? {
            pageBorders: {
              display: D.PageBorderDisplay.ALL_PAGES,
              offsetFrom: D.PageBorderOffsetFrom.PAGE,
              zOrder: D.PageBorderZOrder.FRONT,
            },
            // 13 pt ≈ 4.6 mm from the paper edge — same standoff as the PDF overlay
            pageBorderTop: { ...PB, space: 9 },
            pageBorderRight: { ...PB, space: 9 },
            pageBorderBottom: { ...PB, space: 9 },
            pageBorderLeft: { ...PB, space: 9 },
          }
        : undefined;
      return [
        // Cover: its own section with every margin at zero so the band can bleed.
        // It deliberately declares NO headers/footers — even an empty Header reserves a
        // line box and pushes the band ~4 mm off the top edge.
        ...(settings.cover
          ? [
              {
                properties: {
                  type: SectionType.NEXT_PAGE,
                  page: {
                    size: pageSize,
                    margin: {
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0,
                      header: 0,
                      footer: 0,
                      gutter: 0,
                    },
                  },
                },
                children: coverBlocks,
              },
            ]
          : []),
        // Front matter (the contents page) — roman numerals, restarting at i, exactly as
        // the PDF numbers it. Only exists when the document actually has a [toc].
        ...(frontBlocks.length
          ? [
              {
                properties: {
                  type: SectionType.NEXT_PAGE,
                  page: {
                    size: pageSize,
                    margin: bodyMargin,
                    pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN },
                    borders: pageBorders,
                  },
                },
                headers: { default: new Header({ children: frontHeaderChildren }) },
                footers: { default: new Footer({ children: frontFooterChildren }) },
                children: frontBlocks,
              },
            ]
          : []),
        {
          properties: {
            type: SectionType.NEXT_PAGE,
            page: {
              size: pageSize,
              margin: bodyMargin,
              // Body restarts at 1, so the first page of prose is page 1.
              pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
              borders: pageBorders,
            },
          },
          headers: { default: new Header({ children: headerChildren }) },
          footers: { default: new Footer({ children: footerChildren }) },
          children: bodyBlocks,
        },
      ];
    })(),
  });

  // A document set entirely in system faces embeds nothing — and the library then
  // writes a self-closing <w:fonts/> that the regroup rewrite must not touch.
  const blob = await D.Packer.toBlob(doc);
  return fp.families.length ? DocxFonts.embed(blob, fp.families) : blob;
}
