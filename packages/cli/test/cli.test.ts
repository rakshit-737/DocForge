/* ============================================================
   cli.test.ts — the headless proof, end to end: spawn the built
   dist/cli.mjs on the golden corpus' 16-edge-minimal.md and read
   the .docx back with the zip-reader trick. The suite builds the
   bundle itself when dist/ is missing, so `vitest run` is enough
   — but the npm dependencies (happy-dom above all) must be linked
   by a workspace `pnpm install` before the spawned CLI can run.
   ============================================================ */

import type { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readZip } from "./_zip.js";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(PKG, "..", "..");
const CLI = join(PKG, "dist", "cli.mjs");
const CORPUS = join(REPO, "qa", "golden", "corpus", "16-edge-minimal.md");

const run = (args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", timeout: 120_000 });

let outDir = "";
let bytes: Buffer;

beforeAll(() => {
  if (!existsSync(CLI)) {
    const b = spawnSync(process.execPath, [join(PKG, "build.mjs")], {
      encoding: "utf8",
      cwd: PKG,
      timeout: 120_000,
    });
    if (b.status !== 0)
      throw new Error(`build.mjs failed (exit ${b.status}):\n${b.stdout}${b.stderr}`);
  }
  outDir = mkdtempSync(join(tmpdir(), "docforge-cli-"));
  const r = run([
    "build",
    CORPUS,
    "--docx",
    "--out",
    outDir,
    "--theme",
    "executive",
    "--author",
    "QA Harness",
    "--date",
    "2026-01-05",
  ]);
  if (r.status !== 0) {
    throw new Error(`docforge build failed (exit ${r.status}):\n${r.stdout}${r.stderr}`);
  }
  bytes = readFileSync(join(outDir, "16-edge-minimal.docx"));
}, 180_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

describe("docforge build --docx", () => {
  it("writes a real zip — PK local-file magic up front", () => {
    expect(bytes.length).toBeGreaterThan(4);
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("carries word/document.xml with the corpus prose", () => {
    const doc = readZip(bytes).get("word/document.xml");
    expect(doc).toBeDefined();
    const xml = (doc as Buffer).toString("utf8");
    expect(xml).toContain("Interim Service Note"); // the corpus H1 → Heading1 text
    expect(xml).toContain("archive migration"); // body prose survived the round trip
  });

  it("is a complete OOXML package ([Content_Types].xml present)", () => {
    expect(readZip(bytes).has("[Content_Types].xml")).toBe(true);
  });
});

describe("docforge build --pdf", () => {
  it("states the studio dependency honestly and exits 2", () => {
    const r = run(["build", CORPUS, "--pdf"]);
    expect(r.status).toBe(2);
    expect(r.stderr + r.stdout).toContain("PDF needs the studio");
  }, 60_000);
});
