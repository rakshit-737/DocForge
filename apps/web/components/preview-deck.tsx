"use client";
/* The stone — hosts the Paged.js deck. React renders the containers once and
   never looks inside; the PreviewController owns everything within. */
import { useEffect, useRef } from "react";
import { toast } from "@/lib/find";
import { docHistory } from "@/lib/history";
import { LiveEdit } from "@/lib/live-edit";
import { PreviewController } from "@/lib/preview-controller";
import { useDocStore, useUiStore } from "@/lib/store";

export function PreviewDeck({
  controllerRef,
  onRendered,
}: {
  controllerRef: (c: PreviewController | null) => void;
  onRendered?: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const deck = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scroller.current || !deck.current) return;
    const ui = useUiStore.getState();
    const controller = new PreviewController(deck.current, scroller.current, {
      onPageInfo: (t) => useUiStore.getState().setPageInfo(t),
      onBusy: (b) => useUiStore.getState().setBusy(b),
      onZoomPct: (zoomPct) => useUiStore.setState({ zoomPct }),
      onRendered,
    });
    controller.zoomMode = ui.zoomMode;
    controller.zoomVal = ui.zoomVal;
    controllerRef(controller);

    /* Stage 6 — the manuscript itself is an editing surface. The hooks write
       through the store (a splice, never a clobber) so both panes stay
       downstream of the one source of truth; the press drives the classic
       call points (flush/captureView/arm/restoreView) inside render(). */
    let fromLiveEdit = false;
    const live = new LiveEdit();
    const compose = () => {
      live.flush(); // any pending manuscript edit reaches the source first
      const s = useDocStore.getState();
      return controller.render(s.source, s.settings, s.attachments);
    };
    live.attach(deck.current, {
      scroller: scroller.current,
      getSource: () => useDocStore.getState().source,
      setSource: (_src, splice) => {
        fromLiveEdit = true;
        try {
          useDocStore.getState().spliceSource(splice.from, splice.to, splice.insert);
        } finally {
          fromLiveEdit = false;
        }
      },
      revert: () => {
        toast("That part of the manuscript is generated — edit it from the source panel", "warn");
        void compose();
      },
      // classic scheduleLiveRender: direct manuscript edits keep the DOM
      // current natively, so the rebuild waits for 1300ms of genuine quiet
      editPending: () => controller.schedule(compose, 1300),
      undo: () => docHistory.undo(),
      redo: () => docHistory.redo(),
    });
    controller.attachLiveEdit(live);
    const detachHistory = docHistory.attach();

    /* The classic shell shortcut (main.js ~2309): ONE document history for
       both panes. Focus in the manuscript routes Ctrl+Z / Ctrl+Y (and
       Ctrl+Shift+Z) to the store history — keydown, because the browser only
       emits historyUndo/historyRedo beforeinput while its own CE stacks are
       non-empty. Focus in the editor keeps CodeMirror's keystroke-level
       history (see lib/history.ts for the division of labour). */
    const deckEl = deck.current;
    const onHistoryKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      if (!(e.target instanceof Node) || !deckEl.contains(e.target)) return;
      e.preventDefault();
      live.flush(); // pending manuscript edits reach the source before it moves
      if (k === "y" || e.shiftKey) docHistory.redo();
      else docHistory.undo();
    };
    document.addEventListener("keydown", onHistoryKey);

    // First composition — render whatever the document holds on mount.
    void compose();

    const unsub = useDocStore.subscribe((s, prev) => {
      if (s.source === prev.source && s.settings === prev.settings) return;
      // Settings changes recompose immediately; source-pane typing waits the
      // classic 420ms; a live-edit splice idles the classic 1300ms.
      const delay = s.settings !== prev.settings ? 60 : fromLiveEdit ? 1300 : 420;
      controller.schedule(compose, delay);
    });

    const onResize = () => {
      if (controller.zoomMode === "fit") controller.applyZoom(useDocStore.getState().settings);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onHistoryKey);
      unsub();
      detachHistory();
      controller.attachLiveEdit(null);
      live.detach();
      controllerRef(null);
      controller.destroy();
    };
    // both callbacks must be referentially stable (the shell wraps them in useCallback([]))
  }, [controllerRef, onRendered]);

  return (
    <div
      ref={scroller}
      className="relative h-full min-h-0 overflow-auto bg-stone"
      data-preview-scroll=""
    >
      <div ref={deck} className="mx-auto w-fit py-6" data-deck="" />
    </div>
  );
}
