"use client";
/* ============================================================
   versions.ts — the local timeline (§8.1, spec in
   docs/specs/version-history.md).

   Autosave keeps ONE state: the current one. This keeps the road
   back. Snapshots land automatically when the desk goes quiet and
   on demand as labelled checkpoints, live in the same IndexedDB
   database as the document, and restore through the shell's
   undoable replace.

   Snapshots carry source + settings only. Attachments are
   content-addressed in the live document and can be megabytes
   each; copying them 60 times would spend the origin's quota to
   duplicate bytes the restored source already resolves.
   ============================================================ */
import { flushActiveLiveEdit } from "./live-edit";
import { activeDocId, docforgeDB, type StoredVersion } from "./persistence";
import { useDocStore } from "./store";

export type VersionKind = "auto" | "manual";
/** One state on the timeline. The shape is declared with the database schema
    (lib/persistence.ts) because IndexedDB wants a single declared version —
    this module owns the policy, that one owns the connection. */
export type Version = StoredVersion;

/* The timeline follows whichever document is live — each keeps its own
   history, and switching documents switches the drawer with it. */
const DOC_ID = () => activeDocId();
/** The timeline's ceiling. 60 states is days of work at the snapshot cadence. */
export const CAP = 60;
/** Quiet time before an automatic snapshot is considered. */
export const IDLE_MS = 20_000;
/** An automatic snapshot needs one of these to be true. */
export const MIN_GAP_MS = 3 * 60_000;
export const MIN_CHARS = 500;

export const countWords = (source: string): number => (source.trim().match(/\S+/g) ?? []).length;

/* ---------------- policy (pure — the tested half) ---------------- */

/** Should the quiet desk mint an automatic snapshot? */
export function shouldSnapshot(
  now: number,
  source: string,
  last: { at: number; source: string } | null,
): boolean {
  if (!source.trim()) return false;
  if (!last) return true;
  if (source === last.source) return false;
  if (now - last.at >= MIN_GAP_MS) return true;
  return Math.abs(source.length - last.source.length) >= MIN_CHARS;
}

/** Which entries fall off the end, oldest automatic first: a checkpoint the
    reader asked for should outlive one the machine took. Returns the ids to
    drop, given the timeline newest-first. */
export function pruneVictims(entries: Version[], cap = CAP): string[] {
  if (entries.length <= cap) return [];
  let excess = entries.length - cap;
  const victims: string[] = [];
  const oldestFirst = [...entries].sort((a, b) => a.at - b.at);
  for (const v of oldestFirst) {
    if (excess === 0) break;
    if (v.kind === "auto") {
      victims.push(v.id);
      excess--;
    }
  }
  /* Only manual checkpoints left and still over the cap — the oldest of those
     go, rather than letting the store grow without bound. */
  for (const v of oldestFirst) {
    if (excess === 0) break;
    if (!victims.includes(v.id)) {
      victims.push(v.id);
      excess--;
    }
  }
  return victims;
}

export interface DiffRow {
  type: "same" | "add" | "del";
  text: string;
}

/** Line diff, longest-common-subsequence, no dependency. `a` is the older
    text (what would come back), `b` the current one (what stands now), so an
    "add" is a line the current document has and the snapshot does not. */
export function diffLines(a: string, b: string): DiffRow[] {
  const A = a.split("\n");
  const B = b.split("\n");
  /* LCS table over lines. The corpus here is one document, so the O(n·m)
     table is fine; a runaway pair is cut off rather than freezing the desk. */
  const LIMIT = 4000;
  if (A.length > LIMIT || B.length > LIMIT) {
    return [
      { type: "del", text: `${A.length} lines in the snapshot` },
      { type: "add", text: `${B.length} lines in the document now` },
    ];
  }
  const n = A.length;
  const m = B.length;
  /* One flat Int32Array rather than an array of arrays: the same table, a
     third of the allocations, and no index that needs asserting away. */
  const W = m + 1;
  const table = new Int32Array((n + 1) * W);
  const lcs = (i: number, j: number): number => table[i * W + j] ?? 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * W + j] =
        A[i] === B[j] ? lcs(i + 1, j + 1) + 1 : Math.max(lcs(i + 1, j), lcs(i, j + 1));
    }
  }
  const out: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ type: "same", text: A[i] ?? "" });
      i++;
      j++;
    } else if (lcs(i + 1, j) >= lcs(i, j + 1)) {
      out.push({ type: "del", text: A[i] ?? "" });
      i++;
    } else {
      out.push({ type: "add", text: B[j] ?? "" });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: A[i++] ?? "" });
  while (j < m) out.push({ type: "add", text: B[j++] ?? "" });
  return out;
}

