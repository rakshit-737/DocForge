/// <reference path="./ambient.d.ts" />
/* ============================================================
   @docforge/mathml-omml — MathML → OMML (Office Math)
   ============================================================

   Turns the MathML that KaTeX emits into the Office Math markup Word stores
   inside a .docx, so an exported equation is a real, editable Word equation
   rather than a picture of one.

   Self-contained: its own tolerant XML reader, no DOM, no dependencies.
   This is the Phase-1 mechanical TypeScript port of src/js/mathml-omml.js —
   every regex, table, string and branch is preserved 1:1; types are added
   around the unchanged logic. The single-file shell keeps its `MathmlOmml`
   global via ./global.ts.

     mmlToOmml(mathml)     -> "<m:oMath …>…</m:oMath>" | null
     texToOmml(tex, disp)  -> the same, via the global `katex` | null
     oMathPara(omml, jc)   -> display wrapper for a whole paragraph

   Both converters return null rather than guess when they cannot make sense
   of the input, so the caller can fall back to printing the source: a
   silently wrong equation is worse than no equation.

   MIT licensed, like the rest of DocForge. Written against the OMML shapes
   in ECMA-376 part 1 §22.1 and against what KaTeX 0.18 actually emits.
   ============================================================ */

/* ---------- types (added by the port; runtime shapes are unchanged) ---------- */

/* One node of the tolerant XML reader's tree: "#doc", "#text", an element,
   or the synthetic "#fenced" node the fence pairer builds. */
interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  kids: XmlNode[];
  /** "#text" nodes only. */
  text?: string;
  /** "#fenced" nodes only. */
  open?: string;
  close?: string;
  sep?: string;
}

/* Inherited mathvariant, threaded through emission. */
interface Ctx {
  mv: string;
}

/* Atoms are either finished OMML ({x}) or a pending run ({p: rPr, t: text}). */
type Atom = { x: string; p?: undefined; t?: undefined } | { x?: undefined; p: string; t: string };

/* A recognised n-ary operator (∑ ∏ ∫ …) with its limits. */
interface Nary {
  chr: string;
  sub: XmlNode | null | undefined;
  sup: XmlNode | null | undefined;
  loc: string;
}
const M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";

/* ---------- XML text ---------- */
const esc = (s: string | null | undefined): string =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const escA = (s: string | null | undefined): string => esc(s).replace(/"/g, "&quot;");

/* Characters XML 1.0 will not carry, plus MathML's invisible operators.
   U+2061 FUNCTION APPLICATION and its neighbours are pure layout hints; let
   one through and Word shows a missing-glyph box in the middle of "sin x". */
const STRIP = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u200b-\u200f\u2061-\u2064\ufeff]/g;
const clean = (s: string | null | undefined): string =>
  String(s == null ? "" : s).replace(STRIP, "");

/* ---------- a small tolerant XML reader ----------
   MathML is XML, but people paste it by hand, so this accepts stray HTML-isms
   (unquoted attributes, unclosed tags) instead of throwing. */
const ENT: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  ensp: "\u2002",
  emsp: "\u2003",
  thinsp: "\u2009",
  middot: "·",
  times: "×",
  divide: "÷",
  minus: "−",
  plusmn: "±",
  deg: "°",
  prime: "′",
  Prime: "″",
  hellip: "…",
  infin: "∞",
  radic: "√",
  sum: "∑",
  prod: "∏",
  int: "∫",
  part: "∂",
  nabla: "∇",
  isin: "∈",
  notin: "∉",
  forall: "∀",
  exist: "∃",
  empty: "∅",
  cap: "∩",
  cup: "∪",
  sub: "⊂",
  sube: "⊆",
  ne: "≠",
  le: "≤",
  ge: "≥",
  asymp: "≈",
  equiv: "≡",
  larr: "←",
  rarr: "→",
  harr: "↔",
  lArr: "⇐",
  rArr: "⇒",
  hArr: "⇔",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
};

function dec(s: string): string {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, g: string) => {
    if (g.charAt(0) === "#") {
      const hex = g.charAt(1) === "x" || g.charAt(1) === "X";
      const cp = parseInt(hex ? g.slice(2) : g.slice(1), hex ? 16 : 10);
      if (!isFinite(cp) || cp < 0 || cp > 0x10ffff) return m;
      try {
        return String.fromCodePoint(cp);
      } catch (e) {
        return m;
      }
    }
    return Object.hasOwn(ENT, g) ? (ENT[g] as string) : m;
  });
}

const local = (n: string): string => {
  const i = n.indexOf(":");
  return i < 0 ? n : n.slice(i + 1);
};
/* MathML elements that never have content; tolerated without a closing slash. */
const EMPTY_EL: Record<string, 1> = { mspace: 1, mprescripts: 1, none: 1, mglyph: 1, mline: 1 };

