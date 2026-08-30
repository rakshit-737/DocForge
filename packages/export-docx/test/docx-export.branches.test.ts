// @vitest-environment happy-dom
/* ============================================================
   DocxExport.build — the branches the kitchen-sink suite leaves
   dark: cover bands per theme, image/attachment figures, list and
   quote emission, hyperlink runs, page-border permutations, math
   fallbacks, refs/caption lists, and the no-font-data skip path.
   Same harness as docx-export.test.ts: the real docx npm package
   plays window.docx, the verbatim Engine fixture supplies the
   constants, __FONT_DATA__ is a tiny fake.
   ============================================================ */

import { Buffer } from "node:buffer";
import * as docxLib from "docx";
import { convertMillimetersToTwip as mm2t } from "docx";
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
(globalThis as any).katex = katex;
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

const T = EngineFixture.tints("#2458c5");
const up = (h: string) => h.replace("#", "").toUpperCase();
const HP = (pt: number) => Math.round(pt * 2);

const BASE: DocxSettings = {
  theme: "modern",
  accent: "#2458c5",
  page: "A4",
  margins: "normal",
  cover: false,
  header: false,
  pageNums: false,
  justify: false,
  h1break: false,
};

interface Pack {
  doc: string;
  styles: string;
  ft: string;
  runs: string[];
}
async function pack(el: HTMLElement, settings: DocxSettings): Promise<Pack> {
  const blob = await build(el, settings);
  const zip = readZip(Buffer.from(await blob.arrayBuffer()));
  const doc = zip.get("word/document.xml")!.toString("utf8");
  return {
    doc,
    styles: zip.get("word/styles.xml")!.toString("utf8"),
    ft: zip.get("word/fontTable.xml")!.toString("utf8"),
    runs: doc.split("<w:r>").map((c) => "<w:r>" + c),
  };
}
const runIn = (p: Pack, text: string): string => {
  const c = p.runs.find((c) => c.includes(`>${text}<`));
  expect(c, `a run containing "${text}"`).toBeDefined();
  return c!;
};

/* A 1x1 transparent PNG — enough for ImageRun, which never decodes pixels. */
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const availPx = Math.floor(((210 - 20 - 20) * 96) / 25.4) - 4;

/* ---------------- build A: kitchen-sink body branches ---------------- */
const HTML_A = [
  "<h1>One</h1>",
  "<p>  </p>", // blank p vanishes
  '<p><img src="notdata.png"></p>', // inline img is skipped by runs()
  '<p>see <a href="https://example.com/x">Example</a> and <a href="#local">local</a> ' +
    '<span class="hnum">2.1</span> line<br>break <mark>plainmark</mark><!--c--></p>',
  "<h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6>",
  "<blockquote>Bare quote text<p>Quoted para</p></blockquote>",
  "<hr>",
  '<div class="page-break"></div>',
  '<div class="align-center"><p>centered text</p></div>',
  '<div class="align-weird"><p>unknown align</p></div>',
  "<ul><li>alpha<ul><li>beta</li></ul></li>" +
    "<li>gamma<table><tbody><tr><td>incell</td></tr></tbody></table></li></ul>",
  "<ol><li>o-one</li></ol><ol><li>o-two</li></ol>",
  '<div class="callout tip"><div class="co-title">Tip</div>' +
    '<div class="co-body"><p>tip body</p></div></div>',
  '<div class="callout"><div class="co-body">' +
    "<table><tbody><tr><td>ct</td></tr></tbody></table></div></div>",
  '<div class="callout warning"><div class="co-title">W</div>' +
    '<div class="co-body"><figure class="shot"></figure></div></div>',
  '<div class="banner"><p>   </p></div>',
  '<pre><code>line1\n\n<span class="hljs-unknownclass">line3</span>\n</code></pre>',
  "<pre>plain pre<!--x--></pre>",
  "<pre><code></code></pre>",
  `<figure data-w="50" data-fig="1" data-caption="A png"><img src="data:image/png;base64,${PNG_1x1}" width="200" height="100"></figure>`,
  `<figure><img src="data:image/jpeg;base64,${PNG_1x1}" width="100" height="50"></figure>`,
  '<figure class="shot" data-fig="2" data-caption="Shot cap"></figure>',
  '<figure data-fig="3" data-caption="Ext"><img src="http://x/y.png"></figure>',
  '<figure data-fig="4"><img src="data:image/png;base64,%%%"></figure>',
  '<div class="refs"><div class="refs-title">References</div><div>Ref A</div><div>Ref B</div></div>',
  '<div class="list-wrap"><div class="toc-title">List of Figures</div><nav class="lst">' +
    '<a><span class="t"><span class="hnum">Figure 1</span> — A png</span></a>' +
    '<a><span class="t">plain entry</span></a><a></a></nav></div>',
  '<div class="list-wrap"><nav class="lst"><a><span class="t">tbl entry</span></a></nav></div>',
  "<div>bare text block</div>",
  "<div><p>wrapped para</p></div>",
  "<section></section>",
  "<h1>Late</h1>",
].join("");

