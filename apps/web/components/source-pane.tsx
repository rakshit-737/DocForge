"use client";
/* The source pane — CodeMirror 6 wearing the copy desk. Replaces the classic
   textarea with real editor machinery: markdown highlighting, proper undo,
   multiple cursors, and (stage 3) the search panel with counts and toggles. */
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { findKeymap } from "@/lib/find";
import { deskKeymap } from "@/lib/keymap";
import { flushActiveLiveEdit } from "@/lib/live-edit";
import { consumeSplice, useDocStore } from "@/lib/store";

const deskTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13.5px",
    backgroundColor: "transparent",
    color: "var(--tx)",
  },
  ".cm-content": {
    fontFamily: "var(--mono)",
    caretColor: "var(--pri)",
    padding: "16px 18px",
    lineHeight: "1.6",
  },
  ".cm-cursor": { borderLeftColor: "var(--pri)" },
  "&.cm-focused": { outline: "none" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--pri) 18%, transparent)",
  },
  ".cm-line": { padding: "0" },
  ".cm-scroller": { overflow: "auto" },
});

export function SourcePane({ viewRef }: { viewRef?: (v: EditorView | null) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // Distinguishes store updates that originated here from external ones
  // (templates, file open) that must reset the editor content.
  const selfEdit = useRef(false);

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: useDocStore.getState().source,
      extensions: [
        history(),
        markdown(),
        placeholder("Write here — plain text with the DocForge dialect."),
        deskKeymap, // Prec.high: Mod-b/i/u/e/k, Mod-1/2/3 heading toggles (I5)
        keymap.of([...findKeymap]), // Mod-f/h, F3/Shift-F3, Esc-closes-find — before defaults
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        deskTheme,
        EditorView.contentAttributes.of({
          "aria-label": "Manuscript source",
          tabindex: "0",
        }),
        EditorView.lineWrapping,
        // Classic editor-focus call site: the source pane must never act on a
        // source the manuscript hasn't written yet.
        EditorView.domEventHandlers({
          focus: () => {
            flushActiveLiveEdit();
          },
        }),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return;
          selfEdit.current = true;
          useDocStore.getState().setSource(u.state.doc.toString());
          selfEdit.current = false;
        }),
      ],
    });
    const v = new EditorView({ state, parent: host.current });
    view.current = v;
    viewRef?.(v);

    const unsub = useDocStore.subscribe((s, prev) => {
      if (s.source === prev.source || selfEdit.current) return;
      if (v.state.doc.toString() === s.source) return;
      /* A live-edit splice arrives as a minimal change so the editor keeps
         its own caret, scroll and native history; the descriptor is verified
         against the actual before/after strings, and template/project loads
         and history restores still take the whole-replace path below. */
      const splice = consumeSplice();
      if (
        splice &&
        v.state.doc.toString() === prev.source &&
        prev.source.slice(0, splice.from) + splice.insert + prev.source.slice(splice.to) ===
          s.source
      ) {
        v.dispatch({ changes: { from: splice.from, to: splice.to, insert: splice.insert } });
        return;
      }
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: s.source } });
    });

    return () => {
      unsub();
      viewRef?.(null);
      v.destroy();
      view.current = null;
    };
  }, [viewRef]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden bg-tray" />;
}
