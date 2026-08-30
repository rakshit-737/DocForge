// @vitest-environment happy-dom
/* DocxImport is tested through its public toHtml() with a stub mammoth on
   window (the classic build's fast path: window.mammoth short-circuits the
   bundle load). The real Blob-URL bundle load is integration-proved by
   qa/import-smoke.mjs at rewire time — node/vitest cannot import blob: URLs. */
import { describe, it, expect, beforeEach } from "vitest";
import { DocxImport } from "../src/index.js";

const buf = new ArrayBuffer(4);

function stub(value: string, messages: MammothMessage[] = []): void {
  window.mammoth = { convertToHtml: async () => ({ value, messages }) } as unknown as MammothLib;
}

beforeEach(() => {
  delete (window as { mammoth?: unknown }).mammoth;
  delete (window as { __MAMMOTH_SRC__?: unknown }).__MAMMOTH_SRC__;
});

describe("cleanup via toHtml", () => {
  it("passes ordinary HTML through", async () => {
    stub("<h1>Hi</h1><p>Body text</p>");
    const { html } = await DocxImport.toHtml(buf);
    expect(html).toContain("<h1>Hi</h1>");
    expect(html).toContain("<p>Body text</p>");
  });

  it("removes stale Word TOC lines (mostly anchored text ending in a page number)", async () => {
    stub('<p><a href="#_Toc1">Introduction 3</a></p><p>Chapter about 2024</p>');
    const { html } = await DocxImport.toHtml(buf);
    expect(html).not.toContain("Introduction 3");
    expect(html).toContain("Chapter about 2024"); // ends in a digit but nothing is anchored
  });

  it("unwraps internal and href-less anchors, keeps external links", async () => {
    stub('<p><a href="#bm">see section</a> for details</p>' +
         '<p><a>no href</a></p>' +
         '<p><a href="https://example.com">external</a></p>');
    const { html } = await DocxImport.toHtml(buf);
    expect(html).toContain("see section for details");
    expect(html).not.toContain("#bm");
    expect(html).toContain("no href");
    expect(html).not.toContain("<a>no href</a>");
    expect(html).toContain('href="https://example.com"');
  });

  it("drops empty paragraphs but keeps image-only ones", async () => {
    stub('<p>   </p><p><img src="data:image/png;base64,AAA"></p><p>kept</p>');
    const { html } = await DocxImport.toHtml(buf);
    expect(html).not.toContain("<p>   </p>");
    expect(html).toContain("img");
    expect(html).toContain("kept");
  });
});

describe("tidyMessages via toHtml", () => {
  it("filters 'unrecognised style' noise once there are 3+ messages", async () => {
    stub("<p>x</p>", [
      { message: "An unrecognised paragraph style was ignored: Fancy" },
      { message: "An unrecognised run style was ignored: Zap" },
      { message: "Image of unsupported type" },
    ]);
    const { messages } = await DocxImport.toHtml(buf);
    expect(messages).toEqual(["Image of unsupported type"]);
  });

  it("keeps style noise when there are fewer than 3 messages (preserved quirk)", async () => {
    stub("<p>x</p>", [
      { message: "An unrecognised paragraph style was ignored: Fancy" },
      { message: "Something else" },
    ]);
    const { messages } = await DocxImport.toHtml(buf);
    expect(messages).toEqual(["An unrecognised paragraph style was ignored: Fancy", "Something else"]);
  });

  it("dedupes and caps at 8", async () => {
    stub("<p>x</p>", [
      { message: "dup" }, { message: "dup" }, { message: "dup" },
      ...Array.from({ length: 12 }, (_, i) => ({ message: "warn " + i })),
    ]);
    const { messages } = await DocxImport.toHtml(buf);
    expect(messages).toHaveLength(8);
    expect(messages[0]).toBe("dup");
    expect(new Set(messages).size).toBe(8);
  });
});

describe("mammoth wiring", () => {
  it("passes the style map, image converter and arrayBuffer through", async () => {
    let seen: { input?: unknown; options?: any } = {};
    window.mammoth = {
      convertToHtml: async (input: unknown, options: unknown) => {
        seen = { input, options };
        return { value: "<p>x</p>", messages: [] };
      },
      images: { imgElement: (h: unknown) => ({ handler: h }) },
    } as unknown as MammothLib;

    await DocxImport.toHtml(buf);
    expect((seen.input as { arrayBuffer: ArrayBuffer }).arrayBuffer).toBe(buf);
    expect(seen.options.ignoreEmptyParagraphs).toBe(true);
    expect(seen.options.styleMap).toHaveLength(11);
    expect(seen.options.styleMap[0]).toBe("u => u");
    expect(seen.options.styleMap).toContain("highlight => mark");

    // the image callback builds a data: URI from the read base64
    const handler = seen.options.convertImage.handler as
      (img: MammothImage) => Promise<{ src: string; alt: string }>;
    const out = await handler({ contentType: "image/png", altText: "chart", read: async () => "AAA" });
    expect(out).toEqual({ src: "data:image/png;base64,AAA", alt: "chart" });
  });

  it("tolerates the pre-1.4 images.inline name", async () => {
    let convertImage: unknown = null;
    window.mammoth = {
      convertToHtml: async (_i: unknown, options: any) => {
        convertImage = options.convertImage;
        return { value: "<p>x</p>", messages: [] };
      },
      images: { inline: (h: unknown) => ({ via: "inline", h }) },
    } as unknown as MammothLib;
    await DocxImport.toHtml(buf);
    expect((convertImage as { via: string }).via).toBe("inline");
  });

  it("wraps converter failures in the honest .doc hint, keeping the cause", async () => {
    const orig = new Error("boom");
    window.mammoth = {
      convertToHtml: async () => { throw orig; },
    } as unknown as MammothLib;
    const p = DocxImport.toHtml(buf);
    await expect(p).rejects.toThrow(
      "Could not read that Word file — if it is an old binary .doc, save it as .docx first.");
    const err = await p.catch(e => e);
    expect((err as { cause?: unknown }).cause).toBe(orig);
  });

  it("reports an unbundled build honestly", async () => {
    await expect(DocxImport.toHtml(buf)).rejects.toThrow("Word import is not bundled in this build");
  });
});
