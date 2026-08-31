"use client";
/* ============================================================
   drop-zone.tsx — copy landing on the desk.

   Port of the classic drop affordance (src/index.html #dropHint,
   src/app.css, src/js/main.js): while a file is held over the window, an
   ink-ruled landing zone names what dropping will do. Counted
   dragenter/dragleave so child churn can't flicker it; files-only, so
   in-editor text drags behave natively. Capture-phase listeners so the
   drop is claimed before CodeMirror's own file handling sees it.

   Pointer affordance only — aria-hidden; the keyboard path is the Open
   button. The parent routes the files (pickDropFile + importFile in
   lib/imports.ts).
   ============================================================ */
import { useEffect, useState } from "react";

export function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);

  useEffect(() => {
    let depth = 0;
    const dragHas = (e: DragEvent) => [...(e.dataTransfer?.types || [])].includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!dragHas(e)) return;
      depth++;
      setOver(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!dragHas(e)) return;
      if (--depth <= 0) {
        depth = 0;
        setOver(false);
      }
    };
    // preventDefault on dragover is what makes the window a legal drop target.
    const onOver = (e: DragEvent) => {
      if (dragHas(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      depth = 0;
      setOver(false);
      const files = [...(e.dataTransfer?.files || [])];
      if (!files.length) return; // let plain text drops behave natively
      e.preventDefault();
      e.stopPropagation(); // CodeMirror must not also paste the file's bytes
      onFiles(files);
    };
    window.addEventListener("dragenter", onEnter, true);
    window.addEventListener("dragleave", onLeave, true);
    window.addEventListener("dragover", onOver, true);
    window.addEventListener("drop", onDrop, true);
    return () => {
      window.removeEventListener("dragenter", onEnter, true);
      window.removeEventListener("dragleave", onLeave, true);
      window.removeEventListener("dragover", onOver, true);
      window.removeEventListener("drop", onDrop, true);
    };
  }, [onFiles]);

  if (!over) return null;
  return (
    /* Ink, not grease pencil: dropping is composition, not an editorial mark. */
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-2 z-[50] flex items-center justify-center border-2 border-dashed border-rule"
      style={{
        background: "color-mix(in srgb, var(--bg) 93%, transparent)",
        animation: "df-fade var(--dur) var(--ease)",
      }}
    >
      <style>{"@keyframes df-fade{from{opacity:0}}"}</style>
      <div className="text-center">
        <div className="font-display text-lg italic text-ink">Drop to import</div>
        <div className="mt-1 text-[12.5px] text-ink-2">
          Word · PDF · Markdown · spreadsheet · deck · book · notebook · image
        </div>
      </div>
    </div>
  );
}
