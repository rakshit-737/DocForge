"use client";
/* Local-first persistence — IndexedDB via idb (ledger D3: documents leave
   localStorage). One store, multi-document-ready keys; the studio uses the
   "current" slot until the multi-document workspace arrives (§8.1).

   Ctrl+S = persist locally (ledger I2) — the shell binds it to flushNow and
   stamps the save state; explicit export actions produce files. */
import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import { flushActiveLiveEdit } from "./live-edit";
import type { Settings } from "./settings";
import { useDocStore } from "./store";

export interface StoredDoc {
  id: string;
  title: string;
  source: string;
  settings: Settings;
  attachments: Record<string, unknown>;
  updatedAt: number;
}

/* One snapshot on the version timeline (lib/versions.ts owns the policy; the
   shape lives here because the database schema has to be declared in ONE
   place — two openDB calls at different versions deadlock, the second waiting
   forever for the first connection to close). */
export interface StoredVersion {
  id: string;
  at: number;
  kind: "auto" | "manual";
  label?: string;
  docId: string;
  source: string;
  settings: Settings;
  words: number;
}

/* A typeface the reader supplied (lib/user-fonts.ts owns the reading and the
   registration). Keyed by family name, so a second file of the same family
   adds its cut instead of making a rival entry. Device-scoped on purpose:
   these bytes have no business inside every autosave. */
export interface StoredUserFont {
  name: string;
  stem: string;
  kind: "sans" | "serif";
  cuts: Partial<Record<"regular" | "bold" | "italic" | "boldItalic", string>>;
  addedAt: number;
}

interface DocForgeDB extends DBSchema {
  documents: { key: string; value: StoredDoc };
  versions: { key: string; value: StoredVersion; indexes: { "by-time": number } };
  fonts: { key: string; value: StoredUserFont };
}

let db: Promise<IDBPDatabase<DocForgeDB>> | null = null;
/** The one connection to the "docforge" database, shared by every module that
    stores anything. Schema 2 added the version timeline, 3 the reader's own
    typefaces; each upgrade only creates what is missing, so a reader arriving
    from any earlier version keeps everything they had. */
export function docforgeDB(): Promise<IDBPDatabase<DocForgeDB>> {
  db ??= openDB<DocForgeDB>("docforge", 3, {
    upgrade(d) {
      if (!d.objectStoreNames.contains("documents")) {
        d.createObjectStore("documents", { keyPath: "id" });
      }
      if (!d.objectStoreNames.contains("versions")) {
        d.createObjectStore("versions", { keyPath: "id" }).createIndex("by-time", "at");
      }
      if (!d.objectStoreNames.contains("fonts")) {
        d.createObjectStore("fonts", { keyPath: "name" });
      }
    },
  });
  return db;
}
const open = docforgeDB;

const CURRENT = "current";
let timer: ReturnType<typeof setTimeout> | null = null;
let lastSavedAt = 0;

export async function persistNow(): Promise<number> {
  flushActiveLiveEdit(); // any pending manuscript edit reaches the source first
  const { source, settings, attachments } = useDocStore.getState();
  const doc: StoredDoc = {
    id: CURRENT,
    title: (settings.title as string) || "Untitled document",
    source,
    settings,
    attachments,
    updatedAt: Date.now(),
  };
  await (await open()).put("documents", doc);
  lastSavedAt = doc.updatedAt;
  return doc.updatedAt;
}

export function savedAt(): number {
  return lastSavedAt;
}

/** Restore the last session's document; true when something was restored. */
export async function restoreSession(): Promise<boolean> {
  try {
    const doc = await (await open()).get("documents", CURRENT);
    if (!doc || (!doc.source && !doc.settings?.title)) return false;
    useDocStore.getState().replaceDocument({
      source: doc.source,
      settings: doc.settings,
      attachments: doc.attachments,
    });
    lastSavedAt = doc.updatedAt;
    return true;
  } catch {
    return false;
  }
}

/** Debounced autosave, armed once by the shell. Returns the unsubscribe. */
export function armAutosave(onSaved?: (at: number) => void): () => void {
  const unsub = useDocStore.subscribe((s, prev) => {
    if (
      s.source === prev.source &&
      s.settings === prev.settings &&
      s.attachments === prev.attachments
    )
      return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const at = await persistNow();
        onSaved?.(at);
      } catch {
        /* quota/private-mode — the wire ticker shows unsaved state instead */
      }
    }, 900);
  });
  return () => {
    unsub();
    if (timer) clearTimeout(timer);
  };
}
