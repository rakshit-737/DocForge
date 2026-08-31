/* ============================================================
   @docforge/cli — headless DocForge: markdown in, .docx out.

     docforge build report.md --docx [--out dir] [--theme executive] …

   The same pipeline the studio runs in the browser, stood up in
   Node: a happy-dom Window plays the DOM; the npm copies of
   marked / katex / highlight.js / docx play the vendored globals
   (mirroring packages/engine/test/setup.ts and apps/web/lib/
   bootstrap.ts); __FONT_DATA__ is read straight from the repo's
   fonts/ directory so the .docx embeds the same typefaces the
   single-file edition carries. The workspace packages arrive via
   dynamic import BEHIND the global assignments — the engine
   registers its marked extensions at import time, so order is law.
   ============================================================ */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Attachments, Settings as EngineSettings } from "@docforge/engine";
import type { DocxSettings } from "@docforge/export-docx";

type EngineModule = typeof import("@docforge/engine");
type EngineApi = EngineModule["api"];

/** Expected failures — reported without a stack, exit 1. */
class CliError extends Error {}

/* ---------------- settings (mirrors apps/web/lib/settings.ts) ---------------- */

export interface CliSettings {
  [key: string]: unknown;
  title: string;
  subtitle: string;
  author: string;
  kicker: string;
  metaExtra: string;
  date: string;
  theme: string;
  accent: string;
  page: string;
  margins: string;
  cover: boolean;
  header: boolean;
  pageNums: boolean;
  numbered: boolean;
  justify: boolean;
  h1break: boolean;
  hardWrap: boolean;
  citeStyle: string;
  borderStyle: string;
  borderWeight: string;
  borderColor: string;
  fontHead: string;
  fontBody: string;
  baseSize: string;
  lineSpacing: string;
}

const THEME_ACCENT: Record<string, string> = {
  modern: "#2563eb",
  executive: "#1f3a5f",
  academic: "#7f1d1d",
  minimal: "#111827",
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function defaultSettings(): CliSettings {
  return {
    title: "",
    subtitle: "",
    author: "",
    kicker: "",
    metaExtra: "",
    date: todayISO(),
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
  };
}

/* ---------------- argument parsing ---------------- */

const STRING_FLAGS: Record<string, string> = {
  "--title": "title",
  "--subtitle": "subtitle",
  "--author": "author",
  "--kicker": "kicker",
  "--meta-extra": "metaExtra",
  "--date": "date",
  "--theme": "theme",
  "--accent": "accent",
  "--page": "page",
  "--margins": "margins",
  "--cite-style": "citeStyle",
  "--border-style": "borderStyle",
  "--border-weight": "borderWeight",
  "--border-color": "borderColor",
  "--font-head": "fontHead",
  "--font-body": "fontBody",
  "--base-size": "baseSize",
  "--line-spacing": "lineSpacing",
};

const BOOL_FLAGS: Record<string, [key: string, value: boolean]> = {
  "--cover": ["cover", true],
  "--no-cover": ["cover", false],
  "--numbered": ["numbered", true],
  "--justify": ["justify", true],
  "--h1break": ["h1break", true],
  "--hard-wrap": ["hardWrap", true],
  "--no-header": ["header", false],
  "--no-page-nums": ["pageNums", false],
};

/* Closed vocabularies, matched case-insensitively, stored canonically.
   The values mirror packages/engine/src/themes.ts and doc.css exactly. */
const CHOICES: Record<string, string[]> = {
  theme: ["modern", "executive", "academic", "minimal"],
  page: ["A4", "Letter"],
  margins: ["normal", "narrow", "wide"],
  borderStyle: ["none", "rule", "double", "triple", "dashed", "dotted", "thickthin", "thinthick"],
  borderWeight: ["fine", "medium", "bold"],
  borderColor: ["ink", "accent"],
  lineSpacing: ["default", "1", "1.15", "1.5", "2"],
};

interface CliOptions {
  command: string | null;
  input: string | null;
  out: string | null;
  docx: boolean;
  pdf: boolean;
  help: boolean;
  version: boolean;
  overrides: Record<string, unknown>;
  errors: string[];
}

const kebab = (key: string): string => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

function setOverride(o: CliOptions, key: string, raw: string): void {
  let value = raw;
  const choices = CHOICES[key];
  if (choices) {
    const hit = choices.find((c) => c.toLowerCase() === raw.toLowerCase());
    if (!hit) {
      o.errors.push(`--${kebab(key)} must be one of ${choices.join(" | ")} (got "${raw}")`);
      return;
    }
    value = hit;
  }
  if (key === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    o.errors.push(`--date must be YYYY-MM-DD (got "${raw}")`);
    return;
  }
  if (key === "accent") {
    if (!/^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
      o.errors.push(`--accent must be a hex colour like #2563eb (got "${raw}")`);
      return;
    }
    value = raw.startsWith("#") ? raw : `#${raw}`;
  }
  if (key === "baseSize" && !(Number.parseFloat(raw) > 0)) {
    o.errors.push(`--base-size must be a point size (got "${raw}")`);
    return;
  }
  o.overrides[key] = value;
}

export function parseArgs(args: string[]): CliOptions {
  const o: CliOptions = {
    command: null,
    input: null,
    out: null,
    docx: false,
    pdf: false,
    help: false,
    version: false,
    overrides: {},
    errors: [],
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === undefined) continue;
    if (a === "--help" || a === "-h") {
      o.help = true;
    } else if (a === "--version" || a === "-v") {
      o.version = true;
    } else if (a === "--docx") {
      o.docx = true;
    } else if (a === "--pdf") {
      o.pdf = true;
    } else if (a === "--out") {
      const v = args[++i];
      if (v === undefined) o.errors.push("--out needs a directory");
      else o.out = v;
    } else if (STRING_FLAGS[a]) {
      const v = args[++i];
      if (v === undefined) o.errors.push(`${a} needs a value`);
      else setOverride(o, STRING_FLAGS[a], v);
    } else if (BOOL_FLAGS[a]) {
      const [key, value] = BOOL_FLAGS[a];
      o.overrides[key] = value;
    } else if (a.startsWith("-")) {
      o.errors.push(`unknown flag ${a}`);
    } else if (!o.command) {
      o.command = a;
    } else if (!o.input) {
      o.input = a;
    } else {
      o.errors.push(`unexpected argument ${a}`);
    }
  }
  return o;
}

