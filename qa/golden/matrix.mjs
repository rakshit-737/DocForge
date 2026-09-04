/* The golden-master case matrix: which corpus document renders under which settings.
   Curated, not a cross-product — every theme, paper, margin preset, border style,
   border weight/colour, citation style and toggle appears in at least one case.

   `doc` paths are relative to qa/golden/. Every case pins an explicit `date` so no
   capture ever depends on the day it runs. */

const BASE = {
  title: "Golden Master",
  subtitle: "Frozen output contract",
  author: "DocForge QA",
  kicker: "Golden corpus",
  metaExtra: "qa/golden",
  date: "2026-08-30",
};

const s = (over = {}) => ({ ...BASE, ...over });

export const CASES = [
  // ---- the original torture document, in the four historical QA configurations ----
  { id: "torture-modern-a4", doc: "../torture.md", settings: s({ theme: "modern", accent: "#2563eb", page: "A4", margins: "normal", cover: true, header: true, pageNums: true, numbered: false, justify: false, h1break: false }) },
  { id: "torture-academic-a4", doc: "../torture.md", settings: s({ theme: "academic", accent: "#7f1d1d", page: "A4", margins: "normal", cover: true, header: true, pageNums: true, numbered: true, justify: true, h1break: true }) },
  { id: "torture-executive-letter", doc: "../torture.md", settings: s({ theme: "executive", accent: "#1f3a5f", page: "Letter", margins: "wide", cover: true, header: true, pageNums: true, numbered: false, justify: true, h1break: false }) },
  { id: "torture-minimal-a4-narrow", doc: "../torture.md", settings: s({ theme: "minimal", accent: "#111827", page: "A4", margins: "narrow", cover: false, header: true, pageNums: true, numbered: true, justify: false, h1break: false }) },

  // ---- page borders: every style once, weights and colours sampled ----
  { id: "border-rule-fine-ink", doc: "corpus/03-headings-sections.md", settings: s({ theme: "modern", page: "A4", margins: "normal", borderStyle: "rule", borderWeight: "fine", borderColor: "ink", cover: false, pageNums: true }) },
  { id: "border-double-medium-accent", doc: "corpus/03-headings-sections.md", settings: s({ theme: "executive", accent: "#1f3a5f", page: "A4", margins: "normal", borderStyle: "double", borderWeight: "medium", borderColor: "accent", cover: false, pageNums: true }) },
  { id: "border-triple-bold-ink", doc: "corpus/03-headings-sections.md", settings: s({ theme: "academic", page: "Letter", margins: "wide", borderStyle: "triple", borderWeight: "bold", borderColor: "ink", cover: true, pageNums: true }) },
  { id: "border-dashed-medium-ink", doc: "corpus/12-lists-quotes.md", settings: s({ theme: "minimal", page: "A4", margins: "narrow", borderStyle: "dashed", borderWeight: "medium", borderColor: "ink", cover: false, pageNums: true }) },
  { id: "border-dotted-fine-accent", doc: "corpus/12-lists-quotes.md", settings: s({ theme: "modern", accent: "#2563eb", page: "A4", margins: "normal", borderStyle: "dotted", borderWeight: "fine", borderColor: "accent", cover: false, pageNums: true }) },
  { id: "border-thickthin-medium-ink", doc: "corpus/11-callouts-alignment.md", settings: s({ theme: "executive", page: "Letter", margins: "normal", borderStyle: "thickthin", borderWeight: "medium", borderColor: "ink", cover: false, pageNums: true }) },
  { id: "border-thinthick-bold-accent", doc: "corpus/11-callouts-alignment.md", settings: s({ theme: "academic", accent: "#7f1d1d", page: "A4", margins: "normal", borderStyle: "thinthick", borderWeight: "bold", borderColor: "accent", cover: false, pageNums: true }) },

  // ---- one case per dialect-cluster corpus document ----
  { id: "inline-marks", doc: "corpus/01-inline-marks.md", settings: s({ theme: "modern", accent: "#2563eb", page: "A4", margins: "normal", cover: false, header: true, pageNums: true }) },
  { id: "span-attributes", doc: "corpus/02-span-attributes.md", settings: s({ theme: "minimal", page: "A4", margins: "normal", cover: false, pageNums: true }) },
  { id: "headings-sections", doc: "corpus/03-headings-sections.md", settings: s({ theme: "academic", page: "A4", margins: "normal", cover: true, numbered: true, pageNums: true, h1break: true }) },
  { id: "tables", doc: "corpus/04-tables.md", settings: s({ theme: "modern", accent: "#2563eb", page: "A4", margins: "normal", cover: false, pageNums: true }) },
  { id: "tables-letter-justified", doc: "corpus/04-tables.md", settings: s({ theme: "executive", page: "Letter", margins: "wide", cover: false, pageNums: true, justify: true }) },
  { id: "figures", doc: "corpus/05-figures.md", settings: s({ theme: "modern", page: "A4", margins: "normal", cover: false, pageNums: true }) },
  { id: "footnotes", doc: "corpus/06-footnotes.md", settings: s({ theme: "academic", page: "A4", margins: "normal", cover: false, pageNums: true, justify: true }) },
  { id: "citations-numeric", doc: "corpus/07-citations.md", settings: s({ theme: "academic", page: "A4", margins: "normal", citeStyle: "ieee", cover: false, pageNums: true }) },
  { id: "citations-authoryear", doc: "corpus/07-citations.md", settings: s({ theme: "academic", page: "A4", margins: "normal", citeStyle: "apa", cover: false, pageNums: true }) },
  // `apa7` (issue #10 interim) postdates v1-classic AND the frozen classic engine: postBaseline
  // exempts it from the merge gate's tag comparison, postClassic from the byte-parity fixture.
  { id: "citations-apa7", postBaseline: true, postClassic: true, doc: "corpus/07-citations.md", settings: s({ theme: "academic", page: "A4", margins: "normal", citeStyle: "apa7", cover: false, pageNums: true }) },
  { id: "math", doc: "corpus/09-math.md", settings: s({ theme: "modern", page: "A4", margins: "normal", cover: false, pageNums: true }) },
  { id: "code", doc: "corpus/10-code.md", settings: s({ theme: "minimal", page: "A4", margins: "normal", cover: false, pageNums: true }) },
  { id: "callouts-alignment", doc: "corpus/11-callouts-alignment.md", settings: s({ theme: "modern", accent: "#2563eb", page: "A4", margins: "normal", cover: false, pageNums: true }) },
  { id: "lists-quotes", doc: "corpus/12-lists-quotes.md", settings: s({ theme: "executive", page: "A4", margins: "normal", cover: false, pageNums: true }) },
  { id: "toc-pagebreaks", doc: "corpus/13-toc-pagebreaks.md", settings: s({ theme: "academic", page: "A4", margins: "normal", cover: true, pageNums: true, numbered: true }) },
  { id: "long-mixed", doc: "corpus/14-long-mixed.md", settings: s({ theme: "modern", accent: "#2563eb", page: "A4", margins: "normal", cover: true, header: true, pageNums: true }) },
  { id: "edge-minimal", doc: "corpus/16-edge-minimal.md", settings: s({ theme: "minimal", page: "A4", margins: "normal", cover: false }) },
  { id: "adversarial", doc: "corpus/17-adversarial.md", settings: s({ theme: "modern", page: "A4", margins: "normal", cover: false, pageNums: true }) },
  { id: "cover-frontmatter", doc: "corpus/18-cover-frontmatter.md", settings: s({ theme: "executive", accent: "#1f3a5f", page: "A4", margins: "normal", cover: true, header: true, pageNums: true, title: "The Cover Exercise", subtitle: "Front-matter fields, all of them", kicker: "Confidential draft", metaExtra: "Course 42 — Winter term", date: "2025-03-31" }) },

  // ---- document-wide typeface pickers: an embedded pair and a Word-catalogue pair ----
  // The Word faces need not exist on the capture machine: both sides render on the same
  // one, so a fallback is a fallback in the baseline and the current alike.
  { id: "fonts-embedded-pair", doc: "corpus/03-headings-sections.md", settings: s({ theme: "modern", accent: "#2563eb", page: "A4", margins: "normal", fontHead: "mont", fontBody: "garamond", cover: true, header: true, pageNums: true, numbered: true }) },
  { id: "fonts-word-catalog", doc: "corpus/01-inline-marks.md", settings: s({ theme: "academic", page: "A4", margins: "normal", fontHead: "sys:Georgia", fontBody: "sys:Times New Roman", cover: false, header: true, pageNums: true, justify: true }) },

  // ---- the title plate; `:::banner` postdates v1-classic, so the merge gate exempts it ----
  { id: "banner-plate", postBaseline: true, doc: "corpus/19-banner-plate.md", settings: s({ theme: "academic", accent: "#c2410c", page: "A4", margins: "normal", cover: false, header: true, pageNums: true, numbered: true, justify: true, borderStyle: "thickthin", borderWeight: "bold", borderColor: "ink" }) },

  // ---- running header/footer content (§8.2): both header slots written, both
  // foot slots too, and {section} left live. Postdates v1-classic AND the frozen
  // classic engine, so it is exempt from both comparisons and stands as the
  // gate's own record of what the feature renders.
  { id: "running-heads", postBaseline: true, postClassic: true, doc: "corpus/03-headings-sections.md", settings: s({ theme: "modern", accent: "#2563eb", page: "A4", margins: "normal", cover: false, header: true, pageNums: true, title: "Fracture Mechanics", author: "E. Marrow", kicker: "MECH 401", date: "2026-09-04", headerLeft: "{kicker} · {title}", headerRight: "§ {section}", footerLeft: "{author}", footerRight: "{date}" }) },

  // ---- watermark & letterhead (§8.2): the diagonal mark and a logo in the top
  // margin, on a document that also runs a header and a folio, so the gate holds
  // the three of them apart. Postdates v1-classic AND the frozen classic engine.
  // The logo is a 96×24 PNG written by hand — 139 bytes, so the matrix carries
  // its own fixture rather than reaching for a file.
  { id: "stamped", postBaseline: true, postClassic: true, doc: "corpus/03-headings-sections.md", settings: s({ theme: "modern", accent: "#2563eb", page: "A4", margins: "normal", cover: false, header: true, pageNums: true, title: "Fracture Mechanics", watermark: "CONFIDENTIAL", letterhead: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAYCAIAAACKi2/DAAAAUklEQVR42u3YsREAEBBFQR0IVSDRlvIVQQeXYAT2z6tgs7uUS1NQQgAI0FWgaeEAAdoEqn0cCRAgQIAAAQIECBCgv4AcE4AAXQXyEvNRBAToYQuPvG2grm3pMAAAAABJRU5ErkJggg==`, letterheadSize: "12" }) },

  // ---- typography knobs: base size and line spacing off the defaults ----
  { id: "type-large-loose", doc: "corpus/01-inline-marks.md", settings: s({ theme: "executive", page: "A4", margins: "normal", baseSize: "12", lineSpacing: "1.5", cover: false, pageNums: true }) },
  { id: "type-small-single", doc: "corpus/10-code.md", settings: s({ theme: "minimal", page: "A4", margins: "narrow", baseSize: "10", lineSpacing: "1", cover: false, pageNums: true }) },
];
