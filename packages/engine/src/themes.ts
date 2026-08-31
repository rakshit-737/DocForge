/* ============================================================
   themes.ts — color math, page geometry, embedded/system typefaces,
   the Word font catalogue, and the dynamic CSS builder.

   Extracted 1:1 from src/js/engine.js (lines 25–232 and 992–1084).
   Pure declarations — no top-level side effects, so module placement
   cannot reorder anything observable.
   ============================================================ */
import type { MarginSpec, PageSpec, Settings, Tints } from "./types";
import { cssStr } from "./util";

/* ---------- color math ---------- */
export function hexRgb(hex: string): number[] {
  const m = hex.replace("#", "");
  const v =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0);
}
export const rgbHex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
export function mix(hex: string, other: string, k: number) {
  // k = amount of `other`
  const a = hexRgb(hex),
    b = hexRgb(other);
  return rgbHex(...(a.map((v, i) => v + (b[i] - v) * k) as [number, number, number]));
}
export function tints(accent: string): Tints {
  return {
    a50: mix(accent, "#ffffff", 0.955),
    a75: mix(accent, "#ffffff", 0.93),
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
export const PAGES: Record<string, PageSpec> = {
  A4: { w: 210, h: 297, label: "A4" },
  Letter: { w: 215.9, h: 279.4, label: "Letter" },
};
export const MARGINS: Record<string, MarginSpec> = {
  normal: { t: 22, r: 20, b: 24, l: 20 },
  narrow: { t: 15, r: 14, b: 18, l: 14 },
  wide: { t: 28, r: 26, b: 30, l: 26 },
};
/* The embedded typefaces. Every cut is a real drawn weight — nothing is synthesised —
   and the same TTF bytes are inlined here and embedded into the .docx, so a document
   has one identity on every machine and in both formats.
   Source Sans 3 / Source Serif 4 / Source Code Pro, SIL OFL 1.1 (see fonts/). */
export interface EmbeddedFace {
  name: string;
  stem: string;
  family: string;
  pitch: string;
  cuts: Record<string, 1>;
}
export const EMBEDDED: EmbeddedFace[] = [
  {
    name: "DocForge Sans",
    stem: "DocForgeSans",
    family: "swiss",
    pitch: "variable",
    cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 },
  },
  {
    name: "DocForge Serif",
    stem: "DocForgeSerif",
    family: "roman",
    pitch: "variable",
    cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 },
  },
  {
    name: "DocForge Mono",
    stem: "DocForgeMono",
    family: "modern",
    pitch: "fixed",
    cuts: { regular: 1, bold: 1 },
  },
  {
    name: "DocForge Inter",
    stem: "DocForgeInter",
    family: "swiss",
    pitch: "variable",
    cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 },
  },
  {
    name: "DocForge Montserrat",
    stem: "DocForgeMont",
    family: "swiss",
    pitch: "variable",
    cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 },
  },
  {
    name: "DocForge Garamond",
    stem: "DocForgeGaramond",
    family: "roman",
    pitch: "variable",
    cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 },
  },
  {
    name: "DocForge Crimson",
    stem: "DocForgeCrimson",
    family: "roman",
    pitch: "variable",
    cuts: { regular: 1, bold: 1, italic: 1, boldItalic: 1 },
  },
];

/* Selectable text faces. `key` is what settings.fontHead / fontBody store;
   "theme" (the default) follows the theme's own pairing. */
export const FACES: Record<string, { name: string; kind: "sans" | "serif"; label: string }> = {
  sans: { name: "DocForge Sans", kind: "sans", label: "Source Sans — humanist" },
  serif: { name: "DocForge Serif", kind: "serif", label: "Source Serif — contemporary" },
  inter: { name: "DocForge Inter", kind: "sans", label: "Inter — neutral" },
  mont: { name: "DocForge Montserrat", kind: "sans", label: "Montserrat — geometric" },
  garamond: { name: "DocForge Garamond", kind: "serif", label: "Garamond — classic book" },
  crimson: { name: "DocForge Crimson", kind: "serif", label: "Crimson — scholarly" },
};
export const faceStack = (key: unknown): string | null => {
  if (FACES[key as string])
    return `"${FACES[key as string].name}", ${FACES[key as string].kind === "serif" ? "Georgia, serif" : "Arial, sans-serif"}`;
  if (typeof key === "string" && key.startsWith("sys:")) return sysStack(key.slice(4));
  return null;
};
/* The .docx writes fonts by name; embedded faces map to their real family,
   `sys:` keys pass the system family name straight through. */
export const faceName = (key: unknown): string | null =>
  FACES[key as string]
    ? FACES[key as string].name
    : typeof key === "string" && key.startsWith("sys:")
      ? key.slice(4)
      : null;
