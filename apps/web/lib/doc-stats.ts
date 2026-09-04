"use client";
/* ============================================================
   doc-stats.ts — what the manuscript amounts to (§8.1).

   Counting words in a marked-up document is a judgement, not a
   regex: the dialect's furniture is not prose. A `[toc]` line is an
   instruction, a citation definition is apparatus, a code fence is
   code — none of it is what a writer means by "how much have I
   written". So the count strips the constructs that are not prose
   and counts what is left, and the figures/tables/equations are
   reported separately, where they are actually useful.
   ============================================================ */

export interface DocStats {
  words: number;
  characters: number;
  /** Prose paragraphs — not headings, not furniture. */
  paragraphs: number;
  headings: number;
  figures: number;
  tables: number;
  equations: number;
  footnotes: number;
  citations: number;
  /** Minutes at 200 words a minute, rounded up, minimum 1 for any prose. */
  readingMinutes: number;
}

/** The document with its non-prose stripped: fences, furniture lines,
    definitions, and the markup characters themselves. */
function proseOf(source: string): string {
  const withoutFences = source.replace(/```[\s\S]*?(?:```|$)/g, "\n");
  const lines = withoutFences.split("\n").filter((line) => {
    const t = line.trim();
    if (!t) return false;
    if (/^\[(toc|references|lof|lot|pagebreak)\]$/i.test(t)) return false; // furniture
    if (/^\[@[^\]\s,]+\]:/.test(t)) return false; // a citation entry is apparatus
    if (/^\[\^[^\]]+\]:/.test(t)) return false; // …so is a footnote's text
    if (/^\[(screenshot|table):/i.test(t)) return false; // a caption line
    if (/^[|:\s-]+$/.test(t)) return false; // a table rule
    if (/^:::/.test(t)) return false; // a callout fence
    return true;
  });
  return lines
    .join("\n")
    .replace(/\$\$[\s\S]*?\$\$/g, " ") // display maths is not prose
    .replace(/\$[^$\n]*\$/g, " x ") // an inline equation counts as one word
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links keep their text
    .replace(/\[#[^\]]+\]/g, " x ") // a resolved cross-reference is one word
    .replace(/\[@[^\]]+\]/g, " ") // a citation call is apparatus
    .replace(/\[\^[^\]]+\]/g, " ") // …and so is a footnote call
    .replace(/[*_~`>#=+]/g, " ")
    .replace(/\|/g, " ");
}

const count = (re: RegExp, source: string): number => (source.match(re) ?? []).length;

export function documentStats(source: string): DocStats {
  const prose = proseOf(source);
  const words = (prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
  const paragraphs = prose
    .split(/\n{2,}/)
    .filter((p) => p.trim() && !/^\s{0,3}#{1,6}\s/.test(p)).length;
  return {
    words,
    characters: source.length,
    paragraphs,
    headings: count(/^\s{0,3}#{1,6}\s+\S/gm, source),
    figures: count(/^\s*\[screenshot:/gim, source),
    tables: count(/^\s*\|[^|\n]*\|/gm, source)
      ? count(/^\s*\|\s*[-:]+\s*(\|\s*[-:]+\s*)+\|/gm, source)
      : 0,
    equations: count(/\$\$[\s\S]*?\$\$/g, source) + count(/\$[^$\n]+\$/g, source),
    footnotes: count(/^\s*\[\^[^\]]+\]:/gm, source),
    /* Distinct keys CITED, not defined: the `(?!:)` is what tells a call from
       an entry, and a defined-but-uncited work is not a citation. */
    citations: new Set([...source.matchAll(/\[@([^\]\s,]+)(?:,[^\]]*)?\](?!:)/g)].map((m) => m[1]))
      .size,
    readingMinutes: words ? Math.max(1, Math.ceil(words / 200)) : 0,
  };
}

/** "1,240 words · 6 min read" — the footer's line. */
export function shortStats(s: DocStats): string {
  const words = s.words.toLocaleString();
  return s.words ? `${words} words · ${s.readingMinutes} min read` : "no words yet";
}

/** How a session goal stands. `start` is the count when the goal was set. */
export interface GoalProgress {
  written: number;
  target: number;
  /** 0–1, clamped. */
  fraction: number;
  done: boolean;
}

export function goalProgress(current: number, start: number, target: number): GoalProgress {
  const written = Math.max(0, current - start);
  const t = Math.max(1, target);
  return {
    written,
    target: t,
    fraction: Math.max(0, Math.min(1, written / t)),
    done: written >= t,
  };
}

/** The ticker's own words — deliberately quiet, and never a scold. */
export function goalLabel(p: GoalProgress): string {
  if (p.done) return `${p.written} of ${p.target} — goal met`;
  return `${p.written} of ${p.target} words`;
}