/** Collapse long runs of unchanged lines to a context window, the way a
    review sheet does — a 300-line document with one edit should read as one
    edit, not as 300 rows. */
export function condense(
  rows: DiffRow[],
  context = 2,
): (DiffRow | { type: "gap"; text: string })[] {
  const keep = new Set<number>();
  rows.forEach((r, i) => {
    if (r.type === "same") return;
    for (let k = i - context; k <= i + context; k++) if (k >= 0 && k < rows.length) keep.add(k);
  });
  const out: (DiffRow | { type: "gap"; text: string })[] = [];
  let skipped = 0;
  rows.forEach((r, i) => {
    if (keep.has(i)) {
      if (skipped) {
        out.push({ type: "gap", text: `… ${skipped} unchanged line${skipped === 1 ? "" : "s"}` });
        skipped = 0;
      }
      out.push(r);
    } else {
      skipped++;
    }
  });
  if (skipped) {
    out.push({ type: "gap", text: `… ${skipped} unchanged line${skipped === 1 ? "" : "s"}` });
  }
  return out;
}

/* ---------------- the store ---------------- */

const newId = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function listVersions(docId = DOC_ID()): Promise<Version[]> {
  try {
    const all = await (await docforgeDB()).getAll("versions");
    return all.filter((v) => v.docId === docId).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

/** Write a snapshot of the CURRENT document. Returns it, or null when the
    policy declined (automatic snapshots only) or storage refused. */
export async function snapshot(
  kind: VersionKind = "manual",
  label?: string,
  docId = DOC_ID(),
): Promise<Version | null> {
  try {
    flushActiveLiveEdit(); // a pending manuscript edit belongs in the snapshot
    const { source, settings } = useDocStore.getState();
    const existing = await listVersions(docId);
    const last = existing[0] ?? null;
    if (kind === "auto" && !shouldSnapshot(Date.now(), source, last)) return null;
    if (kind === "manual" && !source.trim()) return null;
    const v: Version = {
      id: newId(),
      at: Date.now(),
      kind,
      docId,
      source,
      settings,
      words: countWords(source),
      ...(label ? { label } : {}),
    };
    const d = await docforgeDB();
    await d.put("versions", v);
    const victims = pruneVictims([v, ...existing]);
    for (const id of victims) await d.delete("versions", id);
    return v;
  } catch {
    /* quota or private mode — the timeline is a comfort, never a blocker */
    return null;
  }
}

export async function deleteVersion(id: string): Promise<void> {
  try {
    await (await docforgeDB()).delete("versions", id);
  } catch {}
}

export async function clearVersions(docId = DOC_ID()): Promise<void> {
  try {
    const d = await docforgeDB();
    for (const v of await listVersions(docId)) await d.delete("versions", v.id);
  } catch {}
}

/** Arm automatic snapshots: after IDLE_MS of quiet, offer one to the policy.
    Returns the disarm, like armAutosave. */
export function armVersionSnapshots(onSnapshot?: (v: Version) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsub = useDocStore.subscribe((s, prev) => {
    if (s.source === prev.source) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const v = await snapshot("auto");
      if (v) onSnapshot?.(v);
    }, IDLE_MS);
  });
  return () => {
    unsub();
    if (timer) clearTimeout(timer);
  };
}
