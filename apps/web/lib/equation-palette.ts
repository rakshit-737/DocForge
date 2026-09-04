"use client";
/* ============================================================
   equation-palette.ts — the symbols, and where they land (§8.2).

   "Students shouldn't need to know \frac." The palette is a
   searchable list of the symbols and structures a coursework
   equation actually needs, each inserted as correct LaTeX with the
   caret left where the writing continues.

   The insertion rule is the whole trick: LaTeX only means anything
   inside maths, so an insert either lands INSIDE the $…$ the caret
   is already in, or brings its own delimiters with it. Getting that
   wrong is how a symbol picker produces documents full of stray
   backslashes.
   ============================================================ */
import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export interface MathSymbol {
  /** What is inserted; `|` marks where the caret should land. */
  tex: string;
  /** What the reader searches for. */
  label: string;
  /** Extra words that should find it. */
  also?: string[];
  group: string;
}

/* Written out rather than generated: a picker is a curated thing, and the
   order inside each group is the order a writer reaches for them. */
export const SYMBOLS: MathSymbol[] = [
  // ---- structures: what a picker exists for ----
  { tex: "\\frac{|}{}", label: "fraction", also: ["divide", "over", "/"], group: "Structures" },
  { tex: "\\sqrt{|}", label: "square root", also: ["radical"], group: "Structures" },
  { tex: "\\sqrt[3]{|}", label: "nth root", also: ["cube root"], group: "Structures" },
  { tex: "{|}^{}", label: "superscript", also: ["power", "exponent"], group: "Structures" },
  { tex: "{|}_{}", label: "subscript", also: ["index"], group: "Structures" },
  { tex: "\\sum_{i=1}^{n} |", label: "sum", also: ["sigma", "series"], group: "Structures" },
  { tex: "\\prod_{i=1}^{n} |", label: "product", also: ["pi"], group: "Structures" },
  { tex: "\\int_{a}^{b} | \\, dx", label: "integral", also: ["area"], group: "Structures" },
  { tex: "\\oint_{C} | \\, ds", label: "contour integral", group: "Structures" },
  { tex: "\\lim_{x \\to 0} |", label: "limit", also: ["approaches"], group: "Structures" },
  {
    tex: "\\begin{matrix} | & \\\\ & \\end{matrix}",
    label: "matrix",
    also: ["grid", "array"],
    group: "Structures",
  },
  {
    tex: "\\begin{pmatrix} | & \\\\ & \\end{pmatrix}",
    label: "matrix, bracketed",
    also: ["parentheses"],
    group: "Structures",
  },
  {
    tex: "\\begin{cases} | & \\text{if } \\\\ & \\text{otherwise} \\end{cases}",
    label: "cases",
    also: ["piecewise", "if"],
    group: "Structures",
  },
  { tex: "\\binom{n}{k}|", label: "binomial coefficient", also: ["choose"], group: "Structures" },
  { tex: "\\overline{|}", label: "overline", also: ["bar", "mean"], group: "Structures" },
  { tex: "\\vec{|}", label: "vector", also: ["arrow over"], group: "Structures" },
  { tex: "\\hat{|}", label: "hat", also: ["estimate"], group: "Structures" },
  { tex: "\\dot{|}", label: "dot", also: ["derivative", "time"], group: "Structures" },
  { tex: "\\text{|}", label: "words inside maths", also: ["text", "roman"], group: "Structures" },

  // ---- Greek ----
  { tex: "\\alpha", label: "alpha", group: "Greek" },
  { tex: "\\beta", label: "beta", group: "Greek" },
  { tex: "\\gamma", label: "gamma", group: "Greek" },
  { tex: "\\delta", label: "delta", group: "Greek" },
  { tex: "\\Delta", label: "Delta", also: ["change", "difference"], group: "Greek" },
  { tex: "\\epsilon", label: "epsilon", also: ["strain"], group: "Greek" },
  { tex: "\\zeta", label: "zeta", group: "Greek" },
  { tex: "\\eta", label: "eta", also: ["efficiency"], group: "Greek" },
  { tex: "\\theta", label: "theta", also: ["angle"], group: "Greek" },
  { tex: "\\kappa", label: "kappa", group: "Greek" },
  { tex: "\\lambda", label: "lambda", also: ["wavelength"], group: "Greek" },
  { tex: "\\mu", label: "mu", also: ["micro", "mean", "friction"], group: "Greek" },
  { tex: "\\nu", label: "nu", also: ["frequency"], group: "Greek" },
  { tex: "\\xi", label: "xi", group: "Greek" },
  { tex: "\\pi", label: "pi", group: "Greek" },
  { tex: "\\rho", label: "rho", also: ["density"], group: "Greek" },
  { tex: "\\sigma", label: "sigma", also: ["stress", "standard deviation"], group: "Greek" },
  { tex: "\\Sigma", label: "Sigma", group: "Greek" },
  { tex: "\\tau", label: "tau", also: ["shear", "torque"], group: "Greek" },
  { tex: "\\phi", label: "phi", group: "Greek" },
  { tex: "\\Phi", label: "Phi", also: ["flux"], group: "Greek" },
  { tex: "\\chi", label: "chi", group: "Greek" },
  { tex: "\\psi", label: "psi", group: "Greek" },
  { tex: "\\omega", label: "omega", also: ["angular frequency"], group: "Greek" },
  { tex: "\\Omega", label: "Omega", also: ["ohm"], group: "Greek" },

  // ---- relations ----
  { tex: "\\leq", label: "less than or equal", also: ["<="], group: "Relations" },
  { tex: "\\geq", label: "greater than or equal", also: [">="], group: "Relations" },
  { tex: "\\neq", label: "not equal", also: ["!="], group: "Relations" },
  { tex: "\\approx", label: "approximately", also: ["about", "~"], group: "Relations" },
  { tex: "\\equiv", label: "identical to", also: ["equivalent"], group: "Relations" },
  { tex: "\\propto", label: "proportional to", group: "Relations" },
  { tex: "\\sim", label: "similar to", group: "Relations" },
  { tex: "\\ll", label: "much less than", group: "Relations" },
  { tex: "\\gg", label: "much greater than", group: "Relations" },

  // ---- operators ----
  { tex: "\\times", label: "times", also: ["multiply", "cross"], group: "Operators" },
  { tex: "\\cdot", label: "dot product", also: ["multiply"], group: "Operators" },
  { tex: "\\div", label: "divide", group: "Operators" },
  { tex: "\\pm", label: "plus or minus", also: ["+-", "tolerance"], group: "Operators" },
  { tex: "\\mp", label: "minus or plus", group: "Operators" },
  { tex: "\\nabla", label: "nabla", also: ["del", "gradient"], group: "Operators" },
  { tex: "\\partial", label: "partial derivative", also: ["d"], group: "Operators" },
  { tex: "\\infty", label: "infinity", group: "Operators" },
  { tex: "\\degree", label: "degree", also: ["temperature", "angle"], group: "Operators" },
  { tex: "\\%", label: "percent", group: "Operators" },

  // ---- arrows ----
  { tex: "\\to", label: "arrow right", also: ["gives", "yields"], group: "Arrows" },
  { tex: "\\Rightarrow", label: "implies", also: ["therefore"], group: "Arrows" },
  { tex: "\\Leftrightarrow", label: "if and only if", also: ["iff"], group: "Arrows" },
  { tex: "\\leftarrow", label: "arrow left", group: "Arrows" },
  { tex: "\\uparrow", label: "arrow up", also: ["increase"], group: "Arrows" },
  { tex: "\\downarrow", label: "arrow down", also: ["decrease"], group: "Arrows" },
  { tex: "\\rightleftharpoons", label: "equilibrium", also: ["reaction"], group: "Arrows" },

  // ---- sets and logic ----
  { tex: "\\in", label: "element of", also: ["belongs"], group: "Sets & logic" },
  { tex: "\\notin", label: "not an element of", group: "Sets & logic" },
  { tex: "\\subset", label: "subset of", group: "Sets & logic" },
  { tex: "\\cup", label: "union", group: "Sets & logic" },
  { tex: "\\cap", label: "intersection", group: "Sets & logic" },
  { tex: "\\emptyset", label: "empty set", group: "Sets & logic" },
  { tex: "\\forall", label: "for all", group: "Sets & logic" },
  { tex: "\\exists", label: "there exists", group: "Sets & logic" },
  { tex: "\\therefore", label: "therefore", group: "Sets & logic" },
  { tex: "\\mathbb{R}", label: "real numbers", also: ["R"], group: "Sets & logic" },
  { tex: "\\mathbb{N}", label: "natural numbers", also: ["N"], group: "Sets & logic" },
  { tex: "\\mathbb{Z}", label: "integers", also: ["Z"], group: "Sets & logic" },
];

