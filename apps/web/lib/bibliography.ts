"use client";
/* Splicing an imported reference library into a manuscript (§8.3).

   The importer package turns a .bib/.ris/CSL-JSON file into dialect
   definition lines; this decides where they go and what the reader is told.
   Rules, in the order they matter:

     1. A key already defined in the document wins. Re-importing a library
        after adding one entry must not double every other entry, and must
        never overwrite an entry the reader has edited by hand.
     2. Definitions land immediately BEFORE `[references]` when the document
        places the list itself, and at the end otherwise — the same place a
        reader typing them would put them.
     3. Nothing else in the source moves. */

/** Keys the document already defines (`[@key]: …` at the start of a line). */
export function definedKeys(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(/^\[@([^\]\s,]+)\]:/gm)) out.add(m[1] as string);
  return out;
}

/** Keys the document cites (`[@key]` or `[@key, p. 3]`), definitions aside. */
export function citedKeys(source: string): Set<string> {
  const out = new Set<string>();
  for (const line of source.split("\n")) {
    if (/^\[@[^\]\s,]+\]:/.test(line)) continue; // a definition is not a citation
    for (const m of line.matchAll(/\[@([^\]\s,]+)(?:,\s*[^\]]+)?\]/g)) out.add(m[1] as string);
  }
  return out;
}

export interface MergeResult {
  source: string;
  /** Keys written into the document. */
  added: string[];
  /** Keys already defined there, left exactly as they were. */
  skipped: string[];
}

export function mergeDefinitions(source: string, definitions: string): MergeResult {
  const have = definedKeys(source);
  const added: string[] = [];
  const skipped: string[] = [];
  const lines: string[] = [];
  for (const line of definitions.split("\n")) {
    const key = /^\[@([^\]\s,]+)\]:/.exec(line)?.[1];
    if (!key) continue;
    if (have.has(key)) {
      skipped.push(key);
      continue;
    }
    have.add(key);
    added.push(key);
    lines.push(line);
  }
  if (lines.length === 0) return { source, added, skipped };

  const block = lines.join("\n");
  const marker = source.split("\n").findIndex((l) => /^\s*\[references\]\s*$/.test(l));
  if (marker >= 0) {
    const before = source.split("\n").slice(0, marker);
    const after = source.split("\n").slice(marker);
    while (before.length && before[before.length - 1]?.trim() === "") before.pop();
    return { source: [...before, "", block, "", ...after].join("\n"), added, skipped };
  }
  const tail = source.replace(/\s*$/, "");
  return { source: `${tail}\n\n${block}\n`, added, skipped };
}

/** What to tell the reader after an import: how many landed, how many were
    already there, and which of them nothing cites yet. */
export function importReport(result: MergeResult, source: string): string {
  const cited = citedKeys(source);
  const uncited = result.added.filter((k) => !cited.has(k));
  const parts = [`${result.added.length} reference${result.added.length === 1 ? "" : "s"} added`];
  if (result.skipped.length) parts.push(`${result.skipped.length} already defined`);
  if (uncited.length === result.added.length && result.added.length > 0) {
    parts.push("none cited yet — write [@key] where you need them");
  } else if (uncited.length) {
    parts.push(`${uncited.length} not cited yet`);
  }
  return parts.join(" · ");
}
