:::center
[**Northfield College of Engineering, Ashcombe**]{size=15}

Department of Structural Materials
:::

---

:::center
[**SME-4412**]{size=11 caps}

[**Fatigue in Welded Joints**]{size=22}

*Practical record 3 · Bench experiment*
:::

:::banner
Cyclic Loading of Fillet Welds

Specimen preparation · Load programme · Crack initiation counts
:::

| Particulars | Details |
| --- | --- |
| **Candidate** | R. Halloran |
| **Enrolment Number** | 21SM4412 |
| **Course Code & Title** | SME-4412 — Fatigue and Fracture |
| **Supervisor** | Dr. A. Venn |
| **Date of Submission** | 14 March 2026 |

[pagebreak]

# The plate as a page element

The plate above is ordinary document content, set as a filled band the full width of the
text block. Its first line is the subject of the document, set large; every line after it
is subordinate and prints small in the accent tint. The fill is a fixed deep slate rather
than a tint of the accent, so a plate reads the same under a burnt-orange accent as under
a navy one, and the accent survives where it does the most work — in the lines beneath the
title, and in the rules under the section headings.

A plate carrying only one line is a legitimate use, and prints as a single large line with
no subordinate matter beneath it:

:::banner
One Line, Nothing Under It
:::

A plate may equally carry several subordinate lines, which set as a small block under the
title. Where a submission needs the examiner to see the scope before the prose begins,
this is the place to put it:

:::banner
Three Subordinate Lines

Prepared for the March examination board

Supersedes the record submitted in January

Raw measurements are held in the departmental archive
:::

# Marks inside the plate

Everything that works in body text works inside the plate. The title line may carry
**bold**, *italic* and `fixed type`; the subordinate lines may carry ==a highlight==,
++a rule++, ~~a withdrawal~~, and the sub~script~ and super^script^ marks that a
materials record cannot do without:

:::banner
Specimen **A-14**, *as welded*, gauge `12.7 mm`

Loaded to 0.6 σ~y~ · 10^6^ cycles · ==reference specimen== · ++not to be reground++
:::

An attribute span overrides the plate's own colour and size, which is how a plate carries
a warning line without a callout:

:::banner
Batch 7 — Withdrawn

[Do not report these figures]{color=#ffb4a2 size=12}
:::

A citation call inside a plate resolves against the same reference list as the body
does,[@astm2019] and a footnote call placed there lands at the foot of the page the plate
prints on.[^plate]

[^plate]: Footnote raised from inside the plate, to confirm the note travels out of the
band and onto the page foot rather than being swallowed by it.

# The plate among other block matter

A plate immediately after a heading, with no paragraph between, must keep the heading
attached to it rather than stranding the heading at the foot of a page:

## Load programme

:::banner
Programme R2

Constant amplitude · 8 Hz · room temperature · air
:::

Between two plates with nothing in between, the spacing must not collapse:

:::banner
First of a Pair
:::

:::banner
Second of a Pair
:::

A plate sitting between a table and a figure keeps its own margins against both:

[table: Load steps in programme R2 | #tbl-steps]
| Step | Cycles | Amplitude | Note |
| --- | ---: | ---: | --- |
| 1 | 100000 | 0.4 σ~y~ | Run-in |
| 2 | 400000 | 0.6 σ~y~ | Reported |
| 3 | 500000 | 0.7 σ~y~ | To failure |

:::banner
Crack Initiation Observed at Step 3
:::

[screenshot: Fracture surface of specimen A-14 at 20× | #fig-fracture]

The steps in [#tbl-steps] and the surface in [#fig-fracture] are quoted from the record
above without restating their numbers.

# The plate inside other containers

A plate inside a callout takes the callout's width, not the page's:

:::note Scope of the record
This record covers programme R2 only. The plate below names the programme it does cover,
so a page photocopied out of context still identifies itself.

:::banner
Programme R2 Only
:::

Programmes R1 and R3 are recorded separately and are not comparable — the specimen
geometry changed between them.
:::

A plate inside an alignment block is unaffected by the alignment, because a plate centres
its own contents in every case:

:::right
The line before the plate is ranged right.

:::banner
The Plate Centres Regardless
:::
:::

A plate inside a justified block likewise keeps its own centring, while the prose around
it stays justified:

:::justify
The paragraph before the plate is justified, and remains so regardless of the
document-wide setting, because an explicit alignment block overrides it for everything
inside except the plate, which is centred by its own definition and not by inheritance.

:::banner
Centred Inside a Justified Block
:::

The paragraph after the plate is justified for the same reason, and the plate between
them must not have leaked its centring into either of them.
:::

# Closing

The record closes on the reference the plate cited, so the list is not empty.

[references]

[@astm2019]: ASTM International, *E1049 — Standard Practices for Cycle Counting in
Fatigue Analysis*, ASTM International, 2019.
