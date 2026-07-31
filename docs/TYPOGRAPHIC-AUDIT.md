# DocForge — typographic audit of the current output

Baseline: commit `1af2452`, `dist/DocForge.html` 1.01 MB.
Method: the torture document in [`qa/torture.md`](../qa/torture.md) was rendered through both
consumers and both outputs were rasterised and compared page by page — the PDF via Chrome's
print path (`page.pdf`, `preferCSSPageSize`), the Word file via real Word (COM automation,
`Fields.Update` + `Repaginate`) converted to PDF and rasterised the same way. Every claim below
was also checked against the source. Reproduce with `node qa/visual.mjs --label before`.

---

## 1. The headline

The output is not badly designed. Held at arm's length, a DocForge page looks like a competent
corporate template — the accent system is coherent, the heading scale is sensible, the cover has a
real idea in it. What gives it away at reading distance is not the design but the **typesetting**:
the document is *styled* but never *composed*. Four things do that damage, in descending order of
how quickly a reader notices them.

**a. Hard-wrapped source becomes forced line breaks.** `marked.use({ breaks: true })`
([engine.js:8](../src/js/engine.js#L8)) turns every newline inside a paragraph into a `<br>`. Any
author who wraps their markdown at 80 or 100 columns — which is most authors, and which the app's
own monospace editor encourages — gets those wraps burned into the printed page as hard breaks.
In the torture document this produces `…A third paragraph pads this section` / `far enough that the
first heading below lands mid-page`, broken mid-sentence at the source wrap point, in **both**
exports. With justification on it is worse: a forced break is never justified, so every hard-wrapped
line is set ragged inside an otherwise justified column. This single line of configuration is the
loudest "generated" signal in the whole product, and it is invisible to anyone testing with
unwrapped paragraphs.

**b. Nothing composes the page; things are only forbidden from splitting.** There is no
`orphans`/`widows` anywhere in [`doc.css`](../src/doc.css), and the only page-breaking control is
`break-inside: avoid` on callouts, `<pre>`, figures and rows. `avoid` is a blunt instrument: when a
block does not fit, it moves wholesale to the next page and leaves whatever was above it stranded.
Page 4 of the modern/A4 capture ends with roughly a third of the page blank because the next
callout would not fit; page 5 ends with ~40 % blank because the code block would not fit. Real
typesetting fills the page and breaks the block; DocForge empties the page and moves the block.
Meanwhile ordinary prose gets no protection at all, so a paragraph can leave one line alone at a
page foot.

**c. Type is borrowed, not owned.** `FONTS` ([engine.js:57-66](../src/js/engine.js#L57)) names
system stacks — Segoe UI, Cambria, Georgia — and `WORD_FONTS`
([docx-export.js:11-16](../src/js/docx-export.js#L11)) names Calibri/Cambria/Georgia. Nothing is
embedded. The document therefore has no fixed identity: it is Segoe UI on Windows, something from
the fallback chain on Linux, and Calibri in the Word file on the same machine.

**d. The two exports are two different documents.** They agree on content and disagree on almost
every detail of setting — and in three places the Word file loses content outright. This is the
app's real structural risk and section 4 enumerates it.

Below the headline sit the small things that separately say "word processor": straight quotes and
hyphens where a typesetter would use curly quotes and en dashes, no non-breaking spaces so
"Figure 3" and "10 kg" can break across lines, a paragraph gap (7 pt) that is an arbitrary 0.40 of
the 17.5 pt leading rather than a clean fraction, and all-caps runs tracked inconsistently
(0.06 em on callout titles, 0.13 em on the running header, 0.22 em on the cover kicker — the
scale is backwards, since smaller caps need *more* tracking, not less).

---

## 2. Where the brief is wrong

The brief asked to be told if a claimed defect does not hold. Five need correcting, and two of the
corrections change the fix.

**C1.3 — the stated mechanism is wrong and the proposed fix is a no-op.** The *outcome* is real and
I reproduced it: a table crossing a page keeps its header in Word and loses it in the PDF (see
`qa/out/before/modern-a4/pdf/p04.png`, which resumes at row 5 with no header row and no accent
rule). But the cause is not a missing `display: table-header-group`. That is already the UA default
for `<thead>` and measures as `table-header-group` in the live Paged.js output. The header does not
repeat because Paged.js *fragments the table itself*: `rebuildAncestors()` shallow-clones only the
ancestor chain of the break token (`table > tbody > tr`) and never clones the `<thead>` sibling, so
each page holds a separate `<table>` with no header for the browser's repeat logic to act on.
Adding the property changes nothing. **The fix has to clone the `thead` into each fragment**, which
is a Paged.js-level intervention (an `afterPageLayout` hook), not a CSS one.

**C1.4 — the sharper hypothesis is refuted; the two formats agree.** The cover does *not* print a
page number: `@page cover { @bottom-center { content: none } }` genuinely suppresses it (verified in
Chrome — the margin box computes to `814×0` px). The defect is the subtler one: **the cover is blank
but still increments the counter**, so the body starts at 2 or 3 with no explanation. And Word does
exactly the same — `titlePg` blanks the first page while a bare `<w:pgNumType/>` leaves numbering
arabic from page 1, and `NUMPAGES` counts everything. Measured on the welcome template: PDF and Word
both read "Page 2 of 4" on Contents and "Page 3 of 4" on the first body page. They implement the
same wrong scheme consistently. So this is a design fix, not a parity fix.

**C1.2 (Word half) — `widowControl` on body paragraphs would be a no-op.** OOXML's omitted-value
default for `w:widowControl` is *on*, which is why a blank Word document shows the box ticked.
The exported `.docx` already has widow/orphan protection; the PDF has none. The asymmetry is real
but points the other way: **fix the PDF side.** The `keepNext`-on-headings half of the claim is
fully confirmed and is the part worth doing.

**C1.2c — captions.** Confirmed for Word, refuted for the PDF (the `<figcaption>` lives *inside*
the `<figure>`, which is `break-inside: avoid`, so it cannot separate). "Table captions" has no
referent — DocForge has no table-caption feature at all; that is Tier 2.3 work, not a Tier 1 fix.
One precision note for the implementation: `keepNext` binds a paragraph to the one *after* it, and
DocForge puts captions *below* figures, so the flag belongs on the **image** paragraph, not the
caption paragraph. Putting it on the caption would bind the caption to the next body paragraph —
the opposite of what is wanted.

**C3.2 — the blockquote bug is real but not reachable from markdown.** `.children` does skip text
nodes, but marked always wraps loose blockquote text in `<p>`; I checked every shape (lazy
continuation, nested, list-in-quote, heading-in-quote, fenced code). The only trigger is
hand-written raw HTML, which marked passes through verbatim. The *reachable* bugs in those same
three lines are different and worse: every element child becomes one flat italic `Paragraph`, so a
list inside a quote collapses to a run-on line, `> ## Head` loses its heading, and a fenced block
inside a quote has its newlines collapsed. Fix the branch, but fix it for those cases.

Everything else in the brief is confirmed. Two claims were verified as *worse* than stated — see
D2 and D6 below.

---

## 3. Defect register — PDF path

| # | Defect | Where | Severity |
|---|---|---|---|
| P1 | `breaks: true` burns source line-wraps into the page as hard breaks; forced breaks are never justified | [engine.js:8](../src/js/engine.js#L8) | major |
| P2 | No `orphans`/`widows` on body text — a paragraph can strand a line at a page foot | [doc.css:20](../src/doc.css#L20) | major |
| P3 | Table crossing a page loses its header row **and** its accent top rule (rules live on `th`) | [doc.css:114](../src/doc.css#L114), Paged.js `rebuildAncestors` | major |
| P4 | `break-inside: avoid` on callouts/`pre`/figures empties up to 40 % of a page rather than breaking the block | [doc.css:102](../src/doc.css#L102),[132](../src/doc.css#L132),[166](../src/doc.css#L166) | major |
| P5 | A table row taller than the page produces a blank page | [doc.css:129](../src/doc.css#L129) | major |
| P6 | Cover is blank but still counts; body starts at 2/3; `of N` includes front matter | [engine.js:279](../src/js/engine.js#L279) | major |
| P7 | Attached screenshots are stretched — `img.style.width` is set as a percentage while `width`/`height` attributes remain, destroying the aspect ratio | [engine.js:172-175](../src/js/engine.js#L172) | **critical** |
| P8 | GFM column alignment (`:---:`, `---:`) is dropped — a right-aligned numeric column prints left-aligned | [doc.css:124](../src/doc.css#L124) | major |
| P9 | Screenshot placeholders print their caption **twice** — once inside the box, once in the figure caption | [engine.js:180](../src/js/engine.js#L180),[192](../src/js/engine.js#L192) | major |
| P10 | Heading numbering starts at `0.1` when the first heading is an H2 | [engine.js:133](../src/js/engine.js#L133) | major |
| P11 | No smart quotes, en dashes or ellipses; no non-breaking spaces anywhere | [engine.js:8](../src/js/engine.js#L8),[192](../src/js/engine.js#L192) | major |
| P12 | Paragraph gap is 0.40 of the leading; no spacing value derives from the 17.5 pt baseline | [doc.css:20](../src/doc.css#L20) | cosmetic |
| P13 | All-caps tracking scale is inverted (smaller caps tracked tighter) | [doc.css:144](../src/doc.css#L144) | minor |
| P14 | `hyphens: auto` cannot work — no `lang` reaches the `.doc` element | [doc.css:21](../src/doc.css#L21) | major |
| P15 | Slug dedupe can still emit duplicate ids, sending a TOC entry to the wrong page | [engine.js:127](../src/js/engine.js#L127) | minor |
| P16 | Executive theme prints the heading number twice, in two different styles | [doc.css:49](../src/doc.css#L49) | minor |
| P17 | No PDF bookmark outline | print path | minor |
| P18 | Print dialog offers "DocForge — Document Studio.pdf" as the filename | [main.js:660](../src/js/main.js#L660) | major |

## 4. Defect register — Word path, and PDF↔Word divergence

Content **lost or corrupted** in Word (the three that matter most):

| # | Defect | Where | Severity |
|---|---|---|---|
| D1 | A table inside a callout is flattened to one run-on text line — "Risk Likelihood Impact Capacity shortfall Medium High…" | [docx-export.js:176](../src/js/docx-export.js#L176) | **critical** |
| D2 | A nested list inside a callout is both inlined into its parent **and duplicated** as separate bullets (worse than the brief states) | [docx-export.js:174](../src/js/docx-export.js#L174) | **critical** |
| D3 | `h5`/`h6` and any other unhandled leaf block are silently deleted | [docx-export.js:283](../src/js/docx-export.js#L283) | major |
| D4 | Block content inside a list item is flattened to a run-on line | [docx-export.js:105](../src/js/docx-export.js#L105) | major |
| D5 | List/heading/`pre` inside a blockquote is flattened to one italic line | [docx-export.js:267](../src/js/docx-export.js#L267) | major |
| D6 | Code inside a callout loses its box, monospace and every newline — **this one breaks the PDF too** | [engine.js:111](../src/js/engine.js#L111) | major |
| D7 | A callout inside a callout terminates the outer box early and prints a literal `:::` | [engine.js:107](../src/js/engine.js#L107) | major |
| D8 | Images that are not their paragraph's only child are dropped | [docx-export.js:66](../src/js/docx-export.js#L66) | minor |

Divergences a reader would notice holding both documents (abridged; full list in the run data):

| # | Divergence | PDF | Word |
|---|---|---|---|
| V1 | Cover band | full-bleed to the paper edge, top and bottom | inset by the page margins, top only |
| V2 | Cover meta block | pinned to the foot by a flex spacer | floats mid-page on guessed twip spacing |
| V3 | Contents page | designed — accent, weight hierarchy, dotted leaders, live `target-counter` numbers | Word's built-in TOC styles, flat black, and blank until fields update |
| V4 | Running header | title left + live section name right | title only, plus a rule the PDF does not have |
| V5 | Heading gaps | CSS margins collapse | Word spacing adds — every gap 14-45 % wider |
| V6 | Body leading | 17.50 pt fixed | `line: 288` ≈ 8 % tighter |
| V7 | Theme tweaks | modern H2 accent bar, academic/minimal table and heading treatments | none survive |
| V8 | Table columns | proportional to content | Word auto-sizes; no `columnWidths` — "In progress" wraps to two lines |
| V9 | Justification | hyphenated (once `lang` is fixed) | justified with hyphenation off — rivers |
| V10 | Image size | `min(100, w/1500*100+42)%` | `min(1, avail/natW)` — different in both directions |
| V11 | Repeating table header | absent | present |
| V12 | Widow/orphan control | absent | on by default |

Metadata and accessibility: `Document` sets only `creator` and `title` — no subject, keywords,
description or language ([docx-export.js:341](../src/js/docx-export.js#L341)); `ImageRun` carries no
alt text, so Word's accessibility checker flags every image.

---

## 5. What this implies for Tier 1

The tier ordering in the brief is right, with three adjustments that fall out of the audit:

1. **P7 (stretched screenshots) and D1/D2 (callout content destroyed/duplicated) are content-loss
   bugs, not typographic polish.** They are cheap to fix and they outrank everything else. They
   should land first even though they are nominally Tier 3.
2. **P1 (`breaks: true`) is the highest-visibility single change in the whole brief** and is a
   two-line fix plus a migration thought (existing documents — notably the Formal-letter template —
   rely on the current behaviour for address blocks, so the fix needs a way to keep intentional
   hard breaks working).
3. **C1.3 needs a Paged.js hook, not a CSS property**, so budget accordingly.

Font embedding (1.1) stays the anchor of the tier: it is what converts "looks different on every
machine" into a document with a fixed identity, and it is the prerequisite for the PDF and the Word
file reading as the same design. Size budget is comfortable — the build is 1.01 MB against a
~6 MB ceiling.
