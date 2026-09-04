/// <reference path="./ambient.d.ts" />
/* ============================================================
   @docforge/importers — offline format importers, ported 1:1 from the
   classic build (Phase 1):

     file-import.js (302) -> FileImport  { csv, xlsx, pptx, epub, ipynb }
     docx-import.js (112) -> DocxImport  { toHtml }
     pdf-import.js  (420) -> PdfImport   { toMarkdown, ensureLib }

   Plus one addition that has no classic ancestor: BibImport, which
   turns a BibTeX / RIS / CSL-JSON reference library into the dialect's
   own `[@key]: …` definition lines (§8.3). It writes SOURCE a reader
   could have typed, never rendered output, so the golden gate is not
   involved.

   The single-file shell keeps its globals via ./global.ts.
   ============================================================ */

import { BibImport } from "./bib-import";
import { DocxImport } from "./docx-import";
import { FileImport } from "./file-import";
import { PdfImport } from "./pdf-import";

/** The three module globals of the classic build, plus the bibliography
    importer the classic edition never had. */
export const api = { FileImport, DocxImport, PdfImport, BibImport };

export type { BibEntry, BibFormat, BibImportApi } from "./bib-import";
export type { DocxImportApi } from "./docx-import";
export type { FileImportApi } from "./file-import";
export type { Block, Line, PageRec, PdfImportApi } from "./pdf-import";
export { BibImport, DocxImport, FileImport, PdfImport };