function parseXml(src: string): XmlNode {
  const doc: XmlNode = { name: "#doc", attrs: {}, kids: [] };
  const stack: XmlNode[] = [doc];
  const top = () => stack[stack.length - 1]!;
  const text = (t: string) => {
    if (t) top().kids.push({ name: "#text", attrs: {}, kids: [], text: t });
  };
  const n = src.length;
  let i = 0;

  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt < 0) {
      text(dec(src.slice(i)));
      break;
    }
    if (lt > i) text(dec(src.slice(i, lt)));

    if (src.startsWith("<!--", lt)) {
      const e = src.indexOf("-->", lt);
      i = e < 0 ? n : e + 3;
      continue;
    }
    if (src.startsWith("<![CDATA[", lt)) {
      const e = src.indexOf("]]>", lt);
      text(src.slice(lt + 9, e < 0 ? n : e));
      i = e < 0 ? n : e + 3;
      continue;
    }
    if (src.startsWith("<?", lt)) {
      const e = src.indexOf("?>", lt);
      i = e < 0 ? n : e + 2;
      continue;
    }
    if (src.startsWith("<!", lt)) {
      const e = src.indexOf(">", lt);
      i = e < 0 ? n : e + 1;
      continue;
    }

    /* Find the tag's ">", stepping over quoted attribute values. */
    let j = lt + 1,
      q = "";
    while (j < n) {
      const c = src.charAt(j);
      if (q) {
        if (c === q) q = "";
      } else if (c === '"' || c === "'") q = c;
      else if (c === ">") break;
      j++;
    }
    const raw = src.slice(lt + 1, j);
    i = j + 1;
    if (!raw) continue;

    if (raw.charAt(0) === "/") {
      // closing tag
      const nm = local(raw.slice(1).trim());
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k]!.name === nm) {
          stack.length = k;
          break;
        }
      }
      continue;
    }

    const selfClose = raw.charAt(raw.length - 1) === "/";
    const body = selfClose ? raw.slice(0, -1) : raw;
    const head = /^([^\s/>]+)([\s\S]*)$/.exec(body);
    if (!head) continue;
    const el: XmlNode = { name: local(head[1]!), attrs: {}, kids: [] };
    const ar = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    let a: RegExpExecArray | null;
    while ((a = ar.exec(head[2]!))) {
      const v = a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : a[5]!;
      el.attrs[local(a[1]!)] = dec(v);
    }
    top().kids.push(el);
    if (!selfClose && !EMPTY_EL[el.name]) stack.push(el);
  }
  return doc;
}

/* ---------- tree helpers ---------- */
const TRANSPARENT: Record<string, 1> = {
  // pure grouping / styling, no OMML of its own
  mrow: 1,
  mstyle: 1,
  mpadded: 1,
  merror: 1,
  semantics: 1,
  math: 1,
  mtd: 1,
  mstack: 1,
  msrow: 1,
  mscarries: 1,
  mscarry: 1,
  msline: 1,
  mlongdiv: 1,
};
/* Landmine #3: KaTeX stores the original TeX in <annotation>; it must never
   reach the OMML or the reader sees "\frac{a}{b}" printed inside the equation. */
const DROP: Record<string, 1> = {
  annotation: 1,
  "annotation-xml": 1,
  maligngroup: 1,
  malignmark: 1,
};
const TOKEN: Record<string, 1> = { mi: 1, mn: 1, mo: 1, mtext: 1, ms: 1 };

const isEl = (nd: XmlNode | null | undefined): nd is XmlNode => !!nd && nd.name !== "#text";
function textOf(nd: XmlNode | null | undefined): string {
  if (!nd) return "";
  if (nd.name === "#text") return nd.text || "";
  let s = "";
  for (let i = 0; i < nd.kids.length; i++) s += textOf(nd.kids[i]);
  return s;
}
/* A token is a leaf only when it holds text. KaTeX nests real markup inside
   <mo> for \overset and inside <mi> for \underset{n}{\max}. */
const hasEl = (nd: XmlNode): boolean => nd.kids.some(isEl);

/* Children that carry meaning: elements minus the discarded ones, plus text.
   Whitespace between elements is layout noise in MathML and is dropped. */
function kidsOf(nd: XmlNode): XmlNode[] {
  const out: XmlNode[] = [];
  for (let i = 0; i < nd.kids.length; i++) {
    const k = nd.kids[i]!;
    if (k.name === "#text") {
      if (/\S/.test(k.text as string)) out.push(k);
      continue;
    }
    if (DROP[k.name]) continue;
    out.push(k);
  }
  return out;
}

/* Peel grouping wrappers off a single-child subtree — the base of a script is
   usually <mrow><mo>∑</mo></mrow> and we need to see the ∑. */
function unwrap(nd: XmlNode | null | undefined): XmlNode | null | undefined {
  let cur = nd,
    guard = 0;
  while (cur && isEl(cur) && TRANSPARENT[cur.name] && guard++ < 32) {
    const k = kidsOf(cur);
    if (k.length !== 1) break;
    cur = k[0];
  }
  return cur;
}
const asList = (x: XmlNode | XmlNode[] | null | undefined): XmlNode[] =>
  x == null ? [] : Array.isArray(x) ? x : [x];

/* ---------- character tables ---------- */
/* Large operators that become <m:nary>. The small set glyphs (∩ ∪ ∧ ∨) are
   deliberately absent — only their big display forms are n-ary. */
const NARY = "∑∏∐∫∬∭∮∯∰∱∲∳" + "⋀⋁⋂⋃⨀⨁⨂⨃⨄⨅⨆⨉";

/* Where an n-ary operand stops. Relations and additive operators end a term,
   which is what keeps the "= …" of ∫₀^∞ f dt = 1/λ outside the <m:e>. */
