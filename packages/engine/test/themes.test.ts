/* ============================================================
   themes — colour math, geometry, faces, catalogue, dynamic CSS.
   Every expected value is the ACTUAL output of src/js/engine.js
   (captured via a Node harness on 2026-08-30).
   ============================================================ */
import { describe, expect, it } from "vitest";
import type { Settings } from "../src/index.js";
import {
  CUT_FILE,
  dynamicCss,
  EMBEDDED,
  esc,
  FACES,
  FONTS,
  faceName,
  fmtDate,
  fontFaceCss,
  MARGINS,
  PAGES,
  RE_SHOT,
  sysStack,
  tints,
  WORD_CATALOG,
} from "../src/index.js";

const CSS_CASES: [string, Settings, string][] = [
  [
    "defaults-ish",
    { theme: "modern", accent: "#2563eb", page: "A4", margins: "normal" },
    '\n.doc, .pagedjs_page{--a50:#f5f8fe;--a75:#f0f4fe;--a100:#e5ecfd;--a200:#c6d6fa;--a300:#9db9f6;--a400:#6b95f1;--a500:#2563eb;--a600:#2157cf;--a700:#1b49ae;--a800:#163b8d;--a900:#112d6a;--font-head:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--font-body:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 22mm 20mm 24mm 20mm;\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n',
  ],
  [
    "academic-letter",
    {
      theme: "academic",
      accent: "#7f1d1d",
      page: "Letter",
      margins: "wide",
      header: true,
      pageNums: true,
      title: 'Quo "Vadis" \\ Report',
    },
    '\n.doc, .pagedjs_page{--a50:#f9f5f5;--a75:#f6efef;--a100:#f0e4e4;--a200:#dec4c4;--a300:#c59999;--a400:#a86565;--a500:#7f1d1d;--a600:#701a1a;--a700:#5e1515;--a800:#4c1111;--a900:#390d0d;--font-head:"DocForge Serif", Cambria, Georgia, "Times New Roman", serif;--font-body:"DocForge Serif", Cambria, Georgia, "Times New Roman", serif;--page-w:215.9mm;--page-h:279.4mm;}\n@page {\n  size: Letter;\n  margin: 28mm 26mm 30mm 26mm;\n  @top-left { content: "Quo \\"Vadis\\" \\\\ Report"; font-family:"DocForge Serif", Cambria, Georgia, "Times New Roman", serif; font-size:7.6pt; letter-spacing:0.13em; text-transform:uppercase; color:#828a99; margin-bottom:6mm; }\n  @top-right { content: string(sect); font-family:"DocForge Serif", Cambria, Georgia, "Times New Roman", serif; font-size:7.6pt; color:#828a99; margin-bottom:6mm; max-width:60mm; overflow:hidden; }\n  @bottom-center { content: var(--df-foot, " "); font-family:"DocForge Serif", Cambria, Georgia, "Times New Roman", serif; font-size:8.2pt; color:#71798a; margin-top:6mm; font-variant-numeric: tabular-nums; }\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n',
  ],
  [
    "exec-narrow-borders",
    {
      theme: "executive",
      accent: "#1f3a5f",
      page: "A4",
      margins: "narrow",
      borderStyle: "triple",
      borderWeight: "bold",
      borderColor: "accent",
    },
    '\n.doc, .pagedjs_page{--a50:#f5f6f8;--a75:#eff1f4;--a100:#e4e7ec;--a200:#c5ccd5;--a300:#9aa6b7;--a400:#677992;--a500:#1f3a5f;--a600:#1b3354;--a700:#172b46;--a800:#132339;--a900:#0e1a2b;--font-head:"DocForge Serif", Cambria, Georgia, "Times New Roman", serif;--font-body:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 15mm 14mm 18mm 14mm;\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n\n.pagedjs_page { position: relative; }\n.pagedjs_page::after {\n  content: "";\n  position: absolute;\n  inset: 3mm;   /* the outer edge; every style grows inward from here, clear of the header */\n  border: 1.8pt solid #1b3354; box-shadow: inset 0 0 0 3.6pt #fff, inset 0 0 0 5.4pt #1b3354, inset 0 0 0 7.2pt #fff, inset 0 0 0 9pt #1b3354;\n  pointer-events: none;\n  z-index: 5;\n}\n.pagedjs_page:has(.cover)::after { content: none; }\n',
  ],
  [
    "minimal-type",
    {
      theme: "minimal",
      accent: "#111827",
      page: "A4",
      margins: "normal",
      baseSize: "12",
      lineSpacing: "1.5",
    },
    '\n.doc, .pagedjs_page{--a50:#f4f5f5;--a75:#eeeff0;--a100:#e2e3e5;--a200:#c1c3c7;--a300:#94979e;--a400:#5d626c;--a500:#111827;--a600:#0f1522;--a700:#0d121d;--a800:#0a0e17;--a900:#080b12;--font-head:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--font-body:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 22mm 20mm 24mm 20mm;\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n.doc .content{font-size:12pt;line-height:1.77;}\n',
  ],
  [
    "fonts-embedded",
    {
      theme: "modern",
      accent: "#2563eb",
      page: "A4",
      margins: "normal",
      fontHead: "mont",
      fontBody: "garamond",
    },
    '\n.doc, .pagedjs_page{--a50:#f5f8fe;--a75:#f0f4fe;--a100:#e5ecfd;--a200:#c6d6fa;--a300:#9db9f6;--a400:#6b95f1;--a500:#2563eb;--a600:#2157cf;--a700:#1b49ae;--a800:#163b8d;--a900:#112d6a;--font-head:"DocForge Montserrat", Arial, sans-serif;--font-body:"DocForge Garamond", Georgia, serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 22mm 20mm 24mm 20mm;\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n',
  ],
  [
    "fonts-sys",
    {
      theme: "academic",
      accent: "#7f1d1d",
      page: "A4",
      margins: "normal",
      fontHead: "sys:Georgia",
      fontBody: "sys:Times New Roman",
    },
    '\n.doc, .pagedjs_page{--a50:#f9f5f5;--a75:#f6efef;--a100:#f0e4e4;--a200:#dec4c4;--a300:#c59999;--a400:#a86565;--a500:#7f1d1d;--a600:#701a1a;--a700:#5e1515;--a800:#4c1111;--a900:#390d0d;--font-head:"Georgia", Georgia, serif;--font-body:"Times New Roman", Georgia, serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 22mm 20mm 24mm 20mm;\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n',
  ],
  [
    "border-each-rule",
    { theme: "modern", accent: "#2563eb", borderStyle: "rule", borderWeight: "fine" },
    '\n.doc, .pagedjs_page{--a50:#f5f8fe;--a75:#f0f4fe;--a100:#e5ecfd;--a200:#c6d6fa;--a300:#9db9f6;--a400:#6b95f1;--a500:#2563eb;--a600:#2157cf;--a700:#1b49ae;--a800:#163b8d;--a900:#112d6a;--font-head:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--font-body:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 22mm 20mm 24mm 20mm;\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n\n.pagedjs_page { position: relative; }\n.pagedjs_page::after {\n  content: "";\n  position: absolute;\n  inset: 3mm;   /* the outer edge; every style grows inward from here, clear of the header */\n  border: 0.75pt solid #3c434e;\n  pointer-events: none;\n  z-index: 5;\n}\n.pagedjs_page:has(.cover)::after { content: none; }\n',
  ],
  [
    "border-double",
    {
      theme: "modern",
      accent: "#2563eb",
      borderStyle: "double",
      borderWeight: "medium",
      borderColor: "accent",
    },
    '\n.doc, .pagedjs_page{--a50:#f5f8fe;--a75:#f0f4fe;--a100:#e5ecfd;--a200:#c6d6fa;--a300:#9db9f6;--a400:#6b95f1;--a500:#2563eb;--a600:#2157cf;--a700:#1b49ae;--a800:#163b8d;--a900:#112d6a;--font-head:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--font-body:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 22mm 20mm 24mm 20mm;\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n\n.pagedjs_page { position: relative; }\n.pagedjs_page::after {\n  content: "";\n  position: absolute;\n  inset: 3mm;   /* the outer edge; every style grows inward from here, clear of the header */\n  border: 4.5pt double #2157cf;\n  pointer-events: none;\n  z-index: 5;\n}\n.pagedjs_page:has(.cover)::after { content: none; }\n',
  ],
  [
    "border-dashed",
    { theme: "modern", accent: "#2563eb", borderStyle: "dashed" },
    '\n.doc, .pagedjs_page{--a50:#f5f8fe;--a75:#f0f4fe;--a100:#e5ecfd;--a200:#c6d6fa;--a300:#9db9f6;--a400:#6b95f1;--a500:#2563eb;--a600:#2157cf;--a700:#1b49ae;--a800:#163b8d;--a900:#112d6a;--font-head:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--font-body:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 22mm 20mm 24mm 20mm;\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n\n.pagedjs_page { position: relative; }\n.pagedjs_page::after {\n  content: "";\n  position: absolute;\n  inset: 3mm;   /* the outer edge; every style grows inward from here, clear of the header */\n  border: 2.1pt dashed #3c434e;\n  pointer-events: none;\n  z-index: 5;\n}\n.pagedjs_page:has(.cover)::after { content: none; }\n',
  ],
  [
    "border-dotted",
    { theme: "modern", accent: "#2563eb", borderStyle: "dotted", borderWeight: "bold" },
    '\n.doc, .pagedjs_page{--a50:#f5f8fe;--a75:#f0f4fe;--a100:#e5ecfd;--a200:#c6d6fa;--a300:#9db9f6;--a400:#6b95f1;--a500:#2563eb;--a600:#2157cf;--a700:#1b49ae;--a800:#163b8d;--a900:#112d6a;--font-head:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--font-body:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 22mm 20mm 24mm 20mm;\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n\n.pagedjs_page { position: relative; }\n.pagedjs_page::after {\n  content: "";\n  position: absolute;\n  inset: 3mm;   /* the outer edge; every style grows inward from here, clear of the header */\n  border: 3.15pt dotted #3c434e;\n  pointer-events: none;\n  z-index: 5;\n}\n.pagedjs_page:has(.cover)::after { content: none; }\n',
  ],
  [
    "border-thickthin",
    { theme: "modern", accent: "#2563eb", borderStyle: "thickthin" },
    '\n.doc, .pagedjs_page{--a50:#f5f8fe;--a75:#f0f4fe;--a100:#e5ecfd;--a200:#c6d6fa;--a300:#9db9f6;--a400:#6b95f1;--a500:#2563eb;--a600:#2157cf;--a700:#1b49ae;--a800:#163b8d;--a900:#112d6a;--font-head:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--font-body:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 22mm 20mm 24mm 20mm;\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n\n.pagedjs_page { position: relative; }\n.pagedjs_page::after {\n  content: "";\n  position: absolute;\n  inset: 3mm;   /* the outer edge; every style grows inward from here, clear of the header */\n  border: 3pt solid #3c434e; box-shadow: inset 0 0 0 1.8pt #fff, inset 0 0 0 2.7pt #3c434e;\n  pointer-events: none;\n  z-index: 5;\n}\n.pagedjs_page:has(.cover)::after { content: none; }\n',
  ],
  [
    "border-thinthick",
    {
      theme: "modern",
      accent: "#2563eb",
      borderStyle: "thinthick",
      borderWeight: "fine",
      borderColor: "accent",
    },
    '\n.doc, .pagedjs_page{--a50:#f5f8fe;--a75:#f0f4fe;--a100:#e5ecfd;--a200:#c6d6fa;--a300:#9db9f6;--a400:#6b95f1;--a500:#2563eb;--a600:#2157cf;--a700:#1b49ae;--a800:#163b8d;--a900:#112d6a;--font-head:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--font-body:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 22mm 20mm 24mm 20mm;\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n\n.pagedjs_page { position: relative; }\n.pagedjs_page::after {\n  content: "";\n  position: absolute;\n  inset: 3mm;   /* the outer edge; every style grows inward from here, clear of the header */\n  border: 0.52pt solid #2157cf; box-shadow: inset 0 0 0 0.9pt #fff, inset 0 0 0 2.4pt #2157cf;\n  pointer-events: none;\n  z-index: 5;\n}\n.pagedjs_page:has(.cover)::after { content: none; }\n',
  ],
  [
    "unknown-page-margins",
    {
      theme: "nope",
      accent: "#123456",
      page: "Tabloid",
      margins: "huge",
      lineSpacing: "3",
      baseSize: "11",
    },
    '\n.doc, .pagedjs_page{--a50:#f4f6f7;--a75:#eef1f3;--a100:#e3e7eb;--a200:#c1cad3;--a300:#94a4b3;--a400:#5e758c;--a500:#123456;--a600:#102e4c;--a700:#0d2640;--a800:#0b1f34;--a900:#081727;--font-head:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--font-body:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 22mm 20mm 24mm 20mm;\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n',
  ],
  [
    "hardwrap-header",
    {
      theme: "modern",
      accent: "#2563eb",
      hardWrap: true,
      header: true,
      pageNums: true,
      title: "Plain",
    },
    '\n.doc, .pagedjs_page{--a50:#f5f8fe;--a75:#f0f4fe;--a100:#e5ecfd;--a200:#c6d6fa;--a300:#9db9f6;--a400:#6b95f1;--a500:#2563eb;--a600:#2157cf;--a700:#1b49ae;--a800:#163b8d;--a900:#112d6a;--font-head:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--font-body:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;--page-w:210mm;--page-h:297mm;}\n@page {\n  size: A4;\n  margin: 22mm 20mm 24mm 20mm;\n  @top-left { content: "Plain"; font-family:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif; font-size:7.6pt; letter-spacing:0.13em; text-transform:uppercase; color:#828a99; margin-bottom:6mm; }\n  @top-right { content: string(sect); font-family:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif; font-size:7.6pt; color:#828a99; margin-bottom:6mm; max-width:60mm; overflow:hidden; }\n  @bottom-center { content: var(--df-foot, " "); font-family:"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif; font-size:8.2pt; color:#71798a; margin-top:6mm; font-variant-numeric: tabular-nums; }\n  @footnote {\n    border-top: 1px solid #d7dbe0;\n    padding-top: 4px;\n    padding-bottom: 3px;\n    margin-top: 11px;\n  }\n}\n@page cover { margin: 0;\n  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }\n}\n@page front {\n  @top-right { content: none; }\n}\n.doc .content h1 { string-set: sect content(text); }\n',
  ],
];

