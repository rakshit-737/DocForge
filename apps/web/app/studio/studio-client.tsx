"use client";
/* The studio is browser-only by nature (Paged.js, CodeMirror, IndexedDB) —
   it mounts client-side with no server render. */
import dynamic from "next/dynamic";

const StudioShell = dynamic(() => import("@/components/studio-shell").then((m) => m.StudioShell), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-0 flex-1 items-center justify-center">
      <p className="font-mono text-sm text-ink-3">warming up the press…</p>
    </main>
  ),
});

export function StudioClient() {
  return <StudioShell />;
}
