/* ============================================================
   Block constructs through the full render(): screenshots, table
   captions, callouts, alignment, banner, pagebreak, lof/lot.
   Structural/attribute assertions (postprocess mutates the DOM);
   byte-level parity is pinned by test/parity.test.ts.
   ============================================================ */
import { describe, expect, it } from "vitest";
import { r } from "./_helpers.js";

const A4_COL_PX = ((210 - 20 - 20) * 96) / 25.4; // PAGES.A4 minus normal margins

describe("screenshots", () => {
  it("placeholder when no attachment: box, hint, figcaption, numbering", () => {
    const { content } = r("[screenshot: The bench setup]");
    const f = content.querySelector("figure.shot") as HTMLElement;
    expect(f).toBeTruthy();
    expect(f.dataset.idx).toBe("0");
    expect(f.dataset.fig).toBe("1");
    expect(f.getAttribute("contenteditable")).toBe("false");
    expect(f.querySelector(".shot-box .shot-t")?.textContent).toBe("Screenshot placeholder");
    expect(f.querySelector(".shot-box svg.shot-ic")).toBeTruthy();
    expect(f.querySelector(".shot-hint")?.textContent).toBe("click to attach image");
    const fc = f.querySelector("figcaption") as HTMLElement;
    expect(fc.textContent).toBe("Figure\u00A01 \u2014 The bench setup"); // label binds with a no-break space
    expect(fc.querySelector(".fig-label")?.textContent).toBe("Figure\u00A01");
  });
  it("placeholder honours w: on the box", () => {
    const { content } = r("[screenshot: X | w:40%]");
    const f = content.querySelector("figure.shot") as HTMLElement;
    const box = f.querySelector(".shot-box") as HTMLElement;
    expect(box.style.width).toBe("40%");
    expect(f.dataset.w).toBe("40.00");
  });
  it("an attached image prints at natural size, capped to the column", () => {
    const att = { dataUrl: "data:image/png;base64,QUJD", w: 100, h: 50 };
    const { content } = r("[screenshot: Cap | img:k]", {}, { k: att });
    const img = content.querySelector("figure.shot img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(att.dataUrl);
    expect(img.width).toBe(100);
    expect(img.height).toBe(50);
    const pct = Math.min(100, (100 / A4_COL_PX) * 100);
    // style serializers round differently (Chrome: "15.5637%"); compare numerically
    expect(parseFloat(img.style.width)).toBeCloseTo(pct, 3);
    expect(img.style.height).toBe("auto");
    expect(img.alt).toBe("Cap");
    const f = img.closest("figure") as HTMLElement;
    expect(f.dataset.w).toBe(pct.toFixed(2));
  });
  it("an explicit w: wins over natural size; oversize caps at 100", () => {
    const att = { dataUrl: "data:image/png;base64,QUJD", w: 100, h: 50 };
    const { content } = r("[screenshot: Cap | img:k | w:60%]", {}, { k: att });
    const img = content.querySelector("figure.shot img") as HTMLImageElement;
    expect(img.style.width).toBe("60%");

    const big = { dataUrl: "data:image/png;base64,QUJD", w: 5000, h: 50 };
    const r2 = r("[screenshot: Cap | img:k]", {}, { k: big });
    expect((r2.content.querySelector("figure.shot img") as HTMLImageElement).style.width).toBe(
      "100%",
    );
  });
  it("noborder and explicit id survive to the DOM", () => {
    const { content } = r("[screenshot: S | #fig:setup | noborder]");
    const f = content.querySelector("figure.shot") as HTMLElement;
    expect(f.classList.contains("noborder")).toBe(true);
    expect(f.id).toBe("fig:setup");
  });
});

describe("markdown images become figures", () => {
  it("a lone image paragraph is promoted, alt becomes the caption", () => {
    const { content, meta } = r("![Alt cap](data:image/gif;base64,R0lGOD)");
    const f = content.querySelector("figure.img") as HTMLElement;
    expect(f).toBeTruthy();
    expect(content.querySelector("p > img")).toBeNull();
    expect(f.dataset.caption).toBe("Alt cap");
    expect(f.dataset.fig).toBe("1");
    expect(f.querySelector("figcaption")?.textContent).toBe("Figure\u00A01 \u2014 Alt cap");
    expect(meta.figures).toBe(1);
  });
  it("an image without alt gets no caption and no figure number", () => {
    const { content, meta } = r("![](data:image/gif;base64,R0lGOD)");
    const f = content.querySelector("figure.img") as HTMLElement;
    expect(f.dataset.caption).toBeUndefined();
    expect(f.dataset.fig).toBeUndefined();
    expect(f.querySelector("figcaption")).toBeNull();
    expect(meta.figures).toBe(0);
  });
  it("figures number in document order across kinds", () => {
    const { content, meta } = r("![One](data:x)\n\n[screenshot: Two]");
    const figs = [...content.querySelectorAll("figure")];
    expect(figs.map((f) => (f as HTMLElement).dataset.fig)).toEqual(["1", "2"]);
    expect(meta.figures).toBe(2);
  });
});

describe("table captions", () => {
  const TBL = "[table: Quarterly results | #tbl:q]\n\n| a | b |\n|---|---|\n| 1 | 2 |";
  it("the marker becomes a real <caption> on the table", () => {
    const { content } = r(TBL);
    const tb = content.querySelector("table") as HTMLTableElement;
    expect(content.querySelector("div[data-tablecap]")).toBeNull();
    expect(tb.dataset.tbl).toBe("1");
    expect(tb.dataset.caption).toBe("Quarterly results");
    expect(tb.id).toBe("tbl:q");
    expect(tb.dataset.explicitId).toBe("1");
    const cap = tb.querySelector("caption") as HTMLElement;
    expect(cap).toBe(tb.firstElementChild);
    expect(cap.textContent).toBe("Table\u00A01 \u2014 Quarterly results");
    expect(cap.querySelector(".tbl-label")?.textContent).toBe("Table\u00A01");
  });
  it("a caption marker with no following table is dropped silently", () => {
    const { content } = r("[table: Orphan]\n\nplain paragraph");
    expect(content.querySelector("div[data-tablecap]")).toBeNull();
    expect(content.querySelector("caption")).toBeNull();
  });
  it("tables are tagged data-tid in order for column measurement", () => {
    const { content } = r("| a |\n|---|\n| 1 |\n\ntext\n\n| b |\n|---|\n| 2 |");
    expect(
      [...content.querySelectorAll("table")].map((t) => (t as HTMLElement).dataset.tid),
    ).toEqual(["0", "1"]);
  });
});

describe("callouts, alignment, banner, pagebreak", () => {
  it("callout structure survives into the DOM", () => {
    const { content } = r(":::warning Watch out\nBe careful.\n:::");
    const co = content.querySelector(".callout.warning") as HTMLElement;
    expect(co.querySelector(".co-title")?.textContent).toBe("Watch out");
    expect(co.querySelector(".co-body p")?.textContent).toBe("Be careful.");
  });
  it("alignment groups wrap their content", () => {
    const { content } = r(":::center\nCentred.\n:::");
    expect(content.querySelector(".align-center p")?.textContent).toBe("Centred.");
  });
  it(":::banner renders the plate with its inner blocks", () => {
    const { content } = r(":::banner\n# The Plate\nsubtitle line\n:::");
    const b = content.querySelector(".banner") as HTMLElement;
    expect(b).toBeTruthy();
    expect(b.querySelector("h1")?.textContent).toBe("The Plate");
    expect(b.querySelector("p")?.textContent).toBe("subtitle line");
    // the banner's heading still gets an id (it is a real heading)
    expect(b.querySelector("h1")?.id).toBe("the-plate");
  });
  it("[pagebreak] emits the break div, read-only", () => {
    const { content } = r("a\n\n[pagebreak]\n\nb");
    const br = content.querySelector(".page-break") as HTMLElement;
    expect(br).toBeTruthy();
    expect(br.getAttribute("contenteditable")).toBe("false");
  });
});

describe("[lof] / [lot]", () => {
  it("lof lists captioned figures with dotted-leader anchors", () => {
    const { content } = r("[lof]\n\n[screenshot: Bench | #fig:setup]\n\n![Second](data:x)");
    const wrap = content.querySelector(".toc-wrap.list-wrap") as HTMLElement;
    expect(wrap.dataset.kind).toBe("fig");
    expect(wrap.getAttribute("contenteditable")).toBe("false");
    const links = [...wrap.querySelectorAll("a.l2")];
    expect(links.length).toBe(2);
    expect(links[0].getAttribute("href")).toBe("#fig:setup");
    expect(links[0].querySelector(".hnum")?.textContent).toBe("Figure\u00A01");
    expect(links[0].querySelector(".t")?.textContent).toBe("Figure\u00A01Bench");
    expect(links[0].querySelector(".dots")).toBeTruthy();
    // the figure without an explicit id got an auto id
    expect(links[1].getAttribute("href")).toBe("#fig-auto-2");
  });
  it("lot lists captioned tables", () => {
    const { content } = r("[lot]\n\n[table: Results | #tbl:q]\n\n| a |\n|---|\n| 1 |");
    const wrap = content.querySelector(".toc-wrap.list-wrap") as HTMLElement;
    expect(wrap.dataset.kind).toBe("tbl");
    const link = wrap.querySelector("a.l2") as HTMLElement;
    expect(link.getAttribute("href")).toBe("#tbl:q");
    expect(link.querySelector(".hnum")?.textContent).toBe("Table\u00A01");
  });
  it("an empty list collapses to an empty wrap (kind kept for the serializer)", () => {
    const { content } = r("[lof]\n\nno figures here");
    const wrap = content.querySelector(".toc-wrap.list-wrap") as HTMLElement;
    expect(wrap.innerHTML).toBe("");
    expect(wrap.dataset.kind).toBe("fig");
  });
});
