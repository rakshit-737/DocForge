import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { transformSync } from "esbuild";

const read = p => readFileSync(p, "utf8");
const min = (code, opts = {}) => transformSync(code, { minify: true, ...opts }).code;
const guard = js => js.replace(/<\/script/gi, "<\\/script");

// libraries
const marked = min(read("node_modules/marked/lib/marked.umd.js"));
const pagedPath = existsSync("node_modules/pagedjs/dist/paged.min.js")
  ? "node_modules/pagedjs/dist/paged.min.js" : "node_modules/pagedjs/dist/paged.js";
const paged = pagedPath.endsWith(".min.js") ? read(pagedPath) : min(read(pagedPath));
const docx = min(read("node_modules/docx/dist/index.iife.js"));

// embedded typefaces — one copy of each cut, shared by the CSS (@font-face rules are
// generated from this map at runtime) and by the .docx embedder. See tools/build_fonts.py.
const fontData = Object.fromEntries(
  readdirSync("fonts").filter(f => f.endsWith(".ttf")).sort()
    .map(f => [f.replace(/\.ttf$/, ""), readFileSync("fonts/" + f).toString("base64")])
);
const fontBytes = Object.values(fontData).reduce((n, b) => n + b.length, 0);

// app sources
const appCss = read("src/app.css");
const docCss = read("src/doc.css");
const engine = read("src/js/engine.js");
const docxFonts = read("src/js/docx-fonts.js");
const docxExport = read("src/js/docx-export.js");
const main = read("src/js/main.js");

let html = read("src/index.html");
const put = (token, value) => { html = html.split(token).join(value); };

put('"@DOCCSS@"', JSON.stringify(docCss));
put("/*@APPCSS@*/", appCss);
put("/*@MARKED@*/", guard(marked));
put("/*@PAGED@*/", guard(paged) + "\nwindow.Paged = window.Paged || window.PagedModule;");
put("/*@DOCX@*/", guard(docx) + "\nwindow.docx = docx;");
put("/*@FONTDATA@*/", "window.__FONT_DATA__=" + JSON.stringify(fontData) + ";");
put("/*@ENGINE@*/", guard(engine));
put("/*@DOCXFONTS@*/", guard(docxFonts));
put("/*@DOCXEXPORT@*/", guard(docxExport));
put("/*@MAIN@*/", guard(main));

mkdirSync("dist", { recursive: true });
writeFileSync("dist/DocForge.html", html);
console.log(
  "dist/DocForge.html", (html.length / 1024 / 1024).toFixed(2) + " MB",
  `(fonts ${(fontBytes / 1024 / 1024).toFixed(2)} MB of it)`
);