describe("dynamicCss", () => {
  it.each(CSS_CASES)("%s", (_name, settings, expected) => {
    expect(dynamicCss(settings)).toBe(expected);
  });
});

const TINTS: [string, Record<string, string>][] = [
  [
    "#2563eb",
    {
      a50: "#f5f8fe",
      a75: "#f0f4fe",
      a100: "#e5ecfd",
      a200: "#c6d6fa",
      a300: "#9db9f6",
      a400: "#6b95f1",
      a500: "#2563eb",
      a600: "#2157cf",
      a700: "#1b49ae",
      a800: "#163b8d",
      a900: "#112d6a",
    },
  ],
  [
    "#7f1d1d",
    {
      a50: "#f9f5f5",
      a75: "#f6efef",
      a100: "#f0e4e4",
      a200: "#dec4c4",
      a300: "#c59999",
      a400: "#a86565",
      a500: "#7f1d1d",
      a600: "#701a1a",
      a700: "#5e1515",
      a800: "#4c1111",
      a900: "#390d0d",
    },
  ],
  [
    "#111827",
    {
      a50: "#f4f5f5",
      a75: "#eeeff0",
      a100: "#e2e3e5",
      a200: "#c1c3c7",
      a300: "#94979e",
      a400: "#5d626c",
      a500: "#111827",
      a600: "#0f1522",
      a700: "#0d121d",
      a800: "#0a0e17",
      a900: "#080b12",
    },
  ],
  [
    "#c2410c",
    {
      a50: "#fcf6f4",
      a75: "#fbf2ee",
      a100: "#f8e8e2",
      a200: "#efcec0",
      a300: "#e4aa92",
      a400: "#d67e5a",
      a500: "#c2410c",
      a600: "#ab390b",
      a700: "#903009",
      a800: "#742707",
      a900: "#571d05",
    },
  ],
  [
    "#000",
    {
      a50: "#f4f4f4",
      a75: "#ededed",
      a100: "#e0e0e0",
      a200: "#bdbdbd",
      a300: "#8c8c8c",
      a400: "#525252",
      a500: "#000",
      a600: "#000000",
      a700: "#000000",
      a800: "#000000",
      a900: "#000000",
    },
  ],
  [
    "#fff",
    {
      a50: "#ffffff",
      a75: "#ffffff",
      a100: "#ffffff",
      a200: "#ffffff",
      a300: "#ffffff",
      a400: "#ffffff",
      a500: "#fff",
      a600: "#e0e0e0",
      a700: "#bdbdbd",
      a800: "#999999",
      a900: "#737373",
    },
  ],
  [
    "#0f62fe",
    {
      a50: "#f4f8ff",
      a75: "#eef4ff",
      a100: "#e2ecff",
      a200: "#c1d6ff",
      a300: "#93b8ff",
      a400: "#5c94fe",
      a500: "#0f62fe",
      a600: "#0d56e0",
      a700: "#0b49bc",
      a800: "#093b98",
      a900: "#072c72",
    },
  ],
];

