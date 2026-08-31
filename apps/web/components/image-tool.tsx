"use client";
/* The "Insert image from file" tool — the classic imgMode:"insert" flow
   (src/js/main.js TOOL_ACTS.image + bindImageInput): pick a file, downscale +
   attach, drop the [screenshot: caption | img:key] marker at the caret.

   Self-contained by design: it mirrors the Tool plate of
   components/toolbar.tsx (same TB/TIP class strings, same icon grammar —
   24 viewBox, 1.8 stroke, 15px render) without importing from it, and
   carries its own hidden file input and Tooltip.Provider so it mounts
   anywhere in the chrome. Also exports handleImagePaste — the smart-paste
   hook the integrator wires into the editor: a clipboard image attaches and
   inserts the marker instead of pasting bytes. */
import type { EditorView } from "@codemirror/view";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useRef } from "react";
import { captionForFile, insertFigure, processImageFile } from "@/lib/attachments";
import { toast } from "@/lib/find";

/* The toolbar's desk-plate strings, mirrored verbatim from toolbar.tsx. */
const TB =
  "inline-flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center gap-1 " +
  "rounded-[1px] border-0 bg-transparent px-1.5 font-mono text-[13px] text-ink-2 " +
  "transition-colors duration-[160ms] ease-desk hover:bg-tray hover:text-ink " +
  "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus " +
  "motion-safe:active:scale-[0.96] pointer-coarse:h-9 pointer-coarse:min-w-9";

const TIP =
  "z-[80] flex items-center gap-2 rounded-menu bg-ink px-2.5 py-1 text-xs font-semibold " +
  "text-surface select-none";

/* The classic authored image icon (src/index.html data-act="image"). */
const imageIcon = (
  <svg
    viewBox="0 0 24 24"
    width={15}
    height={15}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M4.5 18.5l5-5 3.5 3.5 3-3 3.5 3.5" />
  </svg>
);

/** Attach the file and drop the marker at the caret — one toast either way,
    the classic wording (main.js bindImageInput). */
async function attachAndInsert(view: EditorView, file: File, caption: string): Promise<void> {
  try {
    const key = await processImageFile(file);
    insertFigure(view, key, caption);
    view.focus();
    toast("Image attached");
  } catch {
    toast("Could not read that image", "warn");
  }
}

/** Classic smart paste: a clipboard image becomes an attached figure at the
    caret instead of dead bytes. Returns true when the event was consumed
    (preventDefault already called); false lets other paste handling —
    HTML-soup cleanup, plain text — proceed. The integrator wires this into
    the editor's paste event. */
export function handleImagePaste(e: ClipboardEvent, view: EditorView): boolean {
  const items = e.clipboardData?.items;
  if (!items) return false;
  let file: File | null = null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "file" && /^image\//.test(it.type)) {
      file = it.getAsFile();
      if (file) break;
    }
  }
  if (!file) return false;
  e.preventDefault();
  /* Clipboard files rarely carry a telling name (Windows snips arrive as
     "image.png") — fall back to a caption worth keeping. */
  const cap = captionForFile(file.name);
  void attachAndInsert(view, file, cap && !/^image$/i.test(cap) ? cap : "Pasted image");
  return true;
}

/** Toolbar-mountable image tool: the plate button plus its hidden picker. */
export function ImageTool({ view }: { view: EditorView | null }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={500}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className={TB}
            aria-label="Insert image from file"
            onClick={() => {
              if (view) inputRef.current?.click();
            }}
          >
            {imageIcon}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={6} className={TIP} style={{ boxShadow: "var(--elev-m)" }}>
            Insert image from file
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0] ?? null;
          e.currentTarget.value = ""; // the same file can be picked twice in a row
          if (!file || !view) return;
          void attachAndInsert(view, file, captionForFile(file.name));
        }}
      />
    </Tooltip.Provider>
  );
}
