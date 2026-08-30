/* Table-driven MathML → OMML cases, ported from the edge cases the source
   comments enumerate (landmines #1–#3, n-ary operands, fences, accents,
   braces, matrices, prescripts, spaces). Pure string work — no DOM needed.

   Invisible/combining characters are built with U(...) so this file carries
   no bare zero-width code points. */
import { describe, expect, it } from "vitest";
import { api, mmlToOmml, NS, oMathPara, texToOmml } from "../src/index.js";

const U = (...cp: number[]): string => String.fromCharCode(...cp);
const APPLY = U(0x2061); // U+2061 FUNCTION APPLICATION
const JOIN = U(0x2060); // word joiner that keeps whitespace-only runs alive
const EM = U(0x2003); // em space
const EN = U(0x2002); // en space

describe("mmlToOmml — dialect table", () => {
  const cases: [name: string, mml: string, subs: string[]][] = [
    [
      "multi-letter <mi> is upright (landmine #1)",
      "<math><mi>sin</mi></math>",
      ['<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>sin</m:t></m:r>'],
    ],
    [
      "adjacent runs with identical properties merge",
      "<math><mn>1</mn><mo>+</mo><mn>2</mn></math>",
      ["<m:t>1+2</m:t>"],
    ],
    [
      "two italic variables merge into one bare run",
      "<math><mi>x</mi><mi>y</mi></math>",
      ["<m:r><m:t>xy</m:t></m:r>"],
    ],
    [
      "function application U+2061 becomes <m:func>",
      "<math><mi>sin</mi><mo>" + APPLY + "</mo><mi>x</mi></math>",
      [
        "<m:func><m:fName>",
        '<m:sty m:val="p"/>',
        "</m:fName><m:e><m:r><m:t>x</m:t></m:r></m:e></m:func>",
      ],
    ],
    [
      "fraction",
      "<math><mfrac><mi>a</mi><mi>b</mi></mfrac></math>",
      ["<m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:r><m:t>b</m:t></m:r></m:den></m:f>"],
    ],
    [
      "linethickness=0 fraction loses its bar (\\binom)",
      '<math><mfrac linethickness="0"><mi>n</mi><mi>k</mi></mfrac></math>',
      ['<m:fPr><m:type m:val="noBar"/></m:fPr>'],
    ],
    [
      "bevelled fraction is skewed",
      '<math><mfrac bevelled="true"><mi>a</mi><mi>b</mi></mfrac></math>',
      ['<m:type m:val="skw"/>'],
    ],
    [
      "msup",
      "<math><msup><mi>x</mi><mn>2</mn></msup></math>",
      ["<m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup>"],
    ],
    [
      "msub",
      "<math><msub><mi>a</mi><mi>i</mi></msub></math>",
      ["<m:sSub><m:e><m:r><m:t>a</m:t></m:r></m:e><m:sub>"],
    ],
    [
      "msubsup",
      "<math><msubsup><mi>x</mi><mn>1</mn><mn>2</mn></msubsup></math>",
      ["<m:sSubSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sub>", "<m:sup>"],
    ],
    [
      "square root hides its degree",
      "<math><msqrt><mi>x</mi></msqrt></math>",
      ['<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/>'],
    ],
    [
      "mroot shows its degree",
      "<math><mroot><mi>x</mi><mn>3</mn></mroot></math>",
      ['<m:degHide m:val="0"/>', "<m:deg><m:r>"],
    ],
    [
      "n-ary sum: munderover limits go undOvr, operand inside <m:e>",
      "<math><munderover><mo>∑</mo><mn>0</mn><mi>n</mi></munderover><mi>k</mi></math>",
      [
        '<m:chr m:val="∑"/>',
        '<m:limLoc m:val="undOvr"/>',
        '<m:subHide m:val="0"/><m:supHide m:val="0"/>',
        "<m:e><m:r><m:t>k</m:t></m:r></m:e></m:nary>",
      ],
    ],
    [
      "n-ary integral: msubsup limits go subSup",
      "<math><msubsup><mo>∫</mo><mn>0</mn><mn>1</mn></msubsup><mi>f</mi></math>",
      [
        '<m:chr m:val="∫"/>',
        '<m:limLoc m:val="subSup"/>',
        "<m:e><m:r><m:t>f</m:t></m:r></m:e></m:nary>",
      ],
    ],
    [
      "bare n-ary operator hides both limits with bare slots",
      "<math><mo>∫</mo><mi>f</mi></math>",
      ['<m:subHide m:val="1"/><m:supHide m:val="1"/>', "<m:sub/><m:sup/>"],
    ],
    [
      "accent hat maps to the combining form",
      '<math><mover accent="true"><mi>x</mi><mo>^</mo></mover></math>',
      [
        '<m:acc><m:accPr><m:chr m:val="' +
          U(0x302) +
          '"/></m:accPr><m:e><m:r><m:t>x</m:t></m:r></m:e></m:acc>',
      ],
    ],
    [
      "stretchy macron reads as an overbar, not an accent (order matters)",
      '<math><mover accent="true"><mi>x</mi><mo stretchy="true">¯</mo></mover></math>',
      ['<m:bar><m:barPr><m:pos m:val="top"/></m:barPr>'],
    ],
    [
      "\\vec arrow accent",
      '<math><mover accent="true"><mi>v</mi><mo>' + U(0x20d7) + "</mo></mover></math>",
      ['<m:acc><m:accPr><m:chr m:val="' + U(0x20d7) + '"/></m:accPr>'],
    ],
    [
      "underbrace becomes a bottom groupChr",
      "<math><munder><mrow><mi>a</mi><mi>b</mi></mrow><mo>⏟</mo></munder></math>",
      ['<m:groupChr><m:groupChrPr><m:chr m:val="⏟"/><m:pos m:val="bot"/><m:vertJc m:val="top"/>'],
    ],
    [
      "overbrace becomes a top groupChr",
      "<math><mover><mrow><mi>a</mi><mi>b</mi></mrow><mo>⏞</mo></mover></math>",
      ['<m:chr m:val="⏞"/><m:pos m:val="top"/><m:vertJc m:val="bot"/>'],
    ],
    [
      "munder that is no bar/brace falls through to a lower limit",
      "<math><munder><mo>lim</mo><mrow><mi>x</mi><mo>→</mo><mn>0</mn></mrow></munder></math>",
      ["<m:limLow>", "<m:t>lim</m:t>"],
    ],
    [
      "mover that is no accent/bar/brace is an upper limit (\\overset)",
      "<math><mover><mi>x</mi><mi>f</mi></mover></math>",
      ["<m:limUpp><m:e><m:r><m:t>x</m:t></m:r></m:e><m:lim>"],
    ],
    [
      "non-n-ary munderover is a two-sided limit",
      "<math><munderover><mrow><mi>x</mi></mrow><mn>0</mn><mn>1</mn></munderover></math>",
      ["<m:limLow><m:e><m:limUpp>"],
    ],
    [
      "\\left( … \\right) pairs into one <m:d>",
      '<math><mo fence="true">(</mo><mfrac><mi>a</mi><mi>b</mi></mfrac><mo fence="true">)</mo></math>',
      ['<m:d><m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr><m:e><m:f>'],
    ],
    [
      "ambiguous bars pair with themselves and normalize to the plain pipe",
      '<math><mo fence="true">∣</mo><mi>x</mi><mo fence="true">∣</mo></math>',
      ['<m:begChr m:val="|"/>', '<m:endChr m:val="|"/>'],
    ],
    [
      "opener with no closer (KaTeX cases) keeps an empty endChr",
      '<math><mo fence="true">{</mo><mi>x</mi></math>',
      ['<m:begChr m:val="{"/>', '<m:endChr m:val=""/>'],
    ],
    [
      "closer with no opener takes what precedes it (\\left.…\\right|)",
      '<math><mfrac><mi>a</mi><mi>b</mi></mfrac><mo fence="true">|</mo></math>',
      ['<m:begChr m:val=""/><m:endChr m:val="|"/></m:dPr><m:e><m:f>'],
    ],
    [
      "mfenced with separators emits sepChr and one <m:e> per child",
      '<math><mfenced open="[" close="]" separators=";"><mi>a</mi><mi>b</mi></mfenced></math>',
      [
        '<m:begChr m:val="["/><m:sepChr m:val=";"/><m:endChr m:val="]"/>',
        "<m:e><m:r><m:t>a</m:t></m:r></m:e><m:e><m:r><m:t>b</m:t></m:r></m:e>",
      ],
    ],
    [
      "matrix: column alignments group into m:mcs; ragged rows pad",
      '<math><mtable columnalign="left right"><mtr><mtd><mn>1</mn></mtd><mtd><mn>2</mn></mtd></mtr><mtr><mtd><mn>3</mn></mtd></mtr></mtable></math>',
      [
        '<m:count m:val="1"/><m:mcJc m:val="left"/>',
        '<m:count m:val="1"/><m:mcJc m:val="right"/>',
        "<m:e><m:r><m:t/></m:r></m:e></m:mr>",
      ],
    ],
    [
      "aligned: columnspacing=0em pins the matrix gap to zero",
      '<math><mtable columnspacing="0em"><mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr></mtable></math>',
      ['<m:cGpRule m:val="3"/><m:cGp m:val="0"/>'],
    ],
    [
      "mathvariant bold maps into <m:sty> (landmine #2)",
      '<math><mi mathvariant="bold">x</mi></math>',
      ['<m:rPr><m:sty m:val="b"/></m:rPr>'],
    ],
    [
      "double-struck maps into <m:scr>",
      '<math><mi mathvariant="double-struck">R</mi></math>',
      ['<m:scr m:val="double-struck"/><m:sty m:val="p"/>'],
    ],
    [
      "mathvariant inherits through mstyle",
      '<math><mstyle mathvariant="sans-serif-bold-italic"><mi>q</mi></mstyle></math>',
      ['<m:scr m:val="sans-serif"/><m:sty m:val="bi"/>'],
    ],
    [
      "mphantom hides its content",
      "<math><mphantom><mi>x</mi></mphantom></math>",
      ['<m:phant><m:phantPr><m:show m:val="0"/></m:phantPr>'],
    ],
    [
      "menclose box is a borderBox with no hides",
      '<math><menclose notation="box"><mi>x</mi></menclose></math>',
      ["<m:borderBox><m:borderBoxPr></m:borderBoxPr>"],
    ],
    [
      "\\cancel: strike plus all four sides hidden",
      '<math><menclose notation="updiagonalstrike"><mi>x</mi></menclose></math>',
      [
        '<m:hideTop m:val="1"/><m:hideBot m:val="1"/><m:hideLeft m:val="1"/><m:hideRight m:val="1"/><m:strikeBLTR m:val="1"/>',
      ],
    ],
    [
      "mmultiscripts with mprescripts wraps in <m:sPre>",
      "<math><mmultiscripts><mi>x</mi><mn>1</mn><mn>2</mn><mprescripts/><mn>3</mn><mn>4</mn></mmultiscripts></math>",
      ["<m:sPre><m:sub>", "<m:e><m:sSubSup>"],
    ],
    ["ms wraps its text in quote characters", "<math><ms>str</ms></math>", ['<m:t>"str"</m:t>']],
    ["named entities decode", "<math><mi>&alpha;</mi></math>", ["<m:t>α</m:t>"]],
    [
      "numeric entities decode (decimal and hex)",
      "<math><mn>&#960;</mn><mn>&#x3C0;</mn></math>",
      ["<m:t>ππ</m:t>"],
    ],
    [
      "whitespace-only mtext maps to fixed spaces plus a word joiner",
      "<math><mtext>   </mtext></math>",
      ['<m:t xml:space="preserve">' + EN + JOIN + "</m:t>"],
    ],
    [
      "mspace width=1em is an em space kept alive by a word joiner",
      '<math><mspace width="1em"/></math>',
      ['<m:t xml:space="preserve">' + EM + JOIN + "</m:t>"],
    ],
    [
      "mspace linebreak=newline leaves a wide gap (m:brk is dead in Word)",
      '<math><mspace linebreak="newline"/></math>',
      [EM + EM + JOIN],
    ],
    [
      "tolerant reader: unquoted attribute values",
      "<math><mi mathvariant=bold>x</mi></math>",
      ['<m:sty m:val="b"/>'],
    ],
    [
      "tolerant reader: unclosed tags and comments",
      "<math><!-- c --><mrow><mi>x</mi></math>",
      ["<m:r><m:t>x</m:t></m:r>"],
    ],
    [
      "tolerant reader: namespace prefixes are stripped",
      "<mml:math><mml:mi>y</mml:mi></mml:math>",
      ["<m:r><m:t>y</m:t></m:r>"],
    ],
  ];

  it.each(cases)("%s", (_name, mml, subs) => {
    const out = mmlToOmml(mml);
    expect(out).not.toBe(null);
    expect(out).toContain('<m:oMath xmlns:m="' + NS + '">');
    for (const sub of subs) expect(out).toContain(sub);
  });

  it("emits the exact minimal document for a single variable", () => {
    expect(mmlToOmml("<math><mi>x</mi></math>")).toBe(
      '<m:oMath xmlns:m="' + NS + '"><m:r><m:t>x</m:t></m:r></m:oMath>',
    );
  });

  it("single-letter <mi> carries no run properties at all", () => {
    expect(mmlToOmml("<math><mi>x</mi></math>")).not.toContain("<m:rPr>");
  });

  it("keeps the n-ary operand inside <m:e> and the relation outside", () => {
    const out = mmlToOmml(
      "<math><msubsup><mo>∫</mo><mn>0</mn><mn>1</mn></msubsup><mi>f</mi><mo>=</mo><mn>1</mn></math>",
    ) as string;
    const nary = out.indexOf("</m:nary>");
    const eq = out.indexOf("<m:t>=1</m:t>");
    expect(nary).toBeGreaterThan(-1);
    expect(eq).toBeGreaterThan(nary);
    expect(out).toContain("<m:e><m:r><m:t>f</m:t></m:r></m:e></m:nary>");
  });

  it("nested fences produce nested <m:d> elements", () => {
    const out = mmlToOmml(
      '<math><mo fence="true">(</mo><mo fence="true">(</mo><mi>x</mi>' +
        '<mo fence="true">)</mo><mo fence="true">)</mo></math>',
    ) as string;
    expect(out.split("<m:d>").length - 1).toBe(2);
  });

  it("drops the TeX <annotation> entirely (landmine #3)", () => {
    const out = mmlToOmml(
      "<math><semantics><mrow><mi>x</mi></mrow>" +
        '<annotation encoding="application/x-tex">\\frac{a}{b}</annotation></semantics></math>',
    ) as string;
    expect(out).toContain("<m:t>x</m:t>");
    expect(out).not.toContain("frac");
  });

  it("strips invisible operators from token text", () => {
    const out = mmlToOmml("<math><mi>a" + U(0x200b) + "b" + APPLY + "c</mi></math>") as string;
    expect(out).toContain("<m:t>abc</m:t>");
    expect(out).not.toContain(APPLY);
    expect(out).not.toContain(U(0x200b));
  });

  it("returns null for null, empty, non-string, and whitespace-only inputs", () => {
    expect(mmlToOmml(null)).toBe(null);
    expect(mmlToOmml(undefined)).toBe(null);
    expect(mmlToOmml("")).toBe(null);
    expect(mmlToOmml("<math>   </math>")).toBe(null);
    expect(mmlToOmml("<math></math>")).toBe(null);
  });

  it("negative mspace collapses to nothing and yields null", () => {
    expect(mmlToOmml('<math><mspace width="-0.3em"/></math>')).toBe(null);
  });

  it("is deterministic: the same input twice gives byte-identical output", () => {
    const mml =
      "<math><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover>" +
      "<mfrac><msup><mi>x</mi><mi>i</mi></msup><msqrt><mn>2</mn></msqrt></mfrac></math>";
    const a = mmlToOmml(mml);
    const b = mmlToOmml(mml);
    expect(a).not.toBe(null);
    expect(a).toBe(b);
  });
});

