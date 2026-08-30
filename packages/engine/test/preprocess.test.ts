/* ============================================================
   preprocess — the line-based rewrite that turns dialect constructs
   into HTML carriers before marked runs. String-level, so every
   expected value here is byte-for-byte the ACTUAL output of
   src/js/engine.js (captured via a Node harness on 2026-08-30),
   line maps included.
   ============================================================ */
import { describe, expect, it } from "vitest";
import {
  collectContainer,
  extractFootnotes,
  mathToSpans,
  outsideCode,
  parseOpts,
  preprocess,
} from "../src/parse.js";
import type { LineSpan } from "../src/types.js";

const S = { theme: "modern" };
function pre(src: string) {
  const citeDefs: Record<string, string> = {};
  const lineMap: LineSpan[] = [];
  const out = preprocess(src, S, { citeDefs, lineMap });
  return { out, citeDefs, lineMap };
}

describe("footnotes", () => {
  it("definition is lifted; the call becomes the inline note span", () => {
    expect(pre("A claim.[^1] More.\n\n[^1]: The note text.").out).toBe(
      'A claim.<span class="footnote" data-fn="1">The note text.</span> More.\n',
    );
  });
  it("multiple notes, markdown inside, continuation lines", () => {
    expect(
      pre(
        "See[^a] and[^b].\n\n[^a]: First with *em*.\n[^b]: Second — long.\n  continued line.\n\nAfter.",
      ).out,
    ).toBe(
      'See<span class="footnote" data-fn="a">First with <em>em</em>.</span> and<span class="footnote" data-fn="b">Second — long. continued line.</span>.\n\nAfter.',
    );
  });
  it("a dangling call stays exactly the characters typed", () => {
    expect(pre("A dangling call [^99] stays.").out).toBe("A dangling call [^99] stays.");
  });
  it("definitions inside code fences are not definitions", () => {
    const { out, lineMap } = pre("```\n[^1]: not a def\n```\n\n[^1]: real def\ncall [^1]");
    expect(out).toBe(
      '```\n[^1]: not a def\n```\n\ncall <span class="footnote" data-fn="1">real def</span>',
    );
    expect(lineMap).toEqual([
      { s: 0, e: 0 },
      { s: 1, e: 1 },
      { s: 2, e: 2 },
      { s: 3, e: 3 },
      { s: 5, e: 5 },
    ]);
  });
  it("notes defined outside a callout are callable inside it", () => {
    expect(pre("[^o]: outer note\n\n:::note\ninner call [^o]\n:::").out).toBe(
      '\n<div class="callout note"><div class="co-title">Note</div><div class="co-body"><p>inner call <span class="footnote" data-fn="o">outer note</span></p> </div></div>\n',
    );
  });
});

describe("citations", () => {
  it("a call becomes an empty cite span; the def is collected", () => {
    const { out, citeDefs } = pre("As shown [@doe2020].\n\n[@doe2020]: Doe, J. (2020). Title.");
    expect(out).toBe('As shown <span class="cite" data-key="doe2020"></span>.\n');
    expect(citeDefs).toEqual({ doe2020: "Doe, J. (2020). Title." });
  });
  it("locators ride on data-loc", () => {
    expect(pre("See [@doe2020, p. 33].\n\n[@doe2020]: Doe, J. (2020). Title.").out).toBe(
      'See <span class="cite" data-key="doe2020" data-loc="p. 33"></span>.\n',
    );
  });
  it("[references] becomes the refs marker div", () => {
    const { out } = pre("One [@a].\n\n[references]\n\n[@a]: Alpha, A. (2001). A.");
    expect(out).toContain('<div data-refs="1"></div>');
  });
  it("cite defs inside callouts flow up through inherited.citeDefs", () => {
    const { citeDefs } = pre("[@k]: Key, K. (1999). K.\n\n:::note\ncited [@k]\n:::");
    expect(citeDefs).toEqual({ k: "Key, K. (1999). K." });
  });
});

