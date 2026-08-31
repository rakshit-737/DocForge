# The DocForge dialect — normative reference

This is the construct-by-construct contract of DocForge's markdown dialect (MASTER-PROMPT §1.3 / Appendix B). It is **normative**: what a construct does here is what it does, in the paginated preview, the printed PDF and the exported `.docx` alike.

Two laws govern this file:

1. **The dialect is additive-only, forever.** Existing markup never changes meaning; a document written against any past version renders identically. New constructs may be added; nothing is ever redefined or removed.
2. **Every row is pinned by the golden corpus.** Each construct below names the document in `qa/golden/corpus/` that demonstrates it; those documents are captured on three surfaces (page screenshots, rasterised print-PDF, normalised `.docx` XML) and compared against the `v1-classic` baseline on every push (`qa/golden/README.md`). A change to any row shows up as a failed gate, not a surprised user.

One documented breaking choice predates the freeze: **a single `~tilde~` means subscript** (Pandoc's convention), not strikethrough. Strikethrough is the standard `~~double~~` form.

Base markdown (paragraphs, emphasis, lists, quotes, tables, fenced code, links) is CommonMark via marked; everything below is what DocForge adds or pins down on top of it.

---

## Headings and section labels

| Write | Get | Pinned by |
| --- | --- | --- |
| `# Title` … `###### Sub` | Six heading levels; 1–3 are structural (feed the TOC), 4–6 are local names (excluded from the TOC) | `03-headings-sections.md`, `13-toc-pagebreaks.md` |
| `## Purpose and scope {#sec:scope}` | A stable label attached to the heading; the label wins over the derived slug, so headings can be reworded without breaking references | `03-headings-sections.md` |

Headings are never stranded at a page foot, wrapped headings keep tight internal leading, and a heading that opens a page suppresses its space-above. Two headings in direct contact (`####` then `#####`) are legal and their collapsed gap is part of the frozen output.

## Inline emphasis and code

| Write | Get | Pinned by |
| --- | --- | --- |
| `**bold**` · `*italic*` · `***both***` | The classic emphases, bold-italic from a true cut | `01-inline-marks.md` |
| `` `code` `` | Fixed-pitch, exempt from every smart-punctuation substitution | `01-inline-marks.md` |
| `[text](https://…)` | Hyperlink; long URLs wrap without disturbing the baseline | `01-inline-marks.md` |

## The ribbon marks

| Write | Get | Pinned by |
| --- | --- | --- |
| `++underline++` | Continuous rule clearing the descenders; survives line breaks | `01-inline-marks.md` |
| `~~strike~~` | Strikethrough through the x-height | `01-inline-marks.md` |
| `==mark==` | Highlight in Word's default yellow | `01-inline-marks.md` |
| `=={green}mark==` | Highlight in a named Word colour | `01-inline-marks.md` |
| `~sub~` · `^sup^` | Subscript / superscript — H~2~O, m^3^; no interior spaces allowed; a mark may carry emphasis (`2^**10**^`) | `01-inline-marks.md` |

The highlighter takes exactly **Word's 15 fixed colour names** — `yellow`, `green`, `cyan`, `magenta`, `blue`, `red`, `darkBlue`, `darkCyan`, `darkGreen`, `darkMagenta`, `darkRed`, `darkYellow`, `darkGray`, `lightGray`, `black` — matched case-insensitively; an unknown name falls back to yellow. The DOCX exporter passes the colour by name, which is why the palette is Word's and not CSS's.

Marks nest in any order (`++==both==++` ≡ `==++both++==`), wrap richer content (code, links, sub/sup), and a doubled sign that runs into a word (`i++`, `done==1`) stays literal — the tokenizers also never cross a line of source. All of this is pinned by `01-inline-marks.md`; the collision cases are re-pinned adversarially by `17-adversarial.md`.

## Span attributes

```
[text]{color=#c00000 bg=#ffe28a size=14 font="Georgia" u sc caps}
```

One bracketed phrase, one brace group, seven attributes that combine freely — each landing as a real run property in the `.docx`:

| Attribute | Meaning | Notes |
| --- | --- | --- |
| `color=` | Ink colour | Hex: `#1f4e79`, `1f4e79`, `"#1f4e79"` and `#c00` all legal; short form expands |
| `bg=` | Background shading | Same hex spellings |
| `size=` | Point size | Whole or fractional (`9.5`), quoted or bare |
| `font=` | Typeface | Unquoted single word (`Georgia`) or quoted multi-word (`"Palatino Linotype"`) |
| `u` | Underline switch | Bare, no value |
| `sc` | Small capitals | Bare |
| `caps` | All capitals | Bare |

Spans survive being wrapped by the emphases and host them in turn; they work inside headings and list items (backgrounds surviving the hanging-indent wrap); `\[escaped brackets\]` inside the text stay literal. A face the machine doesn't have falls back within its class (serif to serif, script to script) — the export carries only the family name and lets Word substitute. All pinned by `02-span-attributes.md`. A bracketed phrase with an *unknown* attribute list (`[draft copy]{approved}`) matches nothing and prints verbatim — pinned by `17-adversarial.md`.

## Block containers

| Write | Get | Pinned by |
| --- | --- | --- |
| `:::note` … `:::` | Boxed callout (also `tip`, `warning`, `important`), each with its own tint and default label | `11-callouts-alignment.md` |
| `:::tip Checks before assembly` | Optional title after the kind replaces the default label | `11-callouts-alignment.md` |
| `:::center` … `:::` | Alignment block (also `right`, `left`, `justify`) — Word's paragraph alignment group | `11-callouts-alignment.md` |
| `:::banner` … `:::` | Title plate: a filled band the full width of the text block; first line set large, following lines small in the accent tint | `19-banner-plate.md` |

Callouts carry the full block repertoire — lists, fenced code, tables, every inline mark. Callouts and alignment blocks nest in both directions (a centred line inside a tip; a note inside a justified block). The opener must be alone on its line: `:::center trailing words` is plain text. `:::banner` is the one construct added since the `v1-classic` baseline; its golden cases are marked `postBaseline` and gated by before/after comparison instead of the tag (see `qa/golden/README.md`).

## Lists, quotes and tables

| Write | Get | Pinned by |
| --- | --- | --- |
| `- item` / `1. item` | Bullet / numbered lists, mixed nesting to four levels with level-by-level hanging indents | `12-lists-quotes.md` |
| `> text` | Quotation; quotes nest (`> >`) and carry lists inside them | `12-lists-quotes.md` |
| `\| A \| B \|` rows | Table with shaded header row | `04-tables.md` |
| `\| :--- \| :---: \| ---: \| --- \|` | Column alignment: left, centre, right, and unmarked (renderer default) | `04-tables.md` |
| `[table: caption \| #tbl:name]` | The line above a table captions it as *Table N* and makes it citable; an uncaptioned table stays bare and takes no number | `04-tables.md` |

A table that crosses a page break repeats its header row at the top of every page it occupies, in the PDF and the Word export alike. Cells carry the full inline repertoire (emphasis, code, highlights, sub/sup, links, cross-references). Empty cells are data: the grid holds its shape and declared alignment around every gap (`17-adversarial.md` pins the sparse case).

## Figures and screenshot slots

```
[screenshot: caption | img:key | w:60% | noborder | #fig:name]
```

A reserved, numbered figure slot: prints as a labelled placeholder frame until an image is attached (click it in the preview), and the document is complete and printable in that state. Options in **any order**:

| Option | Meaning |
| --- | --- |
| `caption text` | After the colon; may be omitted (`[screenshot]` bare is legal and still numbered) |
| `w:60%` / `width:60%` | Slot width as a percentage of the text column; both spellings identical; values beyond the measure clamp back to 100% |
| `noborder` | Drops the placeholder frame (caption and number remain) |
| `img:key` | Keys the slot to a named attachment |
| `#fig:name` | Persistent label for cross-referencing |

All forms — bare, captionless-with-options, long-key, clamped, frameless — pinned by `05-figures.md`.

## Footnotes

| Write | Get | Pinned by |
| --- | --- | --- |
| `…text[^1]` | Footnote call — numeric or named keys (`[^visits]`, `[^charter]`) | `06-footnotes.md` |
| `[^1]: note text` | The definition, placed anywhere in the source (top, bottom, mid-document); multi-line notes continue on indented lines | `06-footnotes.md` |

Notes are placed at the foot of the page their call lands on in the PDF, and export as real Word footnotes. A call with no definition anywhere (`[^99]`) prints as the literal characters and joins no sequence (`17-adversarial.md`).

## Citations and the reference list

| Write | Get | Pinned by |
| --- | --- | --- |
| `[@harrow2015]` | Citation call | `07-citations.md` |
| `[@vance2016, p. 33]` | Citation with a locator (`p.`, `pp.`, `ch.` — free text after the comma) | `07-citations.md` |
| `[@harrow2015]: Harrow, J. (2015). *Acoustic Emission…*` | The bibliography entry; continuation lines indent | `07-citations.md` |
| `[references]` | Places the reference list; **auto-appended at the end if omitted** | `07-citations.md` |

Style — numeric `[1]` (IEEE-like) or Author–year (APA-like) — is a **document setting**, not markup; the same source renders under both (the golden matrix captures `07-citations.md` both ways). The list holds cited works only: defined-but-uncited entries are absent by contract. Numeric style lists in citation order; author–year lists alphabetically. A call whose key has no entry (`[@nonexistent]`) fails visibly in place with a question mark, never silently (`17-adversarial.md`). Known limitation, deliberately pinned as a specimen in the corpus: same-author same-year entries are not disambiguated with `2019a`/`2019b` suffixes ([#10](https://github.com/rakshit-737/docforge/issues/10)).

## Cross-references

| Write | Get | Pinned by |
| --- | --- | --- |
| `[#sec:scope]` | "Section 2.1" (resolved number/label) | `03-headings-sections.md` |
| `[#fig:overview]` | "Figure 3" | `05-figures.md` |
| `[#tbl:holdings]` | "Table 1" | `04-tables.md` |

Resolution is direction-independent — forward references written before their targets exist resolve identically to backward ones. A reference to a label that doesn't exist (`[#sec:missing]`) resolves to a visible placeholder, not a silent guess (`17-adversarial.md`).

## Mathematics

| Write | Get | Pinned by |
| --- | --- | --- |
| `$E = mc^2$` | Inline LaTeX, rendered by KaTeX | `09-math.md` |
| `$$…$$` | Display mathematics, own block | `09-math.md` |

The corpus exercises fractions, sums, integrals, `pmatrix`/`bmatrix`, multi-line `aligned` environments, Greek, and math inside bold text. In the `.docx`, every equation exports as **real editable OMML** (`packages/mathml-omml`), never an image. Currency stays prose: `$5 and $10` never becomes an equation (`17-adversarial.md`).

## Code blocks

| Write | Get | Pinned by |
| --- | --- | --- |
| ```` ```python ```` fence | Syntax-coloured code block, print-friendly palette, 36 common languages, in both exports | `10-code.md` |
| Bare ```` ``` ```` fence | Verbatim block; **no** smart punctuation, no dialect marks — everything prints as typed | `01-inline-marks.md` (the immunity fence), `10-code.md` |

## Page-level tokens

| Write | Get | Pinned by |
| --- | --- | --- |
| `[toc]` | Contents listing: dotted leaders, real page numbers, indented by level, capped at heading level 3 | `13-toc-pagebreaks.md`, `18-cover-frontmatter.md` |
| `[lof]` | List of figures | `05-figures.md` |
| `[lot]` | List of tables | `04-tables.md` |
| `[pagebreak]` | Hard page break; the following heading opens its page with space-above suppressed | `13-toc-pagebreaks.md`, `03-headings-sections.md` |

Each token stands alone on its line. Because TOC page numbers are real, the contents page is itself a regression test: any pagination change surfaces twice. With a cover on, front matter (cover, contents) and body run as separate page sequences — romans for the contents, "Page 1 of N" counting body pages only — and TOC entries draw from the body sequence (`18-cover-frontmatter.md`).

## Cover and document identity

The cover's six fields — kicker, title, subtitle, author, extra metadata line, date — are **document settings, not manuscript syntax**: they are entered in the Settings panel, stored with the project (`.docforge.json`), and composed onto the cover and the running header. The source carries no front-matter block at all, which is a deliberate property of the dialect: the manuscript carries content, the settings carry identity, and the two recombine freely. Pinned by `18-cover-frontmatter.md`, whose source begins with `[toc]` and a heading and nothing else. (Templates that want a richer title page build it from ordinary content — centred blocks, a `:::banner` plate, a particulars table — as `19-banner-plate.md` demonstrates.)

Likewise settings, not markup, and exercised across the golden matrix rather than in any one corpus file: theme (Modern / Executive / Academic / Minimal), accent colour, A4/Letter, three margin presets, page borders (7 styles × 3 weights × ink/accent), page numbers, and citation style.

## Automatic typography

Applied to prose in all three outputs, and never inside code:

- Straight quotes → curly (double and single, apostrophes included)
- `--` → en dash, `---` → em dash; numeric ranges (`1990-2020`, pages `14-18`) take en dashes unasked, while ISO dates (`2024-03-14`) keep their hyphens
- `...` → ellipsis character
- No-break spaces bind numbers to units (`10 kg`, `250 ms`, `60 %`) and labels to numbers (`Figure 3`, `Table 2`, `Section 4`)

Pinned by `01-inline-marks.md` (including the fence that proves code is exempt).

## Escapes and lookalikes

A backslash makes any mark literal: `\*asterisk\*`, `\~tilde\~`, `\[bracket\]`, `\==pair==`, `\++pair++` all print as typed characters with nothing applied. Prose that merely resembles markup stays prose: `i++` and `retries==0` (a closer may not run into a word), a lone `**`, a spaced `a == b`, `~40 boxes`, a bare `^`, an unclosed `~~`, entities (`&amp;`, `&lt;script&gt;`), and URLs with underscores in link targets. Quoted markup in inline code is displayed, never executed. The whole boundary is pinned by `17-adversarial.md`, which carries a standing instruction: **every new inline mark added to the dialect must arrive with a matching entry there — escaped form first, then its most plausible collision with ordinary prose** — so a lookalike regression fails the golden gate on day one.

---

## The corpus, mapped

| Corpus file | Pins |
| --- | --- |
| `01-inline-marks.md` | Emphases, code, links, `++u++`, `~~strike~~`, highlighter (all 15 colours, case-insensitivity), `~sub~`/`^sup^`, nesting, wrap behaviour, smart punctuation, code immunity |
| `02-span-attributes.md` | All seven span attributes, every spelling, the pair matrix, spans in headings/lists, absent faces, the full stack, a shaded span across a page seam |
| `03-headings-sections.md` | Six levels, `{#sec:}` labels, forward/backward `[#sec:]`, stacked headings, page-top heading via `[pagebreak]`, wrapping heading |
| `04-tables.md` | `[lot]`, column alignment (incl. unmarked), `[table: … \| #tbl:]`, header repeat across pages, wide tables, the uncaptioned control, inline marks in cells |
| `05-figures.md` | `[lof]`, every `[screenshot…]` form: bare, captionless, `w:`/`width:`, clamp, `noborder`, `img:`, `#fig:`, free option order |
| `06-footnotes.md` | Numeric and named keys, definitions anywhere, long notes, repeated calls |
| `07-citations.md` | Calls, locators, entries, `[references]`, cited-only list, both styles (via the matrix), the APA-disambiguation limitation as a frozen specimen |
| `09-math.md` | Inline and display KaTeX: fractions, sums, integrals, matrices, `aligned`, Greek, math inside bold |
| `10-code.md` | Language-named fences at length (JS, Python, CSS), verbatim fidelity |
| `11-callouts-alignment.md` | All four callouts, titled callouts, all four alignment blocks, nesting in both directions, block content inside callouts |
| `12-lists-quotes.md` | Deep mixed list nesting, nested quotes, lists inside quotes |
| `13-toc-pagebreaks.md` | `[toc]` (leaders, numbers, three-level cap), `[pagebreak]`, consecutive pinned breaks, natural-vs-pinned break behaviour |
| `14-long-mixed.md` | The integration document: everything above at 100-page scale, `[toc]`+`[lof]`+`[lot]` together |
| `16-edge-minimal.md` | The minimal control: a title and two paragraphs |
| `17-adversarial.md` | Escapes, operator collisions, quoted/entity markup, dangling references failing visibly, unknown attribute lists, currency, underscore URLs, sparse tables |
| `18-cover-frontmatter.md` | Settings-driven cover, separate page sequences, roman front matter, pinned date formatting |
| `19-banner-plate.md` | `:::banner` in every shape, marks inside the plate, the house title-page pattern (postBaseline) |

`qa/torture.md` is the original kitchen sink that predates the split, and `qa/golden/matrix.mjs` maps these documents onto settings so that every theme, paper size, margin preset, border style/weight/colour and citation style appears in at least one captured case.
