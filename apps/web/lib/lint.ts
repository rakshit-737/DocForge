"use client";
/* The structure linter — the port of classic main.js lintSource/refreshLint.
   Gentle notices for the shapes that break exports; it never blocks anything.

   lintDocument(source) is pure and synchronous (vitest covers every rule);
   runLint() debounces it into useLintStore, folding in the settings-font
   check the classic did in refreshLint. The badge and panel live in
   components/lint-panel.tsx.

   The classic collected cross-reference ids but never wired the check; this
   port completes the set the same way the engine resolves them (render.ts):
   explicit `{#id}` labels, `[screenshot:…| #id]` / `[table:…| #id]` marker
   ids, and heading slugs — so unresolved [#refs], unused/duplicate keys and
   duplicate labels are reported before they print as “??”. */
import { create } from "zustand";
import { useDocStore } from "./store";

export type LintSeverity = "error" | "warning";

export interface LintWarning {
  severity: LintSeverity;
  message: string;
  /** 1-based source line the warning points at (the panel's jump target). */
  line?: number;
}

/* ---------------- font probe — measured, not asked ----------------
   Port of the classic fontInstalled: a probe string is laid out in the family
   with a generic behind it; if the family resolves, the width moves. Three
   generics with very different metrics are tried, because a face can happen to
   match one exactly (Arial *is* sans-serif on Windows). No canvas (SSR, tests)
   → every face counts as installed, exactly like the classic fallback. */
let probe: ((name: string) => boolean) | null = null;
function makeProbe(): (name: string) => boolean {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = document.createElement("canvas").getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return () => true;
  const c = ctx;
  const cache = new Map<string, boolean>();
  const PROBE = "mmmmmmmmmmlliWWMMwi0Oo—“”";
  const w = (font: string) => {
    c.font = font;
    return c.measureText(PROBE).width;
  };
  const GENERIC = ["monospace", "sans-serif", "serif"];
  const base = GENERIC.map((g) => w(`72px ${g}`));
  return (name) => {
    const key = String(name || "");
    const hit = cache.get(key);
    if (hit != null) return hit;
    const q = `"${key.replace(/["\\]/g, "")}"`;
    const found = GENERIC.some((g, i) => w(`72px ${q}, ${g}`) !== base[i]);
    cache.set(key, found);
    return found;
  };
}
function fontInstalled(name: string): boolean {
  if (!probe) probe = makeProbe();
  return probe(name);
}

/* Engine's slugify (packages/engine/src/util.ts), copied rather than imported —
   packages reach the app only through dynamic import, and the linter must stay
   synchronous and pure. Byte-identical logic. */
const slugify = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "sec";

/* The engine slugifies the *rendered* heading text; the closest a pure source
   pass gets is dropping link/image syntax — slugify itself already strips every
   other inline mark (`*`, `` ` ``, `==`, …) as non-word characters. */
const stripInline = (t: string) =>
  t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

/* Figure/table caption markers — ported verbatim from the engine's parse.ts so
   the linter recognises exactly the ids the renderer will. */
const RE_SHOT = /^\[screenshot(?::\s*([^\]|]*?))?((?:\s*\|\s*[^\]|]+)*)\]\s*$/i;
const RE_TABLE_CAP = /^\[table:\s*([^\]|]*?)((?:\s*\|\s*[^\]|]+)*)\]\s*$/i;

const FONT_MSG = (subject: string, fam: string) =>
  `${subject} is not installed on this device — the preview and the printed PDF fall back to a lookalike. The Word file still names ${fam}, so it prints correctly wherever the font exists.`;

interface Decl {
  /** Line of the first declaration. */
  line: number;
  /** Line of the latest (duplicating) declaration. */
  last: number;
  count: number;
}
const declare = (map: Map<string, Decl>, id: string, line: number) => {
  const d = map.get(id);
  if (d) {
    d.count++;
    d.last = line;
  } else map.set(id, { line, last: line, count: 1 });
};

/** Pure structure lint over the manuscript source. Returned warnings are
    sorted by line so the panel reads top-to-bottom. */