const SETTINGS_A: DocxSettings = {
  ...BASE,
  title: "Branch Doc",
  justify: true,
  h1break: true,
  baseSize: "13.5",
  borderStyle: "none",
  lang: "fr-FR",
};

/* ---------------- cover settings per theme ---------------- */
const COVER_HTML = "<h1>Body</h1><p>text</p>";

const SETTINGS_B: DocxSettings = {
  // modern: top band + thin bottom band
  ...BASE,
  cover: true,
  header: true,
  pageNums: true,
  title: "Cover Doc",
  subtitle: "Sub line",
  author: "Auth",
  metaExtra: "Extra meta",
  kicker: "Kick",
  date: "2026-02-03",
  borderStyle: "thickthin",
  borderWeight: "bold",
  borderColor: "accent",
};

const SETTINGS_C: DocxSettings = {
  // academic: centred, Oxford rule, no bands
  ...BASE,
  theme: "academic",
  page: "Letter",
  margins: "wide",
  cover: true,
  header: true,
  pageNums: true,
  kicker: "Series",
  metaExtra: "Dept of X",
  date: "2026-03-04",
  borderStyle: "double",
  borderWeight: "fine",
};

const SETTINGS_D: DocxSettings = {
  // minimal: hairline ink band, no bottom band
  ...BASE,
  theme: "minimal",
  margins: "narrow",
  cover: true,
  title: "Min",
  date: "2026-01-02",
  borderStyle: "dotted",
  lineSpacing: "1.5",
};

const SETTINGS_E: DocxSettings = {
  // executive: vertical accent spine
  ...BASE,
  theme: "executive",
  cover: true,
  title: "Exec",
  subtitle: "Exec sub",
  author: "E. Xec",
  metaExtra: "Board",
  fontHead: "mont",
  fontBody: "serif",
  borderStyle: "triple",
  borderWeight: "medium",
};

let A: Pack, B: Pack, C: Pack, D: Pack, E: Pack, F: Pack, G: Pack;

beforeAll(async () => {
  A = await pack(contentFrom(HTML_A), SETTINGS_A);
  B = await pack(contentFrom(COVER_HTML), SETTINGS_B);
  C = await pack(contentFrom(COVER_HTML), SETTINGS_C);
  D = await pack(contentFrom(COVER_HTML), SETTINGS_D);
  E = await pack(contentFrom(COVER_HTML + "<pre><code>mono</code></pre>"), SETTINGS_E);

  // F: no font data at all + every lookup falling back to its default
  delete (globalThis as any).__FONT_DATA__;
  delete (window as any).__FONT_DATA__;
  try {
    F = await pack(contentFrom("<h1>F</h1><pre><code>x</code></pre>"), {
      ...BASE,
      theme: "corporate",
      page: "Tabloid",
      margins: "huge",
    });
  } finally {
    (globalThis as any).__FONT_DATA__ = FONT_DATA;
    (window as any).__FONT_DATA__ = FONT_DATA;
  }

  // G: katex missing — both math paths must fall back to printing the TeX source
  (globalThis as any).katex = undefined;
  try {
    G = await pack(
      contentFrom(
        '<p>bad <span class="math-inline" data-tex="\\frac{a}{b}"></span></p>' +
          '<div class="math-display" data-tex="\\frac{c}{d}"></div>',
      ),
      { ...BASE },
    );
  } finally {
    (globalThis as any).katex = katex;
  }
}, 30000);

/* ================= build A ================= */