const CUT_STYLE: Record<string, { weight: number; style: string }> = {
  regular: { weight: 400, style: "normal" },
  bold: { weight: 700, style: "normal" },
  italic: { weight: 400, style: "italic" },
  boldItalic: { weight: 700, style: "italic" },
};
export const CUT_FILE: Record<string, string> = {
  regular: "Regular",
  bold: "Bold",
  italic: "Italic",
  boldItalic: "BoldItalic",
};

/* Built once at runtime from the single base64 copy the bundle carries. */
export function fontFaceCss(): string {
  const data = (typeof window !== "undefined" && window.__FONT_DATA__) || {};
  let css = "";
  for (const fam of EMBEDDED) {
    for (const cut of Object.keys(fam.cuts)) {
      const b64 = data[`${fam.stem}-${CUT_FILE[cut]}`];
      if (!b64) continue;
      const s = CUT_STYLE[cut];
      css +=
        `@font-face{font-family:"${fam.name}";font-style:${s.style};font-weight:${s.weight};` +
        `font-display:block;src:url(data:font/ttf;base64,${b64}) format("truetype")}\n`;
    }
  }
  return css;
}

const SANS_FALLBACK = `"Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif`;
const SERIF_FALLBACK = `Cambria, Georgia, "Times New Roman", serif`;
const SANS = `"DocForge Sans", ${SANS_FALLBACK}`;
const SERIF = `"DocForge Serif", ${SERIF_FALLBACK}`;

export const FONTS: Record<string, { head: string; body: string }> = {
  modern: { head: SANS, body: SANS },
  executive: { head: SERIF, body: SANS },
  academic: { head: SERIF, body: SERIF },
  minimal: { head: SANS, body: SANS },
};

/* ---------- the Word font menu ----------
   The full classic Office census — every Latin text family Word ships on Windows
   (symbol and math faces left out; they would set prose as dingbats). None of these
   can travel inside the file (they are proprietary), so the preview uses the locally
   installed face and the .docx names the family — Word supplies its own copy, which
   is exact parity on any machine with Office. `kind` drives the CSS fallback when
   the face is missing AND the optgroup the pickers sort it under, so keep each group
   alphabetical — the menu is rendered in this order. */
