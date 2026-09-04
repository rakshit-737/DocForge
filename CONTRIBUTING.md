# Contributing to DocForge

The document output is the product. Everything in this guide exists to protect one thing: a manuscript that rendered correctly yesterday renders identically today, in the paginated preview, the printed PDF and the exported `.docx`, unless a change was made deliberately and signed off with evidence.

## Toolchain

- **Node 24** — pinned in `.nvmrc`. Use it; the CI does.
- **pnpm via corepack** — the exact version is pinned in the root `package.json` `packageManager` field. Never `npm install` or `yarn` in the workspace root (the one exception: the `v1-classic` worktree that the golden runner and the Pages deploy build for themselves uses its own committed `package-lock.json` via `npm ci` — the runner handles that, not you).

```bash
corepack enable
corepack pnpm install
```

Build targets:

```bash
node build.mjs                             # the single-file forever edition → dist/DocForge.html
corepack pnpm --filter @docforge/web dev   # the web studio, dev server
corepack pnpm build                        # turbo build across packages + the single-file edition
```

`dist/`, `qa/out/`, coverage and `.next/` are gitignored — built artifacts are never committed.

## The merge law: the golden gate

MASTER-PROMPT §5.1: **output parity until deliberately improved.** The golden-master comparison gates every merge that touches the engine, the renderer, the exporters, `doc.css` or the themes — and it runs in CI on every push and PR, so it gates everything else too.

```bash
corepack pnpm golden          # = node qa/golden/run.mjs --against v1-classic
```

This builds the `v1-classic` tag fresh in a throwaway worktree, builds HEAD, captures both through the real UI in headless Chromium, and compares page screenshots, rasterised print-PDFs, and normalised `.docx` XML. Details and day-to-day workflow (`--capture before` / `--capture after` / `--compare`, `--only`, `--jobs`) are in `qa/golden/README.md`.

The law has two clauses:

1. **Never claim parity — prove it.** "It looks about the same" is not acceptance. Green gate or the work isn't done.
2. **If output must change, show the diff and get sign-off.** Intentional changes come with the magenta diff masks from `qa/out/golden/diff/` attached to the PR and an explanation of why the new output is right. A case marked `postBaseline: true` in `qa/golden/matrix.mjs` exercises markup the baseline edition doesn't have; those are compared by `--compare before after`, not by the tag comparison — new constructs are still gated, just against themselves.

## The suites, and how to run them

| What | Command | Notes |
| --- | --- | --- |
| Lint + format | `corepack pnpm lint` | Biome, whole workspace. Zero errors is the bar. |
| Typecheck | `corepack pnpm typecheck` | turbo across packages; `apps/web` uses `tsconfig.typecheck.json`. |
| Unit tests | `corepack pnpm test` | Vitest across packages: parser table-driven per construct, exporters, themes, typography. |
| Byte-parity suite | `RUN_PARITY=1 corepack pnpm test` | Asserts the typed engine's output byte-for-byte against the frozen classic fixtures (`packages/engine/test/parity.test.ts`). CI always arms it. |
| Golden gate | `corepack pnpm golden` | The merge law, above. |
| UI suites | `node qa/<suite>.mjs` | Headless Playwright driving the built `dist/DocForge.html` by its real selector ids — build first with `node build.mjs`. Suites: `smoke`, `deep`, `borders`, `import-smoke`, `manuscript-smoke`, `cmdk-smoke`, `convert-smoke`, `firstrun-smoke`, `font-smoke`, `pdfedit-smoke`, `run-styles-smoke`, `proposal`, `tier4`; `run.mjs` is the quick end-to-end pass, `uishot.mjs` takes chrome screenshots. |
| Offline gate | `node build.mjs && node qa/offline-gate.mjs` | Opens `dist/DocForge.html` from `file://` with every non-file request aborted. Zero network attempts is the bar — the forever edition's whole promise. CI runs it. |
| CLI corpus gate | `corepack pnpm --filter @docforge/cli build && node qa/cli-corpus.mjs` | Converts all 17 golden-corpus documents headlessly; `--pdf` also prints two through Chromium. CI runs the `.docx` half. |
| npm build gate | `node qa/dist-consume.mjs` | Imports the two publishable packages' `dist/` from plain Node ESM (build them first). Catches a dist that bundlers forgive and Node rejects. CI runs it. |
| Watermark & letterhead | `node qa/stamp.mjs` | Builds one document both ways through the CLI, opens the `.docx` with the real **Word** and prints that too, then counts the ink in both rasters: the mark and the logo are there, at a comparable size, in both — and gone when the settings are cleared. Windows + Word only, like the contact sheet. |
| Visual contact sheet | `node qa/visual.mjs` | Renders the torture document in every theme, exports both formats, and — on Windows with Office installed — converts the `.docx` through real Word for a side-by-side sheet. Optional lane; don't block on it if you have no Word. |

