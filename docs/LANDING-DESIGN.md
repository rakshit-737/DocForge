---
name: DocForge — the drawing sheet (landing)
description: An engineering drawing set printed as a cyanotype — line-white rules and ISO lettering on blue, the product's real page as the part being drawn, one red stamp. Governs the landing route only.
colors:
  # ---- the ground (CSS vars on .sheet-root, apps/web/app/landing.css) ----
  cyanotype: "#103474"                          # --cy — the coated sheet; reads ≈#12397a once the tooth and coat layers sit on it
  recess: "rgba(0, 0, 0, 0.28)"                 # literal on .tb .stampcell — the APPROVED cell's translucent darkening; the print shows through
  # ---- the lines ----
  line-white: "#e7edf9"                         # --ln — every drawn line: frame, rules, dimensions, outlines, focus ring
  line-white-soft: "rgba(231, 237, 249, 0.42)"  # --ln-soft — trim line, pane borders, zone ticks, notes' top rule, resting link rules
  line-white-faint: "rgba(231, 237, 249, 0.18)" # --ln-faint — row rules between notes and table rows
  # ---- the lettering ----
  lettering: "#f3f6fc"                          # --tx — primary lettering; the emphasised word in a note
  lettering-2: "#bccbea"                        # --tx-2 — secondary lettering: keys, tags, zones, note bodies, captions
  # ---- the one red ----
  check-print-red: "#c8361f"                    # --stamp — the OPEN THE STUDIO stamp, and nothing else
  check-print-red-deep: "#a52a15"               # --stamp-2 — the stamp's hover ink; hover gains ink, never loses it
  stamp-ink: "#ffffff"                          # literal on .stamp — the only text colour on the red
  # ---- paper (hosted product surface: doc.css, not the sheet's palette) ----
  paper: "#ffffff"                              # literal on .page and .print .paper — the only white fields on the sheet
  paper-ink: "#1c2128"                          # literal on .page and .print .paper — the same ink doc.css sets on .doc
typography:
  display:
    fontFamily: "Osifont, DocForge Mono, ui-monospace, Cascadia Code, Consolas, monospace"
    fontSize: "clamp(64px, 6.8vw, 96px)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "0.03em"
  headline:
    fontFamily: "Osifont, DocForge Mono, ui-monospace, Cascadia Code, Consolas, monospace"
    fontSize: "clamp(30px, 3.4vw, 48px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.05em"
  title:
    fontFamily: "Osifont, DocForge Mono, ui-monospace, Cascadia Code, Consolas, monospace"
    fontSize: "clamp(20px, 1.7vw, 26px)"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.07em"
  body:
    fontFamily: "Osifont, DocForge Mono, ui-monospace, Cascadia Code, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.07em"
  note:
    fontFamily: "Osifont, DocForge Mono, ui-monospace, Cascadia Code, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.07em"
  label:
    fontFamily: "Osifont, DocForge Mono, ui-monospace, Cascadia Code, Consolas, monospace"
    fontSize: "10px"
    fontWeight: 400
    letterSpacing: "0.16em"
  stamp:
    fontFamily: "Osifont, DocForge Mono, ui-monospace, Cascadia Code, Consolas, monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.12em"
  dimension:
    fontFamily: "Osifont, DocForge Mono, ui-monospace, Cascadia Code, Consolas, monospace"
    fontSize: "26px"
    fontWeight: 400
    letterSpacing: "0.06em"
  source:
    fontFamily: "DocForge Mono, ui-monospace, Cascadia Code, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
rounded:
  none: "0"
  balloon: "50%"
spacing:
  sheet-margin: "14px"
  frame-inset: "20px"
  zone-band: "20px"
  zone-gutter: "22px"
  body-inset: "18px 22px 14px"
  cell: "5px 9px 6px"
  note-row: "6px 0"
  table-row: "10px 12px 10px 0"
  pane: "22px 20px"
  gap-arrangement: "16px 28px"
  gap-stack: "26px"
  gap-detail: "30px"
components:
  stamp:
    backgroundColor: "{colors.check-print-red}"
    textColor: "{colors.stamp-ink}"
    typography: "{typography.stamp}"
    rounded: "{rounded.none}"
    padding: "13px 22px 12px"
  stamp-hover:
    backgroundColor: "{colors.check-print-red-deep}"
  stamp-big:
    padding: "18px 30px 17px"
  title-block-cell:
    textColor: "{colors.lettering}"
    typography: "{typography.body}"
    padding: "{spacing.cell}"
  title-block-key:
    textColor: "{colors.lettering-2}"
    typography: "{typography.label}"
  title-block-stampcell:
    backgroundColor: "{colors.recess}"
  general-note:
    textColor: "{colors.lettering-2}"
    typography: "{typography.note}"
    padding: "{spacing.note-row}"
  zone-reference:
    textColor: "{colors.lettering-2}"
    height: "{spacing.zone-band}"
  balloon:
    textColor: "{colors.lettering}"
    rounded: "{rounded.balloon}"
    size: "30px"
  source-pane:
    textColor: "{colors.lettering}"
    typography: "{typography.source}"
    padding: "{spacing.pane}"
  paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    padding: "18px 22px"
  parts-row:
    textColor: "{colors.lettering-2}"
    typography: "{typography.body}"
    padding: "{spacing.table-row}"
  link-ruled:
    textColor: "{colors.lettering}"
