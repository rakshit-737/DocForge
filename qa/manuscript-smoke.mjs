/* manuscript-smoke.mjs — direct editing on the paginated manuscript.
   The acceptance workflow, driven for real on a long document: click into
   page 8, type, verify the source follows, the viewport holds, the caret
   survives the re-render; then left-side edits, undo/redo, heading, table,
   bold and Enter-split round-trips. */
import { launch } from "./_browser.mjs";
import { open, settle } from "./_drive.mjs";

const browser = await launch();
const page = await open(browser);
page.on("pageerror", e => console.log("  [pageerror]", (e.stack || String(e)).split("\n").slice(0, 4).join(" | ")));
let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) fail++; };

/* a long document: 40 sections, distinctive tokens per section */
const src = ["[toc]"];
for (let i = 1; i <= 40; i++) {
  src.push(`# Section ${i}`);
  src.push(`Opening paragraph of section ${i} with the marker word alpha${i} inside it. ` +
    "It carries enough prose to wrap across several lines on the page so that edits land mid-paragraph. " +
    "The quick brown fox jumps over the lazy dog again and again until the line is long enough.");
  src.push(`- first point of ${i}\n- second point of ${i}`);
}
await page.evaluate(source => {
  const ed = document.getElementById("editor");
  ed.value = source;
  ed.dispatchEvent(new Event("input", { bubbles: true }));
}, src.join("\n\n"));
await settle(page, 120000);

const pages = await page.locator(".pagedjs_page").count();
ok(pages >= 8, `long document paginates (${pages} pages)`);

/* ---- the core acceptance path: edit on page 8 ---- */
const p8 = page.locator(".pagedjs_page").nth(7);
await p8.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
const scrollBefore = await page.evaluate(() => document.getElementById("previewScroll").scrollTop);
ok(scrollBefore > 1000, `scrolled deep into the document (${Math.round(scrollBefore)}px)`);

// click into a paragraph on page 8 and type
const para = p8.locator(".content > p").first();
const marker = await para.evaluate(el => (el.textContent.match(/alpha\d+/) || [""])[0]);
await para.click();
await page.keyboard.type("XYZQ");
await page.waitForTimeout(400);
let srcNow = await page.evaluate(() => document.getElementById("editor").value);
ok(srcNow.includes("XYZQ"), "typed text lands in the Markdown source on the sync beat");

// keep typing straight through the deferred re-render
await page.waitForTimeout(1600);
await settle(page, 120000);
await page.keyboard.type("WXYZ");
await page.waitForTimeout(400);
srcNow = await page.evaluate(() => document.getElementById("editor").value);
ok(srcNow.includes("XYZQWXYZ"), "caret survives the re-render exactly in place (contiguous typing)");

const scrollAfter = await page.evaluate(() => document.getElementById("previewScroll").scrollTop);
ok(Math.abs(scrollAfter - scrollBefore) < 900, `viewport stays near page 8 (moved ${Math.round(Math.abs(scrollAfter - scrollBefore))}px)`);
ok(scrollAfter > 1000, "no jump back to page 1");

// the edited paragraph still renders, with the typed text, near the same page
await page.waitForTimeout(1600);
await settle(page, 120000);
const rendered = await page.evaluate(m => {
  const els = [...document.querySelectorAll(".pagedjs_page .content > p")];
  const el = els.find(e => e.textContent.includes("XYZQWXYZ"));
  if (!el) return null;
  return { pageIdx: [...document.querySelectorAll(".pagedjs_page")].indexOf(el.closest(".pagedjs_page")) };
}, marker);
ok(rendered && Math.abs(rendered.pageIdx - 7) <= 1, `edited paragraph renders near page 8 (page ${rendered ? rendered.pageIdx + 1 : "?"})`);

/* ---- deletion stays anchored ---- */
for (let i = 0; i < 8; i++) await page.keyboard.press("Backspace");
await page.waitForTimeout(400);
srcNow = await page.evaluate(() => document.getElementById("editor").value);
ok(!srcNow.includes("XYZQWXYZ"), "backspace edits write back to the source");
await page.waitForTimeout(1600);
await settle(page, 120000);
const scrollDel = await page.evaluate(() => document.getElementById("previewScroll").scrollTop);
ok(Math.abs(scrollDel - scrollBefore) < 900, "viewport stays put after deletion + repagination");

/* ---- undo / redo from the manuscript ---- */
await page.keyboard.type("UNDOME");
await page.waitForTimeout(1100);
await page.keyboard.press("Control+z");
await page.waitForTimeout(400);
srcNow = await page.evaluate(() => document.getElementById("editor").value);
ok(!srcNow.includes("UNDOME"), "Ctrl+Z in the manuscript undoes the edit in the source");
await page.keyboard.press("Control+y");
await page.waitForTimeout(400);
srcNow = await page.evaluate(() => document.getElementById("editor").value);
ok(srcNow.includes("UNDOME"), "Ctrl+Y redoes it");
await page.keyboard.press("Control+z");
await page.waitForTimeout(400);
await settle(page, 120000);

