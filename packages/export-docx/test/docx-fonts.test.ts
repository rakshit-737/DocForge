/* ============================================================
   DocxFonts.embed — the fontTable.xml regroup rewrite, exercised
   against real .docx packages produced by the docx npm library
   (Node supplies Blob / Response / DecompressionStream).
   ============================================================ */

import { Buffer } from "node:buffer";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { embed } from "../src/docx-fonts.js";
import { readZip } from "./_zip.js";

/* Minimal zip writer (stored members only) so edge shapes the docx library
   never produces — a stored fontTable, a package with none — can be built. */
function storedZip(files: [name: string, data: Buffer][]): Blob {
  const locals: Buffer[] = [],
    centrals: Buffer[] = [];
  let off = 0;
  for (const [name, data] of files) {
    const n = Buffer.from(name, "utf8");
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 8); // method: stored
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(n.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(n.length, 28);
    cd.writeUInt32LE(off, 42);
    centrals.push(Buffer.concat([cd, n]));
    locals.push(Buffer.concat([lh, n, data]));
    off += 30 + n.length + data.length;
  }
  const cdBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(off, 16);
  return new Blob([Buffer.concat([...locals, cdBuf, eocd])]);
}

const FAMS = [{ name: "X", cuts: { regular: "CutA-Regular" } }];

const fakeCut = (seed: number): Buffer => {
  const b = Buffer.alloc(64);
  for (let i = 0; i < b.length; i++) b[i] = (seed * 31 + i) & 0xff;
  return b;
};

/** A minimal package with two throwaway cut families, as build() hands them over. */
async function packWithCuts(): Promise<Blob> {
  const doc = new Document({
    fonts: [
      { name: "DocForgeSans-Regular", data: fakeCut(1), characterSet: "00" },
      { name: "DocForgeSans-Bold", data: fakeCut(2), characterSet: "00" },
    ] as any,
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: "hello", font: "DocForge Sans" })] }),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}

describe("DocxFonts.embed", () => {
  it("regroups the throwaway cut families into one real family", async () => {
    const blob = await packWithCuts();
    const beforeFt = readZip(Buffer.from(await blob.arrayBuffer()))
      .get("word/fontTable.xml")!
      .toString("utf8");
    const pairs = [
      ...beforeFt.matchAll(
        /<w:font w:name="(DocForgeSans-\w+)">[\s\S]*?<w:embedRegular r:id="([^"]+)" w:fontKey="([^"]+)"\/>/g,
      ),
    ];
    expect(pairs.length).toBe(2);
    const byName = new Map(pairs.map((m) => [m[1]!, { id: m[2]!, key: m[3]! }]));

    const out = await embed(blob, [
      {
        name: "DocForge Sans",
        family: "swiss",
        pitch: "variable",
        cuts: { regular: "DocForgeSans-Regular", bold: "DocForgeSans-Bold" },
      },
    ]);
    const ft = readZip(Buffer.from(await out.arrayBuffer()))
      .get("word/fontTable.xml")!
      .toString("utf8");

    const reg = byName.get("DocForgeSans-Regular")!;
    const bold = byName.get("DocForgeSans-Bold")!;
    expect(ft).toContain('<w:font w:name="DocForge Sans">');
    expect(ft).toContain('<w:charset w:val="00"/>');
    expect(ft).toContain('<w:family w:val="swiss"/>');
    expect(ft).toContain('<w:pitch w:val="variable"/>');
    // the relationship ids and obfuscation keys the library minted are reused verbatim
    expect(ft).toContain(`<w:embedRegular r:id="${reg.id}" w:fontKey="${reg.key}"/>`);
    expect(ft).toContain(`<w:embedBold r:id="${bold.id}" w:fontKey="${bold.key}"/>`);
    // the rewrite replaces the whole font list — the throwaway names are gone
    expect(ft).not.toContain('w:name="DocForgeSans-Regular"');
    expect(ft).not.toContain('w:name="DocForgeSans-Bold"');
    expect(ft.trimEnd().endsWith("</w:fonts>")).toBe(true);
  });

  it("copies every other member through byte-identically", async () => {
    const blob = await packWithCuts();
    const before = readZip(Buffer.from(await blob.arrayBuffer()));
    const out = await embed(blob, [
      {
        name: "DocForge Sans",
        family: "swiss",
        pitch: "variable",
        cuts: { regular: "DocForgeSans-Regular" },
      },
    ]);
    const after = readZip(Buffer.from(await out.arrayBuffer()));
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    for (const [name, bytes] of before) {
      if (name === "word/fontTable.xml") continue;
      expect(after.get(name)!.equals(bytes), `${name} unchanged`).toBe(true);
    }
  });

  it("returns the blob untouched when no families were embedded", async () => {
    const blob = await packWithCuts();
    await expect(embed(blob, [])).resolves.toBe(blob);
  });

  it("drops a family whose cuts match no packed part", async () => {
    const blob = await packWithCuts();
    const out = await embed(blob, [
      {
        name: "Ghost",
        family: "roman",
        pitch: "variable",
        cuts: { regular: "NoSuchCut" },
      },
    ]);
    const ft = readZip(Buffer.from(await out.arrayBuffer()))
      .get("word/fontTable.xml")!
      .toString("utf8");
    expect(ft).not.toContain("Ghost");
  });
});

