/* ============================================================
   themes.ts — color math, page geometry, embedded/system typefaces,
   the Word font catalogue, and the dynamic CSS builder.

   Extracted 1:1 from src/js/engine.js (lines 25–232 and 992–1084).
   Pure declarations — no top-level side effects, so module placement
   cannot reorder anything observable.
   ============================================================ */
import type { MarginSpec, PageSpec, Settings, Tints } from "./types";
import { cssStr, fmtDate } from "./util";

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
/* ---------- reader-supplied typefaces (§8.2) ----------
   A font a reader uploads becomes an EMBEDDED family and a selectable FACE at
   runtime, so every existing path — the @font-face CSS, sysStack's quoting,
   the .docx font payload, faceName's mapping — treats it exactly as it
   treats the seven that ship. Nothing here runs unless a font is registered,
   so a document that uses none renders byte-for-byte as before.

   The bytes themselves never live in this module: they arrive through the
   same `__FONT_DATA__` contract, keyed `<stem>-<Cut>`. */
export interface UserFace {
  /** FACES key the settings store — always `user:` prefixed. */
  key: string;
  name: string;
  stem: string;
  kind: "sans" | "serif";
  label: string;
  family: string;
  pitch: string;
  cuts: Record<string, 1>;
}

export function registerUserFace(face: UserFace): void {
  const i = EMBEDDED.findIndex((f) => f.name === face.name);
  const entry: EmbeddedFace = {
    name: face.name,
    stem: face.stem,
    family: face.family,
    pitch: face.pitch,
    cuts: face.cuts,
  };
  if (i >= 0) EMBEDDED[i] = entry;
  else EMBEDDED.push(entry);
  FACES[face.key] = { name: face.name, kind: face.kind, label: face.label };
}

/** Forget one reader-supplied face, or all of them. */
export function unregisterUserFaces(keys?: string[]): void {
  for (const key of keys ?? Object.keys(FACES)) {
    if (!key.startsWith("user:")) continue;
    const face = FACES[key];
    if (!face) continue;
    delete FACES[key];
    const i = EMBEDDED.findIndex((f) => f.name === face.name);
    if (i >= 0) EMBEDDED.splice(i, 1);
  }
}

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

/* ---------- running header and footer content (§8.2) ----------
   A reader can set what stands in the four side slots. Empty means the
   classic behaviour, byte for byte: the title upper-cased at top-left, the
   current section at top-right, and nothing at the foot but the folio.

   Tokens resolve at render except {section}, which has to stay live — it is
   `string(sect)` in CSS and a STYLEREF field in Word, so the running head
   follows the reader down the document instead of freezing one heading.

   Page numbers are deliberately NOT tokens here. The folio counts a dual
   sequence (romans through the front matter, "Page n of N" over body pages
   only), which the numbering handler writes per page; a CSS margin box can't
   express it, so promising {page} in a side slot would be promising something
   one of the two formats could not keep. */
export interface HeadPart {
  kind: "text" | "section";
  text: string;
}

const HEAD_TOKEN = /\{(title|author|date|kicker|section)\}/g;

/** Resolve a slot into the pieces a renderer can emit: literal text, and the
    live section marker. Adjacent literals are merged so the CSS content list
    stays as short as the classic one. */
export function headParts(template: unknown, settings: Settings): HeadPart[] {
  const raw = String(template ?? "");
  if (!raw.trim()) return [];
  const out: HeadPart[] = [];
  const push = (kind: HeadPart["kind"], text: string) => {
    if (kind === "text" && !text) return;
    const last = out[out.length - 1];
    if (kind === "text" && last?.kind === "text") last.text += text;
    else out.push({ kind, text });
  };
  let at = 0;
  HEAD_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null = HEAD_TOKEN.exec(raw);
  while (m) {
    push("text", raw.slice(at, m.index));
    const token = m[1];
    if (token === "section") push("section", "");
    else if (token === "date") push("text", fmtDate(settings.date as string));
    else push("text", String(settings[token as keyof Settings] ?? ""));
    at = m.index + m[0].length;
    m = HEAD_TOKEN.exec(raw);
  }
  push("text", raw.slice(at));
  return out.filter((p) => p.kind === "section" || p.text !== "");
}

/** The same pieces as a CSS `content:` value. */
export function headContent(template: unknown, settings: Settings): string {
  const parts = headParts(template, settings);
  if (!parts.length) return "";
  return parts
    .map((p) => (p.kind === "section" ? "string(sect)" : `"${cssStr(p.text)}"`))
    .join(" ");
}

