# DocForge — application-chrome redesign brief

**You are** an agentic coding assistant working inside this repository.
**Your mission:** redesign DocForge's application chrome — the UI *around* the document — so it looks and feels like a crafted professional tool instead of a generic AI-generated interface. You will first propose three visual directions and stop for a human choice, then execute the chosen one end-to-end with a screenshot-driven critique loop.

The *document output* is sacred and out of scope: `src/doc.css`, everything rendered inside `.pagedjs_page`, the render pipeline (`src/js/engine.js`), and both exporters must not change by a pixel.

---

## 0. Non-negotiable constraints — read before touching anything

1. **Single-file, offline, dependency-free product.** The build (`node build.mjs`) inlines everything into `dist/DocForge.html`. No frameworks, no Tailwind/shadcn/Radix, no icon packs or icon fonts, no CDN links, no new npm dependencies, no runtime network fetches. All chrome styling is hand-authored CSS in `src/app.css`; all chrome DOM is in `src/index.html`; all chrome behavior is in `src/js/main.js`.
2. **Behavior contract.** `main.js` binds by id/class (see `bindChrome()` and nearby). You may restructure DOM freely *around* these hooks, but every one must keep working: `#topbar` `#templateSelect` `#btnNew` `#btnOpen` `#btnSaveProj` `#btnHelp` `#btnDark` `#btnSettings` `#btnDocx` `#btnPdf` · `#settings` (+ `.open` class) and every `#s*`/`#t*`/`#c*` field id inside it, `.sw[data-c]`, `.toggle`/`.tg` · `#toolbar` `.tb[data-act]` `#tbHl` `#tbFc` `#tbFont` `#tbSize` · `#findBar` `#findInput` `#replInput` `#findCount` `#findPrev` `#findNext` `#replOne` `#replAll` `#findClose` · `#editor` · `#statusbar` `#wordCount` `#saveState` (+ `.saved`/`.err`) `#lintBadge` `#lintPanel` · `#previewPane` `#previewBar` `#btnOutline` (+ `.on`) `#busy` (+ `.on`) `#pgInfo` `#zoomOut` `#zoomPct` `#zoomIn` `#zoomFit` `#previewScroll` `#scaleWrap` `#outlinePanel` · `.overlay`(+`.open`) `#confirmOverlay` `#cfTitle` `#cfBody` `#cfNo` `#cfYes` `#helpOverlay` `#keysOverlay` `[data-close]` · `#imgMenu` `#imAttach` `#imReplace` `#imRemove` · `.popmenu` `#hlMenu` `#fcMenu` `#hlGrid` `#fcGrid` `#fcCustom` · `#toasts`/`.toast` · `#embedHint` (+ `.on`) · `#imgInput` `#projInput` · `.btn.busy`/`.btnspin`. If you rename or restructure a hook, update `main.js` in the same commit and re-run the QA suite.
3. **The `@media print` block** at the bottom of `app.css` must continue to hide 100 % of the chrome and neutralize transforms — PDF export depends on it. Test it after structural changes.
4. **Two chrome themes.** Dark is the default; `:root[data-light]` is the light variant. Both must be *designed* — the light theme may not be a lazy inversion. The document pages stay paper-white in both.
5. **`prefers-reduced-motion`** must disable every animation/transition you add — extend the existing block, don't bypass it.
6. **Size budget.** `node build.mjs` prints the output size (~2.5 MB, mostly fonts). Your redesign should add ≈ 0: inline SVG and CSS only. Keep the dist delta under +30 KB.
7. **Free typography.** `engine.js` generates `@font-face` for every embedded family, so the chrome may use any of them at zero size cost: `"DocForge Sans"` (Source Sans 3), `"DocForge Serif"` (Source Serif 4), `"DocForge Mono"` (Source Code Pro), `"DocForge Inter"`, `"DocForge Montserrat"`, `"DocForge Garamond"` (EB Garamond), `"DocForge Crimson"` (Crimson Pro) — exact family names per the `EMBEDDED` table in `engine.js`. Regular/Bold/Italic/BoldItalic cuts only (Mono: no italics) — no other weights exist, so design with weight pairs, not a 9-weight scale.
8. **Don't turn the editor into a WYSIWYG**, don't touch Markdown semantics, templates' content, exporters, or the linter's logic. This is a *skin and interaction* redesign, not a feature rewrite.

## 1. Orient first (mandatory)

```bash
npm install
node build.mjs            # → dist/DocForge.html
node qa/uishot.mjs        # → qa/out/ui-{dark,settings,border,light,panels}.png + console-error report
```

