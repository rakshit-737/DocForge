/* The packages read ambient globals (marked/katex/hljs/docx/Paged) — the
   single-file edition inlines UMD builds, the studio assigns the npm copies.
   Assignment MUST land before any package module executes (engine registers
   its marked extensions at import time), so the packages arrive here via
   dynamic import behind the assignments, and everything downstream awaits
   loadStudio() once. */
import hljs from "highlight.js/lib/common"; // the same 36-language build the classic edition ships
import katex from "katex";
import { marked } from "marked";
import type * as PagedTypes from "pagedjs";

export interface StudioRuntime {
  Engine: typeof import("@docforge/engine");
  Paged: typeof PagedTypes;
}

declare global {
  interface Window {
    __DOCFORGE_RUNTIME__?: Promise<StudioRuntime>;
  }
}

async function boot(): Promise<StudioRuntime> {
  const g = globalThis as Record<string, unknown>;
  g.marked = marked;
  g.katex = katex;
  g.hljs = hljs;
  /* Paged.js comes in as the prebuilt UMD dist — the same build the classic
     edition inlines (vendored by sync-assets; the ESM source drags es5-ext
     "#" deep paths Turbopack mis-resolves, and dist/ is unexported). */
  const pagedMod = (await import("./vendor/paged.cjs")) as Record<string, unknown>;
  const Paged = (pagedMod.default ?? pagedMod ?? (g.Paged || g.PagedModule)) as typeof PagedTypes;
  g.Paged = Paged;
  const Engine = await import("@docforge/engine");
  // The exporters read the classic ambient global (export-docx's Engine.* lookups).
  g.Engine = Engine.api;
  return { Engine, Paged };
}

/** Idempotent studio boot — every consumer awaits the same promise. */
export function loadStudio(): Promise<StudioRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("the studio boots in the browser only"));
  }
  window.__DOCFORGE_RUNTIME__ ??= boot();
  return window.__DOCFORGE_RUNTIME__;
}

/** The docx library is export-time freight — loaded when an export first runs. */
export async function loadDocx(): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  if (!g.docx) g.docx = await import("docx");
}

/** Font bytes reach the exporters through the same __FONT_DATA__ contract the
    single-file edition uses — fetched lazily from the static cuts, cached. */
let fontData: Promise<Record<string, string>> | null = null;
export function loadFontData(): Promise<Record<string, string>> {
  fontData ??= (async () => {
    const { Engine } = await loadStudio();
    const out: Record<string, string> = {};
    await Promise.all(
      Engine.EMBEDDED.flatMap((fam) =>
        Object.keys(fam.cuts).map(async (cut) => {
          const file = `${fam.stem}-${Engine.CUT_FILE[cut]}.ttf`;
          const res = await fetch(`/fonts/${file}`);
          if (!res.ok) return;
          const buf = new Uint8Array(await res.arrayBuffer());
          let bin = "";
          const CHUNK = 0x8000;
          for (let i = 0; i < buf.length; i += CHUNK) {
            bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
          }
          out[`${fam.stem}-${Engine.CUT_FILE[cut]}`] = btoa(bin);
        }),
      ),
    );
    (globalThis as Record<string, unknown>).__FONT_DATA__ = out;
    return out;
  })();
  return fontData;
}

/** src/doc.css is the product surface — served verbatim, fetched once. */
let docCss: Promise<string> | null = null;
export function loadDocCss(): Promise<string> {
  docCss ??= fetch("/doc.css").then((r) => {
    if (!r.ok) throw new Error("doc.css failed to load");
    return r.text();
  });
  return docCss;
}
