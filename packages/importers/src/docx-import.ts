/* ============================================================
   docx-import.ts — turn an uploaded .docx into clean HTML

   Ported 1:1 from src/js/docx-import.js (112 lines) — Phase 1. The only
   sanctioned change: the `(0, eval)` of the vendored bundle became a
   Blob-URL module import (see blob-import.ts), which forced lib() async.

   mammoth.js does the heavy lifting, but its defaults drop underline,
   strikethrough and highlight, and it renders Word's Title/Quote/Caption
   styles as anonymous paragraphs. The style map below keeps those and maps
   them onto structures the HTML→Markdown converter already understands.

   The browser bundle is embedded as a string on window.__MAMMOTH_SRC__ and
   loaded on first use, so a user who never imports Word files never pays
   for parsing ~1 MB of library at startup.
   ============================================================ */

import { importGlobalScript } from "./blob-import";

let mammothLoading: Promise<void> | null = null;

async function lib(): Promise<MammothLib> {
  if (window.mammoth) return window.mammoth;
  if (window.__MAMMOTH_SRC__) {
    // Blob-URL module import replaces the old indirect eval: the bundle runs
    // with window/self aliased to globalThis, so its UMD assignment lands on
    // globalThis.mammoth (and the epilogue pins the binding there
    // explicitly). The in-flight promise keeps "evaluate the bundle exactly
    // once" true now that loading is asynchronous — the eval was atomic.
    if (!mammothLoading) {
      mammothLoading = importGlobalScript(window.__MAMMOTH_SRC__, ";globalThis.mammoth=mammoth;");
      mammothLoading.catch(() => {
        mammothLoading = null;
      }); // a failed load stays retryable
    }
    await mammothLoading;
    window.__MAMMOTH_SRC__ = null; // the string is dead weight once eval'd
    // Fresh read: control-flow narrowing can't see the import mutate window.
    return (window as { mammoth?: MammothLib }).mammoth as MammothLib;
  }
  throw new Error("Word import is not bundled in this build");
}

const STYLE_MAP = [
  "u => u",
  "strike => s",
  "highlight => mark",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => p.subtitle:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "p[style-name='Caption'] => p.caption:fresh",
  "r[style-name='Intense Emphasis'] => em",
  "r[style-name='Book Title'] => em",
  "r[style-name='Subtle Emphasis'] => em",
];

const solid = (s: string): number => s.replace(/\s+/g, "").length;

function cleanup(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;

  // Stale Word TOC lines: almost all of the text sits in links-to-anchors
  // and the line ends with a page number. Must run before the anchors are
  // unwrapped below, or nothing distinguishes them from ordinary prose.
  // DocForge regenerates its own [toc], so these only cause clutter.
  for (const p of [...body.querySelectorAll("p")]) {
    const text = p.textContent as string;
    const total = solid(text);
    if (!total || !/\d\s*$/.test(text)) continue;
    let anchored = 0;
    for (const a of p.querySelectorAll('a[href^="#"]')) anchored += solid(a.textContent as string);
    if (anchored >= total * 0.8) p.remove();
  }

  // Internal anchors (bookmarks, cross-references) point nowhere once the
  // document leaves Word — keep the text, lose the link.
  for (const a of [...body.querySelectorAll("a")]) {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#")) a.replaceWith(...a.childNodes);
  }

  for (const p of [...body.querySelectorAll("p")]) {
    if (!(p.textContent as string).trim() && !p.querySelector("img")) p.remove();
  }

  return body.innerHTML;
}

/* Keep the messages worth showing: mammoth emits one "unrecognised style"
   warning per exotic style, which drowns out anything actionable. */
function tidyMessages(messages: MammothMessage[]): string[] {
  let list = messages.map((m) => m.message || String(m));
  if (list.length >= 3) list = list.filter((m) => !/unrecognised\b.*\bstyle/i.test(m));
  return [...new Set(list)].slice(0, 8);
}

/**
 * @param arrayBuffer  the raw bytes of a .docx file
 * @returns the converted HTML plus the messages worth surfacing
 */
async function toHtml(arrayBuffer: ArrayBuffer): Promise<{ html: string; messages: string[] }> {
  const mammoth = await lib();
  // images.inline is the pre-1.4 name for imgElement; tolerate either.
  const imgEl = mammoth.images && (mammoth.images.imgElement || mammoth.images.inline);

  let result: MammothResult;
  try {
    result = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        styleMap: STYLE_MAP,
        ignoreEmptyParagraphs: true,
        convertImage:
          imgEl &&
          imgEl((img) =>
            img.read("base64").then((b64) => ({
              src: "data:" + img.contentType + ";base64," + b64,
              alt: img.altText || "",
            })),
          ),
      },
    );
  } catch (err) {
    throw new Error(
      "Could not read that Word file — if it is an old binary .doc, save it as .docx first.",
      { cause: err },
    );
  }

  return { html: cleanup(result.value), messages: tidyMessages(result.messages || []) };
}

/* Public surface — exactly the classic DocxImport global. */
export const DocxImport = { toHtml };
export type DocxImportApi = typeof DocxImport;
