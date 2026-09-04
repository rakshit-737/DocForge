"use client";
/* ============================================================
   user-fonts.ts — the reader's typefaces, installed (§8.2).

   font-file.ts reads the bytes; this module keeps them, registers
   each family with the engine and holds the live roster the press
   and the pickers read. Once registered, a reader's face is a
   first-class one: selectable in the font pickers, drawn in the
   preview and the PDF, and EMBEDDED in the .docx exactly like the
   seven that ship — a Word file that carries its own typeface looks
   the same on a machine that has never heard of it.

     bytes  →  __FONT_DATA__["<stem>-<Cut>"]   (the export contract)
            →  Engine.registerUserFace(...)     (EMBEDDED + FACES)
            →  @font-face CSS for the preview   (userFontCss)

   Fonts are stored per DEVICE, not per document: a 300 KB face has
   no business inside every autosave and every project file. The
   .docx still travels with the bytes embedded, so a document
   exported here reads correctly anywhere.

   The engine arrives only through loadStudio() — it registers its
   marked extensions at import time and must never be pulled in
   before its globals land.
   ============================================================ */
import { create } from "zustand";
import { loadStudio } from "./bootstrap";
import {
  CUT_LABEL,
  cutOf,
  type FontCut,
  kindOf,
  readFontNames,
  stemFor,
  toBase64,
  type UserFont,
  userFontCss,
} from "./font-file";
import { docforgeDB, type StoredUserFont } from "./persistence";

export type { FontCut, UserFont } from "./font-file";
export { CUT_LABEL, cutOf, kindOf, readFontNames, stemFor, userFontCss } from "./font-file";

/* ---------------- the store ---------------- */

export async function listUserFonts(): Promise<UserFont[]> {
  try {
    const all = await (await docforgeDB()).getAll("fonts");
    return (all as StoredUserFont[]).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Add one file. A second file of the same family adds its cut rather than
    replacing the family — upload Regular then Bold and the .docx gets both. */
export async function addUserFont(file: File): Promise<UserFont> {
  const buf = await file.arrayBuffer();
  const names = readFontNames(buf);
  const cut = cutOf(names.subfamily);
  const stem = stemFor(names.family);
  const db = await docforgeDB();
  const existing = (await db.get("fonts", names.family)) as StoredUserFont | undefined;
  const font: UserFont = {
    name: names.family,
    stem,
    kind: existing?.kind ?? kindOf(names.family),
    cuts: { ...(existing?.cuts ?? {}), [cut]: toBase64(new Uint8Array(buf)) },
    addedAt: existing?.addedAt ?? Date.now(),
  };
  await db.put("fonts", font);
  await applyUserFont(font);
  return font;
}

export async function removeUserFont(name: string): Promise<void> {
  try {
    const db = await docforgeDB();
    const font = (await db.get("fonts", name)) as StoredUserFont | undefined;
    await db.delete("fonts", name);
    if (font) {
      const { Engine } = await loadStudio();
      Engine.unregisterUserFaces([faceKey(font)]);
      const data = fontData();
      for (const cut of Object.keys(font.cuts)) {
        delete data[`${font.stem}-${CUT_LABEL[cut as FontCut]}`];
      }
    }
  } catch {}
}

export const faceKey = (font: Pick<UserFont, "stem">): string => `user:${font.stem}`;

function fontData(): Record<string, string> {
  const g = globalThis as { __FONT_DATA__?: Record<string, string> };
  g.__FONT_DATA__ ??= {};
  return g.__FONT_DATA__;
}

/** Put one font's bytes and face registration in place. The engine arrives
    through loadStudio, never as a static import. */
export async function applyUserFont(font: UserFont): Promise<void> {
  const data = fontData();
  const cuts: Record<string, 1> = {};
  for (const [cut, b64] of Object.entries(font.cuts)) {
    if (!b64) continue;
    data[`${font.stem}-${CUT_LABEL[cut as FontCut]}`] = b64;
    cuts[cut] = 1;
  }
  if (!cuts.regular) return; // a family without its regular cut can't stand alone
  const { Engine } = await loadStudio();
  Engine.registerUserFace({
    key: faceKey(font),
    name: font.name,
    stem: font.stem,
    kind: font.kind,
    label: `${font.name} — yours`,
    family: font.kind === "serif" ? "roman" : "swiss",
    pitch: "variable",
    cuts,
  });
}

/* The live set, so the press can ask without touching IndexedDB mid-compose. */
let installed: UserFont[] = [];
export const installedFonts = (): UserFont[] => installed;
/** The @font-face block the press appends to its stylesheet. Synchronous and
    engine-free: it runs inside compose. */
export const installedFontCss = (): string => userFontCss(installed);

/** Load everything the reader has installed and register it. Called once at
    boot, and again after any change. */
export async function loadUserFonts(): Promise<UserFont[]> {
  installed = await listUserFonts();
  for (const font of installed) await applyUserFont(font);
  return installed;
}

/** The FACES-shaped entries for the reader's own families, so a picker can
    list them straight from the store rather than re-reading Engine.FACES
    after every install. Only families with a regular cut can stand alone. */
export function userFaceEntries(
  fonts: UserFont[],
): Record<string, { name: string; kind: "sans" | "serif"; label: string }> {
  const out: Record<string, { name: string; kind: "sans" | "serif"; label: string }> = {};
  for (const f of fonts) {
    if (!f.cuts.regular) continue;
    out[faceKey(f)] = { name: f.name, kind: f.kind, label: `${f.name} — yours` };
  }
  return out;
}

/* The pickers read Engine.FACES once, so a font added mid-session needs a
   signal. `tick` is that signal: it changes whenever the roster does, and
   every catalogue hook depends on it. */
export const useUserFonts = create<{
  fonts: UserFont[];
  tick: number;
  refresh(): Promise<void>;
  add(file: File): Promise<UserFont>;
  remove(name: string): Promise<void>;
}>((set, get) => ({
  fonts: [],
  tick: 0,
  async refresh() {
    const fonts = await loadUserFonts();
    set({ fonts, tick: get().tick + 1 });
  },
  async add(file: File) {
    const font = await addUserFont(file);
    await get().refresh();
    return font;
  },
  async remove(name: string) {
    await removeUserFont(name);
    await get().refresh();
  },
}));
