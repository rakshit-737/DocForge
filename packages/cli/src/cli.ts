/* ============================================================
   @docforge/cli — headless DocForge: markdown in, .docx out.

     docforge build report.md --docx [--out dir] [--theme executive] …

   The same pipeline the studio runs in the browser, stood up in
   Node: a happy-dom Window plays the DOM; the npm copies of
   marked / katex / highlight.js / docx play the vendored globals
   (mirroring packages/engine/test/setup.ts and apps/web/lib/
   bootstrap.ts); __FONT_DATA__ is read straight from the repo's
   fonts/ directory so the .docx embeds the same typefaces the
   single-file edition carries. The workspace packages arrive via
   dynamic import BEHIND the global assignments — the engine
   registers its marked extensions at import time, so order is law.
   ============================================================ */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Attachments, Settings as EngineSettings } from "@docforge/engine";
import type { DocxSettings } from "@docforge/export-docx";

type EngineModule = typeof import("@docforge/engine");
type EngineApi = EngineModule["api"];

/** Expected failures — reported without a stack, exit 1. */
class CliError extends Error {}

/* ---------------- settings (mirrors apps/web/lib/settings.ts) ---------------- */

export interface CliSettings {
  [key: string]: unknown;
  title: string;
  subtitle: string;
  author: string;
  kicker: string;
  metaExtra: string;
  date: string;
  theme: string;
  accent: string;
  page: string;
  orientation: string;
  margins: string;
  cover: boolean;
  header: boolean;
  pageNums: boolean;
  numbered: boolean;
  justify: boolean;
  h1break: boolean;
  hardWrap: boolean;
  citeStyle: string;
  borderStyle: string;
  borderWeight: string;
  borderColor: string;
  /* Watermark & letterhead (§8.2). --letterhead takes a PNG or JPEG path and
     the file is inlined before the build, because both exporters read a data
     URL out of the settings exactly as the studio hands them one. */
  watermark: string;
  letterhead: string;
  letterheadSize: string;
  fontHead: string;
  fontBody: string;
  baseSize: string;
  lineSpacing: string;
}

