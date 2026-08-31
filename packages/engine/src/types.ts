/* ============================================================
   types.ts — the typed dialect-token contract for @docforge/engine

   This file is TYPES ONLY (fully erased at runtime). It documents and
   constrains the custom-dialect surface the engine implements. Two kinds
   of members live in the DialectToken union:

   1. Marked tokenizer-extension tokens (dfUnder / dfMark / dfSup / dfSub /
      dfSpan) — these are the ACTUAL runtime token shapes produced by the
      inline extensions registered in parse.ts.

   2. Preprocess-level constructs (heading-label, table-caption, screenshot,
      footnote, citation, xref, math, toc/lof/lot/pagebreak, callout,
      alignment, banner) — these never exist as marked tokens at runtime
      (preprocess rewrites the source lines to HTML carriers before marked
      runs), but they are part of the dialect contract and are typed here
      as descriptors so downstream packages share one vocabulary.
   ============================================================ */

/** Minimal marked token shape — the engine only ever reads `.raw` off these. */
export interface MarkedToken {
  type?: string;
  raw: string;
  [key: string]: unknown;
}

/** Word's fixed highlighter palette names — the same names the .docx run property takes. */
export type HlColorName =
  | "yellow"
  | "green"
  | "cyan"
  | "magenta"
  | "blue"
  | "red"
  | "darkBlue"
  | "darkCyan"
  | "darkGreen"
  | "darkMagenta"
  | "darkRed"
  | "darkYellow"
  | "darkGray"
  | "lightGray"
  | "black";

/** Parsed `[text]{…}` span attributes — hex colours only (what survives into the .docx). */
export interface SpanAttrs {
  color?: string; // "#rgb" | "#rrggbb", lowercased
  bg?: string; // "#rgb" | "#rrggbb", lowercased
  size?: number; // points, 5–96
  font?: string; // family name or FACES key, quoted or bare
  u?: true;
  sc?: true;
  caps?: true;
}

/* ---------- 1. inline marked-extension tokens (runtime shapes) ---------- */

/** `++underline++` */
export interface DfUnderToken {
  type: "dfUnder";
  raw: string;
  tokens: MarkedToken[];
}
/** `==mark==` / `=={green}mark==` */
export interface DfMarkToken {
  type: "dfMark";
  raw: string;
  hl: HlColorName;
  tokens: MarkedToken[];
}
/** `^sup^` */
export interface DfSupToken {
  type: "dfSup";
  raw: string;
  tokens: MarkedToken[];
}
/** `~sub~` (single tilde is subscript — Pandoc convention; `~~…~~` stays GFM strikethrough) */
export interface DfSubToken {
  type: "dfSub";
  raw: string;
  tokens: MarkedToken[];
}
/** `[text]{color=#c00 bg=#ffe28a size=14 font="Georgia" u sc caps}` */
export interface DfSpanToken {
  type: "dfSpan";
  raw: string;
  attrs: SpanAttrs;
  tokens: MarkedToken[];
}

/* ---------- 2. preprocess-level constructs (dialect descriptors) ---------- */

/** `## Heading {#sec:name}` — explicit heading label, wins over the slug. */
export interface HeadingLabelConstruct {
  type: "heading-label";
  id: string;
}
/** `[table: caption | #tbl:name]` on the line above a table. */
export interface TableCaptionConstruct {
  type: "table-caption";
  caption: string;
  id?: string;
}
/** `[screenshot: caption | img:key | w:60% | #fig:id | noborder]` — options in any order. */
export interface ScreenshotConstruct {
  type: "screenshot";
  caption: string;
  img?: string;
  w?: string;
  id?: string;
  noborder?: boolean;
  border?: boolean;
}
/** `[^id]` call + `[^id]: text` definition — emitted INLINE at the call site. */
export interface FootnoteConstruct {
  type: "footnote";
  id: string;
  text: string;
}
/** `[@key]` / `[@key, p. 33]` citation call. */
export interface CitationConstruct {
  type: "citation";
  key: string;
  locator?: string;
}
/** `[@key]: Full reference entry` definition. */
export interface CitationDefConstruct {
  type: "citation-def";
  key: string;
  entry: string;
}
/** `[references]` — places the references list (auto-appended if omitted). */
export interface ReferencesConstruct {
  type: "references";
}
/** `[#fig:x]` / `[#tbl:x]` / `[#sec:x]` cross-reference (resolves to "Figure 3" etc., "??" when missing). */
export interface XrefConstruct {
  type: "xref";
  target: string;
}
/** `$…$` inline / `$$…$$` display math, KaTeX-rendered; the TeX rides on data-tex. */
export interface MathConstruct {
  type: "math";
  tex: string;
  display: boolean;
}
/** `[toc]` — contents, filtered to h1–h3. */
export interface TocConstruct {
  type: "toc";
}
/** `[lof]` — list of figures. */
export interface LofConstruct {
  type: "lof";
}
/** `[lot]` — list of tables. */
export interface LotConstruct {
  type: "lot";
}
/** `[pagebreak]` */
export interface PagebreakConstruct {
  type: "pagebreak";
}
/** `:::note|tip|warning|important [optional title]` … `:::` */
export interface CalloutConstruct {
  type: "callout";
  kind: "note" | "tip" | "warning" | "important";
  title: string;
  body: string;
}
/** `:::center|right|left|justify` … `:::` — Word's paragraph alignment group. */
export interface AlignmentConstruct {
  type: "alignment";
  dir: "center" | "right" | "left" | "justify";
  body: string;
}
/** `:::banner` … `:::` — the title plate (commit c35d755). */
export interface BannerConstruct {
  type: "banner";
  body: string;
}