describe("cross-references", () => {
  it("[#id] becomes an empty xref anchor", () => {
    expect(pre("See [#fig:setup] and [#sec:missing] and [#tbl:x].").out).toBe(
      'See <a class="xref" href="#fig:setup"></a> and <a class="xref" href="#sec:missing"></a> and <a class="xref" href="#tbl:x"></a>.',
    );
  });
  it("inline code protects xref/cite/math syntax", () => {
    expect(pre("`[#fig:setup]` literal").out).toBe("`[#fig:setup]` literal");
    expect(pre("`[@a]` and `$x$`").out).toBe("`[@a]` and `$x$`");
  });
});

describe("math", () => {
  it("$…$ becomes an empty span carrying the TeX (escaped)", () => {
    expect(pre("Euler: $e^{i\\pi}+1=0$ inline.").out).toBe(
      'Euler: <span class="math-inline" data-tex="e^{i\\pi}+1=0"></span> inline.',
    );
  });
  it("currency never matches — closing $ may not follow space, opening may not precede one", () => {
    expect(
      pre("costs $5 and $10 for the annex\nbetween $20 and $180 per year\n$95 alone").out,
    ).toBe("costs $5 and $10 for the annex\nbetween $20 and $180 per year\n$95 alone");
  });
  it("display math: multi-line $$ block", () => {
    const { out, lineMap } = pre("$$\nE = mc^2\n$$");
    expect(out).toBe('\n<div class="math-display" data-tex="E = mc^2"></div>\n');
    expect(lineMap).toEqual([
      { s: 0, e: 2 },
      { s: 0, e: 2 },
      { s: 0, e: 2 },
    ]);
  });
  it("display math: one-line and trailing forms", () => {
    expect(pre("$$a^2+b^2=c^2$$").out).toBe(
      '\n<div class="math-display" data-tex="a^2+b^2=c^2"></div>\n',
    );
    expect(pre("prefix\n\n$$x_1 + x_2\n= y$$").out).toBe(
      'prefix\n\n\n<div class="math-display" data-tex="x_1 + x_2\n= y"></div>\n',
    );
  });
  it("mathToSpans escapes the TeX for the attribute", () => {
    expect(mathToSpans('$a<b>"c"$')).toBe(
      '<span class="math-inline" data-tex="a&lt;b&gt;&quot;c&quot;"></span>',
    );
  });
});

describe("block markers", () => {
  it("[toc] / [lof] / [lot] / [pagebreak], case-insensitive", () => {
    expect(pre("[toc]\n\n# H").out).toBe('\n<div data-toc="1"></div>\n\n\n# H');
    expect(pre("[lof]").out).toBe('\n<div data-list="fig"></div>\n');
    expect(pre("[lot]").out).toBe('\n<div data-list="tbl"></div>\n');
    expect(pre("a\n\n[pagebreak]\n\nb").out).toBe('a\n\n\n<div class="page-break"></div>\n\n\nb');
    expect(pre("[TOC]\n[LOF]\n[PageBreak]").out).toBe(
      '\n<div data-toc="1"></div>\n\n\n<div data-list="fig"></div>\n\n\n<div class="page-break"></div>\n',
    );
  });
  it("fences protect every construct", () => {
    expect(pre("```\n[toc]\n$x$\n==nope==\n[@a]\n```").out).toBe(
      "```\n[toc]\n$x$\n==nope==\n[@a]\n```",
    );
    expect(pre("~~~~\n[toc]\n~~~~\nafter").out).toBe("~~~~\n[toc]\n~~~~\nafter");
  });
  it("CRLF and lone CR normalize to LF", () => {
    expect(pre("line1\r\nline2\r\rline3").out).toBe("line1\nline2\n\nline3");
  });
});

