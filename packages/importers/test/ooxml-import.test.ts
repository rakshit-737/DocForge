// @vitest-environment happy-dom
/* xlsx / pptx / epub converters against tiny in-test constructed packages.
   Entries are STORED (method 0) so these DOMParser-dependent tests never
   depend on happy-dom's Blob/stream plumbing; deflate is covered by the
   node-environment zip tests. */
import { describe, it, expect } from "vitest";
import { FileImport } from "../src/index.js";
import { buildZip } from "./_build-zip.js";

const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/* ---------- xlsx ---------- */

const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}">
  <sheets>
    <sheet name="Data" sheetId="1" r:id="rId1"/>
    <sheet name="Empty" sheetId="2" r:id="rId2"/>
    <sheet name="Abs" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>`;

const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="${R}/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="${R}/worksheet" Target="/xl/worksheets/sheet1.xml"/>
</Relationships>`;

const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
  <si><t>Name</t></si>
  <si><t>Sc</t><t>ore</t></si>
</sst>`;

const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>Bob</t></is></c><c r="C2"><v>42</v></c></row>
    <row r="3"><c r="A3" t="b"><v>1</v></c><c r="B3" t="b"><v>0</v></c></row>
    <row r="4"><c r="A4" t="inlineStr"><is><t> </t></is></c></row>
  </sheetData>
</worksheet>`;

const sheet2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`;

const DATA_TABLE =
  "| Name | Score |  |\n| --- | --- | --- |\n| Bob |  | 42 |\n| TRUE | FALSE |  |";

describe("xlsx", () => {
  it("converts sheets to headed tables (shared/inline strings, booleans, sparse cells)", async () => {
    const zip = buildZip([
      { name: "xl/workbook.xml", data: workbookXml },
      { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
      { name: "xl/sharedStrings.xml", data: sharedStrings },
      { name: "xl/worksheets/sheet1.xml", data: sheet1 },
      { name: "xl/worksheets/sheet2.xml", data: sheet2 },
    ]);
    const md = await FileImport.xlsx(zip);
    // "Empty" is skipped; "Abs" tests the leading-slash target normalization.
    expect(md).toBe(`## Data\n\n${DATA_TABLE}\n\n## Abs\n\n${DATA_TABLE}`);
  });

  it("throws when no sheet is readable", async () => {
    const wb = `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}">
      <sheets><sheet name="Gone" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/nope.xml"/></Relationships>`;
    const zip = buildZip([
      { name: "xl/workbook.xml", data: wb },
      { name: "xl/_rels/workbook.xml.rels", data: rels },
    ]);
    await expect(FileImport.xlsx(zip)).rejects.toThrow("No readable sheets in that workbook");
  });
});

/* ---------- pptx ---------- */

const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";

const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="${P}" xmlns:r="${R}">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
    <p:sldId id="257" r:id="rId2"/>
  </p:sldIdLst>
</p:presentation>`;

const presentationRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="${R}/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Type="${R}/slide" Target="slides/slide2.xml"/>
</Relationships>`;

const slide1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="${P}" xmlns:a="${A}">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>Quarterly Review</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:sp>
      <p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
      <p:txBody>
        <a:p><a:pPr lvl="0"/><a:r><a:t>Revenue up</a:t></a:r></a:p>
        <a:p><a:pPr lvl="1"/><a:r><a:t>EMEA strongest</a:t></a:r></a:p>
      </p:txBody>
    </p:sp>
    <p:sp>
      <p:txBody><a:p><a:r><a:t>Free text box</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:graphicFrame><a:tbl>
      <a:tr><a:tc><a:txBody><a:p><a:r><a:t>Region</a:t></a:r></a:p></a:txBody></a:tc>
            <a:tc><a:txBody><a:p><a:r><a:t>Sales</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
      <a:tr><a:tc><a:txBody><a:p><a:r><a:t>EMEA</a:t></a:r></a:p></a:txBody></a:tc>
            <a:tc><a:txBody><a:p><a:r><a:t>10</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
    </a:tbl></p:graphicFrame>
  </p:spTree></p:cSld>
