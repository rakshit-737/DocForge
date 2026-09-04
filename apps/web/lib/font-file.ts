"use client";
/* ============================================================
   font-file.ts — reading a typeface the reader supplies (§8.2).

   Pure bytes and strings: the sfnt name table, which cut a file
   holds, the key its bytes take in `__FONT_DATA__`, and the
   @font-face rules the preview needs. Nothing here touches the
   engine, IndexedDB or the DOM — which is what lets it be tested
   against the 26 real font files this repo ships, and what keeps
   the engine out of the first-paint chunk (it may only ever arrive
   through loadStudio, after its globals land).

   WOFF/WOFF2 are deliberately refused. The browser would render
   them, but Word cannot embed them, so accepting one would promise
   an end-to-end identity the export could not keep.
   ============================================================ */

export type FontCut = "regular" | "bold" | "italic" | "boldItalic";
export const CUT_LABEL: Record<FontCut, string> = {
  regular: "Regular",
  bold: "Bold",
  italic: "Italic",
  boldItalic: "Bold Italic",
};

export interface UserFont {
  /** The family name read out of the font's own name table. */
  name: string;
  /** Key under which cuts land in __FONT_DATA__ (`<stem>-Regular`). */
  stem: string;
  kind: "sans" | "serif";
  /** base64 of each cut's bytes. */
  cuts: Partial<Record<FontCut, string>>;
  addedAt: number;
}

/* ---------------- reading the font's own name table ---------------- */

const u16 = (d: DataView, o: number) => d.getUint16(o);
const u32 = (d: DataView, o: number) => d.getUint32(o);

/** A name-table string, decoded from the two encodings fonts actually use. */
function readNameString(bytes: Uint8Array, platform: number, encoding: number): string {
  const utf16 = platform === 0 || platform === 3 || encoding === 1;
  if (!utf16) return new TextDecoder("latin1").decode(bytes);
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    out += String.fromCharCode(((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0));
  }
  return out;
}

export interface FontNames {
  /** nameID 16 (typographic family) if present, else nameID 1. */
  family: string;
  /** nameID 17 (typographic subfamily) if present, else nameID 2. */
  subfamily: string;
  /** True for OpenType CFF outlines (.otf) — Word embeds these too. */
  cff: boolean;
}

/** Read family and subfamily out of an sfnt (TTF/OTF). Throws on anything
    else, WOFF included — the error text is what the reader is shown. */
export function readFontNames(buf: ArrayBuffer): FontNames {
  const d = new DataView(buf);
  if (buf.byteLength < 12) throw new Error("That file is too small to be a font");
  const tag = u32(d, 0);
  if (tag === 0x774f4632 || tag === 0x774f4646) {
    throw new Error("WOFF fonts can't be embedded in Word — upload the .ttf or .otf instead");
  }
  const cff = tag === 0x4f54544f; // "OTTO"
  if (tag !== 0x00010000 && !cff && tag !== 0x74727565) {
    throw new Error("That doesn't look like a .ttf or .otf font");
  }
  const numTables = u16(d, 4);
  let nameOff = 0;
  let nameLen = 0;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (rec + 16 > buf.byteLength) break;
    const t = u32(d, rec);
    if (t === 0x6e616d65) {
      // "name"
      nameOff = u32(d, rec + 8);
      nameLen = u32(d, rec + 12);
      break;
    }
  }
  if (!nameOff || nameOff + 6 > buf.byteLength) throw new Error("That font has no name table");
  const count = u16(d, nameOff + 2);
  const strOff = nameOff + u16(d, nameOff + 4);
  const found: Record<number, string> = {};
  for (let i = 0; i < count; i++) {
    const rec = nameOff + 6 + i * 12;
    if (rec + 12 > buf.byteLength) break;
    const platform = u16(d, rec);
    const encoding = u16(d, rec + 2);
    const nameId = u16(d, rec + 6);
    if (![1, 2, 16, 17].includes(nameId)) continue;
    const len = u16(d, rec + 8);
    const off = strOff + u16(d, rec + 10);
    if (off + len > buf.byteLength) continue;
    const value = readNameString(new Uint8Array(buf, off, len), platform, encoding).trim();
    // Prefer the first readable value; Windows records usually come first.
    if (value && !found[nameId]) found[nameId] = value;
  }
  const family = found[16] || found[1] || "";
  if (!family) throw new Error("That font doesn't name a family");
  void nameLen;
  return { family, subfamily: found[17] || found[2] || "Regular", cff };
}

/** Which of the four cuts a subfamily string describes. */
export function cutOf(subfamily: string): FontCut {
  const s = subfamily.toLowerCase();
  const italic = /italic|oblique/.test(s);
  const bold = /bold|black|heavy|semibold|demibold/.test(s);
  if (bold && italic) return "boldItalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "regular";
}

/** A serif guess from the family name — the reader can't be asked to classify
    their own font, and this only decides the CSS fallback and the picker's
    grouping, never the rendering when the face itself loads. */
export function kindOf(family: string): "sans" | "serif" {
  return /serif|garamond|times|georgia|book|roman|caslon|baskerville|minion|crimson|charter|palatino/i.test(
    family,
  ) && !/sans/i.test(family)
    ? "serif"
    : "sans";
}

/** `__FONT_DATA__` keys are `<stem>-<Cut>`, so the stem must be free of the
    separator and of anything that would need quoting. */
export function stemFor(family: string): string {
  const base = family.replace(/[^A-Za-z0-9]+/g, "") || "UserFont";
  return `User${base.slice(0, 40)}`;
}

/** Bytes to base64, chunked so a 300 KB face doesn't blow the argument list. */
export const toBase64 = (bytes: Uint8Array): string => {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
};

const CUT_CSS: Record<FontCut, { weight: number; style: string }> = {
  regular: { weight: 400, style: "normal" },
  bold: { weight: 700, style: "normal" },
  italic: { weight: 400, style: "italic" },
  boldItalic: { weight: 700, style: "italic" },
};

/** @font-face rules for every installed face — appended to the stylesheet the
    press hands Paged.js, so the preview and the printed PDF use the real
    outlines rather than a fallback. */
export function userFontCss(fonts: UserFont[]): string {
  let css = "";
  for (const font of fonts) {
    for (const [cut, b64] of Object.entries(font.cuts)) {
      if (!b64) continue;
      const s = CUT_CSS[cut as FontCut];
      css +=
        `@font-face{font-family:"${font.name}";font-style:${s.style};font-weight:${s.weight};` +
        `font-display:block;src:url(data:font/ttf;base64,${b64}) format("truetype")}\n`;
    }
  }
  return css;
}
