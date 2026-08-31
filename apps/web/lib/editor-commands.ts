"use client";
/* Every classic toolbar action (src/js/main.js TOOL_ACTS) as a CodeMirror 6
   command: (EditorView) => boolean. Each command dispatches exactly ONE
   transaction — undo-safe by construction — and preserves the selection the
   way the classic textarea helpers did (the wrapped core stays selected).

   Ported semantics:
   - surround/wrapInline → wrapCmd: leading/trailing whitespace stays outside
     the marks (`++text ++` would not tokenize), and a second press unwraps —
     the marks toggle, judged from the selection or its immediate context.
   - linePrefix → lineCmd: strips any existing block prefix, then applies the
     new one; pressing the same tool again removes it (heading toggles — I5).
   - insertBlock: blank-line separation before/after, caret after the block.
   - footnote ids = max existing + 1 (counting would collide after a deletion
     and silently overwrite the other note's text on export). */
import { type ChangeSpec, EditorSelection } from "@codemirror/state";
import type { Command, EditorView } from "@codemirror/view";
import type { HlColorName } from "@docforge/engine";

/* Word's fixed highlighter palette — mirrored from packages/engine/src/parse.ts
   HL_COLORS. The engine's runtime must stay behind loadStudio()'s dynamic
   import (it registers marked extensions at import time), so the chrome keeps
   a local copy of the 15 names + hexes; the HlColorName type keeps it honest. */
export const HL_COLORS: Record<HlColorName, string> = {
  yellow: "FFFF00",
  green: "00FF00",
  cyan: "00FFFF",
  magenta: "FF00FF",
  blue: "0000FF",
  red: "FF0000",
  darkBlue: "00008B",
  darkCyan: "008B8B",
  darkGreen: "006400",
  darkMagenta: "8B008B",
  darkRed: "8B0000",
  darkYellow: "808000",
  darkGray: "808080",
  lightGray: "D3D3D3",
  black: "000000",
};

/* ---------------- inline marks ---------------- */

interface WrapOpts {
  ph: string;
  /** Sub/superscript marks cannot contain whitespace — refuse instead of breaking. */
  noSpaces?: boolean;
  /** Asymmetric wraps (link, span attributes) never try to toggle off. */
  noToggle?: boolean;
}

function wrapCmd(pre: string, post: string, opts: WrapOpts): Command {
  return (view) => {
    const { state } = view;
    if (opts.noSpaces) {
      const main = state.selection.main;
      if (/\s/.test(state.sliceDoc(main.from, main.to).trim())) return false;
    }
    const dl = pre.length;
    const dr = post.length;
    const spec = state.changeByRange((range) => {
      const raw = state.sliceDoc(range.from, range.to);
      const lead = raw.match(/^\s*/)?.[0] ?? "";
      const trail = raw.slice(lead.length).match(/\s*$/)?.[0] ?? "";
      const start = range.from + lead.length;
      const end = range.to - trail.length;
      const core = raw.slice(lead.length, raw.length - trail.length);
      // For single-char delimiters a longer run means a different mark
      // (`*` inside `**`, `~` inside `~~`) — never unwrap through those.
      const extended = dl === 1 && core.startsWith(pre + pre);
      if (!opts.noToggle && !extended) {
        // Toggle off, form 1: the selection carries its own marks.
        if (core.length > dl + dr && core.startsWith(pre) && core.endsWith(post)) {
          const inner = core.slice(dl, core.length - dr);
          return {
            changes: { from: start, to: end, insert: inner },
            range: EditorSelection.range(start, start + inner.length),
          };
        }
        // Toggle off, form 2: the marks sit just outside the selection.
        const before = start - dl >= 0 ? state.sliceDoc(start - dl, start) : "";
        const after = state.sliceDoc(end, Math.min(state.doc.length, end + dr));
        const beyondB = start - dl - 1 >= 0 ? state.sliceDoc(start - dl - 1, start - dl) : "";
        const beyondA = state.sliceDoc(end + dr, Math.min(state.doc.length, end + dr + 1));
        if (
          core.length > 0 &&
          before === pre &&
          after === post &&
          beyondB !== pre.charAt(0) &&
          beyondA !== post.charAt(post.length - 1)
        ) {
          return {
            changes: [
              { from: start - dl, to: start },
              { from: end, to: end + dr },
            ],
            range: EditorSelection.range(start - dl, end - dl),
          };
        }
      }
      // Wrap. An empty selection gets the classic placeholder, ready to type over.
      const body = core || opts.ph;
      return {
        changes: { from: start, to: end, insert: pre + body + post },
        range: EditorSelection.range(start + dl, start + dl + body.length),
      };
    });
    view.dispatch({ ...spec, userEvent: "input.format", scrollIntoView: true });
    return true;
  };
}

