/* run-styles-smoke.mjs — typeface, size, colour and highlight work from either pane.

   The regression this pins: bold, italic, underline and strike reach the manuscript
   through execCommand, which fires real beforeinput/input events. Typeface, size,
   colour and highlight have no execCommand behind them, so they acted on the source
   textarea — and with the selection in the manuscript the textarea had none. The mark
   landed at the caret as a stray `[text]{font="…"}` at the end of the document and the
   selected words never changed: "whatever font I change doesn't change on the right".

   Each control is therefore exercised from both panes, and the galley is checked for
   the face actually arriving — a source string alone would not have caught it. */
import { launch } from "./_browser.mjs";
import { open, settle } from "./_drive.mjs";

const browser = await launch();
const page = await open(browser);
let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) fail++; };
const source = () => page.evaluate(() => document.getElementById("editor").value.trim().replace(/\n/g, " ⏎ "));

async function setDoc(text) {
  await page.evaluate(t => {
    const ed = document.getElementById("editor");
    ed.value = t;
    ed.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
  await settle(page);
}

/** Select `needle` inside the rendered manuscript, the way a reader would drag over it. */
const selectInGalley = needle => page.evaluate(n => {
  const el = [...document.querySelectorAll(".pagedjs_page .content p")].find(e => e.textContent.includes(n));
  if (!el) return false;
  const node = [...el.childNodes].find(x => x.nodeType === 3 && x.textContent.includes(n));
  if (!node) return false;
  const i = node.textContent.indexOf(n);
  const r = document.createRange();
  r.setStart(node, i);
  r.setEnd(node, i + n.length);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  return true;
}, needle);

/** Select `needle` in the source textarea instead. */
const selectInSource = needle => page.evaluate(n => {
  const ed = document.getElementById("editor");
  const i = ed.value.indexOf(n);
  if (i < 0) return false;
  ed.focus();
  ed.setSelectionRange(i, i + n.length);
  return true;
}, needle);

const DOC = "Alpha bravo charlie delta echo foxtrot.\n";
const TARGET = "charlie delta";

/* ---- every control, from the manuscript ---- */
const fromGalley = [
  ["typeface", async () => page.selectOption("#tbFont", "Courier New"), /\[charlie delta\]\{font="Courier New"\}/],
  ["size", async () => page.selectOption("#tbSize", "16"), /\[charlie delta\]\{size=16\}/],
  ["text colour", async () => { await page.click("#tbFc"); await page.click('#fcGrid .pm-sw[data-c="#c00000"]'); }, /\[charlie delta\]\{color=C00000\}/i],
  ["highlight", async () => { await page.click("#tbHl"); await page.click('#hlGrid .pm-sw[data-k="green"]'); }, /=\{green\}charlie delta==/],
];
for (const [name, run, expect] of fromGalley) {
  await setDoc(DOC);
  ok(await selectInGalley(TARGET), `${name}: manuscript selection made`);
  await run();
  await settle(page);
  const s = await source();
  ok(expect.test(s), `${name}: styles the manuscript selection in place — ${s}`);
  ok(!/\[text\]|\[coloured text\]|highlighted text/.test(s), `${name}: no stray placeholder appended`);
}

/* ---- the galley must actually show it, not just the source ----
   Measure the ink, not the computed stack: `font-family` reports what was *asked*
   for, and a stack that never resolved reads identically to one that did — the same
   trap document.fonts.check fell into. Courier New against the proportional default
   moves the run's width by a third or more, so a real substitution is unmistakable
   and a silent no-op cannot pass. */
const inkOf = needle => page.evaluate(n => {
  const el = [...document.querySelectorAll(".pagedjs_page .content p")].find(e => e.textContent.includes(n));
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = null;
  while (walk.nextNode()) if (walk.currentNode.textContent.includes(n)) { node = walk.currentNode; break; }
  if (!node) return null;
  const i = node.textContent.indexOf(n);
  const r = document.createRange();
  r.setStart(node, i);
  r.setEnd(node, i + n.length);
  return Math.round(r.getBoundingClientRect().width * 100) / 100;
}, needle);

await setDoc(DOC);
const inkBefore = await inkOf(TARGET);
await selectInGalley(TARGET);
await page.selectOption("#tbFont", "Courier New");
await settle(page);
const inkAfter = await inkOf(TARGET);
const shown = await page.evaluate(() => {
  const s = document.querySelector(".pagedjs_page .dfspan[data-font]");
  return s && { text: s.textContent, family: getComputedStyle(s).fontFamily.split(",")[0] };
});
ok(shown && shown.text === TARGET && shown.family === '"Courier New"',
  `the galley asks for the new face — ${JSON.stringify(shown)}`);
ok(inkBefore && inkAfter && Math.abs(inkAfter - inkBefore) / inkBefore > 0.15,
  `the run is visibly reset, not merely restyled — ${inkBefore}px → ${inkAfter}px`);

/* the mark must survive a re-render unchanged, or it is not really in the source */
const settled = await source();
await page.evaluate(() => document.getElementById("editor").dispatchEvent(new Event("input", { bubbles: true })));
await settle(page);
ok((await source()) === settled, "the mark round-trips through a re-render unchanged");

/* ---- the source pane keeps its own path ---- */
await setDoc(DOC);
ok(await selectInSource("charlie"), "source selection made");
await page.selectOption("#tbFont", "Georgia");
await settle(page);
ok((await source()).includes('[charlie]{font="Georgia"}'), "a source selection still wraps the source");

/* ---- no selection anywhere: the placeholder, as before ---- */
await setDoc(DOC);
await page.evaluate(() => {
  const ed = document.getElementById("editor");
  ed.focus();
  ed.setSelectionRange(ed.value.length, ed.value.length);
});
await page.selectOption("#tbFont", "Verdana");
await settle(page);
ok((await source()).includes('[text]{font="Verdana"}'), "no selection still inserts the placeholder");

/* ---- a selection straddling an element boundary: surroundContents throws ---- */
await setDoc("Alpha **bravo charlie** delta echo.\n");
await page.evaluate(() => {
  const el = [...document.querySelectorAll(".pagedjs_page .content p")].find(e => e.textContent.includes("bravo"));
  const strong = el.querySelector("strong");
  const tail = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.includes("delta"));
  const r = document.createRange();
  r.setStart(strong.firstChild, 6);
  r.setEnd(tail, tail.textContent.indexOf("delta") + 5);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
});
await page.selectOption("#tbFont", "Verdana");
await settle(page);
const straddle = await source();
ok(/font="Verdana"/.test(straddle) && !/\[text\]/.test(straddle),
  `a selection straddling a bold run is styled in place — ${straddle}`);

const errs = page.__errors.filter(e => !/favicon/.test(e));
ok(errs.length === 0, "no page errors" + (errs.length ? " — " + errs[0] : ""));

await browser.close();
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
process.exit(fail ? 1 : 0);
