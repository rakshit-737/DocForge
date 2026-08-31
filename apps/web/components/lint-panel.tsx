"use client";
/* The document checks — classic #lintBadge / #lintPanel, restyled for the
   copy desk. The badge sits in the wire ticker and hides itself at zero; the
   panel is a floating proof-slip list over the source galley, each slip a
   button that jumps the galley to the offending line. Warn ochre throughout —
   the desk's one red stays on the primary action and focus. */
import { useEffect, useRef } from "react";
import { runLint, useLintStore } from "@/lib/lint";
import { useDocStore } from "@/lib/store";

/* The classic showed the first 40 slips; beyond that the count says the rest. */
const MAX_ITEMS = 40;

/** Count badge for the statusbar — hidden at zero, exactly like the classic
    #lintBadge. Mounting it also arms the linter: it re-runs (debounced 600ms)
    whenever the manuscript or its settings change. */
export function LintBadge({
  onClick,
  expanded,
}: {
  onClick: () => void;
  /** Mirror of the panel's open state, for aria-expanded. */
  expanded?: boolean;
}) {
  const count = useLintStore((s) => s.warnings.length);

  /* Subscribe outside React so the badge re-renders only when the count moves,
     not on every keystroke. Primed immediately on mount (classic boot ran
     refreshLint straight away). */
  useEffect(() => {
    runLint(useDocStore.getState().source, 0);
    return useDocStore.subscribe((s, prev) => {
      if (s.source !== prev.source || s.settings !== prev.settings) runLint(s.source);
    });
  }, []);

  if (!count) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Document checks"
      aria-expanded={expanded}
      className="rounded-desk bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] px-2 py-0.5 font-mono text-xs text-warn hover:bg-[color-mix(in_srgb,var(--warn)_24%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
    >
      {count === 1 ? "1 warning" : `${count} warnings`}
    </button>
  );
}

/** The proof-slip list. Render inside a `relative` container over the source
    galley; it pins itself to the bottom. Esc closes; clicking a slip calls
    onJump(line) and leaves the panel open, like the classic. */
export function LintPanel({
  open,
  onOpenChange,
  onJump,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJump: (line: number) => void;
}) {
  const warnings = useLintStore((s) => s.warnings);
  const listRef = useRef<HTMLElement>(null);

  /* The classic panel folded itself away when the last warning cleared. */
  useEffect(() => {
    if (open && warnings.length === 0) onOpenChange(false);
  }, [open, warnings.length, onOpenChange]);

  /* Opened from the badge — put the keyboard on the first slip so arrows/Tab
     walk the list and Esc lands here. */
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open]);

  if (!open || warnings.length === 0) return null;
  const shown = warnings.slice(0, MAX_ITEMS);
  return (
    <>
      <style>{"@keyframes df-rise{from{transform:translateY(6px);opacity:0}}"}</style>
      <section
        ref={listRef}
        aria-label="Document checks"
        style={{ animation: "df-rise var(--dur) var(--ease)" }}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.preventDefault();
          e.stopPropagation();
          onOpenChange(false);
        }}
        className="absolute bottom-2 left-2 right-2 z-40 max-h-[40%] overflow-y-auto rounded-menu bg-tray p-1.5 shadow-(--elev-m)"
      >
        <div className="select-none border-b border-line px-2 pb-1 pt-0.5 font-mono text-[10.5px] text-ink-3">
          document checks
        </div>
        {shown.map((w, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: report order is the identity
            key={i}
            type="button"
            onClick={() => {
              if (w.line != null) onJump(w.line);
            }}
            className="block w-full rounded-menu px-2 py-1.5 text-left text-[12.5px] leading-[1.45] text-ink-2 hover:bg-line hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
          >
            <span className="mr-2 font-mono text-[11px] tabular-nums text-warn">
              {w.line != null ? `line ${w.line}` : "—"}
            </span>
            {w.message}
          </button>
        ))}
        {warnings.length > shown.length && (
          <div className="select-none px-2 py-1 font-mono text-[10.5px] text-ink-3">
            …and {warnings.length - shown.length} more
          </div>
        )}
      </section>
    </>
  );
}
