"use client";
/* Focus mode + the mobile pane — the two body-attribute stores behind the
   responsive blocks in app/globals.css. Zustand state is the truth; each
   store mirrors itself onto <body> as a data attribute the stylesheet keys:
     body[data-focus]         clear the desk — the writer and the page only
     body[data-mobile-pane]   under 900px, which column the one-column desk shows
   (Port of the classic focus mode: src/js/main.js toggleFocus + the Escape
   branch of its keydown handler — Esc leaves focus mode, but only when no
   overlay is open on the desk.) */
import { create } from "zustand";

/* ---------------- focus mode ---------------- */

export interface FocusModeState {
  on: boolean;
  /** Enter/leave focus mode: mirrors body[data-focus] and arms/disarms Esc. */
  set: (on: boolean) => void;
  toggle: () => void;
}

/* Mirrors anyDialogOpen() in components/command-palette.tsx — duplicated here
   so the store never drags component modules into its graph. */
function dialogOpen(): boolean {
  return (
    document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
    ) !== null
  );
}

/* The store's own exit key, armed only while focus mode is on. Esc means
   "close the sheet" first (classic behaviour), and anything that already
   handled the key — the find bar, a CodeMirror keymap — keeps it. */
function onEsc(e: KeyboardEvent) {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  if (dialogOpen()) return;
  useFocusMode.getState().set(false);
}

export const useFocusMode = create<FocusModeState>((set, get) => ({
  on: false,
  set: (on) => {
    if (on === get().on || typeof document === "undefined") return;
    if (on) {
      document.body.setAttribute("data-focus", "");
      document.addEventListener("keydown", onEsc);
    } else {
      document.body.removeAttribute("data-focus");
      document.removeEventListener("keydown", onEsc);
    }
    set({ on });
  },
  toggle: () => get().set(!get().on),
}));

/* ---------------- the mobile pane (the one-column desk under 900px) ---------------- */

export type MobilePane = "source" | "preview";

export interface MobilePaneState {
  /** Which column the one-column desk shows; the page (preview) by default —
      the stylesheet treats a body with no data-mobile-pane as "preview". */
  pane: MobilePane;
  setPane: (pane: MobilePane) => void;
}

export const useMobilePane = create<MobilePaneState>((set) => ({
  pane: "preview",
  setPane: (pane) => {
    if (typeof document !== "undefined") {
      document.body.setAttribute("data-mobile-pane", pane);
    }
    set({ pane });
  },
}));