describe("oMathPara", () => {
  it("wraps with a centered paragraph by default", () => {
    expect(oMathPara("<m:oMath/>")).toBe(
      '<m:oMathPara xmlns:m="' +
        NS +
        '"><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr><m:oMath/></m:oMathPara>',
    );
  });
  it("honors an explicit justification", () => {
    expect(oMathPara("<m:oMath/>", "left")).toContain('<m:jc m:val="left"/>');
  });
  it("an empty jc drops the paragraph properties", () => {
    expect(oMathPara("<m:oMath/>", "")).toBe(
      '<m:oMathPara xmlns:m="' + NS + '"><m:oMath/></m:oMathPara>',
    );
  });
  it("returns null for empty input", () => {
    expect(oMathPara(null)).toBe(null);
    expect(oMathPara("")).toBe(null);
  });
});

describe("public surface", () => {
  it("api carries exactly the classic MathmlOmml members, in order", () => {
    expect(Object.keys(api)).toEqual(["mmlToOmml", "texToOmml", "oMathPara", "NS"]);
  });
  it("named exports are the same functions the api object holds", () => {
    expect(api.mmlToOmml).toBe(mmlToOmml);
    expect(api.texToOmml).toBe(texToOmml);
    expect(api.oMathPara).toBe(oMathPara);
    expect(api.NS).toBe(NS);
  });
  it("NS is the OMML math namespace", () => {
    expect(NS).toBe("http://schemas.openxmlformats.org/officeDocument/2006/math");
  });
});
