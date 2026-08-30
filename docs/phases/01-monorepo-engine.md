# Phase 1 — Monorepo + engine extraction

Pure refactor, zero UI change, golden gate green at every commit. Port base: `33c3f30`
(includes PR #15 banner + font-truth). Chrome (`main.js`, `live-edit.js`, `app.css`,
`index.html`) stays vanilla this phase — Phase 2 rebuilds it; sibling sessions keep
working there without collision.

## Toolchain

pnpm via corepack (`packageManager` pinned) · Turborepo · Biome · Vitest · TypeScript
(typecheck only — esbuild does all transpiling, so the build never depends on tsc's
emit). Node 24 pinned in `.nvmrc`. Root keeps the inline-source dependencies (marked,
pagedjs, docx, katex, hljs, mammoth, pdfjs-dist, pdf-lib) because `build.mjs` inlines
them from the root `node_modules`; packages declare their own copies of what they
import (same versions, deduped by the store).

## Packages (public API = today's globals, 1:1)

| Package | From | Surface |
|---|---|---|
| `@docforge/engine` | engine.js | `render, dynamicCss, fontFaceCss, tints, PAGES, MARGINS, FONTS, FACES, EMBEDDED, CUT_FILE, fmtDate, esc, RE_SHOT, WORD_CATALOG, HL_COLORS, sysStack, faceName` |
| `@docforge/mathml-omml` | mathml-omml.js | `mmlToOmml, texToOmml, oMathPara, NS` |
| `@docforge/export-docx` | docx-export.js + docx-fonts.js | `build` (+ `embed` internal) |
| `@docforge/importers` | file-import.js, docx-import.js, pdf-import.js | `csv, xlsx, pptx, epub, ipynb` / `toHtml` / `toMarkdown, ensureLib` |
| `@docforge/pdf-editor` | pdf-editor.js | `hooks, open, close, exportPdf, isOpen, hasEdits, addEdit, getEdits, editLineAt, getTextLines` |
| `@docforge/config` | — | shared tsconfig/biome |

Each package: TS sources, table-driven Vitest tests (dialect features for engine;
converter edge cases for mathml-omml; golden-file tests for export), built by esbuild
to an IIFE with the same global name the shell consumes today.

## Honest deviations (MASTER-PROMPT §10.6)

- **engine + render stay one package this phase.** engine.js interleaves parse and
  render; splitting while holding bit-parity doubles the risk for zero user value.
  The internal layout (`parse.ts` / `render.ts` / `themes.ts`) draws the boundary; the
  package split happens with the AST redesign.
- **The typed AST is the typed marked-token contract.** §4 mandates "keep marked +
  port extensions 1:1 — lowest-risk parity path"; a hand-rolled AST that re-emits
  bit-identical HTML is a rewrite, not a port. Phase 1 types every dialect token
  (`DialectToken` union: heading/span/mark/table/figure/equation/footnote/citation/
  callout/banner/…) as the contract; a marked-independent AST arrives only behind the
  golden gate, later.
- **eval dies via Blob-URL module import.** Single-file cannot lazy-load network
  chunks, so mammoth/pdfjs/pdf-lib strings become
  `import(URL.createObjectURL(new Blob([src], {type:"text/javascript"})))` — no
  `eval`, CSP-compatible (`blob:` script-src), still lazy, still one file. The pdf.js
  fake-worker global trick is preserved.

## Order (gate green after every step)

1. **Scaffold** — pnpm-workspace, turbo, biome, vitest, tsconfig base, `.nvmrc`,
   pnpm-lock (package-lock removed on main; the v1-classic worktree keeps its own),
   CI workflows switch main builds to pnpm (classic/tag builds keep `npm ci`).
   `node build.mjs` still works from pnpm's node_modules — verified before commit.
2. **Port packages in parallel** (workflow agents, 1:1 discipline, tests included):
   mathml-omml · importers · pdf-editor · export-docx · engine (two-stage: mechanical
   TS port, then internal layout). src/js files stay in place and keep building the
   product; packages are a parallel implementation until step 4.
3. **Parity harness** — a Node/vitest runner that renders the golden corpus through
   `@docforge/engine` and byte-compares against `src/js/engine.js` output (fast inner
   loop before the full browser gate).
4. **Rewire** — `build.mjs` inlines each package's esbuild IIFE bundle instead of the
   `src/js` file; run the full golden gate (`--against v1-classic`); only then delete
   the ported `src/js` modules. Siblings notified before this lands.
5. **CI** — turbo pipeline `lint → typecheck → test → build` + existing golden gate.

## Gate (§6 Phase 1)

- Golden corpus bit-identical through the packaged build (or reviewed-accepted diffs).
- Unit coverage ≥80% on engine + exporters.
- `pnpm build` produces a working single-file edition.
- No `eval(` anywhere in src or packages.

## Gate record (2026-08-30/31)

- **Golden gate GREEN in CI** on the packaged build (`b399e28`, run 33325544392):
  every matrix case vs `v1-classic`, zero failures. Engine parity additionally
  proven twice at the byte level: the in-repo `RUN_PARITY=1` suite (71/71) and a
  real-Chromium harness during the port (68 cases, 724 KB HTML per side).
- **Coverage**: engine 99.1% stmts · export-docx 99.0% · mathml-omml 91.2%
  (importers 120 tests, pdf-editor 89 — DOM-heavy flows stay with the qa/ suites).
- **764 unit tests**, tsc 7 clean, biome clean (rule set annotated for the 1:1 port).
- **All four `(0,eval)` sites dead** — Blob-URL module imports; grep-verified zero
  `eval(` in src/ and packages/.
- Ported `src/js` modules deleted once the CI gate passed; `src/js` now holds only
  the Phase-2 chrome (`main.js`, `live-edit.js`).
