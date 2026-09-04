import { launch } from "./_browser.mjs";
import { resolve } from "node:path";
const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1560, height: 980 } })).newPage();
await p.goto("file://" + resolve("dist/DocForge.html"));
/* Fresh state, minus the one-time first-run manual — it opens over the desk
   and swallows the clicks below (firstrun-smoke owns that door). */
await p.evaluate(() => { localStorage.clear(); localStorage.setItem("docforge.helped", "1"); });
await p.reload();
await p.waitForSelector(".pagedjs_page", { timeout: 25000 });
/* Templates are a menu button, not a <select>: open it and pick the item. */
await p.click("#templateSelect");
await p.waitForSelector("#tplMenu .tpl-item", { state: "visible" });
await p.click('#tplMenu .tpl-item[data-id="proposal"]');
await p.waitForSelector("#confirmOverlay.open");
await p.click("#cfYes");
await p.waitForTimeout(3000);
await p.emulateMedia({ media: "print" });
await p.pdf({ path: "qa/proposal.pdf", preferCSSPageSize: true });
await b.close();
