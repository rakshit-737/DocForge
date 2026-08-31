/* ============================================================
   Citations (numeric + APA + locators + missing + references list)
   and footnotes through the full render().
   ============================================================ */
import { describe, expect, it } from "vitest";
import { r } from "./_helpers.js";

const DEFS = "\n\n[@alpha]: Alpha, A. (2001). Alpha title.\n[@beta]: Beta, B. (2002). Beta title.";

describe("numeric citations (default style)", () => {
  it("numbers assign in first-appearance order and repeat", () => {
    const { content } = r("One [@beta]. Two [@alpha]. Again [@beta]." + DEFS);
    const spans = [...content.querySelectorAll("span.cite")];
    expect(spans.map((s) => s.textContent)).toEqual(["[1]", "[2]", "[1]"]);
    expect(spans.every((s) => s.getAttribute("contenteditable") === "false")).toBe(true);
  });
  it("locators ride inside the bracket", () => {
    const { content } = r("See [@alpha, p. 33]." + DEFS);
    expect(content.querySelector("span.cite")?.textContent).toBe("[1, p. 33]");
  });
  it("the references list is auto-appended in citation order, labels baked in", () => {
    const { content } = r("One [@beta]. Two [@alpha]." + DEFS);
    const refs = content.querySelector("section.refs") as HTMLElement;
    expect(refs).toBe(content.lastElementChild);
    expect(refs.getAttribute("contenteditable")).toBe("false");
    expect(refs.querySelector(".refs-title")?.textContent).toBe("References");
    const ps = [...refs.querySelectorAll("p.ref")];
    expect(ps.map((p) => p.textContent)).toEqual([
      "[1] Beta, B. (2002). Beta title.",
      "[2] Alpha, A. (2001). Alpha title.",
    ]);
    expect(ps[0].querySelector("span.ref-n")?.textContent).toBe("[1]");
  });
  it("[references] places the list where the marker sits", () => {
    const { content } = r("One [@alpha].\n\n[references]\n\nAfter." + DEFS);
    const refs = content.querySelector("section.refs") as HTMLElement;
    expect(refs).toBeTruthy();
    expect(content.querySelector("div[data-refs]")).toBeNull();
    // the marker sat before the closing paragraph, so refs are not last
    expect(refs.nextElementSibling?.textContent).toBe("After.");
  });
  it("an empty [references] marker with no citations is removed", () => {
    const { content } = r("No citations here.\n\n[references]");
    expect(content.querySelector("section.refs")).toBeNull();
    expect(content.querySelector("div[data-refs]")).toBeNull();
  });
});

describe("missing citations fail loudly and locally", () => {
  it("prints the key with a question mark", () => {
    const { content } = r("Ghost [@nonexistent].");
    const s = content.querySelector("span.cite") as HTMLElement;
    expect(s.textContent).toBe("[@nonexistent?]");
    expect(s.classList.contains("cite-missing")).toBe(true);
    expect(content.querySelector("section.refs")).toBeNull();
  });
});

describe("APA style", () => {
  it("labels are author-year; references sort alphabetically without numbers", () => {
    const { content } = r("One [@beta]. Two [@alpha]." + DEFS, { citeStyle: "apa" });
    const spans = [...content.querySelectorAll("span.cite")];
    expect(spans.map((s) => s.textContent)).toEqual(["(Beta, 2002)", "(Alpha, 2001)"]);
    const ps = [...content.querySelectorAll("section.refs p.ref")];
    expect(ps.map((p) => p.textContent)).toEqual([
      "Alpha, A. (2001). Alpha title.",
      "Beta, B. (2002). Beta title.",
    ]);
    expect(content.querySelector("span.ref-n")).toBeNull();
  });
  it("locators append inside the parenthesis; n.d. covers yearless entries", () => {
    const { content } = r(
      "See [@alpha, p. 9]. And [@nodate].\n\n[@alpha]: Alpha, A. (2001). Alpha title.\n[@nodate]: Nameless, N. Untitled.",
      { citeStyle: "apa" },
    );
    const spans = [...content.querySelectorAll("span.cite")];
    expect(spans[0].textContent).toBe("(Alpha, 2001, p. 9)");
    expect(spans[1].textContent).toBe("(Nameless, n.d.)");
  });
});

/* citeStyle "apa7" — the issue #10 interim fix. Suffixes are assigned in the
   order the entries stand in the rendered references list (its alphabetical
   sort), and "apa" deliberately keeps the classic non-disambiguating output. */
