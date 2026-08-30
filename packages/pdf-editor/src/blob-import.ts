/* ============================================================
   blob-import.ts — run a vendored UMD/IIFE bundle at global scope

   Duplicated verbatim from @docforge/importers/src/blob-import.ts (the
   helper is internal there, not public surface; dedupe into a shared
   util package when one exists).

   Replaces the classic build's `(0, eval)(src)` hack (MASTER-PROMPT §3.4):
   the bundle string becomes a Blob-URL ES module and is dynamically
   imported, so no `unsafe-eval` CSP allowance is ever needed.

   Two things indirect eval gave us for free have to be reproduced:

   1. Global-object detection. UMD wrappers probe `window`/`self`; a module
      evaluated from a blob: URL has neither guaranteed to mean the global
      object the app shares, so a prologue aliases both to globalThis.

   2. Top-level `var` landing on the global object. `var pdfjsWorker = …`
      eval'd indirectly becomes window.pdfjsWorker; in module scope it stays
      module-local. The caller therefore supplies an epilogue that pins the
      bundle's top-level binding onto globalThis explicitly.

   The "\n" separators matter: minified bundles often end in a
   `//# sourceMappingURL=` comment line that would otherwise swallow the
   epilogue.
   ============================================================ */

export async function importGlobalScript(src: string, epilogue: string): Promise<void> {
  const blob = new Blob(
    ["var self=globalThis,window=globalThis;\n", src, "\n", epilogue],
    { type: "text/javascript" },
  );
  const url = URL.createObjectURL(blob);
  try {
    await import(/* @vite-ignore */ url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
