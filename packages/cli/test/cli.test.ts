/* ============================================================
   cli.test.ts — the headless proof, end to end: spawn the built
   dist/cli.mjs on the golden corpus' 16-edge-minimal.md and read
   the .docx back with the zip-reader trick; then print
   03-headings-sections.md with --pdf and check the direct-export
   spike's two claims in the bytes (outline + tagged structure).
   The suite builds the bundle itself when dist/ is missing, so
   `vitest run` is enough — but the npm dependencies (happy-dom
   above all) must be linked by a workspace `pnpm install`, and
   the --pdf suite additionally needs a resolvable Chromium
   (PW_CHROMIUM / system Chrome or Edge) plus the repo's root
   node_modules (pagedjs, playwright-core).
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
// The PDF spike prints a heading-rich corpus doc, so the generated outline has
// a real tree to carry and the embedded font subsets give the size floor teeth.
const PDF_CORPUS = join(REPO, "qa", "golden", "corpus", "03-headings-sections.md");

const run = (args: string[], timeout = 120_000) =>
  spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", timeout });

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

describe("docforge build --pdf (direct export — the issue #9 spike)", () => {
  let pdfDir = "";
  let pdf: Buffer;
  let latin1 = "";

  beforeAll(() => {
    pdfDir = mkdtempSync(join(tmpdir(), "docforge-cli-pdf-"));
    // Chromium can be slow on a cold start under CI load — generous timeout.
    const r = run(
      [
        "build",
        PDF_CORPUS,
        "--pdf",
        "--out",
        pdfDir,
        "--theme",
        "executive",
        "--author",
        "QA Harness",
        "--date",
        "2026-01-05",
      ],
      300_000,
    );
    if (r.status !== 0) {
      throw new Error(`docforge build --pdf failed (exit ${r.status}):\n${r.stdout}${r.stderr}`);
    }
    pdf = readFileSync(join(pdfDir, "03-headings-sections.pdf"));
    latin1 = pdf.toString("latin1");
  }, 320_000);

  afterAll(() => {
    if (pdfDir) rmSync(pdfDir, { recursive: true, force: true });
  });

  it("writes a real PDF — %PDF magic up front", () => {
    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("is a substantial document, not a stub (> 20 KB)", () => {
    expect(pdf.length).toBeGreaterThan(20 * 1024);
  });

  it("carries a document outline — the print dialog cannot do this", () => {
    expect(latin1).toContain("/Outlines");
  });

  it("carries tagged structure — the other thing the dialog cannot do", () => {
    expect(latin1).toContain("/StructTreeRoot");
    expect(latin1).toContain("/MarkInfo");
  });
});