</p:sld>`;

const slide1Rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId9" Type="${R}/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
</Relationships>`;

const notesSlide1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:p="${P}" xmlns:a="${A}">
  <p:cSld><p:spTree>
    <p:sp><p:txBody>
      <a:p><a:r><a:t>Remember the demo</a:t></a:r></a:p>
      <a:p><a:r><a:t>1</a:t></a:r></a:p>
    </p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:notes>`;

const slide2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="${P}" xmlns:a="${A}">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>Just text</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`;

describe("pptx", () => {
  it("converts slides: title heading, leveled bullets, free text, tables, speaker notes", async () => {
    const zip = buildZip([
      { name: "ppt/presentation.xml", data: presentationXml },
      { name: "ppt/_rels/presentation.xml.rels", data: presentationRels },
      { name: "ppt/slides/slide1.xml", data: slide1 },
      { name: "ppt/slides/_rels/slide1.xml.rels", data: slide1Rels },
      { name: "ppt/notesSlides/notesSlide1.xml", data: notesSlide1 },
      { name: "ppt/slides/slide2.xml", data: slide2 },
    ]);
    const md = await FileImport.pptx(zip);
    expect(md).toBe(
      "# Quarterly Review\n\n" +
      "- Revenue up\n  - EMEA strongest\n\n" +
      "Free text box\n\n" +
      "| Region | Sales |\n| --- | --- |\n| EMEA | 10 |\n\n" +
      ":::note Speaker notes\nRemember the demo\n:::\n\n" + // bare "1" (a page number) stripped
      "# Slide 2\n\nJust text"); // no title placeholder -> numbered fallback
  });

  it("throws on a deck without slides", async () => {
    const zip = buildZip([
      { name: "ppt/presentation.xml", data: `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst/></p:presentation>` },
      { name: "ppt/_rels/presentation.xml.rels", data: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>` },
    ]);
    await expect(FileImport.pptx(zip)).rejects.toThrow("No slides in that deck");
  });
});

/* ---------- epub ---------- */

const containerXml = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="sub%20dir/ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch3" href="ch3.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="ch2"/>
    <itemref idref="ch1"/>
    <itemref idref="ch3"/>
    <itemref idref="missing"/>
  </spine>
</package>`;

describe("epub", () => {
  it("walks the spine in reading order through the provided htmlToMd", async () => {
    const zip = buildZip([
      { name: "META-INF/container.xml", data: containerXml },
      { name: "OEBPS/content.opf", data: contentOpf },
      { name: "OEBPS/ch1.xhtml", data: "<html><body><p>One</p></body></html>" },
      { name: "OEBPS/sub dir/ch2.xhtml", data: "<p>Two</p>" }, // href was URL-encoded
      { name: "OEBPS/ch3.xhtml", data: "<p>   </p>" },         // converts to blank -> skipped
    ]);
    const calls: string[] = [];
    const htmlToMd = (html: string) => { calls.push(html); return html.replace(/<[^>]+>/g, ""); };
    const md = await FileImport.epub(zip, htmlToMd);
    expect(md).toBe("Two\n\n[pagebreak]\n\nOne");
    expect(calls).toHaveLength(3); // ch2, ch1, ch3 — the dangling idref never reaches the converter
    expect(calls[0]).toContain("Two");
    expect(calls[1]).toContain("One");
  });

  it("throws without a rootfile", async () => {
    const zip = buildZip([
      { name: "META-INF/container.xml", data: `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles/></container>` },
    ]);
    await expect(FileImport.epub(zip, h => h)).rejects.toThrow("Not an EPUB (no rootfile)");
  });

  it("throws on an empty spine", async () => {
    const zip = buildZip([
      { name: "META-INF/container.xml", data: containerXml },
      { name: "OEBPS/content.opf", data: `<package xmlns="http://www.idpf.org/2007/opf"><manifest/><spine/></package>` },
    ]);
    await expect(FileImport.epub(zip, h => h)).rejects.toThrow("Empty EPUB spine");
  });
});
