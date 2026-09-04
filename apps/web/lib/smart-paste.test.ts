/* The paste rules earn their keep by REFUSING most of what arrives: an
   ordinary paste has to land exactly as it came, or the editor is rewriting
   people's work behind their backs. So the refusals are tested harder than
   the conversions. */
import { describe, expect, it } from "vitest";
import { linkAround, tableFromTsv } from "./smart-paste";

describe("tableFromTsv", () => {
  it("turns a spreadsheet range into a dialect table", () => {
    expect(tableFromTsv("Specimen\tLoad\tNotes\nA-1\t12.4\tclean break\nA-2\t9.8\tslip")).toBe(
      [
        "| Specimen | Load | Notes |",
        "| --- | --- | --- |",
        "| A-1 | 12.4 | clean break |",
        "| A-2 | 9.8 | slip |",
        "",
      ].join("\n"),
    );
  });

  it("survives the clipboard's line endings and a trailing newline", () => {
    const out = tableFromTsv("a\tb\r\nc\td\r\n");
    expect(out).toBe(["| a | b |", "| --- | --- |", "| c | d |", ""].join("\n"));
  });

  it("keeps empty cells rather than closing the gap", () => {
    expect(tableFromTsv("a\tb\n\td")).toContain("|  | d |");
  });

  it("escapes a pipe inside a cell so the row still has its shape", () => {
    expect(tableFromTsv("a\tb\nx | y\tz")).toContain("| x \\| y | z |");
  });

  it("leaves ordinary text alone", () => {
    for (const plain of [
      "",
      "just a sentence",
      "one\ntwo\nthree",
      "Dear Marrow,\n\nThe results are in.",
      "a, b, c\nd, e, f", // commas are prose as often as columns
    ]) {
      expect(tableFromTsv(plain)).toBeNull();
    }
  });

  it("refuses a ragged block — that is indentation, not a range", () => {
    expect(tableFromTsv("a\tb\tc\nd\te")).toBeNull();
  });

  it("refuses a single row, a single column, and an absurd width", () => {
    expect(tableFromTsv("a\tb")).toBeNull();
    expect(tableFromTsv("a\nb")).toBeNull();
    expect(
      tableFromTsv(`${Array(30).fill("x").join("\t")}\n${Array(30).fill("y").join("\t")}`),
    ).toBeNull();
  });

  it("refuses a block whose cells are paragraphs — those tabs were layout", () => {
    const long = "x".repeat(250);
    expect(tableFromTsv(`head\tother\n${long}\tb`)).toBeNull();
  });
});

describe("linkAround", () => {
  it("wraps the selection in the pasted URL", () => {
    expect(linkAround("https://example.com/a?b=1", "the study")).toBe(
      "[the study](https://example.com/a?b=1)",
    );
    expect(linkAround("mailto:e@marrow.test", "write to me")).toBe(
      "[write to me](mailto:e@marrow.test)",
    );
  });

  it("escapes brackets in the label", () => {
    expect(linkAround("https://x.test", "see [1]")).toBe("[see \\[1\\]](https://x.test)");
  });

  it("does nothing without a selection — a pasted URL is already a URL", () => {
    expect(linkAround("https://x.test", "")).toBeNull();
    expect(linkAround("https://x.test", "   ")).toBeNull();
  });

  it("does nothing when the paste is not a bare URL", () => {
    for (const notUrl of [
      "read https://x.test for more",
      "example.com",
      "https://x.test and more text",
      "",
      "javascript:alert(1)",
      "data:text/html,<b>hi",
      "file:///etc/passwd",
    ]) {
      expect(linkAround(notUrl, "the study")).toBeNull();
    }
  });

  it("will not overwrite a URL the reader had selected", () => {
    expect(linkAround("https://new.test", "https://old.test")).toBeNull();
  });

  it("will not use a selection that spans blocks as a label", () => {
    expect(linkAround("https://x.test", "one\ntwo")).toBeNull();
  });
});
