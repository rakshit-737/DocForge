# PRODUCT.md — DocForge

## What it is
A single-file, offline document studio: Markdown source on the left, a live paginated print preview on the right. Exports real PDFs (via the browser print engine) and real .docx (with embedded fonts, TOC fields, footnotes, equations). Also opens PDFs for in-place overlay editing (rewrite printed lines in the original embedded font) or conversion to editable text. No server, no account; everything autosaves locally and round-trips through a `.docforge.json` project file.

## Audience & scene
Students and working professionals producing formatted deliverables — assignments, reports, proposals, letters. Typical scene: a 1366–1560px laptop, evening work sessions, deadline pressure. Many are first-time Markdown users arriving from Word.

## Jobs
1. Write plain text, get a submission-ready PDF/Word file with cover page, TOC, numbered headings, citations, figures.
2. Import an existing .docx/.pdf and keep working on it.
3. Patch a finished PDF without disturbing its layout.

## Mode
Operate (app chrome). The document itself always prints on white regardless of chrome theme.

## Brand commitment (standing)
**The typographer's workshop** — the chrome is the pressroom around the paper. Committed materials: iron-dark ink surfaces, oiled walnut type-cases, brass (scarce: masthead rule, the one primary action, micro-caps labels, focus), green felt proof-table, paper grain. Type roles: Garamond italic masthead and display moments; sans UI; mono for data. Motion grammar: the press shows its work (proofs settle, composing ticker, type-sort busy, ink-stamp autosave). The light theme is the daylit workshop (warm plaster + wood), never an inversion.

## Constraints
- Ships as one HTML file (`node build.mjs` → `dist/DocForge.html`); no external requests ever.
- PDF export depends on Chrome/Edge print dialog; guidance copy must survive that handoff.
- QA harness (qa/*.mjs, headless Playwright) drives the real UI; selector IDs are load-bearing.
- Document styling (doc.css, themes, borders) is user-facing product surface — chrome redesigns never touch it.
- Reduced motion kills all animation (global block in app.css).