describe("screenshots and table captions", () => {
  it("[screenshot] minimal", () => {
    expect(pre("[screenshot]").out).toBe(
      '\n<figure class="shot" data-caption="" data-key=""></figure>\n',
    );
  });
  it("[screenshot: caption | img | w | # | noborder] — options in any order", () => {
    expect(pre("[screenshot: Setup | img:bench | w:60% | #fig:setup | noborder]").out).toBe(
      '\n<figure class="shot noborder" data-caption="Setup" data-key="bench" data-req-w="60%" id="fig:setup"></figure>\n',
    );
    expect(pre("[screenshot: X | border | width:40%]").out).toBe(
      '\n<figure class="shot" data-caption="X" data-key="" data-req-w="40%"></figure>\n',
    );
  });
  it("[table: …] emits the caption marker div", () => {
    expect(pre("[table: Quarterly results | #tbl:q]\n\n| a | b |\n|---|---|\n| 1 | 2 |").out).toBe(
      '\n<div data-tablecap="Quarterly results" data-id="tbl:q"></div>\n\n\n| a | b |\n|---|---|\n| 1 | 2 |',
    );
  });
  it("parseOpts", () => {
    expect(parseOpts(" | img:bench | w:60% | #fig:setup | noborder")).toEqual({
      img: "bench",
      w: "60%",
      id: "fig:setup",
      noborder: true,
    });
    expect(parseOpts("| border")).toEqual({ border: true });
    expect(parseOpts(" | width:40% | #tbl:q")).toEqual({ w: "40%", id: "tbl:q" });
    expect(parseOpts("| img: spaced key | w:33%")).toEqual({ img: "spaced key", w: "33%" });
    expect(parseOpts("| NOBORDER")).toEqual({ noborder: true });
    expect(parseOpts("| unknown:thing | #x")).toEqual({ id: "x" });
    expect(parseOpts("|")).toEqual({});
    expect(parseOpts("| w:60% | w:70%")).toEqual({ w: "70%" }); // last wins
    expect(parseOpts(undefined)).toEqual({});
  });
});

describe("containers", () => {
  it("callout with default and custom titles", () => {
    expect(pre(":::note\nBody text.\n:::").out).toBe(
      '\n<div class="callout note"><div class="co-title">Note</div><div class="co-body"><p>Body text.</p> </div></div>\n',
    );
    expect(pre(":::warning Custom title here\nBe careful.\n:::").out).toBe(
      '\n<div class="callout warning"><div class="co-title">Custom title here</div><div class="co-body"><p>Be careful.</p> </div></div>\n',
    );
  });
  it("all four kinds", () => {
    const { out } = pre(":::tip\nt\n:::\n\n:::important\ni\n:::");
    expect(out).toContain('class="callout tip"');
    expect(out).toContain('class="callout important"');
    expect(out).toContain('<div class="co-title">Tip</div>');
    expect(out).toContain('<div class="co-title">Important</div>');
  });
  it("nested containers keep their depth", () => {
    expect(pre(":::note Outer\nbefore\n:::tip Inner\ninner body\n:::\nafter\n:::").out).toBe(
      '\n<div class="callout note"><div class="co-title">Outer</div><div class="co-body"><p>before</p> <div class="callout tip"><div class="co-title">Inner</div><div class="co-body"><p>inner body</p> </div></div><p>after</p> </div></div>\n',
    );
  });
  it("a fence inside a callout hides ::: and keeps newlines as &#10;", () => {
    expect(pre(":::note\n```\n:::\nnot a close\n```\nstill inside\n:::").out).toBe(
      '\n<div class="callout note"><div class="co-title">Note</div><div class="co-body"><pre><code>:::&#10;not a close&#10;</code></pre> <p>still inside</p> </div></div>\n',
    );
  });
  it("an unclosed container runs to EOF", () => {
    expect(pre(":::note\nnever closed").out).toBe(
      '\n<div class="callout note"><div class="co-title">Note</div><div class="co-body"><p>never closed</p> </div></div>\n',
    );
  });
  it("alignment groups", () => {
    expect(pre(":::center\nCentred line.\n:::").out).toBe(
      '\n<div class="align-center"><p>Centred line.</p> </div>\n',
    );
    const { out } = pre(":::right\nr\n:::\n\n:::left\nl\n:::\n\n:::justify\nj\n:::");
    expect(out).toContain('<div class="align-right">');
    expect(out).toContain('<div class="align-left">');
    expect(out).toContain('<div class="align-justify">');
  });
  it(":::center with trailing words is plain text, not a container", () => {
    expect(pre(":::center trailing words\nis plain text\n:::").out).toBe(
      ":::center trailing words\nis plain text\n:::",
    );
  });
  it(":::banner — the title plate (c35d755)", () => {
    expect(pre(":::banner\n# The Plate\nsubtitle line\n:::").out).toBe(
      '\n<div class="banner"><h1>The Plate</h1> <p>subtitle line</p> </div>\n',
    );
  });
  it("a callout nests inside a banner", () => {
    expect(pre(":::banner\n## T\n:::note\nnested\n:::\n:::").out).toBe(
      '\n<div class="banner"><h2>T</h2> <div class="callout note"><div class="co-title">Note</div><div class="co-body"><p>nested</p> </div></div> </div>\n',
    );
  });
  it("collectContainer respects fences and nesting", () => {
    expect(collectContainer([":::note", "a", ":::", "b"], 0)).toEqual({ inner: ["a"], end: 2 });
    expect(collectContainer([":::note", "```", ":::", "```", ":::"], 0)).toEqual({
      inner: ["```", ":::", "```"],
      end: 4,
    });
    expect(collectContainer([":::note", ":::tip", "x", ":::", ":::"], 0)).toEqual({
      inner: [":::tip", "x", ":::"],
      end: 4,
    });
  });
});