`qa/_browser.mjs` finds a system Chrome/Edge automatically (`PW_CHROMIUM` env overrides). **Open and actually look at all five screenshots before writing any code.** Then read `src/index.html` and `src/app.css` top to bottom, and skim `main.js` around `bindChrome()`.

Chrome surface inventory you are redesigning (all of it, not just the top bar): top bar + brand · editor toolbar · find/replace bar · editor + status bar · lint badge/panel · settings drawer · preview bar (outline toggle, page info, zoom) · preview deck + page cards (the *staging* around pages — page interiors are off-limits) · outline panel · confirm/help/shortcut modals · image context menu · highlight/text-color popmenus · toasts · embed hint bar · scrollbars, focus rings, selection color.

## 2. Diagnosis — what reads as "AI slop" here, specifically

Confirm each of these against the screenshots, then fix all of them. This list is the floor, not the ceiling — add what you find.

1. **A row of identical pills.** The top bar's right side is eight same-weight bordered controls in a line. Nothing is anchored: Word and PDF (the *two products of the entire app*) share the identical download-arrow icon; Settings gets icon + label while its neighbours are icon-only; Templates is a native `<select>` cosplaying as a button. There is no visual answer to "what do I click first."
2. **A 30-button toolbar wall.** One strip, `gap: 1px`, hairline separators, three icon languages mixed (text glyphs `H1 B I Aa TOC —`, inline SVGs drawn at three different stroke widths 1.7/1.8/1.9, unicode `x₂ x² ☰`). With the settings drawer open at 1440 px it wraps into a ragged second row. No grouping logic a user can *see*, no overflow strategy.
3. **Borders as the only structure.** Three near-identical dark greys (`#101317/#171b20/#20262d`) separated everywhere by the same 1 px `#2a313a` line — the classic "wireframe with borders" look of generated UIs. No depth system, no surface logic; the light theme is the same wireframe in beige.
4. **Flat micro-typography.** Everything lives between 10.5 and 13.5 px, and there are *four separate* letterspaced-uppercase micro-label styles (brand suffix, settings `h3`, modal `h4`, popmenu titles). The serif-italic brand — the one typographic idea — is 17 px and drowns.
5. **Unicode and emoji as icons.** `☰ − + ↑ ↓ ✕` as button labels; `📎 🔁 ✕` in the image menu — sitting next to real SVG icons.
6. **Arbitrary value sprawl.** Paddings 5/6/7/9/10/12/13/14/16/18; radii 4/5/6/8/10/12/20/30 px; ad-hoc gaps. No spacing scale, no radius scale, no rhythm.
7. **The settings drawer is a form dump.** ~20 fields of equal visual weight, no grouping beyond three uppercase headers, no progressive disclosure; barely-styled native selects, native date field, raw `input[type=color]`; 34×19 px toggles.
8. **A dead interaction layer.** The drawer appears via `display:none → block` with zero motion and reflows the whole app (compare `ui.png` vs `ui-settings.png`); modals and panels pop instantly; tooltips are native `title` attributes with the OS delay; there is no drag-resize between editor and preview; export progress is a 12 px spinner swap.
9. **The star is under-staged.** The whole design story ("the paper is the star") hangs on the preview, but the deck is a flat grey with page count and zoom scattered as small text in a strip. The proof-table idea is asserted in a CSS comment, not executed on screen.
10. **The signature reads as accident.** The one bespoke detail — a brass gradient rule under the top bar — fades out mid-bar, and nothing else in the chrome speaks brass except the PDF button, so it reads as a rendering glitch rather than a motif.

**Also broken, fix during execution regardless of direction:** zero `aria-*` attributes in the entire app (icon buttons are `title`-only); no visible document title anywhere in the chrome (the title lives buried in Settings; `state.title` is available); template switching is a destructive replace behind a confirm dialog; the blank editor has no empty state, just placeholder text; help modal is an unscannable wall of tables.