export const SYMBOL_GROUPS: string[] = [...new Set(SYMBOLS.map((s) => s.group))];

/** Rank the roster against what has been typed. Exact label first, then a
    label prefix, then the alternate words, then anything containing it. */
export function searchSymbols(query: string): MathSymbol[] {
  const q = query.trim().toLowerCase();
  if (!q) return SYMBOLS;
  const score = (s: MathSymbol): number => {
    const label = s.label.toLowerCase();
    if (label === q) return 0;
    if (label.startsWith(q)) return 1;
    if (s.also?.some((a) => a.toLowerCase() === q)) return 2;
    if (s.also?.some((a) => a.toLowerCase().startsWith(q))) return 3;
    if (label.includes(q)) return 4;
    if (s.tex.toLowerCase().includes(q)) return 5;
    if (s.also?.some((a) => a.toLowerCase().includes(q))) return 6;
    return Number.POSITIVE_INFINITY;
  };
  return SYMBOLS.map((s) => ({ s, n: score(s) }))
    .filter((x) => Number.isFinite(x.n))
    .sort((a, b) => a.n - b.n)
    .map((x) => x.s);
}

/** Is the offset inside maths? Counts unescaped `$` before it: display `$$`
    counts as one opening either way, so an odd count means "inside". */
export function insideMath(source: string, pos: number): boolean {
  const before = source.slice(0, pos);
  const dollars = before.replace(/\\\$/g, "").match(/\$\$|\$/g) ?? [];
  let open = false;
  for (const d of dollars) open = d === "$$" ? !open : !open;
  return open;
}

