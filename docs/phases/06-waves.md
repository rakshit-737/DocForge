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

## Beyond the waves, still dependency-free

| §8 item | State | Evidence |
| --- | --- | --- |
| Headers/footers editor (§8.2) | **Shipped** (`a72c2a3`) | four slots with {title} {author} {date} {kicker} {section}; {section} stays live on BOTH sides (string(sect) / STYLEREF). 18 engine tests, 13 export tests reading the real OOXML, probe 10/10, parity green, and a golden matrix case (`1665aa8`) |
| Equation palette (§8.2) | **Shipped** (`52f3648`) | searchable by what a symbol does; 23 tests, probe 8/8 |
| One zoom instrument in both modes (ledger I4) | **Shipped** (`d5db7a0`) | shared `<ZoomCluster>`; the pdf-editor api gained setZoom/getZoom/fitZoom/onZoomChange; probe 9/9 |
| Focus & flow (§8.1) | **Shipped** (`d124f28`) | prose word count + breakdown + session goal + typewriter scrolling in focus mode; 24 tests, probe 11/11 |
| Batch convert (§8.4) | **Shipped** (`a2c7b77`) | Open and drop both take several files; one queue, awaited, so two imports can't race; probe 5/5 |
| Theme designer (§8.2) | **Shipped** (`9921e27`) | save a look, apply it anywhere, share it as JSON; the look/content line is what the 18 tests press on; probe 10/10 |
| Watermark & letterhead (§8.2) | **Shipped** | a diagonal word and a logo in the top margin, in BOTH formats — Word gets a real VML watermark shape and a real header image. 19 engine tests, 11 export tests reading the OOXML, studio probe 12/12, and `qa/stamp.mjs`: one document built both ways, the .docx opened and printed by the real Word, the ink counted in both prints |
| Smart paste (§8.1) | **Shipped** | the two halves that were missing: a tab-separated range becomes a table, a URL over a selection links it — in BOTH editions. 14 unit tests, studio probe 9/9, forever-edition probe 7/7. The paste toast also stopped lying in both: the converted text is a second, isolated undo step now, so one Ctrl+Z really does return the clipboard's own text |

The headers/footers work carried one trap worth remembering: adding the
new `@bottom-left` / `@bottom-right` boxes to `@page cover`
unconditionally changed the CSS of **every** document, including ones
that set no footer at all. The byte-parity suite caught it immediately —
the exemption list now grows only when a foot slot exists. Page numbers
are deliberately not tokens in the side slots: the folio counts a dual
front-matter/body sequence that a CSS margin box cannot express, and
promising `{page}` there would promise something one of the two formats
could not keep.

## What the stamp work taught about print

Two traps, both invisible on screen and both caught only by looking at the
printed page — the reason `qa/stamp.mjs` rasterises a real print rather than
asserting on CSS:

- **Paged.js gives `.pagedjs_page` a different computed height in print media
  than on screen.** A watermark centred on that box with percentages sits
  correctly in the preview and drifts up the sheet in the PDF. The mark is
  anchored in the page's own millimetres now — the sheet's corner is the one
  thing both media agree about.
- **Chrome sizes generated content images from their own pixels when it
  prints.** A CSS rule that sizes a margin box's `content: url(...)` works on
  screen and is ignored on paper: a 480-pixel logo landed 127 mm wide, straight
  through the running head. The letterhead is wrapped in an SVG that declares
  its printed size in millimetres, because an intrinsic size cannot be ignored.

- **A negative layer sinks out of sight.** Word draws its watermark behind the
  prose, and `z-index: -1` is the web's way to say that — but on a page whose
  own background paints after it, the mark vanishes completely. It rides over
  the page instead, in a tenth of the page's ink, so the prose reads straight
  through it.
- **The harness threw on a build older than the setting.** `applyDoc` assumed
  every mapped control existed, so the moment the maps grew, the BASELINE side
  — the v1-classic tag, which predates all of them — raised a TypeError and
  the case failed into two 120-second retries. It skips what a build has never
  heard of now, and hands back the list, which is how `stamped` was caught
  asking for a 12 mm letterhead: a height no drawer offers, so the select kept
  14 and the case had been proving the default.
- **The golden gate could not express the settings at all.** The harness drives
  the forever edition's real drawer, and that drawer had no fields for the
  running-head slots, `apa7`, or either stamp — so the `running-heads` case had
  been capturing a document with the classic furniture and proving nothing since
  the day it was added. The forever edition now carries all three groups of
  controls, and `qa/_drive.mjs` knows them; the `stamped` case renders what it
  claims to.

Both of the first two were found by rendering the PDF and looking at it. Neither would have
failed a unit test, and the second would have shipped a broken running head to
every reader who uploaded a logo.

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
- **A multi-file drop fired every import at once.** Harmless while an import
  replaced the document; once each one CREATED a document, two racing imports
  would interleave a save with a create and lose a manuscript. Both doors
  share one awaited queue now.
- **Two scroll regions no keyboard could reach** (axe: the bench's proof
  scroller and an overflowing toolbar row). The row earns a tab stop only
  while it actually scrolls, so ledger A4's one-stop strip survives.

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
