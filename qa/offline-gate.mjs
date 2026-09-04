/* ============================================================
   Phase-5 gate — the forever edition, from file://, with the
   network cut.

     node build.mjs && node qa/offline-gate.mjs

   The single-file promise is a product claim, so it is tested the
   way a reader would break it: dist/DocForge.html opened straight
   off the disk in a browser whose every non-file request is
   aborted. Any attempt to reach the network is a FAILURE, not a
   warning — a CDN fetch that merely happens to be cached on the
   developer's machine would ship a broken offline build.

   Verifies: the page boots, composes real pages, recomposes after
   an edit, exports a valid .docx, and never touches the network.
   ============================================================ */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { launch } from "./_browser.mjs";

const FILE = resolve("dist/DocForge.html");
const fails = [];
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) fails.push(name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(FILE)) {
  console.error(`dist/DocForge.html missing — run: node build.mjs`);
  process.exit(2);
}

let browser;
try {
  browser = await launch();
  const ctx = await browser.newContext();

  /* The cut cable: everything that is not the file itself dies at the
     request layer, so a "works offline" claim cannot lean on a cache. */
  const attempted = [];
  await ctx.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("file:")) return route.continue();
    attempted.push(url);
    return route.abort();
  });
  await ctx.setOffline(true);

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });

  await page.goto(pathToFileURL(FILE).href, { timeout: 60000 });
  await page.waitForSelector(".pagedjs_page", { timeout: 120000 });
  await sleep(1500);
  const pages = await page.locator(".pagedjs_page").count();
  check("boots and composes from file://", pages > 0, `${pages} page(s)`);

  // the fonts are inlined, so the document's own faces must resolve with
  // the cable cut — this is what the 1.9 MB of embedded TTF buys
  const fontOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check("16px 'DocForge Serif'");
  });
  check("embedded typefaces resolve offline", fontOk);

  // an edit recomposes (the whole pipeline runs locally). focus(), not
  // click(): the classic shell can be showing a first-run overlay, and the
  // gate is about the pipeline, not about hit-testing chrome.
  const overlay = await page.evaluate(
    () => document.querySelector(".overlay.open, #embedHint.on")?.id ?? "",
  );
  if (overlay) console.log(`     (dismissing overlay: #${overlay})`);
  await page.keyboard.press("Escape");
  await page.locator("#editor").focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n\n## Offline gate heading\n");
  await sleep(2500);
  const heading = await page.evaluate(() =>
    [...document.querySelectorAll(".pagedjs_page h2")].some((h) =>
      h.textContent.includes("Offline gate heading"),
    ),
  );
  check("recomposes after an edit", heading);

  // the Word export is the app's product — it must pack with no network
  const dl = page.waitForEvent("download", { timeout: 90000 }).catch(() => null);
  await page.click("#btnDocx");
  const got = await dl;
  check("exports a .docx offline", !!got, got ? await got.suggestedFilename() : "no download");
  if (got) {
    const path = await got.path();
    const { readFileSync } = await import("node:fs");
    const head = readFileSync(path).subarray(0, 4);
    // PK\x03\x04 — a real OOXML package, not an error page
    check("the exported .docx is a real zip", head[0] === 0x50 && head[1] === 0x4b);
  }

  check(`no network requests attempted (${attempted.length})`, attempted.length === 0);
  if (attempted.length) console.log(attempted.slice(0, 10).join("\n"));

  const fatal = errors.filter((e) => !/favicon|DevTools/i.test(e));
  check(`console clean (${fatal.length})`, fatal.length === 0);
  if (fatal.length) console.log(fatal.slice(0, 6).join("\n"));
} catch (e) {
  console.log("HARNESS:", String(e).slice(0, 400));
  fails.push("harness");
} finally {
  if (browser) await browser.close().catch(() => {});
}

console.log(fails.length ? `\n${fails.length} FAILURE(S)` : "\nOFFLINE GATE PASSES");
process.exit(fails.length ? 1 : 0);
