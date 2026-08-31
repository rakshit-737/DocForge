"use client";
/* Confirm dialog — the classic #confirmOverlay rebuilt on Radix AlertDialog.
   Radix supplies role="alertdialog", aria-modal, the focus trap, Esc-to-cancel
   and focus restoration; this file supplies the copy-desk skin: a scrim, a
   small square-shouldered modal card (--rl is the one 4px radius in the
   chrome), a serif header over a soft-rule seam, and the surface's one red
   plate on the confirming action (the sanctioned #cfYes site of the
   Grease-Pencil Rule). Initial focus lands on Cancel — Radix's AlertDialog
   default — so Enter never destroys anything by accident. */
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { type ReactNode, useEffect, useRef } from "react";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  /** The safe way out — default "Cancel". */
  cancelLabel?: string;
  /** The committing action — default "Continue"; always the red plate. */
  confirmLabel?: string;
  onConfirm: () => void;
  /** Fired on every close that was not the confirm: Cancel button or Esc. */
  onCancel?: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  cancelLabel = "Cancel",
  confirmLabel = "Continue",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmed = useRef(false);
  useEffect(() => {
    if (open) confirmed.current = false;
  }, [open]);

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !confirmed.current) onCancel?.();
        onOpenChange(next);
      }}
    >
      <AlertDialog.Portal>
        {/* Entrances live in globals.css, keyed to Radix's data-state (df-fade
            scrim, df-sheet-in sheet). Tailwind v4 centres via the standalone
            `translate` property, so df-sheet-in animates translate/scale (not
            transform) and lands exactly on the utilities' resting values. */}
        <AlertDialog.Overlay
          data-df-motion="fade"
          className="fixed inset-0 z-[60] bg-[rgba(10,8,5,0.72)]"
        />
        <AlertDialog.Content
          data-df-motion="sheet"
          className="fixed left-1/2 top-1/2 z-[60] flex max-h-[84vh] w-[min(430px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-modal bg-surface shadow-[var(--elev-l)] outline-none"
        >
          <AlertDialog.Title className="border-b border-line px-5 py-4 font-display text-base font-normal text-ink">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="overflow-y-auto px-5 py-4 text-[13px] leading-[1.65] text-ink-2">
              {body}
            </div>
          </AlertDialog.Description>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className={`inline-flex h-8 cursor-pointer items-center whitespace-nowrap rounded-desk border border-line bg-tray px-3 text-[13px] text-ink transition-colors duration-[160ms] ease-out hover:border-rule active:translate-y-[0.5px] ${FOCUS_RING}`}
              >
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                onClick={() => {
                  confirmed.current = true;
                  onConfirm();
                }}
                className={`inline-flex h-8 cursor-pointer items-center whitespace-nowrap rounded-desk border border-press-hover bg-press px-3 text-[13px] font-semibold text-press-ink transition-colors duration-[160ms] ease-out hover:bg-press-hover active:translate-y-[0.5px] ${FOCUS_RING}`}
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