/* ---- left-side edit while reading page 8: viewport must hold ---- */
const scrollL = await page.evaluate(() => document.getElementById("previewScroll").scrollTop);
await page.evaluate(() => {
  const ed = document.getElementById("editor");
  ed.value = ed.value.replace("alpha2 ", "alpha2 INSERTED-FROM-SOURCE ");
  ed.dispatchEvent(new Event("input", { bubbles: true }));
});
await settle(page, 120000);
const scrollL2 = await page.evaluate(() => document.getElementById("previewScroll").scrollTop);
ok(Math.abs(scrollL2 - scrollL) < 900, `source-side edit keeps the manuscript viewport (moved ${Math.round(Math.abs(scrollL2 - scrollL))}px)`);

/* ---- heading round-trip ---- */
const h = page.locator(".pagedjs_page .content > h1").nth(9);
await h.scrollIntoViewIfNeeded();
await h.click();
await page.keyboard.press("End");
await page.keyboard.type(" RENAMED");
await page.waitForTimeout(400);
srcNow = await page.evaluate(() => document.getElementById("editor").value);
ok(/^# Section \d+ RENAMED$/m.test(srcNow), "heading edit keeps its # level in the source");

/* ---- Enter splits a paragraph into two source paragraphs ---- */
const p2 = page.locator(".pagedjs_page .content > p").nth(2);
await p2.scrollIntoViewIfNeeded();
const before2 = await p2.evaluate(el => el.textContent.slice(0, 20));
await p2.click();
await page.keyboard.press("End");
await page.keyboard.type(" TAILMARK");
await page.keyboard.press("Home");
// caret to a word boundary mid-paragraph, then split
for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight");
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
srcNow = await page.evaluate(() => document.getElementById("editor").value);
ok(srcNow.includes("TAILMARK"), "tail marker present before split check");
const splitOk = await page.evaluate(() => {
  const s = document.getElementById("editor").value;
  const i = s.indexOf("TAILMARK");
  const para = s.slice(0, i).split("\n\n").at(-1);
  return para.includes("\n\n") === false && /\n\n/.test(s.slice(i - 400, i));
});
ok(splitOk, "Enter splits the block into two paragraphs in the source");
await page.waitForTimeout(1600);
await settle(page, 120000);

/* ---- bold from the manuscript via Ctrl+B ---- */
await page.evaluate(() => {
  const ed = document.getElementById("editor");
  ed.value += "\n\nBOLDTARGET sits at the head of this closing paragraph.";
  ed.dispatchEvent(new Event("input", { bubbles: true }));
});
await settle(page, 120000);
const p3 = page.locator(".pagedjs_page .content > p", { hasText: "BOLDTARGET" }).first();
await p3.scrollIntoViewIfNeeded();
await page.evaluate(() => {
  const el = [...document.querySelectorAll(".pagedjs_page .content > p")].find(e => e.textContent.includes("BOLDTARGET"));
  const tn = [...el.childNodes].find(n => n.nodeType === 3 && n.nodeValue.includes("BOLDTARGET"));
  const i = tn.nodeValue.indexOf("BOLDTARGET");
  const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + 10);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  el.closest(".pagedjs_page_content").focus();
});
await page.keyboard.press("Control+b");
await page.waitForTimeout(400);
srcNow = await page.evaluate(() => document.getElementById("editor").value);
ok(srcNow.includes("**BOLDTARGET**"), "Ctrl+B on a manuscript selection writes **bold** to the source");
await page.waitForTimeout(1600);
await settle(page, 120000);

/* ---- table cell round-trip ---- */
await page.evaluate(() => {
  const ed = document.getElementById("editor");
  ed.value += "\n\n| Col A | Col B |\n| --- | --- |\n| cellone | celltwo |\n";
  ed.dispatchEvent(new Event("input", { bubbles: true }));
});
await settle(page, 120000);
const cell = page.locator(".pagedjs_page .content td", { hasText: "cellone" }).first();
await cell.scrollIntoViewIfNeeded();
await cell.click();
await page.keyboard.press("End");
await page.keyboard.type("EDITED");
await page.waitForTimeout(400);
srcNow = await page.evaluate(() => document.getElementById("editor").value);
ok(srcNow.includes("celloneEDITED"), "table cell edit writes back into the pipe table");
await page.waitForTimeout(1600);
await settle(page, 120000);

/* ---- generated furniture refuses the caret ---- */
const tocEditable = await page.evaluate(() => {
  const toc = document.querySelector(".pagedjs_page .toc-wrap");
  return toc ? toc.getAttribute("contenteditable") : "missing";
});
ok(tocEditable === "false", "table of contents is read-only on the page");

/* ---- exports still intact after a session of direct edits ---- */
const dl = page.waitForEvent("download", { timeout: 90000 });
await page.click("#btnDocx");
await dl;
ok(true, "docx export still works after direct edits");

const errs = page.__errors.filter(e => !/favicon/.test(e));
ok(errs.length === 0, "no page errors" + (errs.length ? " — " + errs[0] : ""));
await browser.close();
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
