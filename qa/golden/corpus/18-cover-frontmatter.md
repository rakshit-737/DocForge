[toc]

# Purpose and configuration {#sec:purpose}

This brief accompanies the cover-sheet verification exercise for the reading-room report
series. Its body is deliberately plain, because the object under test is not the prose but
the page in front of it: the cover that the application composes from its document
settings when the cover option is switched on.

Six fields feed that cover, and none of them is written in this manuscript. The title, the
subtitle, the author line, the kicker above the title, the extra metadata line and the
date are all entered through the settings panel and stored with the project, so the source
you are reading contains no front-matter block of any kind. This is a deliberate property
of the dialect: the manuscript carries content, the settings carry identity, and the two
can be recombined freely. A reviewer who opens the raw source of this file should find
that it begins with the contents marker and a heading, and nothing else before them.

For this exercise the fields were fixed to known values before rendering. The title names
the verification series, the subtitle states the scope in one sentence, the author line
carries the reviewing archivist, the kicker names the programme, the extra line records
the file reference, and the date was pinned to 2025-03-31 so that repeated renders of this
document produce an identical cover. The engine formats that pinned value in full, so the
cover should read 31 March 2025, with the month spelled out rather than numbered.

The same profile drives the running furniture behind the cover. The header line repeats
the pinned title in small capitals on every body page, which means a change to the title
field must show up in two places at once, and a mismatch between them is the fastest
possible signal that a stale render slipped into the review pack.

The contents listing that opens this body is part of the same test. With a cover in place
the front matter and the body run as two separate page sequences, and the listing must
show both of the labelled sections of this brief with page numbers drawn from the body
sequence rather than from the sequence that numbers the cover and the contents page.

# Verification checklist {#sec:checks}

The checks in this section assume the configuration described in [#sec:purpose] and are
meant to be read against the rendered pages, cover first.

- The cover page carries no header and no page number, and its fields appear in the
  expected order: kicker, title, subtitle, then the author, extra and date lines.
- The date on the cover is spelled out in full, reads 31 March 2025, and matches on every
  repeated render of the same project file.
- The contents listing shows exactly two entries, one for each labelled section of this
  brief, and each entry's page number agrees with the page on which the section begins.
- The cross-reference in the opening line of this section resolves to the first section
  rather than to a placeholder.

A failure against any point above is a cover or front-matter defect, not a manuscript
defect, because the manuscript by construction contains nothing that could cause it. That
separation is the point of the exercise: when this same source is rendered under a
different settings profile, only the cover and the running furniture may change, while the
body text, its labels and its listing must remain untouched.
