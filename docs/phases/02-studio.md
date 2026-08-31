# Phase 2 — The Studio in Next.js

The app rebuild. `apps/web` mounts the studio on the Phase-1 packages; the single-file
edition keeps shipping unchanged from `build.mjs` throughout. Every stage ends committed,
pushed, CI green.

## Stack decisions

- **Next.js (App Router) + React 19 + TS**, studio as a client-heavy route. React
  Compiler deferred (experimental).
- **Tailwind 4 CSS-first**: DESIGN.md tokens become `@theme` variables. The existing
  `app.css` is *authored* chrome (the copy desk scored 31/40) — it ports as the styling
  foundation, componentised; Tailwind supplies layout glue and tokens. No default-theme
  component dumps (§7): Radix primitives arrive headless and wear the copy-desk skin.
- **CodeMirror 6** replaces the textarea: markdown highlighting, search panel with
  counts/regex/case (fixes I8 by construction), multiple cursors, proper undo.
- **Zustand** stores: document (source/settings/attachments/dirty), ui (theme, zoom,
  panels). **IndexedDB via `idb`**: autosave + crash recovery + multi-document-ready
  schema; localStorage keeps only UI prefs.
- **PreviewController** — a framework-agnostic class owning the Paged.js deck inside a
  ref'd container React never reconciles. Direct port of main.js's pipeline: the four
  handlers (RepeatTableHeader, PageNumbering/folios, FootnoteFix, ComposeTicker),
  offscreen compose + swap, retire-page-observers, fit/manual zoom, page indicator.
- **Library interop**: packages read ambient globals; a `bootstrap` module imports the
  npm copies (marked, katex, hljs, docx, pagedjs) and assigns them onto `globalThis`
  before dynamically importing the packages. Import-only libs (mammoth, pdf.js,
  pdf-lib) load via real dynamic `import()` and land on the globals the importers
  probe first — the Blob-string path stays single-file-only.
- **Fonts**: preview via static `/fonts/*.ttf` + generated `@font-face` CSS (PWA
  precaches them); exports lazily fetch the bytes and populate `__FONT_DATA__` before
  `DocxExport.build` — same contract, no 1.9 MB base64 chunk.
- **doc.css stays the product surface** — served verbatim to the preview.

## Stages (each gate-green and pushed before the next)

1. **Scaffold** — apps/web (Next + Tailwind 4 + tokens), builds in CI.
2. **The press** — bootstrap + PreviewController + CodeMirror pane + settings store:
   type on the left, paginated pages on the right, byte-familiar output. Milestone:
   golden corpus documents render with page counts matching the classic build.
3. **The chrome** — masthead, toolbar (roving tabindex — A4; ≥12px controls — A5),
   settings drawer, templates (non-destructive: open-as-new-document kills I7's bug
   class), find/replace via CM6 (n-of-m, case/regex/word, highlights — I8), command
   palette, outline, one shared zoom cluster (I4), Radix dialogs, Esc consistency,
   Shift+Tab outdent + Ctrl+1/2/3 (I5), toast/status honesty.
4. **Persistence** — IndexedDB autosave, crash recovery ("Restore unsaved changes?"),
   `.docforge.json` open/save with Zod validation, **Ctrl+S = local persist** (I2);
   exports are explicit actions.
5. **Ports of exit** — DOCX one-click (packages + fetched fonts), PDF via print route
   with pre-flighted margins; golden-corpus spot-parity against the single-file build.
6. **Live edit** — the hardest piece: caret-preserving recompose, view re-anchoring,
   one history across panes (the snapshot model from main.js/live-edit.js).
7. **PWA + a11y** — Serwist full offline, installable; axe-clean pass; keyboard map.
8. **Gate** — Appendix A checklist against the web studio; golden corpus through the
   web render path; axe; Lighthouse PWA.

## Deliberately deferred

- Imports drag-drop + PDF bench route — Phase 3 by the master plan.
- Landing/docs/SEO — Phase 8. `/` holds a minimal typeset placeholder that links into
  the studio.
- Vercel deploy — needs the owner's account decision (open question #2); CI builds the
  app meanwhile and GitHub Pages keeps serving the single-file editions.

## Open questions (owner, MASTER-PROMPT list) — not blockers for the build

Domain/name check, Vercel account tier, AI-drawer default provider, the
"Built with Claude" footer, community-template licence.

## Stage record (2026-08-31)

- **Stages 1–7 built and live-verified.** Chrome acceptance 12/12 (roving toolbar
  with zero extra tab stops, Ctrl+B/1, find "n of m", drawer, template+Undo,
  Ctrl+S local-persist-no-download, 102 KB DOCX, IndexedDB session restore,
  console clean). Live-edit port 12/12 (contenteditable pages, read-only
  furniture, splice reaches CodeMirror, viewport anchor moved 0 px across the
  swap, caret exact, one Ctrl+Z/Ctrl+Y history across panes). PWA 5/5 (manifest,
  SW active + controlling, offline reload composes pages, offline banner).
  **Axe clean** on `/`, `/studio`, and drawer-open under WCAG 2.2 AA tags
  (chrome scope; the rendered document is product surface — its accessibility
  is the tagged-PDF idea, §8.4 ▲).
- **Still open for the full Phase-2 gate:** the Appendix A checklist walked item
  by item against the web studio (several classic surfaces — per-selection font
  menus in the toolbar, image attach flow, structure linter, focus mode, mobile
  layout — are not yet built); golden-corpus capture through the web render
  path; a recorded keyboard-only walkthrough; Lighthouse runs. live-edit's
  `styleSelection` (ribbon marks applied to a manuscript selection) is ported
  at the serializer level but not yet wired to the toolbar.
