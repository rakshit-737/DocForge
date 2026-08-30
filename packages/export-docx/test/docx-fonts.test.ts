/* ============================================================
   DocxFonts.embed — the fontTable.xml regroup rewrite, exercised
   against real .docx packages produced by the docx npm library
   (Node supplies Blob / Response / DecompressionStream).
   ============================================================ */
import { describe, it, expect } from "vitest";
import { Buffer } from "node:buffer";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { embed } from "../src/docx-fonts.js";
import { readZip } from "./_zip.js";

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
    sections: [{
      children: [new Paragraph({ children: [new TextRun({ text: "hello", font: "DocForge Sans" })] })],
    }],
  });
  return Packer.toBlob(doc);
}

describe("DocxFonts.embed", () => {
  it("regroups the throwaway cut families into one real family", async () => {
    const blob = await packWithCuts();
    const beforeFt = readZip(Buffer.from(await blob.arrayBuffer()))
      .get("word/fontTable.xml")!.toString("utf8");
    const pairs = [...beforeFt.matchAll(
      /<w:font w:name="(DocForgeSans-\w+)">[\s\S]*?<w:embedRegular r:id="([^"]+)" w:fontKey="([^"]+)"\/>/g,
    )];
    expect(pairs.length).toBe(2);
    const byName = new Map(pairs.map(m => [m[1]!, { id: m[2]!, key: m[3]! }]));

    const out = await embed(blob, [{
      name: "DocForge Sans", family: "swiss", pitch: "variable",
      cuts: { regular: "DocForgeSans-Regular", bold: "DocForgeSans-Bold" },
    }]);
    const ft = readZip(Buffer.from(await out.arrayBuffer()))
      .get("word/fontTable.xml")!.toString("utf8");

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
    const out = await embed(blob, [{
      name: "DocForge Sans", family: "swiss", pitch: "variable",
      cuts: { regular: "DocForgeSans-Regular" },
    }]);
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
    const out = await embed(blob, [{
      name: "Ghost", family: "roman", pitch: "variable", cuts: { regular: "NoSuchCut" },
    }]);
    const ft = readZip(Buffer.from(await out.arrayBuffer()))
      .get("word/fontTable.xml")!.toString("utf8");
    expect(ft).not.toContain("Ghost");
  });
});
