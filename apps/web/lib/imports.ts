"use client";
/* ============================================================
   imports.ts — the ports of entry.

   Port of the classic file-open router (src/js/main.js importFile /
   importDocxFile / importPdfFile / dataUrlAttachment). The shell owns the
   chrome around it — confirm-before-replace, the "Reading …" toast, the
   PDF edit-vs-convert choice, title-from-filename — this module owns the
   dispatch and the conversions, and reports outcomes as data.

   Library interop (read apps/web/lib/bootstrap.ts): the Phase-1 packages
   probe ambient globals FIRST — docx-import.ts lib() returns window.mammoth
   when present, pdf-import.ts lib() returns window.pdfjsLib — so the npm
   copies are dynamically imported here and pinned onto exactly those
   globals before any package conversion runs. Packages themselves load
   only via dynamic import AFTER loadStudio().
   ============================================================ */
import type { Attachment } from "@docforge/engine";
import { newKey } from "./attachments";
import { loadStudio } from "./bootstrap";
import { htmlToMd } from "./html-to-md";

export interface ImportResult {
  /** Converted manuscript — replace the document with it. */
  source?: string;
  /** A .docforge.json / .json project — route the file through the project opener. */
  project?: true;
  /** An image — attach it as a figure (processImageFile + insertFigure). */
  image?: File;
  /** Human-readable failure — show it, change nothing. */
  error?: string;
  /** docx only: embedded pictures keyed by the img:KEY tokens in `source`. */
  attachments?: Record<string, Attachment>;
  /** pdf only: conversion caveats, already cut to the two the classic edition toasts. */
  warnings?: string[];
  /** A reference library (.bib/.ris/CSL-JSON): dialect `[@key]: …` lines to
      MERGE into the document, never a replacement for it. */
  definitions?: string;
  /** How many entries those lines carry — for the reader's report. */
  entryCount?: number;
}

/* The classic import whitelist (src/js/main.js importFile). */
const IMPORT_EXTS = [
  "docx",
  "pdf",
  "md",
  "markdown",
  "txt",
  "html",
  "htm",
  "csv",
  "tsv",
  "xlsx",
  "pptx",
  "epub",
  "ipynb",
  "bib",
  "ris",
];

/* The classic drop router (src/js/main.js editor "drop"): the first document
   file wins; otherwise the first image; otherwise nothing (plain text drops
   behave natively). */
const DROP_DOC_RE = /\.(docx|doc|pdf|md|markdown|txt|json|html|htm|csv|tsv|xlsx|pptx|epub|ipynb)$/i;
export function pickDropFile(files: File[]): File | null {
  return (
    files.find((f) => DROP_DOC_RE.test(f.name)) ??
    files.find((f) => /^image\//.test(f.type)) ??
    null
  );
}

/** Extensions whose conversion is heavy enough that the classic edition
    announced work the moment it began — the shell's "Reading …" cue. */
export function isHeavyImport(name: string): boolean {
  return /\.(docx|pdf|xlsx|pptx|epub)$/i.test(name);
}

/* ---------------- import-only libraries ----------------
   mammoth and pdfjs-dist are import-time freight: nobody pays for them at
   boot, and a user who never imports never loads them. */

async function ensureMammoth(): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  if (g.mammoth) return;
  // mammoth ships CJS (`export = mammoth`) with a browser-field remap; the
  // interop namespace carries the library on .default (kept as a fallback
  // in case a future build hands back the namespace itself).
  const m = (await import("mammoth")) as unknown as { default?: unknown };
  g.mammoth = m.default ?? m;
}

async function ensurePdfjs(): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  if (g.pdfjsLib) return;
  // Worker module FIRST, mirroring the classic bundle order: pdf.worker.min.mjs
  // assigns globalThis.pdfjsWorker = { WorkerMessageHandler } as it evaluates,
  // and pdf.js probes that global (PDFWorker's main-thread handler) before it
  // ever reads GlobalWorkerOptions.workerSrc — the fake-worker path, no real
  // Worker, exactly how the classic edition ran its embedded bundles.
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs")) as unknown as {
    WorkerMessageHandler?: unknown;
  };
  // Belt and braces: pin the global ourselves should the bundle's own
  // side-effect assignment ever be optimised away.
  g.pdfjsWorker ??= { WorkerMessageHandler: worker.WorkerMessageHandler };
  const pdfjs = await import("pdfjs-dist");
  // Never read on the fake-worker path; set defensively — the same line the
  // package's own loader (pdf-import.ts lib()) runs after its bundles land.
  pdfjs.GlobalWorkerOptions.workerSrc = "";
  g.pdfjsLib = pdfjs;
}

/** Packages only after loadStudio() — engine globals must land first. */
async function importers() {
  await loadStudio();
  return (await import("@docforge/importers")).api;
}

/* ---------------- docx ---------------- */

/* An imported (non-project) image arrives as a data URL, not a File — same
   downscale rules as processImageFile so attachments stay autosave-sized.
   (Port of src/js/main.js dataUrlAttachment.) */