A change is ready when lint, typecheck, unit tests (parity armed) and the golden gate are green, plus whichever UI suites cover the surface you touched.

## Cutting a release

Push a dotted version tag (`v2.0.0`, `v2.1.0-rc.1`) and `.github/workflows/release.yml`
builds the forever edition, attaches `dist/DocForge.html` plus its SHA-256 to a
generated GitHub Release, and — **only if the repository carries an `NPM_TOKEN`
secret** — builds and publishes `@docforge/engine` and `@docforge/mathml-omml`.
Without the secret those steps skip and the tag still cuts a release. The frozen
`v1-classic` baseline tag can never re-release: the workflow only matches dotted
versions.

Publishing to npm is a one-way door, so it stays a deliberate act by the owner:
create an npm automation token with publish rights to the `@docforge` scope, add it
as the `NPM_TOKEN` repository secret, then tag. See `docs/phases/05-platform.md`.

## The dialect is additive-only

MASTER-PROMPT §5.2 and Appendix B: existing markup **never changes meaning**. A document written last year renders the same forever. That means:

- Never alter what an existing construct produces, in any of the three outputs. That includes "fixes" to spacing, class names in generated HTML, or `.docx` run properties — those are the output.
- New constructs are additive and must not collide with prose: every new inline mark ships with specimens in `qa/golden/corpus/17-adversarial.md` — first in its escaped form, then in its most plausible collision with ordinary text — so the baseline fails the day a lookalike starts to trigger, not in an author's hands.
- A new construct also ships: a golden corpus document (or additions to the right cluster file), a `matrix.mjs` case (marked `postBaseline: true` until it exists in a tagged baseline), parser unit tests, and its row in `docs/DIALECT.md` — in the same PR.
- `doc.css` and the rendered document are product surface. There are no "cleanups" there, only deliberate, gated changes.

## Commit style

The convention is what `git log` shows, so read a page of it before writing. In short:

- **Imperative or plain-declarative subject that says what actually happened**, usually with a type/scope prefix: `feat(web):`, `fix(ci):`, `qa:`, `docs:`, `port:`, `build:`, `lint:`, `templates:`, `chore:`. A prefix-free declarative subject is fine when it reads better ("The converter completes: any document in, Markdown file out").
- **The body says why**, not just what — and it records the verification actually run: "all eight suites green", "biome and tsc clean", "live-edit probe 12/12". Evidence in the commit message is the house habit; unverified claims are not.
- Small commits, honest messages. No "fix stuff", no "WIP", no bundled unrelated changes.

## Pull requests

- UI changes come with before/after screenshots — and look at them yourself before claiming improvement.
- Docs move with code: `README.md`, `docs/DIALECT.md` and in-app Help update in the same PR as the feature.
- New dependencies need a line of justification (size, maintenance, licence) in the PR. Nothing over 100 KB gzipped without discussion first.
- Accessibility is a gate, not a phase: chrome changes keep the axe run clean (WCAG 2.2 AA) and keyboard-complete.
- Ask before: deleting files, changing the dialect, altering export output, or scope beyond the issue at hand.

## Where things live

See the monorepo map in `README.md`. The bug ledger is `docs/ledger.md` (each entry links its GitHub issue; each fix links the test that would have caught it), phase plans are `docs/phases/`, and the design system — square corners, ink rules, one red, the whole copy desk — is `DESIGN.md`, which is standing law for anything visual.
