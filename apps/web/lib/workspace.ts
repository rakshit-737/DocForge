"use client";
/* ============================================================
   workspace.ts — more than one document (§8.1).

   The studio had exactly one slot, so every way of starting
   something new had to destroy what was there: a template load, an
   import, "New document". This is the answer to that whole bug
   class — documents are a list, starting one is additive, and the
   only destructive act left is the one called Delete.

   Everything is local: the same IndexedDB `documents` store, one
   record per document, with the live id remembered in
   localStorage so a reload comes back to the desk you left.
   Readers who arrive from before this existed keep the "current"
   slot they already had, and it simply becomes the first document
   in their list.
   ============================================================ */
import { create } from "zustand";
import { toast } from "./find";
import {
  activeDocId,
  CURRENT,
  docforgeDB,
  persistNow,
  type StoredDoc,
  setActiveDocId,
} from "./persistence";
import { forgetOpenFile } from "./project-file";
import { defaultSettings, type Settings } from "./settings";
import { useDocStore } from "./store";
import { clearVersions } from "./versions";

const ACTIVE_KEY = "docforge.activeDoc";

export interface DocSummary {
  id: string;
  title: string;
  updatedAt: number;
  words: number;
}

/** What to call a document in the rack. The document's own title field comes
    first (it is what the cover and the masthead print), then its opening
    heading — a rack where everything reads "Untitled document" would be no
    rack at all, and the first heading is what a writer actually recognises. */
export function docLabel(d: { title?: string; source?: string; settings?: Settings }): string {
  /* `d.title` carries the stored placeholder for an untitled document, which
     would otherwise beat the heading the writer can actually recognise. */
  const stored = d.title && d.title !== "Untitled document" ? d.title : "";
  const titled = (d.settings?.title as string) || stored;
  if (titled.trim()) return titled.trim();
  const heading = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m.exec(d.source ?? "")?.[1];
  if (heading?.trim()) return heading.trim().slice(0, 80);
  const firstLine = (d.source ?? "").split("\n").find((l) => l.trim());
  return firstLine ? firstLine.trim().slice(0, 60) : "Untitled document";
}

const summarise = (d: StoredDoc): DocSummary => ({
  id: d.id,
  title: docLabel(d),
  updatedAt: d.updatedAt ?? 0,
  words: (d.source?.trim().match(/\S+/g) ?? []).length,
});

export async function listDocuments(): Promise<DocSummary[]> {
  try {
    const all = await (await docforgeDB()).getAll("documents");
    return all.map(summarise).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

const newId = (): string => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Remember the live document across reloads. localStorage, not IndexedDB:
    it is one short string, read before anything else can be awaited. */
function rememberActive(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* private mode — the session still works, it just always opens `current` */
  }
}
export function readActive(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) || CURRENT;
  } catch {
    return CURRENT;
  }
}

/** Write the live document to its slot, then point everything at another one
    and load it. The save happens FIRST: switching must never be the thing
    that loses a paragraph. */
export async function switchTo(id: string): Promise<boolean> {
  if (id === activeDocId()) return true;
  try {
    await persistNow();
  } catch {
    /* storage refused — carry on rather than trapping the reader here */
  }
  const doc = await (await docforgeDB()).get("documents", id);
  if (!doc) return false;
  /* The file handle belonged to the document we are leaving; carrying it
     across would let a save write one manuscript over another's file. */
  forgetOpenFile();
  setActiveDocId(id);
  rememberActive(id);
  useDocStore.getState().replaceDocument({
    source: doc.source,
    settings: doc.settings,
    attachments: doc.attachments,
  });
  return true;
}

