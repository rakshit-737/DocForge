import katex from "katex";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import "./landing.css";

/* The landing is a drawing set — see the direction contract emitted at the
   top of <main>. The page shown on sheet 1 is the assignment template's title
   page (lib/templates.ts), hand-set in the product's own document stylesheet
   (public/doc.css) with the same tint ramp, faces and page border the studio's
   dynamicCss() would emit for it: what is drawn is what the studio prints. */

const CONTRACT = `<!--
IMPECCABLE DIRECTION CONTRACT — landing (/) — seed 254d96c6
THESIS: DocForge's landing is one engineering drawing set printed as a cyanotype: the finished A4 page is the part being drawn, dimensioned from its own margins, and the product's facts live in the title block. It refuses the headline-plus-two-buttons hero, the floating screenshot and the three-column feature grid.
OWN-WORLD: cyanotype blue ground (#12397a) with line-white rules (#e7edf9), ISO 3098 lettering (osifont) in tracked caps, zone-referenced drawing frames with centring marks, dimension lines with arrowheads, a ruled title block, one check-print red stamp (#c8361f). The only white field is paper: the product's real page in doc.css.
STORY: a visitor sees a real assignment page dimensioned like a part and understands this tool makes precisely typeset documents from plain text; the notes say how; the title block says it never leaves the machine; the red stamp opens the studio.
FIRST VIEWPORT: full-bleed sheet 1 of 3. Left, the A4 page at reduced scale with 210/297 and margin dimensions, and leaders calling out the running head, page border, title plate, particulars table and folio. Right, DOCFORGE in lettering over the one-line hook and five general notes. Bottom right, the title block: title, shown, drawn, checked, size, scale, sheet, revision — and the APPROVED cell holds the red OPEN THE STUDIO stamp.
FORM: the engineering drawing sheet — candidate 5 of the grounded list; seed key 254d96c6.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

const ZONES_X = ["1", "2", "3", "4", "5", "6", "7", "8"];
const ZONES_Y = ["A", "B", "C", "D", "E", "F"];

function Frame({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className: string;
  label: string;
}) {
  return (
    <section className="sheet" aria-label={label}>
      <div className="sheet-frame">
        <div className="zones zones-x top" aria-hidden="true">
          {ZONES_X.map((z) => (
            <span key={z}>{z}</span>
          ))}
        </div>
        <div className="zones zones-x bottom" aria-hidden="true">
          {ZONES_X.map((z) => (
            <span key={z}>{z}</span>
          ))}
        </div>
        <div className="zones zones-y left" aria-hidden="true">
          {ZONES_Y.map((z) => (
            <span key={z}>{z}</span>
          ))}
        </div>
        <div className="zones zones-y right" aria-hidden="true">
          {ZONES_Y.map((z) => (
            <span key={z}>{z}</span>
          ))}
        </div>
        <span className="cmark t" aria-hidden="true" />
        <span className="cmark b" aria-hidden="true" />
        <span className="cmark l" aria-hidden="true" />
        <span className="cmark r" aria-hidden="true" />
        <div className={`sheet-body ${className}`}>{children}</div>
      </div>
    </section>
  );
}

/* The part — the assignment template's title page, in doc.css. */
function AssignmentPage() {
  return (
    <div
      className="page tpl-assignment"
      role="img"
      aria-label="Page 1 of the assignment template, as the studio prints it"
    >
      <div className="rh">Cloud Architecture Design</div>
      <div className="doc justify">
        <div className="content">
          <div className="align-center">
            <p>
              <strong>
                <span style={{ fontSize: "15pt" }}>Your Institute of Technology, City</span>
              </strong>
            </p>
            <p>School of Computer Science and Engineering</p>
          </div>
          <hr />
          <div className="align-center">
            <p>
              <strong>
                <span
                  style={{ fontSize: "11pt", textTransform: "uppercase", letterSpacing: "0.08em" }}
                >
                  CSE3001
                </span>
              </strong>
            </p>
            <p>
              <strong>
                <span style={{ fontSize: "22pt" }}>Cloud Architecture Design</span>
              </strong>
            </p>
            <p>
              <em>Digital Assignment 1 · Hands-on lab experiment</em>
            </p>
          </div>
          <div className="banner">
            <p>Object Storage Configuration</p>
            <p>Bucket creation · Static website hosting · Lifecycle policies</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Particulars</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Student Name</strong>
                </td>
                <td>Your Name</td>
              </tr>
              <tr>
                <td>
                  <strong>Registration Number</strong>
                </td>
                <td>00XYZ0000</td>
              </tr>
              <tr>
                <td>
                  <strong>Course Code &amp; Title</strong>
                </td>
                <td>CSE3001 — Cloud Architecture Design</td>
              </tr>
              <tr>
                <td>
                  <strong>Faculty</strong>
                </td>
                <td>Dr. Faculty Name</td>
              </tr>
              <tr>
                <td>
                  <strong>Date of Submission</strong>
                </td>
                <td>31 July 2026</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="folio">1</div>
    </div>
  );
}

/* Dimensions and callouts, in the drawing's own pixel space:
   page origin (110, 90), 794 × 1123 px; 1 mm = 3.7795 px. */
function Dimensions() {
  const P = { x: 110, y: 90, w: 794, h: 1123 };
  const mm = 3.7795;
  const R = P.x + P.w;
  const B = P.y + P.h;
  const ml = 20 * mm;
  const mr = 20 * mm;
  const mt = 22 * mm;
  const mb = 24 * mm;
  const cx = 990; // where leaders land
  const tx = 1004; // where callout lettering starts
  return (
    <svg className="dims" viewBox="0 0 1320 1285" aria-hidden="true" focusable="false">
      <defs>
        <marker
          id="ar"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="24"
          markerHeight="24"
          orient="auto-start-reverse"
        >
          <path d="M0 0.5 L10 5 L0 9.5 z" fill="currentColor" />
        </marker>
      </defs>

      {/* overall width */}
      <g>
        <line className="xl" x1={P.x} y1={P.y - 6} x2={P.x} y2={28} pathLength={1} />
        <line className="xl" x1={R} y1={P.y - 6} x2={R} y2={28} pathLength={1} />
        <line
          className="dl"
          x1={P.x}
          y1={40}
          x2={R}
          y2={40}
          pathLength={1}
          markerStart="url(#ar)"
          markerEnd="url(#ar)"
        />
        <text x={P.x + P.w / 2} y={30} textAnchor="middle">
          210
        </text>
      </g>

      {/* overall height */}
      <g>
        <line className="xl" x1={P.x - 6} y1={P.y} x2={36} y2={P.y} pathLength={1} />
        <line className="xl" x1={P.x - 6} y1={B} x2={36} y2={B} pathLength={1} />
        <line
          className="dl"
          x1={50}
          y1={P.y}
          x2={50}
          y2={B}
          pathLength={1}
          markerStart="url(#ar)"
          markerEnd="url(#ar)"
        />
        <text
          x={38}
          y={P.y + P.h / 2}
          textAnchor="middle"
          transform={`rotate(-90 38 ${P.y + P.h / 2})`}
        >
          297
        </text>
      </g>

      {/* side margins, below the page */}
      <g className="g2">
        <line className="xl" x1={P.x} y1={B + 6} x2={P.x} y2={1272} pathLength={1} />
        <line className="xl" x1={P.x + ml} y1={B + 6} x2={P.x + ml} y2={1272} pathLength={1} />
        <line className="xl" x1={R - mr} y1={B + 6} x2={R - mr} y2={1272} pathLength={1} />
        <line className="xl" x1={R} y1={B + 6} x2={R} y2={1272} pathLength={1} />
        <line
          className="dl"
          x1={P.x}
          y1={1258}
          x2={P.x + ml}
          y2={1258}
          pathLength={1}
          markerStart="url(#ar)"
          markerEnd="url(#ar)"
        />
        <line
          className="dl"
          x1={R - mr}
          y1={1258}
          x2={R}
          y2={1258}
          pathLength={1}
          markerStart="url(#ar)"
          markerEnd="url(#ar)"
        />
        <text x={P.x + ml / 2} y={1248} textAnchor="middle">
          20
        </text>
        <text x={R - mr / 2} y={1248} textAnchor="middle">
          20
        </text>
        {/* top and bottom margins, beside the page */}
        <line className="xl" x1={R + 6} y1={P.y} x2={958} y2={P.y} pathLength={1} />
        <line className="xl" x1={R + 6} y1={P.y + mt} x2={958} y2={P.y + mt} pathLength={1} />
        <line className="xl" x1={R + 6} y1={B - mb} x2={958} y2={B - mb} pathLength={1} />
        <line className="xl" x1={R + 6} y1={B} x2={958} y2={B} pathLength={1} />
        <line
          className="dl"
          x1={944}
          y1={P.y}
          x2={944}
          y2={P.y + mt}
          pathLength={1}
          markerStart="url(#ar)"
          markerEnd="url(#ar)"
        />
        <line
          className="dl"
          x1={944}
          y1={B - mb}
          x2={944}
          y2={B}
          pathLength={1}
          markerStart="url(#ar)"
          markerEnd="url(#ar)"
        />
        <g className="vd">
          <text
            x={932}
            y={P.y + mt / 2}
            textAnchor="middle"
            transform={`rotate(-90 932 ${P.y + mt / 2})`}
          >
            22
          </text>
          <text
            x={932}
            y={B - mb / 2}
            textAnchor="middle"
            transform={`rotate(-90 932 ${B - mb / 2})`}
          >
            24
          </text>
        </g>
      </g>

      {/* leaders to the page furniture */}
      <g className="g2 callouts">
        {/* running head */}
        <circle className="pt" cx={340} cy={116} r={5} />
        <line className="xl" x1={340} y1={116} x2={cx} y2={116} pathLength={1} />
        <text x={tx} y={110}>
          Running head
        </text>
        <text className="s" x={tx} y={136}>
          7.6 pt caps · title · section
        </text>

        {/* page border */}
        <circle className="pt" cx={R - 3 * mm} cy={300} r={5} />
        <line className="xl" x1={R - 3 * mm} y1={300} x2={cx} y2={300} pathLength={1} />
        <text x={tx} y={294}>
          Page border
        </text>
        <text className="s" x={tx} y={320}>
          thick–thin 2.25 pt · 3 mm in
        </text>

        {/* title plate */}
        <circle className="pt" cx={R - mr + 2} cy={492} r={5} />
        <line className="xl" x1={R - mr + 2} y1={492} x2={cx} y2={492} pathLength={1} />
        <text x={tx} y={486}>
          Title plate
        </text>
        <text className="s" x={tx} y={512}>
          :::banner — one shaded cell
        </text>

        {/* particulars */}
        <circle className="pt" cx={R - mr + 2} cy={690} r={5} />
        <line className="xl" x1={R - mr + 2} y1={690} x2={cx} y2={690} pathLength={1} />
        <text x={tx} y={684}>
          Particulars table
        </text>
        <text className="s" x={tx} y={710}>
          Markdown table · tabular nums
        </text>

        {/* folio */}
        <circle className="pt" cx={P.x + P.w / 2 + 18} cy={B - 30} r={5} />
        <line
          className="xl"
          x1={P.x + P.w / 2 + 18}
          y1={B - 30}
          x2={cx}
          y2={B - 30}
          pathLength={1}
        />
        <text x={tx} y={B - 36}>
          Folio
        </text>
        <text className="s" x={tx} y={B - 10}>
          bottom centre · two sequences
        </text>
      </g>
    </svg>
  );
}

const EQUATION = String.raw`\hat{y}_i = \beta_0 + \beta_1 x_i + \varepsilon_i,\qquad \varepsilon_i \sim \mathcal{N}(0,\sigma^2)`;

function TitleBlockCompact({ sheet }: { sheet: number }) {
  return (
    <section className="tb tb-compact lt" aria-label="Title block">
      <div>
        <span className="k">Title</span>
        <span className="v">DocForge — Document studio</span>
      </div>
      <div>
        <span className="k">Size</span>
        <span className="v">A4</span>
      </div>
      <div>
        <span className="k">Sheet</span>
        <span className="v">{sheet} of 3</span>
      </div>
    </section>
  );
}

export default function Home() {
  const eq = katex.renderToString(EQUATION, { displayMode: true, throwOnError: false });
  return (
    <main className="sheet-root flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a static HTML comment — the direction contract, auditable in the built page */}
      <div hidden dangerouslySetInnerHTML={{ __html: CONTRACT }} />
      {/* The product's own document stylesheet — the page on sheet 1 and the
          print fragments on sheet 2 are set in it, exactly as the studio sets them. */}
      <link rel="stylesheet" href="/doc.css" precedence="default" />
      {/* The stamp's impression: a rubber stamp never prints a clean edge. One filter, both stamps. */}
      <svg
        width="0"
        height="0"
        aria-hidden="true"
        focusable="false"
        style={{ position: "absolute" }}
      >
        <defs>
          <filter
            id="ink-rough"
            x="-4%"
            y="-8%"
            width="108%"
            height="116%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              seed="11"
              result="n"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale="2.4"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* ---------- sheet 1 — general arrangement ---------- */}
      <Frame className="ga" label="Sheet 1 of 3 — general arrangement">
        <div className="head">
          <h1 className="name">DocForge</h1>
          <p className="sub lt">Document studio · General arrangement · Dimensions in mm</p>
          <p className="hook lt">Plain text in. A typeset PDF or Word file out.</p>
          <p className="sr-only">
            The drawing shows page one of the assignment template as the studio prints it: an A4
            sheet, 210 by 297 millimetres, with margins of 22, 20, 24 and 20 millimetres, a running
            head, a thick–thin page border, a title plate, a particulars table and a folio.
          </p>
        </div>

        <ol className="notes lt">
          <li>
            <span>
              <b>The source is Markdown.</b> Headings, tables, footnotes, equations, citations and
              figures are written, not clicked.
            </span>
          </li>
          <li>
            <span>
              <b>Pages compose live as you type</b>: margins, running heads, folios, a table of
              contents. The page itself is editable.
            </span>
          </li>
          <li>
            <span>
              <b>Export</b> a print-ready PDF or a native .docx — embedded fonts, TOC fields,
              footnotes, equations. Open .docx and .pdf files too.
            </span>
          </li>
          <li>
            <span>
              <b>Patch a finished PDF</b> on the bench: rewrite a line in its own font; rotate,
              reorder, merge, split, number pages.
            </span>
          </li>
          <li>
            <span>
              <b>No account. No server.</b> Everything autosaves on this machine and the file never
              leaves it.
            </span>
          </li>
        </ol>

        <div className="drawing-wrap">
          <div className="drawing">
            <AssignmentPage />
            <Dimensions />
          </div>
        </div>

        <section className="tb lt" aria-label="Title block">
          <div className="t3">
            <span className="k">Title</span>
            <span className="v">DocForge — Document studio</span>
          </div>
          <div className="s2">
            <span className="k">Shown</span>
            <span className="v">Assignment template, p. 1</span>
          </div>
          <div>
            <span className="k">Drawn by</span>
            <span className="v">You</span>
          </div>
          <div>
            <span className="k">Checked by</span>
            <span className="v">Nobody — local-first</span>
          </div>
          <div className="stampcell">
            <span className="k">Approved</span>
            <Link href="/studio" className="stamp">
              <span className="stamp-ink">Open the studio</span>
            </Link>
          </div>
          <div>
            <span className="k">Size · Scale</span>
            <span className="v">A4 · NTS</span>
          </div>
          <div>
            <span className="k">Sheet</span>
            <span className="v">1 of 3</span>
          </div>
          <div>
            <span className="k">Rev</span>
            <span className="v">D</span>
          </div>
          <div className="links">
            <a href="/classic/">Single-file edition — one HTML file, yours forever</a>
            <Link href="/pdf">PDF bench — patch a finished PDF in place</Link>
          </div>
        </section>
      </Frame>

      {/* ---------- sheet 2 — detail views ---------- */}
      <Frame className="stack" label="Sheet 2 of 3 — detail views">
        <header className="sheet-head lt">
          <h2>Detail views</h2>
          <p>What you type, and what comes off the press. Print at true size.</p>
        </header>

        <div className="details">
          <div className="detail">
            <div className="d-label lt">
              <b>
                <i className="balloon" aria-hidden="true">
                  A
                </i>
                Detail A
              </b>{" "}
              Numbered heading and captioned table
            </div>
            <pre className="src">
              <span className="tag lt">Source — Markdown</span>
              {
                "# Deployment Details\n\n[table: The configuration as deployed | #tbl-deploy]\n| Setting | Value |\n| --- | --- |\n| Resource name | your-resource-name |\n| Region | Region label — region-code |\n| Entry / error document | index.html / error.html |"
              }
            </pre>
            <div className="print">
              <span className="tag lt">Print — 1:1</span>
              <div className="paper">
                <div className="doc tpl-assignment">
                  <div className="content">
                    <h1>
                      <span className="hnum">3</span> Deployment Details
                    </h1>
                    <table>
                      <caption>
                        <span className="tbl-label">Table&nbsp;1</span> — The configuration as
                        deployed
                      </caption>
                      <thead>
                        <tr>
                          <th>Setting</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Resource name</td>
                          <td>your-resource-name</td>
                        </tr>
                        <tr>
                          <td>Region</td>
                          <td>Region label — region-code</td>
                        </tr>
                        <tr>
                          <td>Entry / error document</td>
                          <td>index.html / error.html</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="detail">
            <div className="d-label lt">
              <b>
                <i className="balloon" aria-hidden="true">
                  B
                </i>
                Detail B
              </b>{" "}
              Display equation — in the PDF and in Word
            </div>
            <pre className="src">
              <span className="tag lt">Source — Markdown</span>
              {
                "The fitted line is\n\n$$\n\\hat{y}_i = \\beta_0 + \\beta_1 x_i + \\varepsilon_i,\\qquad\n\\varepsilon_i \\sim \\mathcal{N}(0,\\sigma^2)\n$$\n\nand the residuals are checked in [#fig-resid]."
              }
            </pre>
            <div className="print">
              <span className="tag lt">Print — 1:1</span>
              <div className="paper">
                <div className="doc tpl-assignment">
                  <div className="content">
                    <p>The fitted line is</p>
                    {/* biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output for a fixed, trusted string */}
                    <div className="math-display" dangerouslySetInnerHTML={{ __html: eq }} />
                    <p>
                      and the residuals are checked in{" "}
                      <a className="xref" href="#detail-b">
                        Figure&nbsp;2
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="detail">
            <div className="d-label lt">
              <b>
                <i className="balloon" aria-hidden="true">
                  C
                </i>
                Detail C
              </b>{" "}
              Table of contents — one line of source
            </div>
            <pre className="src">
              <span className="tag lt">Source — Markdown</span>
              {
                "[toc]\n\n# Aim\n# Tools and Services Used\n# Deployment Details\n# Procedure\n## Task 1 — Creating the resource\n## Task 2 — Uploading the artefacts"
              }
            </pre>
            <div className="print">
              <span className="tag lt">Print — 1:1</span>
              <div className="paper">
                <div className="doc tpl-assignment">
                  <div className="content">
                    <div className="toc-wrap">
                      <div className="toc-title">Contents</div>
                      <nav className="toc" aria-label="Contents, as printed">
                        {(
                          [
                            ["1", "Aim", "1", "2"],
                            ["2", "Tools and Services Used", "1", "2"],
                            ["3", "Deployment Details", "1", "3"],
                            ["4", "Procedure", "1", "3"],
                            ["4.1", "Task 1 — Creating the resource", "2", "4"],
                            ["4.2", "Task 2 — Uploading the artefacts", "2", "4"],
                          ] as const
                        ).map(([num, title, lvl, pg]) => (
                          <a
                            key={num}
                            className={`l${lvl}`}
                            href="#detail-c"
                            style={{ "--df-tocnum": `"${pg}"` } as CSSProperties}
                          >
                            <span className="t">
                              <span className="hnum">{num}</span>
                              {title}
                            </span>
                            <span className="dots" />
                          </a>
                        ))}
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <TitleBlockCompact sheet={2} />
      </Frame>

      {/* ---------- sheet 3 — parts list, revisions, approval ---------- */}
      <Frame className="stack" label="Sheet 3 of 3 — parts list and revisions">
        <header className="sheet-head lt">
          <h2>Parts list</h2>
          <p>Everything the studio ships, and what it is made of.</p>
        </header>

        <div className="bom">
          <table className="parts lt">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Description</th>
                <th className="m-hide">Material · Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="n">1</td>
                <td className="q">1</td>
                <td className="d">PDF export</td>
                <td className="m">
                  <b>The browser's print engine</b> over a real paginated layout: margins, running
                  heads, folios, footnotes at the foot, a linked table of contents.
                </td>
              </tr>
              <tr>
                <td className="n">2</td>
                <td className="q">1</td>
                <td className="d">Word export (.docx)</td>
                <td className="m">
                  <b>Native Word</b>, not a picture of one: embedded fonts, TOC fields, footnotes,
                  equations as Word maths, the same page border.
                </td>
              </tr>
              <tr>
                <td className="n">3</td>
                <td className="q">1</td>
                <td className="d">Standalone web page</td>
                <td className="m">
                  <b>One .html file</b> with the fonts inlined — the document, forever, in one file.
                </td>
              </tr>
              <tr>
                <td className="n">4</td>
                <td className="q">1</td>
                <td className="d">Project file</td>
                <td className="m">
                  <b>.docforge.json</b> — source, settings, attachments and typefaces, round-tripped
                  whole.
                </td>
              </tr>
              <tr>
                <td className="n">5</td>
                <td className="q">3</td>
                <td className="d">Imports</td>
                <td className="m">
                  <b>.docx, .pdf, .md</b> — open or drop several at once, then keep working.
                </td>
              </tr>
              <tr>
                <td className="n">6</td>
                <td className="q">1</td>
                <td className="d">PDF bench</td>
                <td className="m">
                  <b>Patch a finished PDF</b> without disturbing its layout: rewrite a printed line
                  in its original font; rotate, reorder, merge, split and number pages.
                </td>
              </tr>
              <tr>
                <td className="n">7</td>
                <td className="q">7</td>
                <td className="d">Templates</td>
                <td className="m">
                  <b>Tour, assignment, proposal, report, letter, article, blank</b> — taken from
                  real submissions, applied without destroying your document.
                </td>
              </tr>
              <tr>
                <td className="n">8</td>
                <td className="q">—</td>
                <td className="d">Your typefaces</td>
                <td className="m">
                  <b>Bring your own font file</b>: previewed in the studio, embedded in the Word
                  file.
                </td>
              </tr>
              <tr>
                <td className="n">9</td>
                <td className="q">1</td>
                <td className="d">Works offline</td>
                <td className="m">
                  <b>Installable</b>; version history and autosave on this machine; nothing is sent
                  anywhere.
                </td>
              </tr>
            </tbody>
          </table>

          <div>
            <h3 className="lt">Revisions</h3>
            <table className="revs lt">
              <thead>
                <tr>
                  <th>Rev</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="n">D</td>
                  <td className="m">
                    <b>House styles</b> — save one, apply it to any document.
                  </td>
                </tr>
                <tr>
                  <td className="n">C</td>
                  <td className="m">
                    <b>Focus &amp; flow</b> — what the document amounts to, and this sitting's goal.
                  </td>
                </tr>
                <tr>
                  <td className="n">B</td>
                  <td className="m">
                    <b>Page toolbox</b> on the PDF bench — rotate, delete, reorder, merge, split,
                    number.
                  </td>
                </tr>
                <tr>
                  <td className="n">A</td>
                  <td className="m">
                    <b>Standalone web page</b> export — the document in one file.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="close">
          <div>
            <p className="big-line lt">
              Approved for construction. Open the studio and start typing.
            </p>
            <p className="alt lt">
              Prefer no install? The <a href="/classic/">single-file edition</a> is one HTML
              document, yours forever. Have a finished PDF to patch? The{" "}
              <Link href="/pdf">PDF bench</Link>.
            </p>
          </div>
          <Link href="/studio" className="stamp big">
            <span className="stamp-ink">Open the studio</span>
          </Link>
          <p className="footline lt">
            <span>Do not scale drawing</span>
            <span>DocForge · MIT licence · No account, no server</span>
            <span>Sheet 3 of 3</span>
          </p>
        </div>

        <TitleBlockCompact sheet={3} />
      </Frame>
    </main>
  );
}
