/* ============================================================
   Watermark & letterhead (§8.2).

   Two rules matter more than the pixels. The first is that a document that
   asks for neither must emit exactly the CSS it always did — the running-head
   work already proved how easily a new margin box changes every document's
   bytes. The second is that the mark is measured ONCE, here, because the .docx
   stretches its VML shape into the box this function returns: if the two sides
   measured separately the same document would carry two different stamps.
   ============================================================ */
import { describe, expect, it } from "vitest";
import { dynamicCss, imageMetrics, PAGES, watermarkMetrics } from "../src/themes";
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

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("watermarkMetrics", () => {
  it("is empty for an empty setting, so nothing downstream draws", () => {
    for (const nothing of ["", "   ", null, undefined]) {
      expect(watermarkMetrics(nothing).text).toBe("");
    }
  });

  it("scales a long word down so it still fits the diagonal", () => {
    const draft = watermarkMetrics("DRAFT");
    const confidential = watermarkMetrics("CONFIDENTIAL");
    expect(confidential.sizePt).toBeLessThan(draft.sizePt);
    /* Both fill roughly the same span — that is the whole point of scaling. */
    expect(Math.abs(confidential.widthPt - draft.widthPt)).toBeLessThan(draft.widthPt * 0.5);
  });

  it("never grows past the cap or shrinks past the floor", () => {
    expect(watermarkMetrics("X").sizePt).toBeLessThanOrEqual(130);
    expect(watermarkMetrics("A".repeat(48)).sizePt).toBeGreaterThanOrEqual(20);
  });

  it("keeps a word inside the sheet it is stamped on", () => {
    for (const page of [PAGES.A4, PAGES.Letter]) {
      const diagonal = Math.hypot(page.w, page.h) * 2.834645669;
      for (const word of ["DRAFT", "CONFIDENTIAL", "DO NOT COPY", "X"]) {
        expect(watermarkMetrics(word, page).widthPt).toBeLessThan(diagonal);
      }
    }
  });

  it("tidies the word rather than trusting it", () => {
    expect(watermarkMetrics("  do   not  copy  ").text).toBe("do not copy");
    expect(watermarkMetrics("A".repeat(80)).text).toHaveLength(48);
  });
});

/* A real 480×120 PNG header, so the aspect maths is checked against a shape
   rather than a square. */
const WIDE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAeAAAAB4CAIAAACl9LZYAAAAvklEQVR4nO3BMQEAAADCoPVPbQdvoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4DejlgABTWqVEgAAAABJRU5ErkJggg==";

const JPEG_1x1 =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

describe("imageMetrics", () => {
  it("reads a PNG's own header", () => {
    expect(imageMetrics(PNG)).toEqual({ w: 1, h: 1 });
  });

  it("walks a JPEG's markers to the frame", () => {
    expect(imageMetrics(JPEG_1x1)).toEqual({ w: 1, h: 1 });
  });

  it("returns nothing rather than a guess, so neither format stretches a logo", () => {
    for (const bad of [
      "",
      null,
      "/logo.png",
      "data:text/html,<b>hi",
      "data:image/png;base64,AAAA",
      "data:image/tiff;base64,SUkqAA==",
    ]) {
      expect(imageMetrics(bad)).toBeNull();
    }
  });
});

describe("the CSS a document without either gets", () => {
  const css = dynamicCss(BASE);

  it("is untouched — no mark, no letterhead box", () => {
    expect(css).not.toContain("::before");
    expect(css).not.toContain("@top-center");
  });

  it("stays untouched when the settings are present but empty", () => {
    expect(dynamicCss({ ...BASE, watermark: "", letterhead: "" })).toBe(css);
  });
});