export type WordFontKind = "sans" | "serif" | "mono" | "script" | "display";
export const WORD_CATALOG: [string, WordFontKind][] = [
  // — sans serif —
  ["Agency FB", "sans"],
  ["Aptos", "sans"],
  ["Aptos Display", "sans"],
  ["Aptos Narrow", "sans"],
  ["Arial", "sans"],
  ["Arial Black", "sans"],
  ["Arial Narrow", "sans"],
  ["Arial Rounded MT Bold", "sans"],
  ["Bahnschrift", "sans"],
  ["Berlin Sans FB", "sans"],
  ["Berlin Sans FB Demi", "sans"],
  ["Bierstadt", "sans"],
  ["Bierstadt Display", "sans"],
  ["Britannic Bold", "sans"],
  ["Calibri", "sans"],
  ["Calibri Light", "sans"],
  ["Candara", "sans"],
  ["Candara Light", "sans"],
  ["Century Gothic", "sans"],
  ["Comic Sans MS", "sans"],
  ["Corbel", "sans"],
  ["Corbel Light", "sans"],
  ["Dubai", "sans"],
  ["Dubai Light", "sans"],
  ["Dubai Medium", "sans"],
  ["Ebrima", "sans"],
  ["Eras Bold ITC", "sans"],
  ["Eras Demi ITC", "sans"],
  ["Eras Light ITC", "sans"],
  ["Eras Medium ITC", "sans"],
  ["Franklin Gothic Book", "sans"],
  ["Franklin Gothic Demi", "sans"],
  ["Franklin Gothic Demi Cond", "sans"],
  ["Franklin Gothic Heavy", "sans"],
  ["Franklin Gothic Medium", "sans"],
  ["Franklin Gothic Medium Cond", "sans"],
  ["Gadugi", "sans"],
  ["Gill Sans MT", "sans"],
  ["Gill Sans MT Condensed", "sans"],
  ["Gill Sans MT Ext Condensed Bold", "sans"],
  ["Grandview", "sans"],
  ["Grandview Display", "sans"],
  ["Haettenschweiler", "sans"],
  ["Leelawadee UI", "sans"],
  ["Lucida Sans", "sans"],
  ["Lucida Sans Unicode", "sans"],
  ["Maiandra GD", "sans"],
  ["Malgun Gothic", "sans"],
  ["Microsoft JhengHei", "sans"],
  ["Microsoft Sans Serif", "sans"],
  ["Microsoft YaHei", "sans"],
  ["MS Reference Sans Serif", "sans"],
  ["Nirmala UI", "sans"],
  ["Seaford", "sans"],
  ["Seaford Display", "sans"],
  ["Segoe UI", "sans"],
  ["Segoe UI Black", "sans"],
  ["Segoe UI Light", "sans"],
  ["Segoe UI Semibold", "sans"],
  ["Segoe UI Semilight", "sans"],
  ["Segoe UI Variable Display", "sans"],
  ["Segoe UI Variable Text", "sans"],
  ["Skeena", "sans"],
  ["Skeena Display", "sans"],
  ["Tahoma", "sans"],
  ["Tenorite", "sans"],
  ["Tenorite Display", "sans"],
  ["Trebuchet MS", "sans"],
  ["Tw Cen MT", "sans"],
  ["Tw Cen MT Condensed", "sans"],
  ["Tw Cen MT Condensed Extra Bold", "sans"],
  ["Verdana", "sans"],
  ["Yu Gothic", "sans"],
  ["Yu Gothic UI", "sans"],
  // — serif —
  ["Aptos Serif", "serif"],
  ["Aptos Slab", "serif"],
  ["Baskerville Old Face", "serif"],
  ["Bell MT", "serif"],
  ["Bodoni MT", "serif"],
  ["Bodoni MT Black", "serif"],
  ["Bodoni MT Condensed", "serif"],
  ["Book Antiqua", "serif"],
  ["Bookman Old Style", "serif"],
  ["Californian FB", "serif"],
  ["Calisto MT", "serif"],
  ["Cambria", "serif"],
  ["Centaur", "serif"],
  ["Century", "serif"],
  ["Century Schoolbook", "serif"],
  ["Constantia", "serif"],
  ["Elephant", "serif"],
  ["Footlight MT Light", "serif"],
  ["Garamond", "serif"],
  ["Georgia", "serif"],
  ["Gloucester MT Extra Condensed", "serif"],
  ["Goudy Old Style", "serif"],
  ["Goudy Stout", "serif"],
  ["High Tower Text", "serif"],
  ["Lucida Bright", "serif"],
  ["Lucida Fax", "serif"],
  ["Modern No. 20", "serif"],
  ["Palatino Linotype", "serif"],
  ["Perpetua", "serif"],
  ["Poor Richard", "serif"],
  ["Rockwell", "serif"],
  ["Rockwell Condensed", "serif"],
  ["Rockwell Extra Bold", "serif"],
  ["SimSun", "serif"],
  ["Sitka Banner", "serif"],
  ["Sitka Display", "serif"],
  ["Sitka Heading", "serif"],
  ["Sitka Small", "serif"],
  ["Sitka Subheading", "serif"],
  ["Sitka Text", "serif"],
  ["Sylfaen", "serif"],
  ["Times New Roman", "serif"],
  // — monospace —
  ["Aptos Mono", "mono"],
  ["Cascadia Code", "mono"],
  ["Cascadia Mono", "mono"],
  ["Consolas", "mono"],
  ["Courier New", "mono"],
  ["Lucida Console", "mono"],
  ["Lucida Sans Typewriter", "mono"],
  ["MS Gothic", "mono"],
  ["OCR A Extended", "mono"],
  // — script & handwriting —
  ["Blackadder ITC", "script"],
  ["Bradley Hand ITC", "script"],
  ["Brush Script MT", "script"],
  ["Edwardian Script ITC", "script"],
  ["Forte", "script"],
  ["Freestyle Script", "script"],
  ["French Script MT", "script"],
  ["Gabriola", "script"],
  ["Gigi", "script"],
  ["Harlow Solid Italic", "script"],
  ["Informal Roman", "script"],
  ["Ink Free", "script"],
  ["Kristen ITC", "script"],
  ["Kunstler Script", "script"],
  ["Lucida Calligraphy", "script"],
  ["Lucida Handwriting", "script"],
  ["Matura MT Script Capitals", "script"],
  ["Mistral", "script"],
  ["Monotype Corsiva", "script"],
  ["MV Boli", "script"],
  ["Palace Script MT", "script"],
  ["Parchment", "script"],
  ["Pristina", "script"],
  ["Rage Italic", "script"],
  ["Script MT Bold", "script"],
  ["Segoe Print", "script"],
  ["Segoe Script", "script"],
  ["Tempus Sans ITC", "script"],
  ["Viner Hand ITC", "script"],
  ["Vivaldi", "script"],
  ["Vladimir Script", "script"],
  // — display & titling —
  ["Algerian", "display"],
  ["Bauhaus 93", "display"],
  ["Bernard MT Condensed", "display"],
  ["Bodoni MT Poster Compressed", "display"],
  ["Broadway", "display"],
  ["Castellar", "display"],
  ["Chiller", "display"],
  ["Colonna MT", "display"],
  ["Cooper Black", "display"],
  ["Copperplate Gothic Bold", "display"],
  ["Copperplate Gothic Light", "display"],
  ["Curlz MT", "display"],
  ["Engravers MT", "display"],
  ["Felix Titling", "display"],
  ["Gill Sans Ultra Bold", "display"],
  ["Gill Sans Ultra Bold Condensed", "display"],
  ["Harrington", "display"],
  ["Impact", "display"],
  ["Imprint MT Shadow", "display"],
  ["Jokerman", "display"],
  ["Juice ITC", "display"],
  ["Magneto", "display"],
  ["Niagara Engraved", "display"],
  ["Niagara Solid", "display"],
  ["Old English Text MT", "display"],
  ["Onyx", "display"],
  ["Papyrus", "display"],
  ["Perpetua Titling MT", "display"],
  ["Playbill", "display"],
  ["Ravie", "display"],
  ["Showcard Gothic", "display"],
  ["Snap ITC", "display"],
  ["Stencil", "display"],
  ["Wide Latin", "display"],
];
const GENERIC: Record<WordFontKind, string> = {
  sans: "Arial, sans-serif",
  serif: "Georgia, serif",
  mono: "Consolas, monospace",
  script: '"Segoe Script", cursive',
  display: "Impact, sans-serif",
};
export function sysStack(name: unknown): string {
  // A typed family name lands inside generated CSS — strip anything that could
  // terminate the declaration, not just quotes.
  const clean = String(name || "")
    .replace(/["'{};\\]/g, "")
    .trim();
  if (!clean) return GENERIC.sans;
  if (EMBEDDED.some((f) => f.name === clean)) {
    return `"${clean}", ${/Serif|Garamond|Crimson/i.test(clean) ? SERIF_FALLBACK : SANS_FALLBACK}`;
  }
  const cat = WORD_CATALOG.find((w) => w[0].toLowerCase() === clean.toLowerCase());
  return `"${clean}", ${GENERIC[cat ? cat[1] : "sans"]}`;
}

/* ---------- dynamic CSS (@page + vars) ---------- */
export function dynamicCss(settings: Settings): string {
  const t = tints(settings.accent as string);
  const themeF = FONTS[settings.theme as string] || FONTS.modern;
  // A chosen face overrides the theme's pairing; "theme" (or absent) follows it.
  const f = {
    head: faceStack(settings.fontHead) || themeF.head,
    body: faceStack(settings.fontBody) || themeF.body,
  };
  const pg = PAGES[settings.page as string] || PAGES.A4;
  const m = MARGINS[settings.margins as string] || MARGINS.normal;
  const title = cssStr(settings.title || "");

  /* Word's document-wide knobs: base size in points; line spacing as Word multiples
     (240 twips = single). ×1.18 is the single-space factor most faces get in Word,
     so the preview's rhythm stays honest to the .docx. Absent/legacy settings keep
     the original 11pt / 1.59 from doc.css. */
  const baseSize = parseFloat(settings.baseSize as string) || 11;
  const lineH = ({ "1": 1.18, "1.15": 1.36, "1.5": 1.77, "2": 2.36 } as Record<string, number>)[
    settings.lineSpacing as string
  ];

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
  const W =
    ({ fine: 0.75, medium: 1.5, bold: 2.25 } as Record<string, number>)[
      settings.borderWeight as string
    ] || 1.5;
  const C = settings.borderColor === "accent" ? t.a600 : "#3c434e";
  const bp = (n: number) => Math.round(n * W * 100) / 100 + "pt";
  const BORDERS: Record<string, string> = {
    rule: `border: ${bp(1)} solid ${C};`,
    double: `border: ${bp(3)} double ${C};`,
    // three real lines: the border plus two inset rings, white gaps between
    triple: `border: ${bp(0.8)} solid ${C}; box-shadow: inset 0 0 0 ${bp(1.6)} #fff, inset 0 0 0 ${bp(2.4)} ${C}, inset 0 0 0 ${bp(3.2)} #fff, inset 0 0 0 ${bp(4)} ${C};`,
    dashed: `border: ${bp(1.4)} dashed ${C};`,
    dotted: `border: ${bp(1.4)} dotted ${C};`,
    thickthin: `border: ${bp(2)} solid ${C}; box-shadow: inset 0 0 0 ${bp(1.2)} #fff, inset 0 0 0 ${bp(1.8)} ${C};`,
    thinthick: `border: ${bp(0.7)} solid ${C}; box-shadow: inset 0 0 0 ${bp(1.2)} #fff, inset 0 0 0 ${bp(3.2)} ${C};`,
  };
  if (BORDERS[settings.borderStyle as string]) {
    css += `
.pagedjs_page { position: relative; }
.pagedjs_page::after {
  content: "";
  position: absolute;
  inset: 3mm;   /* the outer edge; every style grows inward from here, clear of the header */
  ${BORDERS[settings.borderStyle as string]}
  pointer-events: none;
  z-index: 5;
}
.pagedjs_page:has(.cover)::after { content: none; }
`;
  }
  return css;
}
