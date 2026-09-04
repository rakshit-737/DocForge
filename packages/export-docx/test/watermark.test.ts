// @vitest-environment happy-dom
/* ============================================================
   The watermark and the letterhead in the .docx (§8.2).

   The preview draws the mark with CSS; Word draws it as a VML textpath
   parked in the header. What is asserted here is the OOXML a reader would
   actually open: the shape, the word inside it, the box the engine measured,
   and the logo as a real image part — plus the promise that a document
   asking for neither carries neither.

   Same harness as the other export suites: the real docx package plays
   window.docx and the verbatim Engine fixture supplies the constants.
   ============================================================ */

import { Buffer } from "node:buffer";
import * as docxLib from "docx";
import katex from "katex";
import { describe, expect, it } from "vitest";
import type { DocxSettings } from "../src/index.js";
import { build } from "../src/index.js";
import { readZip } from "./_zip.js";
import { EngineFixture } from "./engine-fixture.js";

const fakeCut = (seed: number): string => {
  const b = Buffer.alloc(64);
  for (let i = 0; i < b.length; i++) b[i] = (seed * 31 + i) & 0xff;
  return b.toString("base64");
};
const FONT_DATA: Record<string, string> = {
  "DocForgeSans-Regular": fakeCut(1),
  "DocForgeSans-Bold": fakeCut(2),
};
(globalThis as any).Engine = EngineFixture;
(globalThis as any).katex = katex;
(globalThis as any).docx = docxLib;
(globalThis as any).__FONT_DATA__ = FONT_DATA;
if (typeof window !== "undefined") {
  (window as any).docx = docxLib;
  (window as any).__FONT_DATA__ = FONT_DATA;
}

/* A 2×1 red PNG and a 1×1 JPEG, small enough to read as literals and real
   enough that Word gets a valid image part. */
const PNG_2x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAFElEQVR4nGP8z8Dwn4GBgYkBBkAcAB//AwPvXKS3AAAAAElFTkSuQmCC";
const JPEG_1x1 =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

const BASE: DocxSettings = {
  theme: "modern",
  accent: "#2458c5",
  page: "A4",
  margins: "normal",
  header: true,
  pageNums: true,
  title: "Fracture Mechanics",
  baseSize: "11",
};

function content(html: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "content";
  el.innerHTML = html;
  return el;
}

async function pack(settings: DocxSettings) {
  const blob = await build(content("<h1>Method</h1><p>Body.</p>"), settings, {});
  const zip = readZip(Buffer.from(await blob.arrayBuffer()));
  const head = [...zip.entries()]
    .filter(([name]) => /word\/header\d*\.xml$/.test(name))
    .map(([, bytes]) => bytes.toString("utf8"))
    .join("\n");
  const media = [...zip.keys()].filter((n) => n.startsWith("word/media/"));
  return { zip, head, media };
}

describe("a document that asks for neither", () => {
  it("carries no shape and no image", async () => {
    const { head, media } = await pack(BASE);
    expect(head).not.toContain("w:pict");
    expect(head).not.toContain("DocForgeWatermark");
    expect(media).toHaveLength(0);
  });
});

describe("the watermark", () => {
  it("is a VML textpath in the header, carrying the word", async () => {
    const { head } = await pack({ ...BASE, watermark: "DRAFT" });
    expect(head).toContain("w:pict");
    expect(head).toContain('id="DocForgeWatermark"');
    expect(head).toContain('string="DRAFT"');
    expect(head).toContain('type="#_x0000_t136"');
  });

  it("is stamped in the box the engine measured, at the same angle as the CSS", async () => {
    const { head } = await pack({ ...BASE, watermark: "CONFIDENTIAL" });
    const mark = EngineFixture.watermarkMetrics("CONFIDENTIAL", EngineFixture.PAGES.A4);
    expect(head).toContain(`width:${mark.widthPt}pt`);
    expect(head).toContain(`height:${mark.heightPt}pt`);
    expect(head).toContain("rotation:315");
  });

  it("sits behind the prose, anchored to the page rather than a paragraph", async () => {
    const { head } = await pack({ ...BASE, watermark: "DRAFT" });
    expect(head).toContain("z-index:-251658752");
    expect(head).toContain('o:allowincell="f"');
    expect(head).toContain("mso-position-horizontal:center");
  });

  it("still reaches the page when the running head is off", async () => {
    const { head } = await pack({ ...BASE, header: false, watermark: "DRAFT" });
    expect(head).toContain('string="DRAFT"');
    expect(head).not.toContain("FRACTURE MECHANICS");
  });

  it("cannot break the XML with a quote or a bracket", async () => {
    const { head } = await pack({ ...BASE, watermark: 'DR"A<F&T>' });
    expect(head).toContain("&quot;");
    expect(head).toContain("&amp;");
    expect(head).not.toContain('string="DR"A');
  });
});

describe("the letterhead", () => {
  it("becomes a real image part inside the header", async () => {
    const { head, media, zip } = await pack({ ...BASE, letterhead: PNG_2x1 });
    expect(media).toHaveLength(1);
    expect(head).toContain("w:drawing");
    /* The header part must own the relationship, or Word opens a blank box. */
    const rels = [...zip.entries()]
      .filter(([n]) => /word\/_rels\/header\d*\.xml\.rels$/.test(n))
      .map(([, b]) => b.toString("utf8"))
      .join("\n");
    expect(rels).toContain("media/");
  });

  it("keeps the logo's own proportions at the height that was asked for", async () => {
    const { head } = await pack({ ...BASE, letterhead: PNG_2x1, letterheadSize: "10" });
    /* 10 mm tall at 96 dpi is 38 px; the 2:1 image is then 76 px wide.
       EMUs are px × 9525. */
    expect(head).toContain(`cy="${38 * 9525}"`);
    expect(head).toContain(`cx="${76 * 9525}"`);
  });

  it("takes a JPEG too", async () => {
    const { media } = await pack({ ...BASE, letterhead: JPEG_1x1 });
    expect(media).toHaveLength(1);
  });

  it("prints nothing rather than a stretched logo when the file lies", async () => {
    const { media } = await pack({ ...BASE, letterhead: "data:image/png;base64,AAAA" });
    expect(media).toHaveLength(0);
  });

  it("rides above the running head, not through it", async () => {
    const { head } = await pack({ ...BASE, letterhead: PNG_2x1 });
    expect(head.indexOf("w:drawing")).toBeLessThan(head.indexOf("FRACTURE MECHANICS"));
  });
});
