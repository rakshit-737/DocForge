/* ============================================================
   global.ts — assign the classic `Engine` global for the single-file
   shell. A PLAIN object (spread, never a frozen module namespace):
   main.js treats these classic globals as mutable objects, so the
   shape it sees must stay writable.
   ============================================================ */

import { globalApi } from "./index";

/* globalApi, not `api`: the classic surface plus the members consumers reach
   only through the global (the .docx exporter's headParts). `api` itself is
   held to the classic shape by the parity gate. */
globalThis.Engine = { ...globalApi };
