/* ============================================================
   Ambient declarations — the globals pdf-editor touches this phase.

   pdf.js is never imported here: it arrives through the sibling module's
   global (`PdfImport.ensureLib()`), exactly as in the classic build.
   pdf-lib ships as a string on `window.__PDFLIB_SRC__` and lands on
   `window.PDFLib` on first export. Types are honest but minimal — only
   the members this module actually uses.
   ============================================================ */

declare global {
  /* ---------- pdf.js interop (what PdfImport.ensureLib() resolves to) ---------- */

  interface PdfJsRenderTask {
    promise: Promise<unknown>;
    cancel(): void;
  }

  interface PdfJsViewport {
    width: number;
    height: number;
  }

  interface PdfJsTextItem {
    str: string;
    /** [a, b, c, d, x, y] text matrix; [4]=x, [5]=baseline y (PDF, bottom-up). */
    transform: [number, number, number, number, number, number];
    width?: number;
    /** pdf.js "loadedName" of the run's font (e.g. "g_d0_f1"). */
    fontName: string;
  }

  interface PdfJsPage {
    /** Resolved font objects by loadedName: { name, toUnicode?._map }. */
    commonObjs: { get(name: string): any };
    getViewport(opts: { scale: number }): PdfJsViewport;
    render(opts: {
      canvasContext: CanvasRenderingContext2D;
      viewport: PdfJsViewport;
    }): PdfJsRenderTask;
    getTextContent(): Promise<{ items: PdfJsTextItem[] }>;
  }

  interface PdfJsDocument {
    numPages: number;
    getPage(n: number): Promise<PdfJsPage>;
    destroy(): Promise<unknown>;
  }

  interface PdfJsLoadingTask {
    promise: Promise<PdfJsDocument>;
    destroy(): Promise<unknown>;
  }

  interface PdfJsLib {
    getDocument(opts: {
      data: Uint8Array;
      isEvalSupported?: boolean;
      useSystemFonts?: boolean;
      fontExtraProperties?: boolean;
    }): PdfJsLoadingTask;
  }

  /** Sibling module global (src/js/pdf-import.js → @docforge/pdf-import). */
  var PdfImport: { ensureLib(): Promise<PdfJsLib> };

  /* ---------- pdf-lib UMD namespace (window.PDFLib) ---------- */

  interface PdfLibRGB {
    red: number;
    green: number;
    blue: number;
  }

  interface PdfLibNamespace {
    PDFDocument: { load(bytes: ArrayBuffer | Uint8Array): Promise<any> };
    StandardFonts: Record<string, any>;
    rgb(r: number, g: number, b: number): PdfLibRGB;
    PDFName: { of(name: string): any };
    PDFDict: new (...args: any[]) => any;
    PDFRef: new (...args: any[]) => any;
    PDFHexString: { of(hex: string): any };
    pushGraphicsState(): any;
    popGraphicsState(): any;
    beginText(): any;
    endText(): any;
    showText(s: any): any;
    setFontAndSize(key: any, size: number): any;
    setFillingRgbColor(r: number, g: number, b: number): any;
    rotateAndSkewTextRadiansAndTranslate(
      rotation: number,
      xSkew: number,
      ySkew: number,
      x: number,
      y: number,
    ): any;
  }

  interface Window {
    /** Set by the pdf-lib UMD bundle once loaded. */
    PDFLib?: PdfLibNamespace;
    /** The vendored pdf-lib source; nulled after its one-time load. */
    __PDFLIB_SRC__?: string | null;
  }

  /** The global this package installs (see src/global.ts). */
  // eslint-disable-next-line no-var
  var PdfEditor: typeof import("./index.js")["api"] | undefined;
}

export {};