export function lintDocument(src: string): LintWarning[] {
  const warns: LintWarning[] = [];
  const push = (severity: LintSeverity, line: number | undefined, message: string) =>
    warns.push({ severity, line, message });
  const lines = src.split("\n");

  /* declarations (fence-aware, like the engine's extractFootnotes) */
  const fnDefs = new Map<string, Decl>();
  const citeDefs = new Map<string, Decl>();
  const labels = new Map<string, Decl>(); // {#id} labels + figure/table marker ids
  const slugs = new Set<string>();
  const seenSlug: Record<string, number> = {};

  /* uses, recorded during the walk and judged once every definition is known —
     footnote and citation definitions conventionally sit at the end. */
  const fnUses: Array<{ id: string; line: number }> = [];
  const citeUses: Array<{ id: string; line: number }> = [];
  const xrefUses: Array<{ id: string; line: number }> = [];

  let fence: string | null = null;
  let coDepth = 0;
  let coLine = 0;

  lines.forEach((line, i) => {
    const n = i + 1;
    const fm = line.match(/^(```+|~~~+)/);
    if (fence) {
      if (fm && fm[1][0] === fence[0] && fm[1].length >= fence.length) fence = null;
      return;
    }
    if (fm) {
      fence = fm[1];
      return;
    }

    if (/^:::(note|tip|warning|important|center|right|left|justify|banner)\b/i.test(line)) {
      coDepth++;
      coLine = n;
    } else if (/^:::\s*$/.test(line)) coDepth = Math.max(0, coDepth - 1);

    if (/^#{5,}\s/.test(line))
      push(
        "warning",
        n,
        "Heading level 5+ — styled plainly and never listed in the contents. Consider #### or bold text.",
      );
    if (/^\s*<(?!\/?(b|i|em|strong|code|br)\b)[a-z][^>]*>/i.test(line))
      push(
        "warning",
        n,
        "Raw HTML — it will be ignored or printed as text. Use the toolbar marks instead.",
      );
    const t = line.match(/^\s*\|(.+)\|\s*$/);
    if (t && i && /^\s*\|.+\|\s*$/.test(lines[i - 1] || "")) {
      const cols = (r: string) => (r.match(/(?<!\\)\|/g) || []).length;
      if (cols(line) !== cols(lines[i - 1]))
        push(
          "warning",
          n,
          "Table row has a different number of cells than the row above — the table will come out ragged.",
        );
    }

    /* A call shown as a specimen is not a call: fenced blocks are skipped above,
       and inline code spans are blanked (keeping the line length, so any later
       column arithmetic still holds) before declarations and uses are read. */
    const scan = line.replace(/`+[^`]*`+/g, (m) => " ".repeat(m.length));

    /* ---- declarations ---- */
    const fnDef = scan.match(/^\[\^([^\]\s]+)\]:/);
    if (fnDef) declare(fnDefs, fnDef[1], n);
    const ctDef = scan.match(/^\[@([^\]\s,]+)\]:/);
    if (ctDef) declare(citeDefs, ctDef[1], n);

    for (const m of scan.matchAll(/\{#([A-Za-z][\w:.-]*)\}/g)) declare(labels, m[1], n);

    const marker = scan.match(RE_SHOT) || scan.match(RE_TABLE_CAP);
    if (marker) {
      for (const part of String(marker[2] || "")
        .split("|")
        .map((s) => s.trim())) {
        if (part.startsWith("#")) declare(labels, part.slice(1), n);
      }
    }

    /* heading slugs — the engine's auto ids, deduped the engine's way; a heading
       wearing an explicit {#label} takes that id instead and skips the counter.
       Read from the raw line: the engine slugifies rendered textContent, which
       keeps the words inside inline code spans. */
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h && !/\{#[A-Za-z][\w:.-]*\}\s*$/.test(h[1])) {
      let id = slugify(stripInline(h[1]));
      if (seenSlug[id] != null) id = `${id}-${++seenSlug[id]}`;
      else seenSlug[id] = 0;
      slugs.add(id);
    }

    /* ---- uses ---- (a definition's own marker never counts: `]:` fails the
       lookahead, so a def line only contributes the refs inside its text) */
    for (const m of scan.matchAll(/\[\^([^\]\s]+)\](?!:)/g)) fnUses.push({ id: m[1], line: n });
    for (const m of scan.matchAll(/\[@([^\]\s,]+)(?:,[^\]]*)?\](?!:)/g))
      citeUses.push({ id: m[1], line: n });
    for (const m of scan.matchAll(/\[#([A-Za-z][\w:.-]*)\]/g)) xrefUses.push({ id: m[1], line: n });

    /* A face this machine lacks prints correctly from Word and falls back everywhere else. */
    for (const m of scan.matchAll(/\bfont=(?:"([^"]+)"|([^\s"\]}]+))/g)) {
      const fam = m[1] || m[2];
      if (!fontInstalled(fam)) push("warning", n, FONT_MSG(fam, fam));
    }
  });

  if (fence)
    push(
      "error",
      lines.length,
      "Unclosed code fence ``` — everything after it is being treated as code.",
    );
  if (coDepth > 0)
    push("error", coLine, "Unclosed callout ::: — it swallows the rest of the document.");

  /* ---- resolution passes ---- */
  const fnUsed = new Set(fnUses.map((u) => u.id));
  const citeUsed = new Set(citeUses.map((u) => u.id));

  for (const u of fnUses)
    if (!fnDefs.has(u.id))
      push("error", u.line, `Footnote [^${u.id}] has no definition line ([^${u.id}]: …).`);
  for (const u of citeUses)
    if (!citeDefs.has(u.id))
      push("error", u.line, `Citation [@${u.id}] has no entry ([@${u.id}]: …).`);
  for (const u of xrefUses)
    if (!labels.has(u.id) && !slugs.has(u.id))
      push(
        "error",
        u.line,
        `Cross-reference [#${u.id}] has no target — it will print as “??”. Label a heading {#${u.id}} or give a figure/table the option | #${u.id}.`,
      );

  for (const [id, d] of fnDefs) {
    if (d.count > 1)
      push(
        "error",
        d.last,
        `Footnote [^${id}] is defined ${d.count} times — the last definition silently overwrites the others.`,
      );
    if (!fnUsed.has(id))
      push(
        "warning",
        d.line,
        `Footnote [^${id}] is defined but never referenced — the note will not be printed.`,
      );
  }
  for (const [id, d] of citeDefs) {
    if (d.count > 1)
      push(
        "error",
        d.last,
        `Citation [@${id}] has ${d.count} entries — the last entry silently overwrites the others.`,
      );
    if (!citeUsed.has(id))
      push(
        "warning",
        d.line,
        `Citation [@${id}] has an entry but is never cited — it will not appear in the references list.`,
      );
  }
  for (const [id, d] of labels)
    if (d.count > 1)
      push(
        "error",
        d.last,
        `Duplicate label #${id} — cross-references point at the first occurrence only.`,
      );

  /* one list, top to bottom — Array.prototype.sort is stable, so same-line
     warnings keep their rule order */
  return warns.sort(
    (a, b) => (a.line ?? Number.MAX_SAFE_INTEGER) - (b.line ?? Number.MAX_SAFE_INTEGER),
  );
}

