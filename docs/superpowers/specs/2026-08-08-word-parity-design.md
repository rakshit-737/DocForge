# Word parity: ribbon formatting, Word fonts, PDF/DOCX import

Date: 2026-08-08. Request: "make everything available in word, add all fonts of word, add an option to upload existing pdfs and word documents and edit them."

DocForge is a Markdown-source studio, not a contenteditable clone of Word. Word parity therefore means: every Home-ribbon *formatting effect* becomes a Markdown-level syntax + toolbar button that renders identically in the paginated preview, the printed PDF, and the exported .docx.

## 1. Home-ribbon formatting

New inline syntax (marked tokenizer extensions, so injected HTML attributes — KaTeX `data-tex` etc. — are never corrupted):

| Syntax | Effect | .docx mapping |
| --- | --- | --- |
| `++text++` | underline | `underline` |
| `==text==` / `=={green}text==` | highlight (Word's 15-colour highlighter palette; default yellow) | `highlight` |
| `~text~` | subscript (single `~`; `~~strike~~` still wins) | `subScript` |
| `^text^` | superscript | `superScript` |
| `[text]{...attrs}` | attribute span: `color=#e11`, `bg=#ff0`, `size=14` (pt), `font=Calibri`, `u`, `sc` (small caps), `caps` | run colour / shading / size / font / smallCaps / allCaps |

`~~strike~~` (already parsed by GFM) gets a toolbar button. Existing footnote/citation/xref/math preprocessing is untouched; the new tokenizers run inside marked, after preprocess.

Block-level:

- `:::center` / `:::right` / `:::justify` … `:::` alignment containers (same machinery as callouts); preview gets `.align-*` divs, Word paragraphs get `alignment`.
- Settings → **Base font size** (10 / 10.5 / 11 / 11.5 / 12 pt) and **Line spacing** (Default 1.59 / 1.0 / 1.15 / 1.5 / 2.0), applied to both preview CSS and the .docx `document` style.

Toolbar becomes ribbon-grouped: existing buttons + U, strike, highlighter (colour dropdown), font colour (palette + custom), sub, sup, Aa case cycle (UPPER → lower → Title), clear-formatting (strips marks from selection), align group, and a font-family + size pair that wraps the selection in an attribute span. Ctrl+U bound. Help overlay documents everything new.

Not ported (meaningless for a Markdown source or already covered): format painter, styles gallery (headings are the styles), sort, clipboard pane.

## 2. Word fonts

The seven embedded OFL faces stay the portable default. Added: a catalog of ~45 classic Word/Office families (Aptos, Calibri, Cambria, Arial, Times New Roman, Georgia, Verdana, Segoe UI, Garamond, Book Antiqua, Century Gothic, Comic Sans MS, Consolas, Courier New, Impact, Tahoma, Trebuchet MS, Palatino Linotype, Franklin Gothic, Rockwell, Bookman Old Style, …).

- These are proprietary and are **not embedded**; they render via the locally installed font (`local()` stack) and are written into the .docx **by name** — Word supplies its own copy, which is exact parity on any machine with Office.
- `document.fonts.check()` marks unavailable families in the pickers ("not on this device") instead of hiding them — the .docx still opens correctly elsewhere.
- Settings font pickers become grouped selects (Embedded — travel inside the file / Word fonts — named, this device must have them / Custom: any typed family name). Setting keys: existing `sans|serif|…` for embedded, `sys:Family Name` for the rest.
- Per-selection fonts via the toolbar font dropdown → `[text]{font=Family}`.

## 3. Import: .docx and .pdf (plus .md/.txt)

The Open button and editor drag-drop accept `.docforge.json` (unchanged), `.docx`, `.pdf`, `.md`, `.txt`. Non-project imports confirm before replacing the current document.

- **.docx** — mammoth (bundled, ~0.4 MB) → HTML → the existing `htmlToMd` converter, extended to understand `u`, `mark`, `s`, `sub`, `sup`, colour/size spans, alignment, and embedded images (registered as attachments → `[screenshot: … | img:key]` figures). Result: an editable Markdown document with the original structure.
- **.pdf** — pdf.js (already a dependency; main lib + worker bundled as lazy-`eval` strings so startup cost is zero; the worker runs on the main thread via the `pdfjsWorker` global, no network, no Blob workers) → text items → layout reconstruction: lines by Y-cluster, paragraphs by leading gaps, headings by font-size tiers, bullet/numbered list detection, hyphen de-merge, repeated header/footer and bare page-number removal. Result: clean editable Markdown. A PDF is a print format — exact layout is not preserved and the UI says so; scanned (no-text) PDFs get a clear "needs OCR" message.
- `.doc` (pre-2007 binary) is rejected with a message to save as .docx first.

## 4. Files touched

- `src/js/engine.js` — marked extensions, alignment containers, dynamicCss (base size / line spacing / align styles).
- `src/js/main.js` — toolbar actions & bindings, settings UI, import routing, htmlToMd extensions.
- `src/js/docx-import.js` (new) — mammoth wiring + image harvesting.
- `src/js/pdf-import.js` (new) — pdf.js wiring + layout→Markdown heuristics.
- `src/js/docx-export.js` — run properties (underline, highlight, sub/sup, colour, shading, size, font), alignment, document defaults, system-font passthrough.
- `src/index.html`, `src/app.css`, `src/doc.css` — ribbon UI, grouped font selects, new element styles.
- `build.mjs` — bundle mammoth; bundle pdf.js lib+worker as deferred strings.
- `README.md`, help overlay — document all of it.

## 5. Verification

`node build.mjs` clean; headless Playwright smoke: exported .docx re-imports through the new DOCX path, `page.pdf()` output re-imports through the PDF path, new syntax round-trips preview and .docx build without errors; existing `qa/tier4.mjs` still passes.
