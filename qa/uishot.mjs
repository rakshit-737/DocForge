/* Capture UI screenshots for the design critique loop. */
import { launch } from "./_browser.mjs";
import * as drive from "./_drive.mjs";

const b = await launch();
const p = await drive.open(b);

await p.screenshot({ path: "qa/out/ui-dark.png" });
await p.click("#btnSettings");
await p.waitForTimeout(300);
await p.screenshot({ path: "qa/out/ui-settings.png" });
await p.click("#btnSettings");

/* bordered doc */
await drive.applyDoc(p, { settings: { pageBorder: "frame", cover: true } });
await p.waitForTimeout(400);
await p.screenshot({ path: "qa/out/ui-border.png" });

/* light chrome */
await p.click("#btnDark");
await p.waitForTimeout(300);
await p.screenshot({ path: "qa/out/ui-light.png" });

/* find bar + outline open, light */
await p.keyboard.press("Control+f");
await p.click("#btnOutline");
await p.waitForTimeout(300);
await p.screenshot({ path: "qa/out/ui-panels.png" });

const errors = p.__errors.filter(e => !/favicon/i.test(e));
console.log("console errors:", errors.length ? errors : "none");
await b.close();