describe("APA 7 disambiguation (citeStyle: apa7)", () => {
  const SMITH2 =
    "One [@sa]. Two [@sb]." +
    "\n\n[@sa]: Smith, J. (2020). Alpha work.\n[@sb]: Smith, J. (2020). Beta work.";
  const SMITH3 =
    "One [@sa]. Two [@sb]. Three [@sc]." +
    "\n\n[@sa]: Smith, J. (2020). Alpha work.\n[@sb]: Smith, J. (2020). Beta work.\n[@sc]: Smith, J. (2020). Gamma work.";
  const OTHERS =
    "One [@sm]. Two [@jn]." +
    "\n\n[@sm]: Smith, J. (2020). Smith work.\n[@jn]: Jones, K. (2020). Jones work.";

  const labelsOf = (md: string, citeStyle: string): (string | null)[] => {
    const { content } = r(md, { citeStyle });
    return [...content.querySelectorAll("span.cite")].map((s) => s.textContent);
  };
  const refsOf = (md: string, citeStyle: string): (string | null)[] => {
    const { content } = r(md, { citeStyle });
    return [...content.querySelectorAll("section.refs p.ref")].map((p) => p.textContent);
  };

  it.each<[string, string, string, string[]]>([
    [
      "two same-author same-year entries take a/b",
      SMITH2,
      "apa7",
      ["(Smith, 2020a)", "(Smith, 2020b)"],
    ],
    [
      "the classic bug stays pinned: apa never disambiguates",
      SMITH2,
      "apa",
      ["(Smith, 2020)", "(Smith, 2020)"],
    ],
    [
      "a three-way collision reaches c",
      SMITH3,
      "apa7",
      ["(Smith, 2020a)", "(Smith, 2020b)", "(Smith, 2020c)"],
    ],
    [
      "different authors in the same year take no suffix",
      OTHERS,
      "apa7",
      ["(Smith, 2020)", "(Jones, 2020)"],
    ],
  ])("%s", (_name, md, citeStyle, labels) => {
    expect(labelsOf(md, citeStyle)).toEqual(labels);
  });

  it.each<[string, string, string, string[]]>([
    [
      "suffixes land in the references entries too, in list order",
      SMITH2,
      "apa7",
      ["Smith, J. (2020a). Alpha work.", "Smith, J. (2020b). Beta work."],
    ],
    [
      "apa keeps the references unsuffixed — the classic output",
      SMITH2,
      "apa",
      ["Smith, J. (2020). Alpha work.", "Smith, J. (2020). Beta work."],
    ],
  ])("%s", (_name, md, citeStyle, entries) => {
    expect(refsOf(md, citeStyle)).toEqual(entries);
  });

  it("assignment follows the references list, not first citation", () => {
    // Beta is cited first, but the list reads Alpha (a) above Beta (b).
    const flipped =
      "First [@sb], then [@sa]." +
      "\n\n[@sa]: Smith, J. (2020). Alpha work.\n[@sb]: Smith, J. (2020). Beta work.";
    expect(labelsOf(flipped, "apa7")).toEqual(["(Smith, 2020b)", "(Smith, 2020a)"]);
    expect(refsOf(flipped, "apa7")).toEqual([
      "Smith, J. (2020a). Alpha work.",
      "Smith, J. (2020b). Beta work.",
    ]);
  });

  it("locators ride after the suffix", () => {
    const md =
      "See [@sa, p. 4] and [@sb]." +
      "\n\n[@sa]: Smith, J. (2020). Alpha work.\n[@sb]: Smith, J. (2020). Beta work.";
    expect(labelsOf(md, "apa7")[0]).toBe("(Smith, 2020a, p. 4)");
  });
});

describe("footnotes", () => {
  it("the call site carries the note inline, markdown parsed", () => {
    const { content } = r("A claim.[^1] More.\n\n[^1]: The note *text*.");
    const fn = content.querySelector("span.footnote") as HTMLElement;
    expect(fn.dataset.fn).toBe("1");
    expect(fn.getAttribute("contenteditable")).toBe("false");
    expect(fn.textContent).toBe("The note text.");
    expect(fn.querySelector("em")?.textContent).toBe("text");
    // no number is ever written into the DOM — CSS counters and Word both count for themselves
    expect(fn.textContent).not.toMatch(/^\d/);
  });
  it("multiple calls to the same note repeat the text at each call site", () => {
    const { content } = r("First[^n] and second[^n].\n\n[^n]: shared");
    const fns = [...content.querySelectorAll("span.footnote")];
    expect(fns.length).toBe(2);
    expect(fns.map((f) => f.textContent)).toEqual(["shared", "shared"]);
  });
  it("a dangling call stays literal text", () => {
    const { content } = r("A dangling call [^99] stays.");
    expect(content.querySelector("span.footnote")).toBeNull();
    expect(content.textContent).toContain("[^99]");
  });
});
