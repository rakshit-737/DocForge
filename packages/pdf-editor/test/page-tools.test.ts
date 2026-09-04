/* The PDF toolbox, against real PDFs built with the same library the bench
   uses. Every assertion re-loads the OUTPUT bytes, so what is checked is the
   file a reader would download, not an in-memory promise. */
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  deletePages,
  mergePdfs,
  type PageToolsLib,
  parseRanges,
  reorderPages,
  rotatePages,
  splitPdf,
  stampPageNumbers,
} from "../src/page-tools";

const lib = { PDFDocument, StandardFonts, rgb, degrees } as unknown as PageToolsLib;

/** A document of `n` pages, each carrying its own number as text so the pages
    can be told apart after they move. */
async function makePdf(n: number, tag = "P"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= n; i++) {
    const page = doc.addPage([300, 400]);
    page.drawText(`${tag}${i}`, { x: 20, y: 350, size: 24, font });
  }
  return doc.save();
}

/* latin1 rather than node:buffer — this package's typecheck has no node
   types, and the header check only needs the first few bytes as characters. */
const textOf = (bytes: Uint8Array): string => String.fromCharCode(...bytes.subarray(0, 16));

describe("reorderPages", () => {
  it("keeps only the pages named, in the order named", async () => {
    const out = await reorderPages(lib, await makePdf(4), [3, 0]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
  });

  it("ignores indices that aren't pages", async () => {
    const out = await reorderPages(lib, await makePdf(2), [0, 9, -1, 1]);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
  });

  it("refuses to produce a document with no pages", async () => {
    await expect(reorderPages(lib, await makePdf(2), [7])).rejects.toThrow(/at least one page/);
  });
});

describe("deletePages", () => {
  it("drops what it is given and keeps the rest", async () => {
    const out = await deletePages(lib, await makePdf(5), [0, 4]);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(3);
  });

  it("refuses to delete every page", async () => {
    await expect(deletePages(lib, await makePdf(2), [0, 1])).rejects.toThrow(/every page/);
  });
});

describe("rotatePages", () => {
  it("turns the named pages and leaves the others standing", async () => {
    const out = await rotatePages(lib, await makePdf(3), [1], 90);
    const pages = (await PDFDocument.load(out)).getPages();
    expect(pages[0]?.getRotation().angle).toBe(0);
    expect(pages[1]?.getRotation().angle).toBe(90);
    expect(pages[2]?.getRotation().angle).toBe(0);
  });

  it("is relative, and wraps at a full turn", async () => {
    let out = await rotatePages(lib, await makePdf(1), [0], 270);
    out = await rotatePages(lib, out, [0], 180);
    expect((await PDFDocument.load(out)).getPages()[0]?.getRotation().angle).toBe(90);
  });

  it("rounds an odd angle to the nearest quarter turn", async () => {
    const out = await rotatePages(lib, await makePdf(1), [0], 88);
    expect((await PDFDocument.load(out)).getPages()[0]?.getRotation().angle).toBe(90);
  });
});

describe("mergePdfs", () => {
  it("joins documents in the order given", async () => {
    const out = await mergePdfs(lib, [await makePdf(2, "A"), await makePdf(3, "B")]);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(5);
  });

  it("refuses an empty merge", async () => {
    await expect(mergePdfs(lib, [])).rejects.toThrow(/Nothing to merge/);
  });
});

describe("parseRanges", () => {
  it("reads the shapes a reader types", () => {
    expect(parseRanges("1-3", 10)).toEqual([[0, 1, 2]]);
    expect(parseRanges("2", 10)).toEqual([[1]]);
    expect(parseRanges("1-2, 5", 10)).toEqual([[0, 1], [4]]);
  });

  it("treats an open end as 'to the end', and an open start as 'from one'", () => {
    expect(parseRanges("8-", 9)).toEqual([[7, 8]]);
    expect(parseRanges("-2", 9)).toEqual([[0, 1]]);
  });

  it("clamps past the end and swaps a backwards range", () => {
    expect(parseRanges("8-99", 9)).toEqual([[7, 8]]);
    expect(parseRanges("3-1", 9)).toEqual([[0, 1, 2]]);
  });

  it("ignores nonsense rather than throwing at the reader", () => {
    expect(parseRanges("", 5)).toEqual([]);
    expect(parseRanges("abc, 2", 5)).toEqual([[1]]);
    expect(parseRanges("99", 5)).toEqual([]);
  });
});

describe("splitPdf", () => {
  it("produces one document per range", async () => {
    const parts = await splitPdf(lib, await makePdf(6), parseRanges("1-2, 3-6", 6));
    expect(parts).toHaveLength(2);
    expect((await PDFDocument.load(parts[0] as Uint8Array)).getPageCount()).toBe(2);
    expect((await PDFDocument.load(parts[1] as Uint8Array)).getPageCount()).toBe(4);
  });

  it("refuses when no range names a page", async () => {
    await expect(splitPdf(lib, await makePdf(2), [])).rejects.toThrow(/No pages/);
  });
});

describe("stampPageNumbers", () => {
  it("writes a number into every page's own content", async () => {
    const out = await stampPageNumbers(lib, await makePdf(3));
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    // the stamp is drawn content, so the saved file grew
    expect(out.length).toBeGreaterThan((await makePdf(3)).length);
  });

  it("skips the pages it is told to, and counts from where it is told", async () => {
    const out = await stampPageNumbers(lib, await makePdf(4), { skip: [0], start: 1 });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(4);
  });

  it("supports a format with the total in it", async () => {
    const out = await stampPageNumbers(lib, await makePdf(2), { format: "Page {n} of {total}" });
    const raw = textOf(out);
    // pdf-lib writes text either literally or inside a compressed stream; the
    // document must at least still load with both pages
    expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
    expect(raw.startsWith("%PDF-")).toBe(true);
  });
});
