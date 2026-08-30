/* ============================================================
   micro-typography — smartText rules and the NO_SMART DOM guard.
   Every expected value is the ACTUAL output of src/js/engine.js
   (captured via a Node harness on 2026-08-30). \u00A0 escapes are
   real no-break spaces in the contract.
   ============================================================ */
import { describe, expect, it } from "vitest";
import { smartText } from "../src/render.js";
import { body, norm } from "./_helpers.js";

const TABLE: [string, string][] = [
  ["...", "…"],
  ["wait... what", "wait… what"],
  ["a---b", "a—b"],
  ["a --- b", "a — b"],
  ["a--b", "a–b"],
  ["a -- b", "a – b"],
  ["1990-2020", "1990–2020"],
  ["pages 14-18", "pages 14–18"],
  ["9-5 day", "9–5 day"],
  ["2024-03-14", "2024-03–14"],
  ["the 2024-03-14 baseline", "the 2024-03–14 baseline"],
  ["12-13-14", "12–13–14"],
  ["1-2", "1–2"],
  ["-1-2", "-1–2"],
  ['"a quoted phrase"', "“a quoted phrase”"],
  ["'a nested term'", "‘a nested term’"],
  ["don't", "don’t"],
  ["it's", "it’s"],
  ["the survey's head", "the survey’s head"],
  ['("parenthetical")', "(“parenthetical”)"],
  ["{'braced'}", "{‘braced’}"],
  ['after—"dash quote"', "after—“dash quote”"],
  ['["bracketed"]', "[“bracketed”]"],
  ["Figure 3", "Figure\u00A03"],
  ["Figures 12", "Figures\u00A012"],
  ["Table 2", "Table\u00A02"],
  ["Section 4 holds", "Section\u00A04 holds"],
  ["Eq. 7", "Eq\u00A07"],
  ["Fig. 2", "Fig\u00A02"],
  ["Chapter 9", "Chapter\u00A09"],
  ["Note 5", "Note\u00A05"],
  ["No. 12", "No\u00A012"],
  ["Steps 3", "Steps\u00A03"],
  ["Part 2", "Part\u00A02"],
  ["Volume 1", "Volume\u00A01"],
  ["Appendix (a)", "Appendix\u00A0(a)"],
  ["Figure (3)", "Figure\u00A0(3)"],
  ["10 kg", "10\u00A0kg"],
  ["25 mm", "25\u00A0mm"],
  ["250 ms", "250\u00A0ms"],
  ["60 %", "60\u00A0%"],
  ["3 s", "3\u00A0s"],
  ["5 kWh", "5\u00A0kWh"],
  ["90 dpi", "90\u00A0dpi"],
  ["45 µm", "45\u00A0µm"],
  ["300 K", "300\u00A0K"],
  ["2 mol", "2\u00A0mol"],
  ["8 bit", "8\u00A0bit"],
  ["100 bps", "100\u00A0bps"],
  ["1 bar", "1\u00A0bar"],
  ["7 ml", "7\u00A0ml"],
  ["12 L", "12\u00A0L"],
  ["9 Pa", "9\u00A0Pa"],
  ["60 Hz", "60\u00A0Hz"],
  ["4 GHz", "4\u00A0GHz"],
  ["2 TB", "2\u00A0TB"],
  ["1 kB", "1\u00A0kB"],
  ["no unit 10 xx", "no unit 10 xx"],
  ["Figureless 3", "Figureless 3"],
  ["label Figure3", "label Figure3"],
  ["Figure  33", "Figure\u00A033"],
  ["Fig 4", "Fig\u00A04"],
  ["Nos 3 and 4", "Nos\u00A03 and 4"],
];

describe("smartText", () => {
  it.each(TABLE)("%s", (input, expected) => {
    expect(smartText(input)).toBe(expected);
  });

  it("BUG (preserved): the ISO-date guard only shields the FIRST hyphen", () => {
    // The 14-char window around the second hyphen no longer contains a full
    // \d{4}-\d{2}-\d{2} match, so "2024-03-14" prints "2024-03&ndash;14".
    // Frozen: the golden baseline carries this output; fixing it is a
    // deliberate post-parity change, not part of the port.
    expect(smartText("2024-03-14")).toBe("2024-03\u201314");
  });
});

describe("smart typography in the rendered DOM", () => {
  it("prose is corrected; code/pre/kbd are never touched", () => {
    expect(body('typed "straight" -- here')).toBe(
      norm("<p>typed \u201Cstraight\u201D \u2013 here</p>\n"),
    );
    expect(body('`"straight" -- stays`')).toBe(
      norm("<p><code>&quot;straight&quot; -- stays</code></p>\n"),
    );
    const fence = body(
      '```\n"straight quotes stay straight" -- stays doubled --- stays tripled\n1990-2020 stays hyphenated\n```',
    );
    expect(fence).toContain('"straight quotes stay straight" -- stays doubled --- stays tripled');
    expect(fence).toContain("1990-2020 stays hyphenated");
    expect(body("<kbd>ctrl--x</kbd> stays", {})).toContain("ctrl--x");
  });
  it("units and labels bind with no-break spaces in prose", () => {
    expect(body("weighs 10 kg at 60 %")).toBe(norm("<p>weighs 10\u00A0kg at 60\u00A0%</p>\n"));
    expect(body("see Figure 3 and Table 2")).toBe(
      norm("<p>see Figure\u00A03 and Table\u00A02</p>\n"),
    );
  });
  it("the ellipsis and dashes reach the page", () => {
    expect(body("wait... a --- b -- c")).toBe(norm("<p>wait\u2026 a \u2014 b \u2013 c</p>\n"));
  });
});
