# @docforge/engine

The DocForge dialect engine: Markdown plus the DocForge dialect in, a fully themed
document DOM out. Every surface in the product — the paginated preview, the PDF
export, the `.docx` exporter's walk — renders from what this package produces.

```bash
npm i @docforge/engine
```

```js
// marked, katex and highlight.js are read as ambient globals (the classic
// contract the single-file build depends on) — assign them before importing.
globalThis.marked = marked;
globalThis.katex = katex;
globalThis.hljs = hljs;

const { render, dynamicCss } = await import("@docforge/engine");
const { doc, meta } = render(source, settings, attachments);
```

The published package ships compiled ESM plus declarations (`dist/`), built by
`node build.mjs`; the tarball carries `src/` as well. Inside this monorepo the
workspace copy resolves to `src/index.ts` so every surface compiles the live source,
and `publishConfig` swaps the entry points at publish time. A browser needs a DOM;
under Node give it one (happy-dom or jsdom) before calling `render`.

## What it is

The engine is the 1:1 TypeScript port of the classic `src/js/engine.js`, split into
`parse` / `render` / `themes` / `util` internally while keeping the public surface
**exactly** the classic `Engine` global — the same 17 members, same names, same key
order:

```
render, dynamicCss, fontFaceCss, tints, PAGES, MARGINS, FONTS, FACES,
EMBEDDED, CUT_FILE, fmtDate, esc, RE_SHOT, WORD_CATALOG, HL_COLORS,
sysStack, faceName
```

The heart of it:

```ts
function render(source: string, settings: Settings, attachments?: Attachments): RenderResult;
// RenderResult = { doc: HTMLDivElement; meta: RenderMeta }
```

A side-effect entry, `@docforge/engine/global`, assigns the classic
`globalThis.Engine` for the single-file build.

## The typed token contract

Every dialect construct is a **marked tokenizer extension with a typed token** —
never a preprocess regex. The contract lives in [`src/types.ts`](./src/types.ts) and
is exported from the package root: `DialectToken` is the discriminated union
(`DfSpanToken`, `DfMarkToken`, `DfSupToken`, `DfSubToken`, `DfUnderToken`, …),
alongside `Settings`, `Attachments`, `RenderResult`, `RenderMeta`, `SpanAttrs`, and
the theme shapes (`PageSpec`, `MarginSpec`, `Tints`). Tokenizer-first is a hard rule:
it is what keeps injected HTML attributes (KaTeX's `data-tex`, span attributes)
untouched by later passes.

The dialect itself — every construct, its syntax, and its rendering — is specified in
[`docs/DIALECT.md`](../../docs/DIALECT.md) at the repo root.

## Parity guarantees

The port is mechanical and the proof is byte-level, twice over:

- **In-repo parity gate** — `RUN_PARITY=1` arms [`test/parity.test.ts`](./test/parity.test.ts),
  which renders every golden-matrix case through this package and byte-compares
  against the classic engine (71/71 green). The classic source is frozen as a fixture
  inside the package, so the gate outlives `src/js/engine.js` and guards every future
  refactor against drift from classic:

  ```sh
  RUN_PARITY=1 pnpm --filter @docforge/engine test parity
  ```

- **Real-Chromium harness** — during the port, 68 corpus cases (~724 KB of HTML per
  side) compared byte-identical in a live browser.

- **The golden gate** — the product-level backstop in [`qa/golden/`](../../qa/golden/)
  (see its README): the torture-document corpus rendered through the packaged build,
  screenshots + exports compared against the `v1-classic` baseline in CI. Green on
  every matrix case.

Known classic bugs are **preserved, not fixed** (parity first) and documented at
their sites in the source — ledger candidates for a post-parity phase.

## Working on it

```sh
pnpm --filter @docforge/engine typecheck   # tsc -p tsconfig.json
pnpm --filter @docforge/engine test        # vitest (parity suite skipped unless armed)
```

Top-level side effects: only `src/parse.ts` touches anything at import time (the two
`marked.use` calls, gfm before extensions — the same relative order the classic IIFE
ran them in). Keep it that way.

## License

MIT, like the rest of [DocForge](https://github.com/rakshit-737/docforge).
