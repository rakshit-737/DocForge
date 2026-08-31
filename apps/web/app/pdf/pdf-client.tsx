"use client";
/* The bench is browser-only by nature (pdf.js canvases, pointer-driven
   overlay edits, pdf-lib export) — it mounts client-side with no server
   render, mirroring the studio route's pattern. */
import dynamic from "next/dynamic";

const PdfBench = dynamic(() => import("@/components/pdf-bench").then((m) => m.PdfBench), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-0 flex-1 items-center justify-center">
      <p className="font-mono text-sm text-ink-3">clearing the proofing bench…</p>
    </main>
  ),
});

export function PdfClient() {
  return <PdfBench />;
}
