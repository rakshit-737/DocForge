[toc]

# Introduction and scope

This document exists to break the layout engine. Every paragraph, table and callout below is
chosen to sit on a fault line: a page boundary, a nesting limit, or a place where the PDF path
and the Word path have historically disagreed.

Ordinary running prose comes first, so that the baseline rhythm is visible against the headings
that follow. A second paragraph establishes what a normal spacing gap looks like, which makes any
inconsistency further down the document obvious by comparison. A third paragraph pads this section
far enough that the first heading below lands mid-page rather than at a page top.

## A subsection immediately after its parent

Two headings in a row with no prose between them is a common real-world shape and a common source
of doubled vertical space.

### A third level, also immediate

Text finally appears at the third level. This checks that the h2 → h3 gap does not collapse
differently from the h1 → h2 gap.

#### A fourth level heading

Level four is italic in the current design and is excluded from the table of contents.

## Inline typography

Body copy with **bold**, *italic*, ***bold italic***, `inline code`, ~~struck through~~ text and a
[hyperlink to an external site](https://example.com/a/fairly/long/path/for/wrapping). Ranges such
as 1990-2020 and pages 14-18 should read as en dashes. Units want a non-breaking space: 10 kg,
25 mm, 60 %. A reference to Figure 1 and to Section 2 should not break across a line either.

Straight quotes "like these" and an apostrophe in don't want to be curly in a typeset document.

## A long table that must cross a page boundary

| # | Component | Owner | Status | Duration | Notes on the current state of the work |
| --- | --- | --- | --- | --- | --- |
| 1 | Ingest service | Platform | Done | 3 d | Stable since the last release |
| 2 | Normaliser | Platform | Done | 5 d | Handles the three legacy formats |
| 3 | Scheduler | Core | In progress | 8 d | Blocked on the queue migration |
| 4 | Queue migration | Core | In progress | 12 d | Depends on the new broker |
| 5 | Broker rollout | Infra | Planned | 6 d | Waiting on capacity approval |
| 6 | Metrics pipeline | Data | Done | 4 d | Dashboards published |
| 7 | Alert rules | Data | In progress | 2 d | Thresholds under review |
| 8 | Retention policy | Data | Planned | 3 d | Legal review outstanding |
| 9 | Access control | Security | Done | 7 d | Audited in March |
| 10 | Secrets rotation | Security | Planned | 4 d | Tooling selected |
| 11 | Backup verification | Infra | In progress | 5 d | Restore drill scheduled |
| 12 | Disaster recovery | Infra | Planned | 10 d | Runbook drafted |
| 13 | Load testing | QA | Planned | 6 d | Awaiting a staging environment |
| 14 | Soak testing | QA | Planned | 9 d | Follows load testing |
| 15 | Documentation | Docs | In progress | 5 d | Half the pages are drafted |
| 16 | Training material | Docs | Planned | 4 d | Outline agreed |
| 17 | Support handover | Support | Planned | 2 d | Needs the runbook |
| 18 | Launch checklist | Programme | Planned | 1 d | Owner not yet assigned |
| 19 | Post-launch review | Programme | Planned | 2 d | Date to be confirmed |
| 20 | Decommission legacy | Platform | Planned | 8 d | Final step of the programme |

The table above is deliberately long enough to break across at least one page. Its header row must
repeat on every page it occupies, in both the PDF and the Word file.

# Callouts, including awkward contents

:::note A plain note
A single paragraph of note text, which is the common case and should look identical in both
outputs.
:::

:::tip A tip containing a list
Before starting, confirm each of the following:

- The first precondition, which is somewhat long so that it wraps onto a second line in the
  narrower measure that a callout imposes
- The second precondition
- The third precondition, with a nested list beneath it:
  - A nested item
  - Another nested item
:::

:::warning A warning containing a table
| Risk | Likelihood | Impact |
| --- | --- | --- |
| Capacity shortfall | Medium | High |
| Schedule slip | High | Medium |
:::

:::important A callout containing a code block
```
function verify(input) {
  if (!input) throw new Error("empty");
  return normalise(input);
}
```
:::

# Code, quotes and rules

A fenced block long enough to test whether it survives a page boundary:

```
export function paginate(nodes, pageHeight) {
  const pages = [];
  let current = [];
  let used = 0;
  for (const node of nodes) {
    const h = measure(node);
    if (used + h > pageHeight && current.length) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(node);
    used += h;
  }
  if (current.length) pages.push(current);
  return pages;
}
```

> A block quotation of a single paragraph, which is the shape the Word exporter has historically
> handled correctly.

> A quotation whose second paragraph follows a blank line.
>
> This second paragraph is the shape that has historically been dropped.

---

# Lists at depth

1. First ordered item
2. Second ordered item, with children:
   1. A nested ordered item
   2. Another nested ordered item, with its own children:
      - A bulleted grandchild
      - Another bulleted grandchild
3. Third ordered item

- A bullet
- A bullet with a long line that will certainly wrap onto a second line, so that the hanging indent
  of the wrapped line can be compared between the two output formats
- A bullet with children:
  1. An ordered grandchild
  2. Another ordered grandchild

# Figures near a page boundary

Prose immediately before a figure, positioned so that the figure box is likely to fall across a
page break and be pushed to the following page.

[screenshot: A placeholder positioned near a page boundary]

Prose immediately after the figure, which must not be separated from the caption above it by an
unreasonable amount of white space.

[screenshot: A second placeholder, to check that figure numbering increments]

# A section forced onto a new page

[pagebreak]

This section begins after an explicit page break.

## Deeply padded content to lengthen the table of contents

Padding prose so that the document reaches a length where the table of contents has real work to do
and the page numbers in it are non-trivial.

### Sub-heading one
Prose.

### Sub-heading two
Prose.

### Sub-heading three
Prose.

## A second padded subsection

More padding prose.

### Sub-heading four
Prose.

### Sub-heading five
Prose.

# Conclusion

The final section, which exists so that the last page is partially filled rather than exactly full.

# Footnotes

A claim that needs support[^src] and a second claim later in the same paragraph[^method] so that
two calls land close together. A third call sits further down the section[^caveat] to check that
notes follow their calls across a page boundary rather than collecting at the end.

[^src]: Author, *Title of the source*, Publisher, 2024, pp. 14-18.
[^method]: The measurement was repeated three times and the median reported.
[^caveat]: This does not hold when the input is empty.

# References and numbering {#sec:refs}

[table: Cost breakdown by phase | #tbl:costs]

| Phase | Effort | Cost |
| :--- | ---: | ---: |
| Discovery | 12 d | 4,800 |
| Build | 34 d | 13,600 |
| Handover | 6 d | 2,400 |

Prose that refers back to [#tbl:costs] and forward to [#fig:wide], and cites the section
[#sec:refs] itself. A reference to something that does not exist [#fig:nope] should be obvious.

[screenshot: A deliberately narrow figure | w:45% | #fig:wide]

[lof]

[lot]
