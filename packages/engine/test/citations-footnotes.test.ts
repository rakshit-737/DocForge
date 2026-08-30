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
