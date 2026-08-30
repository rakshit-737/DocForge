import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { transformSync, buildSync } from "esbuild";

const read = p => readFileSync(p, "utf8");
const min = (code, opts = {}) => transformSync(code, { minify: true, ...opts }).code;
const guard = js => js.replace(/<\/script/gi, "<\\/script");

// libraries
const marked = min(read("node_modules/marked/lib/marked.umd.js"));
const pagedPath = existsSync("node_modules/pagedjs/dist/paged.min.js")
  ? "node_modules/pagedjs/dist/paged.min.js" : "node_modules/pagedjs/dist/paged.js";
const paged = pagedPath.endsWith(".min.js") ? read(pagedPath) : min(read(pagedPath));
const docx = min(read("node_modules/docx/dist/index.iife.js"));

// highlight.js "common" build (36 languages), bundled CJS -> browser global `hljs`
const hljs = buildSync({
  entryPoints: ["node_modules/highlight.js/lib/common.js"],
  bundle: true, minify: true, write: false,
  format: "iife", globalName: "hljs", platform: "browser",
}).outputFiles[0].text + "\nhljs = hljs.default || hljs;";

// KaTeX: the UMD bundle as-is; its CSS with every woff2 inlined as a data URI so the
// maths fonts travel inside the one file (other formats dropped — Chromium reads woff2)
const katex = read("node_modules/katex/dist/katex.min.js");
const katexCss = read("node_modules/katex/dist/katex.min.css").replace(
  /src:url\(fonts\/([A-Za-z0-9_-]+)\.woff2\)[^;}]*/g,
  (m, name) => `src:url(data:font/woff2;base64,${readFileSync(`node_modules/katex/dist/fonts/${name}.woff2`).toString("base64")}) format("woff2")`
);

// embedded typefaces — one copy of each cut, shared by the CSS (@font-face rules are
// generated from this map at runtime) and by the .docx embedder. See tools/build_fonts.py.
const fontData = Object.fromEntries(
  readdirSync("fonts").filter(f => f.endsWith(".ttf")).sort()
    .map(f => [f.replace(/\.ttf$/, ""), readFileSync("fonts/" + f).toString("base64")])
);
const fontBytes = Object.values(fontData).reduce((n, b) => n + b.length, 0);

// Import libraries — mammoth (.docx) and pdf.js (lib + worker). Carried as plain JS
// strings and eval'd on first use, so startup never pays for features only an import
// needs. The worker bundle's IIFE global is `pdfjsWorker`, which is exactly the global
// pdf.js probes for its main-thread "fake worker" path — no real Worker, no Blob URL.
const mammoth = read("node_modules/mammoth/mammoth.browser.min.js");
const bundleIife = (entry, globalName) => buildSync({
  entryPoints: [entry],
  bundle: true, minify: true, write: false,
  format: "iife", globalName, platform: "browser",
}).outputFiles[0].text;
const pdfLib = bundleIife("node_modules/pdfjs-dist/build/pdf.min.mjs", "pdfjsLib");
const pdfWorker = bundleIife("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "pdfjsWorker");
const pdfLibLib = read("node_modules/pdf-lib/dist/pdf-lib.min.js"); // UMD -> window.PDFLib
const importLibs =
  "window.__MAMMOTH_SRC__=" + JSON.stringify(mammoth) + ";\n" +
  "window.__PDFJS_SRC__=" + JSON.stringify(pdfLib) + ";\n" +
  "window.__PDFJS_WORKER_SRC__=" + JSON.stringify(pdfWorker) + ";\n" +
  "window.__PDFLIB_SRC__=" + JSON.stringify(pdfLibLib) + ";";

// app sources — the ported modules build from packages/* (TypeScript, bundled to
// self-registering IIFEs whose global.ts entries assign the same globals the old
// IIFE files declared); the chrome (live-edit, main) still reads raw until Phase 2.
const bundlePkg = entry => buildSync({
  entryPoints: [entry],
  bundle: true, write: false, minify: false,
  format: "iife", platform: "browser", target: "es2022",
}).outputFiles[0].text;

const appCss = read("src/app.css");
const docCss = read("src/doc.css");
const engine = bundlePkg("packages/engine/src/global.ts");
const mathmlOmml = bundlePkg("packages/mathml-omml/src/global.ts");
// One bundle assigns DocxExport AND DocxFonts (mathml-omml rides inside it as a
// workspace import) — it fills the @DOCXEXPORT@ slot; @DOCXFONTS@ empties.
const docxFonts = "";
const docxExport = bundlePkg("packages/export-docx/src/global.ts");
// One bundle assigns FileImport, DocxImport AND PdfImport. It must run before the
// PDF editor (which reads the PdfImport global), so it fills the earliest of the
// three importer slots; the later two empty.
const docxImport = bundlePkg("packages/importers/src/global.ts");
const pdfImport = "";
const fileImport = "";
const pdfEditor = bundlePkg("packages/pdf-editor/src/global.ts");
const liveEdit = read("src/js/live-edit.js");
const main = read("src/js/main.js");

let html = read("src/index.html");
const put = (token, value) => { html = html.split(token).join(value); };

put('"@DOCCSS@"', JSON.stringify(docCss));
put("/*@APPCSS@*/", appCss);
put("/*@MARKED@*/", guard(marked));
put("/*@PAGED@*/", guard(paged) + "\nwindow.Paged = window.Paged || window.PagedModule;");
put("/*@DOCX@*/", guard(docx) + "\nwindow.docx = docx;");
put("/*@FONTDATA@*/", "window.__FONT_DATA__=" + JSON.stringify(fontData) + ";");
put("/*@HLJS@*/", guard(hljs));
put("/*@KATEX@*/", guard(katex));
put('"@KATEXCSS@"', JSON.stringify(katexCss));
put("/*@IMPORTLIBS@*/", guard(importLibs));
put("/*@ENGINE@*/", guard(engine));
put("/*@MATHMLOMML@*/", guard(mathmlOmml));
put("/*@DOCXFONTS@*/", guard(docxFonts));
put("/*@DOCXEXPORT@*/", guard(docxExport));
put("/*@DOCXIMPORT@*/", guard(docxImport));
put("/*@PDFIMPORT@*/", guard(pdfImport));
put("/*@PDFEDITOR@*/", guard(pdfEditor));
put("/*@FILEIMPORT@*/", guard(fileImport));
put("/*@LIVEEDIT@*/", guard(liveEdit));
put("/*@MAIN@*/", guard(main));

mkdirSync("dist", { recursive: true });
writeFileSync("dist/DocForge.html", html);
console.log(
  "dist/DocForge.html", (html.length / 1024 / 1024).toFixed(2) + " MB",
  `(fonts ${(fontBytes / 1024 / 1024).toFixed(2)} MB of it)`
);
