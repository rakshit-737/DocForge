---
name: DocForge
description: The copy desk at edition time — newsprint-white chrome, ink hairline rules, one grease-pencil red.
colors:
  # ---- the day desk (the boot DEFAULT; CSS vars in src/app.css :root[data-light]) ----
  newsprint: "#f4f2ec"          # --bg — newsprint-white working surface
  old-newsprint: "#ece9e1"      # --bg2 — bars, trays, drawer, modals
  fresh-sheet: "#faf9f5"        # --bg3 — raised surfaces, buttons, fields, popmenus
  day-soft-rule: "#d2cec2"      # --line — soft rule: tray/field hairlines, separators
  day-ink-rule: "#26261f"       # --rule — structural ink: nameplate, running heads, ticker
  ink: "#1a1a17"                # --tx — primary text; also the toast slip ground
  faded-ink: "#4c4b44"          # --tx2 — secondary text, resting icons, micro-caps labels
  ghost-ink: "#64625a"          # --tx3 — tertiary; ≥4.5:1 on every day surface incl. --bg2
  grease-pencil: "#bb3a2c"      # --pri (and --focus, day) — the one editorial red
  grease-pencil-deep: "#a12f23" # --pri2 (and --danger, day) — hover gains ink, never loses it
  day-stone: "#d8d5cc"          # --deck — the composing stone under the galleys
  day-ok-green: "#2f6f4f"       # --ok — the autosave stamp dot
  day-warn-ochre: "#7d540d"     # --warn — warnings, lint, warn toasts
  # ---- the night desk (:root; authored, chosen with the moon button) ----
  night-slate: "#191b1e"        # --bg — slate under fluorescents
  night-surface: "#1f2226"      # --bg2
  night-tray: "#272b30"         # --bg3
  night-soft-rule: "#3a3f45"    # --line
  night-ink-rule: "#878d94"     # --rule — ink rules read gray under fluorescents
  night-chalk: "#e8e6e1"        # --tx
  night-chalk-2: "#b2b0a9"      # --tx2
  night-chalk-3: "#98978f"      # --tx3 — ≥4.5:1 on every night surface incl. --bg3
  night-grease-pencil: "#bf4234"   # --pri
  night-grease-deep: "#a33327"     # --pri2
  night-focus-red: "#d5493a"       # --focus (and --danger, night) — brightened to hold ≥3:1 rings
  night-stone: "#232527"        # --deck — the stone, after hours
  night-ok-green: "#6da272"     # --ok
  night-warn-ochre: "#c9973a"   # --warn
  # ---- both themes ----
  press-ink: "#ffffff"          # --pri-ink — the only text color on a red plate
  page-white: "#ffffff"         # document pages (.pagedjs_page / .pe-page), always
  highlighter-specimen: "#f5d90a"  # literal ink sample on the highlight tool (.ic-hl) & .pe-hl
  text-ink-specimen: "#c73434"     # literal ink sample on the text-colour tool (.ic-fc)
typography:
  display:
    fontFamily: "DocForge Serif, Georgia, serif"
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "0.005em"
  title:
    fontFamily: "DocForge Serif, Georgia, serif"
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
  rc: "0px"   # --rc — the desk is square-cornered: buttons, trays, fields, chips
  rm: "2px"   # --rm — menus, popovers, panels, toasts, swatches
  rl: "4px"   # --rl — modals only
spacing:
  sp1: "4px"
  sp2: "8px"
  sp3: "12px"
  sp4: "16px"
  sp5: "24px"
components:
  button-desk:
    backgroundColor: "{colors.fresh-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.rc}"
    height: "32px"
    padding: "0 12px"
  button-to-press:
    backgroundColor: "{colors.grease-pencil}"
    textColor: "{colors.press-ink}"
    rounded: "{rounded.rc}"
    height: "32px"
    padding: "0 12px"
  button-to-press-hover:
    backgroundColor: "{colors.grease-pencil-deep}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.faded-ink}"
    rounded: "{rounded.rc}"
    width: "32px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    rounded: "{rounded.rc}"
    height: "32px"
  tool-plate:
    backgroundColor: "transparent"
    textColor: "{colors.faded-ink}"
    rounded: "1px"
    height: "28px"
    padding: "0 6px"
  tool-plate-hover:
    backgroundColor: "{colors.fresh-sheet}"
    textColor: "{colors.ink}"
  tray:
    backgroundColor: "{colors.old-newsprint}"
    rounded: "{rounded.rc}"
    padding: "2px"
  field:
    backgroundColor: "{colors.fresh-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.rc}"
    padding: "8px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.old-newsprint}"
    rounded: "{rounded.rm}"
    padding: "8px 16px"
  modal:
    backgroundColor: "{colors.old-newsprint}"
    rounded: "{rounded.rl}"
    width: "min(680px, 92vw)"
