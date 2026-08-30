# Meridian Platform Capacity Review

This review consolidates the storage, throughput and reliability figures for the Meridian data
platform as they stood at the close of the first quarter of the 2025 reporting year. It is
written for the platform steering group, and it follows the conventions agreed at the previous
review: every table is captioned and numbered, every claim that rests on a figure cites the
table that carries it, and the quarter's operational ledger is reproduced without abridgement
so that the summary can be audited against its source.

The tables are listed below for convenience. Each entry carries the number the table takes in
the body of the report, in order of appearance.

[lot]

## Summary of holdings

The platform stores four classes of data, and the balance between them has shifted noticeably
since the previous review. [#tbl:holdings] gives the headline figures. The class names are left
aligned because they are labels; the volumes are right aligned so that magnitudes can be
compared down the column at a glance. It is deliberately the narrowest table in the report:
two columns, sized to their content, so that the renderer's treatment of a table much slimmer
than the measure is on record beside its widest sibling later on.

[table: Stored volume by data class, in terabytes | #tbl:holdings]

| Data class | Volume |
| :--- | ---: |
| Transactional | 412 |
| Analytical | 1,286 |
| Archival | 3,970 |
| Operational | 88 |

Two observations follow from [#tbl:holdings]. First, archival data now accounts for more than
two thirds of the estate, which strengthens the case for the colder storage tier deferred at
the last review. Second, the operational class remains small enough that its replication factor
can be raised at negligible cost, a change the reliability entries in [#tbl:ledger] argue for
independently. Both observations are taken up again in the findings that close the report.

## Column conventions

The steering group asked that the report demonstrate its own column conventions once,
explicitly, so that future editions can apply them uniformly. [#tbl:conventions] does exactly
that: its first column is left aligned, its second centred, its third right aligned, and its
fourth carries no alignment marker at all, showing what the renderer does when no preference
is stated. Labels read best ragged right, status flags sit naturally on a centre line, and
quantities align on their final digit.

[table: Column alignment conventions used throughout this report | #tbl:conventions]

| Left-aligned label | Centred flag | Right-aligned quantity | Unmarked column |
| :--- | :---: | ---: | --- |
| Ingest latency, ms | OK | 341 | sampled hourly |
| Replica lag, ms | WATCH | 1,204 | sampled hourly |
| Compaction debt, GB | OK | 87 | sampled daily |
| Queue depth, items | ALERT | 15,662 | sampled continuously |

## Annotation conventions

Table cells in this report carry the full inline repertoire, and the operations team used it
deliberately when annotating the raw ledger: a cell can hold emphasis, code, corrections,
highlights, chemical subscripts and unit superscripts without leaving the table.
[#tbl:annotations] records what each mark means wherever it appears in the ledger further on.

[table: Annotation marks applied to ledger entries | #tbl:annotations]

| Mark | Example in place | Meaning |
| :--- | :--- | :--- |
| Emphasis | a **critical** entry, an *advisory* one | severity assigned at triage |
| Code | the `compact --now` invocation | verbatim operator input |
| Strikethrough | a ~~superseded reading~~ | value replaced after recalibration |
| Highlight | ==pending sign-off== | awaiting the steering group |
| Named highlight | =={green}approved== | signed off since the draft circulated |
| Underline | the ++contractual++ threshold | bound by the service agreement |
| Subscript | the H~2~O loop, CO~2~ offsets | chemical and index notation |
| Superscript | volumes in m^3^, growth near 10^4^ rows | units and orders of magnitude |
| Link | the [operations runbook](https://example.com/meridian/runbook) | external procedure |
| Cross-reference | compare [#tbl:holdings] | points elsewhere in this report |

The conventions were applied by hand, which is why the review reproduces the ledger in full
rather than summarising it: a hand-applied convention is only trustworthy when the reader can
see every place it was used.

## The quarter's operational ledger

What follows is the part of the report the steering group asked to see unabridged. The ledger
records one row per operational window across the quarter, thirty windows in all, and it is
long by design: it must cross at least one page boundary, and when it does the header row is
required to repeat at the top of every page the table occupies, in the PDF and in the Word
export alike. A reader opening the report at any page of the ledger should never have to turn
back to learn what a column means.

[table: Operational ledger for the quarter, one row per window | #tbl:ledger]

| Window | Subsystem | Reading | Status | Annotated note |
| :--- | :--- | ---: | :---: | :--- |
| W01 | Ingest | 3,412 | OK | baseline window for the quarter |
| W02 | Ingest | 3,388 | OK | within one percent of baseline |
| W03 | Replication | 1,204 | WATCH | an *advisory* entry; lag rising slowly |
| W04 | Replication | 1,377 | WATCH | lag still rising; drill scheduled |
| W05 | Compaction | 87 | OK | debt cleared by the `compact --now` run |
| W06 | Ingest | 3,401 | OK | steady |
| W07 | Archive | 512 | OK | first archive window of the quarter |
| W08 | Archive | 540 | OK | growth consistent with [#tbl:holdings] |
| W09 | Ingest | 3,940 | WATCH | seasonal peak began here |
| W10 | Ingest | 4,105 | ALERT | a **critical** entry; peak exceeded plan |
| W11 | Ingest | 4,088 | ALERT | mitigation applied mid-window |
| W12 | Ingest | 3,610 | OK | recovery confirmed |
| W13 | Replication | 990 | OK | back under the ++contractual++ threshold |
| W14 | Compaction | 121 | OK | routine |
| W15 | Cooling | 18 | OK | H~2~O loop nominal all window |
| W16 | Cooling | 19 | OK | airflow steady at 240 m^3^ per hour |
| W17 | Archive | 566 | OK | routine |
| W18 | Archive | 590 | OK | routine |
| W19 | Ingest | 3,502 | OK | steady |
| W20 | Ingest | 3,477 | OK | steady |
| W21 | Replication | 1,010 | OK | ~~1,100~~ corrected after recalibration |
| W22 | Compaction | 95 | OK | routine |
| W23 | Ingest | 3,530 | OK | steady |
| W24 | Ingest | 3,519 | OK | steady |
| W25 | Archive | 601 | WATCH | ==pending sign-off== on the growth budget |
| W26 | Archive | 612 | WATCH | growth budget review continues |
| W27 | Ingest | 3,488 | OK | steady |
| W28 | Replication | 1,002 | OK | =={green}approved== after the lag review |
| W29 | Compaction | 78 | OK | lightest window of the quarter |
| W30 | Archive | 618 | OK | closing window; compare [#tbl:holdings] |

The ledger closes the case the summary opened: the two ALERT windows, W10 and W11, both belong
to the seasonal ingest peak, and the archive rows grow in step with the volumes reported in
[#tbl:holdings]. Nothing in the ledger contradicts the summary, which is the property this
review is required to demonstrate quarter after quarter.

## Breadth against the measure

Wide tables stress the measure rather than its length. [#tbl:matrix] carries eight columns so
that the renderer must divide the text column finely and still keep every header legible; the
release columns are centred because each holds a single short verdict, and the outer columns
revert to left alignment because they carry prose.

[table: Subsystem compatibility across the six supported releases | #tbl:matrix]

| Subsystem | R1 | R2 | R3 | R4 | R5 | R6 | Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| Ingest | yes | yes | yes | yes | yes | yes | fully compatible |
| Replication | no | yes | yes | yes | yes | yes | compatible from R2 |
| Compaction | no | no | yes | yes | yes | yes | compatible from R3 |
| Archive | no | no | no | yes | yes | yes | compatible from R4 |
| Cooling | yes | yes | yes | yes | yes | yes | independent of release |

One small table remains, and it is deliberately left uncaptioned: it takes no number, joins no
list, and cannot be cited from anywhere else in the report. The steering group keeps it as a
control, to confirm that a bare table stays bare while its captioned neighbours are numbered.

| Key | Value |
| :--- | ---: |
| Windows observed | 30 |
| Uptime, percent | 99.97 |

## Findings

Three findings close the review. First, the archival estate documented in [#tbl:holdings] and
tracked through the archive rows of [#tbl:ledger] has grown to the point where the colder tier
should be commissioned within the year. Second, the alignment and annotation conventions of
[#tbl:conventions] and [#tbl:annotations] were applied consistently for the first time, and
the audit behind [#tbl:matrix] found no release drift anywhere in the fleet. Third, the
uncaptioned control table above behaved as intended, leaving the numbered sequence of this
report at exactly five tables.
