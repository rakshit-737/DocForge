/* ============================================================
   test/setup.ts — stand the vendored globals up from npm before any
   src module loads (parse.ts calls marked.use at import time).

   Versions come from the ROOT package.json ranges (marked ^18.0.7,
   katex ^0.18.1, highlight.js ^11.11.1) so the test environment sees
   the same libraries build.mjs inlines into the single file.
   ============================================================ */

import hljs from "highlight.js";
import katex from "katex";
import { marked } from "marked";

(globalThis as Record<string, unknown>).marked = marked;
(globalThis as Record<string, unknown>).katex = katex;
(globalThis as Record<string, unknown>).hljs = hljs;