export const toggleBold = wrapCmd("**", "**", { ph: "bold text" });
export const toggleItalic = wrapCmd("*", "*", { ph: "italic text" });
export const toggleUnderline = wrapCmd("++", "++", { ph: "underlined text" });
export const toggleStrike = wrapCmd("~~", "~~", { ph: "struck-out text" });
export const toggleCode = wrapCmd("`", "`", { ph: "code" });
export const toggleSub = wrapCmd("~", "~", { ph: "2", noSpaces: true });
export const toggleSup = wrapCmd("^", "^", { ph: "2", noSpaces: true });
export const insertLink = wrapCmd("[", "](https://)", { ph: "link text", noToggle: true });

/** `==text==` for yellow, `=={colour}text==` for the other 14 Word highlighter inks. */
export function setHighlight(name: HlColorName | string = "yellow"): Command {
  return wrapCmd(name === "yellow" ? "==" : `=={${name}}`, "==", { ph: "highlighted text" });
}
export const toggleMark = setHighlight("yellow");

/* Span-attribute helpers — prompt-less, value in, Command out. Built exactly
   as the dialect writes them: `[text]{color=#c00 bg=#ffe28a size=14 font="Georgia"}`. */
export const setTextColor = (hex: string): Command =>
  wrapCmd("[", `]{color=${hex}}`, { ph: "coloured text", noToggle: true });
export const setTextBg = (hex: string): Command =>
  wrapCmd("[", `]{bg=${hex}}`, { ph: "text", noToggle: true });
export const setTextSize = (pt: number | string): Command =>
  wrapCmd("[", `]{size=${pt}}`, { ph: "text", noToggle: true });
export const setTextFont = (name: string): Command =>
  wrapCmd("[", `]{font="${name}"}`, { ph: "text", noToggle: true });

/* ---------------- line operations ---------------- */

const LINE_PREFIX_RE = /^(\s*)(#{1,4}\s+|[-*]\s+|\d+\.\s+|>\s+)?/;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function lineCmd(prefix: string, numbered = false): Command {
  const targetRe = numbered ? /^\s*\d+\.\s/ : new RegExp(`^\\s*${escapeRe(prefix)}`);
  return (view) => {
    const { state } = view;
    const main = state.selection.main;
    const first = state.doc.lineAt(main.from).number;
    const last = state.doc.lineAt(main.to).number;
    const lines = [];
    for (let n = first; n <= last; n++) lines.push(state.doc.line(n));
    // Every line already wears this exact prefix → the second press takes it off.
    const allOn = lines.every((l) => targetRe.test(l.text));
    const changes: ChangeSpec[] = [];
    let i = 0;
    for (const line of lines) {
      const m = LINE_PREFIX_RE.exec(line.text);
      const ws = m?.[1] ?? "";
      const old = m?.[2] ?? "";
      i++;
      const insert = allOn ? "" : numbered ? `${i}. ` : prefix;
      if (old === insert) continue;
      changes.push({ from: line.from + ws.length, to: line.from + ws.length + old.length, insert });
    }
    if (changes.length) view.dispatch({ changes, userEvent: "input.format", scrollIntoView: true });
    return true;
  };
}

export const toggleH1 = lineCmd("# ");
export const toggleH2 = lineCmd("## ");
export const toggleH3 = lineCmd("### ");
export const toggleBulletList = lineCmd("- ");
export const toggleNumberList = lineCmd("", true);
export const toggleQuote = lineCmd("> ");

/* Wrap the selected lines in an alignment container; a second press unwraps it. */
function alignCmd(dir: "left" | "center" | "right" | "justify"): Command {
  return (view) => {
    const { state } = view;
    const doc = state.doc;
    const main = state.selection.main;
    const fl = doc.lineAt(main.from);
    const tl = doc.lineAt(main.to);
    const inner = state.sliceDoc(fl.from, tl.to);
    const prev = fl.number > 1 ? doc.line(fl.number - 1) : null;
    const next = tl.number < doc.lines ? doc.line(tl.number + 1) : null;
    if (
      prev &&
      next &&
      new RegExp(`^:::${dir}\\s*$`, "i").test(prev.text) &&
      /^:::\s*$/.test(next.text)
    ) {
      view.dispatch({
        changes: { from: prev.from, to: next.to, insert: inner },
        selection: EditorSelection.range(prev.from, prev.from + inner.length),
        userEvent: "input.format",
        scrollIntoView: true,
      });
    } else {
      const wrapped = `:::${dir}\n${inner}\n:::`;
      view.dispatch({
        changes: { from: fl.from, to: tl.to, insert: wrapped },
        selection: EditorSelection.range(fl.from, fl.from + wrapped.length),
        userEvent: "input.format",
        scrollIntoView: true,
      });
    }
    return true;
  };
}

export const alignLeft = alignCmd("left");
export const alignCenter = alignCmd("center");
export const alignRight = alignCmd("right");
export const alignJustify = alignCmd("justify");

/* ---------------- selection transforms ---------------- */

/* UPPER → lower → Title, judged from what the selection currently is.
   Attachment keys and URLs are case-sensitive machinery, not prose — skip them. */
