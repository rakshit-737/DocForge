# Documentation Standards Board: Findings of the Autumn Review

The board convened to review the house style for technical publications against two
seasons of authoring experience. This report records the findings, the correspondence
that prompted them, and the resolutions adopted. Resolutions continue the numbering of
the spring series, so the first resolution recorded below is numbered twelve.

## Structure of the findings

Findings are grouped by the part of the style they touch. Each finding lists its
evidence in nested form: the observation, the documents exhibiting it, and the specific
passages within each document.

1. Terminology drift across the reference set:
   1. The installation guide and the API reference disagree on the product name:
      - the guide writes it as two words throughout
      - the reference hyphenates it in headings only:
        - chapter openers hyphenate
        - running text does not
   2. The glossary defines neither form
2. Inconsistent depth of procedure numbering:
   1. Procedures in the operations manual stop at two levels
   2. Procedures in the recovery runbook reach four:
      1. the fourth level appears only in the failover section
      2. reviewers report it as the hardest passage to follow:
         - two of three reviewers lost their place at least once
         - one reviewer annotated the margin with her own numbering
3. Quotation style unsettled between publications

The first two findings above form one list, deliberately deep, so that the printed
hanging indents can be compared level against level down the page.

## The correspondence

The review was prompted by a letter from the operations training lead:

> The runbook is the only document our crews take into the field, and it is the only
> one they annotate by hand. Whatever the board decides about numbering depth, decide
> it for the runbook first.
>
> We do not ask for a shallower runbook. We ask for one whose numbering a tired reader
> can hold in mind at three in the morning.

The technical publications manager replied, quoting the letter in turn:

> The training lead writes:
>
> > We do not ask for a shallower runbook. We ask for one whose numbering a tired
> > reader can hold in mind at three in the morning.
>
> This is the correct framing. Depth is not the defect; unannounced depth is. A reader
> who is told the shape of a procedure before entering it follows four levels as
> readily as two.

One reply enclosed a checklist, which arrived as a list inside the quotation and is
reproduced here in that form:

> Before the board rules on depth, the working group asks that each member reread:
>
> - the failover section of the recovery runbook
> - the two-level rewrite of the same section, circulated in draft:
>   1. first as a cold read, without the original to hand
>   2. then side by side with the original
> - the reviewer annotations, which travel with the draft

---

## Resolutions of the autumn series

Resolutions continue from the spring series, which closed at eleven.

12. The product name is written as two words in all positions, headings included.
13. Procedure numbering is limited to three levels in all publications; the recovery
    runbook receives an exemption for the failover section only, to be reviewed when
    that section is next rewritten.
14. Quotations from correspondence are set as block quotations, never run into the
    paragraph, and nested quotation is limited to one level in print.

The exemption in resolution thirteen was not unanimous, and the dissent is recorded in
the appendix to the minutes.

***

## Tight and loose settings

The board also ruled on list spacing, and this section exhibits both settings that the
ruling names. A run of short items is set tight, with no space between entries:

- masts
- looms
- enclosures
- consoles

A run of items that carry full sentences is set loose, each entry spaced from its
neighbours and set as a paragraph:

- The parts list travels with the crate, and the crate label names the site rather
  than the customer.

- The survey sheet travels with the engineer, and its figures take precedence over any
  figure stamped on a component.

- The service record stays at the depot, and it alone carries the bulletin address.

An entry in a loose list may run to a second paragraph when the ruling it records
needs a qualification:

- Bulletin numbering restarts each year, prefixed with the year of issue.

  A bulletin that supersedes another names it by full number, so a crew holding only
  the newer bulletin knows that a page of its own copy is stale.

- The annual revision consolidates all bulletins of its year and closes the series.

## Ordered matter at depth, across the page

The consolidated style rules are restated below in full nested form. The list is long
enough that it will cross a page break, which is the behaviour under test: the hanging
indent of every level must survive the break, and the numbering must continue without
a restart on the new page.

1. Names and terms:
   1. Product names follow the two-word form in every position
   2. Unit names are spelled out at first use in a chapter:
      - abbreviations follow in parentheses at that first use
      - abbreviations stand alone thereafter
   3. The glossary carries every term used in more than one publication
2. Procedures:
   1. A procedure opens with a sentence naming its outcome
   2. Numbering runs to three levels:
      1. the first level names stages
      2. the second names actions
      3. the third names checks, and checks are always the last items of their stage
   3. A procedure closes with its verification step, unnumbered
3. Quotation:
   1. Correspondence is quoted in block form
   2. One level of nesting is permitted in print:
      - deeper nesting is flattened by the editor
      - the flattening is recorded in the minutes of the next review
4. Rules, dividers and set matter:
   1. A horizontal rule separates resolution series from findings
   2. A rule never appears twice on one page except in the appendix
5. Review cadence:
   1. The style is reviewed each spring and autumn
   2. A finding left open for two consecutive reviews is escalated to the board chair

---

## Closing note

The board thanks the reviewers who annotated the failover drafts; their margins were
the most persuasive document before the review. The winter interim will test the
three-level rule in the runbook reprint, and the spring session opens with finding
three, quotation style, which this review leaves deliberately unsettled.
