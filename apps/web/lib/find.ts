"use client";
/* Find & replace machinery on @codemirror/search, plus the desk's toast store.
   The FindBar (components/find-bar.tsx) is the face; this module owns the
   search state: a custom copy-desk panel drives SearchQuery/setSearchQuery
   directly, the built-in match decorations do the highlighting, and a
   SearchCursor counts matches for the honest "n of m" readout (ledger I8).
   Replace-all runs as one CM transaction, so Ctrl+Z takes it back whole. */
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  replaceAll,
  replaceNext,
  SearchQuery,
  search,
  searchPanelOpen,
  setSearchQuery,
} from "@codemirror/search";
import { type EditorState, StateEffect } from "@codemirror/state";
import { EditorView, type KeyBinding } from "@codemirror/view";
import { create } from "zustand";

/* ---------------- toasts — proof slips ----------------
   Ink ground, --bg2 text; ochre for warnings. The shell mounts <ToastRack />
   (components/find-bar.tsx) once; anything announces through toast(). */

export type ToastKind = "info" | "warn";
export interface ToastAction {
  label: string;
  onClick: () => void;
}
export interface ToastSlip {
  id: number;
  msg: string;
  kind: ToastKind;
  leaving: boolean;
  /** Optional proof-mark on the slip — e.g. the template loader's Undo. */
  action?: ToastAction;
}
interface ToastState {
  toasts: ToastSlip[];
  push: (msg: string, kind?: ToastKind, ms?: number, action?: ToastAction) => void;
  dismiss: (id: number) => void;
}

let toastSeq = 0;
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (msg, kind = "info", ms = 3400, action) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, msg, kind, leaving: false, action }] }));
    // the slip is laid down, held, then taken away — exits faster than entrances
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }));
      setTimeout(() => get().dismiss(id), 400);
    }, ms);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** `toast(msg, kind?, ms?, action?)` — the classic signature plus an optional action. */
export function toast(
  msg: string,
  kind: ToastKind = "info",
  ms = 3400,
  action?: ToastAction,
): void {
  useToastStore.getState().push(msg, kind, ms, action);
}

/* ---------------- find bar state ----------------
   The bar's open state lives here so the editor keymap (below) and the shell
   read the same truth. `openSeq` bumps on every open request so an already-open
   bar can still re-grab focus (e.g. Ctrl+H while the bar is showing). */

interface FindState {
  open: boolean;
  /** True when the opener wants the replace field focused (Ctrl+H). */
  focusReplace: boolean;
  /** Bumped on every setOpen(true) so the bar refocuses even if already open. */
  openSeq: number;
  /** The live "n of m" position readout the bar displays and announces. */
  readout: string;
  setOpen: (open: boolean, focusReplace?: boolean) => void;
  setReadout: (readout: string) => void;
}

export const useFindStore = create<FindState>((set) => ({
  open: false,
  focusReplace: false,
  openSeq: 0,
  readout: "",
  setOpen: (open, focusReplace = false) =>
    set((s) => ({ open, focusReplace, openSeq: open ? s.openSeq + 1 : s.openSeq })),
  setReadout: (readout) => set({ readout }),
}));

/* ---------------- the search extension, appended at runtime ----------------
   lib/find owns @codemirror/search's state: a hidden panel keeps the match
   decorations alive while the copy-desk bar (external DOM) does the talking.
   Do NOT add search() or searchKeymap to SourcePane — only findKeymap. */

export interface FindSpec {
  search: string;
  caseSensitive: boolean;
  regexp: boolean;
  wholeWord: boolean;
  replace: string;
}

export function buildQuery(spec: FindSpec): SearchQuery {
  return new SearchQuery({
    search: spec.search,
    caseSensitive: spec.caseSensitive,
    regexp: spec.regexp,
    wholeWord: spec.wholeWord,
    replace: spec.replace,
  });
}

/* Matches wear the document highlighter's specimen ink (#f5d90a — a document
   ink, not the grease pencil); the current match is ringed in structural ink.
   Selection is ink, not red — same law as the swatches. */
const matchTheme = EditorView.theme({
  ".cm-panels": { display: "none" }, // the dummy panel never shows
  ".cm-searchMatch": {
    background: "color-mix(in srgb, #f5d90a 30%, transparent)",
    outline: "1px solid color-mix(in srgb, #f5d90a 55%, transparent)",
  },
  ".cm-searchMatch-selected": {
    background: "color-mix(in srgb, #f5d90a 55%, transparent)",
    outline: "1px solid var(--rule)",
  },
});

const configured = new WeakSet<EditorView>();

/** Idempotently append the search extension (hidden panel + match styling +
    a recount listener) to a live view. Survives because SourcePane never
    reconfigures its state wholesale. */
