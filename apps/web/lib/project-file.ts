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
    throw new Error(`Not a DocForge project file: ${parsed.error.issues[0]?.message ?? "unrecognised shape"}`);
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

/** Save through the File System Access API where it exists; download fallback. */
export async function saveProjectFile(doc: ProjectDoc): Promise<"saved" | "downloaded"> {
  const json = serializeProject(doc);
  const name = `${((doc.settings.title as string) || "document").replace(/[^\w-]+/g, "-").slice(0, 60) || "document"}.docforge.json`;
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (o: {
        suggestedName: string;
        types: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<{ createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }> }>;
    }
  ).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: name,
        types: [{ description: "DocForge project", accept: { "application/json": [".json"] } }],
      });
      const w = await handle.createWritable();
      await w.write(json);
      await w.close();
      return "saved";
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
  return "downloaded";
}
