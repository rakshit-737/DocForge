/* The template set — ported VERBATIM from src/js/main.js (the classic build's
   TEMPLATES table, stage 3). One house style, taken from a real submitted lab
   report: a title page built in the body (so the page border frames it and every
   line stays editable), a `:::banner` plate carrying the subject, a particulars
   table, then numbered sections with captioned tables and figures. `cover` stays
   off in the paged templates — the built-in cover is a different, cleaner design
   and can carry neither the plate nor the table. The letter and the blank page
   keep their own shapes.

   Templates are data only; applying one is the shell's job. The classic
   destructive-replace bug class (ledger I7) is designed out by contract:
   `resolveTemplate` hands back a complete document, and the shell snapshots the
   current {source, settings, attachments} BEFORE calling replaceDocument, then
   offers an undo toast. */
import { defaultSettings, type Settings, todayISO } from "./settings";

export interface TemplateDef {
  label: string;
  desc: string;
  patch: Partial<Settings>;
  source: string;
}

/* Every paged template opens on the same title page. Only the wording changes, so
   it lives here once: `org` the institution or company, `unit` the department line,
   `kicker` the course or client code, `title`/`sub` the document itself,
   `plateTitle`/`plateSub` the two lines of the plate, and `rows` the particulars
   table. */
const titlePage = ({
  org,
  unit,
  kicker,
  title,
  sub,
  plateTitle,
  plateSub,
  rows,
}: {
  org: string;
  unit: string;
  kicker: string;
  title: string;
  sub: string;
  plateTitle: string;
  plateSub: string;
  rows: [string, string][];
}) => `:::center
[**${org}**]{size=15}

${unit}
:::

---

:::center
[**${kicker}**]{size=11 caps}

[**${title}**]{size=22}

*${sub}*
:::

:::banner
${plateTitle}

${plateSub}
:::

| Particulars | Details |
| --- | --- |
${rows.map(([k, v]) => `| **${k}** | ${v} |`).join("\n")}

[pagebreak]
`;

