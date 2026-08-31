/* ============================================================
   ambient.d.ts — the vendored globals this package touches, typed
   honestly but minimally (only the members this package actually uses).

   KaTeX stays a global this phase (MASTER-PROMPT Phase 1): the single-file
   build keeps inlining the same UMD bytes, and texToOmml reaches for the
   `katex` global exactly the way the classic script did. Tests import the
   real npm package and assign it onto globalThis.
   ============================================================ */

import type { MathmlOmmlApi } from "./index";

declare global {
  /* ----- katex (vendored UMD global; only renderToString is used) ----- */
  interface KatexLib {
    renderToString(
      tex: string,
      opts?: { output?: string; displayMode?: boolean; throwOnError?: boolean },
    ): string;
  }

  // eslint-disable-next-line no-var
  var katex: KatexLib | undefined;

  /* The classic global src/global.ts assigns (a plain, mutable object). */
  // eslint-disable-next-line no-var
  var MathmlOmml: MathmlOmmlApi;
}
