"use client";
/* The source pane — CodeMirror 6 wearing the copy desk. Replaces the classic
   textarea with real editor machinery: markdown highlighting, proper undo,
   multiple cursors, and (stage 3) the search panel with counts and toggles. */
import { autocompletion, closeCompletion, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { handleImagePaste } from "@/components/image-tool";
import { findKeymap, toast } from "@/lib/find";
import { htmlToMd } from "@/lib/html-to-md";
import { deskKeymap } from "@/lib/keymap";
import { flushActiveLiveEdit } from "@/lib/live-edit";
import { slashCompletions } from "@/lib/slash";
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
  /* The slash menu wears the desk: a tray-coloured plate on the elevation
     scale, square corners, mono labels, one accent bar on the selection —
     never the browser's default listbox. */
  ".cm-tooltip.cm-tooltip-autocomplete": {
    border: "1px solid var(--line)",
    background: "var(--bg2)",
    borderRadius: "2px",
    boxShadow: "var(--elev-m)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul": {
    fontFamily: "var(--mono)",
    fontSize: "12px",
    maxHeight: "18em",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    padding: "5px 10px",
    color: "var(--tx2)",
    borderLeft: "2px solid transparent",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    background: "var(--bg3)",
    color: "var(--tx)",
    borderLeftColor: "var(--pri)",
  },
  ".cm-completionLabel": { color: "var(--tx)" },
  ".cm-completionDetail": {
    display: "block",
    marginTop: "1px",
    fontStyle: "normal",
    fontSize: "11px",
    color: "var(--tx3)",
  },
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
        /* Slash commands (§8.1): `/table 3x4`, `/figure`, `/callout warning`
           — the dialect offering itself at the head of a line. Its keymap
           sits above the desk's so Enter takes the highlighted entry while
           the menu is open, and falls through to the editor when it isn't. */
        autocompletion({
          override: [slashCompletions],
          activateOnTyping: true,
          icons: false,
          defaultKeymap: false,
          aboveCursor: false,
        }),
        keymap.of(completionKeymap),
        deskKeymap, // Prec.high: Mod-b/i/u/e/k, Mod-1/2/3 heading toggles (I5)
        keymap.of([...findKeymap]), // Mod-f/h, F3/Shift-F3, Esc-closes-find — before defaults
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        deskTheme,
        EditorView.contentAttributes.of({
          "aria-label": "Manuscript source",
          tabindex: "0",
        }),
        // smart paste: a clipboard image becomes an attached, captioned
        // figure; rich HTML (Word, web pages) converts to Markdown behind
        // the classic structure sniff (src/js/main.js:2292) — plain text
        // pastes stay untouched, and Ctrl+Z restores the raw text
        EditorView.domEventHandlers({
          paste: (e, v) => {
            if (handleImagePaste(e, v)) return true;
            const html = e.clipboardData?.getData("text/html");
            if (!html || !/<(h[1-6]|p|li|table|b|strong|em|i|a)\b/i.test(html)) return false;
            const md = htmlToMd(html);
            if (!md) return false;
            e.preventDefault();
            const { from, to } = v.state.selection.main;
            v.dispatch({
              changes: { from, to, insert: md },
              selection: { anchor: from + md.length },
              userEvent: "input.paste",
            });
            toast("Pasted as Markdown — Ctrl+Z restores the raw text");
            return true;
          },
        }),
        EditorView.lineWrapping,
        // Classic editor-focus call site: the source pane must never act on a
        // source the manuscript hasn't written yet.
        EditorView.domEventHandlers({
          focus: () => {
            flushActiveLiveEdit();
          },
          blur: (_e, v) => {
            closeCompletion(v); // a menu must never outlive the caret that opened it
            return false;
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
