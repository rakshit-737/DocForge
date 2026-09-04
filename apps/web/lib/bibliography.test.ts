/* Where imported references land, and what the reader is told about them. */
import { describe, expect, it } from "vitest";
import { citedKeys, definedKeys, importReport, mergeDefinitions } from "./bibliography";

const DEFS = "[@one]: One, A. (2020). *First*.\n[@two]: Two, B. (2021). *Second*.";

describe("definedKeys / citedKeys", () => {
  const src = [
    "# Paper",
    "",
    "As shown in [@one] and [@two, p. 4], and also [@three].",
    "",
    "[@one]: One, A. (2020). *First*.",
  ].join("\n");

  it("reads the definitions", () => {
    expect([...definedKeys(src)]).toEqual(["one"]);
  });

  it("reads the calls, locator and all, and never counts a definition as one", () => {
    expect([...citedKeys(src)].sort()).toEqual(["one", "three", "two"]);
  });
});

describe("mergeDefinitions", () => {
  it("appends to a document that has no reference list marker", () => {
    const out = mergeDefinitions("# Paper\n\nText citing [@one].\n", DEFS);
    expect(out.added).toEqual(["one", "two"]);
    expect(out.skipped).toEqual([]);
    expect(out.source).toBe(
      "# Paper\n\nText citing [@one].\n\n[@one]: One, A. (2020). *First*.\n[@two]: Two, B. (2021). *Second*.\n",
    );
  });

  it("puts them before [references] when the document places the list", () => {
    const src = "# Paper\n\nText.\n\n[references]\n";
    const out = mergeDefinitions(src, DEFS);
    const lines = out.source.split("\n");
    const refIdx = lines.findIndex((l) => l === "[references]");
    const oneIdx = lines.findIndex((l) => l.startsWith("[@one]:"));
    expect(oneIdx).toBeGreaterThan(-1);
    expect(oneIdx).toBeLessThan(refIdx);
  });

  it("never re-adds or overwrites a key the document already defines", () => {
    const src = "# Paper\n\n[@one]: One, A. (2020). *Edited by hand*.\n";
    const out = mergeDefinitions(src, DEFS);
    expect(out.added).toEqual(["two"]);
    expect(out.skipped).toEqual(["one"]);
    expect(out.source).toContain("*Edited by hand*");
    expect(out.source.match(/^\[@one\]:/gm)).toHaveLength(1);
  });

  it("changes nothing when every key is already there", () => {
    const src = `# Paper\n\n${DEFS}\n`;
    const out = mergeDefinitions(src, DEFS);
    expect(out.added).toEqual([]);
    expect(out.source).toBe(src);
  });

  it("ignores lines that are not definitions", () => {
    const out = mergeDefinitions("# Paper\n", "not a definition\n[@one]: One, A.");
    expect(out.added).toEqual(["one"]);
    expect(out.source).not.toContain("not a definition");
  });
});

describe("importReport", () => {
  it("counts what landed and warns when nothing cites it", () => {
    const src = "# Paper\n\nNo citations here.\n";
    const merged = mergeDefinitions(src, DEFS);
    expect(importReport(merged, merged.source)).toBe(
      "2 references added · none cited yet — write [@key] where you need them",
    );
  });

  it("names the ones still uncited when some are used", () => {
    const src = "# Paper\n\nText citing [@one].\n";
    const merged = mergeDefinitions(src, DEFS);
    expect(importReport(merged, merged.source)).toBe("2 references added · 1 not cited yet");
  });

  it("reports duplicates that were left alone", () => {
    const src = `# Paper\n\nText citing [@one] and [@two].\n\n[@one]: One, A.\n`;
    const merged = mergeDefinitions(src, DEFS);
    expect(importReport(merged, merged.source)).toBe("1 reference added · 1 already defined");
  });
});