const STOP = "=≠<>≤≥≈≡≅∼≃≪≫" + "→⇒⇔⟹⟺∈∉⊂⊆⊃⊇" + "∝⊢⊨+−-±∓,;";

const OPEN = "([{⟨⌈⌊⟦〈《「『【〔";
const CLOSE = ")]}⟩⌉⌋⟧〉》」』】〕";
const AMBIG = "|∣∥‖ǀǁ/\\↑↓⇑⇓↕⇕";
/* Word wants the plain pipe forms in m:begChr / m:endChr. */
const FENCE_FIX: Record<string, string> = { "∣": "|", "∥": "‖", ǀ: "|", ǁ: "‖" };

/* KaTeX writes accents as spacing modifier letters; Word wants the combining
   form, which is what its own accent gallery inserts. */
const ACC: Record<string, string> = {
  "^": "\u0302",
  ˆ: "\u0302",
  "\u0302": "\u0302", // hat
  "¯": "\u0304",
  ˉ: "\u0304",
  "\u0304": "\u0304", // bar / macron
  "~": "\u0303",
  "˜": "\u0303",
  "\u0303": "\u0303", // tilde
  "˙": "\u0307",
  "\u0307": "\u0307", // dot
  "¨": "\u0308",
  "\u0308": "\u0308", // ddot
  "\u20db": "\u20db",
  "\u20dc": "\u20dc", // dddot / ddddot
  ˇ: "\u030c",
  "\u030c": "\u030c", // check
  "˘": "\u0306",
  "\u0306": "\u0306", // breve
  "˚": "\u030a",
  "\u030a": "\u030a", // ring
  "´": "\u0301",
  ˊ: "\u0301",
  "\u0301": "\u0301", // acute
  "`": "\u0300",
  ˋ: "\u0300",
  "\u0300": "\u0300", // grave
  "˝": "\u030b",
  "\u0311": "\u0311",
  "\u20d7": "\u20d7",
  "→": "\u20d7", // vec
  "\u20d6": "\u20d6",
  "←": "\u20d6",
  "↔": "\u20e1",
  "\u20e1": "\u20e1",
};
const BAR_TOP = "‾¯\u0305―—";
const BAR_BOT = "_▁\u0332";
const GROUP_TOP: Record<string, 1> = { "⏞": 1, "⎴": 1, "⏜": 1, "︷": 1, "{": 1, "⎰": 1 };
const GROUP_BOT: Record<string, 1> = { "⏟": 1, "⎵": 1, "⏝": 1, "︸": 1, "}": 1, "⎱": 1 };

/* Landmine #2: <m:sty> takes ST_Style and nothing else — "p", "b", "i", "bi".
   Any other value and Word discards the whole run's math properties. */
const VARIANT: Record<string, [string, string]> = {
  normal: ["", "p"],
  bold: ["", "b"],
  italic: ["", ""],
  "bold-italic": ["", "bi"],
  "double-struck": ["double-struck", "p"],
  script: ["script", "p"],
  "bold-script": ["script", "b"],
  fraktur: ["fraktur", "p"],
  "bold-fraktur": ["fraktur", "b"],
  "sans-serif": ["sans-serif", "p"],
  "bold-sans-serif": ["sans-serif", "b"],
  "sans-serif-italic": ["sans-serif", ""],
  "sans-serif-bold-italic": ["sans-serif", "bi"],
  monospace: ["monospace", "p"],
  initial: ["", "p"],
  tailed: ["", "p"],
  looped: ["", "p"],
  stretched: ["", "p"],
};

/* ---------- run emission ----------
   Atoms are either finished OMML ({x}) or a pending run ({p: rPr, t: text}).
   Adjacent runs with identical properties merge, so Word shows "sin" as one
   run rather than three — which is what a human editing it afterwards wants. */
function mt(s: string): string {
  const pad = /^\s|\s$/.test(s);
  return "<m:t" + (pad ? ' xml:space="preserve"' : "") + ">" + esc(s) + "</m:t>";
}
function render(atoms: Atom[]): string {
  let out = "",
    pend: string | null = null,
    ppr = "";
  const flush = () => {
    if (pend === null) return;
    /* Word throws away a math run that holds nothing but whitespace — no
       matter which space glyph — so \quad and \, would silently vanish. A
       zero-width word joiner makes the run "real" without printing anything. */
    if (pend) out += "<m:r>" + ppr + mt(/\S/.test(pend) ? pend : pend + "\u2060") + "</m:r>";
    pend = null;
  };
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i]!;
    if (a.x !== undefined) {
      flush();
      out += a.x;
    } else if (pend !== null && ppr === a.p) pend += a.t;
    else {
      flush();
      pend = a.t;
      ppr = a.p;
    }
  }
  flush();
  return out;
}
function rpr(scr: string, sty: string): string {
  if (!scr && !sty) return "";
  return (
    "<m:rPr>" +
    (scr ? '<m:scr m:val="' + scr + '"/>' : "") +
    (sty ? '<m:sty m:val="' + sty + '"/>' : "") +
    "</m:rPr>"
  );
}
/* <mspace width="…em"> mapped onto the fixed-width space glyphs, which is how
   Word's own equation editor spells \quad, \thinsp and the rest. */
