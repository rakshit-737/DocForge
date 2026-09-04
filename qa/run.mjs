import { launch } from "./_browser.mjs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const dist = resolve("dist/DocForge.html");
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1560, height: 980 }, acceptDownloads: true });
const p = await ctx.newPage();

const errors = [];
p.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
p.on("pageerror", e => errors.push("PAGEERROR: " + String(e).slice(0, 300)));

await p.goto("file://" + dist);
/* Fresh state, minus the one-time first-run manual — it opens over the desk
   and swallows every click below (firstrun-smoke owns that door). */
await p.evaluate(() => { localStorage.clear(); localStorage.setItem("docforge.helped", "1"); });
await p.reload();
try {
  await p.waitForSelector(".pagedjs_page", { timeout: 25000 });
  await p.waitForTimeout(2500);
} catch (e) { console.log("NO PAGES RENDERED"); }

console.log("pages:", await p.locator(".pagedjs_page").count());
console.log("pgInfo:", await p.locator("#pgInfo").textContent());
await p.screenshot({ path: "qa/ui.png" });

// open settings for a look
await p.click("#btnSettings");
await p.waitForTimeout(300);
await p.screenshot({ path: "qa/ui-settings.png" });
await p.click("#btnSettings");

// print-media PDF (same engine as user's save-as-pdf)
await p.emulateMedia({ media: "print" });
await p.pdf({ path: "qa/sample.pdf", preferCSSPageSize: true });
await p.emulateMedia({ media: "screen" });

// docx export
const dl = p.waitForEvent("download", { timeout: 30000 });
await p.click("#btnDocx");
const d = await dl;
await d.saveAs("qa/sample.docx");
console.log("docx saved:", d.suggestedFilename());

console.log("console errors:", errors.length ? errors.slice(0, 10) : "none");
await b.close();
