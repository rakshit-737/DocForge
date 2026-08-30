/* ============================================================
   PARITY GATE (inner loop) — gated behind RUN_PARITY=1.

     RUN_PARITY=1 pnpm --filter @docforge/engine test parity

   Loads src/js/engine.js RAW into this same happy-dom environment
   (its own fresh Marked instance, same katex/hljs/document) and
   byte-compares its render() output against the package's render()
   across every golden-matrix case — all 17 corpus documents plus
   the four historical torture configurations — before the full
   browser golden gate runs.

   Not part of the default suite: it reads files outside the package
   and doubles the work, so it runs on demand and in the Phase-1
   parity-harness CI step.
   ============================================================ */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import hljsNpm from "highlight.js";
import katexNpm from "katex";
import { Marked } from "marked";
import { beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error — untyped .mjs module; the golden matrix stays the single source of truth for cases
import { CASES } from "../../../qa/golden/matrix.mjs";
import type { RenderResult, Settings } from "../src/index.js";
import { dynamicCss, esc, fmtDate, fontFaceCss, render, sysStack, tints } from "../src/index.js";

interface GoldenCase {
  id: string;
  doc: string;
  postBaseline?: boolean;
  settings: Settings;
}

interface ClassicEngine {
  render(source: string, settings: Settings, attachments: Record<string, unknown>): RenderResult;
  dynamicCss(settings: Settings): string;
  fontFaceCss(): string;
  tints(accent: string): Record<string, string>;
  sysStack(name: unknown): string;
  esc(s: unknown): string;
  fmtDate(iso: string | null | undefined): string;
}

const RUN = process.env.RUN_PARITY === "1";

/* The golden matrix holds PARTIAL settings — the live app merges them over its
   boot defaults (src/js/main.js DEFAULTS + THEME_ACCENT theme switch), so the
   engine never sees a missing key. Mirror that here with a pinned date. */
const THEME_ACCENT: Record<string, string> = {
  modern: "#2563eb",
  executive: "#1f3a5f",
  academic: "#7f1d1d",
  minimal: "#111827",
};
const DEFAULTS: Settings = {
  title: "",
  subtitle: "",
  author: "",
  kicker: "",
  metaExtra: "",
  date: "2026-08-30",
  theme: "modern",
  accent: "#2563eb",
  page: "A4",
  margins: "normal",
  cover: false,
  header: true,
  pageNums: true,
  numbered: false,
  justify: false,
  h1break: false,
  hardWrap: false,
  citeStyle: "ieee",
  borderStyle: "none",
  borderWeight: "medium",
  borderColor: "ink",
  fontHead: "theme",
  fontBody: "theme",
  baseSize: "11",
  lineSpacing: "default",
} as Settings;
function fullSettings(partial: Settings): Settings {
  const s = { ...DEFAULTS, ...partial } as Settings & { theme?: string; accent?: string };
  if (
    partial &&
    (partial as { theme?: string }).theme &&
    !(partial as { accent?: string }).accent
  ) {
    s.accent = THEME_ACCENT[s.theme as string] ?? s.accent;
  }
  return s;
}

const cases = (CASES as GoldenCase[]).map((c) => ({ ...c, settings: fullSettings(c.settings) }));

/* happy-dom rewrites import.meta.url off the file: scheme, so locate the repo
   root by walking up from cwd until qa/golden/matrix.mjs appears. */
function repoRoot(): string {
  let d = process.cwd();
  while (!existsSync(join(d, "qa", "golden", "matrix.mjs"))) {
    const up = dirname(d);
    if (up === d) throw new Error("repo root not found from " + process.cwd());
    d = up;
  }
  return d;
}
const ROOT = repoRoot();

function loadClassic(): ClassicEngine {
  /* The classic source retired from src/js once the Phase-1 gate passed; this
     frozen copy (its last state, banner included) keeps the byte-parity suite
     guarding every future engine refactor against drift from classic. */
  const src = readFileSync(
    join(ROOT, "packages", "engine", "test", "fixtures", "classic-engine.js"),
    "utf8"
  );
  // A fresh Marked instance so the classic side's marked.use() calls cannot
  // stack onto the npm singleton the package configured. document / window /
  // NodeFilter resolve from this happy-dom environment for both sides.
  const factory = new Function("marked", "katex", "hljs", `${src}\nreturn Engine;`);
  return factory(new Marked(), katexNpm, hljsNpm) as ClassicEngine;
}

(RUN ? describe : describe.skip)("byte parity against src/js/engine.js", () => {
  let classic: ClassicEngine;
  beforeAll(() => {
    classic = loadClassic();
  });

  it.each(cases.map((c) => [c.id, c] as [string, GoldenCase]))("render: %s", (_id, c) => {
    const src = readFileSync(join(ROOT, "qa", "golden", c.doc), "utf8");
    const ours = render(src, c.settings, {});
    const theirs = classic.render(src, c.settings, {});
    expect(ours.doc.outerHTML).toBe(theirs.doc.outerHTML);
    expect(ours.meta).toEqual(theirs.meta);
  });

  it.each(cases.map((c) => [c.id, c] as [string, GoldenCase]))("dynamicCss: %s", (_id, c) => {
    expect(dynamicCss(c.settings)).toBe(classic.dynamicCss(c.settings));
  });

  it("fontFaceCss parity (with and without __FONT_DATA__)", () => {
    expect(fontFaceCss()).toBe(classic.fontFaceCss());
    (window as Window).__FONT_DATA__ = {
      "DocForgeSans-Regular": "QUFB",
      "DocForgeSerif-BoldItalic": "QkJC",
      "DocForgeMono-Bold": "Q0ND",
    };
    try {
      expect(fontFaceCss()).toBe(classic.fontFaceCss());
    } finally {
      delete (window as Window).__FONT_DATA__;
    }
  });

  it("helper parity sweep: tints / sysStack / esc / fmtDate", () => {
    for (const accent of ["#2563eb", "#7f1d1d", "#1f3a5f", "#111827", "#c2410c", "#000", "#fff"]) {
      expect(tints(accent)).toEqual(classic.tints(accent));
    }
    for (const name of [
      "Georgia",
      "DocForge Serif",
      "Cascadia Code",
      "Vivaldi",
      "Impact",
      "no such",
      "",
      null,
      'q"uote',
    ]) {
      expect(sysStack(name)).toBe(classic.sysStack(name));
    }
    expect(esc(`<&"'>`)).toBe(classic.esc(`<&"'>`));
    for (const d of ["2026-08-30", "2025-12-01", "", null, "bogus"]) {
      expect(fmtDate(d)).toBe(classic.fmtDate(d));
    }
  });
});

// The gate is visible even when skipped, so a green run never silently means "not run".
it(RUN ? "parity gate armed" : "parity gate skipped (set RUN_PARITY=1 to arm)", () => {
  expect(true).toBe(true);
});
