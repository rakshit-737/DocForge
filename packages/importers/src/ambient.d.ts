/* ============================================================
   ambient.d.ts — the vendored globals this package touches, typed
   honestly but minimally (only the members this package actually uses).

   The libraries stay globals this phase (MASTER-PROMPT Phase 1): mammoth
   and the two pdf.js bundles arrive as embedded string constants on
   window.__*_SRC__ and are evaluated on first use by blob-import.ts.
   ============================================================ */

import type { DocxImportApi } from "./docx-import.js";
import type { FileImportApi } from "./file-import.js";
import type { PdfImportApi } from "./pdf-import.js";

declare global {
  /* ----- mammoth (vendored browser UMD; arrives as window.__MAMMOTH_SRC__) ----- */
  interface MammothImage {
    contentType: string;
    altText?: string;
    read(kind: "base64"): Promise<string>;
  }
  interface MammothMessage {
    message?: string;
  }
  interface MammothResult {
    value: string;
    messages?: MammothMessage[];
  }
  type MammothImageHandler = (
    handler: (img: MammothImage) => Promise<{ src: string; alt: string }>,
  ) => unknown;
  interface MammothLib {
    convertToHtml(
      input: { arrayBuffer: ArrayBuffer },
      options?: {
        styleMap?: string[];
        ignoreEmptyParagraphs?: boolean;
        convertImage?: unknown;
      },
    ): Promise<MammothResult>;
    images?: { imgElement?: MammothImageHandler; inline?: MammothImageHandler };
  }

  /* ----- pdf.js (vendored IIFE bundles: __PDFJS_WORKER_SRC__ evaluated
     BEFORE __PDFJS_SRC__ so the fake-worker global exists) ----- */
  interface PdfjsTextItem {
    str: string;
    transform: [number, number, number, number, number, number];
    width?: number;
    fontName?: string;
  }
  interface PdfjsTextStyle {
    fontFamily?: string;
  }
  interface PdfjsTextContent {
    items: PdfjsTextItem[];
    styles?: Record<string, PdfjsTextStyle | undefined>;
  }
  interface PdfjsPage {
    getViewport(opts: { scale: number }): { width: number; height: number };
    getTextContent(): Promise<PdfjsTextContent>;
    getOperatorList(): Promise<unknown>;
    commonObjs: { get(name: string): { name?: string } | null | undefined };
  }
  interface PdfjsDocument {
    numPages: number;
    getPage(n: number): Promise<PdfjsPage>;
    destroy(): Promise<unknown>;
  }
  interface PdfjsLoadingTask {
    promise: Promise<PdfjsDocument>;
    destroy(): Promise<unknown>;
  }
  interface PdfjsLib {
    getDocument(params: {
      data: ArrayBuffer;
      isEvalSupported?: boolean;
      useSystemFonts?: boolean;
      /* pdf-editor passes more (fontExtraProperties, …) through ensureLib's lib */
      [k: string]: unknown;
    }): PdfjsLoadingTask;
    GlobalWorkerOptions: { workerSrc: string };
  }

  interface Window {
    mammoth?: MammothLib;
    /** mammoth.browser.min.js as a string; nulled once evaluated. */
    __MAMMOTH_SRC__?: string | null;
    pdfjsLib?: PdfjsLib;
    /** pdf.js main bundle as a string; deleted/nulled once evaluated. */
    __PDFJS_SRC__?: string | null;
    /** pdf.js worker bundle as a string; must be evaluated BEFORE the main bundle. */
    __PDFJS_WORKER_SRC__?: string | null;
  }

  /* The classic globals src/global.ts assigns (plain, mutable objects). */
  // eslint-disable-next-line no-var
  var FileImport: FileImportApi;
  // eslint-disable-next-line no-var
  var DocxImport: DocxImportApi;
  // eslint-disable-next-line no-var
  var PdfImport: PdfImportApi;
}