---

# Design System: DocForge — the drawing sheet (landing)

## Overview

**Creative North Star: "The Drawing Sheet"**

This file governs exactly one surface: the landing page at route `/` of the Next.js app (`apps/web/app/page.tsx` with `apps/web/app/landing.css`). It does not govern the studio. The studio's chrome is "the copy desk", recorded in the root `DESIGN.md` and `.impeccable/design.json`, and nothing in this file overrides, extends, or leaks into it. The two worlds share one law only, inherited from PRODUCT.md: the document prints on white, whatever surrounds it. The document stylesheet `apps/web/public/doc.css` is product surface belonging to neither world; the landing hosts it unchanged.

The landing is one engineering drawing set, three sheets, printed as a cyanotype. The finished A4 page is the part being drawn: it sits on sheet 1 at reduced scale with its 210 and 297 overall dimensions and its 22/20/24/20 mm margins measured off its own edges, and leaders call out its furniture (running head, page border, title plate, particulars table, folio). The product's facts live where a drawing keeps its facts: five general notes at the right, a ruled title block at the bottom right, a parts list and a revision table on sheet 3. Sheet 2 is a set of detail views: Markdown source at left, the printed result at right, at 1:1. The only red on any sheet is the check-print stamp in the APPROVED cell, and it opens the studio. Motion is a drawing showing its work once: extension lines, then dimension lines, then lettering, and nothing moves again.

The world is dense, ruled, and single-voiced. One lettering face at one weight sets everything on the sheet, tracked as ISO 3098 caps; emphasis is a change of ink, never of weight. Lines are one white at three densities. There are no shadows, no gradients, no rounded corners beyond the detail balloon, no filled panels beyond the one recessed cell. Confirmed rejections, evidenced by the build: no headline-plus-two-buttons hero, no floating screenshot, no three-column feature grid. The contract's ground colour (#12397a) is what the sheet reads as; the built token is darker (`--cy: #103474`) and the two noise layers lift it — the token is normative.

**Key Characteristics:**
- Cyanotype blue ground carrying two SVG noise layers (paper tooth over uneven coating), white at a few percent.
- Line-white for every drawn line; 2px for frames and heavy rules, 1px for cells; 0.42 and 0.18 alpha for soft and faint rules.
- osifont (ISO 3098 lettering) at weight 400 for everything on the sheet, uppercase and tracked 0.07em via `.lt`.
- Zone-referenced drawing frames (1–8 across, A–F down) with centring marks at the four mid-edges, on every sheet.
- A fixed 1320 × 1285 px drawing space scaled by `zoom: var(--pz)`; the page inside it is A4 at 96 dpi and every dimension is computed from it.
- A ruled title block with no fills except the APPROVED cell; that cell holds the one red stamp.
- Paper is the only white on the sheet, and paper is always set in `doc.css`.
- Every rule nested under `.sheet-root`; only `@font-face` and `@keyframes` sit at the top level.

## Colors

A monochrome print with one stamp: blue ground, white lines and lettering at graded density, one red spent once per sheet, and white only where there is paper.

