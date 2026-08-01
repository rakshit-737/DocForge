# DocForge — your personal document studio

Turn plain text into beautifully typeset **PDFs** and **Word documents** — cover pages, automatic table of contents with real page numbers, running headers, footnotes, citations, equations, cross-references, screenshot placeholders, tables, callouts and more. One HTML file. No account, no server, works offline. Yours forever.

**▶ Use it:** open `dist/DocForge.html` in Chrome or Edge — or serve it with GitHub Pages (see below).

## What it does

- **Live paginated preview** — see actual A4/Letter pages, page numbers and all, as you type
- **Markdown + toolbar editor** — `# headings`, `**bold**`, lists, tables, quotes, code
- **Real typography** — three embedded open-licence typefaces (see *Fonts* below) used identically in the PDF and the Word file, so the two exports look like the same document on any machine; curly quotes, en dashes and non-breaking spaces applied automatically; widow/orphan control; headings never stranded at a page foot; long tables repeat their header row on every page in both formats
- **Professional page numbering** — the cover is unnumbered, the contents page runs in romans (i, ii…), and the body starts at "Page 1 of N" where N counts body pages only; identical scheme in Word
- **Footnotes** — `[^1]` calls with `[^1]: text` definitions; placed at the foot of the correct page in the PDF and exported as real Word footnotes
- **Citations** — `[@key]` in text, `[@key]: Full entry` definitions, `[references]` for the list; numeric `[1]` (IEEE-like) or Author–year (APA-like) style, chosen in Settings; locators like `[@key, p. 33]` supported
- **Mathematics** — `$inline$` and `$$display$$` LaTeX, rendered with KaTeX in the preview/PDF and exported to Word as **real editable equations** (OMML), not pictures
- **Cross-references** — `[#fig:name]`, `[#tbl:name]`, `[#sec:name]` resolve to "Figure 3", "Table 1", "Section 2.1"; label headings with `{#sec:name}`, figures/tables with `#fig:name` / `#tbl:name` options
- **Table captions** — `[table: caption]` above a table numbers it as *Table N*; `[lof]` and `[lot]` print lists of figures and tables
- **Syntax highlighting** — name a language on a code fence (` ```python `) for print-friendly colouring in both exports (36 common languages)
- **Screenshot placeholders** — `[screenshot: caption]` prints as a neat labelled box, or click it in the preview to attach the real image; options: `| w:60%` width, `| noborder`, `| #fig:name`
- **Automatic table of contents** — `[toc]` with dotted leaders and real page numbers
- **Cover page** — title, subtitle, author, date, course/company label; full-bleed accent band in the PDF *and* the Word file
- **4 themes** (Modern, Executive, Academic, Minimal) × any accent colour × A4/Letter × 3 margin presets
- **Callouts** — `:::note`, `:::tip`, `:::warning`, `:::important` — tables, lists and code inside them survive into Word intact
- **Editor comforts** — outline navigator (☰ above the preview), find & replace (Ctrl+F / Ctrl+H), pasted Word/web content auto-converted to Markdown, a gentle structure checker that flags anything that would break the export, and a light/dark switch for the app chrome (the document always prints on white)
- **Export PDF** — via the browser print engine (choose *Save as PDF*), margins and headers pre-configured; text stays selectable and searchable
- **Export Word** — a real `.docx` with the same fonts embedded, styled headings, cover, tables with true column widths, figures, footnotes, equations and an auto-updating TOC field
- **Templates** — assignment/academic report, business proposal, project report, formal letter, article
- **Autosave** in the browser + `.docforge.json` project files (images included) you can reopen anywhere

## Syntax cheat-sheet

| Write | Get |
| --- | --- |
| `# Title` / `## Section` / `### Sub` | Headings (feed the TOC automatically) |
| `## Title {#sec:name}` | Heading with a referenceable label |
| `**bold**` · `*italic*` · `` `code` `` | Inline styling |
| `- item` / `1. item` | Bullet / numbered lists |
| `> text` | Quotation |
| `\| A \| B \|` rows | Table with shaded header (`:---:` / `---:` align columns) |
| `[table: caption \| #tbl:name]` | Numbered, referenceable table caption |
| `[screenshot: caption \| w:60% \| #fig:name]` | Screenshot placeholder / attached figure |
| `[^1]` … `[^1]: note text` | Footnote |
| `[@key]` … `[@key]: Full reference` | Citation and its entry |
| `[references]` | The reference list (auto-appended if omitted) |
| `[#fig:name]` / `[#tbl:name]` / `[#sec:name]` | Cross-reference ("Figure 3", …) |
| `$E = mc^2$` and `$$…$$` | Inline / display mathematics (LaTeX) |
| ` ```python ` | Syntax-coloured code block |
| `[toc]` / `[lof]` / `[lot]` | Contents / list of figures / list of tables |
| `[pagebreak]` | New page |
| `:::tip Title` … `:::` | Callout box |

## Fonts

The app embeds subsets of seven families — **Source Sans 3**, **Source Serif 4**, **Source Code Pro**, **Inter**, **Montserrat**, **EB Garamond** and **Crimson Pro** (all SIL Open Font License 1.1 — licence texts in `fonts/`). Pick the heading and body faces independently in Settings, or leave them on the theme's own pairing. The same TTF bytes serve the preview, the printed PDF and the `.docx` (only the families a document actually uses are embedded in its package), which is what keeps the two exports visually identical. Rebuild the subsets with `python tools/build_fonts.py`.

## Page borders

Settings → Page border offers seven styles (rule, double, triple, dashed, dotted, thick–thin, thin–thick) × three weights × ink or accent colour. The PDF draws the frame 4.5 mm inside the paper edge; the `.docx` gets real Word page borders (the same styles Word's own Design → Page Borders dialog produces) at the same standoff. The cover stays full-bleed and unframed in both.

## Known limitations

- **PDF bookmarks:** the printed PDF has no outline panel. Chrome's *Save as PDF* dialog cannot emit one — no CSS or DOM feature reaches it. (Automation-produced PDFs can; the interactive dialog can't.)
- **Word ≠ PDF line breaks:** the two engines break lines and pages independently, so page totals can differ by a page or two on long documents; the *design* — fonts, colours, spacing, numbering scheme — is the same.
- **APA labels** are derived mechanically from the entry text (surname before the first comma, first year found). Two works by the same author in the same year are not disambiguated.
- **Word cover band** uses a zero-margin first section; in very old Word versions (pre-2013) the band may print inset.
- **Compound page borders in Word** (double, triple, thick–thin, thin–thick): Word's own renderer fills the gap between the component lines with a dark tone rather than leaving it white — a document built natively in Word's *Design → Page Borders* dialog prints the same way. The PDF draws the gaps crisply; at reading distance the Word version reads slightly heavier.
- **Math in Word**: a handful of LaTeX constructs degrade gracefully (colours are dropped, `\\` line breaks outside environments become wide gaps, `\hline` in arrays is omitted). Everything exports as a real equation, never an image.

## Host it free on GitHub Pages

This repo is ready for Pages: **Settings → Pages → Deploy from a branch → `main` / `root`**, and your studio is live at `https://<user>.github.io/<repo>/` (the root `index.html` redirects to the app).

## Develop

```bash
npm install        # marked, pagedjs, docx, katex, highlight.js (+ esbuild for the build)
node build.mjs     # → dist/DocForge.html (single self-contained file, ~2.5 MB)
```

Source lives in `src/` (`index.html`, `app.css`, `doc.css`, `js/engine.js`, `js/mathml-omml.js`, `js/docx-fonts.js`, `js/docx-export.js`, `js/main.js`). The build inlines everything — libraries, fonts, maths — into one file.

QA lives in `qa/`: `node qa/visual.mjs` renders a torture document in every theme, exports both formats, converts the `.docx` through real Word (Windows), rasterises both PDFs and writes a side-by-side contact sheet; `node qa/tier4.mjs` exercises the editor features headlessly.

Built with [marked](https://github.com/markedjs/marked), [Paged.js](https://pagedjs.org/), [docx](https://github.com/dolanmiu/docx), [KaTeX](https://katex.org/) and [highlight.js](https://highlightjs.org/). The MathML→OMML converter is DocForge's own (MIT, `src/js/mathml-omml.js`). MIT licensed.

---

*Built with Claude — so the documents keep coming even when the subscription doesn't.* 🙂
