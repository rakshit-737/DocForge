// @vitest-environment happy-dom
/* ============================================================
   The running header and footer in the .docx (§8.2).

   The product's promise is that the two formats say the same thing on the
   same page, so what is asserted here is the OOXML the reader would open in
   Word: the resolved text in the header part, a live STYLEREF where the
   preview keeps string(sect), and the folio still counting in the footer.

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

const BASE: DocxSettings = {
  theme: "modern",
  accent: "#2458c5",
  page: "A4",
  margins: "normal",
  header: true,
  pageNums: true,
  title: "Fracture Mechanics",
  author: "E. Marrow",
  kicker: "MECH 401",
  date: "2026-09-04",
  baseSize: "11",
};

function content(html: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "content";
  el.innerHTML = html;
  return el;
}

/** Build and return every header/footer part as text. */
async function furniture(settings: DocxSettings): Promise<{ head: string; foot: string }> {
  const blob = await build(content("<h1>Method</h1><p>Body.</p>"), settings, {});
  const zip = readZip(Buffer.from(await blob.arrayBuffer()));
  const grab = (re: RegExp) =>
    [...zip.entries()]
      .filter(([name]) => re.test(name))
      .map(([, bytes]) => bytes.toString("utf8"))
      .join("\n");
  return { head: grab(/word\/header\d*\.xml$/), foot: grab(/word\/footer\d*\.xml$/) };
}

describe("the .docx running header", () => {
  it("carries the title and a live STYLEREF when nothing is set", async () => {
    const { head } = await furniture(BASE);
    expect(head).toContain("FRACTURE MECHANICS");
    expect(head).toContain("STYLEREF 1");
  });

  it("carries the reader's own text instead", async () => {
    const { head } = await furniture({
      ...BASE,
      headerLeft: "{kicker} · {title}",
      headerRight: "{author}",
    });
    expect(head).toContain("MECH 401");
    expect(head).toContain("E. Marrow");
    /* The right slot is the reader's now, so Word's live section field is
       gone with it — exactly as string(sect) leaves the CSS. */
    expect(head).not.toContain("STYLEREF 1");
  });

  it("keeps {section} live when the reader asks for it", async () => {
    const { head } = await furniture({ ...BASE, headerRight: "§ {section}" });
    expect(head).toContain("STYLEREF 1");
    expect(head).toContain("§");
  });

  it("writes the date the way the cover does", async () => {
    const { head } = await furniture({ ...BASE, headerLeft: "{date}" });
    expect(head).toContain("4 SEPTEMBER 2026");
  });

  it("says nothing in the header when the toggle is off", async () => {
    const { head } = await furniture({ ...BASE, header: false, headerLeft: "{title}" });
    /* The part still exists — the section declares one either way — but it
       carries no running text at all. */
    expect(head).not.toContain("FRACTURE MECHANICS");
    expect(head).not.toContain("STYLEREF 1");
  });
});

describe("the .docx running footer", () => {
  it("is the centred folio alone when no side slot is set", async () => {
    const { foot } = await furniture(BASE);
    expect(foot).toContain("PAGE");
    expect(foot).not.toContain("MECH 401");
  });

  it("carries the side slots beside the folio when they are", async () => {
    const { foot } = await furniture({
      ...BASE,
      footerLeft: "{kicker}",
      footerRight: "{author}",
    });
    expect(foot).toContain("MECH 401");
    expect(foot).toContain("E. Marrow");
    expect(foot).toContain("PAGE"); // the folio still counts
    expect(foot).toContain("<w:tab/>"); // one line, three positions
  });

  it("still carries a side slot when page numbers are off", async () => {
    const { foot } = await furniture({ ...BASE, pageNums: false, footerLeft: "{title}" });
    expect(foot).toContain("Fracture Mechanics");
  });
});
