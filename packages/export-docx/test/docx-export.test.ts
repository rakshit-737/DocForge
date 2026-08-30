// @vitest-environment happy-dom
/* ============================================================
   DocxExport.build — the DOM the engine renders goes in, real
   OOXML comes out. The real docx npm package plays the window.docx
   global, a verbatim Engine stub supplies the constants build()
   reads, and __FONT_DATA__ is a tiny fake so the font-embedding
   path (including the DocxFonts regroup rewrite) runs for real.
   ============================================================ */

import { Buffer } from "node:buffer";
import * as docxLib from "docx";
import { convertMillimetersToTwip } from "docx";
import katex from "katex";
import { beforeAll, describe, expect, it } from "vitest";
import type { DocxSettings } from "../src/index.js";
import { build } from "../src/index.js";
import { readZip } from "./_zip.js";
import { EngineFixture } from "./engine-fixture.js";

/* ---- install the globals the classic build provides ---- */
const fakeCut = (seed: number): string => {
  const b = Buffer.alloc(64);
  for (let i = 0; i < b.length; i++) b[i] = (seed * 31 + i) & 0xff;
  return b.toString("base64");
};
const FONT_DATA: Record<string, string> = {
  "DocForgeSans-Regular": fakeCut(1),
  "DocForgeSans-Bold": fakeCut(2),
  "DocForgeSans-Italic": fakeCut(3),
  "DocForgeSans-BoldItalic": fakeCut(4),
  "DocForgeMono-Regular": fakeCut(5),
  "DocForgeMono-Bold": fakeCut(6),
};

(globalThis as any).Engine = EngineFixture;
(globalThis as any).katex = katex; // MathmlOmml reads the katex global
(globalThis as any).docx = docxLib;
(globalThis as any).__FONT_DATA__ = FONT_DATA;
if (typeof window !== "undefined") {
  (window as any).docx = docxLib;
  (window as any).__FONT_DATA__ = FONT_DATA;
}

function contentFrom(html: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "content";
  el.innerHTML = html;
  return el;
}

const SETTINGS: DocxSettings = {
  theme: "modern",
  accent: "#2458c5",
  page: "A4",
  margins: "normal",
  title: "Spec Document",
  subtitle: "A torture fixture",
  author: "A. Author",
  kicker: "Report",
  date: "2026-01-05",
  cover: false,
  header: true,
  pageNums: true,
  justify: false,
  h1break: false,
  baseSize: "11",
  lineSpacing: "1.15",
  borderStyle: "rule",
  borderWeight: "medium",
  borderColor: "ink",
};

/* The post-processed DOM shapes engine.js hands to the exporter. */
const FIXTURE_HTML = [
  '<div class="toc-wrap"><div class="toc-title">Contents</div></div>',
  "<h1>Introduction</h1>",
  "<h2>Background</h2>",
  "<p>plain <strong>boldtxt</strong> <em>italtxt</em> <u>undertxt</u> <del>strucktxt</del> " +
    '<mark data-hl="green">markedtxt</mark> <sub>subtxt</sub> <sup>suptxt</sup> <code>mono()</code> ' +
    '<span class="dfspan" data-color="cc0000" data-bg="ffe28a" data-size="14" data-font="Georgia" ' +
    'data-u="1" data-sc="1">styledtxt</span> ' +
    // caps rides its own span: the docx lib emits only <w:smallCaps/> when both are set
    // (OOXML treats them as exclusive), so sc+caps together would hide the caps property.
    '<span class="dfspan" data-caps="1">capstxt</span></p>',
  '<p>Claim.<span class="footnote" data-fn="1">The note text.</span> More prose.</p>',
  '<table data-cols="120,240">' +
    '<caption><span class="tbl-label">Table 1</span> — Widths</caption>' +
    "<tbody><tr><th>Head A</th><th>Head B</th></tr>" +
    '<tr><td align="center">a1</td><td>b1</td></tr></tbody></table>',
  '<p>Inline math <span class="math-inline" data-tex="x^2"></span> here.</p>',
  '<div class="math-display" data-tex="\\frac{a}{b}"></div>',
  "<ol><li>first item</li><li>second item</li></ol>",
  '<div class="banner"><p>Plate Title</p><p>Plate sub</p></div>',
  '<pre><code><span class="hljs-keyword">const</span> kw = 1;\n</code></pre>',
].join("");

const T = EngineFixture.tints(SETTINGS.accent);
const up = (h: string) => h.replace("#", "").toUpperCase();

let docXml = "",
  stylesXml = "",
  numXml = "",
  ftXml = "",
  fnXml = "";
let runChunks: string[] = [];

const runOf = (text: string): string => {
  const c = runChunks.find((c) => c.includes(`>${text}<`));
  expect(c, `a run containing "${text}"`).toBeDefined();
  return c!;
};

