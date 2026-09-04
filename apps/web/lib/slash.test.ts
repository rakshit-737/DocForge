/* Slash commands: what the menu offers, what each entry inserts, and where a
   slash is NOT a command. The CodeMirror wiring is driven by the live probe. */
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { parseGrid, SLASH_COMMANDS, slashAt, slashOptions, tableMarkdown } from "./slash";

const at = (doc: string, pos = doc.length) => slashAt(EditorState.create({ doc }), pos);
const cmd = (name: string) => SLASH_COMMANDS.find((c) => c.name === name)!;

describe("slashAt", () => {
  it("finds a slash that opens a line", () => {
    expect(at("/tab")).toEqual({ from: 0, query: "tab" });
  });

  it("allows leading whitespace (a list item, an indented block)", () => {
    expect(at("  /fig")).toEqual({ from: 2, query: "fig" });
  });

  it("ignores a slash inside a sentence — and/or, URLs, fractions", () => {
    expect(at("this and/or that")).toBe(null);
    expect(at("see https://example.com/table")).toBe(null);
    expect(at("1/2 cup")).toBe(null);
  });

  it("ignores a slash on a line that already has words before it", () => {
    expect(at("Text /table")).toBe(null);
  });

  it("reads only up to the caret", () => {
    const state = EditorState.create({ doc: "/table 3x4" });
    expect(slashAt(state, 3)).toEqual({ from: 0, query: "ta" });
  });

  it("works on the second line of a document", () => {
    expect(at("# Title\n/eq")).toEqual({ from: 8, query: "eq" });
  });
});

describe("slashOptions", () => {
  it("offers the whole roster for a bare slash", () => {
    expect(slashOptions("")).toHaveLength(SLASH_COMMANDS.length);
  });

  it("ranks an exact name first", () => {
    expect(slashOptions("table")[0]?.name).toBe("table");
    expect(slashOptions("toc")[0]?.name).toBe("toc");
  });

  it("matches on a prefix", () => {
    expect(slashOptions("cal")[0]?.name).toBe("callout");
  });

  it("finds an entry by the word a reader would actually use", () => {
    expect(slashOptions("screenshot")[0]?.name).toBe("figure");
    expect(slashOptions("math")[0]?.name).toBe("equation");
    expect(slashOptions("hr")[0]?.name).toBe("divider");
  });

  it("ignores the argument when ranking", () => {
    expect(slashOptions("table 3x4")[0]?.name).toBe("table");
  });

  it("returns nothing for a word no entry knows", () => {
    expect(slashOptions("zzzz")).toEqual([]);
  });
});

describe("parseGrid / tableMarkdown", () => {
  it("reads the shapes a reader types", () => {
    expect(parseGrid("3x4")).toEqual({ rows: 3, cols: 4 });
    expect(parseGrid(" 3 x 4 ")).toEqual({ rows: 3, cols: 4 });
    expect(parseGrid("2×5")).toEqual({ rows: 2, cols: 5 });
    expect(parseGrid("4")).toEqual({ rows: 4, cols: 3 });
    expect(parseGrid("")).toEqual({ rows: 2, cols: 3 });
  });

  it("builds a header row, a rule and the body rows", () => {
    const md = tableMarkdown(2, 3).split("\n");
    expect(md).toHaveLength(4); // header + rule + 2
    expect(md[0]).toBe("| Column | Column | Column |");
    expect(md[1]).toBe("| --- | --- | --- |");
    expect(md[2]).toBe("| Cell | Cell | Cell |");
  });

  it("refuses a runaway grid rather than freezing the desk", () => {
    expect(tableMarkdown(9999, 9999).split("\n")).toHaveLength(42); // 40 rows + header + rule
    expect(
      tableMarkdown(1, 99)
        .split("\n")[0]
        ?.match(/Column/g),
    ).toHaveLength(12);
  });
});

describe("what each entry inserts", () => {
  it("table honours the typed grid", () => {
    expect(cmd("table").build("3x2").text.split("\n")).toHaveLength(5);
  });

  it("callout takes the kind from the argument, and defaults to note", () => {
    expect(cmd("callout").build("warning").text.startsWith(":::warning")).toBe(true);
    expect(cmd("callout").build("").text.startsWith(":::note")).toBe(true);
    expect(cmd("callout").build("nonsense").text.startsWith(":::note")).toBe(true);
  });

  it("code takes the language, lower-cased", () => {
    expect(cmd("code").build("Python").text.startsWith("```python\n")).toBe(true);
    expect(cmd("code").build("").text.startsWith("```\n")).toBe(true);
  });

  it("citation writes the call AND its definition", () => {
    const { text } = cmd("citation").build("");
    expect(text).toContain("[@key]");
    expect(text).toContain("[@key]: ");
  });

  it("every entry inserts non-empty dialect and lands the caret inside it", () => {
    for (const c of SLASH_COMMANDS) {
      const built = c.build("");
      expect(built.text.length).toBeGreaterThan(0);
      expect(built.caret ?? 0).toBeLessThanOrEqual(built.text.length);
    }
  });
});
