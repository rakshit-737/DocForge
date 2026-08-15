---
name: DocForge
description: The typographer's workshop — an iron-dark pressroom chrome around paper-white pages.
colors:
  # ---- dark chrome (default; CSS vars in src/app.css :root) ----
  brass: "#c9974a"              # --pri
  brass-bright: "#e0b26a"       # --pri2
  brass-engraving: "#191207"    # --pri-ink (text on brass)
  pressroom-ink: "#14120e"      # --bg
  iron-surface: "#1b1813"       # --bg2
  raised-plate: "#23201a"       # --bg3
  seam: "#322d24"               # --line
  rag-paper: "#ece5d8"          # --tx
  faded-ink: "#b0a795"          # --tx2
  ghost-ink: "#8a8375"          # --tx3
  proof-felt: "#212721"         # --deck
  walnut: "#352a18"             # --wood
  walnut-raised: "#463525"      # --wood2
  proof-green: "#7ba05b"        # --ok
  amber-warn: "#c98a3a"         # --warn
  rust-danger: "#bf5147"        # --danger
  # ---- daylit chrome (:root[data-light]) ----
  brass-daylit: "#a67833"       # --pri (light)
  brass-daylit-deep: "#8c6323"  # --pri2 (light)
  plaster: "#efe9dc"            # --bg (light)
  plaster-bright: "#f7f2e7"     # --bg2 (light)
  plaster-sheet: "#fffdf6"      # --bg3 and --pri-ink (light)
  daylit-seam: "#d9d0bc"        # --line (light)
  daylit-ink: "#2a251c"         # --tx (light)
  daylit-ink-faded: "#5f5849"   # --tx2 (light)
  daylit-ink-ghost: "#6b6353"   # --tx3 (light)
  daylit-felt: "#c9cdbf"        # --deck (light)
  pale-oak: "#e2d5ba"           # --wood (light)
  pale-oak-raised: "#d7c8a8"    # --wood2 (light)
  daylit-proof-green: "#5c7d3d" # --ok (light)
  daylit-amber: "#a06a1f"       # --warn (light)
  daylit-rust: "#a03d33"        # --danger (light)
  # ---- both themes ----
  page-white: "#ffffff"         # document pages, always
typography:
  display:
    fontFamily: "DocForge Garamond, Georgia, serif"
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "0.01em"
  title:
    fontFamily: "DocForge Garamond, Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
  body:
    fontFamily: "DocForge Sans, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    letterSpacing: "0.004em"
  data:
    fontFamily: "DocForge Mono, ui-monospace, Cascadia Code, Consolas, monospace"
    fontSize: "12px"
    fontFeature: "tabular-nums"
  label:
    fontFamily: "DocForge Sans, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "10.5px"
    fontWeight: 700
    letterSpacing: "0.14em"
rounded:
  plate: "1px"
  control: "2px"
  tile: "3px"
  menu: "6px"
  modal: "10px"
spacing:
  sp1: "4px"
  sp2: "8px"
  sp3: "12px"
  sp4: "16px"
  sp5: "24px"
components:
  button-press:
    backgroundColor: "{colors.raised-plate}"
    textColor: "{colors.rag-paper}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 12px"
  button-press-hover:
    backgroundColor: "{colors.seam}"
  button-brass:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.brass-engraving}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.faded-ink}"
    rounded: "{rounded.control}"
    height: "32px"
  toolbar-plate:
    backgroundColor: "transparent"
    textColor: "{colors.faded-ink}"
    rounded: "{rounded.plate}"
    height: "28px"
    padding: "0 6px"
  toolbar-plate-hover:
    backgroundColor: "{colors.walnut-raised}"
    textColor: "{colors.rag-paper}"
  type-case:
    backgroundColor: "{colors.walnut}"
    rounded: "{rounded.control}"
    padding: "2px"
  field-engraved:
    backgroundColor: "{colors.pressroom-ink}"
    textColor: "{colors.rag-paper}"
    rounded: "{rounded.control}"
    padding: "8px"
  toast:
    backgroundColor: "{colors.rag-paper}"
    textColor: "{colors.iron-surface}"
    rounded: "{rounded.menu}"
    padding: "8px 16px"
  modal:
    backgroundColor: "{colors.iron-surface}"
    rounded: "{rounded.modal}"
    width: "min(680px, 92vw)"