const THEME_ACCENT: Record<string, string> = {
  modern: "#2563eb",
  executive: "#1f3a5f",
  academic: "#7f1d1d",
  minimal: "#111827",
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function defaultSettings(): CliSettings {
  return {
    title: "",
    subtitle: "",
    author: "",
    kicker: "",
    metaExtra: "",
    date: todayISO(),
    theme: "modern",
    accent: "#2563eb",
    page: "A4",
    orientation: "portrait",
    margins: "normal",
    cover: false,
    header: true,
    pageNums: true,
    numbered: false,
    justify: false,
    h1break: false,
    hardWrap: false,
    citeStyle: "ieee",
    borderStyle: "none",
    borderWeight: "medium",
    borderColor: "ink",
    watermark: "",
    letterhead: "",
    letterheadSize: "14",
    fontHead: "theme",
    fontBody: "theme",
    baseSize: "11",
    lineSpacing: "default",
  };
}

/* ---------------- argument parsing ---------------- */

const STRING_FLAGS: Record<string, string> = {
  "--title": "title",
  "--subtitle": "subtitle",
  "--author": "author",
  "--kicker": "kicker",
  "--meta-extra": "metaExtra",
  "--date": "date",
  "--theme": "theme",
  "--accent": "accent",
  "--page": "page",
  "--orientation": "orientation",
  "--margins": "margins",
  "--cite-style": "citeStyle",
  "--border-style": "borderStyle",
  "--border-weight": "borderWeight",
  "--border-color": "borderColor",
  "--watermark": "watermark",
  "--letterhead": "letterhead",
  "--letterhead-size": "letterheadSize",
  "--font-head": "fontHead",
  "--font-body": "fontBody",
  "--base-size": "baseSize",
  "--line-spacing": "lineSpacing",
};

const BOOL_FLAGS: Record<string, [key: string, value: boolean]> = {
  "--cover": ["cover", true],
  "--no-cover": ["cover", false],
  "--numbered": ["numbered", true],
  "--justify": ["justify", true],
  "--h1break": ["h1break", true],
  "--hard-wrap": ["hardWrap", true],
  "--no-header": ["header", false],
  "--no-page-nums": ["pageNums", false],
};

/* Closed vocabularies, matched case-insensitively, stored canonically.
   The values mirror packages/engine/src/themes.ts and doc.css exactly. */
const CHOICES: Record<string, string[]> = {
  theme: ["modern", "executive", "academic", "minimal"],
  page: ["A4", "Letter"],
  orientation: ["portrait", "landscape"],
  margins: ["normal", "narrow", "wide"],
  borderStyle: ["none", "rule", "double", "triple", "dashed", "dotted", "thickthin", "thinthick"],
  borderWeight: ["fine", "medium", "bold"],
  borderColor: ["ink", "accent"],
  lineSpacing: ["default", "1", "1.15", "1.5", "2"],
};

interface CliOptions {
  command: string | null;
  input: string | null;
  out: string | null;
  docx: boolean;
  pdf: boolean;
  help: boolean;
  version: boolean;
  overrides: Record<string, unknown>;
  errors: string[];
}

const kebab = (key: string): string => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

function setOverride(o: CliOptions, key: string, raw: string): void {
  let value = raw;
  const choices = CHOICES[key];
  if (choices) {
    const hit = choices.find((c) => c.toLowerCase() === raw.toLowerCase());
    if (!hit) {
      o.errors.push(`--${kebab(key)} must be one of ${choices.join(" | ")} (got "${raw}")`);
      return;
    }
    value = hit;
  }
  if (key === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    o.errors.push(`--date must be YYYY-MM-DD (got "${raw}")`);
    return;
  }
  if (key === "accent") {
    if (!/^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
      o.errors.push(`--accent must be a hex colour like #2563eb (got "${raw}")`);
      return;
    }
    value = raw.startsWith("#") ? raw : `#${raw}`;
  }
  if (key === "letterhead" && !/\.(?:png|jpe?g)$/i.test(raw)) {
    o.errors.push(`--letterhead must be a PNG or JPEG file (got "${raw}")`);
    return;
  }
  if (key === "letterheadSize" && !(Number.parseFloat(raw) > 0)) {
    o.errors.push(`--letterhead-size must be a height in millimetres (got "${raw}")`);
    return;
  }
  if (key === "baseSize" && !(Number.parseFloat(raw) > 0)) {
    o.errors.push(`--base-size must be a point size (got "${raw}")`);
    return;
  }
  o.overrides[key] = value;
}

export function parseArgs(args: string[]): CliOptions {
  const o: CliOptions = {
    command: null,
    input: null,
    out: null,
    docx: false,
    pdf: false,
    help: false,
    version: false,
    overrides: {},
    errors: [],
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === undefined) continue;
    if (a === "--help" || a === "-h") {
      o.help = true;
    } else if (a === "--version" || a === "-v") {
      o.version = true;
    } else if (a === "--docx") {
      o.docx = true;
    } else if (a === "--pdf") {
      o.pdf = true;
    } else if (a === "--out") {
      const v = args[++i];
      if (v === undefined) o.errors.push("--out needs a directory");
      else o.out = v;
    } else if (STRING_FLAGS[a]) {
      const v = args[++i];
      if (v === undefined) o.errors.push(`${a} needs a value`);
      else setOverride(o, STRING_FLAGS[a], v);
    } else if (BOOL_FLAGS[a]) {
      const [key, value] = BOOL_FLAGS[a];
      o.overrides[key] = value;
    } else if (a.startsWith("-")) {
      o.errors.push(`unknown flag ${a}`);
    } else if (!o.command) {
      o.command = a;
    } else if (!o.input) {
      o.input = a;
    } else {
      o.errors.push(`unexpected argument ${a}`);
    }
  }
  return o;
}

