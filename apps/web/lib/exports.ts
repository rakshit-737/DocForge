"use client";
/* Exports — explicit actions that produce files (Ctrl+S never does; ledger I2).
   DOCX goes through @docforge/export-docx exactly like the classic edition:
   the rendered .content clone in, a Blob out, with the docx library and the
   font bytes loaded lazily on first use. PDF rides the print route (the
   direct-PDF path is issue #9, §8.4). */
import { loadDocx, loadFontData, loadStudio } from "./bootstrap";
import { flushActiveLiveEdit } from "./live-edit";
import type { PreviewController } from "./preview-controller";
import type { Settings } from "./settings";

function safeName(settings: Settings): string {
  return (
    ((settings.title as string) || "document")
      .replace(/[^\w-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "document"
  );
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function exportDocx(
  controller: PreviewController,
  settings: Settings,
  attachments: Record<string, unknown>,
): Promise<string> {
  if (!controller.lastContentEl) throw new Error("Nothing rendered yet");
  flushActiveLiveEdit(); // pending manuscript edits reach the source before it exports
  await Promise.all([loadDocx(), loadFontData(), loadStudio()]);
  const { api } = await import("@docforge/export-docx");
  const blob = await api.DocxExport.build(controller.lastContentEl, settings as never, attachments);
  const name = `${safeName(settings)}.docx`;
  downloadBlob(blob, name);
  return name;
}

/** Print route: clear the preview zoom for true-size pages, print, restore. */
export function exportPdf(controller: PreviewController, settings: Settings) {
  const deck = controller.deck;
  const prevZoom = deck.style.zoom;
  const prevTransform = deck.style.transform;
  deck.style.zoom = "";
  deck.style.transform = "";
  const restore = () => {
    deck.style.zoom = prevZoom;
    deck.style.transform = prevTransform;
    controller.applyZoom(settings);
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  try {
    window.print();
  } catch {
    restore();
    throw new Error("Printing is blocked in this browser context");
  }
}
