# Span Attribute Audit

## Terms of reference

This audit examines the span attribute carrier, the bracket-and-brace
construct through which the DocForge dialect reaches Word's character-level
formatting: ink colour, background shading, point size, typeface, and the
three switches for underline, small capitals, and full capitals. The audit
is written as the compliance report of a fictional identity programme, the
Meridian house style, because attribute spans only misbehave when they are
asked to do real editorial work inside running prose. Every specimen below
is therefore embedded in a sentence that would survive in a published
document, and every value is fixed for the life of this golden master.

The programme's palette does not drift: navy for structure, claret for
warnings, forest for confirmations, and a family of light shadings for
degrees of provisionality. The rendered pages of this audit are compared
against frozen baselines, so a change in any tint, size, or face is a
finding against the engine rather than against the house style.

## Single attributes, quoted and unquoted

The colour attribute accepts hexadecimal ink in several spellings, and all
of them must land on the same run property. The house navy appears as
[a six-digit value with a leading hash]{color=#1f4e79} in the canonical
form, as [the same navy without the hash]{color=1f4e79} in the bare form,
and as [the navy under quotation marks]{color="#1f4e79"} where a template
generator insists on quoting; the claret compresses to
[a three-digit short form]{color=#c00} that must expand to six digits in
the exported file.

Background shading follows the same rules of spelling. The standard
annotation amber reads as [a phrase on canonical amber]{bg=#ffe28a}, the
bare form as [a phrase shaded without the hash]{bg=ffe28a}, and the quoted
bare form as [a phrase shaded, quoted and unhashed]{bg="ffd966"}. Point
size accepts whole and fractional values across its permitted range:
[an aside at nine and a half points]{size=9.5} sits below the body size,
[a callout at fourteen points]{size=14} sits above it,
[a marginal note at six points]{size=6} approaches the floor,
[a display fragment at twenty-four points]{size=24} approaches headline
scale, and [a quoted eighteen]{size="18"} proves the quotation marks are
stripped before the number is read.

The typeface attribute names any family from the Word menu. A single-word
family travels unquoted, as [a Georgia specimen]{font=Georgia} shows, while
a family with spaces in its name must be quoted, as
[a Palatino Linotype specimen]{font="Palatino Linotype"} shows. The three
bare switches complete the set: [a rule from the u switch]{u},
[a passage in small capitals]{sc}, and [a passage forced to capitals]{caps}
each take effect with no value attached at all.

## Pairwise combinations

Attributes are designed to combine, and the audit walks the pairs that
matter in practice. Ink pairs with shading in
[claret ink over amber shading]{color=#c00000 bg=#ffe28a}, with size in
[navy at fourteen points]{color=#1f4e79 size=14}, with typeface in
[forest ink set in Cambria]{color=#0f6a3c font=Cambria}, with the rule in
[underlined claret]{color=#c00000 u}, with small capitals in
[navy small capitals]{color=#1f4e79 sc}, and with full capitals in
[claret capitals]{color=#c00000 caps}. Shading pairs the same way: with
size in [amber shading at twelve points]{bg=#ffe28a size=12}, with typeface
in [a green tint set in Verdana]{bg=#e2efda font=Verdana}, with the rule in
[an underlined lilac tint]{bg=#e6e0ec u}, with small capitals in
[tinted small capitals]{bg=#fce4d6 sc}, and with full capitals in
[a tinted word in capitals]{bg=#d9e1f2 caps}.

The remaining pairs close the matrix. Size meets typeface in
[sixteen points of Consolas]{size=16 font=Consolas}, size meets the rule in
[twelve underlined points]{size=12 u}, size meets small capitals in
[thirteen points of small capitals]{size=13 sc}, and typeface meets the
switches in [Century Gothic under a rule]{font="Century Gothic" u} and in
[Garamond in small capitals]{font=Garamond sc}. The switches also meet one
another: [a ruled run of small capitals]{u sc} carries both at once, and
the deliberately contradictory
[small capitals forced to full capitals]{sc caps} is retained as a torture
case, because the exporter must emit both run properties and leave the
precedence to the consuming application.

## Spans across the emphasis boundary

A span must survive being wrapped by the classic emphases, and it must host
them in turn. Wrapped by bold, the specimen reads
**a bold warning whose [claret core]{color=#c00000} is coloured from within**;
wrapped by italic, it reads
*an italic aside carrying [an amber patch]{bg=#ffe28a} midway through*.
Hosting the emphases, a single span holds
[a phrase where **bold**, *italic*, and ++an inner rule++ all inherit twelve points of Georgia]{size=12 font=Georgia}
without dropping any child mark. Escaped brackets belong to the span's own
text, so [a label with \[bracketed\] material inside]{bg=#f2f2f2} keeps its
brackets in print, and the vertical marks ride along inside
[the H~2~O trace at 10^3^ dilution]{sc} without disturbing the variant.

## Structural placements

### Deliverables set in [small capitals]{sc} for the running order

A span inside a heading must inherit the heading's scale while applying its
own variant, as the title of this subsection demonstrates. The audit's
deliverable list then applies spans inside list items, where the hanging
indent has historically clipped backgrounds at the wrap:

- The [primary register]{color=#1f4e79 sc} bullet carries navy small capitals.
- The [exception register]{color=#c00000 bg=#ffe28a} bullet layers claret over amber.
- A bullet whose [long shaded phrase runs far enough that the tint must wrap within the narrower list measure and resume beneath the hanging indent]{bg=#fff2cc} exercises exactly that clipping.

1. An ordered entry holds [a ruled term]{u} in mid-sentence.
2. A second entry sizes [its key finding]{size=14} above the body text.
3. A third sets [its citation tag]{font=Consolas} in the fixed-pitch face.

## Faces that may be absent

The typeface attribute may name families the reading machine does not have.
The audit therefore includes [a specimen naming Rockwell]{font=Rockwell},
which must fall back within the serif class when the face is absent, and
[a specimen naming Segoe Print]{font="Segoe Print"}, which must fall back
within the script class, so a reviewer can confirm that substitution stays
inside the family's own group rather than collapsing to an arbitrary
default. The paginated preview uses whatever local copy exists, while the
exported file carries only the family name and lets the receiving copy of
Word supply its own; both behaviours are correct by design, and neither may
change the measured extent of the surrounding paragraph.

## The full stack and the page seam

The complete attribute stack appears once, spelled exactly as the engine's
own documentation gives it:
[the full seven-attribute specimen]{color=#c00000 bg=#ffe28a size=14 font="Georgia" u sc caps}
must colour, shade, resize, reface, underline, and recase a single phrase
in one pass, and the exported run must carry all seven properties without
loss or reordering.

The paragraphs of this audit are paced so that the specimen below reaches
the seam between two rendered pages.
[This shaded span is long enough, and placed deliberately enough, that its background tint must end cleanly at the foot of one rendered page and resume at the head of the next, with no seam, no repeated words, and no loss of tint on either side of the break.]{bg=#fff2cc}
When the seam falls elsewhere after an engine change, the comparison runner
will report the drift, and reporting that drift is the entire purpose of a
golden master.

## Closing statement

The audit finds the span layer compliant when every specimen above renders
identically in the paginated preview, the printed PDF, and the exported
Word file: the four spellings of navy must be indistinguishable, the pair
matrix must show every combination intact, the wrapped and hosting cases
must keep their child marks, the heading and list placements must hold
their variants through the wrap, and the seven-attribute specimen must
arrive in Word as a single run carrying colour, shading, size, face, rule,
small capitals, and full capitals together. Anything less is a regression
in the span tokenizer or its exporters, and the frozen baselines of this
document exist so that such a regression can never again arrive unnoticed.
