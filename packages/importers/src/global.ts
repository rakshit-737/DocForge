/* ============================================================
   global.ts — assign the classic globals for the single-file shell.

   PLAIN objects (spread, never a frozen module namespace): main.js
   mutates some module globals in the old build (e.g. PdfEditor.hooks),
   so the shapes it sees must stay writable.
   ============================================================ */

import { api } from "./index";

globalThis.FileImport = { ...api.FileImport };
globalThis.DocxImport = { ...api.DocxImport };
globalThis.PdfImport = { ...api.PdfImport };
