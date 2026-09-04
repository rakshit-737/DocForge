/* The symbol picker's judgement: what a search finds, whether the caret is
   already inside maths, and exactly what gets inserted where. */
import { describe, expect, it } from "vitest";
import {
  insertionFor,
  insideMath,
  SYMBOL_GROUPS,
  SYMBOLS,
  searchSymbols,
} from "./equation-palette";

describe("the roster", () => {
  it("is grouped, and every entry is real LaTeX with a label", () => {
    expect(SYMBOL_GROUPS.length).toBeGreaterThan(3);
    for (const s of SYMBOLS) {
      expect(s.tex.length).toBeGreaterThan(0);
      expect(s.label.trim()).not.toBe("");
      expect(s.group).toBeTruthy();
    }
  });

  it("has no duplicate insertions", () => {
    const seen = new Set(SYMBOLS.map((s) => s.tex));
    expect(seen.size).toBe(SYMBOLS.length);
  });
});

describe("searchSymbols", () => {
  it("offers everything for an empty query", () => {
    expect(searchSymbols("")).toHaveLength(SYMBOLS.length);
  });

  it("finds a symbol by its name", () => {
    expect(searchSymbols("theta")[0]?.tex).toBe("\\theta");
    expect(searchSymbols("fraction")[0]?.tex).toBe("\\frac{|}{}");
  });

  it("finds it by the word a student would actually use", () => {
    /* "divide" is the division sign's own name, so it wins; the fraction is
       right behind it on its alias. */
    expect(searchSymbols("divide")[0]?.tex).toBe("\\div");
    expect(searchSymbols("divide").map((s) => s.tex)).toContain("\\frac{|}{}");
    expect(searchSymbols("power")[0]?.tex).toBe("{|}^{}");
    expect(searchSymbols("implies")[0]?.tex).toBe("\\Rightarrow");
    expect(searchSymbols("tolerance")[0]?.tex).toBe("\\pm");
  });

  it("finds it by the LaTeX itself, for someone who half-remembers", () => {
    expect(searchSymbols("\\int")[0]?.tex).toContain("\\int");
  });

  it("returns nothing rather than noise for a miss", () => {
    expect(searchSymbols("zzzznotasymbol")).toEqual([]);
  });
});

describe("insideMath", () => {
  it("knows an inline span from ordinary prose", () => {
    const src = "Text $x + 1$ more text";
    expect(insideMath(src, 0)).toBe(false);
    expect(insideMath(src, 8)).toBe(true); // between the dollars
    expect(insideMath(src, src.length)).toBe(false);
  });

  it("knows a display block", () => {
    const src = "Before\n\n$$\nE = mc^2\n$$\n\nAfter";
    expect(insideMath(src, src.indexOf("E ="))).toBe(true);
    expect(insideMath(src, src.length - 1)).toBe(false);
  });

  it("is not fooled by an escaped dollar sign", () => {
    const src = "It cost \\$5 and then some";
    expect(insideMath(src, src.length)).toBe(false);
  });

  it("treats an unclosed span as inside — the writer is mid-equation", () => {
    expect(insideMath("Half written $x +", 17)).toBe(true);
  });
});

describe("insertionFor", () => {
  it("brings its own delimiters outside maths", () => {
    const out = insertionFor("\\alpha", "Prose here ", 11);
    expect(out.text).toBe("$\\alpha$");
    expect(out.caret).toBe(out.text.length - 1); // just inside the closing $
  });

  it("inserts bare inside maths", () => {
    const src = "Text $x + $";
    const out = insertionFor("\\alpha", src, 10);
    expect(out.text).toBe("\\alpha");
  });

  it("honours the caret marker, and strips it", () => {
    const out = insertionFor("\\frac{|}{}", "$ $", 1);
    expect(out.text).toBe("\\frac{}{}");
    expect(out.caret).toBe("\\frac{".length);
  });

  it("counts the wrapper's own dollar when placing the caret", () => {
    const out = insertionFor("\\frac{|}{}", "prose", 5);
    expect(out.text).toBe("$\\frac{}{}$");
    expect(out.text[out.caret]).toBe("}"); // the caret sits in the numerator
    expect(out.caret).toBe("$\\frac{".length);
  });

  it("puts a structure with no marker after the whole insertion", () => {
    const out = insertionFor("\\infty", "prose", 5);
    expect(out.caret).toBe("$\\infty".length);
  });
});
