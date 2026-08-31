# @docforge/cli

Headless DocForge — markdown in, Word `.docx` (no browser required) or paged `.pdf`
(headless Chromium) out.

```
docforge build report.md --docx
docforge build report.md --pdf
docforge build report.md --docx --pdf --out dist --theme executive --title "Q3 Report" \
  --author "A. Author" --date 2026-08-31
```

The output file takes the input's stem (`report.md` → `report.docx` / `report.pdf`) and
lands next to the input, or inside `--out <dir>`.

## What runs under the hood

Exactly the studio's pipeline, stood up in Node:

1. A [happy-dom](https://www.npmjs.com/package/happy-dom) `Window` plays the DOM —
   `document`, `DOMParser`, `Node`, `NodeFilter` and friends land on `globalThis`.
2. The npm copies of `marked`, `katex`, `highlight.js` and `docx` are assigned to the
   ambient globals the packages read (mirroring `packages/engine/test/setup.ts` and
   `apps/web/lib/bootstrap.ts`).
3. `__FONT_DATA__` is built from the repo's `fonts/*.ttf`, keyed `"<stem>-<Cut>"`, so the
   `.docx` embeds the same typefaces the single-file edition carries. Installed outside
   the repo (no `fonts/` on the walk up), faces are named but not embedded — Word
   substitutes cleanly.
4. `@docforge/engine` is imported *after* the assignments (it registers marked extensions
   at import time), `Engine.render(source, settings, {})` produces the document DOM, and
   `DocxExport.build(contentEl, settings, {})` packs the OOXML — byte-for-byte the same
   writer the studio and the single-file edition use.

## Direct PDF export (`--pdf`)

`--pdf` prints the document through headless Chromium — the same Paged.js flow the studio
preview composes, then Chromium's print engine — and produces two things the in-app print
dialog **cannot**:

- **A document outline** (bookmarks): every heading, as a navigable tree in the PDF
  reader's sidebar, rooted in the document title.
- **Tagged structure**: an accessible structure tree (headings, paragraphs, tables,
  links marked as such), which screen readers and reflow views rely on.

Both come from Chromium's CDP print options (`generateDocumentOutline` /
`generateTaggedPDF`), reached through playwright-core's `page.pdf({ outline, tagged })`.

The page furniture is the studio's own: the folio handler ("Page n of N" counting body
pages only, roman numerals on front matter), repeated table headers across page breaks,
and the footnote hardening are ported 1:1 from the studio's compose pipeline, so the PDF
matches what the preview shows.

Honest limitations:

- **Repo checkout only.** The print path discovers `src/doc.css`, `fonts/`, `pagedjs`
  and `playwright-core` by walking up from the installed CLI — the repo's root
  `node_modules` carries the last two. An npm-installed CLI outside the repo fails with
  a clear message rather than printing something degraded.
- **A Chromium must exist on the machine**: `PW_CHROMIUM`, Playwright's own download,
  or a system Chrome/Edge (the same resolution order as the QA harness).
- **Tagging quality is Chromium's judgment.** `generateTaggedPDF` produces a genuine
  structure tree, but it is not a certified PDF/UA audit.
- The PDF's metadata (`CreationDate`) differs run to run, so its bytes are not
  golden-comparable — same as the QA harness's printed PDFs.

## Flags

| Flag | Values | Default |
| --- | --- | --- |
| `--docx` | — | write the Word document (headless, no browser) |
| `--pdf` | — | write the paged PDF (headless Chromium; outline + tagged) |
| `--out <dir>` | path | alongside the input |
| `--theme` | `modern` `executive` `academic` `minimal` | `modern` |
| `--accent` | hex colour | the theme's own pairing |
| `--title` `--subtitle` `--author` `--kicker` `--meta-extra` | text | empty |
| `--date` | `YYYY-MM-DD` | today |
| `--page` | `A4` `Letter` | `A4` |
| `--margins` | `normal` `narrow` `wide` | `normal` |
| `--font-head` `--font-body` | face key or `sys:Family Name` | `theme` |
| `--base-size` | points | `11` |
| `--line-spacing` | `1` `1.15` `1.5` `2` | Word's default |
| `--cite-style` | e.g. `ieee`, `apa` | `ieee` |
| `--cover` `--numbered` `--justify` `--h1break` `--hard-wrap` | switches | off |
| `--no-header` `--no-page-nums` `--no-cover` | switches | header/folios on |
| `--border-style` | `rule` `double` `triple` `dashed` `dotted` `thickthin` `thinthick` | `none` |
| `--border-weight` | `fine` `medium` `bold` | `medium` |
| `--border-color` | `ink` `accent` | `ink` |

At least one of `--docx` / `--pdf` is required; both together write both files.

Exit codes: `0` success · `1` pipeline failure (including a missing Chromium or a
non-repo install asking for `--pdf`) · `2` usage errors.

## Building and testing

```
pnpm --filter "@docforge/cli" run build   # esbuild-bundles src/cli.ts → dist/cli.mjs
pnpm --filter "@docforge/cli" run test    # spawns the bundle on the golden corpus
```

The bundle inlines the workspace packages (engine, exporter, mathml-omml) and leaves the
npm libraries external, so a workspace `pnpm install` must have linked this package's
dependencies (`happy-dom` above all) before the CLI can run. The `--pdf` test suite also
needs a resolvable Chromium and the repo's root `node_modules` (pagedjs, playwright-core);
Chromium's cold start is slow, so those tests carry generous timeouts.