function dataUrlAttachment(dataUrl: string): Promise<Attachment> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onerror = rej;
    img.onload = () => {
      const MAX = 1600;
      const { width: w, height: h } = img;
      if (w > MAX || h > MAX) {
        const k = MAX / Math.max(w, h);
        const cv = document.createElement("canvas");
        cv.width = Math.round(w * k);
        cv.height = Math.round(h * k);
        const ctx = cv.getContext("2d");
        if (!ctx) {
          rej(new Error("canvas is unavailable here"));
          return;
        }
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        const isPng = /^data:image\/(png|gif)/i.test(dataUrl);
        res({
          dataUrl: cv.toDataURL(isPng ? "image/png" : "image/jpeg", 0.92),
          w: cv.width,
          h: cv.height,
        });
      } else res({ dataUrl, w, h });
    };
    img.src = dataUrl;
  });
}

async function importDocxFile(f: File): Promise<ImportResult> {
  await ensureMammoth();
  const { DocxImport } = await importers();
  const { html, messages } = await DocxImport.toHtml(await f.arrayBuffer());
  const doc = new DOMParser().parseFromString(html, "text/html");
  const atts: Record<string, Attachment> = {};
  // Embedded pictures become numbered figures; formats the browser can't decode
  // (EMF/WMF vector clips, mostly) are dropped rather than left as broken tags.
  for (const img of [...doc.querySelectorAll<HTMLImageElement>('img[src^="data:"]')]) {
    try {
      const att = await dataUrlAttachment(img.src);
      const key = newKey();
      atts[key] = att;
      img.dataset.dfKey = key;
    } catch {
      img.remove();
    }
  }
  const md = htmlToMd(doc.body.innerHTML);
  if (!md.trim()) return { error: "That Word file appears to be empty" };
  // Images that didn't survive the conversion (table cells, undecodable formats)
  // must not ride along as orphaned bytes in every autosave.
  for (const key of Object.keys(atts)) if (!md.includes("img:" + key)) delete atts[key];
  if (messages && messages.length) console.warn("[DocForge] docx import notes:", messages);
  return { source: md, attachments: atts };
}

/* ---------------- pdf (convert route) ---------------- */

async function importPdfFile(f: File): Promise<ImportResult> {
  await ensurePdfjs();
  const { PdfImport } = await importers();
  const { source, warnings } = await PdfImport.toMarkdown(await f.arrayBuffer());
  // The classic edition toasts the first two warnings; bake that cut in so
  // the shell just shows every entry.
  return { source, warnings: (warnings || []).slice(0, 2) };
}

/* ---------------- reference libraries ---------------- */

type BibApi = Awaited<ReturnType<typeof importers>>["BibImport"];

/** A library is an ADDITION to the document, so it comes back as definitions
    for the caller to merge — never as a `source` that would replace the
    manuscript with a wall of bibliography. */
function libraryResult(text: string, name: string, BibImport: BibApi): ImportResult {
  const entries = BibImport.parseLibrary(text, name);
  if (entries.length === 0) return { error: "No references found in that file" };
  return { definitions: BibImport.toDefinitions(entries), entryCount: entries.length };
}

/* ---------------- the router ---------------- */

/** The classic importFile dispatch (src/js/main.js), outcomes as data:
    the caller replaces the document / opens the project / attaches the
    image / shows the error. */
export async function importFile(f: File): Promise<ImportResult> {
  const ext = ((f.name.match(/\.([a-z0-9]+)$/i) || [])[1] || "").toLowerCase();
  if (ext === "json") {
    /* Zotero calls its export "CSL JSON" and gives it the same extension a
       DocForge project uses — so the CONTENT decides, not the name. */
    const text = await f.text();
    const { BibImport } = await importers();
    if (BibImport.looksLikeCslJson(text)) return libraryResult(text, f.name, BibImport);
    return { project: true };
  }
  if (ext === "doc") return { error: "Old binary .doc — open it in Word and save as .docx first" };
  // An image picked through Open becomes an attached figure, same as dropping it.
  if (/^image\//.test(f.type)) return { image: f };
  if (!IMPORT_EXTS.includes(ext)) return { error: "Can't import that file type" };
  try {
    if (ext === "docx") return await importDocxFile(f);
    if (ext === "pdf") return await importPdfFile(f);
    if (ext === "html" || ext === "htm") return { source: htmlToMd(await f.text()) || "" };
    if (ext === "csv" || ext === "tsv") {
      const { FileImport } = await importers();
      return { source: FileImport.csv(await f.text()) };
    }
    if (ext === "xlsx") {
      const { FileImport } = await importers();
      return { source: await FileImport.xlsx(await f.arrayBuffer()) };
    }
    if (ext === "pptx") {
      const { FileImport } = await importers();
      return { source: await FileImport.pptx(await f.arrayBuffer()) };
    }
    if (ext === "epub") {
      const { FileImport } = await importers();
      return { source: await FileImport.epub(await f.arrayBuffer(), htmlToMd) };
    }
    if (ext === "ipynb") {
      const { FileImport } = await importers();
      return { source: FileImport.ipynb(await f.text()) };
    }
    if (ext === "bib" || ext === "ris") {
      const { BibImport } = await importers();
      return libraryResult(await f.text(), f.name, BibImport);
    }
    return { source: await f.text() }; // md / markdown / txt
  } catch (err) {
    console.error("[DocForge] import failed", err);
    return {
      error:
        err instanceof Error && err.message
          ? err.message
          : "Couldn't read that file — re-save it and try importing again",
    };
  }
}
