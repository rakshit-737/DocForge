/* font-smoke.mjs — the typeface pickers tell the truth about what this device has.

   The regression this pins: availability used to be asked of `document.fonts.check()`,
   which only knows the @font-face rules the document declared and answers `true` for
   every other name — so all ~200 Word faces claimed to be present, and picking one the
   machine lacked silently set the preview and the printed PDF in a fallback while the
   .docx stayed correct. The assertions below are machine-independent: an embedded face
   is always present, an invented one never is, whatever fonts the runner has. */
import { launch } from "./_browser.mjs";
import { open, applyDoc, settle } from "./_drive.mjs";

const ABSENT = "Zzz Not A Real Family 12345";
const browser = await launch();
const page = await open(browser);
let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) fail++; };

/* What the writer can actually see: an empty run hides the badge, and the panel keeps
   its last markup behind `hidden`, so read the badge first. */
const lintTexts = () => page.evaluate(() =>
  document.getElementById("lintBadge").hidden
    ? []
    : [...document.querySelectorAll(".lint-item")].map(e => e.textContent));

// The API the old check was built on cannot answer the question at all.
ok(await page.evaluate(f => document.fonts.check(`12px "${f}"`), ABSENT),
  "document.fonts.check() claims an invented family is available (why measurement is needed)");

// --- span faces, through the linter ---
await applyDoc(page, { source: `A specimen set in [an embedded face]{font="DocForge Serif"}.` });
ok(!(await lintTexts()).some(t => /not installed/.test(t)), "an embedded face raises no warning");

await applyDoc(page, { source: `A specimen set in [an invented face]{font="${ABSENT}"}.` });
const spanWarn = await lintTexts();
ok(spanWarn.some(t => t.includes(ABSENT) && /not installed on this device/.test(t)),
  "a font= span naming an absent family raises a warning");
ok(spanWarn.some(t => /Word file still names/.test(t)),
  "the warning says the .docx is still correct");

// --- document-wide faces, through Settings ---
await applyDoc(page, { source: "Body text only." });
ok((await lintTexts()).length === 0, "clean document, no warnings");

await page.evaluate(f => {
  const sel = document.getElementById("sFontBody");
  const o = document.createElement("option");
  o.value = "sys:" + f;
  o.textContent = f;
  sel.appendChild(o);
  sel.value = "sys:" + f;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}, ABSENT);
await settle(page);
const bodyWarn = await lintTexts();
ok(bodyWarn.some(t => t.includes(ABSENT) && /body typeface/.test(t)),
  "an absent body typeface raises a warning naming the setting");

// …and the document still renders in it, falling back rather than failing
ok(await page.evaluate(f => {
  const p = document.querySelector(".pagedjs_page .content p");
  return !!p && getComputedStyle(p).fontFamily.includes(f);
}, ABSENT), "the absent family is still requested in the preview stack (fallback, not failure)");

// --- the picker marks what it cannot render ---
const marks = await page.evaluate(() => {
  const opts = [...document.querySelectorAll("#sFontHead option")];
  return {
    total: opts.length,
    embedded: opts.filter(o => /^(sans|serif|inter|mont|garamond|crimson)$/.test(o.value)).length,
    embeddedMarked: opts.filter(o => /^(sans|serif|inter|mont|garamond|crimson)$/.test(o.value) && / not on this device/.test(o.textContent)).length,
  };
});
ok(marks.total > 150, `the whole Word census is offered (${marks.total} options)`);
ok(marks.embedded === 6, "six embedded faces are offered");
ok(marks.embeddedMarked === 0, "no embedded face is ever marked missing — they travel in the file");

console.log(fail ? `\n${fail} failure(s)` : "\nall font checks passed");
await browser.close();
process.exit(fail ? 1 : 0);
