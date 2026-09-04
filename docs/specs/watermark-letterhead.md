# Watermark & letterhead

*MASTER-PROMPT §8.2 — "DRAFT/CONFIDENTIAL diagonal watermark; logo upload placed
in header; both formats." One page, written before the code, kept true after it.*

## What a reader asked for

Two marks that say something about the document without being part of it:

- a **watermark** — a word set diagonally across every page, so a draft cannot
  be mistaken for a submission, or a specimen for the real thing;
- a **letterhead** — the department's or the company's logo standing in the top
  margin, where a printed letter carries it.

Neither is content. Both must be true of the PDF **and** the .docx, because a
document that carries DRAFT on paper and nothing in Word is worse than one that
carries it nowhere.

## The shape of it

| | The PDF (Paged.js) | The .docx (Word) |
|---|---|---|
| Watermark | `.pagedjs_page::before`, real text at 11% ink, rotated −45° | a VML textpath (`_x0000_t136`) parked in the header |
| Letterhead | the `@top-center` margin box | an `ImageRun` in the header, above the running head |
| The cover | exempt — as it is from the page border | exempt — the cover section declares no header at all |

Three settings, all absent by default:

```
watermark       ""     the word; empty means no mark
letterhead      ""     a PNG or JPEG data URL; empty means none
letterheadSize  "14"   its printed height in millimetres (6–30)
```

Both editions write them: the studio from the drawer's **Watermark &
letterhead** panel, the forever edition from the same group in its own drawer
(which gained the running-head slots and `apa7` at the same time — the golden
harness drives that drawer, and a setting it cannot express is a case that
proves nothing). The CLI takes `--watermark`, `--letterhead <file>` (inlined as a data URL, PNG or
JPEG under 512 KB) and `--letterhead-size <mm>`.

## The decisions worth writing down

**One measurement, two formats.** `Engine.watermarkMetrics()` sizes the word
from the page's diagonal and returns the box it fills. The CSS sets the type at
that size; Word stretches its textpath into exactly that box. If each side
measured for itself, the same document would carry two different stamps —
which is the failure the whole gate system exists to catch.

**Text, not a background.** The mark is drawn as text so it prints whether or
not the reader ticks "background graphics" in the print dialog. Nothing in
`doc.css` sets `print-color-adjust`, so a background-image watermark would
vanish on paper for half the people who used it.

**Millimetres, not percentages.** Paged.js computes a different height for
`.pagedjs_page` in print media than on screen, so a mark centred on that box
drifts up the sheet when the document is actually printed. The mark is anchored
at `top: <half the page height>mm` instead; the sheet's own corner is the one
thing both media agree about.

**The mark rides over the page, in translucent ink.** A negative layer sinks
behind the sheet's own background and disappears; painting it above the flow in
opaque ink blots out every line it crosses. So it is set in a tenth of the
page's ink — over white it reads as the light grey Word fills its own shape
with, and over a line of type every glyph stays legible.

**The logo carries its own size.** A margin box's content is *generated*
content, and Chrome sizes a generated image from its own pixels when it prints
— the CSS rule that sizes it correctly on screen is ignored on paper, and a
480-pixel logo lands 127 mm wide across the running head. So the letterhead is
wrapped in an SVG that declares its printed size in millimetres: an intrinsic
size cannot be ignored by either medium.

**A logo nobody can measure is not printed.** `Engine.imageMetrics()` reads the
pixel size out of the PNG/JPEG/GIF header — the letterhead is never an element
on the page, so nothing has measured it. If the header cannot be read, neither
format draws the logo. A stretched letterhead is worse than none.

**A saved look does not carry either.** `LOOK_KEYS` in
`apps/web/lib/theme-presets.ts` deliberately excludes all three settings: a
DRAFT stamp belongs to a document, not to a house style, and a shared theme
file has no business carrying half a megabyte of somebody's logo.

**Nothing is emitted unless asked for.** A document that sets neither produces
exactly the CSS and exactly the OOXML it always did — the running-head work
proved how easily one new margin box changes every document's bytes. The
byte-parity suite and the golden master hold that line.

## How it is proved

- `packages/engine/test/watermark.test.ts` — the metrics, the CSS, the
  exemptions, and the two "asks for neither" cases.
- `packages/export-docx/test/watermark.test.ts` — the VML in the header part,
  the box Word is given, the image part and its relationship.
- `qa/stamp.mjs` — one document built both ways through the CLI, the .docx
  opened and printed by the **real Word**, both prints rasterised, and the ink
  counted: the mark and the logo are there, at a comparable size, in both — and
  gone when the settings are cleared. Windows + Word only.