/** Defaults + flags. --theme also re-seats the accent (the studio's pairing)
    unless --accent was given explicitly — the override loop runs last, so an
    explicit accent always wins. */
export function settingsFrom(o: CliOptions): CliSettings {
  const s = defaultSettings();
  const theme = o.overrides.theme;
  if (typeof theme === "string" && THEME_ACCENT[theme]) s.accent = THEME_ACCENT[theme];
  for (const [k, v] of Object.entries(o.overrides)) s[k] = v;
  return s;
}

/** Inline a letterhead file as the data URL both exporters expect. The studio
    hands them one from a file picker; the CLI reads it off disk instead, and
    holds it to the same PNG/JPEG-under-512-KB rule so a .docx header never
    carries a photograph by accident. */
export function letterheadDataUrl(path: string): string {
  const bytes = readFileSync(path);
  if (bytes.length > 512 * 1024) {
    throw new CliError(
      `--letterhead is ${Math.round(bytes.length / 1024)} KB; a letterhead has to stay under 512 KB`,
    );
  }
  const mime = /\.png$/i.test(path) ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/* ---------------- the headless pipeline ---------------- */

/** Walk up from this script towards the repo root looking for `rel` —
    dist/cli.mjs and src/cli.ts both sit two levels under the root via
    packages/cli, so six hops is plenty. Returns the absolute path or null. */
function findUp(rel: string): string | null {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const cand = join(dir, rel);
    if (existsSync(cand)) return cand;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** The repo's fonts/ directory. An npm-installed CLI has no fonts alongside —
    the .docx then names the DocForge faces without embedding bytes, which the
    exporter handles (the same guard the classic build has for missing cuts). */
function findFontsDir(): string | null {
  const probe = findUp(join("fonts", "DocForgeSans-Regular.ttf"));
  return probe ? dirname(probe) : null;
}

/** base64 TTF bytes per "<stem>-<Cut>" key — the same contract build.mjs
    inlines into the single file and apps/web/lib/bootstrap.ts fetches. */
function collectFontData(engine: EngineApi): Record<string, string> {
  const out: Record<string, string> = {};
  const dir = findFontsDir();
  if (!dir) {
    process.stderr.write(
      "note: fonts/ not found — DocForge faces will be named, not embedded, in the .docx\n",
    );
    return out;
  }
  for (const fam of engine.EMBEDDED) {
    for (const cut of Object.keys(fam.cuts)) {
      const cutName = engine.CUT_FILE[cut];
      if (!cutName) continue;
      const key = `${fam.stem}-${cutName}`;
      const file = join(dir, `${key}.ttf`);
      if (!existsSync(file)) continue;
      out[key] = readFileSync(file).toString("base64");
    }
  }
  return out;
}

/** Resolve the input path and read it, or fail like the CLI always has. */
function readInput(input: string): { sourcePath: string; source: string } {
  const sourcePath = resolve(process.cwd(), input);
  if (!existsSync(sourcePath)) throw new CliError(`input not found: ${sourcePath}`);
  return { sourcePath, source: readFileSync(sourcePath, "utf8") };
}

/** Stand up the headless studio (steps 1–4) and render the source (step 5's
    first half) — shared by the .docx and .pdf paths. Returns the rendered
    document plus the live engine api for the caller's follow-up calls. */
async function renderSource(
  source: string,
  settings: CliSettings,
): Promise<{ doc: HTMLDivElement; engine: EngineApi }> {
  const g = globalThis as unknown as Record<string, unknown>;

  /* 1 — the DOM. One happy-dom Window plays browser: its constructors and
     document land on globalThis, where the packages read them ambiently. */
  const { Window } = await import("happy-dom");
  const win = new Window() as unknown as Record<string, unknown>;
  /* Standards mode, not quirks — katex checks document.compatMode at import
     time and warns loudly. happy-dom leaves it undefined, so declare what is
     true of the studio's documents (they always carry a doctype). */
  const happyDoc = win.document as unknown as Record<string, unknown>;
  if (happyDoc.compatMode === undefined) happyDoc.compatMode = "CSS1Compat";
  g.window = win;
  for (const key of [
    "document",
    "DOMParser",
    "Node",
    "NodeFilter",
    "Element",
    "HTMLElement",
    "Text",
    "DocumentFragment",
  ]) {
    g[key] = win[key];
  }

  /* 2 — the vendored globals, npm copies at the exact ROOT versions
     (mirrors packages/engine/test/setup.ts and apps/web/lib/bootstrap.ts;
     the `.default ??` interop mirrors the root build.mjs hljs guard). */
  const [markedNs, katexNs, hljsNs, docxNs] = await Promise.all([
    import("marked"),
    import("katex"),
    import("highlight.js/lib/common"),
    import("docx"),
  ]);
  g.marked = markedNs.marked;
  g.katex = (katexNs as { default?: unknown }).default ?? katexNs;
  g.hljs = (hljsNs as { default?: unknown }).default ?? hljsNs;
  const docxLib = (docxNs as Record<string, unknown>).Document
    ? docxNs
    : (docxNs as { default?: unknown }).default;
  g.docx = docxLib;
  win.docx = docxLib;

  /* 3 — the engine, dynamically imported BEHIND the assignments (it runs
     marked.use at import time). The exporter reads the classic ambient
     Engine global — a plain spread, mutable, like packages/engine/src/global.ts. */
  const engineMod: EngineModule = await import("@docforge/engine");
  g.Engine = { ...engineMod.globalApi };

  /* 4 — font bytes reach both sides through the __FONT_DATA__ contract. */
  const fontData = collectFontData(engineMod.api);
  g.__FONT_DATA__ = fontData;
  win.__FONT_DATA__ = fontData;

  /* 5a — render: the same call the studio makes. */
  const { doc } = engineMod.api.render(source, settings as EngineSettings, {} as Attachments);
  return { doc, engine: engineMod.api };
}

/** Render the source and write the .docx; returns the output path. */
export async function buildDocxFile(
  input: string,
  outDir: string | null,
  settings: CliSettings,
): Promise<string> {
  const { sourcePath, source } = readInput(input);

  /* 5b — export: the studio's second call. */
  const { doc } = await renderSource(source, settings);
  const content = doc.querySelector<HTMLElement>(".content");
  if (!content) throw new CliError("render produced no .content element");
  const docxExportMod = await import("@docforge/export-docx");
  const blob = await docxExportMod.api.DocxExport.build(
    content,
    settings as unknown as DocxSettings,
    {},
  );

  /* 6 — write <input stem>.docx next to the input, or into --out. */
  const dir = outDir ? resolve(process.cwd(), outDir) : dirname(sourcePath);
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, `${basename(sourcePath, extname(sourcePath))}.docx`);
  writeFileSync(outPath, new Uint8Array(await blob.arrayBuffer()));
  return outPath;
}

/* ---------------- direct PDF export (the issue #9 spike) ----------------

   The two things the in-app print dialog cannot produce — a document outline
   (bookmarks) and tagged (accessible) structure — come from Chromium's print
   engine, reached through playwright-core's page.pdf({ outline, tagged })
   (CDP Page.printToPDF generateDocumentOutline / generateTaggedPDF; verified
   against the installed playwright-core 1.62.1).

   The pipeline mirrors the studio and the qa harness: the CLI's happy-dom
   render supplies doc.outerHTML + Engine.dynamicCss, a self-contained temp
   HTML inlines doc.css + KaTeX CSS + @font-face from __FONT_DATA__ + the
   pagedjs UMD + a driver that runs Paged.Previewer (with the folio /
   table-header / footnote handler trio ported from the studio), Chromium
   opens it over file:// and prints. */

const PRINT_TIMEOUT = 180_000; // Chromium can be slow under load — generous, not flaky

/* Cross-platform Chromium resolution — a LOCAL COPY of qa/_browser.mjs's
   candidate list (the CLI must not import qa/; if that list gains a browser,
   mirror it here by hand). Order: PW_CHROMIUM env → playwright's own
   download → system Chrome/Edge. */
const CHROMIUM_CANDIDATES = [
  process.env.PW_CHROMIUM,
  "/opt/pw-browsers/chromium",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((p): p is string => !!p);

function chromiumExecutable(): string | undefined {
  for (const p of CHROMIUM_CANDIDATES) if (existsSync(p)) return p;
  return undefined; // let playwright try its bundled browser
}

/** doc.css, KaTeX CSS (maths woff2 inlined as data URIs, mirroring the root
    build.mjs) and the pagedjs UMD — all discovered by the same walk-up the
    fonts use, so --pdf works from the repo checkout and fails honestly
    anywhere else. */
function readPrintAssets(): { docCss: string; katexCss: string; pagedJs: string } {
  const docCssPath = findUp(join("src", "doc.css"));
  if (!docCssPath) {
    throw new CliError(
      "src/doc.css not found — --pdf runs from the DocForge repo checkout (an npm-installed CLI cannot print yet)",
    );
  }
  // build.mjs's preference: the minified cut when the package ships one.
  const pagedPath =
    findUp(join("node_modules", "pagedjs", "dist", "paged.min.js")) ??
    findUp(join("node_modules", "pagedjs", "dist", "paged.js"));
  if (!pagedPath) {
    throw new CliError(
      "pagedjs not found — --pdf needs the repo's root node_modules (pnpm install at the workspace root)",
    );
  }
  // Optional: without it maths sets unstyled; everything else prints fine.
  let katexCss = "";
  const katexCssPath = findUp(join("node_modules", "katex", "dist", "katex.min.css"));
  if (katexCssPath) {
    const fontsDir = join(dirname(katexCssPath), "fonts");
    katexCss = readFileSync(katexCssPath, "utf8").replace(
      /src:url\(fonts\/([A-Za-z0-9_-]+)\.woff2\)[^;}]*/g,
      (_m, name) =>
        `src:url(data:font/woff2;base64,${readFileSync(join(fontsDir, `${name}.woff2`)).toString("base64")}) format("woff2")`,
    );
  }
  return {
    docCss: readFileSync(docCssPath, "utf8"),
    katexCss,
    pagedJs: readFileSync(pagedPath, "utf8"),
  };
}

/* The print driver — runs inside Chromium, after the pagedjs UMD. The three
   handlers are a 1:1 port of the studio trio (apps/web/lib/preview-controller
   .ts, itself the classic src/js/main.js): repeated table headers, the
   front-matter/body folio sequences ("Page n of N"), and the pagedjs 0.4.3
   footnote hardening. ComposeTicker is app chrome and stays home. String.raw
   keeps the backslashes below out of TypeScript's escape processing. */
const PRINT_DRIVER = String.raw`
(function () {
  "use strict";

  /* Repeat table headers across page breaks — runs in renderNode, not
     afterPageLayout, so the injected header's height is seen by
     findBreakToken and the last row spills instead of clipping. */
  class RepeatTableHeader extends Paged.Handler {
    renderNode(clone, node) {
      const el = clone && (clone.nodeType === 1 ? clone : clone.parentElement);
      if (!el || !el.closest) return;
      const destTable = el.closest("table[data-split-from]");
      if (!destTable) return;
      if (destTable.querySelector(":scope > thead")) return;
      const srcEl = node && (node.nodeType === 1 ? node : node.parentElement);
      const srcTable = srcEl && srcEl.closest && srcEl.closest("table");
      const srcHead = srcTable && srcTable.querySelector(":scope > thead");
      if (!srcHead || !srcHead.childElementCount) return;
      const head = srcHead.cloneNode(true);
      head.removeAttribute("data-ref");
      head.querySelectorAll("[data-ref]").forEach((n) => n.removeAttribute("data-ref"));
      head.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      head.setAttribute("data-repeated-header", "");
      destTable.insertBefore(head, destTable.firstChild);
    }
  }

  /* Folios: front matter runs roman, the body runs "Page n of N" counting
     body pages only; contents entries quote the same folio the page prints. */
  const ROMAN = [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  function roman(n) {
    let out = "";
    for (const pair of ROMAN) while (n >= pair[0]) { out += pair[1]; n -= pair[0]; }
    return out;
  }

  class PageNumbering extends Paged.Handler {
    afterRendered(pages) {
      const els = [...pages].map((p) => p.element || p).filter((el) => el && el.classList);
      const kindOf = (el) =>
        el.classList.contains("pagedjs_cover_page") ? "cover" :
        el.classList.contains("pagedjs_front_page") ? "front" : "body";
      const kinds = els.map(kindOf);
      const bodyTotal = kinds.filter((k) => k === "body").length;

      const folio = new Map();
      let f = 0, b = 0;
      els.forEach((el, i) => {
        let num = "", txt = "";
        if (kinds[i] === "front") { num = roman(++f); txt = num; }
        else if (kinds[i] === "body") { num = String(++b); txt = "Page " + num + " of " + bodyTotal; }
        folio.set(el, num);
        el.style.setProperty("--df-foot", JSON.stringify(txt));
      });

      const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/"/g, '\\"'));
      els.forEach((el) => el.querySelectorAll('.toc a[href^="#"]').forEach((a) => {
        const id = a.getAttribute("href").slice(1);
        const host = els.find((pe) => pe.querySelector("#" + esc(id)));
        a.style.setProperty("--df-tocnum", JSON.stringify(host ? folio.get(host) || "" : ""));
      }));
    }
  }

  /* pagedjs 0.4.3 footnote hardening: reclaim reserved strips for removed
     notes; re-measure so fractional-px maths stops clipping descenders. */
  class FootnoteFix extends Paged.Handler {
    afterPageLayout(pageElement) {
      const area = pageElement.querySelector(".pagedjs_area");
      const cont = pageElement.querySelector(".pagedjs_footnote_content");
      const inner = pageElement.querySelector(".pagedjs_footnote_inner_content");
      if (!area || !cont || !inner) return;

      const reserved = parseFloat(area.style.getPropertyValue("--pagedjs-footnotes-height")) || 0;
      const notes = inner.querySelectorAll("[data-note='footnote']");

      if (!notes.length) {
        if (reserved > 0) area.style.setProperty("--pagedjs-footnotes-height", "0px");
        cont.classList.add("pagedjs_footnote_empty");
        return;
      }

      const px = (v) => parseFloat(v) || 0;
      const cs = getComputedStyle(cont);
      const chrome = px(cs.marginTop) + px(cs.marginBottom) + px(cs.paddingTop) +
        px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
      let needed = 0;
      notes.forEach((n) => { needed += n.getBoundingClientRect().height; });
      const want = Math.ceil(needed + chrome);
      if (want > Math.ceil(reserved)) area.style.setProperty("--pagedjs-footnotes-height", want + "px");
      inner.style.height = "auto";
      cont.style.height = "auto";
    }
  }

  Paged.registerHandlers(RepeatTableHeader, PageNumbering, FootnoteFix);

  window.__done = false;
  const previewer = new Paged.Previewer();
  const cssUrl = URL.createObjectURL(new Blob([window.__DOC_CSS__], { type: "text/css" }));
  previewer
    .preview(window.__DOC_HTML__, [cssUrl], document.body)
    .then(async (flow) => {
      try { await document.fonts.ready; } catch (e) {}
      window.__total = flow.total;
      window.__done = true;
    })
    .catch((e) => {
      window.__error = String((e && e.stack) || e);
      window.__done = true;
    });
})();
`;

/** One self-contained page: markup + CSS as JSON payloads, the pagedjs UMD,
    the driver. The guard mirrors the root build.mjs — nothing inlined may
    close the <script> that carries it. The <title> matters: Chromium roots
    the generated outline in the document title. */
function composePrintHtml(docHtml: string, css: string, pagedJs: string, title: string): string {
  const guard = (js: string) => js.replace(/<\/script/gi, "<\\/script");
  const escHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return [
    "<!doctype html>",
    `<html><head><meta charset="utf-8"><title>${escHtml(title)}</title>`,
    "<style>html,body{margin:0;padding:0;background:#fff}</style>",
    "</head><body>",
    `<script>${guard(pagedJs)}</script>`,
    // the same alias line the root build.mjs writes after the UMD
    "<script>window.Paged = window.Paged || window.PagedModule;</script>",
    `<script>window.__DOC_HTML__=${guard(JSON.stringify(docHtml))};window.__DOC_CSS__=${guard(JSON.stringify(css))};</script>`,
    `<script>${PRINT_DRIVER}</script>`,
    "</body></html>",
  ].join("\n");
}

/** Render the source, print it through headless Chromium, write the .pdf —
    with a document outline and tagged structure. Returns path + page count. */
export async function buildPdfFile(
  input: string,
  outDir: string | null,
  settings: CliSettings,
): Promise<{ path: string; pages: number }> {
  const { sourcePath, source } = readInput(input);
  const assets = readPrintAssets();

  /* playwright-core is a ROOT dependency, reached by Node's ordinary walk-up
     from packages/cli — resolvable in the repo checkout, honestly absent in
     an npm install. Dynamic, so --docx never pays for it. */
  const pw = await import("playwright-core").catch(() => null);
  if (!pw) {
    throw new CliError(
      "playwright-core not found — --pdf needs the repo's root node_modules (pnpm install at the workspace root)",
    );
  }

  const { doc, engine } = await renderSource(source, settings);
  const css =
    engine.fontFaceCss() +
    assets.katexCss +
    assets.docCss +
    engine.dynamicCss(settings as EngineSettings);
  const stem = basename(sourcePath, extname(sourcePath));
  const html = composePrintHtml(doc.outerHTML, css, assets.pagedJs, settings.title || stem);

  const dir = outDir ? resolve(process.cwd(), outDir) : dirname(sourcePath);
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, `${stem}.pdf`);

  const tmp = mkdtempSync(join(tmpdir(), "docforge-pdf-"));
  let browser: Awaited<ReturnType<typeof pw.chromium.launch>> | null = null;
  try {
    const tmpHtml = join(tmp, "print.html");
    writeFileSync(tmpHtml, html);
    browser = await pw.chromium.launch({
      executablePath: chromiumExecutable(),
      args: ["--no-sandbox", "--font-render-hinting=none"],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(PRINT_TIMEOUT);
    page.setDefaultNavigationTimeout(PRINT_TIMEOUT);
    await page.goto(`file:///${tmpHtml.replace(/\\/g, "/")}`);
    await page.waitForFunction(
      () => (window as unknown as { __done?: boolean }).__done === true,
      undefined,
      { timeout: PRINT_TIMEOUT, polling: 250 },
    );
    const pageErr = await page.evaluate(
      () => (window as unknown as { __error?: string }).__error ?? null,
    );
    if (pageErr) throw new CliError(`Paged.js failed in Chromium:\n${pageErr}`);
    const pages = await page.evaluate(
      () => (window as unknown as { __total?: number }).__total ?? 0,
    );
    await page.waitForTimeout(700); // the classic settle, qa/_drive.mjs cadence
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: outPath,
      preferCSSPageSize: true,
      printBackground: true,
      outline: true,
      tagged: true,
    });
    return { path: outPath, pages };
  } finally {
    if (browser) await browser.close().catch(() => {});
    rmSync(tmp, { recursive: true, force: true });
  }
}