export const TEMPLATES = {
  welcome: {
    label: "Quick tour (start here)",
    desc: "A five-minute working introduction to everything DocForge does.",
    patch: {
      title: "Welcome to DocForge",
      subtitle: "Type on the left — get a print-ready document on the right.",
      author: "Your Name",
      kicker: "Quick tour",
      theme: "modern",
      accent: "#2563eb",
      cover: false,
      header: true,
      pageNums: true,
    },
    source:
      titlePage({
        org: "Your Organisation",
        unit: "Department or team",
        kicker: "Quick tour",
        title: "Welcome to DocForge",
        sub: "Type on the left — get a print-ready document on the right",
        plateTitle: "Everything in one file",
        plateSub: "Cover · Contents · Footnotes · Citations · Equations · Word export",
        rows: [
          ["Author", "Your Name"],
          ["Reference", "DF-001"],
          ["Date", "Today"],
        ],
      }) +
      `[toc]

# Getting started

Welcome! **DocForge** turns plain text into a polished, print-ready document — title page, automatic table of contents, running headers, footers and page numbers included.

Write with simple *Markdown* marks (the toolbar inserts them for you):

- \`# Heading\` starts a section — \`##\` and \`###\` for sub-sections
- **bold**, *italic*, \`code\`, ==highlighted== and ++underlined++, straight off the toolbar
- \`-\` for bullets, \`1.\` for numbered lists

:::tip Try it now
Change anything on the left and watch the pages update. Open **Settings** (top right) to switch the theme, accent colour, page size, typefaces and more.
:::

## The title page above

The page you just scrolled past is ordinary document content — nothing special about it. It is built from three marks you can reuse anywhere:

- \`:::center\` … \`:::\` centres a run of lines
- \`[text]{size=22 caps}\` sets one span's size, case, colour or typeface
- \`:::banner\` … \`:::\` prints the filled plate: first line large and white, the rest small in the accent tint

Settings → **Cover page** offers a designed alternative that numbers itself as front matter; use whichever suits the submission.

## Screenshot placeholders

Add a screenshot slot anywhere with a single line:

[screenshot: Homepage of the app, with the login form visible | #fig-home]

Leave it as a tidy placeholder in the printed PDF — or **click the box in the preview** to attach the real image. Either way it becomes a numbered figure you can point at from prose — "see [#fig-home]" — and the number keeps itself right.

## Tables, captions and callouts

[table: The furniture that makes a document feel finished | #tbl-kit]
| Feature | How | Notes |
| --- | --- | --- |
| Title plate | \`:::banner\` … \`:::\` | Filled band; first line large, the rest in the accent tint |
| Cover page | Settings → Cover page | Title, subtitle, author, date |
| Table of contents | \`[toc]\` | Real page numbers with dotted leaders |
| Captioned tables & figures | \`[table: …]\` above a table | Numbered; cross-reference with \`[#id]\` |
| Lists of figures / tables | \`[lof]\` / \`[lot]\` | Companions to the contents page |
| Page break | \`[pagebreak]\` | Forces a new page |
| Callouts | \`:::note\` … \`:::\` | note, tip, warning, important |

## The scholarly kit

Footnotes,[^1] citations (\`[@key]\` builds and numbers the References page for you) and typeset mathematics:

$$e^{i\\pi} + 1 = 0$$

[^1]: Written inline as \`[^1]\`, defined once anywhere — the note lands at the foot of the right page by itself.

# Exporting

## PDF

Hit **PDF** and choose *Save as PDF* in the print dialog. Margins, page numbers and the contents page are already handled — nothing to configure.

## Word

**Word** downloads a real \`.docx\`: styled headings, the title plate, tables, figures, footnotes, equations and an auto-updating table of contents. When Word asks to *update fields*, click **Yes** so the contents page fills itself in.

# Make it yours

1. Switch themes — Modern, Executive, Academic or Minimal
2. Pick an accent colour to match your brand or college
3. Choose typefaces — six embedded faces travel inside the file, and the whole classic Word specimen book is in the same menu
4. Start from a template in the **Templates** menu

:::note
Everything runs in this one file — no account, no internet, nothing to install. Your work autosaves in this browser; use **Save** for a backup file you can reopen anywhere.
:::
`,
  },
  /* The one template that names a system face rather than an embedded one. Coursework
     is submitted in Times New Roman because the rubric says so, and no lookalike
     passes for it — so the .docx names it and Word supplies its own copy, which is
     exact on any machine with Office. The cost is that it cannot travel inside the
     file the way the embedded faces do: on a device without it the preview and the
     printed PDF fall back, and the linter says so by name. Settings → Body typeface
     switches back to an embedded face for anyone who would rather have parity. */
  assignment: {
    label: "Assignment / lab report",
    desc: "Times New Roman, ruled title page, numbered tasks with captioned figures.",
    patch: {
      theme: "academic",
      accent: "#c2410c",
      numbered: true,
      justify: true,
      h1break: false,
      cover: false,
      header: true,
      pageNums: true,
      borderStyle: "thickthin",
      borderWeight: "bold",
      borderColor: "ink",
      fontHead: "sys:Times New Roman",
      fontBody: "sys:Times New Roman",
      title: "Cloud Architecture Design",
      subtitle: "Digital Assignment 1 · Hands-on lab experiment",
      kicker: "CSE3001",
      metaExtra: "Reg. No. 00XYZ0000",
      author: "Your Name",
    },
    source:
      titlePage({
        org: "Your Institute of Technology, City",
        unit: "School of Computer Science and Engineering",
        kicker: "CSE3001",
        title: "Cloud Architecture Design",
        sub: "Digital Assignment 1 · Hands-on lab experiment",
        plateTitle: "Object Storage Configuration",
        plateSub: "Bucket creation · Static website hosting · Lifecycle policies",
        rows: [
          ["Student Name", "Your Name"],
          ["Registration Number", "00XYZ0000"],
          ["Course Code & Title", "CSE3001 — Cloud Architecture Design"],
          ["Faculty", "Dr. Faculty Name"],
          ["Date of Submission", "31 July 2026"],
        ],
      }) +
      `[toc]

# Aim

State in two or three lines exactly what the experiment sets out to do — the service or technique configured, and the outcome that counts as success.

# Tools and Services Used

- **Service or tool** — one line on what it contributed to the experiment.
- **Second service** — the storage classes, libraries or SDKs the procedure depends on.
- **Management console / CLI** — the interface every configuration step was carried out in.
- **HTML / CSS** — the artefacts uploaded or produced, named exactly as they appear later.

# Deployment Details

[table: The configuration as deployed | #tbl-deploy]
| Setting | Value |
| --- | --- |
| Resource name | your-resource-name |
| Region | Region label — region-code |
| Endpoint | http://your-resource-name.example-endpoint.com |
| Entry / error document | index.html / error.html |
| Policy or rule | rule-name (applies to all objects) |

# Procedure

1. Signed in to the console and selected the region recorded in [#tbl-deploy].
2. Created the resource with the name above, noting any default that was changed.
3. Uploaded the artefacts listed in *Tools and Services Used*.
4. Enabled the feature under test and set its parameters.
5. Attached the access policy that the feature requires.
6. Verified the result end to end, including the failure path.
7. Created the lifecycle or scheduling rule and recorded its stages.
8. Captured a screenshot at every stage and compiled them below.

# Implementation and Observations

## Task 1 — Creating the resource

Describe what was created and why each non-default setting was chosen. One short paragraph per task, then the evidence.

[screenshot: Creation form showing the name, region and the setting that was changed | #fig-create]

## Task 2 — Uploading the artefacts

Name the files, their purpose and the outcome of the upload, then show it.

[screenshot: The uploaded objects listed in the console | #fig-upload]

## Task 3 — Enabling the feature

Record the exact parameters — index and error documents, ports, endpoints — and quote the endpoint the platform generated:

:::center
**http://your-resource-name.example-endpoint.com**
:::

[screenshot: The feature enabled, with the generated endpoint visible | #fig-enable]

## Task 4 — Access policy

Everything is private by default, so the first request returned *403 Forbidden*. The policy below grants exactly the one action the feature needs — no more:

\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "service:GetObject",
      "Resource": "arn:example:::your-resource-name/*"
    }
  ]
}
\`\`\`

[screenshot: The saved policy in the permissions tab | #fig-policy]

## Task 5 — Verification

State what was requested and what came back — including the deliberate failure case, which is the half most reports forget.

[screenshot: The working result, with the URL visible in the address bar | #fig-live]

[screenshot: The custom error page returned for a missing key | #fig-404]

## Task 6 — Lifecycle rule

Set the stages out as a table so the reader can check the arithmetic at a glance:

[table: Stages of rule-name | #tbl-lifecycle]
| Day 0 | Day 30 | Day 90 | Day 365 |
| :---: | :---: | :---: | :---: |
| Object uploaded (Standard) | Transition to Infrequent Access | Transition to Archive | Object expires |

[screenshot: The rule configuration showing the transition timeline | #fig-rule]

:::note Observation
Call out the single most important finding here so it is not lost in the prose — the unexpected default, the step that failed first, the number that did not match the estimate.
:::

# Result

The configuration is live and behaves as specified: the entry document is served at the root, the error document is returned for missing keys, and the rule is active on the resource. Reference the figures rather than re-describing them — [#fig-live] and [#fig-rule] carry the evidence.

# Conclusion

Summarise what was achieved against the aim, in the same order the aim stated it. Name the limitation you met and what you would measure next. The method follows the standard treatment [@clrs2009]; the report format follows [@ieee2021].[^1]

[^1]: Footnotes are written inline as \`[^1]\` and defined once below the paragraph — the note itself lands at the foot of the right page, in the PDF and in Word alike.

[references]

[@clrs2009]: T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, 3rd ed., MIT Press, 2009.
[@ieee2021]: IEEE, *IEEE Editorial Style Manual for Authors*, IEEE Publishing Operations, 2021.
`,
  },
  proposal: {
    label: "Business proposal",
    desc: "Title plate, scope, timeline and pricing tables, signature block.",
    patch: {
      theme: "executive",
      accent: "#1f3a5f",
      title: "Project Proposal",
      subtitle: "Scope, timeline and investment",
      kicker: "Your Company",
      metaExtra: "proposal@yourcompany.com",
      author: "Your Name",
      cover: false,
      header: true,
      pageNums: true,
      h1break: false,
      numbered: false,
      justify: true,
      borderStyle: "rule",
      borderWeight: "fine",
      borderColor: "ink",
    },
    source:
      titlePage({
        org: "Your Company Pvt Ltd",
        unit: "Professional services",
        kicker: "Proposal · REF-0001",
        title: "Project Proposal",
        sub: "Prepared for Client Name",
        plateTitle: "Platform Modernisation",
        plateSub: "Discovery · Build · Handover — eight weeks",
        rows: [
          ["Prepared for", "Client Name, Designation"],
          ["Prepared by", "Your Name, Your Company"],
          ["Reference", "REF-0001"],
          ["Valid until", "30 days from the date below"],
          ["Date", "31 July 2026"],
        ],
      }) +
      `# Executive Summary

One paragraph a busy decision-maker can read in thirty seconds: the problem, your solution, the outcome you're promising, and the investment required. Point them straight at the numbers — the packages in [#tbl-price] and the schedule in [#tbl-time].

:::tip Why us
One or two sentences on the single strongest reason you'll deliver — track record, speed, or specialist expertise.
:::

# The Problem

Describe the client's situation in their words. Quantify the cost of doing nothing where possible.[^1]

[^1]: Put supporting figures and sources in footnotes like this one, so the argument stays readable.

# Proposed Solution

Explain what you will build or deliver and how it solves the problem above. Keep the technology honest and the benefits concrete.

[screenshot: Mock-up or illustrative screen of the deliverable | #fig-mock]

# Scope & Deliverables

[table: What the engagement includes | #tbl-scope]
| Deliverable | Description | Included |
| --- | --- | --- |
| Item one | What the client receives | Yes |
| Item two | What the client receives | Yes |
| Item three | Optional add-on | Optional |

Anything not listed in [#tbl-scope] is out of scope for this engagement and can be quoted separately.

# Timeline

[table: Phases from kick-off to handover | #tbl-time]
| Phase | Work | Duration |
| --- | --- | --- |
| Discovery | Requirements and sign-off | 1 week |
| Build | Core delivery | 3 weeks |
| Handover | Testing, training, docs | 1 week |

# Investment

[table: Packages and pricing | #tbl-price]
| Package | What's included | Price |
| --- | --- | --- |
| Standard | Scope above | ₹ — |
| Extended | Scope + add-ons | ₹ — |

Payment terms: 50% to begin, 50% on delivery. Prices exclude applicable taxes.

# Next Steps

1. Reply confirming the package
2. We send the agreement and kick-off date
3. Discovery workshop within one week

:::note Validity
This proposal is valid for 30 days from the date on the title page.
:::

# Acceptance

Signing below confirms the selected package and the terms above.

| For Client Name | For Your Company |
| --- | --- |
| Name, designation | Name, designation |
| Signature | Signature |
| Date | Date |
`,
  },
  report: {
    label: "Project / status report",
    desc: "Title plate, status slip, metrics table, risks and an actions table.",
    patch: {
      theme: "modern",
      accent: "#2563eb",
      title: "Project Report",
      subtitle: "Progress, decisions and next steps",
      kicker: "Team / Department",
      author: "Your Name",
      metaExtra: "Reporting period",
      cover: false,
      header: true,
      pageNums: true,
      h1break: true,
      justify: false,
      borderStyle: "rule",
      borderWeight: "fine",
      borderColor: "accent",
    },
    source:
      titlePage({
        org: "Your Organisation",
        unit: "Team or department",
        kicker: "Status report · Q3",
        title: "Project Report",
        sub: "Progress, decisions and next steps",
        plateTitle: "Project Name",
        plateSub: "Scope on track · Schedule watch · Budget on track",
        rows: [
          ["Project", "Project Name"],
          ["Reporting period", "1 July — 31 July 2026"],
          ["Prepared by", "Your Name"],
          ["Distribution", "Steering group"],
          ["Date", "31 July 2026"],
        ],
      }) +
      `[toc]

# Executive Summary

Three to five sentences: where the project stands, the headline wins, the main risk, and the ask.

:::tip At a glance
**Scope** on track · **Schedule** watch — one milestone slipped · **Budget** on track
:::

# Progress This Period

## Completed

- Item shipped or finished
- Item shipped or finished

## In Progress

- Item under way, with expected completion

[screenshot: Latest build / dashboard state | #fig-dash]

# Metrics

Numbers first, narrative second — [#tbl-metrics] carries the period-on-period picture; the prose below it explains only what moved and why.

[table: Key metrics, period on period | #tbl-metrics]
| Metric | Last period | This period | Trend |
| --- | --- | --- | --- |
| Metric one | 0 | 0 | → |
| Metric two | 0 | 0 | ↑ |

# Risks & Issues

:::warning Top risk
Name the risk, its impact, and the mitigation you propose.
:::

# Decisions Needed

1. **Decision one** — the options, the trade-off, and your recommendation in one line
2. **Decision two** — the options, the trade-off, and your recommendation in one line

# Next Steps

[table: Actions for the coming period | #tbl-actions]
| Action | Owner | Due |
| --- | --- | --- |
| Action one | Name | Date |
| Action two | Name | Date |
`,
  },
  letter: {
    label: "Formal letter",
    desc: "Letterhead, subject line and a clean sign-off — no title page, no numbers.",
    patch: {
      theme: "minimal",
      accent: "#111827",
      cover: false,
      header: false,
      pageNums: false,
      numbered: false,
      h1break: false,
      hardWrap: true,
      justify: false,
      borderStyle: "none",
      title: "Letter",
      subtitle: "",
    },
    source: `[Your Name]{size=15 sc}
Your address line · City, PIN
your.email@example.com · +91 00000 00000

---

:::right
[DATE]
:::

**To**
Recipient Name
Designation, Organisation
Address line

**Subject: State the purpose of the letter in one line**

Dear Sir/Madam,

Opening paragraph: introduce yourself and state why you are writing, in two or three sentences.

Middle paragraph(s): the substance — facts, dates, reference numbers. Keep each paragraph to a single point.

Closing paragraph: state clearly what action or response you are requesting, and by when.

Thank you for your time and consideration.

Yours faithfully,

**Your Name**

Enclosures: 1. Document name · 2. Document name
`,
  },
  article: {
    label: "Article / essay",
    desc: "A quiet title page and a frame for a piece of writing that stands on its own.",
    patch: {
      theme: "minimal",
      accent: "#111827",
      title: "Article Title",
      subtitle: "A one-line standfirst that frames the piece",
      author: "Your Name",
      kicker: "Essay",
      cover: false,
      header: true,
      pageNums: true,
      h1break: false,
      justify: true,
      borderStyle: "none",
    },
    source:
      titlePage({
        org: "Publication or Series",
        unit: "Section or column",
        kicker: "Essay",
        title: "Article Title",
        sub: "A one-line standfirst that frames the piece",
        plateTitle: "The Question This Piece Answers",
        plateSub: "Stated once, in the fewest words that still make it interesting",
        rows: [
          ["Author", "Your Name"],
          ["Length", "About 2,000 words"],
          ["Date", "31 July 2026"],
        ],
      }) +
      `# Opening

Start with the idea, scene or question that earns the reader's attention. No throat-clearing.

# The Argument

Develop the piece one point per section. Quote sparingly and attribute clearly:[^1]

> A short, well-chosen quotation does more work than a paragraph of summary.

[^1]: Keep asides here, in footnotes, where they can't break the paragraph's stride.

# Counterpoint

Take the strongest objection seriously and answer it.

---

# Closing

Land the piece: return to the opening image or question and say what it means now.
`,
  },
  blank: {
    label: "Blank document",
    desc: "An empty page and nothing else.",
    patch: { title: "Untitled document", subtitle: "", kicker: "", metaExtra: "" },
    source: "",
  },
} satisfies Record<string, TemplateDef>;

