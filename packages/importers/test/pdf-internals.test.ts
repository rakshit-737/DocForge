/* Node-environment tests for pdf-import's PURE helpers, reached through the
   additive _internals export — nothing was extracted or changed to test this.
   The pdf.js-dependent flow (toMarkdown / ensureLib) is integration-proved by
   qa/import-smoke.mjs + qa/convert-smoke.mjs at rewire time. */
import { describe, it, expect } from "vitest";
import { _internals, type Line, type PageRec } from "../src/pdf-import.js";

const L = (text: string, x: number, y: number, size = 10, o: Partial<Line> = {}): Line =>
  ({ text, x, y, size, bold: false, split: false, ...o });

const item = (str: string, x: number, y: number, size = 12, extra: Partial<PdfjsTextItem> = {}): PdfjsTextItem =>
  ({ str, transform: [size, 0, 0, size, x, y], width: 30, fontName: "f1", ...extra });

describe("joinWrapped", () => {
  it.each([
    ["exam-", "ple", "example"],
    ["exam-", "Ple", "exam- Ple"],
    ["alpha", "beta", "alpha beta"],
    ["end-", "1thing", "end- 1thing"],
  ])("%s + %s -> %s", (a, b, expected) => {
    expect(_internals.joinWrapped(a, b)).toBe(expected);
  });
});

describe("headingLevel", () => {
  const body = 10;
  it.each([
    ["1.6x body", L("Title", 50, 700, 16), 1],
    ["1.3x body", L("Section", 50, 700, 13), 2],
    ["1.15x body", L("Sub", 50, 700, 11.5), 3],
    ["1.1x body is prose", L("NotHeading", 50, 700, 11), 0],
    ["long lines are prose", L("x".repeat(90), 50, 700, 16), 0],
    ["terminal period is prose", L("Ends.", 50, 700, 16), 0],
  ])("%s", (_name, ln, expected) => {
    expect(_internals.headingLevel(ln, body)).toBe(expected);
  });
});

describe("boldHeading", () => {
  const body = 10;
  it("accepts a short bold body-sized label", () => {
    expect(_internals.boldHeading(L("Methods", 50, 700, 10, { bold: true }), body)).toBe(true);
  });
  it.each([
    ["not bold", L("Methods", 50, 700, 10)],
    ["terminal period", L("Methods.", 50, 700, 10, { bold: true })],
    ["too large (real heading territory)", L("Methods", 50, 700, 11.5, { bold: true })],
    ["too small", L("Methods", 50, 700, 9, { bold: true })],
    ["too long", L("m".repeat(60), 50, 700, 10, { bold: true })],
  ])("rejects: %s", (_name, ln) => {
    expect(_internals.boldHeading(ln, body)).toBe(false);
  });
});

describe("escProse", () => {
  it.each([
    ["a|b", "a\\|b"],
    ["# not a heading", "\\# not a heading"],
    [">not a quote", "\\>not a quote"],
    ["a > b stays", "a > b stays"],
  ])("%s -> %s", (input, expected) => {
    expect(_internals.escProse(input)).toBe(expected);
  });
});

describe("emitList (bullet-indent recovery output)", () => {
  it("flat bullets", () => {
    expect(_internals.emitList([
      { t: "li", ordered: false, x: 100, text: "one" },
      { t: "li", ordered: false, x: 100, text: "two" },
    ])).toBe("- one\n- two");
  });
  it("indent >= 18pt nests one level", () => {
    expect(_internals.emitList([
      { t: "li", ordered: false, x: 100, text: "one" },
      { t: "li", ordered: false, x: 120, text: "sub" },
      { t: "li", ordered: false, x: 117, text: "not deep enough" },
    ])).toBe("- one\n  - sub\n- not deep enough");
  });
  it("ordered lists count, nested counters reset per group", () => {
    expect(_internals.emitList([
      { t: "li", ordered: true, x: 100, text: "a" },
      { t: "li", ordered: true, x: 120, text: "s1" },
      { t: "li", ordered: true, x: 120, text: "s2" },
      { t: "li", ordered: true, x: 100, text: "b" },
    ])).toBe("1. a\n  1. s1\n  2. s2\n2. b");
  });
  it("mixed markers keep separate counters", () => {
    expect(_internals.emitList([
      { t: "li", ordered: false, x: 100, text: "one" },
      { t: "li", ordered: true, x: 100, text: "first" },
    ])).toBe("- one\n1. first");
  });
  it("escapes prose inside items", () => {
    expect(_internals.emitList([{ t: "li", ordered: false, x: 100, text: "a|b" }]))
      .toBe("- a\\|b");
  });
});

