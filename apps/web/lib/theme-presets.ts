"use client";
/* ============================================================
   theme-presets.ts — a house style, saved (§8.2 theme designer).

   The studio already lets a reader set every part of a look; what it
   lacked was memory. A preset is the LOOK of the current document —
   theme, accent, page, margins, typefaces, size, leading, borders,
   the running head, the citation style — with none of its content.
   That line is the whole design: a saved look must never carry a
   title, an author or a date into somebody else's assignment.

   Presets live on the device, and travel as plain JSON so a class
   can share one house style in a file.
   ============================================================ */
import { docforgeDB, type StoredPreset } from "./persistence";
import type { Settings } from "./settings";

/** The settings that make a LOOK. Anything not on this list is content. */
export const LOOK_KEYS = [
  "theme",
  "accent",
  "page",
  "orientation",
  "margins",
  "fontHead",
  "fontBody",
  "baseSize",
  "lineSpacing",
  "borderStyle",
  "borderWeight",
  "borderColor",
  "header",
  "pageNums",
  "numbered",
  "justify",
  "h1break",
  "citeStyle",
  "headerLeft",
  "headerRight",
  "footerLeft",
  "footerRight",
] as const;

export type LookKey = (typeof LOOK_KEYS)[number];
export type Look = Partial<Record<LookKey, unknown>>;

export interface ThemePreset {
  /** The reader's name for it, and its key. */
  name: string;
  look: Look;
  savedAt: number;
}

/** Take the look out of a document's settings, leaving the content behind. */
export function lookOf(settings: Settings): Look {
  const look: Look = {};
  for (const key of LOOK_KEYS) {
    const value = (settings as Record<string, unknown>)[key];
    if (value !== undefined) look[key] = value;
  }
  return look;
}

/** Keep only the keys a look may carry — a preset from a file cannot smuggle
    a title, a source, or anything else into the document it is applied to. */
export function sanitiseLook(raw: unknown): Look {
  const look: Look = {};
  if (!raw || typeof raw !== "object") return look;
  const obj = raw as Record<string, unknown>;
  for (const key of LOOK_KEYS) {
    const v = obj[key];
    if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") look[key] = v;
  }
  return look;
}

/** The file a class shares. */
export interface PresetFile {
  app: "docforge-theme";
  v: 1;
  name: string;
  look: Look;
}

export function serialisePreset(preset: ThemePreset): string {
  return `${JSON.stringify(
    { app: "docforge-theme", v: 1, name: preset.name, look: preset.look } satisfies PresetFile,
    null,
    2,
  )}\n`;
}

/** Read a shared preset. Throws with a reason a reader can act on. */
export function parsePreset(text: string): ThemePreset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't JSON");
  }
  const obj = (raw ?? {}) as Record<string, unknown>;
  if (obj.app !== "docforge-theme") throw new Error("That isn't a DocForge theme file");
  const look = sanitiseLook(obj.look);
  if (Object.keys(look).length === 0) throw new Error("That theme file carries no settings");
  const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : "Shared theme";
  return { name: name.slice(0, 60), look, savedAt: Date.now() };
}

/* ---------------- the shelf ---------------- */

export async function listPresets(): Promise<ThemePreset[]> {
  try {
    const all = await (await docforgeDB()).getAll("presets");
    return (all as StoredPreset[]).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function savePreset(name: string, settings: Settings): Promise<ThemePreset> {
  const preset: ThemePreset = {
    name: name.trim().slice(0, 60) || "Untitled look",
    look: lookOf(settings),
    savedAt: Date.now(),
  };
  await (await docforgeDB()).put("presets", preset);
  return preset;
}

export async function storePreset(preset: ThemePreset): Promise<void> {
  await (await docforgeDB()).put("presets", preset);
}

export async function deletePreset(name: string): Promise<void> {
  try {
    await (await docforgeDB()).delete("presets", name);
  } catch {}
}