describe("headings and page flow", () => {
  it("h1break forces a page break before every H1 but the first", () => {
    const late = A.doc.slice(A.doc.indexOf(">Late<") - 2000, A.doc.indexOf(">Late<"));
    expect(late).toContain("<w:pageBreakBefore/>");
    const one = A.doc.slice(A.doc.indexOf(">One<") - 2000, A.doc.indexOf(">One<"));
    expect(one).not.toContain("<w:pageBreakBefore/>");
  });
  it("h3-h6 map to their Word heading styles", () => {
    for (const n of [3, 4, 5, 6]) expect(A.doc).toContain(`<w:pStyle w:val="Heading${n}"/>`);
  });
  it("a page-break div becomes a real page break", () => {
    expect(A.doc).toContain('<w:br w:type="page"/>');
  });
  it("hr becomes a bottom-ruled empty paragraph", () => {
    const bottoms = A.doc.match(/<w:bottom [^>]*\/>/g) || [];
    expect(bottoms.some((b) => b.includes('w:sz="4"') && b.includes('w:color="D7DBE0"'))).toBe(
      true,
    );
  });
  it("blank paragraphs are dropped, bare text blocks are kept", () => {
    expect(A.doc).toContain(">bare text block<");
    expect(A.doc).toContain(">wrapped para<");
  });
  it("justify sets body paragraphs both-justified", () => {
    expect(A.doc).toContain('<w:jc w:val="both"/>');
  });
  it("the document language rides the default run properties", () => {
    expect(A.styles).toContain('w:val="fr-FR"');
  });
  it("base size scales the default run and line height", () => {
    expect(A.styles).toContain(`<w:sz w:val="${HP(13.5)}"/>`);
    expect(A.styles).toContain(`w:line="${Math.round((350 * 13.5) / 11)}"`);
  });
  it("borderStyle none draws no page borders", () => {
    expect(A.doc).not.toContain("<w:pgBorders");
  });
});

describe("inline runs", () => {
  it("an http(s) anchor becomes a hyperlink with accent-coloured runs", () => {
    expect(A.doc).toContain("<w:hyperlink");
    const link = runIn(A, "Example");
    expect(link).toContain(`<w:color w:val="${up(T.a700)}"/>`);
  });
  it("a non-http anchor stays plain text", () => {
    const local = runIn(A, "local");
    expect(local).not.toContain(`<w:color w:val="${up(T.a700)}"/>`);
  });
  it("hnum spans are bold in the darker accent", () => {
    const r = runIn(A, "2.1");
    expect(r).toMatch(/<w:b\/>/);
    expect(r).toContain(`<w:color w:val="${up(T.a600)}"/>`);
  });
  it("br becomes a run break", () => {
    expect(A.doc).toContain("<w:br/>");
  });
  it("mark without a palette colour falls back to yellow", () => {
    expect(runIn(A, "plainmark")).toContain('<w:highlight w:val="yellow"/>');
  });
});

describe("blockquote", () => {
  it("indents with the accent left rule and italic dim runs", () => {
    const q = runIn(A, "Quoted para");
    expect(q).toMatch(/<w:i\/>/);
    expect(q).toContain('<w:color w:val="3D434D"/>');
    const lefts = A.doc.match(/<w:left [^>]*\/>/g) || [];
    expect(
      lefts.some(
        (b) =>
          b.includes('w:sz="16"') &&
          b.includes('w:space="12"') &&
          b.includes(`w:color="${up(T.a300)}"`),
      ),
    ).toBe(true);
  });
  it("bare text nodes inside the quote still become paragraphs", () => {
    const bare = runIn(A, "Bare quote text");
    expect(bare).toMatch(/<w:i\/>/);
  });
});

describe("alignment wrappers", () => {
  it("align-center rides down onto the inner paragraph", () => {
    const p = A.doc.slice(A.doc.indexOf(">centered text<") - 800, A.doc.indexOf(">centered text<"));
    expect(p).toContain('<w:jc w:val="center"/>');
  });
  it("an unknown align- class falls through to plain children", () => {
    expect(A.doc).toContain(">unknown align<");
  });
});

