/* ============================================================
   engine-fixture.ts — the Engine stub the tests install as
   globalThis.Engine: exactly the members DocxExport.build reads.

   Every constant and helper is copied VERBATIM from src/js/engine.js
   (the golden source of truth). Do not "improve" values here — the
   exporter's output must match the classic engine byte-for-byte.
   ============================================================ */

/* ---------- color math (engine.js) ---------- */
function hexRgb(hex: string): number[] {
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
const rgbHex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
function mix(hex: string, other: string, k: number): string {
  // k = amount of `other`
  const a = hexRgb(hex),
    b = hexRgb(other);
  const [r, g, bl] = a.map((v, i) => v + (b[i]! - v) * k);
  return rgbHex(r!, g!, bl!);
}
function tints(accent: string) {
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

/* ---------- page geometry (engine.js) ---------- */
const PAGES = {
  A4: { w: 210, h: 297, label: "A4" },
  Letter: { w: 215.9, h: 279.4, label: "Letter" },
};
const MARGINS = {
  normal: { t: 22, r: 20, b: 24, l: 20 },
  narrow: { t: 15, r: 14, b: 18, l: 14 },
  wide: { t: 28, r: 26, b: 30, l: 26 },
};

/* ---------- embedded typefaces (engine.js) ---------- */
const EMBEDDED = [
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

/* ---------- selectable text faces (engine.js) ---------- */
const FACES: Record<string, { name: string; kind: string; label: string }> = {
  sans: { name: "DocForge Sans", kind: "sans", label: "Source Sans — humanist" },
  serif: { name: "DocForge Serif", kind: "serif", label: "Source Serif — contemporary" },
  inter: { name: "DocForge Inter", kind: "sans", label: "Inter — neutral" },
  mont: { name: "DocForge Montserrat", kind: "sans", label: "Montserrat — geometric" },
  garamond: { name: "DocForge Garamond", kind: "serif", label: "Garamond — classic book" },
  crimson: { name: "DocForge Crimson", kind: "serif", label: "Crimson — scholarly" },
};
const faceName = (key: unknown) =>
  FACES[key as string]
    ? FACES[key as string]!.name
    : typeof key === "string" && key.startsWith("sys:")
      ? key.slice(4)
      : null;

const CUT_FILE = { regular: "Regular", bold: "Bold", italic: "Italic", boldItalic: "BoldItalic" };

/* ---------- Word's fixed highlighter palette (engine.js) ---------- */
const HL_COLORS: Record<string, string> = {
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

function fmtDate(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

/* Running header/footer slots (§8.2), mirroring the engine's own resolution:
   literal text plus the live {section} marker the exporter turns into a
   STYLEREF field. Verbatim like the rest of this fixture — the real function
   lives in packages/engine/src/themes.ts and is tested there. */
const HEAD_TOKEN = /\{(title|author|date|kicker|section)\}/g;
function headParts(
  template: unknown,
  settings: Record<string, unknown>,
): { kind: "text" | "section"; text: string }[] {
  const raw = String(template ?? "");
  if (!raw.trim()) return [];
  const out: { kind: "text" | "section"; text: string }[] = [];
  const push = (kind: "text" | "section", text: string) => {
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
    else push("text", String(settings[token as string] ?? ""));
    at = m.index + m[0].length;
    m = HEAD_TOKEN.exec(raw);
  }
  push("text", raw.slice(at));
  return out.filter((p) => p.kind === "section" || p.text !== "");
}

/* The watermark's geometry (§8.2), mirroring packages/engine/src/themes.ts.
   The exporter asks the engine for it so the VML shape and the CSS stamp the
   same mark; the real function is tested there. */
function watermarkMetrics(
  text: unknown,
  page?: { w: number; h: number },
): { text: string; sizePt: number; widthPt: number; heightPt: number } {
  const word = String(text ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 48);
  const pg = page || PAGES.A4;
  const PT = 2.834645669;
  const diagonal = Math.hypot(pg.w, pg.h) * PT;
  const AVG = 0.62;
  const span = diagonal * 0.55;
  const size = Math.max(20, Math.min(130, span / (Math.max(word.length, 1) * AVG)));
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    text: word,
    sizePt: round(size),
    widthPt: round(size * AVG * Math.max(word.length, 1)),
    heightPt: round(size * 1.24),
  };
}

/* The letterhead's own pixel size (§8.2), mirroring the engine. */
function imageMetrics(dataUrl: unknown): { w: number; h: number } | null {
  const src = String(dataUrl ?? "");
  const comma = src.indexOf(",");
  if (!src.startsWith("data:image/") || comma < 0) return null;
  const type = /^data:image\/([a-z]+)/.exec(src)?.[1] ?? "";
  let bytes: Uint8Array;
  try {
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
  } catch {}
  return null;
}

export const EngineFixture = {
  tints,
  faceName,
  fmtDate,
  headParts,
  watermarkMetrics,
  imageMetrics,
  PAGES,
  MARGINS,
  EMBEDDED,
  CUT_FILE,
  HL_COLORS,
};