describe("marker regexes", () => {
  it.each(["• x", "◦ x", "– x", "— x", "* x", "- x"])("BULLET_RE matches %s", (s) => {
    expect(_internals.BULLET_RE.test(s)).toBe(true);
  });
  it.each(["1. x", "12) x", "(a) x", "iv. x", "(IV) x"])("NUM_RE matches %s", (s) => {
    expect(_internals.NUM_RE.test(s)).toBe(true);
  });
  it.each(["3", "Page 4", "12 of 30", " 7 / 9 "])("PAGENUM_RE matches %s", (s) => {
    expect(_internals.PAGENUM_RE.test(s)).toBe(true);
  });
  it("PAGENUM_RE leaves prose alone", () => {
    expect(_internals.PAGENUM_RE.test("Chapter 4")).toBe(false);
  });
});

describe("buildLines (line grouping)", () => {
  it("inserts a space across a word gap and merges a baseline", () => {
    const lines = _internals.buildLines(
      { items: [item("Hello", 50, 700), item("world", 84, 700)], styles: {} }, 612, new Map());
    expect(lines).toEqual([
      { text: "Hello world", x: 50, y: 700, size: 12, bold: false, split: false },
    ]);
  });

  it("joins tightly-kerned runs without a space", () => {
    const lines = _internals.buildLines(
      { items: [item("Hel", 50, 700), item("lo", 82, 700)], styles: {} }, 612, new Map());
    expect(lines[0]!.text).toBe("Hello");
  });

  it("splits a baseline at a huge x-gap and flags the pieces", () => {
    const lines = _internals.buildLines(
      { items: [item("left", 50, 700), item("right", 400, 700)], styles: {} }, 612, new Map());
    expect(lines.map(l => [l.text, l.split])).toEqual([["left", true], ["right", true]]);
  });

  it("separates distinct baselines top-down", () => {
    const lines = _internals.buildLines(
      { items: [item("lower", 50, 690), item("upper", 50, 700)], styles: {} }, 612, new Map());
    expect(lines.map(l => l.text)).toEqual(["upper", "lower"]);
  });

  it("clusters near-identical baselines (within ~a third of the size)", () => {
    const lines = _internals.buildLines(
      { items: [item("a", 50, 700), item("b", 84, 697)], styles: {} }, 612, new Map());
    expect(lines).toHaveLength(1);
  });

  it("detects bold through the boldMap's real font name", () => {
    const boldMap = new Map([["g7", "ABCDEF+Calibri-Bold"]]);
    const lines = _internals.buildLines(
      { items: [item("Bold", 50, 700, 12, { fontName: "g7" })], styles: {} }, 612, boldMap);
    expect(lines[0]!.bold).toBe(true);
  });

  it("falls back to the styles map, which rarely says bold", () => {
    const lines = _internals.buildLines(
      { items: [item("Plain", 50, 700, 12, { fontName: "g8" })], styles: { g8: { fontFamily: "sans-serif" } } },
      612, new Map());
    expect(lines[0]!.bold).toBe(false);
  });

  it("skips whitespace-only runs", () => {
    const lines = _internals.buildLines(
      { items: [item("   ", 50, 700)], styles: {} }, 612, new Map());
    expect(lines).toEqual([]);
  });

  it("derives size rotation-proof from the transform", () => {
    const lines = _internals.buildLines(
      { items: [{ str: "rotated", transform: [0, 12, -12, 0, 50, 700], width: 30, fontName: "f1" }], styles: {} },
      612, new Map());
    expect(lines[0]!.size).toBe(12);
  });
});

describe("bodySize", () => {
  it("is the text-length-weighted mode of sizes", () => {
    const pages: PageRec[] = [{
      n: 1, width: 612, height: 792,
      lines: [L("x".repeat(50), 50, 700, 10), L("Big Heading", 50, 680, 18)],
    }];
    expect(_internals.bodySize(pages)).toBe(10);
  });
  it("defaults to 12 with no lines", () => {
    expect(_internals.bodySize([{ n: 1, width: 612, height: 792, lines: [] }])).toBe(12);
  });
});

describe("stripFurniture", () => {
  const page = (n: number): PageRec => ({
    n, width: 612, height: 792,
    lines: [
      L(`Acme Corp ${2020 + n}`, 50, 780),
      L(`Body content ${n}`, 50, 400),
      L(String(n), 300, 20),
    ],
  });

  it("drops repeating headers and bare page numbers on a 4-page doc", () => {
    const pages = [page(1), page(2), page(3), page(4)];
    expect(_internals.stripFurniture(pages)).toBe(true);
    for (const p of pages) {
      expect(p.lines.map(l => l.text)).toEqual([`Body content ${p.n}`]);
    }
  });

  it("keeps a repeating header on a 2-page doc (need >= 3 repeats — preserved quirk)", () => {
    const pages = [page(1), page(2)];
    expect(_internals.stripFurniture(pages)).toBe(true); // page numbers still go
    for (const p of pages) {
      expect(p.lines.map(l => l.text)).toEqual([`Acme Corp ${2020 + p.n}`, `Body content ${p.n}`]);
    }
  });

  it("returns false when nothing was removed", () => {
    const pages: PageRec[] = [{ n: 1, width: 612, height: 792, lines: [L("Just prose", 50, 400)] }];
    expect(_internals.stripFurniture(pages)).toBe(false);
  });
});