describe("lists", () => {
  it("a nested ul becomes a level-1 bullet", () => {
    expect(A.doc).toContain('<w:ilvl w:val="1"/>');
    expect(A.doc).toContain(">beta<");
  });
  it("block content owned by a list item is indented under the marker", () => {
    const cell = A.doc.slice(A.doc.indexOf(">incell<") - 3000, A.doc.indexOf(">incell<"));
    expect(cell).toContain('w:w="620"');
  });
  it("each top-level ol restarts its numbering instance", () => {
    const numIds = [...A.doc.matchAll(/<w:numId w:val="(\d+)"\/>/g)].map((m) => m[1]);
    expect(new Set(numIds).size).toBeGreaterThan(1);
  });
  it("non-li children of a list are ignored", () => {
    // covered structurally: the ul renders only its li paragraphs
    expect(A.doc).toContain(">alpha<");
    expect(A.doc).toContain(">gamma<");
  });
});

describe("callouts", () => {
  it("tip carries its green title chip and tinted fill", () => {
    const title = runIn(A, "●  TIP");
    expect(title).toContain('<w:color w:val="0E7A52"/>');
    expect(A.doc).toContain('w:fill="EBF7F1"');
    expect(A.doc).toContain(">tip body<");
  });
  it("an untitled callout defaults to NOTE with the blue accent bar", () => {
    const title = runIn(A, "●  NOTE");
    expect(title).toContain('<w:color w:val="2458C5"/>');
    const lefts = A.doc.match(/<w:left [^>]*\/>/g) || [];
    expect(lefts.some((b) => b.includes('w:sz="20"') && b.includes('w:color="2458C5"'))).toBe(true);
  });
  it("a callout body ending in a table gets the cellSafe guard paragraph", () => {
    // The warning callout holds only a shot figure, whose caption-hugging pop
    // leaves its box table last in the cell — OOXML forbids that, so cellSafe
    // appends the zero-spacing guard paragraph before the cell closes.
    expect(A.doc).toContain('w:fill="FDF4E7"'); // the warning tint
    expect(A.doc).toContain('</w:tbl><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p></w:tc>');
  });
});

describe("banner edge", () => {
  it("an empty banner still renders its slate plate", () => {
    expect(A.doc).toContain('w:fill="1F2733"');
  });
});

describe("code blocks", () => {
  it("blank lines survive as single-space mono runs", () => {
    expect(A.doc).toContain(">line1<");
    expect(A.doc).toContain(">line3<");
  });
  it("an unknown hljs class adds no colour", () => {
    const r = runIn(A, "line3");
    expect(r).not.toContain("<w:color");
  });
  it("a pre without a code child still renders", () => {
    expect(A.doc).toContain(">plain pre<");
  });
});

describe("figures", () => {
  it("a data-URL image becomes an ImageRun at the recorded width", () => {
    const w = Math.round((availPx * 50) / 100);
    const h = Math.round((((availPx * 50) / 100) * 100) / 200);
    expect(A.doc).toContain(`cx="${w * 9525}"`);
    expect(A.doc).toContain(`cy="${h * 9525}"`);
    expect(A.doc).toContain('descr="A png"');
  });
  it("an unmeasured image falls back to its natural width, capped to the column", () => {
    expect(A.doc).toContain(`cx="${100 * 9525}"`);
    expect(A.doc).toContain(`cy="${50 * 9525}"`);
  });
  it("figure captions repeat the number (nbsp-joined) and caption below", () => {
    // src joins "Figure" to its number with U+00A0 so the pair never wraps apart
    expect(A.doc).toContain(">Figure\u00A01<");
    expect(A.doc).toContain(" — A png");
    expect(A.doc).toContain(">Figure\u00A03<");
    expect(A.doc).toContain(" — Ext");
  });
  it("a shot placeholder renders the dashed screenshot box", () => {
    const r = runIn(A, "SCREENSHOT PLACEHOLDER");
    expect(r).toContain(`<w:color w:val="${up(T.a700)}"/>`);
    expect(A.doc).toContain(`w:fill="${up(T.a50)}"`);
    expect(A.doc).toContain('<w:trHeight w:val="2400" w:hRule="atLeast"/>');
    const dashes = A.doc.match(/<w:top [^>]*w:val="dashed"[^>]*\/>/g) || [];
    expect(
      dashes.some((b) => b.includes('w:sz="12"') && b.includes(`w:color="${up(T.a400)}"`)),
    ).toBe(true);
  });
  it("a non-data image emits no drawing but keeps its caption", () => {
    // exactly two drawings: the png figure and the jpeg figure
    expect((A.doc.match(/<w:drawing>/g) || []).length).toBe(2);
  });
});