describe("the source line map", () => {
  it("plain lines map 1:1", () => {
    expect(pre("hello world\n\nsecond para").lineMap).toEqual([
      { s: 0, e: 0 },
      { s: 1, e: 1 },
      { s: 2, e: 2 },
    ]);
  });
  it("lifted definitions shift the map to original line numbers", () => {
    expect(pre("A claim.[^1] More.\n\n[^1]: The note text.").lineMap).toEqual([
      { s: 0, e: 0 },
      { s: 1, e: 1 },
    ]);
  });
  it("a container's three emitted lines all span the original block", () => {
    expect(pre(":::note\nBody text.\n:::").lineMap).toEqual([
      { s: 0, e: 2 },
      { s: 0, e: 2 },
      { s: 0, e: 2 },
    ]);
    expect(pre(":::banner\n# The Plate\nsubtitle line\n:::").lineMap).toEqual([
      { s: 0, e: 3 },
      { s: 0, e: 3 },
      { s: 0, e: 3 },
    ]);
  });
  it("marker lines expand to three emitted lines on the same source line", () => {
    expect(pre("a\n\n[pagebreak]\n\nb").lineMap).toEqual([
      { s: 0, e: 0 },
      { s: 1, e: 1 },
      { s: 2, e: 2 },
      { s: 2, e: 2 },
      { s: 2, e: 2 },
      { s: 3, e: 3 },
      { s: 4, e: 4 },
    ]);
  });
});

describe("extractFootnotes", () => {
  it("separates notes and cites, keeps the rest with original indices", () => {
    const fx = extractFootnotes(["call [^1]", "[^1]: note", "[@k]: cite", "tail"]);
    expect(fx.notes).toEqual({ "1": "note" });
    expect(fx.cites).toEqual({ k: "cite" });
    expect(fx.lines).toEqual(["call [^1]", "tail"]);
    expect(fx.nos).toEqual([0, 3]);
  });
  it("an indented line continues the open definition; a blank closes it", () => {
    const fx = extractFootnotes(["[^a]: one", "  two", "", "three"]);
    expect(fx.notes).toEqual({ a: "one two" });
    expect(fx.lines).toEqual(["three"]);
  });
});

describe("outsideCode", () => {
  it("applies fn only outside inline code", () => {
    expect(outsideCode("a `b` c", (s) => s.toUpperCase())).toBe("A `b` C");
    expect(outsideCode("``x`` y", (s) => s.replace(/y/, "z"))).toBe("``x`` z");
  });
});
