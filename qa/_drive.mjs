/* Shared helpers for driving the built DocForge file from Playwright. */
import { resolve } from "node:path";

export const DIST = "file:///" + resolve("dist/DocForge.html").replace(/\\/g, "/");

/* Every setting the drawer can express, by the id of the control that holds it.
   A case whose settings are missing from these maps renders the DEFAULTS and
   silently proves nothing — which is exactly what happened to the running-head
   and watermark cases until the forever edition grew their controls. */
const FIELDS = {
  title: "sTitle", subtitle: "sSubtitle", author: "sAuthor", kicker: "sKicker",
  metaExtra: "sMetaExtra", date: "sDate",
  headerLeft: "sHeaderLeft", headerRight: "sHeaderRight",
  footerLeft: "sFooterLeft", footerRight: "sFooterRight",
  watermark: "sWatermark",
  /* the picker writes the data URL into this hidden field; the harness writes
     it straight in, which is the same road the setting takes either way */
  letterhead: "sLetterhead",
};
const SELECTS = { theme: "sTheme", page: "sPage", orientation: "sOrientation", margins: "sMargins", citeStyle: "sCiteStyle", borderStyle: "sBorderStyle", borderWeight: "sBorderWeight", borderColor: "sBorderColor", fontHead: "sFontHead", fontBody: "sFontBody", baseSize: "sBaseSize", lineSpacing: "sLineSpacing", letterheadSize: "sLetterheadSize" };
const TOGGLES = { cover: "tCover", header: "tHeader", pageNums: "tPageNums", numbered: "tNumbered", justify: "tJustify", h1break: "tH1break", hardWrap: "tHardWrap" };

export async function open(browser, { viewport = { width: 1560, height: 980 } } = {}) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
  page.__errors = errors;
  await page.goto(DIST);
  // fresh state, minus the one-time first-run manual (tested by firstrun-smoke)
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("docforge.helped", "1"); });
  await page.reload();
  await page.waitForSelector(".pagedjs_page", { timeout: 40000 });
  return page;
}

/** Push a source + settings into the live app through its real UI controls. */
export async function applyDoc(page, { source, settings = {} }) {
  await page.evaluate(
    ({ source, settings, FIELDS, SELECTS, TOGGLES }) => {
      const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
      /* A control this build has never heard of is skipped, not thrown over:
         the golden BASELINE is the v1-classic tag, which predates every
         setting added since — the cases that use them are `postBaseline` for
         exactly that reason, and the baseline side captures them with the
         defaults it does understand. Throwing here failed the case instead,
         and each failure cost the runner two 120-second retries. */
      const missing = [];
      for (const [k, id] of Object.entries(FIELDS)) {
        if (settings[k] == null) continue;
        const el = document.getElementById(id);
        if (!el) {
          missing.push(id);
          continue;
        }
        el.value = settings[k];
        fire(el, "input");
      }
      for (const [k, id] of Object.entries(SELECTS)) {
        if (settings[k] == null) continue;
        const el = document.getElementById(id);
        if (!el) {
          missing.push(id);
          continue;
        }
        /* A <select> silently keeps its old value when handed an option it
           does not have (an older build's citeStyle, say) — say so rather
           than let the case look as though it set something. */
        el.value = settings[k];
        if (el.value !== String(settings[k])) missing.push(`${id}=${settings[k]}`);
        fire(el, "change");
      }
      for (const [k, id] of Object.entries(TOGGLES)) {
        if (settings[k] == null) continue;
        const el = document.getElementById(id);
        if (!el) {
          missing.push(id);
          continue;
        }
        el.checked = !!settings[k];
        fire(el, "change");
      }
      if (missing.length) window.__dfUnexpressed = missing;
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
  /* Handed back so a caller can SAY a case could not be expressed by this
     build, instead of quietly capturing the defaults and calling it evidence. */
  return page.evaluate(() => {
    const m = window.__dfUnexpressed || [];
    window.__dfUnexpressed = undefined;
    return m;
  });
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