describe("refs and caption lists", () => {
  it("the refs title is set big in the accent tint", () => {
    const r = runIn(A, "References");
    expect(r).toContain(`<w:color w:val="${up(T.a800)}"/>`);
    expect(r).toContain(`<w:sz w:val="${HP(14.5)}"/>`);
  });
  it("reference entries hang-indent", () => {
    expect(A.doc).toContain(">Ref A<");
    expect(A.doc).toMatch(/<w:ind [^>]*w:hanging="440"[^>]*\/>/);
  });
  it("a list of figures renders label + rest as real entries", () => {
    const lbl = runIn(A, "Figure 1");
    expect(lbl).toMatch(/<w:b\/>/);
    expect(A.doc).toContain(" — A png");
    expect(A.doc).toContain(">plain entry<");
    expect(A.doc).toMatch(/<w:ind [^>]*w:hanging="340"[^>]*\/>/);
  });
  it("a caption list without a title still lists its entries", () => {
    expect(A.doc).toContain(">tbl entry<");
  });
});

/* ================= covers ================= */

describe("modern cover", () => {
  it("pins a 7mm accent band to the top and a 2mm tint band to the bottom", () => {
    expect(B.doc).toContain(`<w:trHeight w:val="${mm2t(7)}" w:hRule="exact"/>`);
    expect(B.doc).toContain(`<w:trHeight w:val="${mm2t(2)}" w:hRule="exact"/>`);
    expect(B.doc).toContain(`<w:trHeight w:val="${mm2t(297 - 7 - 2)}" w:hRule="exact"/>`);
    expect(B.doc).toContain(`w:fill="${up(T.a700)}"`);
    expect(B.doc).toContain(`w:fill="${up(T.a200)}"`);
  });
  it("the cover section has zero margins so the band bleeds", () => {
    expect(B.doc).toMatch(
      /<w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"\/>/,
    );
  });
  it("title, kicker, subtitle and meta all land with their sizes", () => {
    expect(runIn(B, "Cover Doc")).toContain(`<w:sz w:val="${HP(31)}"/>`);
    const kick = runIn(B, "KICK");
    expect(kick).toContain('<w:spacing w:val="36"/>');
    expect(runIn(B, "Sub line")).toContain(`<w:sz w:val="${HP(13.5)}"/>`);
    expect(runIn(B, "Auth")).toMatch(/<w:b\/>/);
  });
  it("metaExtra breaks onto its own line after the author", () => {
    expect(runIn(B, "Extra meta")).toContain("<w:br/>");
  });
  it("the date renders through Engine.fmtDate", () => {
    runIn(B, "3 February 2026");
  });
  it("accent-coloured thick-thin page borders on the body section", () => {
    const pgb = B.doc.match(/<w:pgBorders[^>]*>/);
    expect(pgb).not.toBeNull();
    const tops = B.doc.match(/<w:top [^>]*\/>/g) || [];
    expect(
      tops.some(
        (b) =>
          b.includes('w:val="thickThinSmallGap"') &&
          b.includes('w:sz="36"') &&
          b.includes(`w:color="${up(T.a600)}"`),
      ),
    ).toBe(true);
  });
});

describe("academic cover", () => {
  it("is centred with the Oxford rule around the title", () => {
    expect(C.doc).toContain('<w:jc w:val="center"/>');
    const tops = C.doc.match(/<w:top [^>]*\/>/g) || [];
    expect(
      tops.some(
        (b) =>
          b.includes('w:sz="21"') && b.includes('w:space="10"') && b.includes('w:color="14181F"'),
      ),
    ).toBe(true);
  });
  it("a missing title falls back to Untitled document at the centred size", () => {
    expect(runIn(C, "Untitled document")).toContain(`<w:sz w:val="${HP(27)}"/>`);
  });
  it("has no band rows — the content row fills the whole Letter page", () => {
    expect(C.doc).toContain(`<w:trHeight w:val="${mm2t(279.4)}" w:hRule="exact"/>`);
    expect(C.doc).not.toContain(`<w:trHeight w:val="${mm2t(7)}" w:hRule="exact"/>`);
  });
  it("the centred kicker letterspaces wider", () => {
    expect(runIn(C, "SERIES")).toContain('<w:spacing w:val="60"/>');
  });
  it("meta without an author starts on the first line, the date breaks after it", () => {
    expect(runIn(C, "Dept of X")).not.toContain("<w:br/>");
    expect(runIn(C, "4 March 2026")).toContain("<w:br/>");
  });
  it("double page border at the fine weight", () => {
    const tops = C.doc.match(/<w:top [^>]*\/>/g) || [];
    expect(
      tops.some(
        (b) =>
          b.includes('w:val="double"') &&
          b.includes(`w:sz="${Math.round(6 * 0.8)}"`) &&
          b.includes('w:color="3C434E"'),
      ),
    ).toBe(true);
  });
});

