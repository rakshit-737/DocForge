/* What the manuscript amounts to. The judgement under test is what counts as
   prose: the dialect's furniture is not, and a writer asking "how much have I
   written" does not mean the citation list. */
import { describe, expect, it } from "vitest";
import { documentStats, goalLabel, goalProgress, shortStats } from "./doc-stats";

describe("documentStats — words", () => {
  it("counts plain prose", () => {
    expect(documentStats("One two three four.").words).toBe(4);
  });

  it("does not count a heading's hashes as words", () => {
    expect(documentStats("## Method\n\nOne two.").words).toBe(3);
  });

  it("leaves the marks out of the words they wrap", () => {
    expect(documentStats("**bold** and *italic* and `code`").words).toBe(5);
  });

  it("keeps a link's text and drops its target", () => {
    expect(documentStats("See [the paper](https://example.com/x) now.").words).toBe(4);
  });

  it("does not count code inside a fence", () => {
    const src = "Words here.\n\n```python\nfor i in range(100):\n    print(i)\n```\n\nMore words.";
    expect(documentStats(src).words).toBe(4);
  });

  it("does not count furniture, captions or apparatus", () => {
    const src = [
      "# Title",
      "",
      "[toc]",
      "",
      "Real prose here.",
      "",
      "[screenshot: A caption nobody wrote as prose]",
      "",
      "[references]",
      "",
      "[@doe2020]: Doe, J. (2020). A Long Bibliographic Entry With Many Words.",
      "[^1]: A footnote's text.",
    ].join("\n");
    expect(documentStats(src).words).toBe(4); // "Title" + "Real prose here"
  });

  it("counts an equation as one word rather than as its LaTeX", () => {
    expect(documentStats("The result $E = mc^2$ holds.").words).toBe(4);
  });

  it("survives an unterminated fence without eating the document", () => {
    expect(documentStats("Before.\n\n```\nunclosed").words).toBe(1);
  });
});

describe("documentStats — the furniture it counts on purpose", () => {
  const src = [
    "# Title",
    "",
    "## Method",
    "",
    "Prose with a citation [@doe2020] and a note[^1].",
    "",
    "[screenshot: The rig]",
    "",
    "| A | B |",
    "| --- | --- |",
    "| 1 | 2 |",
    "",
    "$$",
    "E = mc^2",
    "$$",
    "",
    "[^1]: The note.",
    "[@doe2020]: Doe, J. (2020).",
  ].join("\n");
  const s = documentStats(src);

  it("counts headings, figures, tables and equations", () => {
    expect(s.headings).toBe(2);
    expect(s.figures).toBe(1);
    expect(s.tables).toBe(1);
    expect(s.equations).toBe(1);
  });

  it("counts footnote definitions and distinct cited keys", () => {
    expect(s.footnotes).toBe(1);
    expect(s.citations).toBe(1);
  });

  it("reports a reading time, and none for an empty document", () => {
    expect(s.readingMinutes).toBe(1);
    expect(documentStats("").readingMinutes).toBe(0);
    expect(documentStats(`${"word ".repeat(600)}`).readingMinutes).toBe(3);
  });
});

describe("shortStats", () => {
  it("says what the footer says", () => {
    expect(shortStats(documentStats("one two three"))).toBe("3 words · 1 min read");
  });

  it("says so plainly when there is nothing yet", () => {
    expect(shortStats(documentStats("   "))).toBe("no words yet");
  });
});

describe("goalProgress / goalLabel", () => {
  it("measures from where the goal was set", () => {
    const p = goalProgress(320, 200, 300);
    expect(p.written).toBe(120);
    expect(p.fraction).toBeCloseTo(0.4);
    expect(p.done).toBe(false);
    expect(goalLabel(p)).toBe("120 of 300 words");
  });

  it("celebrates once, and never scolds", () => {
    const p = goalProgress(700, 200, 300);
    expect(p.done).toBe(true);
    expect(p.fraction).toBe(1);
    expect(goalLabel(p)).toBe("500 of 300 — goal met");
  });

  it("does not go negative when the writer cuts below the start", () => {
    const p = goalProgress(100, 200, 300);
    expect(p.written).toBe(0);
    expect(p.fraction).toBe(0);
  });
});