---

# Design System: DocForge

Everything below is extracted from the built app — `src/app.css` (tokens + chrome), `src/index.html` (structure), `src/js/main.js` (behavior) — and confirmed against `qa/out/w1–w5` screenshots. Product truth and the standing brand commitment live in `PRODUCT.md`; this file is strictly visual.

## Overview

**Creative North Star: "The Typographer's Workshop"**

The chrome is the pressroom around the paper. Iron-dark ink surfaces carry a faint paper grain; controls are engraved plates seated in oiled-walnut type-cases (recessed wells, never outlined groups); the preview deck is a green felt proof-table under a lamp, and the white pages rest on it like proofs. Exactly one metal exists — brass — and it is spent by discipline, not by taste. Depth comes from materials (wood, felt, machined bevels, grain), not from decorative effects. The motion grammar is "the press shows its work": proofs settle, a composing ticker counts pages, type sorts jig while rendering, the autosave dot lands like an ink stamp. The light theme is the same room at daylight — warm plaster and pale oak — never a color inversion. The document itself is not part of this world: it always renders and prints on white.

**Key Characteristics:**
- One accent metal (brass), used in a short, closed list of places.
- Materials, not effects: `--wood`/`--wood2`, bevel light `--edge`, grain tiles `--grain`/`--woodgrain`, felt `--deck`.
- Recessed composition: controls sit *in* wells (inset shadows), they don't float *on* cards.
- Dense, quiet UI: 13px sans chrome, mono instruments with tabular numerals, Garamond only for identity moments.
- Two-speed motion: `--dur` 160ms feedback, `--dur2` 340ms compositional; reduced-motion kills all of it.

## Colors

A warm monochrome of ink, walnut and plaster around a single brass accent; green felt is the only cool surface, reserved for the proof-table.

