import { describe, expect, it } from "vitest";
import { render } from "../src/index.js";
import { BASE, r } from "./_helpers.js";

describe("Markdown→DOM sanitization boundary", () => {
  it("strips executable <script> tags from markdown input", () => {
    const { doc } = r("# Title\n\n<script>window.__pwned = true;</script>\n\nProse paragraph.");
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.innerHTML).not.toContain("<script");
    expect(doc.innerHTML).not.toContain("window.__pwned");
    expect(doc.querySelector("h1")?.textContent).toBe("Title");
    expect(doc.querySelector("p")?.textContent).toContain("Prose paragraph.");
  });

  it("strips inline event handlers from all elements", () => {
    const vectors = [
      '<img src="missing.png" onerror="window.__xss=1">',
      '<svg><circle cx="10" cy="10" r="5" onload="window.__xss=2" /></svg>',
      '<div onmouseover="window.__xss=3">hover</div>',
      '<a href="https://example.com" onclick="window.__xss=4">click</a>',
      '<b onfocus="window.__xss=5" tabindex="1">focus</b>',
    ];

    for (const vector of vectors) {
      const { doc } = r(`Prose before\n\n${vector}\n\nProse after`);
      expect(doc.innerHTML).not.toMatch(/on\w+\s*=/i);
    }
  });

  it("neutralizes javascript: and vbscript: URIs in links", () => {
    const { doc: doc1 } = r("[Malicious Link](javascript:alert(1))");
    const link1 = doc1.querySelector("a");
    // DOMPurify removes javascript: href or strips the attribute
    expect(link1?.getAttribute("href") || "").not.toContain("javascript:");

    const { doc: doc2 } = r('<a href="javascript:window.__xss=1">raw link</a>');
    const link2 = doc2.querySelector("a");
    expect(link2?.getAttribute("href") || "").not.toContain("javascript:");

    const { doc: doc3 } = r('<a href="vbscript:msgbox(1)">vbscript link</a>');
    const link3 = doc3.querySelector("a");
    expect(link3?.getAttribute("href") || "").not.toContain("vbscript:");
  });

  it("preserves math formulas and KaTeX data-tex attributes", () => {
    const md = "The formula is $E=mc^2$ inline and:\n\n$$\\int_0^\\infty e^{-x} dx = 1$$\n";
    const { doc } = r(md);

    // Math inline
    const inline = doc.querySelector(".math-inline") as HTMLElement;
    expect(inline).not.toBeNull();
    expect(inline.dataset.tex).toBe("E=mc^2");
    expect(inline.querySelector(".katex")).not.toBeNull();

    // Math display
    const display = doc.querySelector(".math-display") as HTMLElement;
    expect(display).not.toBeNull();
    expect(display.dataset.tex).toBe("\\int_0^\\infty e^{-x} dx = 1");
    expect(display.querySelector(".katex")).not.toBeNull();
  });

  it("preserves highlight marks with data-hl and inline background color", () => {
    const md = "This is ==highlighted== and =={green}custom green== text.";
    const { doc } = r(md);

    const marks = doc.querySelectorAll("mark");
    expect(marks.length).toBe(2);
    expect(marks[0].dataset.hl).toBe("yellow");
    expect(marks[0].style.backgroundColor).toBeTruthy();

    expect(marks[1].dataset.hl).toBe("green");
    expect(marks[1].style.backgroundColor).toBeTruthy();
  });

  it("preserves Word-ribbon dialect spans (.dfspan) and their data attributes", () => {
    const md = '[custom styled text]{color=#ff0000 bg=#ffff00 size=14 font="Georgia" u sc caps}';
    const { doc } = r(md);

    const span = doc.querySelector(".dfspan") as HTMLElement;
    expect(span).not.toBeNull();
    expect(span.dataset.color).toBe("ff0000");
    expect(span.dataset.bg).toBe("ffff00");
    expect(span.dataset.size).toBe("14");
    expect(span.dataset.font).toBe("Georgia");
    expect(span.dataset.u).toBe("1");
    expect(span.dataset.sc).toBe("1");
    expect(span.dataset.caps).toBe("1");
    expect(span.textContent).toBe("custom styled text");
  });

  it("sanitizes citation entries while rendering safe markdown formatting", () => {
    const md = `
Refer to the study [@smith2020].

[@smith2020]: Smith, J. (2020). *Safe Research*. <script>alert(1)</script><img src=x onerror=alert(1)>
`;
    const { doc } = r(md);
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.querySelectorAll("[onerror]").length).toBe(0);

    const ref = doc.querySelector(".ref");
    expect(ref).not.toBeNull();
    expect(ref?.textContent).toContain("Smith, J. (2020)");
    expect(ref?.querySelector("em")?.textContent).toBe("Safe Research");
  });

  it("preserves source map line stamps (data-ss and data-se)", () => {
    const md = "Paragraph 1\n\nParagraph 2\n\nParagraph 3";
    const { doc } = r(md);
    const paras = doc.querySelectorAll("p");
    expect(paras.length).toBe(3);
    paras.forEach((p) => {
      expect(p.dataset.ss).toBeDefined();
      expect(p.dataset.se).toBeDefined();
    });
  });
});
