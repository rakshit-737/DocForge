/* cmdk-smoke.mjs — the command palette, driven for real:
   open with Ctrl+K, filter, arrow-walk, run commands, close with Esc. */
import { launch } from "./_browser.mjs";
import { open, settle } from "./_drive.mjs";

const browser = await launch();
const page = await open(browser);
let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) fail++; };

// open
await page.keyboard.press("Control+k");
await page.waitForSelector("#cmdkOverlay.open", { timeout: 5000 });
ok(true, "Ctrl+K opens the palette");
ok(await page.evaluate(() => document.activeElement.id === "cmdkInput"), "query line takes focus");
const total = await page.locator(".ck-item").count();
ok(total >= 25, `full command list renders (${total} commands)`);

// filter
await page.fill("#cmdkInput", "equation");
const filtered = await page.locator(".ck-item").count();
ok(filtered >= 1 && filtered < total, `filter narrows the list (${filtered})`);
ok(await page.evaluate(() => document.querySelector('.ck-item[aria-selected="true"]') !== null), "a selection exists");

// run: insert equation must land in the editor
await page.keyboard.press("Enter");
await settle(page);
ok(await page.evaluate(() => document.getElementById("editor").value.includes("$$")), "Enter runs the command (equation inserted)");
ok(await page.evaluate(() => !document.getElementById("cmdkOverlay").classList.contains("open")), "palette closes after running");

// arrows + Esc
await page.keyboard.press("Control+k");
await page.waitForSelector("#cmdkOverlay.open");
await page.keyboard.press("ArrowDown");
await page.keyboard.press("ArrowDown");
const selIdx = await page.evaluate(() => +document.querySelector('.ck-item[aria-selected="true"]').dataset.i);
ok(selIdx === 2, `arrow keys move the selection (at ${selIdx})`);
await page.keyboard.press("Escape");
ok(await page.evaluate(() => !document.getElementById("cmdkOverlay").classList.contains("open")), "Esc closes the palette");
ok(await page.evaluate(() => document.activeElement.id !== "cmdkInput"), "focus leaves the palette on close");

// a template command exists and asks before replacing
await page.keyboard.press("Control+k");
await page.waitForSelector("#cmdkOverlay.open");
await page.fill("#cmdkInput", "assignment");
await page.keyboard.press("Enter");
await page.waitForSelector("#confirmOverlay.open", { timeout: 5000 });
ok(true, "template command routes through the confirm dialog");
await page.click("#cfNo");

// Enter on an empty result keeps the palette and the query
await page.keyboard.press("Control+k");
await page.waitForSelector("#cmdkOverlay.open");
await page.fill("#cmdkInput", "zzz-no-such");
await page.keyboard.press("Enter");
ok(await page.evaluate(() => document.getElementById("cmdkOverlay").classList.contains("open")), "Enter on no-match keeps the palette open");
ok(await page.evaluate(() => document.getElementById("cmdkInput").value === "zzz-no-such"), "the query survives");
ok(await page.evaluate(() => !document.getElementById("cmdkInput").hasAttribute("aria-activedescendant")), "no dangling aria-activedescendant on empty results");
await page.keyboard.press("Escape");

// palette refuses to open while another dialog is up
await page.keyboard.press("Control+/");
await page.waitForSelector("#keysOverlay.open");
await page.keyboard.press("Control+k");
ok(await page.evaluate(() => !document.getElementById("cmdkOverlay").classList.contains("open")), "palette refuses to open under an open dialog");
await page.keyboard.press("Escape");

// insert footnote: marker at the caret, definition at the end, sentence intact
await page.evaluate(() => {
  const ed = document.getElementById("editor");
  ed.value = "Hello world";
  ed.dispatchEvent(new Event("input", { bubbles: true }));
  ed.focus(); ed.setSelectionRange(8, 8);
});
await page.keyboard.press("Control+k");
await page.waitForSelector("#cmdkOverlay.open");
await page.fill("#cmdkInput", "footnote");
await page.keyboard.press("Enter");
await settle(page);
const fnSrc = await page.evaluate(() => document.getElementById("editor").value);
ok(/^Hello wo\[\^1\]rld/.test(fnSrc), "footnote marker lands at the caret without splitting the sentence");
ok(/\n\[\^1\]: Footnote text\n?$/.test(fnSrc), "footnote definition lands at the end of the document");

// palette stays out of the way on the PDF bench
ok(await page.evaluate(() => {
  document.body.classList.add("pdf-mode");
  const ev = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true });
  document.dispatchEvent(ev);
  const open = document.getElementById("cmdkOverlay").classList.contains("open");
  document.body.classList.remove("pdf-mode");
  return !open;
}), "palette refuses to open in PDF-edit mode");

const errs = page.__errors.filter(e => !/favicon/.test(e));
ok(errs.length === 0, "no page errors" + (errs.length ? " — " + errs[0] : ""));
await browser.close();
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