### Primary
- **Check-Print Red** (`--stamp`, #c8361f): the rubber stamp that opens the studio. It appears in exactly two places across the set: the APPROVED cell of sheet 1's title block, and the closing stamp on sheet 3. Sheet 2 carries no red at all.
- **Check-Print Red, Deep** (`--stamp-2`, #a52a15): the stamp's hover ink (160ms). Hover gains ink; it never lightens or lifts.
- **Stamp Ink** (#ffffff, literal on `.stamp`): the only text colour on the red. The stamp's keyline is the same white at 90% (`rgba(255,255,255,0.9)`).

### Neutral — the ground
- **Cyanotype** (`--cy`, #103474): the coated sheet. Every sheet, every pane, every cell is this colour showing through; nothing is filled over it except the recess below.
- **Recess** (rgba(0, 0, 0, 0.28), literal on `.tb .stampcell`): the APPROVED cell in the title block, the print's one recess. It is a translucent darkening rather than a second blue, so the tooth and coat continue through it and the stamp sits in a darker field. No other element is filled.

### Neutral — the lines
- **Line White** (`--ln`, #e7edf9): every drawn line at full density: the 2px drawing frame, the 2px sheet-head and column-head rules, the title block's cell rules, dimension and extension lines (`stroke: currentColor`), leader dots, the page's and paper's outlines, the centring marks, the detail balloon's ring, the focus ring.
- **Line White, Soft** (`--ln-soft`, rgba(231,237,249,0.42)): the outer trim line, the zone ticks, the source and print pane borders, the notes' top rule, and a link's resting underline-rule.
- **Line White, Faint** (`--ln-faint`, rgba(231,237,249,0.18)): the row rules between general notes and between table rows.
- **Selection** (rgba(231,237,249,0.28), one-off on `::selection`): text selection is the same white, between soft and faint.

### Neutral — the lettering
- **Lettering** (`--tx`, #f3f6fc): the sheet's primary ink: the name, the hook, headlines, title block values, `NOTE n` counters, the emphasised (`<b>`) run in a note or a parts row, source code, SVG dimension figures (`fill`).
- **Lettering 2** (`--tx-2`, #bccbea): secondary ink: the units line, cell keys, view tags, zone references, note bodies, table heads, item numbers, material notes, captions, secondary dimension callouts (`.s`), the footline.

### Paper (hosted, not the sheet's)
- **Paper** (#ffffff, literal on `.page` and `.print .paper`): the part being drawn and the print fragments in the detail views. Paper is white on every theme, in every world, by product law.
- **Paper Ink** (#1c2128, literal on `.page` and `.print .paper`): the same ink `doc.css` sets on `.doc`. Everything inside paper — the assignment template's tint ramp (`--a50…--a900`, #c2410c at 500), the Times faces, the thick–thin page border in #3c434e — is the product's own document surface, hosted unchanged. It is not the landing's palette and this file does not govern it.

### Named Rules
**The One Red Per Sheet Rule.** Check-print red exists for the stamp and for nothing else: at most one stamp per sheet, and every stamp opens the studio. It is never a text colour, a rule, a link, a hover, or an accent. The accents inside paper (the template's #c2410c on heading rules, numbers and cross-references) are paper's ink, not the sheet's red, and do not count against it.

**The Paper Is White Rule.** The only white fields on a sheet are paper (`.page`, `.print .paper`), and paper is #ffffff set in `doc.css`. The sheet never lightens its ground to make a panel; a panel that is not paper is ruled, not filled.

**The Line-White Rule.** Every line on the sheet is `--ln` at one of three densities (1, 0.42, 0.18). No line takes another colour, and no line is drawn in the lettering colours.

## Typography

**Lettering Face:** Osifont (ISO 3098 engineering lettering, LGPL v3 with font exception; `apps/web/public/lettering/`, upright and italic, weight 400 only), falling back to DocForge Mono, ui-monospace, Cascadia Code, Consolas, monospace.
**Source Face:** DocForge Mono (with ui-monospace, Cascadia Code, Consolas, monospace) for Markdown source in the detail views.
**Paper Faces:** whatever `doc.css` and the hosted template set (Times New Roman → DocForge Serif → Georgia for the assignment template). Not the sheet's.

**Character:** one face, one weight, one case. Everything on the sheet is drawing-sheet lettering: upright single-stroke capitals, tracked 0.07em by the `.lt` utility, sized by role and coloured by rank. The face's italic (`.lt-i`, sentence case, 0.02em) exists and is unused on the current sheets. Hierarchy is carried by size, tracking and ink, never by weight: `<b>` and `<strong>` on the sheet are `font-weight: 400` recoloured from `--tx-2` to `--tx`.

### Hierarchy
- **Display** (400, clamp(64px, 6.8vw, 96px), 0.92, 0.03em, caps): the name DOCFORGE at the top of sheet 1. Once per set. Compacted to clamp(52px, 5.6vw, 78px) on short desks and clamp(52px, 17vw, 72px) on phones.
- **Headline** (400, clamp(30px, 3.4vw, 48px), 1, 0.05em, caps): sheet titles on sheets 2 and 3 (DETAIL VIEWS, PARTS LIST), set on a 2px `--ln` rule with a 14px `--tx-2` caption on the same baseline.
- **Title** (400, clamp(20px, 1.7vw, 26px), 1.3, 0.07em, caps, ≤30ch balanced): the hook under the units line. The closing line on sheet 3 (APPROVED FOR CONSTRUCTION…) is the same voice at clamp(22px, 2.6vw, 36px), 1.15, ≤26ch. The view title in a detail label (DETAIL A) is 22px at 0.08em.
- **Body** (400, 14px, 1.4, 0.07em, caps): title block values, parts and revision cells, the sheet-head caption. The sheet's base is 15px/1.45 on `.sheet-root`; 14px is the working size inside ruled furniture. The material column of a table (`td.m`) drops the caps (`text-transform: none`, 0.02em) so sentences read as sentences.
- **Note** (400, 12.5px, 1.4, 0.07em, caps, `--tx-2`): the five general notes, each led by a `NOTE n` counter (11px, 0.14em, `--tx`) in a 5.2em column. The emphasised run (`<b>`) is `--tx` at the same weight.
- **Label** (400, 10px, 0.16em, caps, `--tx-2`): title block keys (`.k`), view tags (`.tag`), table column heads (`th`). The same voice at 11px sets the footline and, at 0.1em, the zone references; at 12px it sets the units line under the name (`.sub`) and the REVISIONS heading (`.bom h3`).
- **Stamp** (400, 16px, 1, 0.12em, caps, white): the stamp's lettering. The big variant on sheet 3 is clamp(18px, 2vw, 24px); the short-desk variant is 15px.
- **Dimension** (400, 26px in drawing space, 0.06em, caps, `fill: --tx`): dimension figures and leader callouts in the SVG, sized in the 1320 × 1285 drawing space and scaled by `--pz` (≈12.5px on a 1440 desktop). Secondary callouts (`.s`) are 17px in `--tx-2`. On phones the drawing-space sizes rise to 40/30px so they land at the same screen size after the smaller zoom.
- **Source** (400, 12.5px, 1.6, no tracking, no transform): Markdown source in the detail views, `pre-wrap` with `overflow-wrap: anywhere`.

### Named Rules
**The Lettering Rule.** Everything on the sheet is set in Osifont at weight 400, uppercase, tracked. There is no bold on the sheet: `<b>` is a change of ink from `--tx-2` to `--tx` at the same weight.

**The Paper Boundary Rule.** The sheet's caps and tracking stop at the edge of paper. `.page` and `.print .paper` reset `text-transform: none; letter-spacing: normal` and hand typography to `doc.css`; the source pane does the same (`letter-spacing: 0`) and hands it to the mono face. Nothing on the sheet restyles `.doc`.

**The Labels Live in Cells Rule.** The 10px tracked label is a cell key, a view tag on a pane's top edge, or a column head. It never floats above a headline as a kicker: the units line sits under the name, not over it.

## Layout

The page is a vertical stack of three `section.sheet` elements inside a scrolling `main.sheet-root`. Each sheet is a flex item that never shrinks (`flex: none`), `min-height: 100dvh` on desktop (so sheet 1 is the first viewport, complete), with a 14px margin all round; consecutive sheets butt (`.sheet + .sheet { padding-top: 0 }`). Sheets are not cards: they are pages of a drawing set, each with its own frame, zones, centring marks and title block, and the set is read by scrolling from sheet 1 to sheet 3.

**The frame.** Each sheet carries a 1px `--ln-soft` trim line (`.sheet-frame`), a 2px `--ln` drawing frame inset 20px, and a 22px gutter between them for zone references: eight numbered zones across the top and bottom bands (20px tall, 11px lettering, 0.1em, `--tx-2`, separated by soft ticks inset 4px) and six lettered zones (A–F) down the left and right bands (20px wide). Centring marks are 2 × 22px bars of `--ln` at the middle of each edge. The frame is decoration only (`aria-hidden`, `pointer-events: none`, `user-select: none`).

**The body.** Inside the frame, `.sheet-body` is a grid padded 18px 22px 14px. Sheet 1 (`.ga`, general arrangement) is two columns, `minmax(0, 1fr)` for the drawing and `minmax(340px, 50%)` for the text, three rows `auto 1fr auto`, gap 16px × 28px: the drawing spans all three rows at left, centred; the head (name, units line, hook) is row 1 right; the general notes are row 2 right, aligned to the start; the title block is row 3 right, aligned to the end so it sits on the frame's bottom edge. Sheets 2 and 3 (`.stack`) are one column, `auto 1fr auto`, gap 26px: a sheet head on a 2px rule, the content, and a compact title block (`1fr auto auto`, `width: min(100%, 560px)`) pushed to the bottom-right corner. Detail views are a 1fr/1fr grid with a 30px gutter (source left, print right), stacked 30px apart. The parts list and revisions share a `3fr / minmax(280px, 2fr)` grid, gap 28px × 44px.

**The drawing space.** The drawing is a fixed 1320 × 1285 px canvas (`.drawing`) scaled as a whole by `zoom: var(--pz)`. The page is positioned at (110, 90) and measures 794 × 1123 px — A4 at 96 dpi, 1 mm = 3.7795 px — and the `.dims` SVG shares the canvas exactly (`viewBox 0 0 1320 1285`, `inset: 0`). Every dimension and leader is computed from the page's own geometry in `page.tsx`: the 210 dimension line at y = 40 with extension lines to y = 28, the 297 line at x = 50, the side margins (20/20) below the page at y = 1258, the top and bottom margins (22/24) beside it at x = 944, leaders landing at x = 990 with lettering from x = 1004. The right-hand 320px of the canvas holds the callouts; on phones that band is clipped away (`width: 1000px; overflow: hidden`, `.callouts` hidden) so every remaining line stays registered to the page.

**The responsive ladder (`--pz`).** The zoom is the only thing that resizes the drawing; the CSS pixel geometry never changes.

| Condition (in cascade order) | `--pz` | Drawing on screen | What else changes |
| --- | --- | --- | --- |
| Desktop, > 1366w and > 820h | 0.48 | 634 × 617 px | — |
| ≤ 1366w | 0.46 | 607 px wide | — |
| ≤ 820h | 0.44 | 581 px wide | — |
| ≥ 1101w and ≤ 820h (short desk) | inherits | — | Type compaction: name clamp(52px, 5.6vw, 78px), hook 19px, note rows 4px, title block 12px with 4px 8px 5px cells, stamp 15px with 11px 18px 10px padding. The title block and its stamp stay inside a 1366 × 768 first viewport. |
| ≤ 1100w | 0.60 | 792 px wide | `.ga` becomes one column: head, drawing, notes, title block (rows 1–4). `.bom` becomes one column. |
| ≤ 760w (phone) | 0.31 | 310 px wide (of a 1000px clipped canvas) | Callouts hidden; dimension type 40/30px in drawing space; strokes 5/3.5; the 22/24 margin figures (`.vd`) shift 46px outboard of their dimension line, clear of the page outline. Sheet margin 10px, frame inset 14px, gutter 16px, zone bands 14px with 9px type, centring marks 16px. `.sheet` loses its `min-height`. Notes become single-column rows; title block becomes two columns with spanning cells and the APPROVED cell full-width; detail views stack; the parts table hides its head and each row becomes a `2.6em 2.6em 1fr` grid with the material note full-width below. |
| ≤ 400w | 0.29 | 290 px wide | — |

### Named Rules
**The Scoped World Rule.** Every rule of this world is nested under `.sheet-root`. Only `@font-face` (Osifont) and `@keyframes` (`df-draw`, `df-fade`) sit at the top level, because they must. Nothing in `landing.css` reaches the studio, and nothing on the sheet reads the studio's tokens (`--bg`, `--pri`, `--rule`…) or its `data-light` theme. The sheet has one theme.

**The Drawing Space Rule.** The drawing is a 1320 × 1285 px canvas holding an A4 page at 96 dpi; the SVG shares the canvas exactly; dimensions are computed from the page's margins; the whole scales by `--pz` and by nothing else. A dimension that is typed rather than computed, or an SVG sized independently of the page, breaks the registration the drawing exists to show.

**The First Viewport Rule.** Sheet 1 is complete in the first viewport at 1440 × 900 and at 1366 × 768: drawing with dimensions and leaders, name, hook, five notes, and the title block with the stamp. The short-desk block exists to keep this true; the ladder is tuned to it, not to a mobile-first stack.

## Elevation & Depth

The world has no shadows, by rule. A drawn part is bounded by its outline, not lit: the page carries a 2px `--ln` outline offset 6px; a print fragment's paper carries 1.5px offset 5px. Depth on the sheet is conveyed three ways only. Rules: heavier lines (2px) enclose and head, lighter lines (1px, soft, faint) divide. One recess: the title block's APPROVED cell is darkened by a translucent black (rgba(0, 0, 0, 0.28)), the only tonal step on the sheet; it is translucent so the print's texture continues through it, and the stamp sits in a darker field. Texture: two SVG turbulence layers on the ground — `--tooth` (baseFrequency 0.9, one octave, alpha 0.06, 240px tile) over `--coat` (baseFrequency 0.0035, three octaves, alpha 0.1, 800px tile) — white at a few percent, reading as paper grain and uneven coating. Nothing on the sheet uses `filter: drop-shadow`, a gradient, a glow, or a translucent panel.

The stamp is the one element with `box-shadow`, and it is inset only: `inset 0 0 0 4px var(--ink), inset 0 0 0 5.5px rgba(255,255,255,0.9)`, a 1.5px white keyline set in 4px from the impression's edge. It is a drawn line, not depth. The stamp's edge is roughened by the `#ink-rough` SVG filter (`feTurbulence` baseFrequency 0.85, two octaves, seed 11, `feDisplacementMap` scale 2.4) and its ink density varied by `--ink-mask` (86–100%), so it prints like rubber on paper rather than rendering like a button. The hosted paper's `::after` border also uses inset `box-shadow`, but that is the studio's page-border technique in `doc.css`'s world, not the sheet's.

### Named Rules
**The No-Shadow Rule.** Nothing on the sheet casts a shadow. A part is bounded by an outline (`outline: 2px solid var(--ln)`, offset 6px), a pane by a 1px soft rule, a cell by its 1px rules. The removal of the earlier build's drop shadows from `.page` and `.paper` is the record of this rule being applied.

**The Keyline Rule.** `box-shadow` may appear only as `inset` spreads that draw a line inside an edge (the stamp's keyline). Any offset, blur, or outward spread is a shadow and is refused.

## Shapes

Square. Every corner on the sheet is a right angle: frames, cells, panes, tables, the stamp, the page, the paper. The form language is the ruled rectangle and the drawn line. Two exceptions, both native to a drawing: the detail balloon (`.balloon`, a 30 × 30px circle with a 2px `--ln` ring carrying its letter at 14px, untracked) and the leader dot (`circle.pt`, r = 5 in drawing space, `fill: currentColor`). The dimension arrowhead is a closed triangle (path `M0 0.5 L10 5 L0 9.5 z` in a viewBox-10 marker, `refX 9`, `orient auto-start-reverse`) drawn at a fixed 24 × 24 drawing-space px (`markerUnits="userSpaceOnUse"`), so the heads stay one size when the strokes thicken on phones; it sits on both ends of every dimension line, and extension lines and leaders have no heads.

Lines have two ISO weights in drawing space: thick (`.dl`, 3.5) for dimension lines and thin (`.xl`, 2) for extension lines and leaders, rising to 5 and 3.5 on phones so both stay crisp at every zoom the sheet ships at. Rules on the sheet have two weights in CSS pixels: 2px for the drawing frame, sheet heads, column heads, the closing rule and the title block's right and bottom edges; 1px for cell rules, pane borders and row rules.

The stamp is the one shape that is not square to the sheet: it cants −2° (`transform: rotate(-2deg)` on `.stamp`, with the paint on the inner `.stamp-ink` so the filter and mask do not fight the rotation). It is printed, not drawn, and its roughened edge is the tell.

**The Square Corner Rule.** `border-radius` is 0 everywhere except the detail balloon (50%). No rounded panes, pills, or chips; a tag is a label, not a chip.

## Components

### The Stamp (the one call to action)
A check-print rubber stamp, red on blue, canted, roughened, unevenly inked. It is the only button-like thing on the sheet and always links to `/studio`.
- **Shape:** square-cornered impression, rotated −2°; a 1.5px white keyline set in 4px from the edge (inset `box-shadow`); edge displaced by `filter: url(#ink-rough)`; density varied by `mask-image: var(--ink-mask)` at a 200px tile.
- **Ink:** `--stamp` (#c8361f) at rest; lettering white, 16px, 0.12em, caps, line-height 1; padding 13px 22px 12px.
- **Hover:** `--ink` switches to `--stamp-2` (#a52a15) over 160ms `cubic-bezier(0.2, 0, 0, 1)`. Nothing moves, lifts or glows.
- **Focus:** 2px solid `--ln` outline, offset 3px (the sheet's one focus treatment, shared by every link).
- **Big:** on sheet 3, clamp(18px, 2vw, 24px) with 18px 30px 17px padding.
- **Placement:** centred in the title block's APPROVED cell on sheet 1 (`margin: auto`, cell padded 12px at the bottom); at the right of the closing grid on sheet 3. Two stamps in the set, one per sheet at most.

### Title Block
Ruled cells on the sheet itself, no fills, so the print shows through. Each cell draws its top and left rule (1px `--ln`); the block draws its right and bottom (2px) and its outer frame (1px), so the outer edge reads heavier.
- **Grid:** four equal columns (`repeat(4, minmax(0, 1fr))`), 14px lettering. TITLE spans columns 1–2 (`.t3`), SHOWN spans 3–4 (`.s2`), the APPROVED cell (`.stampcell`) spans columns 3–4 and rows 2–3 and is darkened by the translucent recess (rgba(0, 0, 0, 0.28)); the links row spans 2–4.
- **Cells:** padding 5px 9px 6px; key (`.k`) 10px, 0.16em, `--tx-2`, 3px above the value; value (`.v`) 14px, `--tx`, line-height 1.3.
- **Links row:** wrapping flex, gap 4px × 22px, ruled links (below).
- **Compact variant (`.tb-compact`):** `1fr auto auto` (title, size, sheet), `width: min(100%, 560px)`, pushed to the bottom-right (`align-self: end; justify-self: end`), on sheets 2 and 3.
- **Phone:** two columns; TITLE, SHOWN, links and the APPROVED cell all span full width; the APPROVED cell drops its row span.

### General Notes
An ordered list dressed as a drawing's general notes, capped at 66ch on desktop (uncapped once the sheet is one column). No bullets; a CSS counter writes `NOTE 1` … `NOTE 5`.
- **Rows:** grid `5.2em 1fr`, gap 10px, padding 6px 0; a 1px `--ln-soft` rule above the list, 1px `--ln-faint` between rows.
- **Type:** 12.5px, 1.4, caps, `--tx-2`; the counter 11px, 0.14em, `--tx`, line-height 1.7; the lead (`<b>`) `--tx` at weight 400.
- **Phone:** single column, counter above body, 13px.

### The Drawing and its Dimensions
The page as a part, dimensioned in mm, in an SVG that shares the drawing's pixel space.
- **Lines:** `.dl` dimension lines (stroke 3.5, arrowheads both ends), `.xl` extension lines and leaders (stroke 2), `.pt` leader dots (r 5), all `currentColor` = `--ln`.
- **Lettering:** 26px caps at 0.06em, `fill: --tx`, rotated −90° on vertical dimensions; secondary callouts 17px `--tx-2`. Leaders run horizontally to x = 990 and letter from x = 1004: name on the first line, spec on the second.
- **Motion — The Shows-Its-Work-Once Rule:** the sheet draws itself once on load. Extension lines draw first (`df-draw`, 0.55s, `pathLength=1` dash from 1 to 0, delay 0.15s), dimension lines next (0.45s), then figures and dots fade in (`df-fade`, 0.4s, delay 0.9s). The margin and callout group (`.g2`) trails by 0.2s (0.35 / 0.65 / 1.1s). Easing is `--ease: cubic-bezier(0.2, 0, 0, 1)` throughout. Only the change is animated: with `prefers-reduced-motion: reduce`, the global block in `globals.css` (`animation: none; transition: none` on everything) leaves every line simply there. Nothing on the sheet animates on scroll, hover or in a loop.

### Sheet Frame, Zones and Centring Marks
The `Frame` component wraps every sheet: trim line, drawing frame, four zone bands (`1–8` across, `A–F` down), four centring marks. Zones are 20px bands of 11px `--tx-2` lettering at 0.1em with soft ticks; centring marks are 2 × 22px `--ln` bars. All `aria-hidden` and inert. On phones the bands are 14px with 9px type and 16px marks.

### Sheet Head
The title of sheets 2 and 3: an `h2` at clamp(30px, 3.4vw, 48px), 0.05em, on a 2px `--ln` bottom rule padded 14px, with a 14px `--tx-2` caption aligned to the same baseline (wrapping flex, gap 8px × 28px).

### Detail View
Two panes under a detail label: what was typed, and what printed.
- **Label:** a 30px balloon (2px `--ln` ring, 14px letter) beside the view title (22px, 0.08em, `--tx`) and a 13px `--tx-2` caption; 28px below to the panes.
- **Panes:** 1px `--ln-soft` border; a view tag (`.tag`: 10px, 0.16em, `--tx-2`, caps) sits 19px above each pane's top-left edge — `SOURCE — MARKDOWN` and `PRINT — 1:1`.
- **Source pane (`.src`):** padding 22px 20px, DocForge Mono 12.5px/1.6 in `--tx`, `pre-wrap`, no transform, no tracking.
- **Print pane (`.print`):** padding 24px 22px, centres a `.paper`: white, #1c2128 ink, padding 18px 22px, 1.5px `--ln` outline offset 5px, hosting `.doc.tpl-assignment` from `doc.css` unchanged (the last block's bottom margin zeroed; the TOC's page break neutralised; display maths scrolls horizontally rather than overflowing).
- **Phone:** panes stack, 30px apart.

### Parts List and Revisions
Ruled tables in lettering (`.parts`, `.revs`), 14px, 1.4.
- **Heads:** 10px, 0.16em, `--tx-2`, left-aligned, weight 400, 2px `--ln` bottom rule, padding 0 12px 8px 0.
- **Cells:** padding 10px 12px 10px 0, 1px `--ln-faint` bottom rule, top-aligned. Item and revision numbers (`td.n`) and quantities (`td.q`) are 3.5em, `--tx-2`, tabular; descriptions (`td.d`) 30%, `--tx`; material notes (`td.m`) `--tx-2` in sentence case (0.02em) with the lead (`<b>`) in `--tx`.
- **Revisions heading:** 12px, 0.16em, `--tx-2`, 12px above the table.
- **Phone:** the parts head is hidden; each row becomes a `2.6em 2.6em minmax(0, 1fr)` grid with the material note spanning below, 8px 0, faint rule between rows.

### Ruled Links
Text links on the sheet (title block links, the closing line's alternatives) are lettering with a rule under them, not underlined text: `text-decoration: none`, `border-bottom: 1px solid var(--ln-soft)`, 1px padding below, rising to `--ln` on hover over 160ms. Colour is inherited (`--tx` in the closing line). No link takes the red.

### Closing
Sheet 3's final block: a 2px `--ln` top rule padded 26px; a `1fr auto` grid (gap 22px × 40px) with the closing line (clamp(22px, 2.6vw, 36px), 1.15, ≤26ch, balanced) and its 13px `--tx-2` alternatives at left, the big stamp at right; a footline spanning both columns — 11px, 0.16em, `--tx-2`, `space-between`: DO NOT SCALE DRAWING · licence and stance · SHEET 3 OF 3.

### The Part (hosted paper)
`.page` is the assignment template's title page at A4 (794 × 1123 px), white, #1c2128, with the studio's own page-border overlay (`::after`: 4.5pt #3c434e set in 3mm, thick–thin via inset `box-shadow`), a `.doc` inset 22/20/24/20 mm, a running head (7.6pt caps, 0.13em, #828a99) and a folio (8.2pt tabular, #71798a), and the `.tpl-assignment` tint ramp and Times faces the studio's `dynamicCss()` would emit. It exists so what is drawn is what the studio prints. It is product surface hosted by the landing; change it only when the studio's template changes, and never to suit the sheet.

## Do's and Don'ts

### Do:
- **Do** set every word on the sheet in Osifont at weight 400, uppercase, tracked 0.07em via `.lt`; emphasise by ink (`--tx` over `--tx-2`), never by weight.
- **Do** draw every line in line-white: 2px `--ln` for frames, heads and the title block's outer edge; 1px `--ln` for cells; `--ln-soft` (0.42) for trim, panes and ticks; `--ln-faint` (0.18) for row rules.
- **Do** keep the check-print red for the stamp alone — at most one stamp per sheet, always linking to `/studio` — with white lettering, hover to `--stamp-2` over 160ms.
- **Do** keep paper white (#ffffff) and set in `doc.css`; reset `text-transform` and `letter-spacing` at the paper boundary and let the document stylesheet take over.
- **Do** compute every dimension in the 1320 × 1285 drawing space from the page's geometry (origin 110/90, 794 × 1123, 1 mm = 3.7795 px) and scale the whole with `--pz`.
- **Do** bound parts and paper with outlines (2px `--ln` offset 6px; 1.5px offset 5px), and enclose panes and cells with rules.
- **Do** put tracked 10px labels in cells (`.k`), on pane edges (`.tag`) and in column heads (`th`), in `--tx-2`.
- **Do** nest every new rule under `.sheet-root`, with only `@font-face` and `@keyframes` at the top level.
- **Do** animate only the drawing's one-time draw-in (`df-draw`, `df-fade`, `--ease`), and let the global reduced-motion block kill it.
- **Do** give every sheet its frame, zones, centring marks and a title block, and keep sheet 1 complete in a 1366 × 768 viewport.

### Don't:
- **Don't** add a drop shadow, gradient, glow, blur, or translucent panel anywhere on the sheet; `box-shadow` is inset keylines only.
- **Don't** use `font-weight: 700` on the sheet; the lettering face ships one weight and the world uses one.
- **Don't** use the red as text, rule, link, hover, focus, or accent, and don't add a second red; the accents inside paper are the template's, not the sheet's.
- **Don't** restyle `.doc`, `.page`'s border, or the `.tpl-assignment` ramp to suit the sheet; they are product surface hosted unchanged.
- **Don't** round a corner; `border-radius` is 0 everywhere except the 30px detail balloon.
- **Don't** compose a headline-plus-two-buttons hero, a floating screenshot, or a three-column feature grid on any sheet; the product's facts go in notes, the title block, the parts list and the revisions.
- **Don't** float a tracked label above a headline as a kicker; the units line sits under the name.
- **Don't** size the `.dims` SVG or the page independently, type a dimension figure by hand, or change the drawing's CSS pixel geometry; change `--pz`.
- **Don't** read the studio's tokens (`--bg`, `--pri`, `--rule`, `--line`) or its `data-light` theme inside the sheet, and don't let a `.sheet-root` rule escape into `globals.css`.
- **Don't** use a filled panel that is not paper; the APPROVED cell's translucent recess (rgba(0, 0, 0, 0.28)) is the one exception and it is spent.