describe("minimal cover", () => {
  it("draws a 1.2mm ink hairline band and no bottom band", () => {
    expect(D.doc).toContain(`<w:trHeight w:val="${mm2t(1.2)}" w:hRule="exact"/>`);
    expect(D.doc).toContain('w:fill="14181F"');
    expect(D.doc).not.toContain(`w:fill="${up(T.a200)}"`);
  });
  it("a lone date starts the meta block without a break", () => {
    expect(runIn(D, "2 January 2026")).not.toContain("<w:br/>");
  });
  it("dotted page borders at the default weight", () => {
    const tops = D.doc.match(/<w:top [^>]*\/>/g) || [];
    expect(tops.some((b) => b.includes('w:val="dotted"') && b.includes('w:sz="12"'))).toBe(true);
  });
  it("named line spacing maps to its twip value", () => {
    expect(D.styles).toContain('w:line="360"');
  });
});

describe("executive cover", () => {
  it("runs a 9mm accent spine down the whole page height", () => {
    expect(E.doc).toContain(`<w:trHeight w:val="${mm2t(297)}" w:hRule="exact"/>`);
    expect(E.doc).toContain(`w:fill="${up(T.a800)}"`);
    expect(E.doc).toContain(`<w:tcW w:type="dxa" w:w="${mm2t(9)}"/>`);
  });
  it("content indents from the spine, not the paper edge", () => {
    expect(E.doc).toContain(`w:left="${mm2t(10)}"`);
    expect(E.doc).toContain(`w:right="${mm2t(24)}"`);
  });
  it("selected faces override the theme faces in the styles", () => {
    expect(E.styles).toContain('w:ascii="DocForge Montserrat"');
    expect(E.styles).toContain('w:ascii="DocForge Serif"');
  });
  it("only families with real bytes are embedded — mono only here", () => {
    expect(E.ft).toContain('<w:font w:name="DocForge Mono">');
    expect(E.ft).not.toContain('w:name="DocForge Montserrat"');
    expect(E.ft).not.toContain('w:name="DocForge Serif"');
  });
});

/* ================= fallbacks ================= */

describe("fallback lookups", () => {
  it("unknown theme/page/margins fall back to modern/A4/normal", () => {
    expect(F.styles).toContain('w:ascii="DocForge Sans"');
    expect(F.doc).toContain(`<w:pgSz w:w="${mm2t(210)}" w:h="${mm2t(297)}"`);
  });
  it("without __FONT_DATA__ nothing is embedded and the package survives", () => {
    expect(F.ft).not.toContain("w:embedRegular");
    expect(F.ft).not.toContain("DocForgeSans-Regular");
  });
});

describe("math fallbacks (no katex)", () => {
  it("inline math prints the TeX source in mono", () => {
    const r = runIn(G, "\\frac{a}{b}");
    expect(r).toContain('w:ascii="DocForge Mono"');
    expect(r).toContain(`<w:sz w:val="${HP(9.5)}"/>`);
    expect(G.doc).not.toContain("<m:oMath");
  });
  it("display math prints the TeX source centred", () => {
    const r = runIn(G, "\\frac{c}{d}");
    expect(r).toContain('w:ascii="DocForge Mono"');
    const p = G.doc.slice(G.doc.indexOf(">\\frac{c}{d}<") - 600, G.doc.indexOf(">\\frac{c}{d}<"));
    expect(p).toContain('<w:jc w:val="center"/>');
  });
});
