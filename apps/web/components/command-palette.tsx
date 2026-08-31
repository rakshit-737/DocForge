"use client";
/* The command palette — the desk's spike, ported from the classic cmdk
   (src/js/main.js ~1500s). Top-anchored so the galley stays in view; an
   engraved mono query line over a ruled listbox; DOM focus never leaves the
   input (aria-activedescendant steers). The shell binds Mod-K and supplies
   the command roster, built fresh each render so labels stay truthful. */
import * as Dialog from "@radix-ui/react-dialog";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";

export interface PaletteCommand {
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** True when any Radix dialog is currently open. The shell's Mod-K handler
    must consult this before opening the palette — overlays share a z-plane,
    so the spike never opens over (or under) another sheet. */
export function anyDialogOpen(): boolean {
  return (
    document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
    ) !== null
  );
}

/* Substring beats prefix-of-group beats in-order subsequence; lower is better.
   null = no match. */
function score(label: string, group: string, needle: string): number | null {
  if (!needle) return 0;
  const l = label.toLowerCase();
  const idx = l.indexOf(needle);
  if (idx >= 0) return idx;
  if (group.toLowerCase().startsWith(needle)) return 50;
  let from = 0;
  let last = -1;
  let spread = 0;
  for (const ch of needle) {
    const at = l.indexOf(ch, from);
    if (at < 0) return null;
    if (last >= 0) spread += at - last - 1;
    last = at;
    from = at + 1;
  }
  return 100 + spread;
}

const KEYFRAMES =
  "@keyframes df-fade{from{opacity:0}}" +
  "@keyframes df-modal-in{from{transform:translate(-50%,8px) scale(0.99);opacity:0}}";

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="mr-0.5 border border-line bg-tray px-1 font-mono text-[10px] text-ink-2">
      {children}
    </kbd>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
}) {
  const [query, setQuery] = useState("");
  const [selRaw, setSelRaw] = useState(0);
  const listId = useId();
  const contentRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const scored: Array<{ cmd: PaletteCommand; s: number; i: number }> = [];
    commands.forEach((cmd, i) => {
      const s = score(cmd.label, cmd.group, needle);
      if (s !== null) scored.push({ cmd, s, i });
    });
    scored.sort((a, b) => a.s - b.s || a.i - b.i);
    return scored.map((x) => x.cmd);
  }, [commands, query]);

  const sel = Math.min(selRaw, Math.max(0, items.length - 1));

  /* Fresh spike on every open. */
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelRaw(0);
    }
  }, [open]);

  /* Refuse to stand over another sheet (belt to the shell's braces). */
  useEffect(() => {
    if (!open) return;
    const others = Array.from(
      document.querySelectorAll(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      ),
    ).filter((el) => el !== contentRef.current);
    if (others.length) onOpenChange(false);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${sel}`)?.scrollIntoView({ block: "nearest" });
  }, [open, sel, listId]);

  const runCommand = (cmd: PaletteCommand) => {
    onOpenChange(false);
    // run after Radix restores focus, so the command wins any focus contest
    window.setTimeout(() => cmd.run(), 0);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = items[sel];
      if (cmd) runCommand(cmd); // no match: keep the palette and the query
      return;
    }
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelRaw(Math.min(sel + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelRaw(Math.max(sel - 1, 0));
    } else if (e.key === "Home" && !query) {
      e.preventDefault();
      setSelRaw(0);
    } else if (e.key === "End" && !query) {
      e.preventDefault();
      setSelRaw(items.length - 1);
    }
  };

  const rows: ReactNode[] = [];
  let lastGroup: string | null = null;
  items.forEach((cmd, i) => {
    if (cmd.group !== lastGroup) {
      lastGroup = cmd.group;
      rows.push(
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: a group rail can repeat after fuzzy sorting interleaves groups — position disambiguates
          key={`g-${cmd.group}-${i}`}
          aria-hidden="true"
          className="select-none px-2.5 pb-0.5 pt-2 font-mono text-[10.5px] text-ink-3"
        >
          {cmd.group}
        </div>,
      );
    }
    rows.push(
      <button
        // biome-ignore lint/suspicious/noArrayIndexKey: position in the filtered roster is the identity (classic data-i)
        key={`c-${i}`}
        id={`${listId}-${i}`}
        type="button"
        role="option"
        aria-selected={i === sel}
        tabIndex={-1}
        onClick={() => runCommand(cmd)}
        onMouseMove={() => {
          if (sel !== i) setSelRaw(i);
        }}
        className={`flex w-full items-center gap-2.5 px-2.5 py-[7px] text-left text-[13px] text-ink ${
          i === sel ? "bg-tray" : ""
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
        {cmd.hint ? (
          <span className="whitespace-nowrap font-mono text-[10.5px] text-ink-2">{cmd.hint}</span>
        ) : null}
      </button>,
    );
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <style>{KEYFRAMES}</style>
        <Dialog.Overlay
          className="fixed inset-0 z-[60] bg-[rgba(10,8,5,0.72)]"
          style={{ animation: "df-fade var(--dur) var(--ease)" }}
        />
        <Dialog.Content
          ref={contentRef}
          aria-label="Command palette"
          aria-describedby={undefined}
          className="fixed left-1/2 top-[11vh] z-[60] w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden rounded-modal bg-surface shadow-(--elev-l) outline-none"
          style={{ animation: "df-modal-in var(--dur) var(--ease)" }}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelRaw(0);
            }}
            onKeyDown={onKey}
            placeholder="Type a command — new, table, export, template…"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={items.length ? `${listId}-${sel}` : undefined}
            aria-label="Search commands"
            className="w-full border-0 border-b border-rule bg-tray px-4 py-3 font-mono text-[13.5px] text-ink outline-none placeholder:text-ink-2 focus:border-press"
          />
          <div
            id={listId}
            role="listbox"
            aria-label="Commands"
            className="max-h-[min(46vh,420px)] overflow-y-auto p-1.5"
          >
            {items.length ? (
              rows
            ) : (
              <div className="px-3 py-3.5 text-xs text-ink-3">No matching command</div>
            )}
          </div>
          <div className="flex justify-end border-t border-line px-3 py-[7px]">
            <span className="whitespace-nowrap text-[11px] text-ink-3">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate · <Kbd>Enter</Kbd> run · <Kbd>Esc</Kbd> close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