describe("tints", () => {
  it.each(TINTS)("%s", (accent, expected) => {
    expect(tints(accent)).toEqual(expected);
  });
});

const SYS: [unknown, string][] = [
  ["Georgia", '"Georgia", Georgia, serif'],
  ["Times New Roman", '"Times New Roman", Georgia, serif'],
  ["Consolas", '"Consolas", Consolas, monospace'],
  ["Segoe Script", '"Segoe Script", "Segoe Script", cursive'],
  ["Impact", '"Impact", Impact, sans-serif'],
  ["Comic Sans MS", '"Comic Sans MS", Arial, sans-serif'],
  ["DocForge Serif", '"DocForge Serif", Cambria, Georgia, "Times New Roman", serif'],
  [
    "DocForge Sans",
    '"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif',
  ],
  ["DocForge Garamond", '"DocForge Garamond", Cambria, Georgia, "Times New Roman", serif'],
  ["DocForge Crimson", '"DocForge Crimson", Cambria, Georgia, "Times New Roman", serif'],
  [
    "DocForge Mono",
    '"DocForge Mono", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif',
  ],
  ["NoSuch Face", '"NoSuch Face", Arial, sans-serif'],
  ["", "Arial, sans-serif"],
  [null, "Arial, sans-serif"],
  [undefined, "Arial, sans-serif"],
  ['Evil"; } body { color: red', '"Evil  body  color: red", Arial, sans-serif'],
  ["  spaced  ", '"spaced", Arial, sans-serif'],
  ["gEoRgIa", '"gEoRgIa", Georgia, serif'],
  ["aptos mono", '"aptos mono", Consolas, monospace'],
  ["Vivaldi", '"Vivaldi", "Segoe Script", cursive'],
  ["Sitka Text", '"Sitka Text", Georgia, serif'],
];