/* ---------------- entry ---------------- */

function readVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const USAGE = `docforge — headless DocForge document builds

Usage
  docforge build <input.md> --docx [--pdf] [options]

Formats
  --docx                 write a Word .docx (the input stem names the file)
  --pdf                  write a paged .pdf through headless Chromium, WITH a
                         document outline (bookmarks) and tagged structure —
                         needs a Chromium/Chrome/Edge on this machine and the
                         DocForge repo checkout (pagedjs + playwright-core)

Output
  --out <dir>            output directory (default: alongside the input)

Document
  --title <text>         --subtitle <text>       --author <text>
  --kicker <text>        --meta-extra <text>     --date <YYYY-MM-DD>
  --theme <name>         modern | executive | academic | minimal
  --accent <#hex>        accent colour (default: the theme's own pairing)
  --page <size>          A4 | Letter
  --margins <preset>     normal | narrow | wide
  --font-head <key>      --font-body <key>       face key or sys:Family Name
  --base-size <pt>       --line-spacing <n>      1 | 1.15 | 1.5 | 2
  --cite-style <name>    citation style (default ieee)

Switches
  --cover  --numbered  --justify  --h1break  --hard-wrap
  --no-header  --no-page-nums  --no-cover

Page border
  --border-style <name>  rule | double | triple | dashed | dotted | thickthin | thinthick
  --border-weight <name> fine | medium | bold
  --border-color <name>  ink | accent
  --watermark <word>     DRAFT, CONFIDENTIAL … stamped across every page
  --letterhead <file>    a PNG or JPEG logo for the top margin
  --letterhead-size <mm> its printed height (default 14)

  --help  -h             --version  -v
`;

