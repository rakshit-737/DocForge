/* Landscape (§8.2). One question decides everything downstream: which sheet
   is this document printed on? pageSpec answers it once, and the CSS, the
   margin boxes, the watermark's diagonal and the .docx's tab stops all take
   their measurements from that answer — so the two formats cannot end up
   holding the paper different ways up. */
import { describe, expect, it } from "vitest";
import { dynamicCss, PAGES, pageSpec, watermarkMetrics } from "../src/themes";
import type { Settings } from "../src/types";

const BASE = {
  theme: "modern",
  accent: "#2458c5",
  page: "A4",
  margins: "normal",
  header: true,
  pageNums: true,
  title: "Fracture Mechanics",
} as unknown as Settings;

describe("pageSpec", () => {
  it("returns the named sheet untouched in portrait", () => {
    expect(pageSpec({ page: "A4" })).toBe(PAGES.A4);
    expect(pageSpec({ page: "Letter", orientation: "portrait" })).toBe(PAGES.Letter);
    expect(pageSpec({})).toBe(PAGES.A4);
  });

  it("swaps the sheet in landscape, and says so in the CSS name", () => {
    expect(pageSpec({ page: "A4", orientation: "landscape" })).toEqual({
      w: 297,
      h: 210,
      label: "A4 landscape",
    });
    expect(pageSpec({ page: "Letter", orientation: "LANDSCAPE" })).toEqual({
      w: 279.4,
      h: 215.9,
      label: "Letter landscape",
    });
  });

  it("treats anything else as portrait rather than guessing", () => {
    for (const odd of ["", "sideways", null, undefined, 1]) {
      expect(pageSpec({ page: "A4", orientation: odd })).toBe(PAGES.A4);
    }
  });
});

describe("the CSS", () => {
  it("is byte-for-byte the old CSS when the document is upright", () => {
    expect(dynamicCss({ ...BASE, orientation: "portrait" })).toBe(dynamicCss(BASE));
  });

  it("asks the printer for a landscape sheet and swaps the page variables", () => {
    const css = dynamicCss({ ...BASE, orientation: "landscape" });
    expect(css).toContain("size: A4 landscape;");
    expect(css).toContain("--page-w:297mm");
    expect(css).toContain("--page-h:210mm");
  });

  it("measures the watermark on the sheet the document really has", () => {
    /* A landscape A4 has the same diagonal as a portrait one, so the mark is
       the same size — but the CSS anchors it at half the page HEIGHT, which
       is not the same number, and that is the bug this pins down. */
    const css = dynamicCss({ ...BASE, orientation: "landscape", watermark: "DRAFT" });
    expect(css).toContain("top: 105mm");
    expect(css).toContain("width: 297mm");
    expect(css).toContain(
      `font-size: ${watermarkMetrics("DRAFT", pageSpec({ page: "A4", orientation: "landscape" })).sizePt}pt`,
    );
  });
});