describe("sysStack", () => {
  it.each(SYS)("%s", (name, expected) => {
    expect(sysStack(name)).toBe(expected);
  });
});

const DATES: [string | null | undefined, string][] = [
  ["2026-08-30", "30 August 2026"],
  ["2025-03-31", "31 March 2025"],
  ["2024-01-01", "1 January 2024"],
  ["", ""],
  [null, ""],
  [undefined, ""],
  ["bogus", "Invalid Date"],
  ["2024-13-45", "Invalid Date"],
];

describe("fmtDate", () => {
  it.each(DATES)("%s", (iso, expected) => {
    expect(fmtDate(iso)).toBe(expected);
  });
  it('BUG (preserved): an unparsable date returns the string "Invalid Date", not the input', () => {
    // new Date("bogusT12:00:00") is an Invalid Date; toLocaleDateString does not
    // throw, so the catch never fires. Frozen behavior.
    expect(fmtDate("bogus")).toBe("Invalid Date");
  });
});

describe("constants (public API shapes)", () => {
  it("PAGES / MARGINS", () => {
    expect(PAGES).toEqual({
      A4: { w: 210, h: 297, label: "A4" },
      Letter: { w: 215.9, h: 279.4, label: "Letter" },
    });
    expect(MARGINS).toEqual({
      normal: { t: 22, r: 20, b: 24, l: 20 },
      narrow: { t: 15, r: 14, b: 18, l: 14 },
      wide: { t: 28, r: 26, b: 30, l: 26 },
    });
  });
  it("FONTS carries the theme pairings with full fallback stacks", () => {
    expect(FONTS).toEqual({
      modern: {
        head: '"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif',
        body: '"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif',
      },
      executive: {
        head: '"DocForge Serif", Cambria, Georgia, "Times New Roman", serif',
        body: '"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif',
      },
      academic: {
        head: '"DocForge Serif", Cambria, Georgia, "Times New Roman", serif',
        body: '"DocForge Serif", Cambria, Georgia, "Times New Roman", serif',
      },
      minimal: {
        head: '"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif',
        body: '"DocForge Sans", "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif',
      },
    });
  });
  it("FACES keys and names", () => {
    expect(Object.keys(FACES)).toEqual(["sans", "serif", "inter", "mont", "garamond", "crimson"]);
    expect(FACES.serif).toEqual({
      name: "DocForge Serif",
      kind: "serif",
      label: "Source Serif \u2014 contemporary",
    });
  });
  it("EMBEDDED: seven families, Mono has no italic cuts", () => {
    expect(EMBEDDED.map((f) => f.name)).toEqual([
      "DocForge Sans",
      "DocForge Serif",
      "DocForge Mono",
      "DocForge Inter",
      "DocForge Montserrat",
      "DocForge Garamond",
      "DocForge Crimson",
    ]);
    expect(EMBEDDED[2].cuts).toEqual({ regular: 1, bold: 1 });
    expect(EMBEDDED[0].cuts).toEqual({ regular: 1, bold: 1, italic: 1, boldItalic: 1 });
  });
  it("CUT_FILE", () => {
    expect(CUT_FILE).toEqual({
      regular: "Regular",
      bold: "Bold",
      italic: "Italic",
      boldItalic: "BoldItalic",
    });
  });
  it("WORD_CATALOG: 190 families, group order preserved", () => {
    expect(WORD_CATALOG.length).toBe(190);
    expect(WORD_CATALOG[0]).toEqual(["Agency FB", "sans"]);
    expect(WORD_CATALOG[WORD_CATALOG.length - 1]).toEqual(["Wide Latin", "display"]);
    expect(WORD_CATALOG.filter((w) => w[1] === "mono").map((w) => w[0])).toContain("Cascadia Code");
    expect(WORD_CATALOG.find((w) => w[0] === "Times New Roman")).toEqual([
      "Times New Roman",
      "serif",
    ]);
  });
  it("RE_SHOT is the exact classic regex", () => {
    expect(String(RE_SHOT)).toBe(
      "/^\\[screenshot(?::\\s*([^\\]|]*?))?((?:\\s*\\|\\s*[^\\]|]+)*)\\]\\s*$/i",
    );
    expect(RE_SHOT.test("[screenshot: x | w:60%]")).toBe(true);
    expect(RE_SHOT.test("not a shot")).toBe(false);
  });
  it("faceName maps embedded keys and passes sys: through", () => {
    expect(
      [
        "sans",
        "serif",
        "inter",
        "mont",
        "garamond",
        "crimson",
        "sys:Arial Black",
        "nope",
        null,
      ].map((k) => faceName(k)),
    ).toEqual([
      "DocForge Sans",
      "DocForge Serif",
      "DocForge Inter",
      "DocForge Montserrat",
      "DocForge Garamond",
      "DocForge Crimson",
      "Arial Black",
      null,
      null,
    ]);
  });
  it("esc", () => {
    expect(esc(`<a href="x">&'quote'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;quote&#39;&lt;/a&gt;",
    );
    expect([esc(null), esc(undefined), esc(0)]).toEqual(["", "", "0"]);
  });
});

describe("fontFaceCss", () => {
  it("emits one @font-face per available cut, from window.__FONT_DATA__", () => {
    (window as Window).__FONT_DATA__ = {
      "DocForgeSans-Regular": "AAAA",
      "DocForgeMono-Bold": "BBBB",
    };
    try {
      expect(fontFaceCss()).toBe(
        '@font-face{font-family:"DocForge Sans";font-style:normal;font-weight:400;font-display:block;src:url(data:font/ttf;base64,AAAA) format("truetype")}\n' +
          '@font-face{font-family:"DocForge Mono";font-style:normal;font-weight:700;font-display:block;src:url(data:font/ttf;base64,BBBB) format("truetype")}\n',
      );
    } finally {
      delete (window as Window).__FONT_DATA__;
    }
  });
  it("no font data, no css", () => {
    expect(fontFaceCss()).toBe("");
  });
});