export type TemplateId = keyof typeof TEMPLATES;

/* 1:1 local copy of Engine.fmtDate (packages/engine/src/render.ts). The engine
   package registers marked extensions at import time and must only ever load
   through lib/bootstrap's loadStudio(); a nine-line date formatter is not worth
   making template resolution async. */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export interface TemplateDocument {
  id: TemplateId;
  label: string;
  /** The verbatim settings patch from the table (what the classic build stored). */
  patch: Partial<Settings>;
  /** Template source with the [DATE] placeholder resolved (classic applyTemplate). */
  source: string;
  /** Fully resolved settings: { ...DEFAULTS, ...patch, date: today } — classic applyTemplate. */
  settings: Settings;
}

/** The classic applyTemplate semantics, minus the destructive part: this only
    BUILDS the document. The caller (studio shell) snapshots the current
    document first, applies via useDocStore.replaceDocument (which also resets
    attachments and accentTouched, as the classic did), and offers undo. */
export function resolveTemplate(id: TemplateId): TemplateDocument {
  const t = TEMPLATES[id];
  return {
    id,
    label: t.label,
    patch: t.patch,
    source: t.source.replace("[DATE]", fmtDate(todayISO())),
    settings: { ...defaultSettings(), ...t.patch, date: todayISO() },
  };
}
