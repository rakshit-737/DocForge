# Phase 0 — Baseline & safety net

Plan of record. Scope: MASTER-PROMPT.md §6 Phase 0 only. No Phase 1 work.

## State found (2026-08-30)

- Working tree clean at `5d7b645`; the §1.4 WIP already landed in earlier commits.
  Untracked only: `.claude/`, `.impeccable/questions/`, `.superbrain/`, `.vscode/`, `MASTER-PROMPT.md`.
- Tracked droppings are just three files: `dist/DocForge.html`, `.impeccable/critique/…md`, `.impeccable/design.json`.
  `qa/out/`, `qa/*.png|pdf|docx`, `.opencode` were already ignored.
- Pages workflow uploads the whole checkout (`path: .`) — it must start building in CI
  the moment `dist/` stops being tracked, or deploy breaks.

## Steps

1. **Tag `v1-classic` at `5d7b645`** — the pure classic state, before any Phase 0 commits.
2. **Commit MASTER-PROMPT.md + this plan.**
3. **Hygiene commit** — extend `.gitignore` (`dist/`, `.impeccable/`, `.superbrain/`, `.claude/`,
   `.vscode/`); `git rm --cached` the three tracked droppings (files stay on disk).
4. **CI deploy rework** — `pages.yml` builds in CI (`npm ci && node build.mjs`), assembles a site
   dir (`index.html` + `dist/DocForge.html` + `classic/DocForge.html` built from the `v1-classic`
   tag) and deploys that. `/classic` keeps serving the frozen classic build for the whole migration.
5. **Golden corpus** — 15–25 torture documents in `qa/golden/corpus/`, one per dialect cluster
   (Appendix B coverage), plus the existing `qa/torture.md`. Curated case matrix
   (`qa/golden/matrix.mjs`): docs × the theme/paper/margins/border/cover/numbering combinations
   that matter (~35 cases), not the full cross-product.
6. **Capture + compare runner** (`qa/golden/`):
   - `capture.mjs` — for one built `DocForge.html`: per case, (a) screenshot every
     `.pagedjs_page`, (b) print-PDF via Chromium (`page.pdf`, `preferCSSPageSize` — same engine
     as the in-app print dialog) rasterised per page via the existing `qa/_raster.mjs`,
     (c) exported `.docx` unzipped (small self-contained zip reader, no new dependency) with
     normalised XML members (`word/document.xml`, styles, numbering, footnotes, settings,
     fontTable, content types, rels; font binaries hashed raw; `docProps/` skipped — timestamps).
     Emits `manifest.json` with SHA-256 per artifact.
   - `compare.mjs` — two capture dirs: pixel-diff rasters/screenshots (≤0.1% differing pixels
     per page), exact match on normalised XML. Report + non-zero exit on failure.
   - `run.mjs` — orchestrator. `--against v1-classic` mode: build the tag in a temp worktree,
     build HEAD, capture both, compare.
   - **Baseline storage = the `v1-classic` tag itself, rebuilt fresh each run.** No frozen
     binaries in git (that was the hygiene complaint); both sides render on the same
     machine/runner, so no cross-platform font-rasterisation noise. Hashes in the manifest
     make "identical" checks trivial; images make review of accepted diffs possible.
7. **`golden.yml` CI workflow** — on push/PR: build both sides, run the comparison, upload the
   diff report as an artifact. This is the merge gate for everything that later touches
   engine/render/exporters.
8. **Ledger re-verification** — re-verify every §3.1/§3.2/§3.3-fixable item against the current
   build (code inspection + headless probes); open one GitHub issue per confirmed item via `gh`,
   labelled `ledger`; record the verdict map in `docs/ledger.md`.

## Gate

- `node qa/golden/run.mjs --against v1-classic` green locally and in CI (trivially — HEAD only
  adds docs/CI/QA files, the built app is byte-identical to the tag).
- Ledger triaged: every §3 item has a verdict (CONFIRMED → issue #n / FIXED-SINCE / DEFERRED-BY-DESIGN).
