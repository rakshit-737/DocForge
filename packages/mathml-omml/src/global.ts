/* ============================================================
   global.ts — assign the classic global for the single-file shell.

   A PLAIN object (spread, never a frozen module namespace): main.js
   mutates some module globals in the old build (e.g. PdfEditor.hooks),
   so the shapes it sees must stay writable.
   ============================================================ */

import { api } from "./index.js";

globalThis.MathmlOmml = { ...api };
