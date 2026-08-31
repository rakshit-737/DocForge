# @docforge/cli

Headless DocForge — markdown in, Word `.docx` out, no browser required.

```
docforge build report.md --docx
docforge build report.md --docx --out dist --theme executive --title "Q3 Report" \
  --author "A. Author" --date 2026-08-31
```

The output file takes the input's stem (`report.md` → `report.docx`) and lands next to the
input, or inside `--out <dir>`.

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

## Flags

| Flag | Values | Default |
| --- | --- | --- |
| `--docx` | — | required (the only headless format) |
| `--pdf` | — | prints "PDF needs the studio (issue #9 tracks direct export)", exit 2 |
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

Exit codes: `0` success · `1` pipeline failure · `2` usage errors and `--pdf`.

## Building and testing

```
pnpm --filter "@docforge/cli" run build   # esbuild-bundles src/cli.ts → dist/cli.mjs
pnpm --filter "@docforge/cli" run test    # spawns the bundle on the golden corpus
```

The bundle inlines the workspace packages (engine, exporter, mathml-omml) and leaves the
npm libraries external, so a workspace `pnpm install` must have linked this package's
dependencies (`happy-dom` above all) before the CLI can run.
