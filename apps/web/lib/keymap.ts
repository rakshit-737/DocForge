"use client";
/* The desk's editing keymap — added to SourcePane's extensions by the shell.

   Prec.high so these win over the default keymap while still yielding to
   panel-local handlers. Returning true makes CodeMirror preventDefault, so
   Mod-u never reaches the browser. Tab/Shift-Tab indent/outdent already ride
   in via indentWithTab in SourcePane (`{ key: "Tab", run: indentMore,
   shift: indentLess }` — verified in @codemirror/commands); that plus
   Mod-1/2/3 closes ledger I5.

   Note: the classic app spent Ctrl+K on the command palette. Here Mod-k is
   the link wrap (per the stage-3 chrome brief) and it wins while the editor
   is focused — if the palette keeps Ctrl+K, remove that entry here or move
   the palette to its classic global listener with a different key. */
import { type Extension, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import {
  insertLink,
  toggleBold,
  toggleCode,
  toggleH1,
  toggleH2,
  toggleH3,
  toggleItalic,
  toggleMark,
  toggleStrike,
  toggleUnderline,
} from "./editor-commands";
import { continueList, indentListItem, outdentListItem } from "./list-editing";

export const deskKeymap: Extension = Prec.high(
  keymap.of([
    { key: "Mod-b", run: toggleBold },
    { key: "Mod-i", run: toggleItalic },
    { key: "Mod-u", run: toggleUnderline },
    { key: "Mod-e", run: toggleCode },
    { key: "Mod-k", run: insertLink },
    { key: "Mod-1", run: toggleH1 },
    { key: "Mod-2", run: toggleH2 },
    { key: "Mod-3", run: toggleH3 },
    /* the marks that only had toolbar plates get keys of their own:
       strike (⌘⇧X) and the yellow highlighter (⌘⇧H — toggleMark is
       setHighlight("yellow"), the classic ==…== wrap) */
    { key: "Mod-Shift-x", run: toggleStrike },
    { key: "Mod-Shift-h", run: toggleMark },
    /* Smart lists (§8.1): Enter carries the marker to the next item and an
       empty item ends the list; Tab/Shift-Tab nest and un-nest the item.
       Each returns false outside a list, so the editor's own Enter and the
       indentWithTab binding still run everywhere else. */
    { key: "Enter", run: continueList },
    { key: "Tab", run: indentListItem, shift: outdentListItem },
  ]),
);