### Primary
- **Brass** (`--pri`, #c9974a dark / #a67833 daylit): the room's one metal. Sanctioned uses only (see The Brass Scarcity Rule).
- **Bright Brass** (`--pri2`, #e0b26a dark / #8c6323 daylit): brass hover states (the masthead title warms to it). In daylight it goes *deeper*, not lighter — daylight brass darkens on hover.
- **Brass Engraving** (`--pri-ink`, #191207 dark / #fffdf6 daylit): the only text color permitted on a brass fill.

### Neutral
- **Pressroom Ink** (`--bg`, #14120e / daylit plaster #efe9dc): page background, editor, engraved-field wells. Deepest surface.
- **Iron Surface** (`--bg2`, #1b1813 / #f7f2e7): drawer, statusbar, modals, instrument cluster.
- **Raised Plate** (`--bg3`, #23201a / #fffdf6): buttons, popmenus, floating panels, kbd chips. Highest chrome surface.
- **Seam** (`--line`, #322d24 / #d9d0bc): hairline dividers, drawer rails, button hover fill, scrollbar thumbs.
- **Rag Paper** (`--tx`, #ece5d8 / #2a251c): primary text; also the *inverted* toast slip background.
- **Faded Ink** (`--tx2`, #b0a795 / #5f5849): secondary text, resting icon color, modal body copy.
- **Ghost Ink** (`--tx3`, #8a8375 / #6b6353): tertiary — mono micro-text, hints, placeholders. Tuned to ≥4.5:1 on `--bg` in both themes; **not** safe on `--bg3` or `--wood2` (see contrast rule).
- **Proof Felt** (`--deck`, #212721 / #c9cdbf): the preview deck and PDF bench scroll area only, with a soft `--vig` vignette (the lamp over the table).
- **Walnut / Raised Walnut** (`--wood` #352a18, `--wood2` #463525; daylit pale oak #e2d5ba/#d7c8a8): type-case wells (`.grp`, `.tbg`, `#peTools`) and the hover fill of plates inside them.
- **Page White** (#ffffff): every `.pagedjs_page` and `.pe-page`, in both themes, on screen and in print.

### Status
- **Proof Green** (`--ok`, #7ba05b / #5c7d3d): the autosave stamp dot only.
- **Amber** (`--warn`, #c98a3a / #a06a1f): warn toasts, save-error text, lint badge/line numbers (lint is amber, not brass).
- **Rust** (`--danger`, #bf5147 / #a03d33): destructive menu items (e.g. "Remove image").

### Named Rules
**The Brass Scarcity Rule.** Brass appears in exactly these places and nowhere else: (1) the letterpress thick–thin rule under the masthead (`#topbar::after` — 2px bar, 2px gap, 1px bar); (2) *one* primary ingot per surface (`.btn.pri`: `#btnPdf` in the studio, `#peExport` on the PDF bench); (3) the one micro-caps label role (drawer `h3` / `.sgroup summary`); (4) focus — the global `:focus-visible` outline and the 1.5px field focus ring; (5) the hairline ring on the custom color well (`0 0 0 1px` brass at 65% — "this one you mix yourself"); (6) the selection apparatus on the PDF bench (hover/selected outlines, resize handle, drawing marquee) plus the masthead title's hover warming to `--pri2`. Adding a seventh use requires removing one.

**The Daylit-Not-Inverted Rule.** The light theme re-mixes the same materials (warm plaster, pale oak, daylit felt, deeper brass); it never flips lightness numerically, and `--pri-ink`/status hues are re-derived, not inverted.

**The White Paper Rule.** Document pages are #ffffff in both themes. Chrome theming must never tint them.

## Typography

**Display Font:** DocForge Garamond (with Georgia, serif)
**Body Font:** DocForge Sans (with Segoe UI, system-ui)
**Data Font:** DocForge Mono (with ui-monospace, Cascadia Code, Consolas)

**Character:** A printer's pairing — italic Garamond for the shop's nameplate and headings on its documents-about-itself, a plain 13px sans for the working chrome, and a mono for everything the instruments measure.

### Hierarchy
- **Display** (Garamond italic 700, 22px, ls 0.01em): the masthead brand and the empty-state title ("A blank sheet", in `--tx2`). Italic Garamond also voices the PDF bench hint (12px italic, `--tx3`).
- **Title** (Garamond regular 400, 16–17px): modal headers (16px), help-sheet section heads (`h4`, 17px), popmenu titles (14px). Never bold, never italic.
- **Body** (sans, 13px, ls 0.004em): the chrome default set on `body`; field labels 12px `--tx2`; buttons inherit.
- **Data** (mono, 11–13.2px, `font-variant-numeric: tabular-nums`): the editor (13.2px/1.7), statusbar, save state, page/zoom readouts, find count, kbd chips, PDF metadata. Counters get width floors (`#pgInfo` 60px, `#zoomPct` 40px) so ticking numbers never nudge their neighbors.
- **Label** (sans 10.5px, 700, uppercase, ls 0.14em, brass): settings group labels only — `#settings h3` and `.sgroup summary`.

### Named Rules
**The One Micro-Caps Rule.** There is exactly one uppercase-tracked role in the chrome: the brass drawer labels. No other element may set `text-transform: uppercase` with tracking.

**The Workshop Mono Rule.** Toolbar text glyphs (B, I, H1, Aa, TOC…) are set in the workshop's own mono at 11px — deliberately *set type*, not UI defaults — and every numeric readout uses tabular figures.

## Layout

**Frame.** A fixed-viewport app (`body` is `100dvh`, `overflow: hidden`): 56px masthead (`#topbar`) over a flex row `#main` — settings drawer (272px, slides from the left), editor pane (`flex: 11`, min 320px), preview pane (`flex: 14`, min 380px) — with a mono statusbar under the editor. Spacing steps on a 4px scale: `--sp1..--sp5` = 4/8/12/16/24px.

**Masthead order.** Brand · document identity (`.doc-id`: title button + autosave state, separated by a seam border) · spacer · Templates · walnut file-ops case · help/theme · Settings · Word · the brass PDF ingot. In PDF-edit mode the masthead sheds every studio-only control (doc-id, templates, file case, settings, exports) — the bench keeps only its own.

**Toolbar.** Two composed rows (`.tbrow`), each a run of walnut type-cases (`.tbg`). Rows never wrap: at narrow widths a row scrolls horizontally under the cursor, and a 38px mask fade appears on whichever edge hides more row (`.scroll-l`/`.scroll-r`, kept honest by a scroll listener + ResizeObserver + one post-boot rAF in `main.js`).

**Responsive ladder** (all in `app.css`):
- **≤1180px** — the drawer floats over the editor (absolute, `--elev-l`) instead of squeezing it, so the toolbar rows stay composed.
- **≤1024px** — doc identity narrows (26vw); the PDF bench hint disappears.
- **≤900px** — editor and preview stack vertically (48%/52%); `.doc-id` leaves the masthead.
- **≤720px** (phones) — the masthead composes as two deliberate rows via a `.tbbreak` flex-break and explicit `order`: identity + utilities above, document actions below. Button text labels (`.bl`) drop to icons. Inputs and the editor go to 16px (blocks mobile-Safari zoom). Safe-area insets pad the masthead and statusbar.
- **≤480px** — modals go to 96vw/88dvh; the empty-state grid drops to two columns.
- **`pointer: coarse`** — plates grow to finger size (`.tb` 36×38, `.btn` 38px, cluster 32px, swatches 26px); hover-only keyboard hints are removed.
- **`hover: none`** — the screenshot-placeholder hint shows permanently instead of on hover.
- **`@media print`** — every piece of chrome is hidden; only white pages print, unscaled and shadowless.

## Elevation & Depth

Depth is material, not atmospheric: things are either *recessed into* a surface or *seated on* it. There are no borders around groups and no glows.

### Shadow Vocabulary
- **Recess** (`--recess`: `inset 0 1px 2px rgba(0,0,0,0.35)`; 0.08 alpha daylit): a well — fields, selects, toggle plates, type-case interiors, kbd chips, the instrument cluster, pressed buttons.
- **Machined bevel** (on every solid button: `inset 0 1px 0 var(--edge)` + `inset 0 -1px 0 rgba(0,0,0,0.3)`): lit top edge, seated bottom edge. `--edge` is the bevel-light token (7% rag-paper dark; 60% white daylit).
- **Elevation M** (`--elev-m`: `0 2px 6px …, 0 16px 40px …`): popmenus, floating panels (outline, lint), the image menu, toasts.
- **Elevation L** (`--elev-l`: `0 8px 24px …, 0 32px 80px …`): modals and the floating drawer.
- **Proof shadow** (`.pagedjs_page`, three layers: `0 1px 1px`, `0 3px 8px`, `0 18px 44px`): tight contact + soft ambient — a sheet resting on felt. Re-tuned (lighter, warm-gray) for the daylit theme.
- **Vignette** (`--vig` radial over `--deck`): the lamp over the proof-table; 6% black dark, 6% warm gray daylit.

**Grain.** Two inline-SVG turbulence tiles: `--grain` (160×160 monochrome noise; opacity 0.07 dark vs 0.045 daylit — the dark room needs more tooth for equal perceived texture) laid over `--bg`/`--bg2` chrome bars; `--woodgrain` (240×80, turbulence stretched along the case, `baseFrequency 0.012 0.28`, opacity 0.1) laid over every walnut well.

**Z-ladder:** masthead 5 · floating drawer/outline/lint 40 · popmenus/overlays 60 · image menu 70 · toasts 80.

### Named Rules
**The Seated-Plate Rule.** Every solid button carries the machined bevel; pressing it swaps the bevel for a recess and (feedback only) drops it 0.5px. Nothing in the chrome floats without either a bevel or an elevation shadow.

**The Materials-Not-Effects Rule.** New depth must be expressed with the existing tokens (`--recess`, `--edge`, `--elev-*`, grain, wood, felt) — no new glows, gradients (brass ingot face excepted), or blurs.

## Shapes

Square-ish press hardware: controls sit at **2px** (`--rc` — plates are nearly square), inner toolbar plates at **1px**, small tiles (toggle plate, popmenu swatches, list rows) at **3px**, menus/popovers at **6px** (`--rm`), modals at **10px** (`--rl`). The only circles are color swatches (22px, 26px coarse) and the custom color well. The signature geometry is the letterpress **thick–thin rule** — the 5px masthead underline (2px bar / 2px gap / 1px bar) that the border settings also offer the document itself.

**Icon grammar.** All icons are inline feather-style SVGs: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, **`stroke-width="1.8"`**, round caps and joins (fine interior detail may drop to 1.4–1.6). Sizes: 15px in buttons and toolbar plates, 16px on bench tools, 13–14px in small ghosts. Letter-form actions (B, I, H1, TOC, Aa) are mono text glyphs, not icons; highlight/text-color show their ink as a 4px underbar on a mono "A".

## Components

### Buttons — press furniture
- **Shape:** near-square (2px); 32px tall, 12px side padding (38px on coarse pointers).
- **Default (`.btn`):** raised-plate fill, machined bevel; hover fills with `--line`; active drops 0.5px and recesses. Transitions 160ms ease-out on background/color only.
- **The brass ingot (`.btn.pri`):** the one primary action. Machined brass face — a top-lit gradient (`color-mix` of brass toward #fff8e8 → brass) with a warm bevel (`inset 0 1px 0 rgba(255,244,214,0.55)`), engraving-ink text, 600 weight. Hover brightens the face; active recesses it.
- **Icon (`.btn.icon`):** 32px square, transparent, faded-ink glyph; hover raises to plate fill. Utility icons (help, theme) rest at ghost-ink.
- **Ghost (`.btn.ghost`)** transparent/shadowless; **small (`.btn.small`)** 24px/12px text; **busy:** an embedded 12px `currentColor` ring spinner (`.btnspin`, `spin` 0.7s linear) with `cursor: progress`.
- **Disabled:** opacity 0.55 only.

### Type-cases (walnut wells)
`.grp` (masthead file ops), `.tbg` (toolbar groups), `#peTools` (bench tools): walnut + woodgrain tile, 2px padding, 2px radius, lit front edge + recess (`inset 0 1px 0 var(--edge), var(--recess)`). Plates inside (`.tb`, 28px, 1px radius) are transparent until hover, when they lift to `--wood2`; active scales to 0.96. Inline selects (`.tbsel`) are engraved instead: deepest-ink fill + recess.

### Engraved fields
Inputs/selects/textareas sit *in* the surface: `--bg` fill, no border, 2px radius, 8px padding, `--recess`. Focus adds a 1.5px brass ring outside the recess. Labels above at 12px faded-ink. Paired fields share a `.frow` at equal flex.

### Toggle plates
A 40×22 recessed plate (3px radius) with a 16px square-ish knob (ghost-ink). Checked: the plate fills with rag-paper and the knob flips to `--bg2` at the far side (160ms). The real checkbox is **visually hidden, never `display:none`** — it keeps tab order and the a11y tree, and its `:focus-visible` draws the brass ring on the plate.

### Swatches
22px circles; the active one wears a 2px `--bg2` gap ring plus a 2px rag-paper outer ring, and carries `aria-pressed` (toggled in `main.js`). Hover scales 1.12. The custom `<input type=color>` is styled as a peer circle distinguished only by the brass hairline.

### Popmenus (highlight/text-color/templates)
Fixed-position raised plates: `--bg3`, 6px radius, `--elev-m`, 12px padding, `menuIn` entrance. Garamond 14px title, a 5-column grid of 22px square swatches (3px radius), optional "Custom" color row. The templates menu is a designed menu (`role="menu"`, label + reason per item), positioned under its button with `aria-expanded` bookkeeping; opening focuses the first item; outside-click and Esc close.

### Dialogs
`.overlay` (rgba(10,8,5,0.72) scrim, `fade`) centering a `.modal` (`--bg2`, 10px radius, `--elev-l`, `modalIn`; 680px, `.small` 430px). Semantics are real: `role="dialog" aria-modal="true"`, labelled headers, `tabindex="-1"`. `openOv`/`closeOv` in `main.js` move focus in, trap Tab in a cycle, cancel on Esc, and **return focus to the opener**. Headers are Garamond; bodies are faded-ink at 1.65 line-height; footers right-align actions with the brass ingot last. The help sheet uses Garamond `h4` rails and wall-less reference tables (row seams at 55% `--line`).

### Toasts — proof slips
Inverted slips (rag-paper ground, iron text; amber ground for warnings), 6px radius, `--elev-m`, bottom-center stack. Lifecycle in `main.js`: `pop` in (160ms rise), hold 3400ms (or per-call), then `.out` — a 300ms ease-in drop, removed 400ms later. Exits are faster than entrances: the slip is *taken away*.

### Instrument cluster
`#pvCluster` — pages · zoom · fit as one machined strip: `--bg2`, recess, 26px tall, mono readouts with width floors, 1px seam separators. `#pgInfo` and the find counter are `role="status"` so composition progress is announced.

### Drawer (settings)
A 272px `--bg2` grain panel that slides in 160ms (margin/transform/opacity, with a visibility hand-off); below 1180px it floats over the editor with `--elev-l`. Sections are fronted by brass micro-caps rails (label + 1px seam underline); collapsible groups (`.sgroup`) reuse the same rail with a rotating chevron. The masthead title button opens it and focuses the Title field.

### Empty state — "A blank sheet"
Garamond italic title, ghost-ink guidance, a 3×2 grid of engraved mono `code` chips. Laid out line by line on unhide: `rise` staggered 0/60/120/180ms. `[hidden]` wins via an explicit `display:none` override.

### PDF bench
Same room, same materials: grain bar, walnut tool case, felt deck, white proof pages. Brass marks selection (dashed hover outline, 1.5px selected outline, brass resize handle, brass drawing marquee). The hint is italic Garamond. Entering/leaving the bench replays `deskIn`.

### Motion — the press shows its work
Two speeds, one easing (`--ease: cubic-bezier(0.2,0,0,1)`): **`--dur` 160ms** for feedback (hover fills, presses, menus, toggles, drawer, toast pop) and **`--dur2` 340ms** for compositional moves (sitting down at the desk, proofs settling, mode swaps, the stamp's fade).

| Keyframe | Meaning | Where |
|---|---|---|
| `deskIn` | sitting down at a table (rise 8px + fade, `--dur2`) | `#main` on load and on return; `#pdfEditor` on entry |
| `proofIn` | a fresh proof settles onto the felt (rise 5px, `--dur2`) | each `.pagedjs_page` / `.pe-page`; nth-child stagger 60/120/180ms, capped |
| `press` | the autosave dot lands like an ink stamp (scale 2.2→1, 0.4s) | `#saveState.saved::before`, with the word fading in under it |
| `sortSet` | three type sorts picked up and set (0.72s loop, staggered, letterform heights 8/11/9px) | `#busy` while rendering; reduced motion leaves them standing — still a legible mark |
| `menuIn` | a menu unfolds from its button (scale 0.97 + 3px drop) | popmenus |
| `modalIn` / `fade` | a sheet laid on the desk / scrim | modals / overlays |
| `pop` / `.out` | slip laid down / taken away | toasts |
| `rise` | laid out line by line (6px) | empty state, outline & lint panels |
| `spin` | the only literal spinner | `.btnspin` in a busy export button |

JS motion hooks (`main.js`): **ComposeTicker** (a Paged.js handler) writes truthful progress into the cluster — "p. 4…" per page laid out, overwritten by "12 pages" when the flow completes; the toolbar fade observer keeps scroll cues honest; **applyUiTheme** flips `data-light` on `<html>`, persists to `localStorage`, and briefly promotes the chrome bars (`translateZ(0)` for two rAFs) purely as a Chromium re-raster workaround — visually a no-op, not a mechanic. The **reduced-motion block is global and absolute**: `* { animation: none !important; transition: none !important }` plus removal of press-down transforms.

## Do's and Don'ts

### Do:
- **Do** seat every new control in an existing material: engraved (recess) into `--bg`, or plated (bevel) on `--bg3`, or set in a walnut case.
- **Do** use mono + `tabular-nums` with a `min-width` floor for any readout whose text changes width.
- **Do** give every dialog `role="dialog" aria-modal="true"`, a label, and route it through `openOv`/`closeOv` for trap + focus-restore; give live counters `role="status"`.
- **Do** keep icons on the one grammar: 24 viewBox, 1.8 stroke, round caps, `currentColor`.
- **Do** use `--dur` for feedback and `--dur2` for anything that moves the composition; stagger settles at 60ms steps, capped.
- **Do** keep new brass within the sanctioned list, or trade a use out first.
- **Do** re-mix, not invert, when touching the daylit theme (warm plaster/oak; brass hovers go deeper).

### Don't:
- **Don't** put `--tx3` text on `--bg3` or `--wood2` — it misses 4.5:1 (the kbd chips already stepped up to `--tx2` for this reason). `--tx3` is tuned for `--bg`/`--bg2` only.
- **Don't** outline groups with borders — grouping is done with wells (walnut cases, recesses) and seam hairlines.
- **Don't** add a second uppercase-tracked type role, a second metal, or a second primary ingot on the same surface.
- **Don't** hide the toggle checkbox (or any focusable proxy target) with `display:none` — visually-hidden only.
- **Don't** animate anything outside the named-keyframe grammar, or let any animation survive `prefers-reduced-motion`.
- **Don't** use raw native widgets where the system has a designed peer (the custom color well, the templates menu) — style them into the material.

### Hard Rules (never break)
1. **The document always prints white.** `.pagedjs_page`/`.pe-page` are #fff in both themes; `@media print` shows only the pages — no chrome, no shadows, no scale transform.
2. **Brass scarcity is a closed list** (Colors → The Brass Scarcity Rule). Lint is amber, autosave is green — status never borrows brass.
3. **Chrome never touches `doc.css`.** Document styling (themes, borders, accents) is user-facing product surface; `app.css` styles the room, never the paper.
4. **Single-file build stands.** `src/index.html` composes via `/*@TOKEN@*/` placeholders (`/*@APPCSS@*/`, `@DOCCSS@`, `/*@MAIN@*/`, …) into `dist/DocForge.html`; no external requests, ever — fonts, grain and icons are inline data.
5. **The reduced-motion kill block stays global** (`*`, `!important`) at the bottom of `app.css`.
6. **Selector IDs are load-bearing** — the QA harness (`qa/*.mjs`) drives the real UI by ID; renaming chrome IDs breaks the harness.
7. **The light theme is the daylit workshop, never an inversion** — new tokens must ship both a dark and a daylit value, re-derived from the material.
