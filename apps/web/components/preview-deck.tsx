"use client";
/* The stone — hosts the Paged.js deck. React renders the containers once and
   never looks inside; the PreviewController owns everything within. */
import { useEffect, useRef } from "react";
import { PreviewController } from "@/lib/preview-controller";
import { useDocStore, useUiStore } from "@/lib/store";

export function PreviewDeck({
  controllerRef,
}: {
  controllerRef: (c: PreviewController | null) => void;
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
    });
    controller.zoomMode = ui.zoomMode;
    controller.zoomVal = ui.zoomVal;
    controllerRef(controller);

    const doc = useDocStore.getState();
    // First composition — render whatever the document holds on mount.
    void controller.render(doc.source, doc.settings, doc.attachments);

    const unsub = useDocStore.subscribe((s, prev) => {
      if (s.source === prev.source && s.settings === prev.settings) return;
      // Settings changes recompose immediately; typing waits the classic 420ms.
      const delay = s.settings !== prev.settings ? 60 : 420;
      controller.schedule(
        () => controller.render(s.source, s.settings, s.attachments),
        delay,
      );
    });

    const onResize = () => {
      if (controller.zoomMode === "fit") controller.applyZoom(useDocStore.getState().settings);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      unsub();
      controllerRef(null);
      controller.destroy();
    };
  }, [controllerRef]);

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
