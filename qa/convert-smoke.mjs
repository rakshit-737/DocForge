/* convert-smoke.mjs — the MarkItDown-style importers, driven through the real
   Open input: each fixture in qa/fixtures/ goes in, the produced Markdown is
   asserted. Fixtures: sample.xlsx / sample.pptx were saved by real Excel and
   PowerPoint; sample.epub is a minimal hand-built package. */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { launch } from "./_browser.mjs";
import { open, settle } from "./_drive.mjs";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const browser = await launch();
const page = await open(browser);
let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) fail++; };

async function importFixture(name, { confirm = true } = {}) {
  await page.setInputFiles("#projInput", join(FIX, name));
  if (confirm) { await page.waitForSelector("#confirmOverlay.open", { timeout: 10000 }); await page.click("#cfYes"); }
  await settle(page);
  return page.evaluate(() => document.getElementById("editor").value);
}

let md = await importFixture("sample.csv");
ok(md.includes("| Name | Score | Comment |"), "csv: header row");
ok(md.includes('Rao, A.') && md.includes('Said "fine"'), "csv: quoted fields survive");

md = await importFixture("sample.xlsx");
ok(md.includes("## Results") && md.includes("## Notes"), "xlsx: both sheets as sections");
ok(md.includes("| Test | Expected | Observed |"), "xlsx: header row");
ok(md.includes("Case, quoted\\|pipe"), "xlsx: pipe escaped in cell");
ok(md.includes("All good"), "xlsx: second sheet content");

md = await importFixture("sample.pptx");
ok(md.includes("# Quarterly Review"), "pptx: title slide heading");
ok(md.includes("# Highlights"), "pptx: second slide heading");
ok(md.includes("- Revenue up") && md.includes("- Churn down"), "pptx: body bullets");
ok(md.includes(":::note Speaker notes") && md.includes("headline win"), "pptx: speaker notes callout");

md = await importFixture("sample.epub");
ok(md.includes("# Chapter One") && md.includes("# Chapter Two"), "epub: chapters in spine order");
ok(md.indexOf("Chapter One") < md.indexOf("Chapter Two"), "epub: order correct");
ok(md.includes("[pagebreak]"), "epub: chapter breaks");

md = await importFixture("sample.html");
ok(md.includes("# Imported Page") && md.includes("**bold**"), "html: headings + inline styles");
ok(md.includes("- alpha"), "html: lists");

md = await importFixture("sample.ipynb");
ok(md.includes("# Analysis"), "ipynb: markdown cell");
ok(md.includes("```python") && md.includes("print(math.pi)"), "ipynb: fenced code cell");

// the converter hand-back: import a workbook, download it as .md
await importFixture("sample.xlsx");
const dl = page.waitForEvent("download", { timeout: 30000 });
await page.click("#btnSaveMd");
const mdPath = await (await dl).path();
const mdText = (await import("node:fs")).readFileSync(mdPath, "utf8");
ok(mdText.includes("## Results") && mdText.includes("| Test | Expected | Observed |"),
  "Export Markdown returns the converted document as a structured .md file");

// each import must render pages, not just fill the editor
const pages = await page.locator(".pagedjs_page").count();
ok(pages > 0, `renders after import (${pages} pages)`);
const errs = page.__errors.filter(e => !/favicon/.test(e));
ok(errs.length === 0, "no page errors" + (errs.length ? " — " + errs[0] : ""));

await browser.close();
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
