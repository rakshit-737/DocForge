"use client";
/* The find bar — a copy-desk panel over CodeMirror's search state, not the
   stock UI. Printed-form mono fields (focus swaps the rule for the grease
   pencil — a sanctioned red site), case/regex/whole-word toggles, an honest
   live "n of m" readout (ledger I8), and an undo-safe Replace All that says
   what it did. Esc closes and returns focus to the editor. */
import type { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import {
  closeFindOnView,
  type FindSpec,
  openFindOnView,
  publishReadout,
  replaceAllMatches,
  replaceCurrent,
  stepFind,
  syncQuery,
  toast,
  useFindStore,
  useToastStore,
} from "@/lib/find";

const CHIP =
  "flex h-6 min-w-6 items-center justify-center px-1 font-mono text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";
const BTN =
  "flex h-7 items-center gap-1 px-2 text-xs text-ink-2 hover:bg-tray hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";
const FIELD =
  "h-7 min-w-24 flex-1 border border-line bg-tray px-2 font-mono text-xs text-ink outline-none placeholder:text-ink-2 focus:border-press";

function ToggleChip({
  pressed,
  onClick,
  label,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`${CHIP} ${pressed ? "bg-tray text-ink" : "text-ink-3 hover:text-ink-2"}`}
    >
      {children}
    </button>
  );
}

