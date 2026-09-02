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

// Happy-dom bugfix: Node.prototype.nodeName returns "" for Elements in happy-dom,
// which breaks DOMPurify's standard getter lookup. Polyfill it according to DOM spec.
const nodeProto = (globalThis as unknown as { Node?: { prototype?: unknown } }).Node?.prototype;
if (nodeProto) {
  Object.defineProperty(nodeProto, "nodeName", {
    get() {
      if (this.nodeType === 1) return this.tagName;
      if (this.nodeType === 3) return "#text";
      if (this.nodeType === 8) return "#comment";
      if (this.nodeType === 11) return "#document-fragment";
      if (this.nodeType === 9) return "#document";
      return "";
    },
    configurable: true,
  });
}

const { default: createDOMPurify } = await import("dompurify");
const DOMPurify =
  typeof (createDOMPurify as unknown as { sanitize?: unknown }).sanitize === "function"
    ? createDOMPurify
    : (createDOMPurify as unknown as (win: unknown) => unknown)(window);
(globalThis as Record<string, unknown>).DOMPurify = DOMPurify;
