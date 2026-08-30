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

export const EngineFixture = {
  tints,
  faceName,
  fmtDate,
  PAGES,
  MARGINS,
  EMBEDDED,
  CUT_FILE,
  HL_COLORS,
};
