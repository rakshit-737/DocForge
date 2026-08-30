# Pagination Protocol for Controlled Documents {#sec:protocol}

This report sets out the pagination protocol that controlled documents in the
golden corpus follow: where the contents page sits, which heading levels it lists,
and when an explicit page break is preferred over trusting the layout engine's own
pagination. Like every specimen in the corpus, the report obeys its own protocol,
so its captured pages are the evidence for its claims. The contents listing
appears directly below this introduction, and the attentive reader will notice
that the listing includes the title of the report itself: a contents page in this
dialect gathers every qualifying heading in the document, wherever the listing is
placed, and the corpus records that behaviour deliberately rather than working
around it.

[toc]

The listing above is generated, not written. Each entry carries the heading text
on the left, the page number on the right, and a row of dotted leaders between
them, so that the eye can travel across the full measure without losing the line.
Entries are indented by heading level, first-level divisions flush left and deeper
levels stepped inward, which turns the listing into a miniature of the document's
whole structure. Because the numbers in the listing are real page numbers, the
contents page is itself a regression test: any change anywhere in the engine that
moves a section onto a different page changes the listing too, and the captured
pages then disagree in two places at once.

One rule of the protocol is visible only by absence. The listing stops at the
third heading level. Fourth, fifth, and sixth level headings, which the next
section uses in earnest, mark named paragraphs rather than sections, and admitting
them to the contents would double its length while telling the reader nothing
about where to turn. This report exercises all six levels precisely so that the
captured contents page can prove that the deeper three are excluded.

## The depth of the outline {#sec:depth}

The protocol admits six levels of heading but treats them as two families. Levels
one through three are structural: they appear in the contents listing, they take
most cross-references, and they justify spending vertical space. Levels four
through six are local: they name a paragraph or a small cluster of paragraphs,
they are set close to body size, and they are deliberately absent from the listing
at the front of this report. The subsection below sits at the third level, the
last level the listing admits, and the material under it descends through the
local family so that the captured pages show the whole ladder in use.

### The last level the listing admits {#sec:families}

This third-level heading should appear in the contents listing as its most deeply
indented kind of entry. Nothing below it in this section will appear there at all,
and that pairing, an included heading directly above three excluded ones, is the
sharpest form of the boundary the corpus can freeze.

#### Recording assumptions at level four

A fourth-level heading earns its place when a run of paragraphs needs a name but
not an entry in the contents. Assumptions, worked examples, and side conditions
are the usual tenants. The reader who checks the listing against this page will
find no trace of this heading there, which is exactly what the protocol
prescribes.

##### Qualifying a single claim at level five
###### The floor, level six, in direct contact

The two headings above sit in direct contact with no text between them, the
deepest such stack the dialect allows. Below the sixth level there is nothing; a
document that wants finer division must reach for lists instead. All three local
levels have now appeared, none of them in the listing, while every structural
heading above them is recorded there with its page number, which settles the
boundary between the families as a matter of captured record.

[pagebreak]

# The case for explicit breaks {#sec:breaks}

This first-level heading opens its page because an explicit break precedes it. The
rationale is stability. Left to itself, pagination is a global computation: a
single added line on an early page can ripple forward and move every boundary
after it. An explicit break is a firewall against that ripple. Material before the
break may shuffle within its own pages, but the division after the break opens its
page on every build, in every theme, at every margin setting the corpus matrix
exercises. The cost of a break is the partly filled page it leaves behind, and the
protocol accepts that cost only at the first level.

## Where natural breaks are allowed {#sec:natural}

Within a division, the engine breaks pages where the material forces it to,
subject to the keep rules: a heading is never stranded at the foot of a page, and
the opening lines of a paragraph are not separated from the rest of it. The
boundaries that are not pinned must still be crossed somewhere, which is why a
corpus document carries padding prose at realistic densities; the padding in this
report is the prose you are reading now, and it declares itself plainly rather
than pretending to be substance.

Natural breaks have one property pinned breaks lack: they move when the theme
moves. A wider margin preset shortens the page's line count; a larger base size
does the same; a different body face changes the line heights outright. The corpus
captures this document across the full matrix, and the natural breaks are expected
to differ between cells of that matrix while the pinned breaks agree in all of
them. A pinned break that drifts between themes is a defect; a natural break that
refuses to drift is suspicious in the opposite direction.

## Consecutive divisions under pinned breaks {#sec:consecutive}

The protocol's hardest test is a run of short first-level divisions, each pinned
to its own page. Certificates, declarations, and signature pages take this shape
in real controlled documents: a page carrying a heading, a paragraph or two, and
nothing else, followed immediately by another of the same. The two divisions that
close this report reproduce the shape exactly. Each opens at the top of its page,
each is far shorter than the page it occupies, and the second follows the first
with nothing between them but the break itself.

The risk this pattern probes is doubled space. A pinned break followed by a
first-level heading stacks two vertical allowances, the space after the break and
the space above the heading, and the layout must suppress the second when the
heading is the first ink on its page. Consecutive short divisions make any failure
of that suppression obvious, because their headings land at identical page
positions and the eye compares them instantly. The certificates begin overleaf;
the closing note in [#sec:closing], further on, will confirm what they were for.

[pagebreak]

# Certificate of review {#sec:review}

This division certifies that the specimen was reviewed against the protocol it
records: the listing on the first page was read against the body, entry by entry,
and the body was read against the listing. Its text is intentionally a single
short paragraph, leaving the rest of the page empty. The emptiness is part of the
specimen, because the partly filled page after a pinned break is a shape the
baseline must freeze as deliberately as any full one.

[pagebreak]

# Certificate of approval {#sec:approval}

This division certifies that the captured pages of this specimen were approved as
the golden baseline. It is the second of the two consecutive short divisions
promised in [#sec:consecutive], and its heading must sit at exactly the page
position where the heading of [#sec:review] sits one leaf earlier.

## Closing note {#sec:closing}

A pagination protocol is easy to state and easy to break, which is why this
specimen exists. The contents listing froze the outline and its page numbers,
dotted leaders and all; the pinned breaks froze three page-top headings, two of
them in consecutive short divisions; the padded prose in [#sec:natural] let the
natural breaks fall where the engine put them; and the descent through
[#sec:depth] proved the listing's third-level floor. If a future build disagrees
with any of it, the disagreement will surface in the captured pages twice, once
where the layout changed and once in the listing that records it, and a defect
that reports its own page number is the most convenient kind there is.
