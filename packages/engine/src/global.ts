/* ============================================================
   global.ts — assign the classic `Engine` global for the single-file
   shell. A PLAIN object (spread, never a frozen module namespace):
   main.js treats these classic globals as mutable objects, so the
   shape it sees must stay writable.
   ============================================================ */

import { api } from "./index.js";

globalThis.Engine = { ...api };
