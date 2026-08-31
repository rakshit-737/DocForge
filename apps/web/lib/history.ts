/* ============================================================
   history.ts — the ONE document history (classic main.js ~869-900).

   One undo history for the whole document, whichever pane edited it.
   Entries are source snapshots; edits within ~a second amend the open
   entry so a typing burst is one undo step; the stack caps at 150.
   Undo/redo restore the SOURCE only — exactly the classic applyHistory:
   settings tweaks and the synchronization between the two panes never
   mint history (record() sees an equal snapshot and records nothing).

   Division of labour with CodeMirror: CM6's native history stays wired
   for keystroke-level undo while focus is IN the editor (Mod-z there is
   handled by @codemirror/commands and lands here afterwards as an
   ordinary source change, which the equality/grouping rules absorb).
   Ctrl+Z at the SHELL level — focus in the preview, where the browser
   emits historyUndo/historyRedo beforeinput events that live-edit.ts
   intercepts — goes through THIS store history: the app-level history is
   the single truth for cross-pane edits, as in the classic build.
   ============================================================ */
import { useDocStore } from "./store";

const GROUP_MS = 900;
const CAP = 150;

class DocHistory {
  private stack: string[] = [];
  private idx = -1;
  private t = 0;

  /** The classic recordSource — called on every real source change
      (the web equivalent of recordSource-in-markDirty). */
  record(source: string): void {
    if (this.idx >= 0 && this.stack[this.idx] === source) return;
    const now = Date.now();
    if (this.idx >= 0 && now - this.t < GROUP_MS) {
      this.stack[this.idx] = source; // amend the open entry
    } else {
      this.stack.length = ++this.idx; // truncate any redo tail
      this.stack.push(source);
      if (this.stack.length > CAP) {
        this.stack.shift();
        this.idx--;
      }
    }
    this.t = now;
  }

  /** The classic applyHistory: restore the source only. The store change
      fans out on its own — the source pane replaces its document, the deck
      schedules a recompose — and record() sees an equal snapshot, so the
      restore itself never mints history. */
  private apply(src: string): void {
    useDocStore.getState().setSource(src);
  }

  undo(): void {
    if (this.idx > 0) {
      this.t = 0;
      this.apply(this.stack[--this.idx]!);
    }
  }

  redo(): void {
    if (this.idx < this.stack.length - 1) {
      this.t = 0;
      this.apply(this.stack[++this.idx]!);
    }
  }

  /** Seed with the current source and record every subsequent source change.
      Returns the unsubscribe. Safe to attach twice (StrictMode double-mount):
      the equality guard makes the second recording a no-op. */
  attach(): () => void {
    this.record(useDocStore.getState().source);
    return useDocStore.subscribe((s, prev) => {
      if (s.source === prev.source) return;
      this.record(s.source);
    });
  }
}

/** The single document history — module-lived, so it survives remounts of
    the deck the way the classic closure survived re-renders. */
export const docHistory = new DocHistory();