function spaceChars(em: number): string {
  if (!(em > 0.02)) return ""; // \! and friends are negative
  if (em >= 1.75) return "\u2003\u2003";
  if (em >= 0.85) return "\u2003"; // em space
  if (em >= 0.4) return "\u2002"; // en space
  if (em >= 0.25) return "\u2004"; // three-per-em (\;)
  if (em >= 0.19) return "\u205f"; // medium mathematical space
  if (em >= 0.1) return "\u2009"; // thin space (\,)
  return "\u200a"; // hair space
}

/* One "letter" for the italic rule: code points, ignoring combining marks. */
function glyphCount(s: string): number {
  const bare = s.replace(/[\u0300-\u036f\u20d0-\u20f0\ufe00-\ufe0f]/g, "");
  let n = 0;
  for (let i = 0; i < bare.length; i++) {
    const c = bare.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00) i++;
    n++;
  }
  return n;
}
/* Landmine #1: a multi-letter <mi> is upright per the MathML spec — sin, cos,
   lim, log, det, max. A single-letter <mi> is the italic variable Word already
   defaults to, so it needs no run properties at all. */
function runProps(name: string, txt: string, mv: string): string {
  const v = mv && VARIANT[mv];
  if (v) return rpr(v[0], v[1]);
  if (name === "mi") return glyphCount(txt) > 1 ? rpr("", "p") : "";
  return rpr("", "p");
}

/* ---------- OMML building blocks ---------- */
const val = (tag: string, v: string): string => "<m:" + tag + ' m:val="' + escA(v) + '"/>';

function slot(
  tag: string,
  nodes: XmlNode | XmlNode[] | null | undefined,
  ctx: Ctx,
  bareWhenEmpty?: boolean,
): string {
  const inner = emitList(asList(nodes), ctx);
  if (inner) return "<" + tag + ">" + inner + "</" + tag + ">";
  return bareWhenEmpty ? "<" + tag + "/>" : "<" + tag + "><m:r><m:t/></m:r></" + tag + ">";
}

/* ---------- fences ----------
   \left…\right arrives as <mo fence="true">; pair them up so each pair can be
   emitted as one <m:d>. Bars are ambiguous — they open and close with the same
   glyph — so they match against themselves at the same nesting depth. */
function fenceChar(nd: XmlNode | undefined): string {
  if (!isEl(nd) || nd.name !== "mo" || nd.attrs.fence !== "true") return "";
  return clean(textOf(nd)).trim();
}
const fenced = (open: string, close: string, kids: XmlNode[], sep?: string): XmlNode => ({
  name: "#fenced",
  attrs: {},
  kids: kids,
  open: open,
  close: close,
  sep: sep,
});

function fenceGroup(list: XmlNode[]): XmlNode[] {
  const out: XmlNode[] = [];
  for (let i = 0; i < list.length; i++) {
    const f = fenceChar(list[i]);
    if (!f) {
      out.push(list[i]!);
      continue;
    }

    let mate = -1;
    if (CLOSE.indexOf(f) < 0) {
      let depth = 0;
      for (let k = i + 1; k < list.length; k++) {
        const g = fenceChar(list[k]);
        if (!g) continue;
        if (AMBIG.indexOf(g) >= 0) {
          if (depth === 0 && g === f) {
            mate = k;
            break;
          }
          continue;
        }
        if (OPEN.indexOf(g) >= 0) {
          depth++;
          continue;
        }
        if (depth === 0) {
          mate = k;
          break;
        }
        depth--;
      }
    }
    if (mate >= 0) {
      out.push(fenced(f, fenceChar(list[mate]), list.slice(i + 1, mate)));
      i = mate;
    } else if (out.length && (CLOSE.indexOf(f) >= 0 || AMBIG.indexOf(f) >= 0)) {
      /* \left.\frac{dy}{dx}\right| — a closer with no opener takes what precedes it. */
      out.push(fenced("", f, out.splice(0)));
    } else if (i < list.length - 1) {
      /* \left\{ … with no \right — which is exactly how KaTeX renders `cases`. */
      out.push(fenced(f, "", list.slice(i + 1)));
      i = list.length;
    } else {
      out.push(list[i]!); // lone glyph, keep it as text
    }
  }
  return out;
}

/* ---------- n-ary ---------- */
function naryOf(nd: XmlNode | undefined): Nary | null {
  if (!isEl(nd)) return null;
  const k = kidsOf(nd);
  let base: XmlNode | null | undefined = null,
    sub: XmlNode | null | undefined = null,
    sup: XmlNode | null | undefined = null,
    loc = "";
  switch (nd.name) {
    case "munderover":
      base = k[0];
      sub = k[1];
      sup = k[2];
      loc = "undOvr";
      break;
    case "munder":
      base = k[0];
      sub = k[1];
      loc = "undOvr";
      break;
    case "mover":
      base = k[0];
      sup = k[1];
      loc = "undOvr";
      break;
    case "msubsup":
      base = k[0];
      sub = k[1];
      sup = k[2];
      loc = "subSup";
      break;
    case "msub":
      base = k[0];
      sub = k[1];
      loc = "subSup";
      break;
    case "msup":
      base = k[0];
      sup = k[1];
      loc = "subSup";
      break;
    case "mo":
      base = nd;
      loc = "subSup";
      break;
    default:
      return null;
  }
  const b = unwrap(base);
  if (!b || !isEl(b) || b.name !== "mo" || hasEl(b)) return null;
  const ch = clean(textOf(b)).trim();
  if (ch.length !== 1 || NARY.indexOf(ch) < 0) return null;
  return { chr: ch, sub: sub, sup: sup, loc: loc };
}

