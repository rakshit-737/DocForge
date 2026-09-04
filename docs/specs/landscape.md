# Landscape

*MASTER-PROMPT §8.2 — "landscape pages for wide tables — all with DOCX
equivalents." Written alongside the code, kept true after it.*

## What it is

A document-wide orientation. `orientation: "portrait" | "landscape"` turns the
sheet in the preview, the PDF and the .docx together. Wide tables, ledger
pages, specimen sheets — the reasons people reach for landscape — all work
without touching a line of the manuscript.

## The one idea

Everything downstream of "which sheet is this?" has to agree on the answer, so
the answer is given once:

```ts
Engine.pageSpec(settings)   // PAGES[page], with orientation applied
```

The CSS builder, the margin boxes, the text column, the watermark's anchor and
the .docx's tab stops all measure from that spec. Portrait returns the `PAGES`
entry itself — the same object, not a copy — so an upright document emits
exactly the CSS and OOXML it always did, which is what keeps byte parity and
the golden master honest.

## The one asymmetry

Word is the exception, and it is worth stating plainly because it looks like a
bug in the exporter until you know:

| | width | height |
|---|---|---|
| CSS / preview | the turned sheet (297 mm) | the turned sheet (210 mm) |
| `w:pgSz` | written by the library as the turned sheet | likewise |
| What the library is GIVEN | the **upright** sheet (210 mm) + `w:orient="landscape"` | (297 mm) |

The `docx` library swaps `w:w` and `w:h` itself whenever the orientation is
landscape. Handing it the already-turned sheet would turn it back, so the
exporter passes `Engine.PAGES[page]` for the page size and `pageSpec()` for
every measurement it makes itself.

## What is deliberately not here

**Per-section landscape** — a wide table turned sideways inside an upright
report — is the more valuable half of §8.2's line, and it needs a marker in
the dialect to say where the turned section begins and ends. The dialect is
the owner's to change (§5.10), so this ships the document-wide half and says
so rather than inventing syntax.

## How it is proved

- `packages/engine/test/orientation.test.ts` — the spec, the CSS, and the
  promise that portrait is byte-identical.
- `packages/export-docx/test/watermark.test.ts` — `w:pgSz` comes out
  `16837 × 11905` with `w:orient="landscape"`, and upright stays `11905 × 16837`.
- `qa/golden/matrix.mjs` → `landscape-tables`, the widest corpus document on a
  turned sheet, captured through the forever edition's own drawer.
- One document built both ways through the CLI: the PDF prints 842 × 595 pt,
  and real Word's print of the .docx comes back 842 × 596.