---

# Design System: DocForge

Everything below is extracted from the built app — `src/app.css` (tokens + chrome; its header comment is the language contract), `src/index.html` (structure + the direction contract in the body's opening comment; seed key 53cee02d), `src/js/main.js` (behavior) — and confirmed against `qa/out/w1–w5` screenshots. Product truth lives in `PRODUCT.md`; this file is strictly visual. Day-desk token names are the defaults; every night token is listed beside its day peer.

## Overview

> **Scope.** This file governs the studio chrome (the copy desk) and the PDF bench. The landing page at `/` (apps/web/app/page.tsx, landing.css) is a deliberately separate world — the drawing sheet — recorded in `docs/LANDING-DESIGN.md`; nothing below applies to it, and nothing there reaches the studio.

**Creative North Star: "The Copy Desk"**

DocForge is the copy desk at edition time. Text is copy, the preview is the galley, export is going to press. The chrome is a newspaper composing room: newsprint-white working surfaces with a faint paper grain, ink hairline rules doing the work borders and shadows used to do, square corners, ruled trays and printed-form fields, teletype mono instrumentation, and exactly one color spent editorially — grease-pencil red on the TO-PRESS plate, proof marks, and focus. The masthead is a serif nameplate over a double ink rule; the preview deck is the stone, and pages lie on it like galleys. It deliberately refuses the category default of a soft dark editor with one metallic accent: the *day* desk is what the app boots into, and the dark variant is the same room on the night shift — slate under fluorescents, authored value by value, never an inversion. The document itself is not part of this world: it always renders and prints on white.

The story of the first viewport: the writer sits down at a working desk (nameplate masthead over the double rule), sees their copy typeset live in the galley column (editor and galley as two ruled columns), and sends it to press with the one red plate top right, over a wire-ticker statusbar.

**Key Characteristics:**
- One editorial color (grease-pencil red), spent from a short, closed list — everything else is ink on newsprint.
- Flat ruled grammar: 1px hairline trays and printed-form fields; a recess only where something is physically a well.
- Two weights of rule with fixed roles: `--rule` is structural ink, `--line` is soft furniture. They never trade places.
- Square-cornered desk: radii 0 / 2 / 4 (`--rc`/`--rm`/`--rl`), 1px on inner tool plates.
- Teletype instrumentation: mono with tabular figures for everything the desk measures, with width floors so counters never nudge neighbors.
- Two-speed motion in the press's own vocabulary: `--dur` 160ms feedback, `--dur2` 340ms compositional; reduced-motion kills all of it.

## Colors

Ink on newsprint by day, chalk on slate by night, with one grease-pencil red held back for editorial marks.

### Primary
- **Grease-Pencil Red** (`--pri`, #bb3a2c day / #bf4234 night): the copy editor's pencil — the one color the chrome is allowed to spend. Sanctioned uses only (see The Grease-Pencil Rule).
- **Deep Grease** (`--pri2`, #a12f23 day / #a33327 night): hover state of red. Hover gains ink, never loses it — red always darkens under the pointer.
- **Focus Red** (`--focus`, #bb3a2c day / #d5493a night): a dedicated focus token tuned per theme so the 2px ring holds ≥3:1 on every surface; at night it is *brighter* than `--pri` because `--pri` alone would sink into the slate. Day reuses the pencil value.
- **Press Ink** (`--pri-ink`, #ffffff both): the only text color permitted on a red plate.

### Neutral
- **Newsprint / Night Slate** (`--bg`, #f4f2ec / #191b1e): the working surface — page ground, editor pane, toolbar ground; also the recessed toggle track and the pressed bench tool.
- **Old Newsprint / Night Surface** (`--bg2`, #ece9e1 / #1f2226): bars and trays — the drawer, statusbar, tray interiors (`.grp`, `.tbg`, `#peTools`), instrument cluster, modals, PDF bench bar.
- **Fresh Sheet / Night Tray** (`--bg3`, #faf9f5 / #272b30): raised surfaces — buttons, form fields, popmenus, floating panels, kbd chips, hover fills.
- **Soft Rule** (`--line`, #d2cec2 / #3a3f45): the quiet hairline — tray and field borders, modal header/footer seams, separators, scrollbar thumbs, table row seams (at 55% in help tables).
- **Ink Rule** (`--rule`, #26261f / #878d94): structural ink — the masthead's double rule, the drawer's running-head underlines, the wire-ticker's top rule, the `.btn:hover` border, the hairline ring on the custom color well. At night, ink rules read fluorescent gray.
- **Ink / Night Chalk** (`--tx`, #1a1a17 / #e8e6e1): primary text and the toast slip's ground; also the filled toggle track when checked, and the caret.
- **Faded Ink** (`--tx2`, #4c4b44 / #b2b0a9): secondary text, resting icon color, modal body copy, the micro-caps drawer labels, kbd chip text.
- **Ghost Ink** (`--tx3`, #64625a / #98978f): tertiary — mono micro-text, hints, placeholders, the busy sorts. Tuned ≥4.5:1 on `--bg`/`--bg2` by day (and on *every* night surface including `--bg3`); **not** safe on the day fresh sheet — kbd chips already stepped up to `--tx2` for exactly this.
- **The Stone** (`--deck`, #d8d5cc / #232527): the composing stone — the preview deck and PDF bench scroll grounds only. One flat, evenly lit working surface; no vignette.
- **Page White** (#ffffff): every `.pagedjs_page` and `.pe-page`, in both themes, on screen and in print.

### Status
- **OK Green** (`--ok`, #2f6f4f / #6da272): the autosave stamp dot only.
- **Warn Ochre** (`--warn`, #7d540d / #c9973a): warn toasts, save-error text, the lint badge and its line numbers. Lint is ochre, never red.
- **Danger** (`--danger`, #a12f23 / #d5493a): destructive menu items only ("Remove image"). It borrows its values from the grease-pencil ramp but spends them through its own token.

### Specimen inks (literal, theme-independent)
The two color-tool icons carry literal ink samples, not chrome tokens: `.ic-hl` a 4px #f5d90a highlighter underbar, `.ic-fc` a 4px #c73434 underbar. The bench highlight `.pe-hl` uses the same yellow at 42% multiply. These preview *document* inks; they are not the grease pencil and don't count against its list.

### Named Rules
**The Grease-Pencil Rule.** Red is a closed list, counted from code (`src/app.css`) — every `--pri`/`--pri2`/`--focus` consumer, 11 rule-sites in 5 roles, and nothing else:
1. The global `:focus-visible` ring — `outline: 2px solid var(--focus)`, offset 1 (app.css:98).
2. The toggle's proxy focus ring — `.toggle input:focus-visible + .tg`, same 2px `--focus` drawn on the plate (app.css:315).
3. The masthead title warming on hover — `#docTitle:hover { color: var(--pri2) }` (app.css:153).
4. The TO-PRESS plate — `.btn.pri` (`--pri` face, `--pri2` border, `--pri-ink` text; app.css:194–196) and (5) its hover to `--pri2` (app.css:199). Exactly three instances exist in the HTML, one per surface: `#btnPdf` (studio masthead), `#peExport` (PDF bench), `#cfYes` (confirm dialog's Continue).
6. Printed-form field focus — `.field input/select/textarea:focus` and the command palette's query line (`#cmdkInput:focus`) swap their resting rule for `border-color: var(--pri)` in one shared declaration (the form fields rest on a soft `--line` box, the query line on its engraved 1px `--rule` bottom), and (7) the find-bar inputs do the same.
8–11. The proof marks on the PDF bench: `.pe-edit:hover` dashed outline (`--pri` at 65%), `.pe-edit.sel` 1.5px solid outline, the `.pe-resize` handle fill, and the `.pe-drawing` marquee (`--pri` border, 8% fill) (app.css:763–769).
Adding a twelfth site requires removing one.

**The Two Rules Rule.** `--rule` (structural ink: nameplate, running heads, ticker, hover borders, the mix-it-yourself ring) and `--line` (soft furniture: tray/field hairlines, seams, scrollbars) have fixed roles that never blur. Promoting a seam to ink, or softening a structural rule, is a design change, not a restyle.

**The Night Shift Rule.** The day desk is the default the app boots into (`main.js` boots `data-light` unless the stored preference is "dark"); the night desk is the authored slate variant. Every token ships both values, re-derived — never a numeric inversion (night's `--rule` goes *gray*, night's `--focus` goes *brighter*).

**The White Paper Rule.** Document pages are #ffffff in both themes. Chrome theming must never tint them.

## Typography

**Display Font:** DocForge Serif (Source Serif 4; falls back to Georgia, serif)
**Body Font:** DocForge Sans (Source Sans 3; falls back to Segoe UI, system-ui)
**Data Font:** DocForge Mono (Source Code Pro; falls back to ui-monospace, Cascadia Code, Consolas)

**Character:** A newspaper's pairing — a bold serif nameplate for identity, a plain 13px sans for the working chrome, and teletype mono for everything the desk measures. The faces are registered on the app document at boot so the chrome never waits for the first preview render.

### Hierarchy
- **Nameplate** (serif 700, 22px, ls 0.005em): the `.brand` masthead wordmark. The empty-state title ("A blank sheet") is the serif *italic* at 22px in `--tx2`; the bench hint ("double-click any text to rewrite it") is the italic at 12px in `--tx3`.
- **Title** (serif 400, 14–17px): modal headers (16px), help-sheet section heads (`h4`, 17px, over a soft rule), popmenu titles (14px). Never bold.
- **Body** (sans, 13px, ls 0.004em): the chrome default set on `body`; the doc title button 13.5px/600; field labels 12px `--tx2`; buttons inherit.
- **Data** (mono, 10–13.2px, `font-variant-numeric: tabular-nums`): the editor (13.2px/1.7, tab-size 2), the wire-ticker statusbar (12px), save state (11px), page/zoom counters, find count, PDF metadata, kbd chips (10px). Counters carry width floors (`#pgInfo` 60px, `#zoomPct` 40px, `#peZoomPct` 42px) so the composing ticker never nudges the zoom controls.
- **Label** (sans 10.5px, 700, uppercase, ls 0.14em, `--tx2`): the one micro-caps role — settings group labels (`#settings h3`, `.sgroup summary`), each set over its own 1px `--rule` underline like a style sheet's running heads.

### Named Rules
**The One Micro-Caps Rule.** There is exactly one uppercase-tracked role in the chrome: the drawer's running heads. No other element may set `text-transform: uppercase` with tracking.

**The Teletype Rule.** Toolbar text glyphs (B, I, H1, Aa, TOC…) are set in the desk's own mono at 11px — deliberately set type, not UI defaults — and every numeric readout uses tabular figures behind a `min-width` floor.

## Layout

**Frame.** A fixed-viewport app (`body` is `100dvh`, `overflow: hidden`, 13px sans): a 56px masthead (`#topbar`) over a flex row `#main` — settings drawer (272px, slides from the composing room at left), editor pane (`flex: 11`, min 320px), preview pane / the stone (`flex: 14`, min 380px) — with the wire-ticker statusbar under the editor. Spacing steps on a 4px scale: `--sp1..--sp5` = 4/8/12/16/24px.

**Masthead order.** Nameplate · document identity (`.doc-id`: title button + autosave state behind a 1px `--line` left border) · spacer · Templates · the file-ops tray (`.grp`) · help/theme icons · Settings · Word · the red TO-PRESS plate. Under it, the nameplate's signature: a 5px double ink rule (`#topbar::after` — 2px `--rule`, 2px gap, 1px `--rule`). In PDF-edit mode the masthead sheds every studio-only control (doc-id, templates, file tray, settings, exports) — the proofing bench keeps only its own.

**Toolbar.** Two composed rows (`.tbrow`), each a run of ruled trays (`.tbg`: `--bg2` fill, 1px `--line` border, 2px padding, square). Rows never wrap: at narrow widths a row scrolls horizontally under the cursor, and a 38px mask fade appears on whichever edge hides more row (`.scroll-l`/`.scroll-r`, kept honest by a scroll listener + ResizeObserver + one post-boot rAF in `main.js`).

**Responsive ladder** (all in `app.css`):
- **≤1180px** — the drawer floats over the editor (absolute, `--elev-l`) instead of squeezing it, so the two toolbar rows stay composed.
- **≤1024px** — doc identity narrows (26vw); the bench hint disappears.
- **≤900px** — editor and preview stack vertically (48%/52%); `.doc-id` leaves the masthead.
- **≤720px** (phones) — the masthead composes as two deliberate rows via a `.tbbreak` flex-break and explicit `order`: identity and utilities above, document actions below. Button text labels (`.bl`) drop to icons. Inputs and the editor go to 16px (blocks mobile-Safari zoom). Safe-area insets pad the masthead and statusbar.
- **≤480px** — modals go to 96vw/88dvh; the empty-state grid drops to two columns.
- **`pointer: coarse`** — plates grow to finger size (`.tb` 36×38, `.btn` 38px, cluster 32px, swatches 26px); hover-only keyboard hints are removed.
- **`hover: none`** — the screenshot-placeholder hint shows permanently instead of on hover.
- **`@media print`** — every piece of chrome is hidden; only white pages print, unscaled, shadowless, animation-free.

## Elevation & Depth

The desk is flat and ruled. A 1px hairline box does the work a shadow used to do: trays, fields, buttons, the instrument cluster and kbd chips are all bordered flat blocks on flat ground. Shadows exist in exactly two situations — where paper physically lies on the stone, and where a surface genuinely floats above the desk. A recess appears only where something is a true physical well.

### Shadow Vocabulary
- **Recess** (`--recess`: `inset 0 1px 2px` at 0.3 alpha night / 0.07 day): true wells only — the toggle track (`.tg`), the engaged bench tool (`.pe-tool.on`), and the bench color well (`#peColor`). Nothing else recesses; a pressed `.btn` just nudges 0.5px.
- **Elevation M** (`--elev-m`: `0 2px 6px …, 0 16px 40px …`): floating chrome — popmenus, the image menu, outline and lint panels, toasts.
- **Elevation L** (`--elev-l`: `0 8px 24px …, 0 32px 80px …`): modals and the floating drawer (≤1180px).
- **Galley shadow** (`.pagedjs_page`, three layers: `0 1px 1px`, `0 3px 8px`, `0 18px 44px`): tight contact plus soft ambient — a real offset sheet resting on the stone. Re-tuned lighter and warm-gray for the day desk via a `:root[data-light]` override. The bench's `.pe-page` carries a two-layer cousin.
- **Scrim** (`.overlay`: `rgba(10,8,5,0.72)`): under modals.

**Grain.** One inline-SVG turbulence tile per theme (`--grain`, 160×160 monochrome noise; opacity 0.05 night / 0.04 day) laid over the chrome's working surfaces: masthead, toolbar, drawer, statusbar, and the bench bar — never over the stone or the pages.

**Z-ladder:** masthead 5 · floating drawer/outline/lint 40 · popmenus/overlays 60 · image menu 70 · toasts 80.

### Named Rules
**The Flat Ruled Desk Rule.** New grouping is expressed with a 1px rule (`--line` for furniture, `--rule` for structure) on a flat token surface — never with a shadow, glow, gradient, or bevel.

**The True Well Rule.** `--recess` is reserved for controls that are physically wells (a track a knob slides in, a tool socket a plate sits down into). A hover state, a button, a field is not a well.

## Shapes

Square-cornered desk hardware: chrome controls sit at **0** (`--rc` — buttons, trays, fields, chips, kbd, cluster), menus/popovers/panels/toasts/swatches at **2px** (`--rm`), modals alone at **4px** (`--rl`). Inner tool plates (`.tb`) take 1px, the busy sorts 0.5px; the only round things are the scrollbar thumbs (5px) and the busy-button spinner ring. The signature geometry is the **double ink rule** under the nameplate — 2px bar, 2px gap, 1px bar — echoed in single form by the drawer's running-head underlines and the ticker's top rule.

**Icon grammar.** All icons are inline SVGs on one grammar: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, **`stroke-width="1.8"`**, round caps and joins (fine interior detail may drop to 1.4–1.6, e.g. the numbered-list digits). Sizes: 15px in buttons and tool plates, 16px on bench tools, 13–14px in small ghosts, with tiny filled dots (`circle fill="currentColor"`) for punctuation. Letter-form actions (B, I, H1, TOC, Aa, x²) are mono text glyphs, not icons; the two color tools show their ink as a 4px specimen underbar on a mono "A".

## Components

### Buttons — desk furniture
- **Shape:** square (0), 32px tall, 12px side padding (38px tall on coarse pointers).
- **Default (`.btn`):** fresh-sheet fill, 1px `--line` border; hover promotes the border to `--rule` (soft rule → ink); active nudges down 0.5px — a plain physical press, no shadow play. Transitions 160ms ease-out on background/color/border only.
- **The TO-PRESS plate (`.btn.pri`):** the one red plate per surface — `--pri` fill, `--pri2` border, white ink, 600 weight; hover deepens to `--pri2`.
- **Icon (`.btn.icon`):** 32px square, transparent and borderless at rest, `--tx2` glyph; hover restores the fresh-sheet fill and hairline. Utility icons (help, theme) rest at `--tx3`.
- **Ghost (`.btn.ghost`):** transparent/borderless; hover same as icon. **Small (`.btn.small`):** 24px/12px text.
- **Busy:** an embedded 12px `currentColor` ring spinner (`.btnspin`, `spin` 0.7s linear), `cursor: progress`, opacity 0.85. **Disabled:** opacity 0.55 only.

### Ruled trays
`.grp` (masthead file ops), `.tbg` (toolbar groups), `#peTools` (bench tools): `--bg2` fill, 1px `--line` hairline, 2px padding, square. Plates inside (`.tb`, 28px min, 1px radius) are transparent until hover, when they lift to `--bg3`; active scales to 0.96. Inline selects (`.tbsel`) are hairline boxes on `--bg3`. The instrument cluster (`#pvCluster`) is the same grammar at 26px with 1px `--line` separators; the bench bar's `.tbsep` separators are the same 1px `--line` at 16px.

### Printed-form fields
Inputs/selects/textareas are ruled hairline boxes, not soft wells: `--bg3` fill, 1px `--line` border, square, 8px padding. **Focus swaps the rule for the grease pencil** (`border-color: var(--pri)`), the find-bar inputs identically (in mono at 12px). Labels above at 12px `--tx2`; paired fields share a `.frow` at equal flex.

### Toggles
A 40×22 track (2px radius) recessed into `--bg` (`--recess` — a true well) with a 16px **square** knob in `--tx3`. Checked: the track fills with ink (`--tx`) and the knob flips to `--bg2` at the far side (160ms). The real checkbox is **visually hidden, never `display:none`** — it keeps tab order and the a11y tree, and its `:focus-visible` draws the red ring on the track.

### Swatches
22px **square ink blocks** (2px radius; 26px coarse), hover scales 1.12. The active one wears a 2px `--bg2` gap ring plus a 2px ink outer ring — selection is ink, not red — and carries `aria-pressed` (toggled in `main.js`). The custom `<input type=color>` is a peer square distinguished only by a 1px `--rule` hairline ring: "this one you mix yourself."

### Popmenus (highlight / text-colour / templates)
Fixed-position sheets: `--bg3`, 2px radius, `--elev-m`, 12px padding, `menuIn` entrance. Serif 14px title, a 5-column grid of 22px square swatches, optional "Custom" row. The templates menu is a designed menu (`role="menu"`, label + one-line reason per item), positioned under its button with `aria-expanded` bookkeeping; opening focuses the first item, arrows/Home/End walk the list; outside-click and Esc close (Esc returns focus to the opener).

### Dialogs
`.overlay` scrim centering a `.modal` (`--bg2`, 4px radius, `--elev-l`, `modalIn`; 680px, `.small` 430px). Semantics are real: `role="dialog" aria-modal="true"`, labelled headers, `tabindex="-1"`. `openOv`/`closeOv` in `main.js` move focus in, trap Tab in a cycle, cancel on Esc, and **return focus to the opener**. Headers are serif 16px over a `--line` seam; bodies are `--tx2` at 1.65 line-height; footers right-align actions with the red plate last (`#cfYes`). The help sheet uses serif `h4` rails and wall-less reference tables (row seams at 55% `--line`).

### Command palette — the desk's spike
`Ctrl+K`. A `.modal.small` opened **top-anchored** (11vh, so the galley stays in view) through the same `openOv` machinery: an engraved mono query line (`#cmdkInput` — borderless but for a 1px `--rule` bottom; focus joins the printed-form grease-pencil site), a ruled `role="listbox"` of every desk action grouped under mono `--tx3` group lines (File · Export · Insert · View · Templates), teletype shortcut hints right-aligned, and a kbd-hint footer over a `--line` seam. The query line is a `role="combobox"` controlling the listbox (`aria-controls`/`aria-autocomplete="list"`); group lines are `aria-hidden` wayfinding and options carry `tabindex="-1"`, so DOM focus never leaves the input. Selection is a flat `--bg3` fill steered by ↑/↓/Home/End with `aria-activedescendant` (cleared when nothing matches); Enter runs — or, on an empty result, keeps the palette and the query; Esc closes and restores focus. The list is built fresh on each open so the template roster and the theme label stay truthful. Unavailable on the proofing bench, and it will not open over (or under) another dialog. Shortcut hints and the placeholder sit at `--tx2` — the kbd-chip precedent for the day fresh sheet.

### Drop affordance — copy landing on the desk
While a file is held over the editor, `#dropHint` lays an ink-ruled landing zone over the writing surface (2px dashed `--rule` on `--bg` at 93%, serif italic title, one-line format list; `fade` in at `--dur`), naming what dropping will do. Counted dragenter/dragleave so child churn can't flicker it; `pointer-events: none` so the editor stays the drop target. Ink, not red — dropping is composition, not an editorial mark.

### The manuscript is an editing surface
Every galley's content area is `contenteditable`: the affordances are an ink caret, a warm-gray selection and the text cursor — no outlines, no boxes ("of course I can edit this", never "this is a contenteditable div"). Generated islands (TOC, references, resolved cross-references, KaTeX, figures, auto heading numbers) are `contenteditable="false"` and keep the arrow cursor. Mechanics live in `live-edit.js`: every top-level block carries its source-line span (`data-ss`/`data-se`, stamped token-by-token in `Engine.render`); an edit serializes the affected blocks back to Markdown and splices exactly those lines, on a 250ms pause so typing costs nothing. Recomposition happens offscreen (the old galleys never blank), then the viewport re-anchors to the topmost visible block — fragment-aware — and the caret re-lands by (block, text-offset). The folio readout follows the reader: "p. 4 · 12 pages". Both panes name themselves with mono `.pane-tag` lines (statusbar "source", instrument row "manuscript").

### Pane divider & focus mode
`#paneDivider` is a 5px seam between the panes, invisible until hover shows a 1px `--rule` line; dragging resizes the split (22–65%, persisted as `docforge.split`). Ctrl+Shift+Enter clears the desk: `body.focus-mode` hides the source pane, drawer and divider — the manuscript alone, full width.

### Toasts — proof slips
Inverted slips: ink ground (`--tx`), `--bg2` text, 600 weight; ochre ground for warnings. 2px radius, `--elev-m`, bottom-center stack. Lifecycle in `main.js`: `pop` in (160ms rise), hold 3400ms by default — `toast(msg, type, ms)` takes a duration for slips that must linger (the print instructions hold 8000ms) — then `.out`, a 300ms ease-in drop, removed 400ms later. Exits are faster than entrances: the slip is *taken away*.

### Wire ticker (statusbar)
One structural `--rule` on top of a `--bg2` grain bar: mono 12px tabular readouts — word count with a "min read" that appears past 60 words, the ochre lint badge, and a kbd hint whose chips are `--bg3` hairline boxes in `--tx2` (stepped up from `--tx3` for contrast on the fresh sheet).

### Drawer (settings)
A 272px `--bg2` grain panel that slides in 160ms (margin/transform/opacity with a visibility hand-off); below 1180px it floats over the editor with `--elev-l`. Sections are fronted by the micro-caps running heads over 1px `--rule` underlines; collapsible groups (`.sgroup`) reuse the same rail with a rotating chevron (`--dur`). The masthead title button opens it and focuses the Title field.

### Empty state — "A blank sheet"
Serif italic title in `--tx2`, ghost-ink guidance, a 3×2 grid of mono `code` chips (hairline boxes on `--bg2`). Laid out line by line on unhide: `rise` staggered 0/60/120/180ms. `[hidden]` wins via an explicit `display:none` override.

### PDF bench — a proofing bench in the same room
Same materials: grain bar, ruled tool tray, the stone, white proof pages. The engaged tool sits *down into* its socket (`.pe-tool.on`: `--bg` fill + `--recess`). Red is the proof-mark apparatus: dashed hover outline, 1.5px selected outline, the resize handle, the drawing marquee. The hint is the serif italic. Whiteout slips are #fff; highlights are the specimen yellow at 42% multiply. Entering and leaving the bench replays `deskIn`; `#peExport` is the bench's one red plate.

### Motion — the desk shows its work
Two speeds, one easing (`--ease: cubic-bezier(0.2,0,0,1)`): **`--dur` 160ms** for feedback (hover fills, presses, menus, toggles, drawer, toast pop, modal entrances) and **`--dur2` 340ms** for compositional moves (sitting down at the desk, galleys settling, the stamp's fade).

| Keyframe | Meaning | Where |
|---|---|---|
| `deskIn` | sitting down at a table (rise 8px + fade, `--dur2`) | `#main` on load and on return from the bench; `#pdfEditor` on entry |
| `proofIn` | a freshly composed galley settles onto the stone (rise 5px, `--dur2`) | each `.pagedjs_page` / `.pe-page`; nth-child stagger 60/120/180ms, capped — Paged.js appends pages as it lays them out, so long documents stagger naturally |
| `press` | the autosave dot lands like an ink stamp (scale 2.2→1, 0.4s) | `#saveState.saved::before`, the word arriving under it via `fade` |
| `sortSet` | the compositor's hand: three type sorts picked up and set in sequence (0.72s loop, staggered 0.12s, letterform heights 8/11/9px) | `#busy` while rendering; reduced motion leaves them standing — still a legible "setting type" mark |
| `menuIn` | a menu unfolds from its button (scale 0.97 + 3px drop, `--dur`) | popmenus |
| `modalIn` / `fade` | a sheet laid on the desk / the scrim | modals / overlays |
| `pop` / `.out` | slip laid down / taken away | toasts |
| `rise` | laid out line by line (6px) | empty state, outline & lint panels |
| `spin` | the only literal spinner | `.btnspin` in a busy export button |

JS motion hooks (`main.js`): **ComposeTicker** (a Paged.js handler) writes truthful progress into the instrument cluster — "p. 4…" per page laid out, overwritten by "12 pages" the moment the flow completes; the `.tbrow` scroll-fade observer keeps the clipped-edge cues honest; **applyUiTheme** flips `data-light` on `<html>`, persists to `localStorage` (`docforge.ui`), and briefly promotes the chrome bars (`translateZ(0)` for two rAFs) purely as a Chromium re-raster workaround — visually a no-op, not a mechanic. Boot calls `applyUiTheme(stored !== "dark")`: **the day desk is the default**. The **reduced-motion block is global and absolute**: `* { animation: none !important; transition: none !important }` plus removal of press-down transforms.

## Do's and Don'ts

### Do:
- **Do** build every new grouping as a flat ruled block: token surface + 1px hairline, `--line` for furniture and `--rule` for structure.
- **Do** use mono + `tabular-nums` with a `min-width` floor for any readout whose text changes width.
- **Do** give every dialog `role="dialog" aria-modal="true"`, a label, and route it through `openOv`/`closeOv` for trap + focus-restore; give live counters `role="status"`.
- **Do** keep icons on the one grammar: 24 viewBox, 1.8 stroke, round caps, `currentColor` (1.4–1.6 for fine interior detail only).
- **Do** use `--dur` for feedback and `--dur2` for anything that moves the composition; stagger settles at 60ms steps, capped.
- **Do** keep new red inside the Grease-Pencil Rule's closed list, or trade a site out first — and let hover always deepen red, never lighten it.
- **Do** author both desks when adding a token: a day value and a night value, each re-derived for its light (night rules go gray, night focus goes brighter).

### Don't:
- **Don't** put `--tx3` text on the day fresh sheet (`--bg3`) — it misses 4.5:1 there (the kbd chips already stepped up to `--tx2`). Night `--tx3` is safe on all night surfaces.
- **Don't** add shadows, glows, gradients, or bevels to desk furniture — elevation belongs only to galleys on the stone and genuinely floating chrome (popmenus, modals, toasts, the floating drawer).
- **Don't** recess anything that isn't a true physical well (today: the toggle track, the engaged bench tool, the bench color well — that's the whole list).
- **Don't** add a second uppercase-tracked type role, a second editorial color, or a second red plate on the same surface.
- **Don't** hide the toggle checkbox (or any focusable proxy target) with `display:none` — visually-hidden only.
- **Don't** animate anything outside the named-keyframe grammar, or let any animation survive `prefers-reduced-motion`.
- **Don't** use raw native widgets where the system has a designed peer (the custom color well, the templates menu) — style them into the desk.

### Hard Rules (never break)
1. **The document always prints white.** `.pagedjs_page`/`.pe-page` are #fff in both themes; `@media print` shows only the pages — no chrome, no shadows, no scale transform.
2. **Red scarcity is a closed list** (Colors → The Grease-Pencil Rule: 11 counted rule-sites, 3 `.btn.pri` instances). Lint and warnings are ochre, autosave is green — status never borrows the grease pencil.
3. **Chrome never touches `doc.css`.** Document styling (themes, borders, accents) is user-facing product surface; `app.css` styles the desk, never the paper.
4. **Single-file build stands.** `src/index.html` composes via `/*@TOKEN@*/` placeholders (`/*@APPCSS@*/`, `@DOCCSS@`, `/*@MAIN@*/`, …) through `build.mjs` into `dist/DocForge.html`; no external requests, ever — fonts, grain and icons are inline data.
5. **The reduced-motion kill block stays global** (`*`, `!important`) in `app.css`.
6. **Selector IDs are load-bearing** — the QA harness (`qa/*.mjs`) drives the real UI by ID; renaming chrome IDs breaks the harness.
7. **The day desk is the default and the night desk is authored, never an inversion** — new tokens ship both values, re-derived from the room's light.
8. **`--rule` vs `--line` roles never blur** — structural ink and soft furniture are different materials.
