/* ============================================================
   Heading ids and labels, heading numbering, [toc], and
   cross-reference resolution (including the ?? missing case).
   ============================================================ */
import { describe, expect, it } from "vitest";
import { r } from "./_helpers.js";

describe("heading ids", () => {
  it("slugs from the text; duplicates get -n suffixes", () => {
    const { content } = r("# Same\n\n# Same\n\n# Same\n\n# Other Words Here");
    const ids = [...content.querySelectorAll("h1")].map((h) => h.id);
    expect(ids).toEqual(["same", "same-1", "same-2", "other-words-here"]);
  });
  it("punctuation is stripped; an empty slug falls back to 'sec'", () => {
    const { content } = r("## C++ & Co.!\n\n## ???");
    const ids = [...content.querySelectorAll("h2")].map((h) => h.id);
    expect(ids).toEqual(["c-co", "sec"]);
  });
  it("an explicit {#sec:x} label wins, is stripped from view, survives as data-label", () => {
    const { content } = r("## Methods {#sec:method}");
    const h = content.querySelector("h2") as HTMLElement;
    expect(h.id).toBe("sec:method");
    expect(h.dataset.label).toBe("sec:method");
    expect(h.textContent).toBe("Methods");
  });
  it("the label is stripped even when the heading carries inline marks", () => {
    const { content } = r("## Bold **Head** {#sec:b}");
    const h = content.querySelector("h2") as HTMLElement;
    expect(h.id).toBe("sec:b");
    expect(h.textContent).toBe("Bold Head");
    expect(h.querySelector("strong")?.textContent).toBe("Head");
  });
});

describe("heading numbering", () => {
  it("numbers h1-h3 hierarchically; h4+ never", () => {
    const { content } = r("# A\n\n## B\n\n### C\n\n## D\n\n# E\n\n#### F", { numbered: true });
    const nums = [...content.querySelectorAll("h1,h2,h3,h4")].map(
      (h) => (h as HTMLElement).dataset.num,
    );
    expect(nums).toEqual(["1", "1.1", "1.1.1", "1.2", "2", undefined]);
    const h1 = content.querySelector("h1") as HTMLElement;
    expect(h1.querySelector(".hnum")?.textContent).toBe("1");
    expect(h1.querySelector(".hnum")?.getAttribute("contenteditable")).toBe("false");
  });
  it("numbers relative to the shallowest heading: a doc opening on h2 counts 1, 1.1, 2", () => {
    const { content } = r("## A\n\n### B\n\n## C", { numbered: true });
    const nums = [...content.querySelectorAll("h2,h3")].map((h) => (h as HTMLElement).dataset.num);
    expect(nums).toEqual(["1", "1.1", "2"]);
  });
  it("no numbering without the setting", () => {
    const { content } = r("# A\n\n## B");
    expect(content.querySelector(".hnum")).toBeNull();
  });
});

describe("[toc]", () => {
  it("filters to h1-h3 and links each slug", () => {
    const { content } = r("[toc]\n\n# Alpha\n\n## Beta\n\n### Gamma\n\n#### Deep\n\n##### Deeper");
    const wrap = content.querySelector(".toc-wrap") as HTMLElement;
    expect(wrap.getAttribute("contenteditable")).toBe("false");
    expect(wrap.querySelector(".toc-title")?.textContent).toBe("Contents");
    const links = [...wrap.querySelectorAll("nav.toc a")];
    expect(links.map((a) => a.className)).toEqual(["l1", "l2", "l3"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["#alpha", "#beta", "#gamma"]);
    expect(links.map((a) => a.querySelector(".t")?.textContent)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    expect(links[0].querySelector(".dots")).toBeTruthy();
  });
  it("numbered entries carry the hnum and strip it from the text", () => {
    const { content } = r("[toc]\n\n# Alpha\n\n## Beta", { numbered: true });
    const links = [...content.querySelectorAll(".toc-wrap nav.toc a")];
    expect(links[0].querySelector(".hnum")?.textContent).toBe("1");
    expect(links[0].querySelector(".t")?.textContent).toBe("1Alpha");
    expect(links[1].querySelector(".hnum")?.textContent).toBe("1.1");
  });
  it("no [toc] marker, no toc", () => {
    const { content } = r("# Alpha");
    expect(content.querySelector(".toc-wrap")).toBeNull();
  });
});

describe("cross-references", () => {
  const DOC = [
    "See [#fig:setup] and [#tbl:q] and [#sec:m] and [#nope].",
    "",
    "[screenshot: Cap | #fig:setup]",
    "",
    "[table: T | #tbl:q]",
    "",
    "| a |",
    "|---|",
    "| 1 |",
    "",
    "## Methods {#sec:m}",
  ].join("\n");

  it("resolves figures, tables, and headings; ?? for the missing", () => {
    const { content } = r(DOC);
    const refs = [...content.querySelectorAll("a.xref")];
    expect(refs.map((a) => a.textContent)).toEqual([
      "Figure\u00A01",
      "Table\u00A01",
      "Methods",
      "??",
    ]);
    expect(refs.map((a) => a.classList.contains("xref-missing"))).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(refs.every((a) => a.getAttribute("contenteditable") === "false")).toBe(true);
  });
  it("a numbered heading resolves to Section n", () => {
    const { content } = r(DOC, { numbered: true });
    const refs = [...content.querySelectorAll("a.xref")];
    expect(refs[2].textContent).toBe("Section\u00A01");
  });
  it("an unnumbered heading target falls back to its text", () => {
    const { content } = r("go to [#sec:m]\n\n## The Long Way {#sec:m}");
    expect(content.querySelector("a.xref")?.textContent).toBe("The Long Way");
  });
});
