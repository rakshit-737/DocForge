/* ============================================================
   docx-export.js — rendered DOM → real .docx (docx library)
   ============================================================ */
"use strict";

const DocxExport = (() => {

  const HP = pt => Math.round(pt * 2); // half-points
  const hex = c => String(c).replace("#", "").toUpperCase();

  const WORD_FONTS = {
    modern:    { head: "Calibri",       body: "Calibri" },
    executive: { head: "Georgia",       body: "Calibri" },
    academic:  { head: "Cambria",       body: "Cambria" },
    minimal:   { head: "Calibri Light", body: "Calibri" },
  };

  function dataUrlBytes(dataUrl) {
    const i = dataUrl.indexOf(",");
    const b64 = dataUrl.slice(i + 1);
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
    const mime = (dataUrl.slice(0, i).match(/image\/(\w+)/) || [])[1] || "png";
    return { arr, type: mime === "jpeg" ? "jpg" : mime };
  }

  function build(contentEl, settings, attachments) {
    const D = window.docx;
    const {
      Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow,
      TableCell, WidthType, BorderStyle, PageNumber, Footer, Header, PageBreak,
      TableOfContents, ExternalHyperlink, ImageRun, LevelFormat, HeightRule, VerticalAlign,
      convertMillimetersToTwip: mm2t,
    } = D;

    const t = Engine.tints(settings.accent);
    const f = WORD_FONTS[settings.theme] || WORD_FONTS.modern;
    const pg = Engine.PAGES[settings.page] || Engine.PAGES.A4;
    const mg = Engine.MARGINS[settings.margins] || Engine.MARGINS.normal;
    const availPx = Math.floor((pg.w - mg.l - mg.r) * 96 / 25.4) - 4;
    const centeredCover = settings.theme === "academic";

    let olInstance = 0;
    const blocks = [];

    /* ---------------- inline runs ---------------- */
    function runs(node, fmt = {}) {
      const out = [];
      node.childNodes.forEach(ch => {
        if (ch.nodeType === 3) {
          const txt = ch.textContent.replace(/\s+/g, " ");
          if (txt) out.push(new TextRun({
            text: txt,
            bold: fmt.bold, italics: fmt.italics, strike: fmt.strike,
            font: fmt.code ? "Consolas" : undefined,
            size: fmt.code ? HP(9.5) : fmt.size,
            color: fmt.color,
            shading: fmt.code ? { fill: "F0F2F5" } : undefined,
          }));
          return;
        }
        if (ch.nodeType !== 1) return;
        const tag = ch.tagName.toLowerCase();
        if (tag === "br") { out.push(new TextRun({ text: "", break: 1 })); return; }
        if (tag === "img") return; // block-level path handles images
        const nf = { ...fmt };
        if (tag === "strong" || tag === "b") nf.bold = true;
        else if (tag === "em" || tag === "i") nf.italics = true;
        else if (tag === "del" || tag === "s") nf.strike = true;
        else if (tag === "code") nf.code = true;
        else if (tag === "span" && ch.classList.contains("hnum")) { nf.color = hex(t.a600); nf.bold = true; }
        if (tag === "a" && ch.getAttribute("href") && /^https?:/i.test(ch.getAttribute("href"))) {
          out.push(new ExternalHyperlink({ link: ch.getAttribute("href"), children: runs(ch, { ...nf, color: hex(t.a700) }) }));
          return;
        }
        out.push(...runs(ch, nf));
      });
      return out;
    }

    const para = (el, opts = {}) => new Paragraph({ children: runs(el, opts.fmt || {}), ...opts });

    /* ---------------- block handlers ---------------- */
    function heading(el, first) {
      const lvl = +el.tagName[1];
      const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4 };
      blocks.push(new Paragraph({
        heading: map[lvl],
        pageBreakBefore: lvl === 1 && settings.h1break && !first,
        children: runs(el),
        border: lvl === 1 ? { bottom: { style: BorderStyle.SINGLE, size: 8, color: hex(t.a600), space: 3 } } : undefined,
      }));
    }

    function list(el, depth) {
      const ordered = el.tagName.toLowerCase() === "ol";
      if (ordered && depth === 0) olInstance++;
      [...el.children].forEach(li => {
        if (li.tagName.toLowerCase() !== "li") return;
        const sub = [...li.children].filter(c => /^(ul|ol)$/i.test(c.tagName));
        const clone = li.cloneNode(true);
        [...clone.children].forEach(c => { if (/^(ul|ol)$/i.test(c.tagName)) c.remove(); });
        blocks.push(new Paragraph({
          children: runs(clone),
          numbering: ordered ? { reference: "ol-num", level: Math.min(depth, 2), instance: olInstance } : undefined,
          bullet: ordered ? undefined : { level: Math.min(depth, 2) },
          spacing: { after: 60 },
        }));
        sub.forEach(s => list(s, depth + 1));
      });
    }

    function mdTable(el) {
      const rows = [];
      const trs = [...el.querySelectorAll("tr")];
      trs.forEach(tr => {
        const isHead = !!tr.querySelector("th");
        const cells = [...tr.children].map(td => new TableCell({
          shading: isHead ? { fill: hex(t.a75) } : undefined,
          margins: { top: 70, bottom: 70, left: 110, right: 110 },
          children: [new Paragraph({
            children: runs(td, isHead ? { bold: true, color: hex(t.a900) } : {}),
            spacing: { after: 0 },
          })],
        }));
        rows.push(new TableRow({ children: cells, cantSplit: true, tableHeader: isHead }));
      });
      blocks.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 8, color: hex(t.a600) },
          bottom: { style: BorderStyle.SINGLE, size: 8, color: hex(t.a600) },
          left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "DFE2E7" },
        },
      }));
      blocks.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
    }

    function boxTable(children, { fill, border, dashed, height }) {
      const bs = { style: dashed ? BorderStyle.DASHED : BorderStyle.SINGLE, size: dashed ? 12 : 4, color: border };
      blocks.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({
          height: height ? { value: height, rule: HeightRule.ATLEAST } : undefined,
          children: [new TableCell({
            shading: { fill },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 130, bottom: 130, left: 170, right: 170 },
            children,
          })],
        })],
        borders: { top: bs, bottom: bs, left: bs, right: bs },
      }));
      blocks.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
    }

    function callout(el) {
      const type = ["note", "tip", "warning", "important"].find(c => el.classList.contains(c)) || "note";
      const colors = { note: "2458C5", tip: "0E7A52", warning: "B26205", important: "BB2432" };
      const fills = { note: "EEF3FC", tip: "EBF7F1", warning: "FDF4E7", important: "FCEDEE" };
      const titleEl = el.querySelector(".co-title");
      const bodyEl = el.querySelector(".co-body");
      const inner = [new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: (titleEl?.textContent || "Note").toUpperCase(), bold: true, size: HP(9), color: colors[type], font: f.head, characterSpacing: 16 })],
      })];
      if (bodyEl) [...bodyEl.children].forEach(c => {
        const tag = c.tagName.toLowerCase();
        if (tag === "p") inner.push(new Paragraph({ children: runs(c), spacing: { after: 60 } }));
        else if (tag === "ul" || tag === "ol") [...c.querySelectorAll("li")].forEach(li =>
          inner.push(new Paragraph({ children: [new TextRun({ text: "•  " }), ...runs(li)], spacing: { after: 40 }, indent: { left: 200 } })));
        else inner.push(new Paragraph({ children: [new TextRun(c.textContent)], spacing: { after: 60 } }));
      });
      const bs = side => ({ style: BorderStyle.SINGLE, size: side === "left" ? 20 : 2, color: side === "left" ? colors[type] : fills[type] });
      blocks.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({
          children: [new TableCell({
            shading: { fill: fills[type] },
            margins: { top: 110, bottom: 110, left: 170, right: 170 },
            children: inner,
          })],
        })],
        borders: { top: bs("t"), bottom: bs("b"), right: bs("r"), left: bs("left") },
      }));
      blocks.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
    }

    function codeBlock(el) {
      const text = el.textContent.replace(/\n$/, "");
      const paras = text.split("\n").map(line => new Paragraph({
        spacing: { after: 0, line: 240 },
        children: [new TextRun({ text: line || " ", font: "Consolas", size: HP(9) })],
      }));
      boxTable(paras, { fill: "F6F8FA", border: "E2E5EA" });
    }

    function figureBlock(el) {
      const cap = el.dataset.caption || "";
      const fign = el.dataset.fig;
      const img = el.querySelector("img");
      if (img && img.src.startsWith("data:")) {
        try {
          const { arr, type } = dataUrlBytes(img.src);
          const natW = +img.getAttribute("width") || 900;
          const natH = +img.getAttribute("height") || 600;
          const scale = Math.min(1, availPx / natW);
          blocks.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 60, line: 240, lineRule: D.LineRuleType ? D.LineRuleType.AT_LEAST : "atLeast" },
            children: [new ImageRun({ type, data: arr, transformation: { width: Math.round(natW * scale), height: Math.round(natH * scale) } })],
          }));
        } catch (e) { /* skip broken image */ }
      } else if (el.classList.contains("shot")) {
        boxTable([
          new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { after: 50 },
            children: [new TextRun({ text: "SCREENSHOT PLACEHOLDER", bold: true, size: HP(9.5), color: hex(t.a700), font: f.head, characterSpacing: 24 })],
          }),
          ...(cap ? [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: cap, size: HP(9.5), color: "4A5160" })],
          })] : []),
        ], { fill: hex(t.a50), border: hex(t.a400), dashed: true, height: 2400 });
        // remove the spacer added by boxTable so caption hugs the box
        blocks.pop();
      }
      if (fign) blocks.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 140 },
        children: [
          new TextRun({ text: `Figure ${fign}`, bold: true, size: HP(8.8), color: hex(t.a800) }),
          ...(cap ? [new TextRun({ text: " — " + cap, size: HP(8.8), color: "5B6270" })] : []),
        ],
      }));
    }

    function toc() {
      blocks.push(new Paragraph({
        spacing: { after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: hex(t.a600), space: 3 } },
        children: [new TextRun({ text: "Contents", bold: true, size: HP(18), font: f.head })],
      }));
      blocks.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" }));
      blocks.push(new Paragraph({ children: [new PageBreak()] }));
    }

    /* ---------------- walk content ---------------- */
    function walk(el, first) {
      const tag = el.tagName ? el.tagName.toLowerCase() : "";
      if (/^h[1-4]$/.test(tag)) return heading(el, first);
      if (tag === "p") {
        if (!el.textContent.trim() && !el.querySelector("img")) return;
        return blocks.push(new Paragraph({
          children: runs(el),
          alignment: settings.justify ? AlignmentType.JUSTIFIED : undefined,
        }));
      }
      if (tag === "ul" || tag === "ol") return list(el, 0);
      if (tag === "table") return mdTable(el);
      if (tag === "pre") return codeBlock(el);
      if (tag === "blockquote") {
        return [...el.children].forEach(c => blocks.push(new Paragraph({
          children: runs(c, { italics: true, color: "3D434D" }),
          indent: { left: 360 },
          border: { left: { style: BorderStyle.SINGLE, size: 16, color: hex(t.a300), space: 12 } },
        })));
      }
      if (tag === "figure") return figureBlock(el);
      if (tag === "hr") return blocks.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D7DBE0" } },
        spacing: { before: 160, after: 200 }, children: [],
      }));
      if (el.classList) {
        if (el.classList.contains("page-break")) return blocks.push(new Paragraph({ children: [new PageBreak()] }));
        if (el.classList.contains("toc-wrap")) return toc();
        if (el.classList.contains("callout")) return callout(el);
      }
      if (el.children) [...el.children].forEach(c => walk(c, false));
    }

    const kids = [...contentEl.children];
    kids.forEach((el, i) => walk(el, i === 0));

    /* ---------------- cover ---------------- */
    const cover = [];
    if (settings.cover) {
      const al = centeredCover ? AlignmentType.CENTER : AlignmentType.LEFT;
      if (!centeredCover) {
        cover.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({
            height: { value: 220, rule: HeightRule.EXACT },
            children: [new TableCell({ shading: { fill: hex(t.a700) }, children: [new Paragraph({ children: [], spacing: { after: 0 } })] })],
          })],
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        }));
      }
      cover.push(new Paragraph({ spacing: { before: centeredCover ? 2600 : 1800, after: 200 }, alignment: al,
        children: settings.kicker ? [new TextRun({ text: settings.kicker.toUpperCase(), bold: true, size: HP(10), color: hex(t.a700), characterSpacing: 44, font: f.head })] : [] }));
      cover.push(new Paragraph({ alignment: al, spacing: { after: 260 },
        border: centeredCover ? { top: { style: BorderStyle.SINGLE, size: 12, color: "14181F", space: 10 }, bottom: { style: BorderStyle.SINGLE, size: 12, color: "14181F", space: 10 } } : undefined,
        children: [new TextRun({ text: settings.title || "Untitled document", bold: true, size: HP(31), color: "10141A", font: f.head })] }));
      if (settings.subtitle) cover.push(new Paragraph({ alignment: al, spacing: { after: 300 },
        children: [new TextRun({ text: settings.subtitle, size: HP(13.5), color: "4A5160" })] }));
      cover.push(new Paragraph({ spacing: { before: 2400, after: 0 }, children: [] }));
      cover.push(new Table({
        alignment: centeredCover ? AlignmentType.CENTER : AlignmentType.LEFT,
        width: { size: 1250, type: WidthType.DXA },
        rows: [new TableRow({
          height: { value: 70, rule: HeightRule.EXACT },
          children: [new TableCell({ shading: { fill: hex(t.a500) }, children: [new Paragraph({ children: [], spacing: { after: 0 } })] })],
        })],
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      }));
      cover.push(new Paragraph({ spacing: { before: 260, after: 0 }, children: [] }));
      const metaLines = [];
      if (settings.author) metaLines.push(new TextRun({ text: settings.author, bold: true, size: HP(11.5), color: "171C23" }));
      if (settings.metaExtra) metaLines.push(new TextRun({ text: settings.metaExtra, size: HP(10.5), color: "2A303A", break: settings.author ? 1 : 0 }));
      const ds = Engine.fmtDate(settings.date);
      if (ds) metaLines.push(new TextRun({ text: ds, size: HP(10.5), color: "6A7180", break: metaLines.length ? 1 : 0 }));
      cover.push(new Paragraph({ alignment: al, children: metaLines }));
      cover.push(new Paragraph({ children: [new PageBreak()] }));
    }

    /* ---------------- document ---------------- */
    const headerChildren = settings.header ? [new Paragraph({
      children: [new TextRun({ text: (settings.title || "").toUpperCase(), size: HP(7.6), color: "828A99", characterSpacing: 26 })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "E3E6EB", space: 4 } },
    })] : [];
    const pgRun = kids2 => new TextRun({ size: HP(8.2), color: "71798A", children: kids2 });
    const footerChildren = settings.pageNums ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [pgRun(["Page "]), pgRun([PageNumber.CURRENT]), pgRun([" of "]), pgRun([PageNumber.TOTAL_PAGES])],
    })] : [];

    const doc = new Document({
      creator: settings.author || "DocForge",
      title: settings.title || "Document",
      features: { updateFields: true },
      styles: {
        default: {
          document: { run: { font: f.body, size: HP(11), color: "1C2128" }, paragraph: { spacing: { after: 140, line: 288 } } },
          heading1: { run: { font: f.head, size: HP(20), bold: true, color: "12161C" }, paragraph: { spacing: { before: 360, after: 180 } } },
          heading2: { run: { font: f.head, size: HP(14.5), bold: true, color: hex(t.a800) }, paragraph: { spacing: { before: 280, after: 120 } } },
          heading3: { run: { font: f.head, size: HP(12), bold: true, color: "12161C" }, paragraph: { spacing: { before: 220, after: 100 } } },
          heading4: { run: { font: f.head, size: HP(11), bold: true, italics: true, color: "333A45" }, paragraph: { spacing: { before: 180, after: 80 } } },
          hyperlink: { run: { color: hex(t.a700), underline: {} } },
        },
      },
      numbering: {
        config: [{
          reference: "ol-num",
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 620, hanging: 320 } } } },
            { level: 1, format: LevelFormat.LOWER_LETTER, text: "%2.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 1120, hanging: 320 } } } },
            { level: 2, format: LevelFormat.LOWER_ROMAN, text: "%3.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 1620, hanging: 320 } } } },
          ],
        }],
      },
      sections: [{
        properties: {
          titlePage: settings.cover,
          page: {
            size: { width: mm2t(pg.w), height: mm2t(pg.h) },
            margin: { top: mm2t(mg.t), right: mm2t(mg.r), bottom: mm2t(mg.b), left: mm2t(mg.l) },
          },
        },
        headers: { default: new Header({ children: headerChildren }), first: new Header({ children: [] }) },
        footers: { default: new Footer({ children: footerChildren }), first: new Footer({ children: [] }) },
        children: [...cover, ...blocks],
      }],
    });

    return D.Packer.toBlob(doc);
  }

  return { build };
})();
