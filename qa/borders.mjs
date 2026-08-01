/* Verify decorative page borders reach both exports, and the cover stays exempt. */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { launch } from "./_browser.mjs";
import { rasterise } from "./_raster.mjs";
import * as drive from "./_drive.mjs";

const b = await launch();
const p = await drive.open(b);

const SRC = `# One

Prose on the first body page.

[pagebreak]

# Two

Prose on the second body page.
`;

for (const style of ["rule", "double", "frame"]) {
  await drive.applyDoc(p, {
    source: SRC,
    settings: { title: "Border " + style, cover: true, pageBorder: style, theme: "modern" },
  });
  await drive.printPdf(p, `qa/out/border-${style}.pdf`);
  await rasterise(`qa/out/border-${style}.pdf`, `qa/out/border-${style}`, { browser: b, scale: 2, maxPages: 3 });
  console.log(style, "pdf captured");
}

/* Word round-trip for one style */
await drive.applyDoc(p, { source: SRC, settings: { title: "Border frame", cover: true, pageBorder: "frame" } });
await drive.exportDocx(p, "qa/out/border-frame.docx");
execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolve("qa/_docx2pdf.ps1"),
  "-In", "qa/out/border-frame.docx", "-Out", resolve("qa/out/border-frame-word.pdf")], { timeout: 240000 });
await rasterise("qa/out/border-frame-word.pdf", "qa/out/border-frame-word", { browser: b, scale: 2, maxPages: 3 });
console.log("word captured");

console.log("errors:", p.__errors.length ? p.__errors.slice(0, 3) : "none");
await b.close();
