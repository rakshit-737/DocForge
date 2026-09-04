# Phase 6 — Feature waves (record)

MASTER-PROMPT §6 Phase 6 pulls from the §8 idea bank in waves, with a gate per
feature: spec note → tests → docs → **the golden corpus still green**. Every
row below is shipped, tested and probed on the built studio; the golden gate
ran on each commit and stayed green, because none of this changes what an
existing document renders to.

Dates 2026-09-04 unless stated.

## Wave 1

| §8 item | State | Evidence |
| --- | --- | --- |
| Real CSL citations + BibTeX import (§8.3) | **Import half shipped** (`c6407e6`); the CSL engine waits on the owner | `packages/importers/src/bib-import.ts`, 37 tests · merge policy in `apps/web/lib/bibliography.ts`, 10 tests · live probe 10/10 |
| Mermaid diagrams (§8.2) | **Waiting on the owner** — needs a dependency far over §5.10's 100 KB gzipped | — |
| Custom font upload (§8.2) | **Shipped** (`2bd907f`) | `lib/font-file.ts` + `lib/user-fonts.ts`, 19 tests against the 26 real font files this repo ships · live probe 10/10 including an embedded face in the exported .docx |
| Version history (§8.1) | **Shipped** (`b4ebb0e`) | spec `docs/specs/version-history.md` · `lib/versions.ts` + `components/version-panel.tsx`, 18 tests · live probe 10/10 |
| Direct PDF export spike (§8.4) | **Shipped as the CLI's `--pdf`** (`6af571b`) | real Chromium print with bookmarks and a tagged structure tree; `qa/cli-corpus.mjs` prints two corpus documents in CI |

Two more §8.1 items came with the wave because they cost little and are felt
every minute: **slash commands** (`dc1a908`, 20 tests, probe 15/15) and **smart
lists** (`b5b2eed`, 20 tests, probe 9/9).

## Wave 2

| §8 item | State | Evidence |
| --- | --- | --- |
| Multi-document workspace (§8.1) | **Shipped** (`c043189`) | `lib/workspace.ts` + `components/documents-menu.tsx`, 9 tests · live probe 12/12 |
| PDF toolbox (§8.4) | **Shipped** (`73d96be`) | `packages/pdf-editor/src/page-tools.ts`, 19 tests on real PDFs · live probe 9/9 |
| More export targets — standalone HTML (§8.4) | **Shipped** (`373be8b`) | live probe 12/12, including re-opening the exported file with every network request aborted |
| Share target / open-with (§8.5) | **Shipped** (`3a42346`) | `lib/launch-files.ts`, 12 tests · live probe 10/10 |
| OCR (§8.4), charts (§8.2), track-changes (§8.1) | Not started | OCR needs tesseract.js — another owner decision |

## What the multi-document workspace retired

§8.1 says the workspace "kills the destructive-replace bug class for good", and
that is exactly what it does. Templates, imports and project files now open as
their own document; "New document" needs no confirmation because it destroys
nothing; Delete is the only verb that removes anything, and it asks. The one
exception is a blank desk, which a template fills rather than leaving an empty
document behind.

## Bugs the probes found in our own chrome

Worth recording, because each was invisible to unit tests and would have
reached readers:

- **Radix menus stayed mounted after closing.** The menus carried an
  `animation:` unconditionally, so the exit `animationend` never fired, the
  content sat over the desk with `data-state="closed"`, and it swallowed the
  next click on its own trigger — every second click on a menu did nothing.
  Fixed as one rule in `globals.css` scoped to `[data-state="open"]`.
- **The launch handle was adopted too early.** Opening a document clears the
  open-file target by design, so claiming the handle before the load was
  immediately undone and Save fell back to the picker.
- **The launch consumer was registered per render**, and each registration
  re-delivers the same launch: the file opened twice.
- **`loadFontData` re-fetched installed faces**, 404ing on every export,
  because a reader's typeface is EMBEDDED but has no file under `/fonts`.

## Still waiting on the owner (MASTER-PROMPT §5.10)

Each of these needs a decision that is not ours to make:

1. **Mermaid diagrams** (§8.2) and **a real CSL engine** (§8.3) — both need
   dependencies well over 100 KB gzipped, in a product whose forever edition
   ships as one file.
2. **OCR** (§8.4) — tesseract.js plus language packs, same question at a
   larger size.
3. **npm publish** — `@docforge/engine` and `@docforge/mathml-omml` are built,
   verified and wired into the release workflow; publishing needs an
   `NPM_TOKEN` secret on the repository (see `docs/phases/05-platform.md`).

Everything else in waves 1 and 2 that needed no new dependency is done.