/* ---------- letterhead & watermark geometry (§8.2) ---------- */

/** The pixel size written inside a PNG, JPEG or GIF data URL.

    Both formats need it and neither can ask the document: the letterhead is a
    data URL in the settings, never an element on the page, so nothing has
    measured it. The CSS needs the width to keep the logo's proportions at the
    height the reader chose (Chrome resolves `width:auto` on generated content
    to the image's own pixels, not to the scaled aspect), and the .docx needs
    it because Word stretches an image into whatever box it is given. One
    reader, so the two formats cannot disagree about the shape of a logo. */
export function imageMetrics(dataUrl: unknown): { w: number; h: number } | null {
  const src = String(dataUrl ?? "");
  const comma = src.indexOf(",");
  if (!src.startsWith("data:image/") || comma < 0) return null;
  const type = /^data:image\/([a-z]+)/.exec(src)?.[1] ?? "";
  let bytes: Uint8Array;
  try {
    /* Only the head of the file carries the dimensions; 48 KB is past any
       sane EXIF or colour profile without decoding a whole photograph. */
    const b64 = src.slice(comma + 1, comma + 1 + 65536).replace(/[^A-Za-z0-9+/=]/g, "");
    const bin = atob(b64.slice(0, b64.length - (b64.length % 4)));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return null;
  }
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (type === "png" && bytes.length > 24) return { w: v.getUint32(16), h: v.getUint32(20) };
    if (type === "gif" && bytes.length > 10)
      return { w: v.getUint16(6, true), h: v.getUint16(8, true) };
    if (type === "jpeg" || type === "jpg") {
      let i = 2;
      while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = bytes[i + 1] ?? 0;
        // SOF0–SOF15 carry the frame size; DHT (c4), DAC (c8) and DNL (cc) do not.
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc
        )
          return { w: v.getUint16(i + 7), h: v.getUint16(i + 5) };
        i += 2 + v.getUint16(i + 2);
      }
    }
  } catch {
    /* a truncated or lying header — better no logo than a stretched one */
  }
  return null;
}

/* ---------- watermark geometry ---------- */

export interface WatermarkMetrics {
  /** The word itself, trimmed and capped. Empty means "no watermark". */
  text: string;
  /** Type size of the mark, in points. */
  sizePt: number;
  /** How wide and tall the set word runs, in points — Word needs a box to
      stretch its textpath into, and it must be the box the CSS draws. */
  widthPt: number;
  heightPt: number;
}

/** One measurement for both formats. The preview sets the word in CSS and the
    .docx stretches it into a VML shape, so if they disagree about the size the
    same document carries two different stamps. They ask here instead.

    The word is scaled to fill most of the page's diagonal, so DRAFT and
    CONFIDENTIAL both read as one mark rather than one giant and one small,
    and it is capped so a two-letter stamp does not swallow the page. */