/** Defaults + flags. --theme also re-seats the accent (the studio's pairing)
    unless --accent was given explicitly — the override loop runs last, so an
    explicit accent always wins. */
export function settingsFrom(o: CliOptions): CliSettings {
  const s = defaultSettings();
  const theme = o.overrides.theme;
  if (typeof theme === "string" && THEME_ACCENT[theme]) s.accent = THEME_ACCENT[theme];
  for (const [k, v] of Object.entries(o.overrides)) s[k] = v;
  return s;
}

/* ---------------- the headless pipeline ---------------- */

/** Walk up from this script towards the repo root looking for the fonts/
    directory (dist/cli.mjs and src/cli.ts both sit two levels under it via
    packages/cli). An npm-installed CLI has no fonts alongside — the .docx
    then names the DocForge faces without embedding bytes, which the
    exporter handles (the same guard the classic build has for missing cuts). */
function findFontsDir(): string | null {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const cand = join(dir, "fonts");
    if (existsSync(join(cand, "DocForgeSans-Regular.ttf"))) return cand;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** base64 TTF bytes per "<stem>-<Cut>" key — the same contract build.mjs
    inlines into the single file and apps/web/lib/bootstrap.ts fetches. */
function collectFontData(engine: EngineApi): Record<string, string> {
  const out: Record<string, string> = {};
  const dir = findFontsDir();
  if (!dir) {
    process.stderr.write(
      "note: fonts/ not found — DocForge faces will be named, not embedded, in the .docx\n",
    );
    return out;
  }
  for (const fam of engine.EMBEDDED) {
    for (const cut of Object.keys(fam.cuts)) {
      const cutName = engine.CUT_FILE[cut];
      if (!cutName) continue;
      const key = `${fam.stem}-${cutName}`;
      const file = join(dir, `${key}.ttf`);
      if (!existsSync(file)) continue;
      out[key] = readFileSync(file).toString("base64");
    }
  }
  return out;
}

/** Render the source and write the .docx; returns the output path. */
export async function buildDocxFile(
  input: string,
  outDir: string | null,
  settings: CliSettings,
): Promise<string> {
  const sourcePath = resolve(process.cwd(), input);
  if (!existsSync(sourcePath)) throw new CliError(`input not found: ${sourcePath}`);
  const source = readFileSync(sourcePath, "utf8");

  const g = globalThis as unknown as Record<string, unknown>;

  /* 1 — the DOM. One happy-dom Window plays browser: its constructors and
     document land on globalThis, where the packages read them ambiently. */
  const { Window } = await import("happy-dom");
  const win = new Window() as unknown as Record<string, unknown>;
  /* Standards mode, not quirks — katex checks document.compatMode at import
     time and warns loudly. happy-dom leaves it undefined, so declare what is
     true of the studio's documents (they always carry a doctype). */
  const happyDoc = win.document as unknown as Record<string, unknown>;
  if (happyDoc.compatMode === undefined) happyDoc.compatMode = "CSS1Compat";
  g.window = win;
  for (const key of [
    "document",
    "DOMParser",
    "Node",
    "NodeFilter",
    "Element",
    "HTMLElement",
    "Text",
    "DocumentFragment",
  ]) {
    g[key] = win[key];
  }

  /* 2 — the vendored globals, npm copies at the exact ROOT versions
     (mirrors packages/engine/test/setup.ts and apps/web/lib/bootstrap.ts;
     the `.default ??` interop mirrors the root build.mjs hljs guard). */
  const [markedNs, katexNs, hljsNs, docxNs] = await Promise.all([
    import("marked"),
    import("katex"),
    import("highlight.js/lib/common"),
    import("docx"),
  ]);
  g.marked = markedNs.marked;
  g.katex = (katexNs as { default?: unknown }).default ?? katexNs;
  g.hljs = (hljsNs as { default?: unknown }).default ?? hljsNs;
  const docxLib = (docxNs as Record<string, unknown>).Document
    ? docxNs
    : (docxNs as { default?: unknown }).default;
  g.docx = docxLib;
  win.docx = docxLib;

  /* 3 — the engine, dynamically imported BEHIND the assignments (it runs
     marked.use at import time). The exporter reads the classic ambient
     Engine global — a plain spread, mutable, like packages/engine/src/global.ts. */
  const engineMod: EngineModule = await import("@docforge/engine");
  g.Engine = { ...engineMod.api };

  /* 4 — font bytes reach both sides through the __FONT_DATA__ contract. */
  const fontData = collectFontData(engineMod.api);
  g.__FONT_DATA__ = fontData;
  win.__FONT_DATA__ = fontData;

  /* 5 — render, then export: the same two calls the studio makes. */
  const { doc } = engineMod.api.render(source, settings as EngineSettings, {} as Attachments);
  const content = doc.querySelector<HTMLElement>(".content");
  if (!content) throw new CliError("render produced no .content element");
  const docxExportMod = await import("@docforge/export-docx");
  const blob = await docxExportMod.api.DocxExport.build(
    content,
    settings as unknown as DocxSettings,
    {},
  );

  /* 6 — write <input stem>.docx next to the input, or into --out. */
  const dir = outDir ? resolve(process.cwd(), outDir) : dirname(sourcePath);
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, `${basename(sourcePath, extname(sourcePath))}.docx`);
  writeFileSync(outPath, new Uint8Array(await blob.arrayBuffer()));
  return outPath;
}