const CASE_SAFE = /(\|\s*img:[A-Za-z0-9]+|\]\([^)\n]*\)|https?:\/\/\S+)/g;
const mapProse = (sel: string, fn: (t: string) => string) =>
  sel
    .split(CASE_SAFE)
    .map((part, i) => (i % 2 ? part : fn(part)))
    .join("");

export const cycleCase: Command = (view) => {
  const { state } = view;
  const main = state.selection.main;
  const sel = state.sliceDoc(main.from, main.to);
  if (!sel || !/[a-z]/i.test(sel)) return false;
  let next: string;
  if (sel === mapProse(sel, (t) => t.toUpperCase())) {
    next = mapProse(sel, (t) => t.toLowerCase());
  } else if (sel === mapProse(sel, (t) => t.toLowerCase())) {
    next = mapProse(sel, (t) =>
      t.replace(
        /([a-z])([a-z']*)/gi,
        (_m, a: string, b: string) => a.toUpperCase() + b.toLowerCase(),
      ),
    );
  } else {
    next = mapProse(sel, (t) => t.toUpperCase());
  }
  view.dispatch({
    changes: { from: main.from, to: main.to, insert: next },
    selection: EditorSelection.range(main.from, main.from + next.length),
    userEvent: "input.format",
    scrollIntoView: true,
  });
  return true;
};

/* Word's "clear formatting": peel every character-level mark off the selection.
   Runs a few passes so nested marks unwrap fully. */
export const clearFormatting: Command = (view) => {
  const { state } = view;
  const main = state.selection.main;
  if (main.empty) return false;
  let sel = state.sliceDoc(main.from, main.to);
  for (let i = 0; i < 4; i++) {
    sel = sel
      .replace(/\[([^[\]{}\n]+)\]\{[^}\n]*\}/g, "$1")
      .replace(/\*\*([^*\n]+)\*\*/g, "$1")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2")
      .replace(/\+\+([^+\n]+)\+\+/g, "$1")
      .replace(/~~([^~\n]+)~~/g, "$1")
      .replace(/==(?:\{[A-Za-z]+\})?([^=\n]+)==/g, "$1")
      .replace(/\^([^\s^]+)\^/g, "$1")
      .replace(/(^|[^~])~([^\s~]+)~(?!~)/g, "$1$2")
      .replace(/`([^`\n]+)`/g, "$1");
  }
  view.dispatch({
    changes: { from: main.from, to: main.to, insert: sel },
    selection: EditorSelection.range(main.from, main.from + sel.length),
    userEvent: "input.format",
    scrollIntoView: true,
  });
  return true;
};

/* ---------------- block inserts ---------------- */

function blockCmd(text: string): Command {
  return (view) => {
    const { state } = view;
    const main = state.selection.main;
    const before = state.sliceDoc(0, main.from);
    const after = state.sliceDoc(main.to);
    const pre = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const post = after && !after.startsWith("\n") ? "\n\n" : "\n";
    const insert = pre + text + post;
    view.dispatch({
      changes: { from: main.from, to: main.to, insert },
      selection: EditorSelection.cursor(main.from + insert.length),
      userEvent: "input.insert",
      scrollIntoView: true,
    });
    return true;
  };
}

export const insertTable = blockCmd(
  "| Column | Column | Column |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |",
);
export const insertEquation = blockCmd("$$\nE = mc^2\n$$");
export const insertCallout = blockCmd(":::note Optional title\nYour note text here.\n:::");
export const insertFigure = blockCmd("[screenshot: Describe what the screenshot shows]");
export const insertPagebreak = blockCmd("[pagebreak]");
export const insertToc = blockCmd("[toc]");
export const insertDivider = blockCmd("---");
export const insertCodeBlock = blockCmd("```\ncode here\n```");

/* Reference + definition in ONE transaction (the classic did it in two): the
   marker lands at the caret, the definition on the document's last line. */
function insertWithDef(view: EditorView, ref: string, def: string): boolean {
  const { state } = view;
  const main = state.selection.main;
  const src = state.doc.toString();
  const afterTrimmed = src.slice(main.to).replace(/\s*$/, "");
  view.dispatch({
    changes: { from: main.from, to: src.length, insert: `${ref}${afterTrimmed}\n\n${def}\n` },
    selection: EditorSelection.cursor(main.from + ref.length),
    userEvent: "input.insert",
    scrollIntoView: true,
  });
  return true;
}

export const insertFootnote: Command = (view) => {
  const ids = [...view.state.doc.toString().matchAll(/\[\^(\d+)\]/g)].map((m) => Number(m[1]));
  const n = (ids.length ? Math.max(...ids) : 0) + 1;
  return insertWithDef(view, `[^${n}]`, `[^${n}]: Footnote text`);
};

export const insertCitation: Command = (view) =>
  insertWithDef(view, "[@key]", "[@key]: Author, *Title of the source*, Publisher, Year.");