describe("the CSS a stamped document gets", () => {
  const css = dynamicCss({ ...BASE, watermark: "DRAFT" });

  it("sets the word diagonally across the page", () => {
    expect(css).toContain('content: "DRAFT"');
    expect(css).toContain("transform: translateY(-50%) rotate(-45deg)");
    /* Millimetres, not percentages: Paged.js computes a different page height
       in print than on screen, and a mark centred on that box drifts. */
    expect(css).toContain("top: 148.5mm");
    expect(css).toContain("width: 210mm");
    expect(css).toContain(`font-size: ${watermarkMetrics("DRAFT").sizePt}pt`);
  });

  it("draws it as text, not a background — printers drop backgrounds", () => {
    expect(css).toMatch(/\.pagedjs_page::before[^}]*color: rgba\(15, 23, 42, 0\.11\)/s);
    expect(css).not.toMatch(/\.pagedjs_page::before[^}]*background/s);
  });

  it("is set in ink the prose can be read through", () => {
    /* The mark rides OVER the page — a negative layer sinks behind the sheet's
       own background and vanishes — so the ink has to be translucent or it
       blots out every line it crosses. */
    expect(css).toMatch(/\.pagedjs_page::before[^}]*z-index: 4/s);
    expect(css).toContain("rgba(15, 23, 42, 0.11)");
  });

  it("leaves the cover to its own design, as the page border does", () => {
    expect(css).toContain(".pagedjs_page:has(.cover)::before { content: none; }");
  });

  it("cannot be broken out of by a quote in the word", () => {
    const hostile = dynamicCss({ ...BASE, watermark: 'DRAFT" } body { display:none } .x {' });
    expect(hostile).not.toContain('"DRAFT" }');
    expect(hostile).toContain('\\"');
  });
});

describe("the CSS a letterheaded document gets", () => {
  /* The logo is wrapped in an SVG that declares its own printed size: a margin
     box's content is generated content, and Chrome sizes generated images from
     their own pixels when it PRINTS, ignoring the CSS rule that works on
     screen. The decoded wrapper is what these tests read. */
  const svgOf = (css: string) => {
    const m = /@top-center \{ content: url\("data:image\/svg\+xml;charset=utf-8,([^"]+)"\)/.exec(
      css,
    );
    return m ? decodeURIComponent(m[1] as string) : "";
  };
  const css = dynamicCss({ ...BASE, letterhead: WIDE_PNG });

  it("puts the logo in the top-centre margin box at the asked-for height", () => {
    expect(svgOf(css)).toContain('height="14mm"');
    expect(svgOf(css)).toContain(WIDE_PNG);
    expect(svgOf(dynamicCss({ ...BASE, letterhead: WIDE_PNG, letterheadSize: "24" }))).toContain(
      'height="24mm"',
    );
  });

  it("sizes the width from the logo's own proportions", () => {
    /* A 480×120 logo at 14 mm tall is 56 mm wide, and the viewBox carries the
       image's own pixels so nothing is stretched. */
    expect(svgOf(css)).toContain('width="56mm"');
    expect(svgOf(css)).toContain('viewBox="0 0 480 120"');
  });

  it("clamps a silly height rather than printing over the prose", () => {
    expect(svgOf(dynamicCss({ ...BASE, letterhead: WIDE_PNG, letterheadSize: "400" }))).toContain(
      'height="30mm"',
    );
    expect(svgOf(dynamicCss({ ...BASE, letterhead: WIDE_PNG, letterheadSize: "-2" }))).toContain(
      'height="6mm"',
    );
  });

  it("clears it off the cover, which has no margins to hold it", () => {
    const cover = css.slice(css.indexOf("@page cover"), css.indexOf("@page front"));
    expect(cover).toContain("@top-center { content: none; }");
  });

  it("ignores anything it cannot measure", () => {
    for (const bad of [
      "/logo.png",
      "javascript:alert(1)",
      "data:text/html,<b>hi",
      "",
      "data:image/png;base64,AA",
    ]) {
      expect(dynamicCss({ ...BASE, letterhead: bad })).not.toContain("@top-center");
    }
  });
});
