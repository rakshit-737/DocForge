/* Every rule of the ported structure linter, one by one. lintDocument is pure,
   so these run in plain node — which also pins the classic no-canvas fallback:
   without a canvas every font counts as installed and the font rules stay
   quiet. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { lintDocument, lintSettingsFonts, runLint, useLintStore } from "./lint";

const msgs = (src: string) => lintDocument(src).map((w) => w.message);
const find = (src: string, re: RegExp) => lintDocument(src).find((w) => re.test(w.message));

describe("lintDocument — clean manuscripts", () => {
  it("returns nothing for a well-formed document", () => {
    const src = [
      "# Title",
      "",
      "Body text with a note[^1] and a citation [@doe2020].",
      "",
      "See [#sec:method] and [#fig:setup].",
      "",
      "## Method {#sec:method}",
      "",
      "[screenshot: The rig | #fig:setup]",
      "",
      "```",
      "##### not a heading, just code",
      "```",
      "",
      "[^1]: The note.",
      "[@doe2020]: Doe, *Things*, 2020.",
    ].join("\n");
    expect(lintDocument(src)).toEqual([]);
  });

  it("returns nothing for the empty document", () => {
    expect(lintDocument("")).toEqual([]);
  });
});

describe("headings", () => {
  it("flags heading level 5+", () => {
    const w = find("# ok\n##### too deep", /Heading level 5\+/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(2);
    expect(w?.severity).toBe("warning");
  });

  it("leaves #### alone", () => {
    expect(msgs("#### fine")).toEqual([]);
  });
});

describe("raw HTML", () => {
  it("flags an unknown opening tag", () => {
    const w = find('hello\n<div class="x">', /Raw HTML/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(2);
  });

  it("allows the inline whitelist and closing tags", () => {
    expect(msgs("<b>bold</b>\n<em>em</em>\n<br>\n</div>")).toEqual([]);
  });
});

describe("tables", () => {
  it("flags a ragged row against the row above", () => {
    const src = "| a | b |\n| - | - |\n| 1 | 2 | 3 |";
    const w = find(src, /different number of cells/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(3);
  });

  it("accepts a consistent table (escaped pipes not counted)", () => {
    expect(msgs("| a | b |\n| - | - |\n| x \\| y | 2 |")).toEqual([]);
  });
});

describe("fences and callouts", () => {
  it("flags an unclosed code fence at the last line", () => {
    const w = find("text\n```js\ncode", /Unclosed code fence/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(3);
    expect(w?.severity).toBe("error");
  });

  it("closes ``` fences only with a fence at least as long, same character", () => {
    expect(msgs("````\ncode\n```")).toHaveLength(1); // still open
    expect(msgs("```\ncode\n````")).toEqual([]); // longer closes
    expect(msgs("~~~\ncode\n~~~")).toEqual([]);
  });

  it("suppresses every other rule inside a fence", () => {
    expect(msgs("```\n##### deep\n<div>\n[^ghost]\n```")).toEqual([]);
  });

  it("flags an unclosed callout at its opening line", () => {
    const w = find("ok\n:::note Heads up\ntext", /Unclosed callout/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(2);
  });

  it("accepts a closed callout, even nested", () => {
    expect(msgs(":::note\n:::center\nx\n:::\n:::")).toEqual([]);
  });
});

describe("footnotes", () => {
  it("flags a reference with no definition", () => {
    const w = find("A claim[^9].", /\[\^9\] has no definition line/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(1);
    expect(w?.severity).toBe("error");
  });

  it("is satisfied by a definition anywhere in the document", () => {
    expect(msgs("A claim[^9].\n\n[^9]: Proof.")).toEqual([]);
  });

  it("ignores references shown in inline code", () => {
    expect(msgs("Write `[^1]` to call a note.")).toEqual([]);
  });

  it("flags a definition that is never referenced", () => {
    const w = find("Body.\n\n[^lost]: Orphan note.", /\[\^lost\] is defined but never referenced/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(3);
    expect(w?.severity).toBe("warning");
  });

  it("flags a duplicated definition at the overwriting line", () => {
    const src = "Note[^1].\n\n[^1]: First.\n[^1]: Second.";
    const w = find(src, /\[\^1\] is defined 2 times/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(4);
    expect(w?.severity).toBe("error");
  });

  it("still sees references written inside a definition's text", () => {
    const w = find("[^1]: See also [^2].\n\nNote[^1].", /\[\^2\] has no definition/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(1);
  });
});

describe("citations", () => {
  it("flags a citation with no entry, locators included", () => {
    const w = find("As shown [@smith99, p. 3].", /\[@smith99\] has no entry/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(1);
    expect(w?.severity).toBe("error");
  });

  it("is satisfied by an entry anywhere in the document", () => {
    expect(msgs("As shown [@smith99].\n\n[@smith99]: Smith, 1999.")).toEqual([]);
  });

  it("flags an entry that is never cited", () => {
    const w = find("Body.\n\n[@idle]: Idle, 2001.", /\[@idle\] has an entry but is never cited/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(3);
    expect(w?.severity).toBe("warning");
  });

  it("flags duplicated entries at the overwriting line", () => {
    const src = "Cite [@k].\n\n[@k]: One.\n[@k]: Two.";
    const w = find(src, /\[@k\] has 2 entries/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(4);
  });
});

describe("cross-references", () => {
  it("flags a reference with no target", () => {
    const w = find("See [#nowhere].", /\[#nowhere\] has no target/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(1);
    expect(w?.severity).toBe("error");
  });

  it("resolves explicit heading labels", () => {
    expect(msgs("See [#sec:m].\n\n## Method {#sec:m}")).toEqual([]);
  });

  it("resolves heading slugs, engine-style", () => {
    expect(msgs("See [#deep-results].\n\n## Deep Results")).toEqual([]);
  });

  it("dedupes repeated slugs the way the renderer does", () => {
    expect(msgs("## Intro\n\n## Intro\n\nSee [#intro] and [#intro-1].")).toEqual([]);
  });

  it("resolves figure and table marker ids", () => {
    const src =
      "[screenshot: The rig | #fig:x]\n\n[table: Results | #tbl:y]\n\nSee [#fig:x] and [#tbl:y].";
    expect(msgs(src)).toEqual([]);
  });

  it("ignores references shown in inline code", () => {
    expect(msgs("Write `[#fig:x]` to point at a figure.")).toEqual([]);
  });
});

describe("duplicate labels", () => {
  it("flags a label declared twice, at the ignored occurrence", () => {
    const src = "## A {#dup}\n\n## B {#dup}\n\nSee [#dup].";
    const w = find(src, /Duplicate label #dup/);
    expect(w).toBeDefined();
    expect(w?.line).toBe(3);
    expect(w?.severity).toBe("error");
  });

  it("catches a heading label colliding with a figure id", () => {
    const src = "## A {#x}\n\n[screenshot: rig | #x]\n\nSee [#x].";
    expect(find(src, /Duplicate label #x/)).toBeDefined();
  });
});

describe("fonts (no canvas here — the classic fallback treats every face as installed)", () => {
  it("stays quiet on inline font= in node", () => {
    expect(msgs('Some ==text== font="No Such Face" here.')).toEqual([]);
  });

  it("lintSettingsFonts ignores non-sys settings", () => {
    expect(lintSettingsFonts({ fontHead: "theme", fontBody: "theme" })).toEqual([]);
    expect(lintSettingsFonts({ fontHead: "sys:Arial", fontBody: "sys:Georgia" })).toEqual([]); // no canvas → installed
  });
});

describe("report shape", () => {
  it("sorts warnings by line", () => {
    const src = "See [#nowhere].\n\n##### deep\n\nNote[^ghost].";
    const linesOut = lintDocument(src).map((w) => w.line);
    expect(linesOut).toEqual([...linesOut].sort((a, b) => (a ?? 1e9) - (b ?? 1e9)));
    expect(linesOut).toEqual([1, 3, 5]);
  });
});

describe("the shipped templates", () => {
  it("lint clean — otherwise the badge lights up at boot", async () => {
    const { resolveTemplate, TEMPLATES } = await import("./templates");
    for (const id of Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>) {
      const t = resolveTemplate(id);
      expect(lintDocument(t.source), `template "${String(id)}"`).toEqual([]);
    }
  });
});

describe("runLint — the 600ms debounce into the store", () => {
  afterEach(() => {
    vi.useRealTimers();
    useLintStore.getState().setWarnings([]);
  });

  it("publishes only after the delay", () => {
    vi.useFakeTimers();
    runLint("##### deep");
    vi.advanceTimersByTime(599);
    expect(useLintStore.getState().warnings).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(useLintStore.getState().warnings).toHaveLength(1);
    expect(useLintStore.getState().warnings[0].message).toMatch(/Heading level 5\+/);
  });

  it("restarts the clock on every keystroke and keeps only the last source", () => {
    vi.useFakeTimers();
    runLint("##### deep");
    vi.advanceTimersByTime(400);
    runLint("# fine now");
    vi.advanceTimersByTime(400);
    expect(useLintStore.getState().warnings).toEqual([]); // first run cancelled
    vi.advanceTimersByTime(200);
    expect(useLintStore.getState().warnings).toEqual([]); // and the last source is clean
  });

  it("clears stale warnings when the manuscript is fixed", () => {
    vi.useFakeTimers();
    useLintStore.getState().setWarnings([{ severity: "warning", message: "stale" }]);
    runLint("# fine", 0);
    vi.advanceTimersByTime(0);
    expect(useLintStore.getState().warnings).toEqual([]);
  });
});
