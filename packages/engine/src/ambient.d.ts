/* ============================================================
   ambient.d.ts — the vendored globals this package touches, typed
   honestly but minimally (only the members the engine actually uses).

   The libraries stay globals this phase (MASTER-PROMPT Phase 1): the
   single-file build inlines the same UMD bytes it always has, so the
   engine reads `marked` / `katex` / `hljs` / `window.__FONT_DATA__`
   off the global scope exactly as src/js/engine.js did. Paged.js is
   deliberately NOT declared: engine.js never touches the `Paged`
   global — it only emits CSS selectors (.pagedjs_page) and relies on
   main.js to run the paginator.
   ============================================================ */

import type { api } from "./index";
import type { MarkedToken } from "./types";

declare global {
  /* ----- marked (vendored UMD; the engine mutates the shared instance
     with marked.use and drives the low-level lexer/parser pair) ----- */
  interface MarkedOptions {
    breaks?: boolean;
    gfm?: boolean;
    [k: string]: unknown;
  }
  interface MarkedLib {
    /** engine.js only ever passes option packs ({gfm} / {extensions}). */
    use(pack: { gfm?: boolean; extensions?: unknown[] }): unknown;
    parse(src: string, opts?: MarkedOptions): string;
    parseInline(src: string, opts?: MarkedOptions): string;
    lexer(src: string, opts?: MarkedOptions): MarkedToken[];
    parser(tokens: MarkedToken[], opts?: MarkedOptions): string;
    defaults: Record<string, unknown>;
  }
  const marked: MarkedLib;

  /* ----- KaTeX (vendored UMD; postprocess renders data-tex nodes) ----- */
  interface KatexLib {
    renderToString(
      tex: string,
      opts?: {
        output?: string;
        displayMode?: boolean;
        throwOnError?: boolean;
        strict?: string;
      },
    ): string;
  }
  const katex: KatexLib;

  /* ----- highlight.js (vendored UMD; postprocess highlights fences) ----- */
  interface HljsLib {
    getLanguage(lang: string): unknown;
    highlight(
      code: string,
      opts: { language: string; ignoreIllegals?: boolean },
    ): { value: string };
  }
  const hljs: HljsLib;

  /* ----- DOMPurify (vendored UMD; sanitizes markdown-to-DOM boundaries) ----- */
  interface DOMPurifyConfig {
    ADD_TAGS?: string[];
    ADD_ATTR?: string[];
    FORBID_TAGS?: string[];
    FORBID_ATTR?: string[];
    ALLOW_DATA_ATTR?: boolean;
    ALLOWED_URI_REGEXP?: RegExp;
    USE_PROFILES?: { html?: boolean; svg?: boolean; mathMl?: boolean; svgFilters?: boolean };
    RETURN_DOM_FRAGMENT?: boolean;
    RETURN_DOM?: boolean;
    [key: string]: unknown;
  }
  interface DOMPurifyLib {
    sanitize(dirty: string | Node, cfg?: DOMPurifyConfig): string;
  }
  const DOMPurify: DOMPurifyLib;

  interface Window {
    /** base64 TTF bytes per "<stem>-<Cut>" key, inlined by build.mjs. */
    __FONT_DATA__?: Record<string, string | undefined>;
  }

  /* The classic global src/global.ts assigns (plain, mutable object). */
  // eslint-disable-next-line no-var
  var Engine: typeof api;
}