/* ---------- function application ----------
   KaTeX marks \sin, \log, \lim … with U+2061 FUNCTION APPLICATION. That is
   precisely the signal for <m:func>, which is what puts the thin space into
   "sin x" and "log det(M)" — without it Word sets them solid. */
const SCRIPTY: Record<string, 1> = {
  msub: 1,
  msup: 1,
  msubsup: 1,
  munder: 1,
  mover: 1,
  munderover: 1,
};
const isApply = (nd: XmlNode | undefined): boolean =>
  isEl(nd) && nd.name === "mo" && !hasEl(nd) && textOf(nd).replace(/\s/g, "") === "\u2061";

/* True when the marker sits at the end of this node's name part: directly for
   <mi>lim</mi><mo>\u2061</mo> inside an mrow, or under the base of \lim_{x\to0}
   and \sin^2\theta, where the scripts hang off the function name. */
function isFuncName(nd: XmlNode | undefined): boolean {
  if (!isEl(nd)) return false;
  if (TOKEN[nd.name] && !hasEl(nd)) return isApply(nd);
  const k = kidsOf(nd);
  if (!k.length) return false;
  if (SCRIPTY[nd.name]) return isFuncName(k[0]);
  if (TRANSPARENT[nd.name] || TOKEN[nd.name]) return isFuncName(k[k.length - 1]);
  return false;
}
/* Where the argument starts, or -1 when this is not a function head. */
function funcArgAt(items: XmlNode[], i: number): number {
  if (!isEl(items[i]) || isApply(items[i])) return -1;
  if (i + 1 < items.length && isApply(items[i + 1])) return i + 2;
  return isFuncName(items[i]) ? i + 1 : -1;
}

/* Does this sibling end the n-ary's operand? */
function isStop(nd: XmlNode | undefined): boolean {
  if (!isEl(nd)) return false;
  if (naryOf(nd)) return true;
  const u = unwrap(nd);
  if (!u || !isEl(u) || u.name !== "mo" || hasEl(u)) return false;
  const t = clean(textOf(u)).trim();
  return t.length === 1 && STOP.indexOf(t) >= 0;
}

/* ---------- the converter ---------- */
function emitList(nodes: XmlNode[], ctx: Ctx): string {
  return render(atomsOf(nodes, ctx));
}

function atomsOf(nodes: XmlNode[], ctx: Ctx): Atom[] {
  const items = fenceGroup(nodes.filter((nd) => !(isEl(nd) && DROP[nd.name])));
  const out: Atom[] = [];
  for (let i = 0; i < items.length; i++) {
    const nary = naryOf(items[i]);
    if (nary) {
      /* The structural fix: the integrand/summand belongs INSIDE <m:e>, not
         beside the n-ary as a sibling, or editing the limits in Word is odd. */
      const operand: XmlNode[] = [];
      let j = i + 1;
      while (j < items.length && !isStop(items[j])) operand.push(items[j++]!);
      out.push({ x: emitNary(nary, operand, ctx) });
      i = j - 1;
      continue;
    }
    const at = funcArgAt(items, i);
    if (at >= 0) {
      const arg: XmlNode[] = [];
      let j = at;
      while (j < items.length && !isStop(items[j])) arg.push(items[j++]!);
      const nm = arg.length ? emitList([items[i]!], ctx) : "";
      if (nm) {
        // a name with no argument is just a word
        out.push({
          x: "<m:func><m:fName>" + nm + "</m:fName>" + slot("m:e", arg, ctx) + "</m:func>",
        });
        i = j - 1;
        continue;
      }
    }
    emitNode(items[i]!, ctx, out);
  }
  return out;
}

function emitNary(n: Nary, operand: XmlNode[], ctx: Ctx): string {
  const pr =
    "<m:naryPr>" +
    val("chr", n.chr) +
    val("limLoc", n.loc) +
    val("subHide", n.sub ? "0" : "1") +
    val("supHide", n.sup ? "0" : "1") +
    "</m:naryPr>";
  return (
    "<m:nary>" +
    pr +
    slot("m:sub", n.sub, ctx, !n.sub) +
    slot("m:sup", n.sup, ctx, !n.sup) +
    slot("m:e", operand, ctx, false) +
    "</m:nary>"
  );
}

