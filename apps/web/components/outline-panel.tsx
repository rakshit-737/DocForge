"use client";
/* The outline navigator — a floating ruled panel over the stone listing the
   manuscript's h1–h3, read from the live Paged.js deck after each compose.
   One tab stop for the whole list (roving tabindex, ledger A4); click (or
   Enter) scrolls that heading's page into view on the stone. */
import { useEffect, useState } from "react";
import { create } from "zustand";

/* Convenience: bump this from PreviewController's onRendered event and feed
   `tick` to <OutlinePanel refreshKey={…}> so the list re-reads the deck. */
interface RenderTickState {
  tick: number;
  bump: () => void;
}
export const useRenderTick = create<RenderTickState>((set) => ({
  tick: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),
}));

interface OutlineEntry {
  level: number;
  text: string;
  el: HTMLElement;
}

const LEVEL_CLASS: Record<number, string> = {
  1: "text-[12.5px] font-semibold text-ink",
  2: "pl-4.5 text-[12.5px] text-ink-2",
  3: "pl-7.5 text-xs text-ink-2",
};

function readHeadings(deck: HTMLElement): OutlineEntry[] {
  /* The classic selector, minus the .doc wrapper it can live without; the
     fallback catches a render path that drops .content. Cover/running
     furniture never sits inside .content, so it stays out of the list. */
  let els = Array.from(deck.querySelectorAll<HTMLElement>(".pagedjs_page .content :is(h1,h2,h3)"));
  if (!els.length)
    els = Array.from(
      deck.querySelectorAll<HTMLElement>(".pagedjs_page .pagedjs_page_content :is(h1,h2,h3)"),
    );
  return els.map((el) => ({
    level: Number(el.tagName[1]) || 1,
    text: (el.textContent || "").trim() || "—",
    el,
  }));
}

export function OutlinePanel({
  deck,
  refreshKey,
  onClose,
}: {
  deck: HTMLElement | null;
  /** Bump on every PreviewController onRendered so the list re-reads the deck. */
  refreshKey: number;
  /** Esc inside the panel closes it (the shell flips its own open state). */
  onClose?: () => void;
}) {
  const [entries, setEntries] = useState<OutlineEntry[]>([]);
  const [focusIdx, setFocusIdx] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies(refreshKey): refreshKey is the deliberate trigger — the shell bumps it after every compose so the list re-reads the deck
  useEffect(() => {
    if (!deck) {
      setEntries([]);
      return;
    }
    setEntries(readHeadings(deck));
    setFocusIdx(0);
  }, [deck, refreshKey]);

  const jump = (el: HTMLElement) => {
    /* zoom (not transform) scales the deck, so rect maths stays truthful */
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const listKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && onClose) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    if (!entries.length) return;
    e.preventDefault();
    const at = focusIdx;
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? entries.length - 1
          : Math.min(entries.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
    setFocusIdx(next);
    document.getElementById(`df-ol-${next}`)?.focus();
  };

  return (
    <>
      <style>{"@keyframes df-rise{from{transform:translateY(6px);opacity:0}}"}</style>
      <nav
        aria-label="Outline"
        onKeyDown={listKeys}
        style={{ animation: "df-rise var(--dur) var(--ease)" }}
        className="absolute left-2 top-2 z-40 flex max-h-[calc(100%-24px)] w-70 flex-col overflow-hidden rounded-menu bg-tray p-1.5 shadow-(--elev-m)"
      >
        <div className="select-none border-b border-line px-2 pb-1 pt-0.5 font-mono text-[10.5px] text-ink-3">
          outline
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="p-2 text-xs text-ink-3">No headings yet</div>
          ) : (
            entries.map((en, i) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: deck order is the identity
                key={i}
                id={`df-ol-${i}`}
                type="button"
                tabIndex={i === focusIdx ? 0 : -1}
                onFocus={() => setFocusIdx(i)}
                onClick={() => jump(en.el)}
                className={`block w-full truncate rounded-menu px-2 py-[5px] text-left hover:bg-line hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus ${
                  LEVEL_CLASS[en.level] ?? LEVEL_CLASS[1]
                }`}
              >
                {en.text}
              </button>
            ))
          )}
        </div>
      </nav>
    </>
  );
}
