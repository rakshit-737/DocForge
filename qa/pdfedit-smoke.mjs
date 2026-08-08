/* PDF in-place editing smoke: open a printed PDF for editing, lay text/whiteout/
   highlight edits over page 1, export, and prove the result still contains the
   ORIGINAL text (format preserved) plus the new overlay text. */
import { launch } from "./_browser.mjs";
import * as drive from "./_drive.mjs";
import { mkdtempSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "df-pdfedit-"));
const b = await launch();
const p = await drive.open(b);
let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); cond ? pass++ : fail++; };

await drive.applyDoc(p, {
  settings: { title: "Inplace Source", cover: false },
  source: `# Original Heading Kept

The original xanthium paragraph must survive the edit untouched.
`});
const pdfPath = join(dir, "orig.pdf");
await drive.printPdf(p, pdfPath);

/* open for in-place editing through the real UI */
await p.setInputFiles("#projInput", pdfPath);
await p.waitForSelector("#pdfChoiceOverlay.open", { timeout: 10000 });
await p.click("#pcEdit");
await p.waitForFunction(() => document.body.classList.contains("pdf-mode"), null, { timeout: 60000 });
await p.waitForSelector(".pe-page canvas", { timeout: 60000 });
ok("editor opens with rendered pages", await p.evaluate(() =>
  document.querySelectorAll(".pe-page canvas").length >= 1 &&
  document.querySelector(".pe-page canvas").width > 100));
ok("page count shown", /page/i.test(await p.textContent("#pePages")));

/* lay edits programmatically (the pointer paths are covered by hand-testing;
   addEdit exercises the same model + layer sync) */
await p.evaluate(() => {
  PdfEditor.addEdit(0, { type: "whiteout", x: 60, y: 60, w: 200, h: 20 });
  PdfEditor.addEdit(0, { type: "highlight", x: 60, y: 120, w: 220, h: 16 });
  PdfEditor.addEdit(0, { type: "text", x: 62, y: 62, w: 300, text: "Replacement zebrawood line", size: 12, color: "#c00000", font: "helvB" });
});
ok("edits registered", await p.evaluate(() => PdfEditor.hasEdits() && PdfEditor.getEdits().get(0).length === 3));
ok("edit layer renders", await p.evaluate(() =>
  !!document.querySelector(".pe-layer .pe-white") &&
  !!document.querySelector(".pe-layer .pe-hl") &&
  !!document.querySelector(".pe-layer .pe-text")));

/* ---- rewrite a printed line in place (double-click path) ---- */
const lineEdit = await p.evaluate(async () => {
  const lines = await PdfEditor.getTextLines(0);
  const hit = lines.find(L => L.text.includes("xanthium"));
  if (!hit) return { found: false };
  const ed = await PdfEditor.editLineAt(0, hit.x + 4, hit.yTop + 4);
  if (!ed) return { found: true, edited: false };
  // every character below already exists in the page's embedded subset,
  // so the rewrite must keep the ORIGINAL font, not a lookalike
  ed.text = "The revised xanthium paragraph continues to read as printed.";
  return {
    found: true, edited: true,
    prefill: hit.text.includes("xanthium"),
    sameX: Math.abs(ed.x - hit.x) < 0.5,
    covered: !!ed.cover,
    sizeMatch: Math.abs(ed.size - hit.size) < 0.6,
    hasOrig: !!(ed.orig && ed.useOrig !== false),
  };
});
ok("text lines extracted", lineEdit.found);
ok("double-click creates prefilled edit", lineEdit.edited && lineEdit.prefill);
ok("edit sits at the original position/size", lineEdit.sameX && lineEdit.sizeMatch);
ok("original line auto-covered", lineEdit.covered);
ok("edit carries the original font", lineEdit.hasOrig);

/* export and inspect the produced PDF */
const bytes = await p.evaluate(async () => {
  const { blob } = await PdfEditor.exportPdf();
  return [...new Uint8Array(await blob.arrayBuffer())];
});
const outPath = join(dir, "edited.pdf");
writeFileSync(outPath, Buffer.from(bytes));
ok("edited pdf produced", statSync(outPath).size > 5000);

const inspect = await p.evaluate(async (arr) => {
  const pdfjs = await PdfImport.ensureLib();
  const task = pdfjs.getDocument({ data: new Uint8Array(arr).buffer });
  const doc = await task.promise;
  let t = "", rewrittenFace = null;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    t += tc.items.map(x => x.str).join(" ") + "\n";
    const hit = tc.items.find(x => x.str.includes("revised"));
    if (hit && rewrittenFace === null) {
      await page.getOperatorList(); // fonts land in commonObjs only after ops run
      try { rewrittenFace = page.commonObjs.get(hit.fontName).name; } catch { rewrittenFace = "?"; }
    }
  }
  await task.destroy();
  return { t, rewrittenFace };
}, bytes);
const text = inspect.t;
ok("untouched text preserved", text.includes("Original Heading Kept"));
ok("overlay text present", text.includes("Replacement zebrawood line"));
ok("rewritten line present", text.includes("revised xanthium"));
ok("rewritten line keeps the ORIGINAL embedded font",
  /DocForgeSans/.test(inspect.rewrittenFace || "") && !/Helvetica/i.test(inspect.rewrittenFace || ""));

/* leaving the editor restores the studio */
p.once("dialog", d => d.accept());
await p.click("#peClose");
await p.waitForSelector("#confirmOverlay.open", { timeout: 5000 }).catch(() => null);
if (await p.evaluate(() => document.querySelector("#confirmOverlay").classList.contains("open"))) await p.click("#cfYes");
await p.waitForFunction(() => !document.body.classList.contains("pdf-mode"), null, { timeout: 10000 });
ok("back to studio", await p.evaluate(() => !document.body.classList.contains("pdf-mode")));
ok("studio content intact", (await p.inputValue("#editor")).includes("Original Heading Kept"));

const errs = (p.__errors || []).filter(e => !/favicon/i.test(e));
ok("no page errors", errs.length === 0);
if (errs.length) console.log(errs.join("\n"));

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