export interface Insertion {
  /** The text to put in, delimiters included when they are needed. */
  text: string;
  /** Where the caret goes, as an offset into `text`. */
  caret: number;
}

/** What to insert for `tex` at `pos`: bare inside maths, wrapped in `$…$`
    outside it. The `|` marker in a symbol's tex says where the caret lands;
    without one the caret follows the whole insertion. */
export function insertionFor(tex: string, source: string, pos: number): Insertion {
  const marker = tex.indexOf("|");
  const body = marker >= 0 ? tex.slice(0, marker) + tex.slice(marker + 1) : tex;
  const caretInBody = marker >= 0 ? marker : body.length;
  if (insideMath(source, pos)) return { text: body, caret: caretInBody };
  /* Outside maths the symbol brings its own delimiters, and a space is left
     after so the writer can carry on without fighting the closing $. */
  return { text: `$${body}$`, caret: caretInBody + 1 };
}

/** Insert into the editor in ONE transaction, so it is one undo step. */
export function insertSymbol(view: EditorView, tex: string): void {
  const { state } = view;
  const range = state.selection.main;
  const source = state.doc.toString();
  const { text, caret } = insertionFor(tex, source, range.from);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: EditorSelection.cursor(range.from + caret),
    userEvent: "input.complete",
    scrollIntoView: true,
  });
  view.focus();
}