**Good bones — keep and build on:** the `:focus-visible` ring; the `prefers-reduced-motion` and `@media print` blocks; `tabular-nums` on all counters; Ctrl+wheel zoom and click-the-percentage-to-refit (already implemented); custom scrollbars; the autosave/linter/outline machinery; the page-card shadow stack (it's already decent); the embedded-font infrastructure; the workshop metaphor itself.

## 3. Phase 1 — propose three directions, then STOP

Produce three **materially different** direction candidates. Not three grey variants — a stranger must be able to tell them apart from across the room. For each candidate:

- **Name + one-paragraph story**: what the chrome *is* (material, era, attitude), and why that serves a tool whose output is printed documents.
- **Token sheet**: full palette for dark *and* light (bg/surface/raised/line/text ×3/accent + semantic), type roles (family/size/weight/case for: brand, pane titles, control labels, body, micro-caps if any), radius scale, elevation levels, motion character.
- **Rendered proof, not a description**: implement the candidate as a real restyle on its own git branch (`design/<name>`) — token block plus the minimum component surgery to make the top bar, toolbar, settings drawer, and preview deck speak the direction. Build, screenshot (`node qa/uishot.mjs`), save the five shots to `qa/out/directions/<name>/`.

Seeds you may use, sharpen, or replace (replacements must be equally specific and defensible for a *document* tool):

- **A. The typographer's workshop** — execute what the current CSS only claims: deep ink chrome, warm paper accents, felt proof-table under the pages, brass as the *single* metal (one rule, one primary action, nothing else), serif display moments from DocForge Garamond/Serif, engraved-plate control styling. Quality bar: Mubi, Klim Type Foundry, Standards Manual.
- **B. The quiet precision instrument** — near-monochrome, hairline geometry, generous negative space, hierarchy from weight and spacing alone, motion does the personality (fast, damped, exact), the *document's own accent colour* is the only colour in the chrome. Quality bar: Linear, Things 3, Raycast.
- **C. The warm editorial desk** — light-first: cream/paper chrome, ink text, one restrained accent, serif headers, soft wide shadows instead of borders, reading-app calm; dark mode as "the desk lamp at night," not an inversion. Quality bar: iA Writer, Ulysses, Readwise Reader.

Deliver: the three screenshot sets side by side, a comparison table (identity, risk, effort), and your recommendation with reasoning. **Then stop and wait for the human to choose.** Do not begin Phase 2 unassisted unless the human has explicitly pre-authorized you to proceed with your recommendation.

## 4. Phase 2 — execute the chosen direction, in passes

Work in small commits, one pass at a time, screenshotting after each (see §6). Merge the chosen design branch first, delete the others.

**Pass 1 — Foundations.** Replace the token block at the top of `app.css`: spacing scale (one base, e.g. 4 px steps — every padding/gap/margin in the file must resolve to it), type scale (max ~5 named roles with real size contrast between them), radius scale (≤ 3 values), elevation system (≤ 3 shadow levels, designed per-theme), motion tokens (durations 120–200 ms, one ease-out and one ease-in-out; wire into the reduced-motion block). Rewrite the file-header comment to describe the *actual* language you're shipping. Then sweep the whole file so no hard-coded orphan values remain.

**Pass 2 — Structure.**
- *Top bar*: establish hierarchy — brand as a real masthead moment; the current document's title visible (with unsaved/autosave state adjacent, replacing the buried status text); file operations grouped; **exactly one primary action**. Give Word and PDF distinct identities (they currently share one icon). Replace the native Templates `<select>` with a designed menu — human-readable labels already exist in the `TEMPLATES` map in `main.js` (write one-line descriptions per template while you're there).
- *Toolbar*: regroup ~30 controls into ≤ 6 perceivable groups; unify every glyph into one SVG grid (one stroke width, one optical size — redraw the text-glyph buttons as drawn marks or give text glyphs a deliberate shared style); design an overflow strategy so nothing ever wraps ragged (priority+overflow menu, or two intentional rows — your call, but it must look composed at 1024 px with the drawer open).
- *Settings drawer*: animate open/close (transform/opacity, not display-pop); restructure into scannable groups with room to breathe — document identity, then style, then layout; consider collapsible sections for border/citation/typography detail. Style every control as part of one family: selects, date, swatches, color well, toggles (larger hit targets).
- *Preview*: stage the deck so the pages read as *the point of the app* — deck material/texture per your direction, refined page shadows, and consolidate page-count + zoom + outline toggle into one composed instrument cluster instead of scattered text.

**Pass 3 — Components.** One system for: buttons (primary/secondary/ghost/icon/danger + busy), inputs, selects, toggles, swatches, popmenus, context menu (kill the emoji), modals (help modal: give it typographic structure — scannable sections, not one table wall), toasts, find bar (real icon buttons, not `↑ ↓ ✕`), outline panel, lint badge/panel, embed hint, scrollbars, selection color, focus ring.

