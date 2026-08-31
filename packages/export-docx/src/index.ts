/// <reference path="./ambient.d.ts" />
/* ============================================================
   @docforge/export-docx — the .docx writer, ported 1:1 from the
   classic build (Phase 1):

     docx-export.js (857) -> DocxExport { build }
     docx-fonts.js  (209) -> DocxFonts  { embed }

   The docx library itself stays the window.docx global this phase;
   MathmlOmml is consumed via the sibling workspace package.
   The single-file shell keeps its globals via ./global.ts.
   ============================================================ */

import { build } from "./docx-export";
import { embed } from "./docx-fonts";

export const DocxExport = { build };
export const DocxFonts = { embed };

/** Exactly today's public surface: the two module globals of the classic build. */
export const api = { DocxExport, DocxFonts };

export type DocxExportApi = typeof DocxExport;
export type DocxFontsApi = typeof DocxFonts;

export type { DocxSettings } from "./docx-export";
export type { EmbedFamily } from "./docx-fonts";
export { build, embed };
