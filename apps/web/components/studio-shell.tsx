"use client";
/* The studio shell, stage 2: masthead · source pane · the stone · wire ticker.
   The full chrome (toolbar, settings drawer, palette, find, outline,
   templates) mounts here in stage 3. */
import type { EditorView } from "@codemirror/view";
import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import type { PreviewController } from "@/lib/preview-controller";
import { useDocStore, useUiStore } from "@/lib/store";
import { PreviewDeck } from "./preview-deck";
import { SourcePane } from "./source-pane";

const STARTER = `# Welcome to the studio

Type on the left — the press sets your pages on the right.

## What works already

- The full **DocForge dialect**: ==marks==, ++underline++, ~sub~ and ^sup^, footnotes[^1],
  citations, tables, callouts, $\\LaTeX$ math and cross-references
- Paginated preview through the same engine the single-file edition ships
- The night shift: try the switch in the masthead

[^1]: Set at the true page foot, exactly as it prints.
`;

export function StudioShell() {
  const controller = useRef<PreviewController | null>(null);
  const editorView = useRef<EditorView | null>(null);
  const pageInfo = useUiStore((s) => s.pageInfo);
  const busy = useUiStore((s) => s.busy);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const title = useDocStore((s) => s.settings.title);
  const zoomPct = useUiStore((s) => s.zoomPct);

  useEffect(() => {
    // Boot with the starter document until stage 4 restores the last session.
    if (!useDocStore.getState().source) {
      useDocStore.getState().setSource(STARTER);
      useDocStore.getState().patchSettings({ title: "Welcome to the studio" });
    }
    // Restore the saved shift for the store (the DOM attribute is already set).
    try {
      if (localStorage.getItem("docforge.ui.theme") === "dark") {
        useUiStore.setState({ theme: "dark" });
      }
    } catch {}
  }, []);

  const setController = useCallback((c: PreviewController | null) => {
    controller.current = c;
  }, []);

  const zoom = (delta: number) => {
    const c = controller.current;
    if (!c) return;
    const next = Math.min(2, Math.max(0.25, (c.zoomVal || 1) + delta));
    c.setZoom("man", next, useDocStore.getState().settings);
  };
  const zoomFit = () => {
    controller.current?.setZoom("fit", controller.current.zoomVal, useDocStore.getState().settings);
  };

  return (
    <div className="flex h-full flex-col">
      {/* masthead — the serif nameplate over a double ink rule */}
      <header className="flex items-center gap-4 border-b-4 border-double border-rule bg-desk px-4 py-2">
        <Link href="/" className="font-display text-xl font-bold tracking-tight text-ink">
          DocForge
        </Link>
        <span className="min-w-0 truncate text-sm text-ink-2">{title || "Untitled document"}</span>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="border border-line bg-tray px-2 py-1 font-mono text-xs text-ink-2 hover:text-ink"
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? "Day desk" : "Night shift"}
          </button>
        </div>
      </header>

      {/* the desk: source galley left, the stone right */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(320px,42%)_1fr]">
        <section aria-label="Source" className="min-h-0 border-r border-line">
          <SourcePane
            viewRef={(v) => {
              editorView.current = v;
            }}
          />
        </section>
        <section aria-label="Preview" className="min-h-0">
          <PreviewDeck controllerRef={setController} />
        </section>
      </div>

      {/* the wire ticker */}
      <footer className="flex items-center gap-4 border-t border-rule bg-surface px-4 py-1 font-mono text-xs text-ink-2">
        <output aria-live="polite" className="tabular-nums">
          {busy && !pageInfo ? "composing…" : pageInfo || "—"}
        </output>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Zoom">
          <button type="button" onClick={() => zoom(-0.1)} className="px-1 hover:text-ink" aria-label="Zoom out">
            −
          </button>
          <button
            type="button"
            onClick={zoomFit}
            className="min-w-12 px-1 tabular-nums hover:text-ink"
            title="Reset to fit"
          >
            {zoomPct}%
          </button>
          <button type="button" onClick={() => zoom(0.1)} className="px-1 hover:text-ink" aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={zoomFit} className="px-1 hover:text-ink">
            Fit
          </button>
        </div>
      </footer>
    </div>
  );
}