export function ensureFindConfigured(view: EditorView): void {
  if (configured.has(view)) return;
  configured.add(view);
  view.dispatch({
    effects: StateEffect.appendConfig.of([
      search({
        createPanel: () => {
          const dom = document.createElement("div");
          dom.style.display = "none";
          return { dom };
        },
      }),
      matchTheme,
      // keep the "n of m" honest while the user types or moves the caret
      EditorView.updateListener.of((u) => {
        if (!u.docChanged && !u.selectionSet) return;
        if (!useFindStore.getState().open) return;
        useFindStore.getState().setReadout(computeReadout(u.state));
      }),
    ]),
  });
}

/** Counting stops here so a pathological regex can't hang the bar. */
export const MATCH_CAP = 9999;

/** "3 of 14" when a match is selected · "14 matches" otherwise · "0 matches" ·
    "bad pattern" for an invalid regex · "" for an empty query. */
export function computeReadout(state: EditorState): string {
  const q = getSearchQuery(state);
  if (!q.search) return "";
  if (!q.valid) return "bad pattern";
  const sel = state.selection.main;
  let m = 0;
  let n = 0;
  const cursor = q.getCursor(state);
  for (let step = cursor.next(); !step.done && m < MATCH_CAP; step = cursor.next()) {
    m++;
    if (step.value.from === sel.from && step.value.to === sel.to) n = m;
  }
  if (!m) return "0 matches";
  const cap = m >= MATCH_CAP ? "+" : "";
  if (n) return `${n} of ${m}${cap}`;
  return `${m}${cap} match${m === 1 ? "" : "es"}`;
}

export function publishReadout(view: EditorView): void {
  useFindStore.getState().setReadout(computeReadout(view.state));
}

/** Push the bar's current spec into the editor's search state (no-op when
    nothing changed, so React effects can call it freely). */
export function syncQuery(view: EditorView, spec: FindSpec): void {
  ensureFindConfigured(view);
  const q = buildQuery(spec);
  if (q.eq(getSearchQuery(view.state))) return;
  view.dispatch({ effects: setSearchQuery.of(q) });
}

/** Open the (invisible) search panel so match decorations render, then apply
    the bar's query. */
export function openFindOnView(view: EditorView, spec: FindSpec): void {
  ensureFindConfigured(view);
  openSearchPanel(view);
  syncQuery(view, spec);
  publishReadout(view);
}

/** Drop the decorations and hand focus back to the editor — the Esc contract. */
export function closeFindOnView(view: EditorView): void {
  try {
    if (searchPanelOpen(view.state)) closeSearchPanel(view);
    view.focus();
  } catch {
    /* view already destroyed — nothing to restore */
  }
  useFindStore.getState().setReadout("");
}

/** Move to the next/previous match (wraps around) and refresh the readout. */
export function stepFind(view: EditorView, backwards: boolean): boolean {
  const ok = backwards ? findPrevious(view) : findNext(view);
  publishReadout(view);
  return ok;
}

/** Replace the current match and advance — one undoable transaction. */
export function replaceCurrent(view: EditorView): boolean {
  const ok = replaceNext(view);
  publishReadout(view);
  return ok;
}

/** Replace every match in ONE CodeMirror transaction (Ctrl+Z takes the whole
    thing back). Returns how many were replaced so the caller can say so. */
export function replaceAllMatches(view: EditorView): number {
  const q = getSearchQuery(view.state);
  if (!q.search || !q.valid) return 0;
  let m = 0;
  const cursor = q.getCursor(view.state);
  for (let step = cursor.next(); !step.done && m < MATCH_CAP; step = cursor.next()) m++;
  if (!m) return 0;
  replaceAll(view);
  publishReadout(view);
  return m;
}

/* ---------------- editor keymap ----------------
   Add to SourcePane: keymap.of([...findKeymap]) ahead of defaultKeymap.
   Mod-F/Mod-H open the bar (F3 too when closed); F3/Shift-F3 step through
   matches; Escape closes the bar from inside the editor. */
export const findKeymap: readonly KeyBinding[] = [
  {
    key: "Mod-f",
    run: () => {
      useFindStore.getState().setOpen(true, false);
      return true;
    },
  },
  {
    key: "Mod-h",
    run: () => {
      useFindStore.getState().setOpen(true, true);
      return true;
    },
  },
  {
    key: "F3",
    run: (view) => {
      if (!useFindStore.getState().open) {
        useFindStore.getState().setOpen(true, false);
        return true;
      }
      stepFind(view, false);
      return true;
    },
  },
  {
    key: "Shift-F3",
    run: (view) => {
      if (!useFindStore.getState().open) return false;
      stepFind(view, true);
      return true;
    },
  },
  {
    key: "Escape",
    run: () => {
      if (!useFindStore.getState().open) return false;
      useFindStore.getState().setOpen(false);
      return true;
    },
  },
];