beforeAll(async () => {
  const blob = await build(contentFrom(FIXTURE_HTML), SETTINGS);
  const zip = readZip(Buffer.from(await blob.arrayBuffer()));
  docXml = zip.get("word/document.xml")!.toString("utf8");
  stylesXml = zip.get("word/styles.xml")!.toString("utf8");
  numXml = zip.get("word/numbering.xml")!.toString("utf8");
  ftXml = zip.get("word/fontTable.xml")!.toString("utf8");
  fnXml = (zip.get("word/footnotes.xml") ?? Buffer.alloc(0)).toString("utf8");
  runChunks = docXml.split("<w:r>").map((c) => "<w:r>" + c);
});

describe("headings", () => {
  it("map to the Word heading styles", () => {
    expect(docXml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(docXml).toContain('<w:pStyle w:val="Heading2"/>');
    expect(docXml).toContain(">Introduction<");
    expect(docXml).toContain(">Background<");
  });
  it("keep with the text that follows", () => {
    expect(docXml).toContain("<w:keepNext/>");
    expect(docXml).toContain("<w:keepLines/>");
  });
  it("H1 carries the accent bottom rule", () => {
    const bottoms = docXml.match(/<w:bottom [^>]*\/>/g) || [];
    expect(
      bottoms.some(
        (b) =>
          b.includes('w:sz="8"') &&
          b.includes('w:space="3"') &&
          b.includes(`w:color="${up(T.a600)}"`),
      ),
    ).toBe(true);
  });
  it("heading styles live in styles.xml with the theme faces", () => {
    expect(stylesXml).toContain('w:styleId="Heading1"');
    expect(stylesXml).toContain('w:styleId="DFHeader"');
    expect(stylesXml).toContain('w:ascii="DocForge Sans"');
    expect(stylesXml).toContain(`<w:color w:val="${up(T.a800)}"/>`); // heading2 tint
  });
});

describe("ribbon marks", () => {
  const cases: [label: string, text: string, needles: (string | RegExp)[]][] = [
    ["bold", "boldtxt", [/<w:b\/>/]],
    ["italic", "italtxt", [/<w:i\/>/]],
    ["underline", "undertxt", [/<w:u [^>]*\/>/]],
    ["strikethrough", "strucktxt", [/<w:strike\/>/]],
    ["highlight", "markedtxt", ['<w:highlight w:val="green"/>']],
    ["subscript", "subtxt", ['<w:vertAlign w:val="subscript"/>']],
    ["superscript", "suptxt", ['<w:vertAlign w:val="superscript"/>']],
    ["inline code", "mono()", ['w:ascii="DocForge Mono"', '<w:sz w:val="19"/>', 'w:fill="F0F2F5"']],
    [
      "attribute span (colour/bg/size/font/u/sc)",
      "styledtxt",
      [
        '<w:color w:val="CC0000"/>',
        'w:fill="FFE28A"',
        '<w:sz w:val="28"/>',
        'w:ascii="Georgia"',
        /<w:u [^>]*\/>/,
        /<w:smallCaps\/>/,
      ],
    ],
    ["attribute span (caps)", "capstxt", [/<w:caps\/>/]],
  ];
  it.each(cases)("%s becomes a real run property", (_label, text, needles) => {
    const run = runOf(text);
    for (const n of needles) {
      if (typeof n === "string") expect(run).toContain(n);
      else expect(run).toMatch(n);
    }
  });
});

describe("footnotes", () => {
  it("the reference run sits at the call site", () => {
    expect(docXml).toMatch(/<w:footnoteReference w:id="1"\/>/);
  });
  it("the note text lives only in word/footnotes.xml", () => {
    expect(docXml).not.toContain("The note text.");
    expect(fnXml).toMatch(/<w:footnote [^>]*w:id="1"/);
    expect(fnXml).toContain("The note text.");
  });
  it("the note is set small and dim", () => {
    expect(fnXml).toContain('<w:sz w:val="17"/>');
    expect(fnXml).toContain('<w:color w:val="3D434D"/>');
  });
});

describe("captioned table", () => {
  it("column widths keep the measured proportions", () => {
    const totalTw = convertMillimetersToTwip(210 - 20 - 20);
    const w1 = Math.round((120 / 360) * totalTw);
    const w2 = Math.round((240 / 360) * totalTw);
    expect(docXml).toContain(`<w:gridCol w:w="${w1}"/>`);
    expect(docXml).toContain(`<w:gridCol w:w="${w2}"/>`);
  });
  it("caption paragraph precedes the table and repeats the label", () => {
    expect(docXml).toContain(">Table 1<");
    expect(docXml).toContain(" — Widths");
  });
  it("header row repeats across pages and rows do not split", () => {
    expect(docXml).toContain("<w:tblHeader/>");
    expect(docXml).toContain("<w:cantSplit/>");
  });
  it("cell alignment survives", () => {
    expect(docXml).toContain('<w:jc w:val="center"/>');
  });
});

describe("equations (OMML)", () => {
  it("inline math becomes a real m:oMath", () => {
    expect(docXml).toContain("<m:oMath");
  });
  it("display math becomes an m:oMathPara", () => {
    expect(docXml).toContain("<m:oMathPara");
  });
});

describe("TOC", () => {
  it("emits the Word TOC field code for headings 1-3 with hyperlinks", () => {
    const instr = (docXml.match(/<w:instrText[^>]*>([^<]*)<\/w:instrText>/g) || [])
      .join(" ")
      .replace(/&quot;/g, '"');
    expect(instr).toContain("TOC");
    expect(instr).toContain('\\o "1-3"');
    expect(instr).toContain("\\h");
  });
  it("splits the front matter into its own roman-numbered section", () => {
    expect(docXml).toContain('w:fmt="lowerRoman"');
    expect(docXml).toContain('w:fmt="decimal"');
  });
});

describe("page borders", () => {
  it("draws the rule style on the section, offset from the page edge", () => {
    const pgb = docXml.match(/<w:pgBorders[^>]*>/);
    expect(pgb).not.toBeNull();
    expect(pgb![0]).toContain('w:display="allPages"');
    expect(pgb![0]).toContain('w:offsetFrom="page"');
    expect(pgb![0]).toContain('w:zOrder="front"');
    const tops = docXml.match(/<w:top [^>]*\/>/g) || [];
    expect(
      tops.some(
        (b) =>
          b.includes('w:val="single"') &&
          b.includes('w:sz="12"') &&
          b.includes('w:space="9"') &&
          b.includes('w:color="3C434E"'),
      ),
    ).toBe(true);
  });
});

describe(":::banner", () => {
  it("is a one-cell table shaded deep slate", () => {
    expect(docXml).toContain('w:fill="1F2733"');
  });
  it("first line is large, white and bold in the heading face", () => {
    const first = runOf("Plate Title");
    expect(first).toMatch(/<w:b\/>/);
    expect(first).toContain('<w:sz w:val="34"/>');
    expect(first).toContain('<w:color w:val="FFFFFF"/>');
    expect(first).toContain('w:ascii="DocForge Sans"');
  });
  it("following lines are small in the light accent tint", () => {
    const second = runOf("Plate sub");
    expect(second).toContain('<w:sz w:val="21"/>');
    expect(second).toContain(`<w:color w:val="${up(T.a200)}"/>`);
  });
});

describe("lists", () => {
  it("ordered list paragraphs reference the ol-num numbering", () => {
    expect(docXml).toContain('<w:ilvl w:val="0"/>');
    expect(docXml).toContain(">first item<");
  });
  it("numbering.xml defines decimal / lowerLetter / lowerRoman levels", () => {
    expect(numXml).toContain('w:val="decimal"');
    expect(numXml).toContain('w:val="lowerLetter"');
    expect(numXml).toContain('w:val="lowerRoman"');
    expect(numXml).toContain('w:val="%1."');
    expect(numXml).toContain('w:val="%2."');
    expect(numXml).toContain('w:val="%3."');
  });
});

describe("code blocks", () => {
  it("set mono runs inside the shaded box, hljs colours preserved", () => {
    const kw = runOf("const");
    expect(kw).toContain('<w:color w:val="8F3F9C"/>');
    expect(kw).toContain('w:ascii="DocForge Mono"');
    expect(kw).toContain('<w:sz w:val="18"/>');
    expect(docXml).toContain('w:fill="F6F8FA"');
  });
});

describe("font embedding", () => {
  it("regroups the used families under their real names in fontTable.xml", () => {
    expect(ftXml).toContain('<w:font w:name="DocForge Sans">');
    expect(ftXml).toContain('<w:font w:name="DocForge Mono">'); // pre/code pulls mono in
    expect(ftXml).toMatch(/<w:embedRegular r:id="[^"]+" w:fontKey="[^"]+"\/>/);
    expect(ftXml).toMatch(/<w:embedBold r:id="[^"]+" w:fontKey="[^"]+"\/>/);
    // the throwaway per-cut families are gone after the regroup rewrite
    expect(ftXml).not.toContain('w:name="DocForgeSans-Regular"');
  });

  it("stays entirely skipped when only system faces are used (Word corruption guard)", async () => {
    const el = contentFrom("<h1>T</h1><p>x</p>"); // no pre/code, no dfspan fonts
    const blob = await build(el, { ...SETTINGS, fontHead: "sys:Georgia", fontBody: "sys:Georgia" });
    const zip = readZip(Buffer.from(await blob.arrayBuffer()));
    const ft = zip.get("word/fontTable.xml")!.toString("utf8");
    expect(ft).not.toContain("DocForge");
    expect(ft).not.toContain("w:embedRegular");
    // the bare system family name rides in the styles, un-embedded
    expect(zip.get("word/styles.xml")!.toString("utf8")).toContain('w:ascii="Georgia"');
  });
});
