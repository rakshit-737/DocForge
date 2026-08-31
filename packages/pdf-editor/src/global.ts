/* ============================================================
   global.ts — assign the classic global for the single-file shell.

   PdfEditor must be the `api` object ITSELF, not a spread copy:
   main.js REASSIGNS the hooks property wholesale
   (`PdfEditor.hooks = { toast, confirm: confirmModal }`), and the
   module's internal calls read `api.hooks` at call time — a copy would
   leave them pointing at the stale default (silent) hooks. `api` is a
   plain mutable object literal, never a frozen module namespace, so the
   shell can keep mutating it exactly as it does today.
   ============================================================ */

import { api } from "./index";

globalThis.PdfEditor = api;