**Pass 4 — States & motion.** Hover/active/focus-visible/disabled on every interactive element; enter/exit transitions for drawer, panels, popmenus, modals, toasts; render-busy state; export-in-progress on the two export buttons (`.busy`/`.btnspin` exist); an empty-state for a blank editor (a short, designed hint — the syntax cheat-sheet's greatest hits — instead of bare placeholder text).

**Pass 5 — Accessibility & responsive.** `aria-label` on every icon-only control, `aria-expanded`/`aria-pressed` where state exists, `role="toolbar"`/menu semantics, modal focus behavior; AA contrast for every text/surface pair in both themes (audit `--tx3` uses); full keyboard walk (Tab order, Esc closes, visible focus everywhere). Then design the 900 px breakpoint properly (the current one just stacks panes) and check 1280/1024/900/720.

**Pass 6 — Light theme parity + polish sweep.** Design light deliberately (surfaces, shadows, and line colours re-derived, not inverted), then a final zoomed-screenshot nitpick pass: alignment, optical centering of icons, consistent paddings, hairline colour steps.

**Encouraged UX upgrades** (optional, high value — each must keep the QA suite green): a draggable editor/preview split with double-click-to-reset, persisted to localStorage; custom fast tooltips (CSS-only is fine) replacing `title` where discoverability matters; a subtle "Ctrl+/ for shortcuts" hint in the status bar; template menu previews.

## 5. Hard guardrails — the anti-slop contract

**Never:** purple/indigo SaaS gradients; glassmorphism/backdrop-blur panels; neon glows; decorative blobs; hero sections; card-with-border-radius-and-shadow on *everything*; emoji as icons; mixed icon stroke widths; more than **one** letterspaced-uppercase role in the whole chrome; more than one accent colour in the chrome; dead ornament (any decoration that doesn't encode information or material); default-blue focus rings; instant display-toggles for anything larger than a tooltip.

**Always:** hierarchy from size/weight/space *before* boxes and borders — prefer *removing* a border to adding one; borders only where a surface change can't do the job; every value from the token scales; icons on one grid at one stroke width; text at 13 px+ for anything users must read (micro-text only for tertiary metadata); restraint as the default — when unsure, remove.

The test you are designing against: **could a screenshot of this chrome be mistaken for the default output of a UI generator?** Every pass should move the answer further toward "no — someone clearly made this."

## 6. Verification loop — after every pass, no exceptions

```bash
node build.mjs && node qa/uishot.mjs   # rebuild THEN screenshot (uishot drives dist/)
node qa/tier4.mjs                      # headless editor-feature tests — must stay green
```

1. **Read the five screenshots at 100 % and zoomed to 200 %.** Critique in writing before coding the next pass: What still looks generated? What's misaligned? Which text is too small? Where do two adjacent surfaces read as one? Is the primary action unmistakable? Would a designer crop any part of this for their portfolio?
2. `uishot` prints console errors — must end `none`.
3. Print sanity: with the built file open, emulate print media (or Ctrl+P preview) — zero chrome may appear, pages unscaled.
4. Export sanity: PDF and Word exports still produced; page interiors pixel-identical (crop-compare one body page against a pre-redesign capture).
5. Size: `build.mjs` output within budget; `git diff --stat` reviewed — no accidental doc.css/engine.js drift.
6. Commit per pass with before/after screenshots saved under `qa/out/redesign/pass-N/`.

## 7. Acceptance checklist — all must hold before you call it done

- [ ] A stranger identifies the primary action in one second; it is the only primary-weight control in the top bar.
- [ ] Word and PDF are visually distinct; the current document's title and save state are visible in the chrome.
- [ ] The toolbar reads as ≤ 6 groups and never wraps raggedly ≥ 1024 px (overflow engages instead).
- [ ] No emoji or unicode-glyph controls anywhere; every icon on one grid at one stroke width.
- [ ] The type system shows ≥ 3 clearly distinct sizes; letterspaced-uppercase appears in at most one role.
- [ ] No surface pair is separated *only* by the old same-grey 1 px line; depth/space carries structure.
- [ ] Settings scans in groups; drawer and panels animate; reduced-motion kills all of it.
- [ ] Every icon-only control has an `aria-label`; every text/surface pair passes AA in both themes.
- [ ] Dark and light both look intentional side by side; the preview deck stages the pages, not just holds them.
- [ ] `tier4.mjs` green · console errors "none" · print shows zero chrome · dist delta < +30 KB · no new dependencies.
- [ ] Page interiors byte-for-byte untouched (`git diff src/doc.css src/js/engine.js` is empty).
- [ ] The five `uishot` captures could plausibly appear on a design-tools showcase without the word "generated" coming to mind.
