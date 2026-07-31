/* Shared helpers for driving the built DocForge file from Playwright. */
import { resolve } from "node:path";

export const DIST = "file:///" + resolve("dist/DocForge.html").replace(/\\/g, "/");

const FIELDS = { title: "sTitle", subtitle: "sSubtitle", author: "sAuthor", kicker: "sKicker", metaExtra: "sMetaExtra", date: "sDate" };
const SELECTS = { theme: "sTheme", page: "sPage", margins: "sMargins" };
const TOGGLES = { cover: "tCover", header: "tHeader", pageNums: "tPageNums", numbered: "tNumbered", justify: "tJustify", h1break: "tH1break" };

export async function open(browser, { viewport = { width: 1560, height: 980 } } = {}) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
  page.__errors = errors;
  await page.goto(DIST);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".pagedjs_page", { timeout: 40000 });
  return page;
}

/** Push a source + settings into the live app through its real UI controls. */
export async function applyDoc(page, { source, settings = {} }) {
  await page.evaluate(
    ({ source, settings, FIELDS, SELECTS, TOGGLES }) => {
      const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
      for (const [k, id] of Object.entries(FIELDS)) {
        if (settings[k] == null) continue;
        const el = document.getElementById(id);
        el.value = settings[k];
        fire(el, "input");
      }
      for (const [k, id] of Object.entries(SELECTS)) {
        if (settings[k] == null) continue;
        const el = document.getElementById(id);
        el.value = settings[k];
        fire(el, "change");
      }
      for (const [k, id] of Object.entries(TOGGLES)) {
        if (settings[k] == null) continue;
        const el = document.getElementById(id);
        el.checked = !!settings[k];
        fire(el, "change");
      }
      if (settings.accent) {
        const el = document.getElementById("cAccent");
        el.value = settings.accent;
        fire(el, "input");
      }
      if (source != null) {
        const ed = document.getElementById("editor");
        ed.value = source;
        fire(ed, "input");
      }
    },
    { source, settings, FIELDS, SELECTS, TOGGLES }
  );
  await settle(page);
}

export async function settle(page, timeout = 60000) {
  await page.waitForTimeout(700);
  await page.waitForFunction(() => !document.querySelector("#busy.on"), null, { timeout });
  await page.waitForTimeout(400);
}

export async function pageCount(page) {
  return page.locator(".pagedjs_page").count();
}

export async function printPdf(page, path) {
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path, preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: "screen" });
}

export async function exportDocx(page, path) {
  const dl = page.waitForEvent("download", { timeout: 60000 });
  await page.click("#btnDocx");
  await (await dl).saveAs(path);
  return path;
}