/** Start a document beside the current one — nothing is replaced. */
export async function createDocument(seed?: {
  source: string;
  settings?: Partial<Settings>;
  attachments?: Record<string, unknown>;
  title?: string;
}): Promise<DocSummary> {
  try {
    await persistNow();
  } catch {}
  const id = newId();
  const settings = { ...defaultSettings(), ...(seed?.settings ?? {}) } as Settings;
  if (seed?.title) (settings as Record<string, unknown>).title = seed.title;
  const doc: StoredDoc = {
    id,
    title: (settings.title as string) || "Untitled document",
    source: seed?.source ?? "",
    settings,
    attachments: seed?.attachments ?? {},
    updatedAt: Date.now(),
  };
  await (await docforgeDB()).put("documents", doc);
  forgetOpenFile();
  setActiveDocId(id);
  rememberActive(id);
  useDocStore.getState().replaceDocument({
    source: doc.source,
    settings: doc.settings,
    attachments: doc.attachments,
  });
  return summarise(doc);
}

/** A copy of a document, opened. */
export async function duplicateDocument(id: string): Promise<DocSummary | null> {
  const doc = await (await docforgeDB()).get("documents", id);
  if (!doc) return null;
  const title = `${(doc.settings?.title as string) || doc.title || "Untitled document"} copy`;
  return createDocument({
    source: doc.source,
    settings: doc.settings,
    attachments: doc.attachments,
    title,
  });
}

/** Delete a document and its timeline. Returns the id now live. */
export async function deleteDocument(id: string): Promise<string> {
  const db = await docforgeDB();
  await db.delete("documents", id);
  await clearVersions(id);
  if (id !== activeDocId()) return activeDocId();
  const rest = await listDocuments();
  const next = rest[0];
  if (next) {
    setActiveDocId(next.id);
    rememberActive(next.id);
    const doc = await db.get("documents", next.id);
    if (doc) {
      useDocStore.getState().replaceDocument({
        source: doc.source,
        settings: doc.settings,
        attachments: doc.attachments,
      });
    }
    return next.id;
  }
  /* The last one went: start a blank so the desk is never empty of a slot to
     write in, and so the next autosave has somewhere to land. */
  const fresh = await createDocument({ source: "" });
  return fresh.id;
}

/** Rename by writing the document's own title field — the same value the
    cover and the masthead read, so there is only ever one name. */
export async function renameDocument(id: string, title: string): Promise<void> {
  const db = await docforgeDB();
  const doc = await db.get("documents", id);
  if (!doc) return;
  const settings = { ...doc.settings, title } as Settings;
  await db.put("documents", { ...doc, title, settings, updatedAt: Date.now() });
  if (id === activeDocId()) useDocStore.getState().patchSettings({ title });
}

/* ---------------- the roster, for the chrome ---------------- */

export const useWorkspace = create<{
  docs: DocSummary[];
  activeId: string;
  refresh(): Promise<void>;
  open(id: string): Promise<void>;
  create(seed?: Parameters<typeof createDocument>[0]): Promise<DocSummary>;
  duplicate(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  rename(id: string, title: string): Promise<void>;
}>((set, get) => ({
  docs: [],
  activeId: CURRENT,
  async refresh() {
    set({ docs: await listDocuments(), activeId: activeDocId() });
  },
  async open(id) {
    if (await switchTo(id)) await get().refresh();
    else toast("That document is gone", "warn");
  },
  /** Resolves with the new document, and says nothing: the caller knows
      whether this was a New, a template or an import, and owns the words. */
  async create(seed) {
    const made = await createDocument(seed);
    await get().refresh();
    return made;
  },
  async duplicate(id) {
    const copy = await duplicateDocument(id);
    await get().refresh();
    if (copy) toast(`Copied to “${copy.title}”`);
  },
  async remove(id) {
    await deleteDocument(id);
    await get().refresh();
  },
  async rename(id, title) {
    await renameDocument(id, title);
    await get().refresh();
  },
}));

/** Called once at boot, before the first restore: point persistence at the
    document the reader left open. */
export function adoptRememberedDocument(): string {
  const id = readActive();
  setActiveDocId(id);
  return id;
}