export function FindBar({
  view,
  open,
  onOpenChange,
}: {
  view: EditorView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regexp, setRegexp] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const readout = useFindStore((s) => s.readout);
  const openSeq = useFindStore((s) => s.openSeq);
  const findInput = useRef<HTMLInputElement>(null);
  const replInput = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  const spec: FindSpec = {
    search: searchText,
    caseSensitive,
    regexp,
    wholeWord,
    replace: replaceText,
  };
  const specRef = useRef(spec);
  specRef.current = spec;
  const viewRef = useRef(view);
  viewRef.current = view;

  /* Unmounting while open must not leave decorations behind. */
  useEffect(
    () => () => {
      if (useFindStore.getState().open && viewRef.current) closeFindOnView(viewRef.current);
    },
    [],
  );

  /* Opening: activate the search state, prefill from a single-line selection
     (else keep the last query), focus the right field. openSeq re-fires this
     when Ctrl+H lands while the bar is already up. */
  // biome-ignore lint/correctness/useExhaustiveDependencies(openSeq): openSeq is the deliberate re-open trigger — a bump refocuses an already-open bar
  useEffect(() => {
    if (!open || !view) return;
    let next = specRef.current;
    const sel = view.state.selection.main;
    if (!sel.empty) {
      const picked = view.state.sliceDoc(sel.from, sel.to);
      if (picked && !picked.includes("\n") && picked.length <= 200) {
        next = { ...next, search: picked };
        specRef.current = next;
        setSearchText(picked);
      }
    }
    openFindOnView(view, next);
    const target = useFindStore.getState().focusReplace ? replInput.current : findInput.current;
    target?.focus();
    target?.select();
  }, [open, openSeq, view]);

  /* Closing: drop decorations, return focus to the editor. */
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current && view) closeFindOnView(view);
    wasOpen.current = false;
  }, [open, view]);

  /* Live query sync — every keystroke and toggle re-counts. */
  useEffect(() => {
    if (!open || !view) return;
    syncQuery(view, { search: searchText, caseSensitive, regexp, wholeWord, replace: replaceText });
    publishReadout(view);
  }, [open, view, searchText, replaceText, caseSensitive, regexp, wholeWord]);

  if (!open) return null;

  const close = () => onOpenChange(false);
  const step = (back: boolean) => {
    if (view) stepFind(view, back);
  };
  const doReplaceOne = () => {
    if (view) replaceCurrent(view);
  };
  const doReplaceAll = () => {
    if (!view) return;
    const n = replaceAllMatches(view);
    if (n) toast(`Replaced ${n} — Ctrl+Z undoes`);
  };
  const fieldKeys = (onEnter: (shift: boolean) => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter(e.shiftKey);
    } else if (e.key === "F3") {
      e.preventDefault();
      step(e.shiftKey);
    }
  };

  return (
    <search
      aria-label="Find and replace"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
      className="flex flex-wrap items-center gap-2 border-b border-line bg-desk px-2 py-1.5"
    >
      <input
        ref={findInput}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        onKeyDown={fieldKeys((shift) => step(shift))}
        placeholder="Find…"
        aria-label="Find"
        autoComplete="off"
        spellCheck={false}
        className={FIELD}
      />
      <fieldset className="flex items-center gap-0.5 border border-line bg-surface p-0.5">
        <legend className="sr-only">Search options</legend>
        <ToggleChip
          pressed={caseSensitive}
          onClick={() => setCaseSensitive((v) => !v)}
          label="Match case"
        >
          Aa
        </ToggleChip>
        <ToggleChip pressed={wholeWord} onClick={() => setWholeWord((v) => !v)} label="Whole word">
          |ab|
        </ToggleChip>
        <ToggleChip
          pressed={regexp}
          onClick={() => setRegexp((v) => !v)}
          label="Regular expression"
        >
          .*
        </ToggleChip>
      </fieldset>
      <input
        ref={replInput}
        value={replaceText}
        onChange={(e) => setReplaceText(e.target.value)}
        onKeyDown={fieldKeys(() => doReplaceOne())}
        placeholder="Replace with…"
        aria-label="Replace with"
        autoComplete="off"
        spellCheck={false}
        className={FIELD}
      />
      <output
        aria-live="polite"
        className={`min-w-16 whitespace-nowrap text-right font-mono text-xs tabular-nums ${
          readout === "bad pattern" ? "text-warn" : "text-ink-3"
        }`}
      >
        {readout}
      </output>
      <button
        type="button"
        onClick={() => step(true)}
        title="Previous (Shift+Enter · Shift+F3)"
        aria-label="Previous match"
        className={BTN}
      >
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 14l6-6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => step(false)}
        title="Next (Enter · F3)"
        aria-label="Next match"
        className={BTN}
      >
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 10l6 6 6-6" />
        </svg>
      </button>
      <button type="button" onClick={doReplaceOne} title="Replace current match" className={BTN}>
        Replace
      </button>
      <button
        type="button"
        onClick={doReplaceAll}
        title="Replace every match — one undo step"
        className={BTN}
      >
        All
      </button>
      <button
        type="button"
        onClick={close}
        title="Close (Esc)"
        aria-label="Close find bar"
        className={BTN}
      >
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </search>
  );
}

/* ---------------- toasts — proof slips ----------------
   Mount once in the shell. Slips rise from the bottom centre on an ink
   ground; warnings go ochre. Reduced motion kills the entrance globally. */
export function ToastRack() {
  const toasts = useToastStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <>
      <style>{"@keyframes df-pop{from{transform:translateY(8px);opacity:0}}"}</style>
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <output
            key={t.id}
            className={`max-w-[80vw] rounded-menu px-4 py-2 text-[13px] font-semibold shadow-(--elev-m) ${
              t.kind === "warn" ? "bg-warn text-tray" : "bg-ink text-surface"
            }`}
            style={{
              animation: "df-pop 160ms var(--ease)",
              ...(t.leaving
                ? {
                    opacity: 0,
                    transform: "translateY(6px)",
                    transition: "opacity 0.3s ease-in, transform 0.3s ease-in",
                  }
                : null),
            }}
          >
            {t.msg}
            {t.action ? (
              <button
                type="button"
                className="pointer-events-auto ml-3 underline underline-offset-2 hover:opacity-80"
                onClick={() => {
                  t.action?.onClick();
                  useToastStore.getState().dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : null}
          </output>
        ))}
      </div>
    </>
  );
}
