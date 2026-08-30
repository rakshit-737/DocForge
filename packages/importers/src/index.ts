/* ============================================================
   @docforge/importers — offline format importers, ported 1:1 from the
   classic build (Phase 1):

     file-import.js (302) -> FileImport  { csv, xlsx, pptx, epub, ipynb }
     docx-import.js (112) -> DocxImport  { toHtml }
     pdf-import.js  (420) -> PdfImport   { toMarkdown, ensureLib }

   The single-file shell keeps its globals via ./global.ts.
   ============================================================ */

import { FileImport } from "./file-import.js";
import { DocxImport } from "./docx-import.js";
import { PdfImport } from "./pdf-import.js";

/** Exactly today's public surface: the three module globals of the classic build. */
export const api = { FileImport, DocxImport, PdfImport };

export { FileImport, DocxImport, PdfImport };
export type { FileImportApi } from "./file-import.js";
export type { DocxImportApi } from "./docx-import.js";
export type { PdfImportApi, Line, PageRec, Block } from "./pdf-import.js";
