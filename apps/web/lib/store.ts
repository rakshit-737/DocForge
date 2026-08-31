"use client";
/* Zustand stores. The document store is the single source of truth both panes
   edit; the ui store is chrome state. Persistence (IndexedDB) arrives in
   stage 4 and hangs off subscribe(). */
import { create } from "zustand";
import { defaultSettings, THEME_ACCENT, type Settings } from "./settings";

export interface DocState {
  source: string;
  settings: Settings;
  attachments: Record<string, unknown>;
  /** True when the accent was picked by hand — theme switches stop following. */
  accentTouched: boolean;
  setSource: (source: string) => void;
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
  setZoom: (zoomMode, zoomVal) =>
    set((s) => ({ zoomMode, zoomVal: zoomVal ?? s.zoomVal })),
  setPageInfo: (pageInfo) => set({ pageInfo }),
  setBusy: (busy) => set({ busy }),
}));
