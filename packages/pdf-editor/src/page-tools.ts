/* ============================================================
   page-tools.ts — the PDF toolbox (§8.4): rotate, delete, reorder,
   merge, split and stamp page numbers, entirely client-side.

   Everything here is bytes in, bytes out. Each operation loads the
   document with pdf-lib, rearranges PAGES only, and saves — the page
   content streams, fonts and resources are carried across untouched
   by pdf-lib's own copyPages, so a toolbox pass is not a re-render
   and cannot degrade what it did not touch.

   pdf-lib arrives the way it always has in this package: the
   vendored UMD bundle in the single-file edition, the npm copy in
   the studio, both landing on `window.PDFLib` (see ensurePdfLib in
   index.ts). These functions take the namespace as an argument
   instead of reaching for the global, which is what makes them
   testable in Node against the npm package.
   ============================================================ */

/** The slice of pdf-lib the toolbox uses. Structural, so both the vendored
    bundle and the npm package satisfy it. */
export interface PageToolsLib {
  PDFDocument: {
    create(): Promise<PdfDoc>;
    load(bytes: ArrayBuffer | Uint8Array, opts?: { ignoreEncryption?: boolean }): Promise<PdfDoc>;
  };
  StandardFonts: Record<string, unknown>;
  rgb(r: number, g: number, b: number): unknown;
  degrees?(angle: number): unknown;
}

export interface PdfPage {
  getSize(): { width: number; height: number };
  getRotation(): { angle: number };
  setRotation(angle: unknown): void;
  drawText(text: string, opts: Record<string, unknown>): void;
}

export interface PdfDoc {
  getPageCount(): number;
  getPages(): PdfPage[];
  removePage(index: number): void;
  insertPage(index: number, page: PdfPage): PdfPage;
  addPage(page?: PdfPage): PdfPage;
  copyPages(from: PdfDoc, indices: number[]): Promise<PdfPage[]>;
  embedFont(font: unknown): Promise<unknown>;
  save(): Promise<Uint8Array>;
}

const load = (lib: PageToolsLib, bytes: ArrayBuffer | Uint8Array): Promise<PdfDoc> =>
  lib.PDFDocument.load(bytes, { ignoreEncryption: true });

/** Rotation in pdf-lib is a tagged object; the vendored bundle exposes the
    same `degrees` helper, and a plain object is the shape it builds. */
const asDegrees = (lib: PageToolsLib, angle: number): unknown =>
  lib.degrees ? lib.degrees(angle) : { type: "degrees", angle };

/** A page order given as 0-based indices — every kept page, in the order it
    should end up. Pages left out are dropped, so delete and reorder are the
    same operation seen from two sides. */
export async function reorderPages(
  lib: PageToolsLib,
  bytes: ArrayBuffer | Uint8Array,
  order: number[],
): Promise<Uint8Array> {
  const src = await load(lib, bytes);
  const count = src.getPageCount();
  const wanted = order.filter((i) => Number.isInteger(i) && i >= 0 && i < count);
  if (wanted.length === 0) throw new Error("A PDF needs at least one page");
  const out = await lib.PDFDocument.create();
  const copied = await out.copyPages(src, wanted);
  for (const page of copied) out.addPage(page);
  return out.save();
}

/** Drop pages by 0-based index. */
export async function deletePages(
  lib: PageToolsLib,
  bytes: ArrayBuffer | Uint8Array,
  indices: number[],
): Promise<Uint8Array> {
  const src = await load(lib, bytes);
  const drop = new Set(indices);
  const keep: number[] = [];
  for (let i = 0; i < src.getPageCount(); i++) if (!drop.has(i)) keep.push(i);
  if (keep.length === 0) throw new Error("That would delete every page");
  return reorderPages(lib, bytes, keep);
}

/** Turn pages by a multiple of 90°, relative to how they stand now. */
export async function rotatePages(
  lib: PageToolsLib,
  bytes: ArrayBuffer | Uint8Array,
  indices: number[],
  delta: number,
): Promise<Uint8Array> {
  const doc = await load(lib, bytes);
  const pages = doc.getPages();
  const step = (((Math.round(delta / 90) * 90) % 360) + 360) % 360;
  for (const i of indices) {
    const page = pages[i];
    if (!page) continue;
    const now = page.getRotation().angle || 0;
    page.setRotation(asDegrees(lib, (now + step) % 360));
  }
  return doc.save();
}

