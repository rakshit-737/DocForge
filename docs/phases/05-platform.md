# Phase 5 — Platform & distribution (gate record)

MASTER-PROMPT §6 Phase 5 asks for five things and one gate. This is what
shipped, and what each claim rests on. Dates are 2026-09-04 unless stated.

| Deliverable | State | Where |
| --- | --- | --- |
| Single-file edition rebuilt from the same packages | DONE (Phase 1) | `build.mjs` bundles `packages/*` into `dist/DocForge.html`; the golden gate proves the output is byte-identical to the classic edition |
| Released as a GitHub Release artifact on every tag | DONE (`d841a3a`) | `.github/workflows/release.yml` |
| File System Access: open/save in place, download fallback | DONE (`1fb16b1`) | `apps/web/lib/project-file.ts`, wired in `studio-shell.tsx` |
| CLI: `docforge build report.md --pdf --docx` | DONE (`6af571b`) | `packages/cli` |
| `@docforge/engine` + `@docforge/mathml-omml` publishable to npm | READY — publish needs the owner's token | `packages/*/build.mjs`, `publishConfig`, release workflow |
| **Gate:** single-file works from `file://` with the network blocked | PASSES | `qa/offline-gate.mjs`, in CI |
| **Gate:** CLI builds the golden corpus headlessly | PASSES | `qa/cli-corpus.mjs`, in CI |
| **Gate:** the npm builds import under plain Node | PASSES | `qa/dist-consume.mjs`, in CI |

---

## Files open in place

Where the browser hands back a writable handle, **Open** goes through the File
System Access picker and the studio keeps the handle. **Save** then writes
straight back to that file — markdown to a `.md`, project JSON to a
`.docforge.json` — with no second picker and no download. The desk names the
file it would overwrite, beside the autosave stamp; the Save tooltip says so
too. Everywhere else (Firefox, Safari, any browser without the API) the hidden
`<input type=file>` and the download road do exactly what they always did.

The handle is deliberately fragile. `applyWithUndo` — the one funnel every
document replacement passes through — calls `forgetOpenFile()`, and only the
open road re-adopts, so a template load can never be saved over the reader's
manuscript. A converted `.docx` or `.pdf` is never adopted either: writing
markdown over those bytes would be a lie about what the file is. If the
handle's permission is gone (a reload drops it), the save falls through to the
picker rather than failing.

**Probed live** (stubbed picker — the native one cannot be driven headless, and
what is under test is our road, not Chromium's dialog): 12/12. Open loads and
adopts · the desk names the file · Save writes **markdown** back to the same
handle · no save picker is raised · the toast names the file · a template drops
the handle · the template's save raises the picker and lands in a fresh
`.docforge.json` instead of the manuscript · with the API deleted, Save
downloads and Open falls back silently · console clean.

## The offline gate

`node build.mjs && node qa/offline-gate.mjs`

`dist/DocForge.html` is opened from `file://` in a browser whose every non-file
request is **aborted at the request layer** — not merely offline, so a warm
cache cannot rescue a build that reaches for a CDN. Verified: boots and
composes (5 pages) · embedded typefaces resolve · recomposes after an edit ·
exports a `.docx` that is a real PK zip · **zero network attempts** · console
clean. One attempted request fails the run.

## The CLI corpus gate

`node qa/cli-corpus.mjs` converts all 17 golden-corpus torture documents
through `@docforge/cli` with no browser: 17/17 `.docx`, each verified to be a
real OOXML package carrying `word/document.xml` and `[Content_Types].xml`
(2.0 MB total). `--pdf` additionally prints two of them through headless
Chromium and checks the `%PDF-` header and size. This is the evidence for
"the core is genuinely headless".

## npm packages

Both packages now build a publishable artifact:

- `packages/<pkg>/build.mjs` — tsc emits ESM + declarations into `dist/`, then
  every relative specifier gains its `.js`. The sources keep them extensionless
  because Turbopack cannot map `.js` → `.ts` inside `transpilePackages`, and
  Node's ESM resolver cannot load them without: the workspace and npm want
  opposite things, so the build reconciles them instead of either side bending.
- `publishConfig` swaps `main`/`types`/`exports` to `dist/` at publish time
  (verified against a real `pnpm pack` tarball), so the workspace keeps
  compiling live `src/*.ts` while npm consumers get compiled output. The
  tarball carries `src/` too.
- `qa/dist-consume.mjs` imports `dist/index.js` from plain Node ESM — no
  bundler, no transpiler — and renders a document, checks `dynamicCss`, the
  `./global` ambient entry, and both mathml converters. Nothing else in the
  repo would catch a dist that bundlers forgive and Node rejects.
- Version `0.1.0` on both: first public release, API not yet frozen.

**The publish itself is the owner's to make.** `release.yml` builds and
publishes both packages on a `vX.Y.Z` tag, but only when an `NPM_TOKEN` secret
exists; without it those steps skip and the tag still cuts a GitHub release. To
turn it on: create an npm automation token with publish rights to the
`@docforge` scope, add it as the repository secret `NPM_TOKEN`, and push a
dotted version tag.

## What is not in this phase

`apps/single-file` as a separate app directory never became necessary — the
root `build.mjs` already assembles the forever edition from the same packages,
and the golden gate holds it to the byte. Splitting it into an app for its own
sake would add a build surface without adding a guarantee.
