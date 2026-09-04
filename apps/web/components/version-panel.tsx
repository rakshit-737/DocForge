"use client";
/* The timeline — every past state of the document, with what would come back
   if you took one (§8.1; spec in docs/specs/version-history.md). A ledger of
   proofs pulled from the drawer: the list is the spine, the diff is the proof
   slip. Restoring is undoable twice over — the shell's Undo toast, and a
   checkpoint of the pre-restore state written before anything moves. */
import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/find";
import type { Settings } from "@/lib/settings";
import { useDocStore } from "@/lib/store";
import {
  condense,
  countWords,
  deleteVersion,
  diffLines,
  listVersions,
  snapshot,
  type Version,
} from "@/lib/versions";

const stamp = (at: number) => {
  const d = new Date(at);
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay
    ? time
    : `${d.toLocaleDateString([], { day: "numeric", month: "short" })} · ${time}`;
};

const CLOSE_ICON = (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export function VersionPanel({
  open,
  onOpenChange,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The shell's undoable whole-document replace. */
  onRestore: (label: string, doc: { source: string; settings: Settings }) => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const source = useDocStore((s) => s.source);

  const refresh = useCallback(async () => {
    const list = await listVersions();
    setVersions(list);
    setSelected((prev) => (prev && list.some((v) => v.id === prev) ? prev : (list[0]?.id ?? null)));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void refresh();
  }, [open, refresh]);

  const current = versions.find((v) => v.id === selected) ?? null;
  const nowWords = countWords(source);

  /* Keys are minted with the rows: a rendered diff is positional and
     immutable, so a row's place in the list IS its identity — but React (and
     the linter) want that stated once, here, rather than at the call site. */
  const rows = useMemo(
    () =>
      current
        ? condense(diffLines(current.source, source)).map((r, i) => ({
            ...r,
            key: `${i}-${r.type}`,
          }))
        : [],
    [current, source],
  );
  const unchanged = current !== null && current.source === source;

  const checkpoint = async () => {
    const v = await snapshot("manual");
    if (!v) {
      toast("Nothing to check point yet — write something first", "warn");
      return;
    }
    toast("Checkpoint saved");
    setSelected(v.id);
    await refresh();
  };

  const restore = async (v: Version) => {
    /* The road back to *now* is written before the document moves, so the
       restore is reversible long after the Undo toast has gone. */
    await snapshot("manual", "Before restore");
    onRestore(v.label || `version from ${stamp(v.at)}`, { source: v.source, settings: v.settings });
    await refresh();
    onOpenChange(false);
  };

  const drop = async (v: Version) => {
    await deleteVersion(v.id);
    await refresh();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-df-motion="fade"
          className="fixed inset-0 z-[60] bg-[rgba(10,8,5,0.72)]"
        />
        <Dialog.Content
          data-df-motion="sheet"
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[60] flex max-h-[84vh] w-[min(880px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-modal bg-surface shadow-(--elev-l) outline-none"
        >
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <Dialog.Title className="font-display text-base font-normal text-ink">
              Version history
            </Dialog.Title>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-tray" onClick={checkpoint}>
                Save a checkpoint
              </button>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center text-ink-2 hover:bg-tray hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
                >
                  {CLOSE_ICON}
                </button>
              </Dialog.Close>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-[minmax(220px,264px)_1fr] max-[720px]:grid-cols-1">
            {/* the spine */}
            <ul
              aria-label="Saved states, newest first"
              className="m-0 min-h-0 list-none overflow-y-auto border-r border-line p-0 max-[720px]:max-h-48 max-[720px]:border-b max-[720px]:border-r-0"
            >
              {loading ? (
                <li className="px-4 py-3 font-mono text-[11.5px] text-ink-3">
                  reading the drawer…
                </li>
              ) : versions.length === 0 ? (
                <li className="px-4 py-3 text-[12.5px] leading-[1.6] text-ink-2">
                  No saved states yet. One is taken automatically when the desk goes quiet, or press{" "}
                  <b className="text-ink">Save a checkpoint</b>.
                </li>
              ) : (
                versions.map((v) => {
                  const on = v.id === selected;
                  const delta = v.words - nowWords;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(v.id)}
                        aria-current={on ? "true" : undefined}
                        className={`flex w-full cursor-pointer flex-col items-start gap-0.5 border-0 border-line border-b bg-transparent px-4 py-2.5 text-left transition-colors duration-[160ms] hover:bg-tray focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
                          on ? "bg-tray" : ""
                        }`}
                      >
                        <span className="flex w-full items-baseline justify-between gap-2">
                          <span className="font-mono text-[11.5px] text-ink">{stamp(v.at)}</span>
                          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
                            {v.kind === "manual" ? "checkpoint" : "auto"}
                          </span>
                        </span>
                        {v.label ? <span className="text-[12.5px] text-ink">{v.label}</span> : null}
                        <span className="font-mono text-[11px] text-ink-3">
                          {v.words} words
                          {delta === 0
                            ? ""
                            : delta > 0
                              ? ` · +${delta} vs now`
                              : ` · ${delta} vs now`}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            {/* the proof slip */}
            <div className="flex min-h-0 flex-col">
              {current ? (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                    <p className="m-0 text-[12.5px] text-ink-2">
                      {unchanged ? (
                        <>This is the document as it stands.</>
                      ) : (
                        <>
                          <b className="text-ink">Restoring</b> brings back the lines marked{" "}
                          <span className="font-mono text-[11.5px] text-[var(--del-ink,#8b0000)]">
                            −
                          </span>{" "}
                          and drops those marked{" "}
                          <span className="font-mono text-[11.5px] text-ink">+</span>.
                        </>
                      )}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="btn-quiet"
                        onClick={() => void drop(current)}
                        title="Remove this state from the timeline"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="btn-tray"
                        onClick={() => void restore(current)}
                        disabled={unchanged}
                      >
                        Restore this state
                      </button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
                    {unchanged ? (
                      <p className="m-0 text-[12.5px] text-ink-3">
                        Nothing has changed since this snapshot was taken.
                      </p>
                    ) : (
                      <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11.5px] leading-[1.6]">
                        {rows.map((r) => (
                          <span
                            key={r.key}
                            className={
                              r.type === "add"
                                ? "block bg-[color-mix(in_srgb,var(--pri)_12%,transparent)] text-ink"
                                : r.type === "del"
                                  ? "block bg-[color-mix(in_srgb,#8b0000_10%,transparent)] text-ink"
                                  : r.type === "gap"
                                    ? "block py-1 text-ink-3"
                                    : "block text-ink-2"
                            }
                          >
                            {r.type === "add"
                              ? "+ "
                              : r.type === "del"
                                ? "− "
                                : r.type === "gap"
                                  ? ""
                                  : "  "}
                            {r.text || " "}
                          </span>
                        ))}
                      </pre>
                    )}
                  </div>
                </>
              ) : (
                <p className="m-0 px-5 py-4 text-[12.5px] text-ink-2">
                  Select a state on the left to see what it would bring back.
                </p>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
