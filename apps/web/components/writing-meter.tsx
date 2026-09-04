"use client";
/* The wire ticker's count (§8.1 "focus & flow"): what the manuscript amounts
   to, and — when a goal is set — how far this sitting has got. Clicking it
   opens the breakdown; setting a goal counts from THIS moment, so opening a
   long draft never reads as a goal already met.

   Quiet by construction: mono, tertiary ink, no colour until the goal is met,
   and never a scold. */
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { documentStats, goalLabel, goalProgress, shortStats } from "@/lib/doc-stats";
import { useDocStore } from "@/lib/store";
import { useSessionGoal } from "@/lib/writing-session";

const PRESETS = [250, 500, 1000, 2000];

export function WritingMeter() {
  const source = useDocStore((s) => s.source);
  const goal = useSessionGoal((s) => s.goal);
  const setGoal = useSessionGoal((s) => s.set);
  const clearGoal = useSessionGoal((s) => s.clear);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    useSessionGoal.getState().restore();
  }, []);

  /* The count walks the whole source, so it is memoised against it — typing
     must not pay for a recount on every keystroke beyond this one pass. */
  const stats = useMemo(() => documentStats(source), [source]);
  const progress = goal ? goalProgress(stats.words, goal.start, goal.target) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`tabular-nums hover:text-ink ${progress?.done ? "text-ok" : ""}`}
        title="What this document amounts to — and this session's goal"
      >
        {progress ? goalLabel(progress) : shortStats(stats)}
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            data-df-motion="fade"
            className="fixed inset-0 z-[60] bg-[rgba(10,8,5,0.72)]"
          />
          <Dialog.Content
            data-df-motion="sheet"
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-[60] w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-modal bg-surface shadow-(--elev-l) outline-none"
          >
            <header className="border-b border-line px-5 py-4">
              <Dialog.Title className="font-display text-base font-normal text-ink">
                This document
              </Dialog.Title>
            </header>
            <div className="px-5 py-4">
              <table className="w-full border-collapse text-[12.5px]">
                <tbody className="[&_td]:py-[5px] [&_th]:py-[5px] [&_th]:text-left [&_th]:font-normal [&_th]:text-ink-2">
                  {(
                    [
                      ["Words", stats.words.toLocaleString()],
                      ["Reading time", stats.words ? `${stats.readingMinutes} min` : "—"],
                      ["Paragraphs", stats.paragraphs],
                      ["Headings", stats.headings],
                      ["Figures", stats.figures],
                      ["Tables", stats.tables],
                      ["Equations", stats.equations],
                      ["Footnotes", stats.footnotes],
                      ["Works cited", stats.citations],
                      ["Characters", stats.characters.toLocaleString()],
                    ] as const
                  ).map(([label, value]) => (
                    <tr key={label} className="border-line border-b last:border-b-0">
                      <th scope="row">{label}</th>
                      <td className="text-right font-mono tabular-nums text-ink">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="mt-5 mb-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
                This sitting
              </h3>
              {progress ? (
                <div>
                  <div
                    className="h-1.5 w-full bg-tray"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={progress.target}
                    aria-valuenow={progress.written}
                    aria-label="Words written this sitting"
                  >
                    <div
                      className={`h-full ${progress.done ? "bg-ok" : "bg-press"}`}
                      style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[12.5px] text-ink-2">
                    {goalLabel(progress)}
                    {progress.done ? " — well done." : ""}
                  </p>
                  <button type="button" className="btn-quiet mt-1" onClick={() => clearGoal()}>
                    Clear the goal
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="btn-tray border border-line"
                      onClick={() => setGoal(n, stats.words)}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && custom) setGoal(Number(custom), stats.words);
                    }}
                    inputMode="numeric"
                    placeholder="words"
                    aria-label="A goal of your own, in words"
                    className="h-7 w-20 border border-line bg-tray px-2 font-mono text-[12px] text-ink placeholder:text-ink-3"
                  />
                  <p className="mt-1 w-full text-[11.5px] leading-[1.5] text-ink-3">
                    A goal counts from now, not from nothing — opening a long draft never reads as a
                    goal already met.
                  </p>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