/* ---------------- entry ---------------- */

function readVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const USAGE = `docforge — headless DocForge document builds

Usage
  docforge build <input.md> --docx [options]

Formats
  --docx                 write a Word .docx (the input stem names the file)
  --pdf                  not headless yet — PDF needs the studio

Output
  --out <dir>            output directory (default: alongside the input)

Document
  --title <text>         --subtitle <text>       --author <text>
  --kicker <text>        --meta-extra <text>     --date <YYYY-MM-DD>
  --theme <name>         modern | executive | academic | minimal
  --accent <#hex>        accent colour (default: the theme's own pairing)
  --page <size>          A4 | Letter
  --margins <preset>     normal | narrow | wide
  --font-head <key>      --font-body <key>       face key or sys:Family Name
  --base-size <pt>       --line-spacing <n>      1 | 1.15 | 1.5 | 2
  --cite-style <name>    citation style (default ieee)

Switches
  --cover  --numbered  --justify  --h1break  --hard-wrap
  --no-header  --no-page-nums  --no-cover

Page border
  --border-style <name>  rule | double | triple | dashed | dotted | thickthin | thinthick
  --border-weight <name> fine | medium | bold
  --border-color <name>  ink | accent

  --help  -h             --version  -v
`;

export async function main(argv: string[]): Promise<number> {
  const o = parseArgs(argv.slice(2));
  if (o.help || argv.length <= 2) {
    process.stdout.write(USAGE);
    return o.help ? 0 : 2;
  }
  if (o.version) {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }
  if (o.errors.length) {
    for (const e of o.errors) process.stderr.write(`docforge: ${e}\n`);
    process.stderr.write("docforge: see --help for usage\n");
    return 2;
  }
  if (o.command !== "build") {
    process.stderr.write(`docforge: unknown command "${o.command ?? ""}" — only "build" exists\n`);
    return 2;
  }
  if (!o.input) {
    process.stderr.write("docforge: no input file — docforge build <input.md> --docx\n");
    return 2;
  }
  if (o.pdf) {
    process.stderr.write("PDF needs the studio (issue #9 tracks direct export)\n");
    return 2;
  }
  if (!o.docx) {
    process.stderr.write("docforge: nothing to write — pass --docx\n");
    return 2;
  }
  const settings = settingsFrom(o);
  const outPath = await buildDocxFile(o.input, o.out, settings);
  const kb = (readFileSync(outPath).length / 1024).toFixed(1);
  process.stdout.write(`wrote ${outPath} (${kb} KB · ${settings.theme} · ${settings.page})\n`);
  return 0;
}

main(process.argv).then(
  (code) => process.exit(code),
  (err: unknown) => {
    const msg =
      err instanceof CliError
        ? err.message
        : err instanceof Error
          ? (err.stack ?? err.message)
          : String(err);
    process.stderr.write(`docforge: ${msg}\n`);
    process.exit(1);
  },
);
