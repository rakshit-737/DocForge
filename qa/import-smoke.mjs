/* Import & ribbon smoke: new inline marks render, the .docx round-trips back in
   through mammoth, and a printed PDF comes back as editable Markdown. */
import { launch } from "./_browser.mjs";
import * as drive from "./_drive.mjs";
import { mkdtempSync } from "node:fs";
import { statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "df-import-"));
const b = await launch();
const p = await drive.open(b);
let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); cond ? pass++ : fail++; };

await drive.applyDoc(p, {
  settings: { title: "Ribbon", cover: false, baseSize: "12", lineSpacing: "1.5" },
  source: `# Ribbon Torture

Plain, **bold**, *italic*, ++underlined++, ~~struck~~, ==highlighted==, =={green}green light==.

Water is H~2~O and E = mc^2^ squared.

[Crimson words]{color=#c00000} and [shaded]{bg=#ffe28a} and [big Georgia]{size=16 font="Georgia"} and [small caps]{sc}.

:::center
This paragraph is centred.
:::

:::right
And this one sits right.
:::
`});

/* settings selects exist & took the values */
ok("base size select applied", await p.evaluate(() => document.getElementById("sBaseSize").value === "12"));
ok("line spacing select applied", await p.evaluate(() => document.getElementById("sLineSpacing").value === "1.5"));

/* preview DOM carries every mark */
const q = sel => p.evaluate(s => !!document.querySelector(".pagedjs_page " + s), sel);
ok("underline renders", await q("u"));
ok("strike renders", await q("del, s"));
ok("highlight renders", await q('mark[data-hl="yellow"]'));
ok("named highlight renders", await q('mark[data-hl="green"]'));
ok("subscript renders", await q("sub"));
ok("superscript renders", await q("sup"));
ok("colour span renders", await q('span.dfspan[data-color="c00000"]'));
ok("bg span renders", await q('span.dfspan[data-bg="ffe28a"]'));
ok("font+size span renders", await q('span.dfspan[data-font="Georgia"][data-size="16"]'));
ok("small caps span renders", await q('span.dfspan[data-sc="1"]'));
ok("center block renders", await q("div.align-center"));
ok("right block renders", await q("div.align-right"));
ok("doc-wide size/leading applied", await p.evaluate(() => {
  const el = document.querySelector(".pagedjs_page .doc .content p");
  if (!el) return false;
  const cs = getComputedStyle(el);
  // 12pt = 16px; line-height 1.77 × 16px ≈ 28.3px
  return Math.abs(parseFloat(cs.fontSize) - 16) < 0.5 && Math.abs(parseFloat(cs.lineHeight) - 28.3) < 1.2;
}));

/* Word font catalog present in pickers */
ok("word fonts listed in settings picker", await p.evaluate(() =>
  [...document.querySelectorAll("#sFontBody option")].some(o => o.value === "sys:Calibri")));
ok("toolbar typeface box populated", await p.evaluate(() =>
  [...document.querySelectorAll("#tbFont option")].some(o => o.value === "Times New Roman")));

/* ---- .docx export → re-import round trip ---- */
const docxPath = join(dir, "ribbon.docx");
await drive.exportDocx(p, docxPath);
ok("docx export succeeds", statSync(docxPath).size > 15000);

await p.setInputFiles("#projInput", docxPath);
await p.waitForSelector("#confirmOverlay.open", { timeout: 10000 });
await p.click("#cfYes");
await p.waitForFunction(() => document.getElementById("editor").value.includes("Ribbon Torture"), null, { timeout: 60000 });
await drive.settle(p);
const md = await p.inputValue("#editor");
ok("docx import keeps heading", md.includes("# Ribbon Torture"));
ok("docx import keeps bold", md.includes("**bold**"));
ok("docx import keeps underline", md.includes("++underlined++"));
ok("docx import keeps strike", md.includes("~~struck~~"));
ok("docx import keeps highlight", md.includes("==highlighted=="));
ok("docx import keeps sub/sup", md.includes("~2~") && md.includes("^2^"));

/* ---- PDF print → re-import ---- */
await drive.applyDoc(p, {
  settings: { title: "PDF Round", cover: false },
  source: `# Quartz Report

The zephyr vaulted quickly over the jasmine hedge while the committee reviewed the quarterly figures in detail, and the reviewers agreed the document was ready.

- alpha item
- beta item

1. first step
2. second step
`});
const pdfPath = join(dir, "round.pdf");
await drive.printPdf(p, pdfPath);
ok("pdf printed", statSync(pdfPath).size > 5000);

await p.setInputFiles("#projInput", pdfPath);
await p.waitForSelector("#pdfChoiceOverlay.open", { timeout: 10000 });
await p.click("#pcConvert");
await p.waitForSelector("#confirmOverlay.open", { timeout: 10000 });
await p.click("#cfYes");
await p.waitForFunction(() => document.getElementById("editor").value.includes("Quartz"), null, { timeout: 120000 });
await drive.settle(p);
const md2 = await p.inputValue("#editor");
ok("pdf import found heading", /^# .*Quartz Report/m.test(md2));
ok("pdf import found prose", md2.includes("zephyr") && md2.includes("jasmine"));
ok("pdf import rebuilt bullets", /^- alpha item/m.test(md2));
ok("pdf import rebuilt numbers", /^1\. first step/m.test(md2));

const errs = (p.__errors || []).filter(e => !/favicon/i.test(e));
ok("no page errors", errs.length === 0);
if (errs.length) console.log(errs.join("\n"));

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
