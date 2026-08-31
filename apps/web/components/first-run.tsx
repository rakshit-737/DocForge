"use client";
/* First run — the classic one-time manual moment (main.js: the first visit
   opens the help sheet once, 700ms after the desk settles, never inside an
   embedded preview), web-sized into a four-step coach: the desk, the press,
   export, Ctrl+K. A small NON-modal Radix Dialog laid over the stone's corner
   — no scrim, no focus cage, the desk stays live so the writer can try each
   step as it is named; outside clicks are deliberately not dismissal, so an
   exploring click cannot burn the one showing. Shown once (localStorage
   docforge.toured, stamped on show exactly like the classic docforge.helped),
   skippable at every step, entrance keyed to data-state in globals.css and
   dead under the global reduced-motion kill. Honest copy; no confetti. */
import * as Dialog from "@radix-ui/react-dialog";
import { type ReactNode, useEffect, useState } from "react";

const BTN =
  "border border-line bg-tray px-3 py-1 text-[12.5px] text-ink transition-colors duration-[160ms] ease-out hover:border-rule active:translate-y-[0.5px]";

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="border border-line bg-tray px-1 font-mono text-[10px] text-ink-2">
      {children}
    </kbd>
  );
}

const STEPS: Array<{ title: string; body: ReactNode }> = [
  {
    title: "The desk",
    body: (
      <>
        Your source on the left, the finished pages on the right. Write Markdown in the source
        column and the manuscript composes itself as you type.
      </>
    ),
  },
  {
    title: "The press",
    body: (
      <>
        The pages are live proofs — click straight into one and type; the edit flows back to the
        source. Generated furniture (contents, references) is set from the source side.
      </>
    ),
  },
  {
    title: "Export",
    body: (
      <>
        Export Word produces a real .docx — embedded fonts, contents, footnotes, equations. PDF
        rides the print dialog: choose &ldquo;Save as PDF&rdquo;. Nothing leaves this device.
      </>
    ),
  },
  {
    title: "Ctrl+K",
    body: (
      <>
        Every desk action answers to <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> — templates, exports, settings,
        searchable by name. <Kbd>Ctrl</Kbd> <Kbd>/</Kbd> keeps the full keyboard map. Close this
        card and try it.
      </>
    ),
  },
];

export function FirstRun() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;

  useEffect(() => {
    if (window.self !== window.top) return; // never inside an embedded preview
    try {
      if (localStorage.getItem("docforge.toured")) return;
      // Stamped on show, like the classic: a crash mid-tour never re-nags.
      localStorage.setItem("docforge.toured", "1");
    } catch {
      return; // storage blocked — nothing to remember a dismissal in
    }
    const t = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          data-df-motion="rise"
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          className="fixed bottom-10 right-4 z-[60] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-modal bg-surface shadow-(--elev-l) outline-none"
        >
          {/* one live wrapper: a step change reads out title, count and body */}
          <div aria-live="polite">
            <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
              <Dialog.Title className="font-display text-[15px] font-normal text-ink">
                {STEPS[step].title}
              </Dialog.Title>
              <span className="font-mono text-[10.5px] tabular-nums text-ink-3">
                {step + 1} of {STEPS.length}
              </span>
            </header>
            <Dialog.Description className="m-0 px-4 py-3 text-[12.5px] leading-[1.6] text-ink-2">
              {STEPS[step].body}
            </Dialog.Description>
          </div>
          <footer className="flex items-center gap-2 border-t border-line px-4 py-2.5">
            {!last && (
              <Dialog.Close asChild>
                <button type="button" className="text-[12px] text-ink-3 hover:text-ink">
                  Skip tour
                </button>
              </Dialog.Close>
            )}
            <span className="flex-1" />
            {step > 0 && (
              <button type="button" className={BTN} onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            )}
            {last ? (
              <Dialog.Close asChild>
                <button type="button" className={BTN}>
                  Done
                </button>
              </Dialog.Close>
            ) : (
              <button type="button" className={BTN} onClick={() => setStep((s) => s + 1)}>
                Next
              </button>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