function emitNode(nd: XmlNode, ctx: Ctx, out: Atom[]): void {
  if (nd.name === "#text") {
    const t = clean(nd.text);
    if (t) out.push({ p: rpr("", "p"), t: t });
    return;
  }
  if (nd.name === "#fenced") {
    out.push({ x: emitFenced(nd, ctx) });
    return;
  }

  const k = kidsOf(nd);
  const mv = nd.attrs.mathvariant || ctx.mv || "";

  if (TOKEN[nd.name] && !hasEl(nd)) {
    let t = clean(textOf(nd));
    if (nd.name === "ms") t = (nd.attrs.lquote || '"') + t + (nd.attrs.rquote || '"');
    /* KaTeX writes \, and \; as an <mtext> of plain spaces — about 1/6 em each. */
    if (t && !/\S/.test(t)) t = spaceChars(t.length / 6);
    if (!t) return;
    out.push({ p: runProps(nd.name, t, mv), t: t });
    return;
  }
  if (TRANSPARENT[nd.name] || (TOKEN[nd.name] && hasEl(nd))) {
    const sub = nd.attrs.mathvariant ? { mv: nd.attrs.mathvariant } : ctx;
    const inner = atomsOf(k, sub);
    for (let i = 0; i < inner.length; i++) out.push(inner[i]!);
    return;
  }

  switch (nd.name) {
    case "mspace": {
      /* A bare \\ arrives as <mspace linebreak="newline">. Word's renderer
         ignores <m:brk> in every placement (checked against Word itself), so
         rather than emit dead markup we leave a wide gap, which at least keeps
         the two sides apart. Real multi-line maths comes from \begin{aligned}. */
      const t =
        nd.attrs.linebreak === "newline"
          ? spaceChars(2)
          : spaceChars(parseFloat(nd.attrs.width!) || 0);
      if (t) out.push({ p: rpr("", "p"), t: t });
      return;
    }
    case "mfrac": {
      const lt = String(nd.attrs.linethickness || "").trim();
      const noBar = lt !== "" && parseFloat(lt) === 0;
      const type = noBar ? "noBar" : nd.attrs.bevelled === "true" ? "skw" : "";
      out.push({
        x:
          "<m:f>" +
          (type ? "<m:fPr>" + val("type", type) + "</m:fPr>" : "") +
          slot("m:num", k[0], ctx) +
          slot("m:den", k[1], ctx) +
          "</m:f>",
      });
      return;
    }
    case "msqrt":
      out.push({
        x:
          "<m:rad><m:radPr>" +
          val("degHide", "1") +
          "</m:radPr><m:deg/>" +
          slot("m:e", k, ctx) +
          "</m:rad>",
      });
      return;
    case "mroot":
      out.push({
        x:
          "<m:rad><m:radPr>" +
          val("degHide", "0") +
          "</m:radPr>" +
          slot("m:deg", k[1], ctx) +
          slot("m:e", k[0], ctx) +
          "</m:rad>",
      });
      return;
    case "msup":
      out.push({ x: "<m:sSup>" + slot("m:e", k[0], ctx) + slot("m:sup", k[1], ctx) + "</m:sSup>" });
      return;
    case "msub":
      out.push({ x: "<m:sSub>" + slot("m:e", k[0], ctx) + slot("m:sub", k[1], ctx) + "</m:sSub>" });
      return;
    case "msubsup":
      out.push({
        x:
          "<m:sSubSup>" +
          slot("m:e", k[0], ctx) +
          slot("m:sub", k[1], ctx) +
          slot("m:sup", k[2], ctx) +
          "</m:sSubSup>",
      });
      return;
    case "mmultiscripts":
      out.push({ x: emitMulti(k, ctx) });
      return;
    case "mover":
      out.push({ x: emitOver(nd, k, ctx) });
      return;
    case "munder":
      out.push({ x: emitUnder(nd, k, ctx) });
      return;
    case "munderover":
      /* Not an n-ary (that was handled above), so it is a two-sided limit. */
      out.push({
        x:
          "<m:limLow><m:e><m:limUpp>" +
          slot("m:e", k[0], ctx) +
          slot("m:lim", k[2], ctx) +
          "</m:limUpp></m:e>" +
          slot("m:lim", k[1], ctx) +
          "</m:limLow>",
      });
      return;
    case "mfenced": {
      const o = nd.attrs.open === undefined ? "(" : nd.attrs.open;
      const c = nd.attrs.close === undefined ? ")" : nd.attrs.close;
      const s = nd.attrs.separators === undefined ? "," : nd.attrs.separators;
      out.push({ x: emitFenced(fenced(o, c, k, s.charAt(0) || ""), ctx) });
      return;
    }
    case "mtable":
      out.push({ x: emitTable(nd, k, ctx) });
      return;
    case "menclose":
      out.push({ x: emitEnclose(nd, k, ctx) });
      return;
    case "mphantom":
      out.push({
        x:
          "<m:phant><m:phantPr>" +
          val("show", "0") +
          "</m:phantPr>" +
          slot("m:e", k, ctx) +
          "</m:phant>",
      });
      return;
    case "none":
      return;
    default: {
      /* Something we do not model — keep its content rather than lose the maths. */
      const inner = atomsOf(k, ctx);
      for (let i = 0; i < inner.length; i++) out.push(inner[i]!);
    }
  }
}

function emitFenced(nd: XmlNode, ctx: Ctx): string {
  const fix = (c: string) => FENCE_FIX[c] || c;
  const many = nd.sep !== undefined && nd.kids.length > 1;
  const pr =
    "<m:dPr>" +
    val("begChr", fix(nd.open!)) +
    (nd.sep !== undefined ? val("sepChr", nd.sep) : "") +
    val("endChr", fix(nd.close!)) +
    "</m:dPr>";
  let body = "";
  if (many) for (let i = 0; i < nd.kids.length; i++) body += slot("m:e", nd.kids[i], ctx);
  else body = slot("m:e", nd.kids, ctx);
  return "<m:d>" + pr + body + "</m:d>";
}