describe("DocxFonts.embed edge shapes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the blob untouched when DecompressionStream is unavailable", async () => {
    vi.stubGlobal("DecompressionStream", undefined);
    const blob = new Blob(["irrelevant"]);
    await expect(embed(blob, FAMS)).resolves.toBe(blob);
  });

  it("returns the blob untouched when the package has no fontTable", async () => {
    const blob = storedZip([["word/document.xml", Buffer.from("<w:document/>")]]);
    await expect(embed(blob, FAMS)).resolves.toBe(blob);
  });

  it("rejects bytes that are not a zip", async () => {
    await expect(embed(new Blob(["definitely not a zip archive"]), FAMS)).rejects.toThrow(
      "not a zip",
    );
  });

  it("rejects a zip whose central directory is corrupt", async () => {
    const b = Buffer.alloc(64); // 42 zero bytes, then a lying EOCD
    b.writeUInt32LE(0x06054b50, 42);
    b.writeUInt16LE(1, 42 + 10); // claims one entry
    b.writeUInt32LE(0, 42 + 16); // ...at offset 0, where zeros live
    await expect(embed(new Blob([b]), FAMS)).rejects.toThrow("bad central directory");
  });

  it("regroups a stored (uncompressed) fontTable and defaults family/pitch", async () => {
    const xml =
      '<?xml version="1.0"?><w:fonts xmlns:w="w" xmlns:r="r">' +
      '<w:font w:name="CutA-Regular"><w:sig w:usb0="00000003"/>' +
      '<w:embedRegular r:id="rId1" w:fontKey="{AAA}"/></w:font>' +
      '<w:font w:name="CutA-Bold"><w:embedRegular r:id="rId2" w:fontKey="{BBB}"/></w:font>' +
      '<w:font w:name="CutB-Bold"><w:embedRegular r:id="rId3" w:fontKey="{CCC}"/></w:font>' +
      "</w:fonts>";
    const blob = storedZip([
      ["word/fontTable.xml", Buffer.from(xml)],
      ["word/other.xml", Buffer.from("<keep/>")],
    ]);
    const out = await embed(blob, [
      {
        name: "Fam A",
        family: "swiss",
        pitch: "fixed",
        cuts: { regular: "CutA-Regular", bold: "CutA-Bold" },
      },
      { name: "Fam B", cuts: { bold: "CutB-Bold" } }, // no regular cut: sig falls back empty
      { name: "Ghost", cuts: { regular: "Nope" } },
    ]);
    const zip = readZip(Buffer.from(await out.arrayBuffer()));
    const ft = zip.get("word/fontTable.xml")!.toString("utf8");
    expect(ft).toContain(
      '<w:font w:name="Fam A"><w:charset w:val="00"/>' +
        '<w:family w:val="swiss"/><w:pitch w:val="fixed"/><w:sig w:usb0="00000003"/>' +
        '<w:embedRegular r:id="rId1" w:fontKey="{AAA}"/>' +
        '<w:embedBold r:id="rId2" w:fontKey="{BBB}"/></w:font>',
    );
    // a family with no regular cut still regroups, with defaulted family/pitch and no sig
    expect(ft).toContain(
      '<w:font w:name="Fam B"><w:charset w:val="00"/>' +
        '<w:family w:val="auto"/><w:pitch w:val="variable"/>' +
        '<w:embedBold r:id="rId3" w:fontKey="{CCC}"/></w:font>',
    );
    expect(ft).not.toContain("Ghost");
    expect(ft).not.toContain('w:name="CutA-Regular"');
    // untouched members are copied through
    expect(zip.get("word/other.xml")!.toString("utf8")).toBe("<keep/>");
  });
});
