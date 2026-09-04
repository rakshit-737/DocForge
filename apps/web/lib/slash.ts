"use client";
/* ============================================================
   slash.ts — the command palette's little sibling (§8.1).

   Type `/` at the start of a line and the dialect offers itself:
   `/table 3x4`, `/figure`, `/equation`, `/callout warning`,
   `/citation`. Every entry inserts correct dialect and leaves the
   caret where writing continues, so the constructs are discoverable
   by typing rather than by reading the crib sheet.

   Deliberately line-start only. Mid-sentence a slash is a slash —
   "and/or", a URL, a fraction — and a menu that pops up there would
   be a bug, not a feature.
   ============================================================ */
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export interface SlashCommand {
  /** What the reader types after the slash. */
  name: string;
  /** Menu line. */
  label: string;
  /** One line of what it does — the menu teaches the dialect. */
  detail: string;
  /** Extra words that should also find this entry. */
  also?: string[];
  /** The text to insert. `arg` is whatever followed the name. */
  build: (arg: string) => { text: string /** caret offset into `text` */; caret?: number };
}

/** `| a | b |` grid, header row and all — the shape insertTable writes. */
export function tableMarkdown(rows: number, cols: number): string {
  const r = Math.min(Math.max(rows, 1), 40);
  const c = Math.min(Math.max(cols, 1), 12);
  const head = `| ${Array.from({ length: c }, () => "Column").join(" | ")} |`;
  const rule = `| ${Array.from({ length: c }, () => "---").join(" | ")} |`;
  const body = Array.from(
    { length: r },
    () => `| ${Array.from({ length: c }, () => "Cell").join(" | ")} |`,
  );
  return [head, rule, ...body].join("\n");
}

/** "3x4" / "3 x 4" / "3" — rows and columns, however they were typed. */
export function parseGrid(arg: string): { rows: number; cols: number } {
  const m = /(\d+)\s*[x×]\s*(\d+)/i.exec(arg);
  if (m) return { rows: Number(m[1]), cols: Number(m[2]) };
  const one = /(\d+)/.exec(arg);
  if (one) return { rows: Number(one[1]), cols: 3 };
  return { rows: 2, cols: 3 };
}