/** Every custom construct in the DocForge dialect. */
export type DialectToken =
  | DfUnderToken
  | DfMarkToken
  | DfSupToken
  | DfSubToken
  | DfSpanToken
  | HeadingLabelConstruct
  | TableCaptionConstruct
  | ScreenshotConstruct
  | FootnoteConstruct
  | CitationConstruct
  | CitationDefConstruct
  | ReferencesConstruct
  | XrefConstruct
  | MathConstruct
  | TocConstruct
  | LofConstruct
  | LotConstruct
  | PagebreakConstruct
  | CalloutConstruct
  | AlignmentConstruct
  | BannerConstruct;

/* ---------- settings / supporting shapes ---------- */

/** The render/settings object main.js passes. All fields optional — absent/legacy
    settings keep the historical defaults exactly as engine.js did. */
export interface Settings {
  hardWrap?: boolean;
  theme?: string; // "modern" | "executive" | "academic" | "minimal"
  accent?: string; // hex accent colour, e.g. "#0f62fe"
  page?: string; // "A4" | "Letter"
  margins?: string; // "normal" | "narrow" | "wide"
  fontHead?: string; // FACES key | "sys:Family Name" | "theme"
  fontBody?: string;
  justify?: boolean;
  h1break?: boolean;
  lang?: string;
  cover?: boolean;
  title?: string;
  subtitle?: string;
  kicker?: string;
  author?: string;
  metaExtra?: string;
  date?: string; // ISO yyyy-mm-dd
  numbered?: boolean;
  citeStyle?: string; // "numeric" (default) | "apa" | "apa7" (apa + same-author same-year a/b/c suffixes)
  header?: boolean;
  pageNums?: boolean;
  baseSize?: number | string;
  lineSpacing?: string; // "1" | "1.15" | "1.5" | "2"
  borderStyle?: string; // rule|double|triple|dashed|dotted|thickthin|thinthick
  borderWeight?: string; // fine|medium|bold
  borderColor?: string; // "ink" | "accent"
  [key: string]: unknown;
}

export interface Attachment {
  dataUrl: string;
  w?: number;
  h?: number;
  [key: string]: unknown;
}
export type Attachments = Record<string, Attachment | undefined>;

export interface Tints {
  a50: string;
  a75: string;
  a100: string;
  a200: string;
  a300: string;
  a400: string;
  a500: string;
  a600: string;
  a700: string;
  a800: string;
  a900: string;
}

export interface PageSpec {
  w: number;
  h: number;
  label: string;
}
export interface MarginSpec {
  t: number;
  r: number;
  b: number;
  l: number;
}

/** One {s, e} span of ORIGINAL source lines per emitted preprocess line. */
export interface LineSpan {
  s: number;
  e: number;
}

/** Carries footnote/citation definitions down into callout recursion and the
    collected citation entries back up; lineMap only on the top-level call. */
export interface PreprocessInherited {
  notes?: Record<string, string>;
  cites?: Record<string, string>;
  citeDefs?: Record<string, string>;
  lineMap?: LineSpan[];
}

export interface RenderMeta {
  figures: number;
  headings: number;
}
export interface RenderResult {
  doc: HTMLDivElement;
  meta: RenderMeta;
}