export async function main(argv: string[]): Promise<number> {
  const o = parseArgs(argv.slice(2));
  if (o.help || argv.length <= 2) {
    process.stdout.write(USAGE);
    return o.help ? 0 : 2;
  }
  if (o.version) {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }
  if (o.errors.length) {
    for (const e of o.errors) process.stderr.write(`docforge: ${e}\n`);
    process.stderr.write("docforge: see --help for usage\n");
    return 2;
  }
  if (o.command !== "build") {
    process.stderr.write(`docforge: unknown command "${o.command ?? ""}" — only "build" exists\n`);
    return 2;
  }
  if (!o.input) {
    process.stderr.write("docforge: no input file — docforge build <input.md> --docx\n");
    return 2;
  }
  if (!o.docx && !o.pdf) {
    process.stderr.write("docforge: nothing to write — pass --docx and/or --pdf\n");
    return 2;
  }
  const settings = settingsFrom(o);
  if (settings.letterhead && !settings.letterhead.startsWith("data:")) {
    settings.letterhead = letterheadDataUrl(settings.letterhead);
  }
  if (o.docx) {
    const outPath = await buildDocxFile(o.input, o.out, settings);
    const kb = (readFileSync(outPath).length / 1024).toFixed(1);
    process.stdout.write(`wrote ${outPath} (${kb} KB · ${settings.theme} · ${settings.page})\n`);
  }
  if (o.pdf) {
    const { path: outPath, pages } = await buildPdfFile(o.input, o.out, settings);
    const kb = (readFileSync(outPath).length / 1024).toFixed(1);
    process.stdout.write(
      `wrote ${outPath} (${kb} KB · ${pages} page${pages === 1 ? "" : "s"} · ${settings.theme} · ${settings.page} · outline + tagged)\n`,
    );
  }
  return 0;
}

main(process.argv).then(
  (code) => process.exit(code),
  (err: unknown) => {
    const msg =
      err instanceof CliError
        ? err.message
        : err instanceof Error
          ? (err.stack ?? err.message)
          : String(err);
    process.stderr.write(`docforge: ${msg}\n`);
    process.exit(1);
  },
);
