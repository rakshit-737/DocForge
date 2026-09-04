"use client";
/* .docforge.json — the project-file contract, now Zod-validated and versioned.
   Every historical shape opens: v1 files carrying the legacy single `pageBorder`
   key are translated exactly the way classic normalizeSettings did. */
import { z } from "zod";
import { defaultSettings, type Settings } from "./settings";

const ProjectV1 = z.object({
  app: z.literal("docforge"),
  v: z.number().int().min(1).max(1),
  savedAt: z.string().optional(),
  settings: z.record(z.string(), z.unknown()),
  source: z.string(),
  attachments: z.record(z.string(), z.unknown()).optional(),
});

export interface ProjectDoc {
  source: string;
  settings: Settings;
  attachments: Record<string, unknown>;
}

/* Classic main.js: projects saved before the border system grew options carry a
   single pageBorder key — translate it and never write it back. */
function migrateSettings(raw: Record<string, unknown>): Settings {
  const s: Record<string, unknown> = { ...defaultSettings(), ...raw };
  if (raw.pageBorder != null && raw.borderStyle == null) {
    const legacy = String(raw.pageBorder);
    s.borderStyle = legacy === "none" ? "none" : legacy;
    s.borderWeight = "medium";
    s.borderColor = "ink";
  }
  delete s.pageBorder;
  return s as Settings;
}

export function parseProject(text: string): ProjectDoc {
  const parsed = ProjectV1.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error(
      `Not a DocForge project file: ${parsed.error.issues[0]?.message ?? "unrecognised shape"}`,
    );
  }
  const p = parsed.data;
  return {
    source: p.source,
    settings: migrateSettings(p.settings),
    attachments: (p.attachments as Record<string, unknown>) ?? {},
  };
}

export function serializeProject(doc: ProjectDoc): string {
  return JSON.stringify(
    {
      app: "docforge",
      v: 1,
      savedAt: new Date().toISOString(),
      settings: doc.settings,
      source: doc.source,
      attachments: doc.attachments,
    },
    null,
    2,
  );
}

/* ============================================================
   Files on the disk (Phase 5) — open and save IN PLACE where the
   File System Access API exists, with the classic download road as
   the fallback everywhere else.

   The DOM lib doesn't carry these interfaces at the TypeScript this
   workspace pins, so the surface is declared as narrowly as the code
   actually uses it — no `any`, no lib bump.
   ============================================================ */

interface FsWritable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface FsFileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FsWritable>;
  queryPermission?(o: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(o: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}
interface FsPickerType {
  description: string;
  accept: Record<string, string[]>;
}
interface FsWindow {
  showOpenFilePicker?: (o: {
    multiple?: boolean;
    types?: FsPickerType[];
  }) => Promise<FsFileHandle[]>;
  showSaveFilePicker?: (o: {
    suggestedName: string;
    types: FsPickerType[];
  }) => Promise<FsFileHandle>;
}
const fsWindow = (): FsWindow => window as unknown as FsWindow;

/** True where the browser hands back a writable handle (Chromium today). */
export function supportsFileSystemAccess(): boolean {
  return typeof window !== "undefined" && typeof fsWindow().showOpenFilePicker === "function";
}

/** What kind of text the open file holds — it decides what a save writes back. */
export type OpenKind = "project" | "markdown";
interface OpenTarget {
  handle: FsFileHandle;
  kind: OpenKind;
  name: string;
}
/* Module-lived, like the classic closure: the file the studio currently has
   open, or null when the document came from anywhere else (a template, an
   import, a drop). Saving in place is only ever offered for THIS file. */
let target: OpenTarget | null = null;

/** The file the next save would overwrite, if any — for the Save affordance. */
export function openFileName(): string | null {
  return target?.name ?? null;
}

/** Any document replacement that isn't "the file we opened" drops the target,
    so a template load can never overwrite the reader's manuscript on disk. */
export function forgetOpenFile(): void {
  target = null;
}

const kindOf = (name: string): OpenKind | null =>
  /\.docforge\.json$|\.json$/i.test(name)
    ? "project"
    : /\.(md|markdown|txt)$/i.test(name)
      ? "markdown"
      : null;

/** Open through the picker so the handle survives for later saves. Returns
    null where the API is missing — the caller falls back to its
    `<input type=file>`; an AbortError (the reader cancelled) propagates.
    `adopt()` records the handle: call it once the file actually loaded, and
    only for a shape a save can honestly write back. */
export async function openWithPicker(): Promise<{ file: File; adopt(): void } | null> {
  const picker = fsWindow().showOpenFilePicker;
  if (!picker) return null;
  const [handle] = await picker({
    multiple: false,
    types: [
      {
        description: "DocForge documents",
        accept: {
          "application/json": [".json"],
          "text/markdown": [".md", ".markdown"],
          "text/plain": [".txt"],
        },
      },
      {
        description: "Documents to convert",
        accept: {
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
          "application/pdf": [".pdf"],
          "text/html": [".html", ".htm"],
          "text/csv": [".csv", ".tsv"],
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
          "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
          "application/epub+zip": [".epub"],
          "application/x-ipynb+json": [".ipynb"],
          "image/png": [".png"],
          "image/jpeg": [".jpg", ".jpeg"],
        },
      },
    ],
  });
  if (!handle) return null;
  const file = await handle.getFile();
  const kind = kindOf(file.name);
  return {
    file,
    adopt() {
      /* Only the two shapes DocForge itself writes can be saved back: a .docx
         or .pdf was CONVERTED, and writing markdown over it would be a lie. */
      target = kind ? { handle, kind, name: file.name } : null;
    },
  };
}

async function writable(handle: FsFileHandle): Promise<FsWritable | null> {
  if (handle.queryPermission) {
    let state = await handle.queryPermission({ mode: "readwrite" });
    if (state === "prompt" && handle.requestPermission) {
      state = await handle.requestPermission({ mode: "readwrite" });
    }
    if (state !== "granted") return null;
  }
  return handle.createWritable();
}

export type SaveOutcome =
  | { how: "in-place"; name: string }
  | { how: "saved"; name: string }
  | { how: "downloaded"; name: string };

/** Save the document: back to the open file when there is one, otherwise
    through the save picker (whose handle is then adopted, so the next save
    lands in place), otherwise the download road. */
export async function saveDocumentFile(doc: ProjectDoc): Promise<SaveOutcome> {
  if (target) {
    const w = await writable(target.handle);
    if (w) {
      await w.write(target.kind === "project" ? serializeProject(doc) : doc.source);
      await w.close();
      return { how: "in-place", name: target.name };
    }
    /* Permission withdrawn (a reload drops it) — fall through to the picker
       and let the reader re-point at the file. */
    target = null;
  }

  const json = serializeProject(doc);
  const stem =
    ((doc.settings.title as string) || "document").replace(/[^\w-]+/g, "-").slice(0, 60) ||
    "document";
  const name = `${stem}.docforge.json`;
  const picker = fsWindow().showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: name,
        types: [{ description: "DocForge project", accept: { "application/json": [".json"] } }],
      });
      const w = await handle.createWritable();
      await w.write(json);
      await w.close();
      target = { handle, kind: "project", name: handle.name || name };
      return { how: "saved", name: target.name };
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") throw e;
      /* fall through to download */
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return { how: "downloaded", name };
}
