"use client";
/* The pigeonhole rack — every document on this desk, and the verbs that make
   another one (§8.1). Starting something new is additive here: New, Duplicate
   and "open as a new document" all leave what you were writing alone, which
   is what retires the destructive-replace bug class. Delete is the only verb
   that removes anything, and it asks first. */
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useEffect, useState } from "react";
import { toast } from "@/lib/find";
import { type DocSummary, useWorkspace } from "@/lib/workspace";
import { ConfirmDialog } from "./confirm-dialog";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";

const when = (at: number): string => {
  if (!at) return "never saved";
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(at).toLocaleDateString([], { day: "numeric", month: "short" });
};

export function DocumentsMenu() {
  const docs = useWorkspace((s) => s.docs);
  const activeId = useWorkspace((s) => s.activeId);
  const refresh = useWorkspace((s) => s.refresh);
  const open = useWorkspace((s) => s.open);
  const create = useWorkspace((s) => s.create);
  const duplicate = useWorkspace((s) => s.duplicate);
  const remove = useWorkspace((s) => s.remove);
  const [open_, setOpen_] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DocSummary | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* Every verb closes the rack ITSELF before its async work starts. Letting
     Radix close on select and doing the work concurrently left the content
     mounted with the trigger reading aria-expanded=false — an orphan menu
     that swallowed the next click on the rack (the probe caught it). */
  const act = (run: () => Promise<unknown>) => () => {
    setOpen_(false);
    setTimeout(() => void run(), 0);
  };

  const others = docs.length - (docs.some((d) => d.id === activeId) ? 1 : 0);

  return (
    <>
      {/* modal={false}: a modal dropdown puts pointer-events:none on the body
          while it lives, which a menu of documents has no need for. */}
      <DropdownMenu.Root open={open_} onOpenChange={setOpen_} modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={`inline-flex h-8 cursor-pointer items-center gap-2 whitespace-nowrap rounded-desk border border-line bg-tray px-3 text-[13px] text-ink transition-colors duration-[160ms] ease-out hover:border-rule active:translate-y-[0.5px] ${FOCUS_RING}`}
            title="Every document on this desk"
            onClick={() => void refresh()}
          >
            Documents
            {others > 0 ? (
              <span className="font-mono text-[10.5px] text-ink-3">{docs.length}</span>
            ) : null}
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
            className="z-[60] max-h-[70vh] min-w-[300px] overflow-y-auto rounded-menu bg-tray p-1.5 shadow-[var(--elev-m)]"
            style={{ transformOrigin: "var(--radix-dropdown-menu-content-transform-origin)" }}
          >
            {docs.map((d) => (
              <DropdownMenu.Item
                key={d.id}
                onSelect={act(() => open(d.id))}
                className="flex w-full cursor-pointer items-center gap-2 rounded-desk px-3 py-2 text-left text-ink outline-none data-highlighted:bg-surface"
              >
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13px] font-semibold">
                    {d.id === activeId ? "• " : ""}
                    {d.title}
                  </b>
                  <span className="mt-px block font-mono text-[10.5px] text-ink-2">
                    {d.words} words · {when(d.updatedAt)}
                  </span>
                </span>
                {docs.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Delete ${d.title}`}
                    className={`shrink-0 px-1 font-mono text-[11px] text-ink-3 hover:text-danger ${FOCUS_RING}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setPendingDelete(d);
                    }}
                  >
                    delete
                  </button>
                ) : null}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
            <DropdownMenu.Item
              onSelect={act(async () => {
                await create({ source: "" });
                toast("New document started — your other documents are untouched", "info", 4500);
              })}
              className="cursor-pointer rounded-desk px-3 py-2 text-[13px] text-ink outline-none data-highlighted:bg-surface"
            >
              New document
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={act(() => duplicate(activeId))}
              className="cursor-pointer rounded-desk px-3 py-2 text-[13px] text-ink outline-none data-highlighted:bg-surface"
            >
              Duplicate this one
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
        title="Delete this document?"
        body={
          <p className="m-0">
            &ldquo;{pendingDelete?.title}&rdquo; and its version history go for good. Your other
            documents are untouched.
          </p>
        }
        cancelLabel="Keep it"
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) void remove(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
