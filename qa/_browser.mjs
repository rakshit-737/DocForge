/* Cross-platform Chromium resolution for the QA scripts.
   Order: PW_CHROMIUM env → playwright-core's own download → system Chrome/Edge. */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const CANDIDATES = [
  process.env.PW_CHROMIUM,
  "/opt/pw-browsers/chromium",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

export function executablePath() {
  for (const p of CANDIDATES) if (existsSync(p)) return p;
  return undefined; // let playwright try its bundled browser
}

export async function launch(opts = {}) {
  return chromium.launch({
    executablePath: executablePath(),
    args: ["--no-sandbox", "--font-render-hinting=none"],
    ...opts,
  });
}
