# DocForge — your personal document studio

Turn plain text into beautifully formatted **PDFs** and **Word documents** — cover pages, automatic table of contents with real page numbers, running headers, screenshot placeholders, tables, callouts and more. One HTML file. No account, no server, works offline. Yours forever.

**▶ Use it:** open `dist/DocForge.html` in Chrome or Edge — or serve it with GitHub Pages (see below).

## What it does

- **Live paginated preview** — see actual A4/Letter pages, page numbers and all, as you type
- **Markdown + toolbar editor** — `# headings`, `**bold**`, lists, tables, quotes, code
- **Screenshot placeholders** — `[screenshot: caption]` prints as a neat labelled box, or click it in the preview to attach the real image; either way it's numbered as *Figure N*
- **Automatic table of contents** — `[toc]` with dotted leaders and real page numbers
- **Cover page** — title, subtitle, author, date, course/company label
- **4 themes** (Modern, Executive, Academic, Minimal) × any accent colour × A4/Letter × 3 margin presets
- **Callouts** — `:::note`, `:::tip`, `:::warning`, `:::important`
- **Export PDF** — via the browser print engine (choose *Save as PDF*), margins and headers pre-configured
- **Export Word** — a real `.docx` with styled headings, cover, tables, figures and an auto-updating TOC field
- **Templates** — assignment/academic report, business proposal, project report, formal letter, article
- **Autosave** in the browser + `.docforge.json` project files (images included) you can reopen anywhere

## Syntax cheat-sheet

| Write | Get |
| --- | --- |
| `# Title` / `## Section` / `### Sub` | Headings (feed the TOC automatically) |
| `**bold**` · `*italic*` · `` `code` `` | Inline styling |
| `- item` / `1. item` | Bullet / numbered lists |
| `> text` | Quotation |
| `\| A \| B \|` rows | Table with shaded header |
| `[screenshot: caption]` | Screenshot placeholder / attached figure |
| `[toc]` | Table of contents |
| `[pagebreak]` | New page |
| `:::tip Title` … `:::` | Callout box |

## Host it free on GitHub Pages

This repo is ready for Pages: **Settings → Pages → Deploy from a branch → `main` / `root`**, and your studio is live at `https://<user>.github.io/<repo>/` (the root `index.html` redirects to the app).

## Develop

```bash
npm install        # marked, pagedjs, docx (+ esbuild for the build)
node build.mjs     # → dist/DocForge.html (single self-contained file)
```

Source lives in `src/` (`index.html`, `app.css`, `doc.css`, `js/engine.js`, `js/docx-export.js`, `js/main.js`). The build inlines everything — libraries included — into one file.

Built with [marked](https://github.com/markedjs/marked), [Paged.js](https://pagedjs.org/) and [docx](https://github.com/dolanmiu/docx). MIT licensed.

---

*Built with Claude — so the documents keep coming even when the subscription doesn't.* 🙂
