# @docforge/mathml-omml

**KaTeX MathML → Word OMML (Office Math).** Turn a LaTeX or MathML equation into the
markup Word stores inside a `.docx`, so your exported equation is a **real, editable
Word equation** — double-click it in Word and the equation editor opens — instead of a
blurry picture of one.

Zero dependencies, no DOM. The converter carries its own tolerant XML reader and runs
identically in Node, the browser, and workers.

## Why this exists

There is no good MathML → OMML path in JavaScript. Word's own converter is an XSLT
sheet (`MML2OMML.XSL`) locked inside a desktop Office install; JS `.docx` pipelines
that support math at all usually rasterize equations to images, which readers cannot
edit, resize, or restyle. This package closes that gap: KaTeX gives you MathML from
TeX everywhere, and `@docforge/mathml-omml` gives Word the native math it wants.

## API

All signatures verbatim from [`src/index.ts`](./src/index.ts):

```ts
/** MathML string → "<m:oMath …>…</m:oMath>", or null if nothing usable. */
function mmlToOmml(mathml: string | null | undefined): string | null;

/** LaTeX → OMML through the global `katex`. Returns null when KaTeX is absent
    or the source will not parse, so the caller can print the raw TeX instead. */
function texToOmml(tex: string | null | undefined, display?: boolean): string | null;

/** Wrap an <m:oMath> as its own display paragraph (jc defaults to "center"). */
function oMathPara(omml: string | null | undefined, jc?: string): string | null;

/** The OMML math namespace — `xmlns:m` on every emitted root. */
const NS: string;

/** The classic `MathmlOmml` module object: { mmlToOmml, texToOmml, oMathPara, NS }. */
const api: MathmlOmmlApi;
```

Both converters **return `null` rather than guess** when they cannot make sense of the
input — a silently wrong equation is worse than no equation. Design your call site
with a fallback (print the TeX source in monospace).

A side-effect entry, `@docforge/mathml-omml/global`, assigns the classic
`globalThis.MathmlOmml` for script-tag / single-file builds.

## Usage with the `docx` library

`texToOmml` reads KaTeX from the **global** — KaTeX is deliberately not a dependency,
so you bring the version you already ship:

```ts
import katex from "katex";
import { Document, Packer, Paragraph, TextRun, ImportedXmlComponent } from "docx";
import { texToOmml, oMathPara } from "@docforge/mathml-omml";

globalThis.katex = katex; // texToOmml resolves `katex` at call time

const tex = "\\int_0^\\infty e^{-\\lambda t}\\,dt = \\frac{1}{\\lambda}";
const omml = texToOmml(tex, true); // display mode

const equation = omml
  ? // a display equation is its own centred paragraph
    new Paragraph({
      children: [ImportedXmlComponent.fromXmlString(oMathPara(omml) as string).root[0]],
    })
  : // the null contract: fall back to the source rather than guess
    new Paragraph({ children: [new TextRun({ text: tex, font: "Consolas" })] });

const doc = new Document({ sections: [{ children: [equation] }] });
const bytes = await Packer.toBuffer(doc);
```

For **inline** math, call `texToOmml(tex, false)` and push
`ImportedXmlComponent.fromXmlString(omml).root[0]` among the `TextRun`s of an ordinary
paragraph — no `oMathPara` wrapper. This is exactly how DocForge's own `.docx`
exporter consumes it.

Already have MathML from another producer? Skip KaTeX and call `mmlToOmml(mathml)`
directly. The reader is tolerant of hand-pasted MathML (unquoted attributes, unclosed
tags, HTML entities).

## What it sweats so you don't have to

- **N-ary structure**: the integrand/summand of `∑ ∏ ∫ …` is placed *inside* the
  `<m:nary>` element, ending at relations and additive operators — so editing the
  limits of `∫₀^∞ f dt = 1/λ` in Word behaves the way Word's own equations do.
- **Function application**: KaTeX's U+2061 marker becomes `<m:func>`, which is what
  puts the thin space into "sin x" and keeps `\lim_{x\to 0}` a function with limits.
- **The italic rule**: multi-letter `<mi>` (sin, lim, det) is set upright per the
  MathML spec; single letters stay Word's default math italic.
- **Fence pairing**: `\left…\right` pairs into one `<m:d>`, including the one-sided
  forms — `\left.` … `\right|` and the `cases` environment's lone `\{`.
- **Accents**: spacing modifier letters mapped to the combining forms Word's own
  accent gallery inserts (`\hat` → U+0302, `\vec` → U+20D7, …).
- **`aligned` alignment**: zero column spacing is forwarded (`m:cGp` 0) so `a = b`
  stays flush at the alignment point instead of drifting apart.
- **Run merging**: adjacent runs with identical properties fuse, so a human editing
  the equation in Word afterwards sees "sin" as one run, not three.
- **Valid `m:sty` always**: only the four values Word accepts (`p b i bi`) are ever
  emitted; script/fraktur/double-struck ride `m:scr` — Word never silently discards
  the run properties.

## Provenance

This is the 1:1 mechanical TypeScript port of the battle-tested DocForge converter
(`src/js/mathml-omml.js`) — the one that has been producing the equations in real
exported documents. The port is proven, not promised: a **377-case byte-parity
harness** drives both implementations through real KaTeX and compares output byte for
byte. Written against the OMML shapes in ECMA-376 Part 1 §22.1 and against what KaTeX
0.18 actually emits.

## Honest limitations

- **Bring your own KaTeX.** `texToOmml` resolves the `katex` global at call time and
  returns `null` when it is absent. `mmlToOmml` has no such requirement.
- **`\\` is not a line break.** A bare `\\` (KaTeX's `<mspace linebreak="newline">`)
  becomes a wide gap, not a new line — Word's renderer ignores `<m:brk>` in every
  placement (checked against Word itself), so the converter refuses to emit dead
  markup. Use `\begin{aligned}…\end{aligned}` for real multi-line math; that arrives
  as a matrix and converts properly.
- **Whitespace runs carry an invisible joiner.** Word throws away a math run that is
  only whitespace, so `\quad` and `\,` get a zero-width U+2060 WORD JOINER appended to
  survive. Correct visually; the character is there if you diff the XML.
- **No under-accents.** Word has no under-accent construct, so an `munder` that is
  not a bar or brace falls through to a lower limit (which is what `\lim_{x\to 0}`
  wants anyway).
- **`menclose` approximates.** `box`, `roundedbox`, `circle`, and `actuarial` all
  become Word's rectangular `<m:borderBox>`; notations Word cannot draw are dropped
  rather than faked.
- **Tuned to KaTeX's MathML.** Hand-written MathML mostly works (tolerant reader,
  entity table, transparent wrappers), but elementary-math layout (`mstack`,
  `mlongdiv`, `mscarries`) is treated as plain grouping — content preserved, long
  division not drawn.
- **Strings in, strings out.** The output is an XML string for you to embed
  (`ImportedXmlComponent.fromXmlString`, or splice into `document.xml` yourself), not
  a node tree.

## Shipping format

The package currently ships **TypeScript source** via its exports map
(`.` → `./src/index.ts`) and is consumed by bundlers and TS-aware runtimes (Vite,
esbuild, Next, tsx). Compiled `dist/` + `.d.ts` emission lands with the actual npm
publish.

## License

MIT © the DocForge project. Part of the [DocForge](https://github.com/rakshit-737/docforge)
monorepo.