describe("splitColumns", () => {
  it("reads a two-column page left column first, then right", () => {
    const left = [L("l1", 40, 700), L("l2", 40, 680), L("l3", 40, 660), L("l4", 40, 640)];
    const right = [L("r1", 320, 700), L("r2", 320, 680), L("r3", 320, 660), L("r4", 320, 640)];
    const p: PageRec = { n: 1, width: 600, height: 792, lines: [...left, ...right] };
    const res = _internals.splitColumns(p);
    expect(res.multi).toBe(true);
    expect(res.groups.map(g => g.map(l => l.text))).toEqual([
      ["l1", "l2", "l3", "l4"], ["r1", "r2", "r3", "r4"],
    ]);
  });

  it("leaves single-column pages alone", () => {
    const p: PageRec = {
      n: 1, width: 600, height: 792,
      lines: [L("a", 40, 700), L("b", 40, 680), L("c", 40, 660), L("d", 40, 640), L("e", 40, 620), L("f", 40, 600)],
    };
    expect(_internals.splitColumns(p).multi).toBe(false);
  });

  it("never splits short pages (< 6 lines)", () => {
    const p: PageRec = { n: 1, width: 600, height: 792, lines: [L("a", 40, 700), L("b", 320, 700)] };
    const res = _internals.splitColumns(p);
    expect(res.multi).toBe(false);
    expect(res.groups).toHaveLength(1);
  });
});

describe("groupBlocks", () => {
  const body = 10;

  it("recovers markerless bullets by indent shape (Chromium prints no ::marker glyphs)", () => {
    const lines = [
      L("Intro paragraph", 50, 700),
      L("item one", 62, 685),
      L("item two", 62, 670),
      L("After", 50, 655),
    ];
    expect(_internals.groupBlocks(lines, body)).toEqual([
      { t: "p", text: "Intro paragraph" },
      { t: "li", ordered: false, x: 62, text: "item one" },
      { t: "li", ordered: false, x: 62, text: "item two" },
      { t: "p", text: "After" },
    ]);
  });

  it("strips explicit bullet and number markers", () => {
    const lines = [
      L("• first point", 50, 700),
      L("• second point", 50, 685),
      L("1. alpha", 50, 670),
      L("2. beta", 50, 655),
    ];
    expect(_internals.groupBlocks(lines, body)).toEqual([
      { t: "li", ordered: false, x: 50, text: "first point" },
      { t: "li", ordered: false, x: 50, text: "second point" },
      { t: "li", ordered: true, x: 50, text: "alpha" },
      { t: "li", ordered: true, x: 50, text: "beta" },
    ]);
  });

  it("merges a two-line heading into one", () => {
    const lines = [
      L("Annual Report", 50, 700, 16),
      L("of the Society", 50, 680, 16),
      L("Body text here", 50, 664),
    ];
    expect(_internals.groupBlocks(lines, body)).toEqual([
      { t: "h", level: 1, text: "Annual Report of the Society" },
      { t: "p", text: "Body text here" },
    ]);
  });

  it("joins wrapped paragraph lines with de-hyphenation", () => {
    const lines = [
      L("This sentence is exam-", 50, 700),
      L("ple of wrapping", 50, 685),
      L("and continues", 50, 670),
    ];
    expect(_internals.groupBlocks(lines, body)).toEqual([
      { t: "p", text: "This sentence is example of wrapping and continues" },
    ]);
  });

  it("promotes an isolated bold label to a minor heading", () => {
    const lines = [
      L("One two.", 50, 700),
      L("Three four.", 50, 685),
      L("Methods", 50, 645, 10, { bold: true }),
      L("Below text", 50, 630),
    ];
    expect(_internals.groupBlocks(lines, body)).toEqual([
      { t: "p", text: "One two. Three four." },
      { t: "h", level: 3, text: "Methods" },
      { t: "p", text: "Below text" },
    ]);
  });

  it("appends a wrapped tail to the list item above", () => {
    const lines = [
      L("• a bullet that", 50, 700),
      L("wraps onward", 58, 685),
    ];
    expect(_internals.groupBlocks(lines, body)).toEqual([
      { t: "li", ordered: false, x: 50, text: "a bullet that wraps onward" },
    ]);
  });

  it("returns nothing for no lines", () => {
    expect(_internals.groupBlocks([], body)).toEqual([]);
  });
});

describe("pageNames", () => {
  it("singular and plural", () => {
    expect(_internals.pageNames([3])).toBe("page 3");
    expect(_internals.pageNames([2, 5])).toBe("pages 2, 5");
  });
});
