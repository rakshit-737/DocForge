/* texToOmml drives the real KaTeX (npm package, same version the app vendors),
   assigned onto globalThis exactly the way the single-file build exposes it.
   Node environment — KaTeX's mathml output path needs no DOM. */
import katex from "katex";
import { beforeAll, describe, expect, it } from "vitest";
import { NS, oMathPara, texToOmml } from "../src/index.js";

const U = (...cp: number[]): string => String.fromCharCode(...cp);
const APPLY = U(0x2061);
const JOIN = U(0x2060);
const EM = U(0x2003);

beforeAll(() => {
  globalThis.katex = katex as unknown as KatexLib;
});

describe("texToOmml — KaTeX edge cases", () => {
  const cases: [name: string, tex: string, subs: string[]][] = [
    ["fraction", "\\frac{a}{b}", ["<m:f><m:num>", "<m:den>"]],
    [
      "\\sin x becomes <m:func> with an upright name",
      "\\sin x",
      ["<m:func><m:fName>", '<m:sty m:val="p"/>', "<m:t>sin</m:t>"],
    ],
    [
      "\\sum inline: movable limits sit subSup",
      "\\sum_{i=1}^{n} i",
      ['<m:chr m:val="∑"/>', '<m:limLoc m:val="subSup"/>', "<m:nary>"],
    ],
    [
      "\\int with bounds is a subSup n-ary",
      "\\int_0^1 f",
      ['<m:chr m:val="∫"/>', '<m:limLoc m:val="subSup"/>'],
    ],
    ["mixed scripts", "x_i^2", ["<m:sSubSup>"]],
    [
      "\\hat maps to the combining circumflex",
      "\\hat{x}",
      ['<m:acc><m:accPr><m:chr m:val="' + U(0x302) + '"/></m:accPr>'],
    ],
    ["\\overline is a top bar", "\\overline{AB}", ['<m:bar><m:barPr><m:pos m:val="top"/>', "<m:t>AB</m:t>"]],
    [
      "\\vec is the combining right arrow accent",
      "\\vec{v}",
      ['<m:chr m:val="' + U(0x20d7) + '"/>'],
    ],
    [
      "\\left(…\\right) pairs into one delimiter",
      "\\left(\\frac{a}{b}\\right)",
      ['<m:d><m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr>'],
    ],
    [
      "pmatrix: parens around a 2-column centered matrix",
      "\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}",
      ['<m:begChr m:val="("/>', '<m:count m:val="2"/><m:mcJc m:val="center"/>', "<m:mr><m:e>"],
    ],
    [
      "aligned: zero column gap and right/left alignment",
      "\\begin{aligned}a&=b\\\\c&=d\\end{aligned}",
      ['<m:cGpRule m:val="3"/><m:cGp m:val="0"/>', '<m:mcJc m:val="right"/>', '<m:mcJc m:val="left"/>'],
    ],
    [
      "cases: open brace with an empty closer",
      "\\begin{cases}x&x>0\\\\-x&x\\le 0\\end{cases}",
      ['<m:begChr m:val="{"/>', '<m:endChr m:val=""/>'],
    ],
    ["\\sqrt hides the degree", "\\sqrt{2}", ['<m:degHide m:val="1"/>', "<m:deg/>"]],
    ["\\sqrt[3]{x} shows the degree", "\\sqrt[3]{x}", ['<m:degHide m:val="0"/>', "<m:deg><m:r>"]],
    ["\\mathbb{R} is double-struck", "\\mathbb{R}", ['<m:scr m:val="double-struck"/>']],
    [
      "\\underbrace is a bottom groupChr",
      "\\underbrace{x+y}_{2}",
      ['<m:groupChr><m:groupChrPr><m:chr m:val="⏟"/><m:pos m:val="bot"/>'],
    ],
    [
      "\\lim with a movable limit stays a function name",
      "\\lim_{x\\to 0} x",
      ["<m:func><m:fName><m:sSub>", "<m:t>lim</m:t>"],
    ],
    [
      "\\quad survives as an em space kept alive by a word joiner",
      "a \\quad b",
      ['<m:t xml:space="preserve">' + EM + JOIN + "</m:t>"],
    ],
    [
      "\\left. … \\right| : closer with no opener",
      "\\left.\\frac{dy}{dx}\\right|_{x=0}",
      ['<m:begChr m:val=""/><m:endChr m:val="|"/>'],
    ],
    ["\\cancel strikes through", "\\cancel{x}", ['<m:strikeBLTR m:val="1"/>']],
  ];

  it.each(cases)("%s", (_name, tex, subs) => {
    const out = texToOmml(tex, false);
    expect(out).not.toBe(null);
    expect(out).toContain('<m:oMath xmlns:m="' + NS + '">');
    for (const sub of subs) expect(out).toContain(sub);
  });

  it("never leaks the U+2061 apply marker into the output", () => {
    const out = texToOmml("\\sin x", false) as string;
    expect(out).not.toContain(APPLY);
  });

  it("never leaks the TeX annotation into the output", () => {
    const out = texToOmml("\\frac{a}{b}", false) as string;
    expect(out).not.toContain("\\frac");
  });

  it("display mode moves \\sum limits above and below (undOvr)", () => {
    const out = texToOmml("\\sum_{i=1}^n i", true);
    expect(out).toContain("<m:nary>");
    expect(out).toContain('<m:limLoc m:val="undOvr"/>');
  });

  it("is deterministic: the same TeX twice gives byte-identical output", () => {
    const tex = "\\int_0^\\infty e^{-\\lambda t}\\,dt = \\frac{1}{\\lambda}";
    const a = texToOmml(tex, true);
    const b = texToOmml(tex, true);
    expect(a).not.toBe(null);
    expect(a).toBe(b);
  });

  it("wraps into a display paragraph via oMathPara", () => {
    const omml = texToOmml("E=mc^2", true) as string;
    expect(oMathPara(omml)).toBe(
      '<m:oMathPara xmlns:m="' + NS + '"><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr>' +
      omml + "</m:oMathPara>",
    );
  });

  it("returns null for null TeX", () => {
    expect(texToOmml(null)).toBe(null);
    expect(texToOmml(undefined)).toBe(null);
  });

  it("returns null when the katex global is absent", () => {
    const saved = globalThis.katex;
    globalThis.katex = undefined;
    try {
      expect(texToOmml("x")).toBe(null);
    } finally {
      globalThis.katex = saved;
    }
  });
});
