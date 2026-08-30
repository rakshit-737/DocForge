/* Rasterise a PDF to per-page PNGs using pdf.js inside a Chromium page.
   QA-only — pdfjs-dist is a devDependency and is never bundled into dist/.

   pdf.js ships as ESM, and Chrome refuses ES-module imports over file://, so the
   harness page is served by a throwaway localhost server rooted at the repo. The
   app itself is still always tested from file:// — only this tooling uses HTTP. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { createServer } from "node:http";
import { launch } from "./_browser.mjs";

const ROOT = resolve(".");
const MIME = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".map": "application/json" };

const HARNESS = `<!doctype html><meta charset=utf-8><body>
<script type="module">
import * as pdfjs from "/node_modules/pdfjs-dist/legacy/build/pdf.min.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs";
window.pdfjs = pdfjs;
window.__ready = true;
</script>`;

export function serveRepo() {
  return new Promise(res => {
    const srv = createServer((req, rq) => {
      const url = decodeURIComponent(req.url.split("?")[0]);
      if (url === "/__harness") {
        rq.writeHead(200, { "content-type": "text/html" });
        return rq.end(HARNESS);
      }
      const p = join(ROOT, url);
      if (!p.startsWith(ROOT) || !existsSync(p)) { rq.writeHead(404); return rq.end("no"); }
      rq.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
      rq.end(readFileSync(p));
    });
    srv.listen(0, "127.0.0.1", () => res({ srv, port: srv.address().port }));
  });
}

/** Rasterise `pdfPath` into `outDir` as p01.png, p02.png … */
export async function rasterise(pdfPath, outDir, { scale = 2, maxPages = 40, browser } = {}) {
  mkdirSync(outDir, { recursive: true });
  const bytes = [...readFileSync(pdfPath)];
  const { srv, port } = await serveRepo();
  const own = !browser;
  const b = browser || (await launch());
  const page = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();

  try {
    await page.goto(`http://127.0.0.1:${port}/__harness`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

    const result = await page.evaluate(
      async ({ bytes, scale, maxPages }) => {
        const doc = await window.pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
        const out = [];
        const n = Math.min(doc.numPages, maxPages);
        for (let i = 1; i <= n; i++) {
          const pg = await doc.getPage(i);
          const vp = pg.getViewport({ scale });
          const cv = document.createElement("canvas");
          cv.width = Math.ceil(vp.width);
          cv.height = Math.ceil(vp.height);
          const cx = cv.getContext("2d");
          cx.fillStyle = "#fff";
          cx.fillRect(0, 0, cv.width, cv.height);
          await pg.render({ canvasContext: cx, viewport: vp }).promise;
          out.push(cv.toDataURL("image/png"));
        }
        return { pages: out, total: doc.numPages };
      },
      { bytes, scale, maxPages }
    );

    const files = result.pages.map((dataUrl, i) => {
      const p = join(outDir, `p${String(i + 1).padStart(2, "0")}.png`);
      writeFileSync(p, Buffer.from(dataUrl.split(",")[1], "base64"));
      return p;
    });
    return { files, total: result.total };
  } finally {
    await page.context().close();
    if (own) await b.close();
    srv.close();
  }
}

/** Extract the text of every page — used to assert PDF text stays vector/selectable. */
export async function pdfText(pdfPath, { browser } = {}) {
  const bytes = [...readFileSync(pdfPath)];
  const { srv, port } = await serveRepo();
  const own = !browser;
  const b = browser || (await launch());
  const page = await (await b.newContext()).newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/__harness`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    return await page.evaluate(async bytes => {
      const doc = await window.pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
      const pages = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const c = await (await doc.getPage(i)).getTextContent();
        pages.push(c.items.map(t => t.str).join(""));
      }
      return pages;
    }, bytes);
  } finally {
    await page.context().close();
    if (own) await b.close();
    srv.close();
  }
}
