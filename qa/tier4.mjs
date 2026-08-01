/* Tier 4 editor-feature checks: outline, find/replace, paste cleanup, linter, chrome theme. */
import { launch } from "./_browser.mjs";
import * as drive from "./_drive.mjs";

const b = await launch();
const p = await drive.open(b);
let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); cond ? pass++ : fail++; };

/* seed a doc with headings + deliberate lint mistakes */
await drive.applyDoc(p, {
  settings: { title: "T4", cover: false },
  source: `# Alpha

Text one.

## Beta

More text with an undefined footnote[^ghost] here.

##### Too deep

| A | B |
| --- | --- |
| 1 | 2 | 3 |

:::note Unclosed
this callout never closes

# Gamma

Find me: needleword and needleword again.
`});

/* --- outline --- */
await p.click("#btnOutline");
await p.waitForTimeout(300);
const items = await p.locator("#outlinePanel .ol-item").allTextContents();
ok("outline lists headings", items.length >= 2 && items[0].includes("Alpha"));
await p.locator("#outlinePanel .ol-item").last().click();
await p.waitForTimeout(600);
const scrolled = await p.evaluate(() => document.querySelector("#previewScroll").scrollTop > 50);
ok("outline click scrolls preview", scrolled);

/* --- linter --- */
const badge = await p.locator("#lintBadge").textContent();
ok("lint badge shows warnings", /\d/.test(badge || ""));
await p.click("#lintBadge");
const lints = await p.locator("#lintPanel .lint-item").allTextContents();
ok("lint flags undefined footnote", lints.some(t => t.includes("ghost")));
ok("lint flags heading depth", lints.some(t => t.includes("level 5")));
ok("lint flags ragged table", lints.some(t => t.includes("cells")));
ok("lint flags unclosed callout", lints.some(t => t.includes("callout")));
await p.click("#lintBadge");

/* --- find & replace --- */
await p.keyboard.press("Control+f");
await p.fill("#findInput", "needleword");
const count = await p.locator("#findCount").textContent();
ok("find counts matches", count.includes("2"));
await p.fill("#replInput", "replacedword");
await p.click("#replAll");
await p.waitForTimeout(400);
const src = await p.inputValue("#editor");
ok("replace all works", !src.includes("needleword") && src.split("replacedword").length === 3);
await p.keyboard.press("Escape");

/* --- paste cleanup --- */
await p.evaluate(() => {
  const ed = document.getElementById("editor");
  ed.focus();
  ed.setSelectionRange(ed.value.length, ed.value.length);
  const dt = new DataTransfer();
  dt.setData("text/html", "<h2>Pasted Title</h2><p>Para with <b>bold</b> and <i>ital</i>.</p><ul><li>one</li><li>two</li></ul><table><tr><th>H1</th><th>H2</th></tr><tr><td>a</td><td>b</td></tr></table>");
  dt.setData("text/plain", "Pasted Title\nPara...");
  ed.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
});
await p.waitForTimeout(400);
const src2 = await p.inputValue("#editor");
ok("paste converts heading", src2.includes("## Pasted Title"));
ok("paste converts bold/italic", src2.includes("**bold**") && src2.includes("*ital*"));
ok("paste converts list", src2.includes("- one"));
ok("paste converts table", src2.includes("| H1 | H2 |"));

/* --- chrome theme --- */
const before = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
await p.click("#btnDark");
const after = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
ok("chrome theme toggles", before !== after);
const pageWhite = await p.evaluate(() => {
  const pg = document.querySelector(".pagedjs_page");
  return pg && getComputedStyle(pg).backgroundColor;
});
ok("document page stays white in light chrome", /255,\s*255,\s*255|rgb\(255/.test(pageWhite || ""));
await p.reload();
await p.waitForSelector(".pagedjs_page", { timeout: 40000 });
const persisted = await p.evaluate(() => document.documentElement.hasAttribute("data-light"));
ok("theme persists across reload", persisted);

const errors = p.__errors.filter(e => !/favicon/i.test(e));
ok("no console errors", errors.length === 0);
if (errors.length) console.log(errors.slice(0, 5));

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exitCode = fail ? 1 : 0;
