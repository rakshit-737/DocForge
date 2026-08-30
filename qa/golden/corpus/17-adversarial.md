# Plain-Text Fidelity Audit

This report records the results of a fidelity audit performed on the composition engine's
handling of prose that merely resembles markup. A converter that typesets what an author
wrote is only trustworthy if it also declines to typeset what the author did not write:
punctuation that happens to look like a formatting mark, quoted code that looks like live
markup, and reference syntax pointing at entries that were never defined. Every passage in
this document sits on one of those boundaries, and every one of them must come out of the
engine as literal text, with no styling applied and no errors raised.

The material is organised by failure family. Escaped punctuation comes first, because the
backslash is the mechanism an author reaches for when a mark must appear on the page as a
character. Collisions between programming operators and inline marks follow, then quoted
markup fragments, dangling references, currency amounts, addresses, and sparsely populated
tables. A short findings section closes the report.

## Escaped punctuation

A house style guide frequently needs to talk about the marks themselves. The escaped forms
\*asterisk\*, \_underscore\_, \~tilde\~ and \[bracket\] must each print as their literal
characters with nothing wrapped around them: no emphasis, no subscript, no link detection.

Doubled marks have the same escape hatch. Writing \==review pending== with a leading
backslash keeps the pair inert, and \++insert here++ behaves the same way, so a manual can
quote the highlighter and underline notation without invoking either. In both cases the
page must show the doubled characters exactly as the author typed them.

## Operator collisions

Source code discussed in running prose is the classic collision. The counters i++ and j++
increment on every pass through the loop, and the guard retries==0 and state==idle places
two comparisons on a single line without either pair fusing into a highlight. Neither
sentence may carry any formatting at all.

A lone doubled asterisk ** survives as typed, and a spaced equality such as a == b reads
as a comparison rather than the start of a mark. The same holds at the end of a clause,
where an increment written bare as total++ closes the sentence.

Approximate figures such as ~40 boxes or ~15 percent of the backlog keep their tildes, a
doubled tilde ~~ left unclosed stays visible, and a caret used as an insertion mark ^
stands alone in its sentence without becoming a superscript.

## Quoted markup

The legacy pipeline stored fragments of markup inside its export notes, and those
fragments must be quoted, never executed. As inline code, the fragment
`<script>window.alert("probe")</script>` is displayed in the code face with its angle
brackets intact. Written with character entities the same tag reads
&lt;script src="tracker.js" defer&gt; and remains ordinary visible text. Written with
backslash escapes it collapses to the bare name \<script\> and is equally inert. None of
the three forms may reach the page as live markup.

Ampersands travel the same road. The joint filing by Harper & Finch, the R&D cost ledger,
and a literal entity written as &amp; in the source must all print a single ampersand.
Comparisons keep their angle brackets when spaced: throughput stayed above 900 requests
per second while latency remained < 20 ms, and the error rate rose > 2 percent only once
in the whole review period.

## Dangling references

Reference plumbing must fail loudly and locally, never silently. The ledger cites
[@nonexistent], a key that no register in this document defines, and the engine prints the
key itself with a question mark rather than inventing a number for it. A cross-reference
to the withdrawn appendix [#sec:missing] resolves to a visible placeholder instead of a
live label. A footnote call [^99] with no matching definition anywhere in the document
remains exactly the characters the author typed, and joins no footnote sequence.

A bracketed phrase trailed by an unknown attribute list, such as [draft copy]{approved},
matches no rule in the dialect and is printed verbatim, braces and all. The same is true
of a plain bracketed aside [held for review] that never acquires a target.

## Currency and addresses

Money is the oldest mathematics lookalike. A seat on the reading-room plan costs $5 and
$10 for the annex, the archival tier is priced between $20 and $180 per year, and none of
these amounts may be typeset as an equation or dropped from the line. The audit also
checked a sentence in which a single amount of $95 appears with no partner anywhere near
it, which is the shape most likely to leave a delimiter searching for a mate.

Addresses with underscores are the other classic. The archived handbook lives at
[the operations handbook](https://example.com/docs/user_guide/operations_handbook.html)
and the raw address https://status.example.com/service_health/uptime_report must print as
a working link without any of its underscores turning into italics.

## Sparse tables

Quarterly ledgers arrive with holes in them, and the holes are data. The table below
leaves cells empty on purpose: a blank quarter is a true statement about that quarter, and
the grid must hold its shape around every gap in both output formats.

| Ledger line | Q1 | Q2 | Q3 | Remarks |
| :--- | ---: | ---: | ---: | :--- |
| Acquisitions | 14 | 9 | | carried into the following quarter |
| Conservation | | 6 | 11 | |
| Deaccessions | | | | no activity recorded |
| Outreach | 3 | | 5 | figures provisional |

Every empty cell above must render at full cell width with its row borders unbroken, and
the column alignment declared in the header row must survive the gaps.

## Findings

All of the passages above rendered as literal text in the review build. No stray emphasis
appeared, no accidental highlight or underline, no phantom subscript or superscript, and
no quoted markup reached the page in live form. The dangling citation, cross-reference and
footnote each failed in place with a visible, local marker, and the sparse table kept its
geometry in both the paged output and the exported document.

The audit therefore records a pass, with one standing instruction for future revisions of
the engine. Every new inline mark added to the dialect must arrive with a matching entry
in this document, written first in its escaped form and then in its most plausible
collision with ordinary prose, so that the golden baseline fails on the day a lookalike
first starts to trigger rather than in the hands of an author.
