"use client";
/* Zustand stores. The document store is the single source of truth both panes
   edit; the ui store is chrome state. Persistence (IndexedDB) arrives in
   stage 4 and hangs off subscribe(). */
import { create } from "zustand";
import { defaultSettings, type Settings, THEME_ACCENT } from "./settings";

/** A single-range source change (live-edit write-back): replace the
    characters [from, to) with `insert`. */
export interface SourceSplice {
  from: number;
  to: number;
  insert: string;
}

/* The splice behind the latest spliceSource call, held outside the store so
   nothing re-renders off it. The source pane consumes it (once) to dispatch
   a minimal CodeMirror change instead of replacing the whole document; a
   stale or unconsumed descriptor is harmless — consumers verify it against
   the actual before/after strings and fall back to the whole-replace path. */
let pendingSplice: SourceSplice | null = null;
export function consumeSplice(): SourceSplice | null {
  const s = pendingSplice;
  pendingSplice = null;
  return s;
}

export interface DocState {
  source: string;
  settings: Settings;
  attachments: Record<string, unknown>;
  /** True when the accent was picked by hand — theme switches stop following. */
  accentTouched: boolean;
  setSource: (source: string) => void;
  /** Live-edit write-back: equivalent to setSource on the spliced string, but
      records the change shape so the source pane can keep its own caret,
      scroll and native history (see consumeSplice). */
  spliceSource: (from: number, to: number, insert: string) => void;
  patchSettings: (patch: Partial<Settings>) => void;
  replaceDocument: (doc: {
    source: string;
    settings: Settings;
    attachments?: Record<string, unknown>;
  }) => void;
}

export const useDocStore = create<DocState>((set) => ({
  source: "",
  settings: defaultSettings(),
  attachments: {},
  accentTouched: false,
  setSource: (source) => set({ source }),
  spliceSource: (from, to, insert) =>
    set((s) => {
      pendingSplice = { from, to, insert };
      return { source: s.source.slice(0, from) + insert + s.source.slice(to) };
    }),
  patchSettings: (patch) =>
    set((s) => {
      const next = { ...s.settings, ...patch };
      let accentTouched = s.accentTouched || "accent" in patch;
      // The classic behaviour: switching themes re-inks the accent until the
      // user has chosen one deliberately.
      if ("theme" in patch && !("accent" in patch) && !s.accentTouched) {
        next.accent = THEME_ACCENT[next.theme] ?? next.accent;
        accentTouched = s.accentTouched;
      }
      return { settings: next, accentTouched };
    }),
  replaceDocument: ({ source, settings, attachments }) =>
    set({ source, settings, attachments: attachments ?? {}, accentTouched: false }),
}));

export interface UiState {
  theme: "light" | "dark";
  zoomMode: "fit" | "man";
  zoomVal: number;
  zoomPct: number;
  pageInfo: string;
  busy: boolean;
  toggleTheme: () => void;
  setZoom: (mode: "fit" | "man", val?: number) => void;
  setPageInfo: (s: string) => void;
  setBusy: (b: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: "light",
  zoomMode: "fit",
  zoomVal: 1,
  zoomPct: 100,
  pageInfo: "",
  busy: false,
  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === "light" ? "dark" : "light";
      try {
        localStorage.setItem("docforge.ui.theme", theme);
      } catch {}
      if (theme === "light") document.documentElement.setAttribute("data-light", "");
      else document.documentElement.removeAttribute("data-light");
      return { theme };
    }),
  setZoom: (zoomMode, zoomVal) => set((s) => ({ zoomMode, zoomVal: zoomVal ?? s.zoomVal })),
  setPageInfo: (pageInfo) => set({ pageInfo }),
  setBusy: (busy) => set({ busy }),
}));
