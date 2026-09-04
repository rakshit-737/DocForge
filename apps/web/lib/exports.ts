"use client";
/* Exports — explicit actions that produce files (Ctrl+S never does; ledger I2).
   DOCX goes through @docforge/export-docx exactly like the classic edition:
   the rendered .content clone in, a Blob out, with the docx library and the
   font bytes loaded lazily on first use. PDF rides the print route (the
   direct-PDF path is issue #9, §8.4). */
import { loadDocCss, loadDocx, loadFontData, loadStudio } from "./bootstrap";
import { flushActiveLiveEdit } from "./live-edit";
import type { PreviewController } from "./preview-controller";
import type { Settings } from "./settings";

function safeName(settings: Settings): string {
  return (
    ((settings.title as string) || "document")
      .replace(/[^\w-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "document"
  );
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function exportDocx(
  controller: PreviewController,
  settings: Settings,
  attachments: Record<string, unknown>,
): Promise<string> {
  if (!controller.lastContentEl) throw new Error("Nothing rendered yet");
  flushActiveLiveEdit(); // pending manuscript edits reach the source before it exports
  await Promise.all([loadDocx(), loadFontData(), loadStudio()]);
  const { api } = await import("@docforge/export-docx");
  const blob = await api.DocxExport.build(controller.lastContentEl, settings as never, attachments);
  const name = `${safeName(settings)}.docx`;
  downloadBlob(blob, name);
  return name;
}

/** Print route: clear the preview zoom for true-size pages, print, restore. */
export function exportPdf(controller: PreviewController, settings: Settings) {
  const deck = controller.deck;
  const prevZoom = deck.style.zoom;
  const prevTransform = deck.style.transform;
  deck.style.zoom = "";
  deck.style.transform = "";
  const restore = () => {
    deck.style.zoom = prevZoom;
    deck.style.transform = prevTransform;
    controller.applyZoom(settings);
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  try {
    window.print();
  } catch {
    restore();
    throw new Error("Printing is blocked in this browser context");
  }
}

/* ============================================================
   Standalone HTML (§8.4 "more export targets")

   One file a reader can open anywhere: the document's own markup, the
   product stylesheet, the embedded typefaces and KaTeX's maths fonts, all
   inlined. No network, no DocForge — it is the document, readable forever,
   the same promise the single-file edition makes for the app.

   It is a WEB PAGE, not a stack of pages: no pagination, no folios, no
   running heads. Those are the printed formats' business, and pretending
   otherwise in a scrolling document would be a lie about what it is.
   ============================================================ */

const HTML_ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};
const escapeHtml = (s: string): string => s.replace(/[&<>"]/g, (c) => HTML_ESC[c] ?? c);

/** KaTeX's stylesheet with its fonts inlined, staged by sync-assets. Missing
    (a stale public/) is not fatal: the maths simply falls back to plain
    markup rather than the export failing. */
async function katexCss(): Promise<string> {
  try {
    const res = await fetch("/katex-inline.css");
    return res.ok ? await res.text() : "";
  } catch {
    return "";
  }
}

/** The whole document as one self-contained page. */
export async function buildStandaloneHtml(
  settings: Settings,
  source: string,
  attachments: Record<string, unknown>,
): Promise<string> {
  const [{ Engine }, docCss] = await Promise.all([loadStudio(), loadDocCss()]);
  await loadFontData(); // fontFaceCss reads __FONT_DATA__; without it the faces are named, not carried
  const { doc } = Engine.render(source, settings, attachments as never);
  const content = doc.querySelector(".content")?.innerHTML ?? doc.innerHTML;
  const title = (settings.title as string) || "Document";
  const author = (settings.author as string) || "";
  const css = [docCss, Engine.dynamicCss(settings), Engine.fontFaceCss(), await katexCss()].join(
    "\n",
  );
  /* `.doc` and the theme class are what doc.css hangs everything on; the
     wrapper reproduces the shape the preview composes into, minus the pages. */
  const theme = (settings.theme as string) || "modern";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${author ? `<meta name="author" content="${escapeHtml(author)}">` : ""}
<meta name="generator" content="DocForge">
<style>
${css}
/* The page is a page, not a proof: the document sits on white with the
   margins doc.css already knows, and nothing here overrides the document's
   own typography. */
html, body { margin: 0; padding: 0; background: #f4f2ec; }
.df-sheet { max-width: 46rem; margin: 0 auto; padding: 48px 24px 96px; background: #fff; }
@media (max-width: 640px) { .df-sheet { padding: 24px 16px 64px; } }
@media print { body { background: #fff; } .df-sheet { max-width: none; padding: 0; } }
</style>
</head>
<body class="theme-${escapeHtml(theme)}">
<div class="df-sheet"><div class="doc"><div class="content">${content}</div></div></div>
</body>
</html>
`;
}

/** Export it, and hand back the filename for the toast. */
export async function exportHtml(
  settings: Settings,
  source: string,
  attachments: Record<string, unknown>,
): Promise<string> {
  flushActiveLiveEdit();
  const html = await buildStandaloneHtml(settings, source, attachments);
  const name = `${safeName(settings)}.html`;
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), name);
  return name;
}