export function watermarkMetrics(text: unknown, page?: PageSpec): WatermarkMetrics {
  const word = String(text ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 48);
  const pg = page || PAGES.A4;
  const PT = 2.834645669; // points per millimetre
  const diagonal = Math.hypot(pg.w, pg.h) * PT;
  const AVG = 0.62; // average advance of a bold capital, in ems
  const span = diagonal * 0.55; // the part of the diagonal the word should fill
  /* 130pt is where a short word stops growing — Word's own DRAFT stamp is
     about 117pt tall, and past that a five-letter mark starts running off
     the corners of the sheet rather than across it. */
  const size = Math.max(20, Math.min(130, span / (Math.max(word.length, 1) * AVG)));
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    text: word,
    sizePt: round(size),
    widthPt: round(size * AVG * Math.max(word.length, 1)),
    heightPt: round(size * 1.24),
  };
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
    /* The two side slots are the reader's when they set them, and the classic
       title/section pair when they don't — an empty setting emits exactly the
       bytes it always did (§8.2). */
    const left = headContent(settings.headerLeft, settings) || `"${title}"`;
    const right = headContent(settings.headerRight, settings) || "string(sect)";
    css += `
  @top-left { content: ${left}; font-family:${f.head}; font-size:7.6pt; letter-spacing:0.13em; text-transform:uppercase; color:#828a99; margin-bottom:6mm; }
  @top-right { content: ${right}; font-family:${f.body}; font-size:7.6pt; color:#828a99; margin-bottom:6mm; max-width:60mm; overflow:hidden; }`;
  }
  /* The foot's side slots are new ground: nothing is emitted unless asked
     for, so a document that never sets them is untouched. The centre stays
     the folio's, which is the only place either format can count the dual
     front-matter/body sequence. */
  const footL = headContent(settings.footerLeft, settings);
  const footR = headContent(settings.footerRight, settings);
  if (footL) {
    css += `
  @bottom-left { content: ${footL}; font-family:${f.body}; font-size:7.6pt; color:#828a99; margin-top:6mm; max-width:60mm; overflow:hidden; }`;
  }
  if (footR) {
    css += `
  @bottom-right { content: ${footR}; font-family:${f.body}; font-size:7.6pt; color:#828a99; margin-top:6mm; max-width:60mm; overflow:hidden; }`;
  }
  /* The letterhead rides in the top-centre margin box, which nothing else
     uses, so it sits between the running head's two ends on every page —
     which is where Word puts a letterhead too. Unset, not a byte is emitted. */
  const letterhead = typeof settings.letterhead === "string" ? settings.letterhead.trim() : "";
  const lhMm = Math.max(6, Math.min(30, parseFloat(settings.letterheadSize as string) || 14));
  /* A logo whose own header cannot be read is not printed at all — in either
     format. A stretched letterhead is worse than none. */
  const lhSize = imageMetrics(letterhead);
  if (lhSize) {
    /* The logo is wrapped in an SVG that declares its printed size in
       millimetres, rather than being sized by a CSS rule: a margin box's
       content is generated content, and Chrome sizes generated images from
       their own pixels when it prints — the rule that works on screen is
       ignored on paper, and a 480-pixel logo lands 127 mm wide across the
       running head. An intrinsic size cannot be ignored by either. */
    const lhWmm = Math.round(((lhMm * lhSize.w) / lhSize.h) * 100) / 100;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${lhWmm}mm" height="${lhMm}mm" ` +
      `viewBox="0 0 ${lhSize.w} ${lhSize.h}">` +
      `<image href="${letterhead}" x="0" y="0" width="${lhSize.w}" height="${lhSize.h}"/></svg>`;
    css += `
  @top-center { content: url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}"); margin-bottom: 4mm; }`;
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
  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }${
    footL || footR
      ? `
  @bottom-left { content: none; } @bottom-right { content: none; }`
      : ""
  }${
    lhSize
      ? `
  @top-center { content: none; }`
      : ""
  }
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

  /* The watermark — a word set diagonally across the sheet, drawn as TEXT
     rather than a background so it prints whether or not the reader ticks
     "background graphics", and at an ink light enough to read under the prose
     rather than over it. The cover is exempt, exactly as it is from the page
     border, and the .docx cover section carries no header for Word to stamp —
     so both formats leave the cover alone. */

  /* Two placements decided by looking at printed pages, not at the screen:

     The mark is anchored in the page's own MILLIMETRES rather than a
     percentage of its box. Paged.js computes a different height for
     .pagedjs_page in print media than on screen, so a mark centred on that box
     sits right in the preview and drifts up the sheet in the PDF. The sheet's
     top-left corner is the one thing both media agree on.

     And it rides OVER the page rather than under it: a negative layer sinks
     behind the sheet's own background and disappears entirely. So the ink is
     translucent — a tenth of the page's ink, which over white reads as the
     light grey Word fills its own shape with, and over a line of type leaves
     every glyph legible. */
  const mark = watermarkMetrics(settings.watermark, pg);
  if (mark.text) {
    css += `
.pagedjs_page { position: relative; }
.pagedjs_page::before {
  content: "${cssStr(mark.text)}";
  position: absolute;
  left: 0;
  top: ${Math.round((pg.h / 2) * 100) / 100}mm;
  width: ${pg.w}mm;
  text-align: center;
  line-height: 1;
  z-index: 4;
  transform: translateY(-50%) rotate(-45deg);
  font-family: ${f.head};
  font-weight: 800;
  font-size: ${mark.sizePt}pt;
  letter-spacing: 0.04em;
  color: rgba(15, 23, 42, 0.11);
  white-space: nowrap;
  pointer-events: none;
}
.pagedjs_page:has(.cover)::before { content: none; }
`;
  }
  return css;
}
