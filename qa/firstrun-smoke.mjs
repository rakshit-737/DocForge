/* firstrun-smoke.mjs — the first visit: the manual opens itself once,
   the favicon is present, and a fresh document carries no cover page. */
import { launch } from "./_browser.mjs";
import { DIST, settle } from "./_drive.mjs";

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1560, height: 980 } });
const page = await ctx.newPage();
let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) fail++; };

await page.goto(DIST);
await page.evaluate(() => localStorage.clear());   // a truly first visit
await page.reload();
await page.waitForSelector(".pagedjs_page", { timeout: 40000 });

// the manual pops once
await page.waitForSelector("#helpOverlay.open", { timeout: 5000 });
ok(true, "help & syntax opens by itself on first visit");
await page.keyboard.press("Escape");
ok(await page.evaluate(() => !document.getElementById("helpOverlay").classList.contains("open")), "Esc closes it");
await page.reload();
await page.waitForSelector(".pagedjs_page", { timeout: 40000 });
await page.waitForTimeout(1200);
ok(await page.evaluate(() => !document.getElementById("helpOverlay").classList.contains("open")), "it does not pop again on the next visit");

// favicon
ok(await page.evaluate(() => {
  const l = document.querySelector('link[rel="icon"]');
  return !!l && l.href.startsWith("data:image/svg+xml");
}), "inline SVG favicon present");

// cover off by default: the welcome document and a blank one carry no cover page
ok(await page.evaluate(() => !document.querySelector(".pagedjs_page .cover")), "welcome document renders without a cover page");
ok(await page.evaluate(() => !document.getElementById("tCover").checked), "cover toggle rests unchecked");
await page.click("#templateSelect");
await page.click('.tpl-item[data-id="assignment"]');
await page.click("#cfYes");
await settle(page, 60000);
ok(await page.evaluate(() => !!document.querySelector(".pagedjs_page .cover")), "templates that want a cover still get one");

const errs = page.__errors || [];
ok(errs.length === 0, "no page errors");
await browser.close();
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
