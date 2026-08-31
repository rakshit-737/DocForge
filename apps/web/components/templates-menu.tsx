"use client";
/* Templates — the classic #tplMenu popmenu rebuilt on Radix DropdownMenu:
   a designed menu of label + one-line reason, arrow-key/Home/End navigation,
   Esc closes and returns focus to the opener (all Radix, by construction —
   the classic bug where Esc missed this menu cannot recur).

   The destructive-replace fix (ledger I7): choosing a template only CONFIRMS
   here — a Radix AlertDialog with "Keep current" / "Load template" — then hands
   the resolved document to the shell via onApply. The shell's contract is to
   snapshot {source, settings, attachments, accentTouched} BEFORE applying and
   offer an undo toast; this menu never touches the store itself. */
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import {
  resolveTemplate,
  TEMPLATES,
  type TemplateDocument,
  type TemplateId,
} from "@/lib/templates";
import { ConfirmDialog } from "./confirm-dialog";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";

export function TemplatesMenu({
  onApply,
}: {
  /** Called only after the user confirms. The shell snapshots the current
      document BEFORE applying this and offers an undo toast (ledger I7). */
  onApply: (template: TemplateDocument) => void;
}) {
  const [pending, setPending] = useState<TemplateId | null>(null);
  const pendingLabel = pending ? TEMPLATES[pending].label : "";

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={`inline-flex h-8 cursor-pointer items-center gap-2 whitespace-nowrap rounded-desk border border-line bg-tray px-3 text-[13px] text-ink transition-colors duration-[160ms] ease-out hover:border-rule active:translate-y-[0.5px] ${FOCUS_RING}`}
          >
            Templates
            <svg
              viewBox="0 0 10 6"
              width="10"
              height="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
              className="text-ink-3"
            >
              <path d="M1 1l4 4 4-4" />
            </svg>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-[60] min-w-[300px] rounded-menu bg-tray p-1.5 shadow-[var(--elev-m)]"
            style={{
              animation: "df-menu-in var(--dur) var(--ease)",
              transformOrigin: "var(--radix-dropdown-menu-content-transform-origin)",
            }}
          >
            <style>{`@keyframes df-menu-in { from { transform: scale(0.97) translateY(-3px); opacity: 0; } }`}</style>
            {Object.entries(TEMPLATES).map(([id, t]) => (
              <DropdownMenu.Item
                key={id}
                onSelect={() => setPending(id as TemplateId)}
                className="block w-full cursor-pointer rounded-desk px-3 py-2 text-left text-ink outline-none data-highlighted:bg-surface"
              >
                <b className="block text-[13px] font-semibold">{t.label}</b>
                {/* --tx2, not --tx3: tertiary ink misses 4.5:1 on the day fresh sheet */}
                <span className="mt-px block text-xs leading-[1.45] text-ink-2">{t.desc}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Load template?"
        body={
          <p className="m-0">
            &ldquo;{pendingLabel}&rdquo; will replace the current document and its settings.{" "}
            <b className="text-ink">Undo</b> on the toast that follows brings your work back.
          </p>
        }
        cancelLabel="Keep current"
        confirmLabel="Load template"
        onConfirm={() => {
          if (pending) onApply(resolveTemplate(pending));
          setPending(null);
        }}
      />
    </>
  );
}
