import { chromium } from "playwright-core";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import zlib from "node:zlib";

// tiny valid PNG (2x1 blue) then upscale via canvas in-page? Use a generated 400x300 PNG via zlib raw — simpler: draw in page and download? We'll generate in-page with canvas and set the file via DataTransfer instead.
const dist = resolve("dist/DocForge.html");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 1560, height: 980 }, acceptDownloads: true });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", e => errors.push("PAGEERROR: " + String(e).slice(0, 200)));
p.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });

await p.goto("file://" + dist);
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForSelector(".pagedjs_page", { timeout: 25000 });

async function applyTemplate(id) {
  await p.selectOption("#templateSelect", id);
  await p.waitForSelector("#confirmOverlay.open");
  await p.click("#cfYes");
  await p.waitForTimeout(2600);
  await p.waitForFunction(() => !document.querySelector("#busy.on"), null, { timeout: 25000 });
}

/* ---- assignment template: academic, numbered, h1break, justify ---- */
await applyTemplate("assignment");
console.log("assignment pages:", await p.locator(".pagedjs_page").count());
await p.emulateMedia({ media: "print" });
await p.pdf({ path: "qa/assignment.pdf", preferCSSPageSize: true });
await p.emulateMedia({ media: "screen" });

/* ---- attach an image to the first placeholder ---- */
const genPng = await p.evaluate(() => {
  const cv = document.createElement("canvas");
  cv.width = 900; cv.height = 560;
  const g = cv.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 900, 560);
  gr.addColorStop(0, "#3b82f6"); gr.addColorStop(1, "#9333ea");
  g.fillStyle = gr; g.fillRect(0, 0, 900, 560);
  g.fillStyle = "#fff"; g.font = "bold 42px sans-serif";
  g.fillText("TEST SCREENSHOT", 240, 290);
  return cv.toDataURL("image/png");
});
writeFileSync("qa/testshot.png", Buffer.from(genPng.split(",")[1], "base64"));

const shot = p.locator("figure.shot").first();
await shot.scrollIntoViewIfNeeded();
await shot.click();
await p.waitForSelector("#imgMenu", { state: "visible" });
const chooser = p.waitForEvent("filechooser");
await p.click("#imAttach");
await (await chooser).setFiles("qa/testshot.png");
await p.waitForTimeout(2800);
const attached = await p.evaluate(() => !!document.querySelector("figure.shot img"));
console.log("image attached in preview:", attached);
const srcHasKey = await p.evaluate(() => /\| img:i[a-z0-9]+\]/.test(document.querySelector("#editor").value));
console.log("source rewritten with img key:", srcHasKey);

/* ---- autosave across reload ---- */
await p.waitForTimeout(1600);
await p.reload();
await p.waitForSelector(".pagedjs_page", { timeout: 25000 });
await p.waitForTimeout(1500);
const restored = await p.evaluate(() => ({
  hasImg: !!document.querySelector("figure.shot img"),
  title: document.querySelector("#sTitle").value,
}));
console.log("after reload:", JSON.stringify(restored));
await p.emulateMedia({ media: "print" });
await p.pdf({ path: "qa/assignment2.pdf", preferCSSPageSize: true });
await p.emulateMedia({ media: "screen" });

/* ---- assignment word export ---- */
const dl = p.waitForEvent("download", { timeout: 30000 });
await p.click("#btnDocx");
await (await dl).saveAs("qa/assignment.docx");
console.log("assignment.docx saved");

/* ---- letter template ---- */
await applyTemplate("letter");
await p.emulateMedia({ media: "print" });
await p.pdf({ path: "qa/letter.pdf", preferCSSPageSize: true });
await p.emulateMedia({ media: "screen" });
await p.screenshot({ path: "qa/ui-letter.png" });

console.log("errors:", errors.length ? errors.slice(0, 8) : "none");
await b.close();
