"use client";
/* ============================================================
   list-editing.ts — smart lists (§8.1 "Editor upgrades").

   Enter inside a list item continues the list; Enter on an EMPTY
   item ends it instead of leaving a dead marker behind. Tab and
   Shift+Tab nest and un-nest the item under the caret rather than
   inserting whitespace wherever the caret happens to be.

   Everything is a pure line transform plus one dispatched
   transaction, so each keystroke stays a single undo step and the
   markdown never gets reflowed behind the writer's back.
   ============================================================ */
import { EditorSelection } from "@codemirror/state";
import type { Command } from "@codemirror/view";

export interface ListMarker {
  /** Whitespace before the marker. */
  indent: string;
  /** The marker as typed: "- ", "* ", "3. ", "> ", "- [ ] ". */
  marker: string;
  /** Ordered lists carry their number. */
  number?: number;
  /** Everything after the marker. */
  content: string;
  /** A task item's box, if it has one. */
  task?: boolean;
}

const BULLET = /^(\s*)([-*+])(\s+)(\[[ xX]\]\s+)?(.*)$/;
const ORDERED = /^(\s*)(\d+)([.)])(\s+)(\[[ xX]\]\s+)?(.*)$/;
const QUOTE = /^(\s*)(>)(\s+)(.*)$/;

/** Read the list marker a line opens with, if any. */
export function readMarker(line: string): ListMarker | null {
  const b = BULLET.exec(line);
  if (b) {
    const [, indent = "", bullet = "-", gap = " ", box, content = ""] = b;
    return {
      indent,
      marker: `${bullet}${gap}${box ? "[ ] " : ""}`,
      content,
      ...(box ? { task: true } : {}),
    };
  }
  const o = ORDERED.exec(line);
  if (o) {
    const [, indent = "", digits = "1", dot = ".", gap = " ", box, content = ""] = o;
    return {
      indent,
      marker: `${digits}${dot}${gap}${box ? "[ ] " : ""}`,
      number: Number(digits),
      content,
      ...(box ? { task: true } : {}),
    };
  }
  const q = QUOTE.exec(line);
  if (q) {
    const [, indent = "", angle = ">", gap = " ", content = ""] = q;
    return { indent, marker: `${angle}${gap}`, content };
  }
  return null;
}

/** The marker the NEXT item should carry: ordered lists count on. */
export function nextMarker(m: ListMarker): string {
  if (m.number == null) return m.marker;
  const tail = m.marker.slice(String(m.number).length);
  return `${m.number + 1}${tail}`;
}

/** Enter: continue the list, or end it when the item is empty.
    Returns false everywhere else so the editor's own Enter runs. */
export const continueList: Command = (view) => {
  const { state } = view;
  const range = state.selection.main;
  if (!range.empty) return false;
  const line = state.doc.lineAt(range.head);
  // Only when the caret sits at the END of the line — mid-line Enter splits
  // the text, and inventing a marker there would be a surprise.
  if (range.head !== line.to) return false;
  const m = readMarker(line.text);
  if (!m) return false;

  if (m.content.trim() === "") {
    /* An empty item ends the list: the marker goes, one blank line stands.
       Nested items step out one level instead, which is what a writer
       reaching for Enter twice actually means. */
    if (m.indent.length >= 2) {
      const outdented = `${m.indent.slice(2)}${m.marker}`;
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: outdented },
        selection: EditorSelection.cursor(line.from + outdented.length),
        userEvent: "input",
        scrollIntoView: true,
      });
      return true;
    }
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: "" },
      selection: EditorSelection.cursor(line.from),
      userEvent: "input",
      scrollIntoView: true,
    });
    return true;
  }

  const insert = `\n${m.indent}${nextMarker(m)}`;
  view.dispatch({
    changes: { from: range.head, insert },
    selection: EditorSelection.cursor(range.head + insert.length),
    userEvent: "input",
    scrollIntoView: true,
  });
  return true;
};

/** Tab / Shift+Tab inside a list: nest or un-nest every touched item by two
    spaces. Outside a list the editor's own indent command still runs. */
function nest(delta: 1 | -1): Command {
  return (view) => {
    const { state } = view;
    const range = state.selection.main;
    const first = state.doc.lineAt(range.from);
    const last = state.doc.lineAt(range.to);
    const lines = [];
    for (let n = first.number; n <= last.number; n++) lines.push(state.doc.line(n));
    if (!lines.some((l) => readMarker(l.text))) return false;
    /* The first item of a list has nothing to nest under — indenting it would
       make a stray sub-list of one, so leave it to the editor. */
    if (delta === 1 && first.number > 1) {
      const above = readMarker(state.doc.line(first.number - 1).text);
      const here = readMarker(first.text);
      if (!above && here && here.indent === "") return false;
    } else if (delta === 1 && first.number === 1) {
      return false;
    }

    const changes = [];
    for (const line of lines) {
      const m = readMarker(line.text);
      if (!m) continue;
      if (delta === 1) {
        changes.push({ from: line.from, insert: "  " });
      } else if (m.indent.length > 0) {
        const drop = Math.min(2, m.indent.length);
        changes.push({ from: line.from, to: line.from + drop });
      }
    }
    if (changes.length === 0) return false;
    view.dispatch({ changes, userEvent: "input.indent", scrollIntoView: true });
    return true;
  };
}

export const indentListItem = nest(1);
export const outdentListItem = nest(-1);
