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

interface DocForgeDB extends DBSchema {
  documents: { key: string; value: StoredDoc };
}

let db: Promise<IDBPDatabase<DocForgeDB>> | null = null;
function open(): Promise<IDBPDatabase<DocForgeDB>> {
  db ??= openDB<DocForgeDB>("docforge", 1, {
    upgrade(d) {
      d.createObjectStore("documents", { keyPath: "id" });
    },
  });
  return db;
}

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
