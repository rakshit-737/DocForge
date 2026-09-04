/* The bibliography importer: three formats in, dialect definition lines out.
   Everything here is pure string work, so it runs in plain node. */
import { describe, expect, it } from "vitest";
import {
  BibImport,
  deTex,
  detectFormat,
  formatEntry,
  formatName,
  looksLikeCslJson,
  parseBibtex,
  parseCslJson,
  parseLibrary,
  parseRis,
  sanitiseKey,
  toDefinitions,
} from "../src/bib-import";

/* ---------------- BibTeX ---------------- */

const BIB = String.raw`
% a comment line the parser must ignore
@article{harrow2015,
  author  = {Harrow, Jane and M{\"u}ller, Karl},
  title   = {Acoustic Emission in Thin Plates},
  journal = {Journal of Applied Acoustics},
  year    = {2015},
  volume  = {42},
  number  = {3},
  pages   = {201--218},
  doi     = {10.1000/aa.2015.42},
}

@book{vance2016,
  author    = "Vance, Robert",
  title     = "Structural Testing",
  publisher = "Ridge Press",
  year      = 2016,
  edition   = {2nd},
}
`;

describe("parseBibtex", () => {
  const entries = parseBibtex(BIB);

  it("finds every entry and skips comments", () => {
    expect(entries.map((e) => e.key)).toEqual(["harrow2015", "vance2016"]);
  });

  it("reads braced, quoted and bare values alike", () => {
    const [a, b] = entries;
    expect(a?.title).toBe("Acoustic Emission in Thin Plates");
    expect(b?.title).toBe("Structural Testing");
    expect(b?.year).toBe("2016"); // bare number
    expect(b?.publisher).toBe("Ridge Press");
  });

  it("splits authors on `and` and reduces given names to initials", () => {
    expect(entries[0]?.authors).toEqual(["Harrow, J.", "Müller, K."]);
  });

  it("keeps journal, volume, issue, pages and DOI", () => {
    const a = entries[0];
    expect(a?.container).toBe("Journal of Applied Acoustics");
    expect(a?.volume).toBe("42");
    expect(a?.issue).toBe("3");
    expect(a?.pages).toBe("201–218"); // `--` became an en dash
    expect(a?.doi).toBe("10.1000/aa.2015.42");
  });

  it("survives a nested-brace title and a trailing field without a comma", () => {
    const out = parseBibtex("@misc{k1, title = {A {Nested} Brace}, note = {last} }");
    expect(out[0]?.title).toBe("A Nested Brace");
    expect(out[0]?.note).toBe("last");
  });

  it("substitutes @string macros", () => {
    const out = parseBibtex(`@string{jap = {Journal of Applied Physics}}
      @article{k2, author = {Doe, A.}, journal = jap, year = {2020}}`);
    expect(out[0]?.container).toBe("Journal of Applied Physics");
  });

  it("renames colliding keys rather than losing an entry", () => {
    const out = parseLibrary("@misc{same, title={One}}\n@misc{same, title={Two}}", "x.bib");
    // the first keeps the key it was given; each collision after takes a, b, …
    expect(out.map((e) => e.key)).toEqual(["same", "samea"]);
  });

  it("ignores @comment and @preamble blocks", () => {
    const out = parseBibtex(
      '@preamble{"\\newcommand{\\x}{}"}\n@comment{ignored}\n@misc{k3,title={T}}',
    );
    expect(out.map((e) => e.key)).toEqual(["k3"]);
  });
});

describe("deTex", () => {
  it("decodes the accent shapes the wild produces", () => {
    expect(deTex('M{\\"u}ller')).toBe("Müller");
    expect(deTex("Garc\\'ia")).toBe("García");
    expect(deTex("Dvo\\v{r}\\'ak")).toBe("Dvořák");
  });

  it("keeps the letters when a command is unknown", () => {
    expect(deTex("\\textbf{Bold} and \\emph{italic}")).toBe("Bold and italic");
  });

  it("handles escaped punctuation and dashes", () => {
    expect(deTex("Smith \\& Jones, 20--30")).toBe("Smith & Jones, 20–30");
  });
});

describe("formatName", () => {
  it("turns both name orders into `Last, I.`", () => {
    expect(formatName("Harrow, Jane")).toBe("Harrow, J.");
    expect(formatName("Jane Harrow")).toBe("Harrow, J.");
    expect(formatName("Jane Q. Harrow")).toBe("Harrow, J. Q.");
  });

  it("leaves a single-word or corporate name whole", () => {
    expect(formatName("Aristotle")).toBe("Aristotle");
    expect(formatName("{World Health Organization}")).toBe("World Health Organization");
  });
});

describe("sanitiseKey", () => {
  it("strips what `[@key]` cannot address", () => {
    expect(sanitiseKey("a key, with]brackets")).toBe("akeywithbrackets");
    expect(sanitiseKey("   ")).toBe("ref");
  });
});

/* ---------------- RIS ---------------- */

const RIS = `TY  - JOUR
AU  - Marrow, Elena
AU  - Singh, Priya
TI  - Fracture propagation in laminates
JO  - Composites Today
PY  - 2019
VL  - 8
IS  - 2
SP  - 44
EP  - 59
DO  - 10.5555/ct.2019.8
ER  -

TY  - BOOK
AU  - Okafor, Chidi
TI  - Materials in Practice
PB  - Union Books
PY  - 2021
ER  -
`;

