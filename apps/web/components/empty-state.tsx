"use client";
/* The empty state — a blank sheet with three verbs (§7.7). Shown on the stone
   while the source is empty; the spirit is the classic #emptyState (src/
   index.html + src/app.css): serif-italic invitation, ghost guidance, ruled
   chips — grown web-sized into three ruled verb plates the shell wires up
   (Write · Load a template · Open a file) with the classic quiet kbd hints
   underneath. The component watches the document store itself; the shell only
   supplies the verbs. Pointer events pass through everywhere outside the card
   so the stone stays scrollable and droppable. Laid out line by line with the
   classic rise stagger (globals.css .df-es-rise); dead under reduced motion.

   One honest guard: boot always lands a document (a restored session, else
   the welcome template), so an empty source at mount is only the boot beat —
   showing "a blank sheet" during it would be a flicker and a lie. The sheet
   arms after the desk has settled (the classic first-visit 700ms). */
import { useEffect, useState } from "react";
import { useDocStore } from "@/lib/store";

const PLATE =
  "pointer-events-auto flex w-full flex-col gap-0.5 border border-line bg-tray px-3.5 py-2.5 text-left transition-colors duration-[160ms] ease-out hover:border-rule active:translate-y-[0.5px]";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border border-line bg-tray px-1 font-mono text-[10px] text-ink-2">
      {children}
    </kbd>
  );
}

function Verb({ label, reason, onClick }: { label: string; reason: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={PLATE}>
      <b className="block text-[13px] font-semibold text-ink">{label}</b>
      {/* --tx2, not --tx3: tertiary ink misses 4.5:1 on the day fresh sheet */}
      <span className="block text-xs leading-[1.45] text-ink-2">{reason}</span>
    </button>
  );
}

export function EmptyState({
  onWrite,
  onTemplates,
  onOpen,
}: {
  /** Put the caret in the source column. */
  onWrite: () => void;
  /** Open the Templates menu (or the palette's Templates group). */
  onTemplates: () => void;
  /** The same file picker the masthead's Open uses. */
  onOpen: () => void;
}) {
  const blank = useDocStore((s) => s.source.trim() === "");
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setArmed(true), 700);
    return () => window.clearTimeout(t);
  }, []);
  if (!armed || !blank) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <section
        aria-label="A blank sheet"
        className="pointer-events-auto flex w-full max-w-[520px] flex-col items-center gap-3 text-center"
      >
        <h2 className="df-es-rise font-display text-[22px] font-normal italic text-ink-2">
          A blank sheet
        </h2>
        {/* --tx2 throughout: ghost ink misses 4.5:1 on the day stone */}
        <p
          className="df-es-rise max-w-[44ch] text-[13px] text-ink-2"
          style={{ animationDelay: "60ms" }}
        >
          Start with{" "}
          <code className="border border-line bg-surface px-1.5 font-mono text-xs text-ink-2">
            # A heading
          </code>
          , then just write — the pages compose themselves here.
        </p>
        <div
          className="df-es-rise mt-1 grid w-full grid-cols-1 gap-2 sm:grid-cols-3"
          style={{ animationDelay: "120ms" }}
        >
          <Verb label="Write" reason="straight into the source column" onClick={onWrite} />
          <Verb label="Load a template" reason="a whole working specimen" onClick={onTemplates} />
          <Verb label="Open a file" reason="Word · PDF · Markdown · more" onClick={onOpen} />
        </div>
        <p className="df-es-rise mt-1 text-xs text-ink-2" style={{ animationDelay: "180ms" }}>
          <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> commands · <Kbd>Ctrl</Kbd> <Kbd>/</Kbd> shortcuts
        </p>
      </section>
    </div>
  );
}