/* The document-wide faces live in settings, not in the source, so they are
   checked here rather than in lintDocument — same failure, same wording as the
   classic refreshLint. */
export function lintSettingsFonts(settings: Record<string, unknown>): LintWarning[] {
  const warns: LintWarning[] = [];
  for (const k of ["fontHead", "fontBody"] as const) {
    const v = settings[k];
    if (typeof v !== "string" || !v.startsWith("sys:")) continue;
    const fam = v.slice(4);
    if (!fontInstalled(fam))
      warns.push({
        severity: "warning",
        line: 1,
        message: FONT_MSG(`${fam} (${k === "fontHead" ? "heading" : "body"} typeface)`, fam),
      });
  }
  return warns;
}

/* ---------------- store + debounced runner ---------------- */

interface LintState {
  warnings: LintWarning[];
  setWarnings: (warnings: LintWarning[]) => void;
}

export const useLintStore = create<LintState>((set) => ({
  warnings: [],
  setWarnings: (warnings) => set({ warnings }),
}));

let lintTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounced lint: the classic ran refreshLint on every keystroke; the studio
    waits for the hand to lift. Source rules plus the settings-font check, read
    from the document store at fire time so the two never disagree. */
export function runLint(source: string, delay = 600): void {
  clearTimeout(lintTimer);
  lintTimer = setTimeout(() => {
    useLintStore
      .getState()
      .setWarnings([
        ...lintDocument(source),
        ...lintSettingsFonts(useDocStore.getState().settings),
      ]);
  }, delay);
}
