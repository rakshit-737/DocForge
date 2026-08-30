# Sectioning Conventions for the Golden Corpus {#sec:top}

This report records the sectioning conventions adopted across the DocForge golden
corpus. It is itself written to those conventions, so it doubles as a specimen:
every rule stated below is also exercised below. The reader who wants the rationale
should begin with [#sec:scope]; the reader who only needs the ladder of levels can
go straight to [#sec:ladder], and the discussion of unusually long titles waits in
[#sec:wrapping] near the end of the document.

Three properties matter for a corpus document of this kind. First, the heading
hierarchy must be complete: all six levels appear, in order, so that the styles for
each level can be compared against their neighbours on the same page. Second, the
labels attached to headings must be stable identifiers rather than derived slugs,
so that a cross-reference written in one paragraph keeps resolving after an editor
rewords the heading it points to. Third, the document must be long enough that at
least one heading falls at the top of a page and at least one falls awkwardly close
to the bottom of one, because those are the positions where heading spacing rules
earn their keep.

## Purpose and scope {#sec:scope}

The corpus exists to freeze the behaviour of the layout engine. A document in the
corpus is not a test script with assertions; it is an ordinary report whose typeset
form is captured once, reviewed by a person, and thereafter compared pixel by pixel
against every future build. For that comparison to be meaningful, the source must be
deterministic: the same bytes must produce the same pages on every run. Nothing in
this file depends on the date of rendering, on random content, or on any resource
outside the file itself.

This particular document concentrates on sectioning. It covers the six heading
levels, explicit section labels, cross-references between sections in both
directions, headings stacked directly on top of one another, a heading forced to
the very top of a page, and a heading whose text is long enough to wrap. Companion
documents in the corpus cover tables, figures, mathematics, and the contents page;
where those features are mentioned here, they are mentioned only in prose.

## The ladder of levels {#sec:ladder}

The subsections that follow descend one heading level at a time. Between the second
and third levels there is deliberately no intervening prose, and none between the
fourth and fifth either: two headings in direct contact are a common real-world
shape, and the vertical space between them has historically been a source of
disagreement between the PDF path and the Word path. The ladder therefore serves
two purposes at once, exhibiting each level's type style and probing the collapsed
gaps between adjacent levels.

### Level three, reached through prose {#sec:ladder-three}

A third-level heading carries less weight than its parent but must still read as a
signpost rather than as emphasised body text. The paragraph beneath it, this one,
exists so that the gap from heading to first line of text can be measured against
the same gap at other levels.

#### Level four, immediately after this line ends
##### Level five, in direct contact with level four

The two headings above sit in direct contact, with no text between them. Level four
is the deepest level that still behaves as a true structural division; level five
and level six, by convention, mark named paragraphs rather than sections, and the
corpus expects them to be set close to body size.

###### Level six, the floor of the hierarchy

There is nothing below the sixth level. A document that needs finer division than
this has outgrown headings and should use lists or tables instead. With the floor
reached, the ladder is complete, and the reader can confirm against [#sec:scope]
that every promise made about it in the statement of scope has been kept.

## Referencing between sections {#sec:xref}

A cross-reference in this dialect is written as a bracketed label and resolves to
the number or the text of the section it points at. The important property is that
resolution is independent of direction. This paragraph demonstrates the backward
case three times over: the opening of the report is [#sec:top], the statement of
scope is [#sec:scope], and the ladder just climbed down is [#sec:ladder]. Each of
those targets sits earlier in the file than this sentence.

The forward case matters just as much, because authors habitually announce material
before writing it. The remainder of this report does exactly that: the next major
division, [#sec:pagetop], opens at the top of a fresh page; within it,
[#sec:ladder-three] has already shown that labels attach at the third level as
readily as at the first; and the closing discussion in [#sec:wrapping] takes up the
typography of headings too long for a single line. All three of those references
were written before their targets existed, and all three must nevertheless resolve.

Labels themselves deserve a word. A label is attached by writing it in braces at
the end of the heading line, and it wins over the automatic slug derived from the
heading's words. The practical consequence is freedom to reword: the heading of
the previous section could be rewritten entirely, and every reference to it in
this report would continue to point at the right place, because the references
name the label and not the words.

The remaining paragraphs of this section are padding, and they say so plainly.
Their job is to push the following page break far enough down the file that the
material before it fills its pages at a natural density, so that the heading after
the break genuinely opens a page rather than merely following a mostly empty one.
Padding in a corpus document is honest work: page-boundary behaviour cannot be
tested without documents long enough to have page boundaries.

The first consideration when padding a specimen is rhythm. Paragraphs of roughly
equal length produce a steady grey texture on the page, and against that steady
texture any irregularity of spacing, a doubled gap above a heading, a short page,
an orphaned line, stands out immediately to a reviewing eye. For that reason these
paragraphs are kept between four and six lines each, close to the length of the
substantive paragraphs above them.

The second consideration is content. Padding that is visibly nonsense invites the
reviewer to stop reading, and a reviewer who has stopped reading no longer notices
faults. These paragraphs therefore continue to talk, at modest depth, about the
craft of building a corpus: it is the one subject guaranteed to be relevant in a
corpus document, and it costs nothing in determinism.

The third consideration is placement. Padding belongs immediately before the
constructs it positions, so that a future editor who trims or extends it can see
at a glance which page boundary it governs. The padding now ending governs the
break that follows this very paragraph, and the heading beyond that break is the
one this report promised, in [#sec:xref], would open a page.

[pagebreak]

# A section that opens at the top of a page {#sec:pagetop}

This first-level heading is the first ink on its page. That position is the hardest
one for heading spacing rules: the generous space normally reserved above a
first-level heading must be suppressed when nothing sits above it, or the heading
appears to float a third of the way down an otherwise blank page. The paragraph you
are reading exists to give the heading a normal following gap for comparison.

Opening a page with a major division is not an artificial situation. Long reports
break naturally at chapter boundaries, and authors force the situation daily with
explicit page breaks before appendices, bibliographies, and signature pages. The
corpus therefore treats the page-top heading as a first-class case rather than as
an accident of pagination, and this document pins it in place with an explicit
break so that the captured pages show it on every build, in every theme, at every
margin setting the matrix exercises.

## A deliberately long subsection heading, the kind a cautious author writes when a short title would be ambiguous and an abbreviation would be worse {#sec:wrapping}

The heading above is long enough to wrap onto a second line at any of the page and
margin combinations the corpus exercises, and at the narrower settings it may reach
a third. Wrapped headings put pressure on three rules at once: line spacing within
the heading, which must be tighter than body leading but not cramped; alignment of
the wrapped lines, which must be consistent between the two export paths; and the
keep rule that forbids a page break inside the heading itself.

A long heading also stresses the contents page of any document that carries one,
since the entry must either wrap or truncate in the narrow measure between the
section number and the page number. This document carries no contents page, and so
leaves that half of the problem to its companion specimen; the reference trail for
the present half runs back through [#sec:pagetop] to the ladder in [#sec:ladder],
completing the circle of references promised at the outset.

## Closing summary {#sec:closing}

The conventions recorded here are few and firm. Use all six levels only when the
material demands them, and descend one level at a time, as the ladder in
[#sec:ladder] does. Label every heading that anything refers to, at whatever level
it sits; [#sec:ladder-three] shows the practice working three levels down. Write
references freely in both directions and trust resolution to the engine, as
[#sec:xref] demonstrates. Force a page break rather than gamble on pagination when
a division must open a page, as [#sec:pagetop] does. And when a heading must be
long, let it wrap, as the title of [#sec:wrapping] finally did.

A specimen that follows its own rules is the cheapest kind of regression test: it
fails visibly. If any future build sets this document with a floating page-top
heading, a doubled gap in the ladder, or an unresolved reference in this closing
paragraph, the captured pages will disagree, and the disagreement will point, with
unusual precision, at the rule that broke.