/* mover is one of four things: an accent, an overbar, a brace, or a real
   upper limit (\xrightarrow{f}, \overset). Order matters — \overline carries
   accent="true" as well as a stretchy bar, and the bar reading is the right one. */
function emitOver(nd: XmlNode, k: XmlNode[], ctx: Ctx): string {
  const o = unwrap(k[1]);
  const ch = o && isEl(o) && o.name === "mo" && !hasEl(o) ? clean(textOf(o)).trim() : "";
  const stretchy = !!(o && o.attrs && o.attrs.stretchy === "true");
  if (ch && GROUP_TOP[ch]) return groupChr(ch, "top", k[0], ctx);
  if (ch && stretchy && BAR_TOP.indexOf(ch) >= 0) return bar("top", k[0], ctx);
  if (ch.length === 1 && ACC[ch] && (nd.attrs.accent === "true" || !stretchy))
    return (
      "<m:acc><m:accPr>" + val("chr", ACC[ch]!) + "</m:accPr>" + slot("m:e", k[0], ctx) + "</m:acc>"
    );
  return "<m:limUpp>" + slot("m:e", k[0], ctx) + slot("m:lim", k[1], ctx) + "</m:limUpp>";
}

/* munder: Word has no under-accent, so anything that is not a bar or a brace
   falls through to a lower limit — which is what \lim_{x\to0} wants anyway. */
function emitUnder(nd: XmlNode, k: XmlNode[], ctx: Ctx): string {
  const o = unwrap(k[1]);
  const ch = o && isEl(o) && o.name === "mo" && !hasEl(o) ? clean(textOf(o)).trim() : "";
  const stretchy = !!(o && o.attrs && o.attrs.stretchy === "true");
  if (ch && GROUP_BOT[ch]) return groupChr(ch, "bot", k[0], ctx);
  if (
    ch &&
    (stretchy || nd.attrs.accentunder === "true") &&
    (BAR_BOT.indexOf(ch) >= 0 || BAR_TOP.indexOf(ch) >= 0)
  )
    return bar("bot", k[0], ctx);
  return "<m:limLow>" + slot("m:e", k[0], ctx) + slot("m:lim", k[1], ctx) + "</m:limLow>";
}

const bar = (pos: string, base: XmlNode | undefined, ctx: Ctx): string =>
  "<m:bar><m:barPr>" + val("pos", pos) + "</m:barPr>" + slot("m:e", base, ctx) + "</m:bar>";
const groupChr = (ch: string, pos: string, base: XmlNode | undefined, ctx: Ctx): string =>
  "<m:groupChr><m:groupChrPr>" +
  val("chr", ch) +
  val("pos", pos) +
  val("vertJc", pos === "top" ? "bot" : "top") +
  "</m:groupChrPr>" +
  slot("m:e", base, ctx) +
  "</m:groupChr>";

function emitMulti(k: XmlNode[], ctx: Ctx): string {
  const post: XmlNode[] = [],
    pre: XmlNode[] = [];
  let target = post;
  for (let i = 1; i < k.length; i++) {
    if (k[i]!.name === "mprescripts") {
      target = pre;
      continue;
    }
    target.push(k[i]!);
  }
  const live = (nd: XmlNode | undefined): XmlNode | null => (nd && nd.name !== "none" ? nd : null);
  let core: string;
  if (live(post[0]) && live(post[1])) {
    core =
      "<m:sSubSup>" +
      slot("m:e", k[0], ctx) +
      slot("m:sub", post[0], ctx) +
      slot("m:sup", post[1], ctx) +
      "</m:sSubSup>";
  } else if (live(post[0])) {
    core = "<m:sSub>" + slot("m:e", k[0], ctx) + slot("m:sub", post[0], ctx) + "</m:sSub>";
  } else if (live(post[1])) {
    core = "<m:sSup>" + slot("m:e", k[0], ctx) + slot("m:sup", post[1], ctx) + "</m:sSup>";
  } else {
    core = emitList([k[0]!], ctx) || "<m:r><m:t/></m:r>";
  }
  if (!pre.length) return core;
  return (
    "<m:sPre>" +
    slot("m:sub", live(pre[0]), ctx, !live(pre[0])) +
    slot("m:sup", live(pre[1]), ctx, !live(pre[1])) +
    "<m:e>" +
    core +
    "</m:e></m:sPre>"
  );
}

