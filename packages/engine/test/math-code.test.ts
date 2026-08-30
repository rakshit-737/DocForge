/* ============================================================
   KaTeX math (inline + display; the data-tex contract the .docx
   exporter reads) and highlight.js fences.
   ============================================================ */
import { describe, expect, it } from "vitest";
import { r } from "./_helpers.js";

describe("math", () => {
  it("$…$ renders KaTeX but keeps the TeX on data-tex", () => {
    const { content } = r("Euler: $e^{i\\pi}+1=0$ inline.");
    const el = content.querySelector("span.math-inline") as HTMLElement;
    expect(el.dataset.tex).toBe("e^{i\\pi}+1=0");
    expect(el.querySelector(".katex")).toBeTruthy();
    expect(el.querySelector(".katex-display")).toBeNull();
    expect(el.getAttribute("contenteditable")).toBe("false");
  });
  it("$$…$$ renders display mode", () => {
    const { content } = r("$$\nE = mc^2\n$$");
    const el = content.querySelector("div.math-display") as HTMLElement;
    expect(el.dataset.tex).toBe("E = mc^2");
    expect(el.querySelector(".katex-display")).toBeTruthy();
    expect(el.getAttribute("contenteditable")).toBe("false");
  });
  it("underscores inside TeX never leak into emphasis", () => {
    const { content } = r("$x_1 + y_2$ and $a_b$");
    expect(content.querySelector("em")).toBeNull();
    const els = [...content.querySelectorAll("span.math-inline")];
    expect(els.map((e) => (e as HTMLElement).dataset.tex)).toEqual(["x_1 + y_2", "a_b"]);
  });
  it("currency stays prose", () => {
    const { content } = r("costs $5 and $10 for the annex");
    expect(content.querySelector(".math-inline")).toBeNull();
    expect(content.textContent).toContain("$5 and $10");
  });
  it("math inside inline code stays source text", () => {
    const { content } = r("`$x$` literal");
    expect(content.querySelector(".math-inline")).toBeNull();
    expect(content.querySelector("code")?.textContent).toBe("$x$");
  });
  it("invalid TeX still renders (throwOnError: false), tex preserved", () => {
    const { content } = r("$\\notacommand{x}$");
    const el = content.querySelector("span.math-inline") as HTMLElement;
    expect(el.dataset.tex).toBe("\\notacommand{x}");
    // KaTeX renders the error inline rather than throwing; the span is not empty
    expect(el.innerHTML).not.toBe("");
    expect(el.classList.contains("math-error")).toBe(false);
  });
});

describe("code highlighting", () => {
  it("a fence naming a language hljs knows is highlighted", () => {
    const { content } = r("```js\nconst x = 1;\n```");
    const code = content.querySelector("pre > code") as HTMLElement;
    expect(code.className).toContain("language-js");
    expect(code.classList.contains("hljs")).toBe(true);
    expect(code.querySelector("[class^='hljs-']")).toBeTruthy();
  });
  it("an unknown language stays plain", () => {
    const { content } = r("```klingon\nqapla x\n```");
    const code = content.querySelector("pre > code") as HTMLElement;
    expect(code.className).toContain("language-klingon");
    expect(code.classList.contains("hljs")).toBe(false);
    expect(code.textContent).toBe("qapla x\n");
  });
  it("an unlabelled fence stays plain", () => {
    const { content } = r("```\nplain text\n```");
    const code = content.querySelector("pre > code") as HTMLElement;
    expect(code.className).not.toContain("language-");
    expect(code.classList.contains("hljs")).toBe(false);
  });
  it("dialect syntax inside a fence is never executed", () => {
    const { content } = r("```\n==not a highlight== ++not a rule++ [^1] [@a] $x$ [toc]\n```");
    expect(content.querySelector("mark, u, .footnote, .cite, .math-inline, [data-toc]")).toBeNull();
    expect(content.querySelector("code")?.textContent).toBe(
      "==not a highlight== ++not a rule++ [^1] [@a] $x$ [toc]\n",
    );
  });
});