/** One document from several, in the order given. */
export async function mergePdfs(
  lib: PageToolsLib,
  parts: Array<ArrayBuffer | Uint8Array>,
): Promise<Uint8Array> {
  if (parts.length === 0) throw new Error("Nothing to merge");
  const out = await lib.PDFDocument.create();
  for (const part of parts) {
    const src = await load(lib, part);
    const copied = await out.copyPages(
      src,
      Array.from({ length: src.getPageCount() }, (_, i) => i),
    );
    for (const page of copied) out.addPage(page);
  }
  return out.save();
}

export interface PageRange {
  /** 1-based, inclusive — the numbers a reader sees on the page strip. */
  from: number;
  to: number;
}

/** "1-3, 5, 8-" over a document of `count` pages → 0-based index lists.
    Deliberately forgiving: a reader typing a range is not writing a program. */
export function parseRanges(spec: string, count: number): number[][] {
  const out: number[][] = [];
  for (const chunk of spec.split(/[,;]/)) {
    const text = chunk.trim();
    if (!text) continue;
    const m = /^(\d*)\s*(?:[-–]\s*(\d*))?$/.exec(text);
    if (!m) continue;
    const hasDash = /[-–]/.test(text);
    const from = m[1] ? Number(m[1]) : 1;
    const to = hasDash ? (m[2] ? Number(m[2]) : count) : from;
    const lo = Math.max(1, Math.min(from, to));
    const hi = Math.min(count, Math.max(from, to));
    if (hi < lo) continue;
    const list: number[] = [];
    for (let n = lo; n <= hi; n++) list.push(n - 1);
    if (list.length) out.push(list);
  }
  return out;
}

/** One document per range — the split. */
export async function splitPdf(
  lib: PageToolsLib,
  bytes: ArrayBuffer | Uint8Array,
  ranges: number[][],
): Promise<Uint8Array[]> {
  const out: Uint8Array[] = [];
  for (const range of ranges) {
    if (!range.length) continue;
    out.push(await reorderPages(lib, bytes, range));
  }
  if (out.length === 0) throw new Error("No pages in that range");
  return out;
}

export interface StampOptions {
  /** 1-based number printed on the FIRST page; later pages count on. */
  start?: number;
  /** Pages to skip, 0-based (a cover, usually). */
  skip?: number[];
  position?: "bottom-center" | "bottom-right" | "top-right";
  size?: number;
  /** `{n}` becomes the number, `{total}` the count of numbered pages. */
  format?: string;
}

/** Stamp page numbers into the page content — a real part of the file
    afterwards, not an annotation a reader's viewer might hide. */
export async function stampPageNumbers(
  lib: PageToolsLib,
  bytes: ArrayBuffer | Uint8Array,
  opts: StampOptions = {},
): Promise<Uint8Array> {
  const doc = await load(lib, bytes);
  const font = await doc.embedFont(lib.StandardFonts.Helvetica);
  const pages = doc.getPages();
  const skip = new Set(opts.skip ?? []);
  const size = opts.size ?? 10;
  const format = opts.format ?? "{n}";
  const numbered = pages.length - skip.size;
  let n = opts.start ?? 1;
  pages.forEach((page, i) => {
    if (skip.has(i)) return;
    const label = format.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(numbered));
    const { width, height } = page.getSize();
    /* Helvetica's average advance is close enough for centring a folio, and
       it needs no metrics table on the vendored path. */
    const textWidth = label.length * size * 0.5;
    const pos = opts.position ?? "bottom-center";
    const x =
      pos === "bottom-center"
        ? (width - textWidth) / 2
        : width - textWidth - Math.max(24, size * 3);
    const y = pos === "top-right" ? height - Math.max(28, size * 3) : Math.max(20, size * 2);
    page.drawText(label, { x, y, size, font, color: lib.rgb(0.15, 0.15, 0.15) });
    n++;
  });
  return doc.save();
}

export const PageTools = {
  reorderPages,
  deletePages,
  rotatePages,
  mergePdfs,
  splitPdf,
  stampPageNumbers,
  parseRanges,
};
export type PageToolsApi = typeof PageTools;