function emitTable(nd: XmlNode, rows: XmlNode[], ctx: Ctx): string {
  const body = rows.filter((r) => isEl(r) && (r.name === "mtr" || r.name === "mlabeledtr"));
  const cells = body.map((r) => kidsOf(r).filter((c) => isEl(c) && c.name === "mtd"));
  const cols = cells.reduce((n, r) => Math.max(n, r.length), 0) || 1;

  const align = String(nd.attrs.columnalign || "center")
    .trim()
    .split(/\s+/);
  const jc = (i: number): string => {
    const a = align[Math.min(i, align.length - 1)] || "center";
    return a === "left" || a === "right" ? a : "center";
  };
  let mcs = "",
    run = 1;
  for (let i = 0; i < cols; i++) {
    if (i + 1 < cols && jc(i + 1) === jc(i)) {
      run++;
      continue;
    }
    mcs += "<m:mc><m:mcPr>" + val("count", String(run)) + val("mcJc", jc(i)) + "</m:mcPr></m:mc>";
    run = 1;
  }
  /* KaTeX gives `aligned` columnspacing="0em"; without this Word inserts its
     own gap and "a  = b" drifts apart from the alignment point. */
  const gap =
    parseFloat(nd.attrs.columnspacing!) === 0 ? val("cGpRule", "3") + val("cGp", "0") : ""; // 3 = exactly, 0 = flush
  let out = "<m:m><m:mPr>" + gap + "<m:mcs>" + mcs + "</m:mcs></m:mPr>";
  for (let r = 0; r < cells.length; r++) {
    out += "<m:mr>";
    for (let c = 0; c < cols; c++)
      out += slot("m:e", cells[r]![c] ? kidsOf(cells[r]![c]!) : [], ctx);
    out += "</m:mr>";
  }
  return out + "</m:m>";
}

function emitEnclose(nd: XmlNode, k: XmlNode[], ctx: Ctx): string {
  const note = String(nd.attrs.notation || "longdiv")
    .toLowerCase()
    .split(/\s+/);
  const has = (n: string): boolean => note.indexOf(n) >= 0;
  const side = { top: has("top"), bot: has("bottom"), left: has("left"), right: has("right") };
  const boxed = has("box") || has("roundedbox") || has("circle") || has("actuarial");
  const any = side.top || side.bot || side.left || side.right;
  const strikes =
    (has("updiagonalstrike") ? val("strikeBLTR", "1") : "") +
    (has("downdiagonalstrike") ? val("strikeTLBR", "1") : "") +
    (has("horizontalstrike") ? val("strikeH", "1") : "") +
    (has("verticalstrike") ? val("strikeV", "1") : "");
  if (!boxed && !any && !strikes) return emitList(k, ctx) || "<m:r><m:t/></m:r>";
  const hide = boxed
    ? ""
    : (side.top ? "" : val("hideTop", "1")) +
      (side.bot ? "" : val("hideBot", "1")) +
      (side.left ? "" : val("hideLeft", "1")) +
      (side.right ? "" : val("hideRight", "1"));
  return (
    "<m:borderBox><m:borderBoxPr>" +
    hide +
    strikes +
    "</m:borderBoxPr>" +
    slot("m:e", k, ctx) +
    "</m:borderBox>"
  );
}

/* ---------- entry points ---------- */
function findMath(doc: XmlNode): XmlNode | null {
  let found: XmlNode | null = null;
  (function walk(nd: XmlNode) {
    for (let i = 0; i < nd.kids.length && !found; i++) {
      const k = nd.kids[i]!;
      if (!isEl(k)) continue;
      if (k.name === "math") {
        found = k;
        return;
      }
      walk(k);
    }
  })(doc);
  return found;
}

/** MathML string → "<m:oMath …>…</m:oMath>", or null if nothing usable. */
export function mmlToOmml(mathml: string | null | undefined): string | null {
  if (!mathml || typeof mathml !== "string") return null;
  let inner: string | undefined;
  try {
    const doc = parseXml(mathml);
    const math = findMath(doc) || doc;
    inner = emitList(kidsOf(math), { mv: (math.attrs && math.attrs.mathvariant) || "" });
  } catch (e) {
    return null;
  }
  if (!inner) return null;
  return '<m:oMath xmlns:m="' + M_NS + '">' + inner + "</m:oMath>";
}

/** Wrap an <m:oMath> as its own display paragraph. */
export function oMathPara(omml: string | null | undefined, jc?: string): string | null {
  if (!omml) return null;
  const j = jc === undefined ? "center" : jc;
  return (
    '<m:oMathPara xmlns:m="' +
    M_NS +
    '">' +
    (j ? "<m:oMathParaPr>" + val("jc", j) + "</m:oMathParaPr>" : "") +
    omml +
    "</m:oMathPara>"
  );
}

/** LaTeX → OMML through the global `katex`. Returns null when KaTeX is absent
    or the source will not parse, so the caller can print the raw TeX instead. */
export function texToOmml(tex: string | null | undefined, display?: boolean): string | null {
  const k =
    (typeof katex !== "undefined" && katex) ||
    (typeof globalThis !== "undefined" && (globalThis as { katex?: KatexLib }).katex) ||
    null;
  if (!k || typeof k.renderToString !== "function" || tex == null) return null;
  let html: string | undefined;
  try {
    html = k.renderToString(String(tex), {
      output: "mathml",
      displayMode: !!display,
      throwOnError: false,
    });
  } catch (e) {
    return null;
  }
  const m = /<math[\s\S]*?<\/math>/i.exec(html!);
  return m ? mmlToOmml(m[0]) : null;
}

/** The OMML math namespace — `xmlns:m` on every emitted root. */
export const NS = M_NS;

/** Exactly today's public surface: the classic `MathmlOmml` module object. */
export const api = { mmlToOmml: mmlToOmml, texToOmml: texToOmml, oMathPara: oMathPara, NS: M_NS };

export type MathmlOmmlApi = typeof api;