describe("parseRis", () => {
  const entries = parseRis(RIS);

  it("reads every record and mints a key from author + year", () => {
    expect(entries.map((e) => e.key)).toEqual(["marrow2019", "okafor2021"]);
  });

  it("keeps all authors, the container and the page range", () => {
    expect(entries[0]?.authors).toEqual(["Marrow, E.", "Singh, P."]);
    expect(entries[0]?.container).toBe("Composites Today");
    expect(entries[0]?.pages).toBe("44–59");
    expect(entries[0]?.type).toBe("article");
  });

  it("maps the reference type", () => {
    expect(entries[1]?.type).toBe("book");
    expect(entries[1]?.publisher).toBe("Union Books");
  });

  it("joins a wrapped title onto its tag", () => {
    const out = parseRis("TY  - JOUR\nTI  - A very long title\n  that wrapped\nPY  - 2020\nER  - ");
    expect(out[0]?.title).toBe("A very long title that wrapped");
  });

  it("closes an unterminated record rather than dropping it", () => {
    const out = parseRis("TY  - JOUR\nAU  - Solo, H.\nTI  - No ER tag\nPY  - 2001\n");
    expect(out).toHaveLength(1);
    expect(out[0]?.title).toBe("No ER tag");
  });
});

/* ---------------- CSL-JSON ---------------- */

const CSL = JSON.stringify([
  {
    id: "kwan2018",
    type: "article-journal",
    title: "Thermal drift in optical benches",
    author: [{ family: "Kwan", given: "Li Wei" }, { literal: "National Metrology Institute" }],
    issued: { "date-parts": [[2018, 4]] },
    "container-title": "Metrologia",
    volume: 55,
    issue: 2,
    page: "119-131",
    DOI: "10.1088/met.2018",
  },
  {
    type: "book",
    title: "Measurement Systems",
    author: [{ family: "Ibarra", given: "Sofía" }],
    issued: { "date-parts": [[2022]] },
    publisher: "Cordillera",
  },
]);

describe("parseCslJson", () => {
  const entries = parseCslJson(CSL);

  it("uses the id, and mints one when it is missing", () => {
    expect(entries[0]?.key).toBe("kwan2018");
    expect(entries[1]?.key).toBe("ibarra2022");
  });

  it("reads names in both shapes and the year out of date-parts", () => {
    expect(entries[0]?.authors).toEqual(["Kwan, L. W.", "National Metrology Institute"]);
    expect(entries[0]?.year).toBe("2018");
  });

  it("normalises the numeric fields and the page range", () => {
    expect(entries[0]?.volume).toBe("55");
    expect(entries[0]?.issue).toBe("2");
    expect(entries[0]?.pages).toBe("119–131");
  });

  it("recognises a library, and refuses a project file", () => {
    expect(looksLikeCslJson(CSL)).toBe(true);
    expect(looksLikeCslJson('{"app":"docforge","v":1,"source":"# x"}')).toBe(false);
    expect(looksLikeCslJson("not json at all")).toBe(false);
  });
});

/* ---------------- detection and output ---------------- */

describe("detectFormat", () => {
  it("trusts the extension first, then the content", () => {
    expect(detectFormat("anything", "refs.bib")).toBe("bibtex");
    expect(detectFormat("anything", "refs.ris")).toBe("ris");
    expect(detectFormat(CSL, "zotero.json")).toBe("csl-json");
    expect(detectFormat(BIB)).toBe("bibtex");
    expect(detectFormat(RIS)).toBe("ris");
    expect(detectFormat("# just a document")).toBe(null);
  });

  it("parseLibrary refuses what it cannot name", () => {
    expect(() => parseLibrary("# just a document", "notes.md")).toThrow(/BibTeX, RIS or CSL-JSON/);
  });
});

describe("formatEntry / toDefinitions", () => {
  it("writes an article the way the corpus specimen does", () => {
    const [a] = parseBibtex(BIB);
    expect(formatEntry(a!)).toBe(
      "Harrow, J., & Müller, K. (2015). Acoustic Emission in Thin Plates. *Journal of Applied Acoustics*, 42(3), 201–218. https://doi.org/10.1000/aa.2015.42",
    );
  });

  it("italicises a standalone work's own title instead", () => {
    const [, b] = parseBibtex(BIB);
    expect(formatEntry(b!)).toBe("Vance, R. (2016). *Structural Testing*. 2nd ed. Ridge Press.");
  });

  it("emits addressable dialect lines", () => {
    const defs = toDefinitions(parseBibtex(BIB));
    expect(defs.split("\n")).toHaveLength(2);
    expect(defs.startsWith("[@harrow2015]: Harrow, J.")).toBe(true);
    // every line is exactly what the engine's definition parser accepts
    for (const line of defs.split("\n")) expect(line).toMatch(/^\[@[^\]\s,]+\]: \S/);
  });

  it("falls back to editors when there is no author", () => {
    const [e] = parseBibtex(
      "@book{ed1, editor={Stone, Ada}, title={Collected Works}, year={1999}}",
    );
    expect(formatEntry(e!)).toBe("Stone, A. (1999). *Collected Works*.");
  });

  it("is reachable from the package api", () => {
    expect(typeof BibImport.parseLibrary).toBe("function");
    expect(BibImport.toDefinitions(BibImport.parseLibrary(RIS, "x.ris"))).toContain(
      "[@marrow2019]:",
    );
  });
});