const CALLOUT_KINDS = ["note", "tip", "warning", "important", "banner"];

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "table",
    label: "/table 3x4",
    detail: "A table — rows × columns, header row included",
    also: ["grid"],
    build: (arg) => {
      const { rows, cols } = parseGrid(arg);
      return { text: tableMarkdown(rows, cols), caret: 2 };
    },
  },
  {
    name: "figure",
    label: "/figure",
    detail: "A screenshot placeholder — click it in the preview to attach the image",
    also: ["screenshot", "image", "shot"],
    build: () => ({ text: "[screenshot: Describe what the screenshot shows]", caret: 13 }),
  },
  {
    name: "equation",
    label: "/equation",
    detail: "Display maths — LaTeX between $$ fences, real OMML in Word",
    also: ["math", "latex", "formula"],
    build: () => ({ text: "$$\nE = mc^2\n$$", caret: 3 }),
  },
  {
    name: "callout",
    label: "/callout note",
    detail: `A callout box — ${CALLOUT_KINDS.join(" · ")}`,
    also: ["note", "tip", "warning", "important", "banner", "admonition"],
    build: (arg) => {
      const kind = CALLOUT_KINDS.find((k) => arg.toLowerCase().startsWith(k)) ?? "note";
      const text = `:::${kind} Optional title\nYour ${kind} text here.\n:::`;
      return { text, caret: text.indexOf("\n") + 1 };
    },
  },
  {
    name: "citation",
    label: "/citation",
    detail: "A citation call plus its entry — [@key] and [@key]: …",
    also: ["cite", "reference", "bib"],
    build: () => ({
      text: "[@key]\n\n[@key]: Author, *Title of the source*, Publisher, Year.",
      caret: 2,
    }),
  },
  {
    name: "footnote",
    label: "/footnote",
    detail: "A footnote call and its definition",
    also: ["note", "fn"],
    build: () => ({ text: "[^1]\n\n[^1]: Footnote text", caret: 2 }),
  },
  {
    name: "code",
    label: "/code python",
    detail: "A fenced code block — name the language for print-friendly colouring",
    also: ["fence", "codeblock", "snippet"],
    build: (arg) => {
      const lang = (arg.match(/[a-z0-9+#-]+/i)?.[0] ?? "").toLowerCase();
      const text = `\`\`\`${lang}\ncode here\n\`\`\``;
      return { text, caret: text.indexOf("\n") + 1 };
    },
  },
  {
    name: "toc",
    label: "/toc",
    detail: "Table of contents — dotted leaders, real page numbers",
    also: ["contents"],
    build: () => ({ text: "[toc]" }),
  },
  {
    name: "references",
    label: "/references",
    detail: "Where the reference list prints",
    also: ["bibliography"],
    build: () => ({ text: "[references]" }),
  },
  {
    name: "pagebreak",
    label: "/pagebreak",
    detail: "Start the next page here",
    also: ["break", "newpage"],
    build: () => ({ text: "[pagebreak]" }),
  },
  {
    name: "lof",
    label: "/lof",
    detail: "List of figures",
    also: ["figures"],
    build: () => ({ text: "[lof]" }),
  },
  {
    name: "lot",
    label: "/lot",
    detail: "List of tables",
    also: ["tables"],
    build: () => ({ text: "[lot]" }),
  },
  {
    name: "divider",
    label: "/divider",
    detail: "A horizontal rule",
    also: ["hr", "rule", "line"],
    build: () => ({ text: "---" }),
  },
  {
    name: "quote",
    label: "/quote",
    detail: "A block quotation",
    also: ["blockquote"],
    build: () => ({ text: "> Quoted text", caret: 2 }),
  },
];

/** Rank the roster against what has been typed after the slash. Exact name
    first, then prefix, then the alternate words, then anything containing it. */
export function slashOptions(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase().split(/\s+/)[0] ?? "";
  if (!q) return SLASH_COMMANDS;
  const score = (c: SlashCommand): number => {
    if (c.name === q) return 0;
    if (c.name.startsWith(q)) return 1;
    if (c.also?.some((a) => a === q)) return 2;
    if (c.also?.some((a) => a.startsWith(q))) return 3;
    if (c.name.includes(q)) return 4;
    if (c.detail.toLowerCase().includes(q)) return 5;
    return Number.POSITIVE_INFINITY;
  };
  return SLASH_COMMANDS.map((c) => ({ c, s: score(c) }))
    .filter((x) => Number.isFinite(x.s))
    .sort((a, b) => a.s - b.s)
    .map((x) => x.c);
}

/** The typed slash phrase at the caret, if the caret is in one. Only a slash
    that OPENS a line counts (leading whitespace allowed) — mid-sentence, a
    slash is just a slash. */
export function slashAt(state: EditorState, pos: number): { from: number; query: string } | null {
  const line = state.doc.lineAt(pos);
  const before = line.text.slice(0, pos - line.from);
  const m = /^(\s*)\/([A-Za-z0-9 ×x+#-]*)$/.exec(before);
  if (!m) return null;
  return { from: line.from + (m[1]?.length ?? 0), query: m[2] ?? "" };
}

/** The CodeMirror completion source. */
export function slashCompletions(context: CompletionContext): CompletionResult | null {
  const here = slashAt(context.state, context.pos);
  if (!here) return null;
  // Nothing typed yet: only open on a real keystroke, never on a stray refresh.
  if (!context.explicit && here.query === "" && context.pos !== here.from + 1) return null;
  const arg = here.query.replace(/^[A-Za-z]+\s*/, "");
  const options = slashOptions(here.query).map((cmd) => ({
    label: cmd.label,
    detail: cmd.detail,
    type: "keyword",
    apply: (view: EditorView, _completion: unknown, from: number, to: number) => {
      const built = cmd.build(arg);
      view.dispatch({
        changes: { from, to, insert: built.text },
        selection: { anchor: from + (built.caret ?? built.text.length) },
        userEvent: "input.complete",
        scrollIntoView: true,
      });
    },
  }));
  return { from: here.from, to: context.pos, options, filter: false };
}
