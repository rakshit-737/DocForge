/* ============================================================
   file-import.ts — more formats in, Markdown out
   (the in-browser slice of Microsoft's MarkItDown idea)

   Ported 1:1 from src/js/file-import.js (302 lines) — Phase 1. Types were
   added AROUND the unchanged logic; no behavior, regex, string literal or
   iteration order was altered.

   Everything here is offline and dependency-free: OOXML/EPUB packages are
   opened with a ~60-line zip reader on top of the browser's native
   DecompressionStream, and the XML is walked with DOMParser. Converters
   return Markdown in DocForge's own dialect, so an imported workbook or
   deck is immediately a first-class editable document.
   ============================================================ */

/* ---------- zip (read-only) ----------
   Central-directory walk, then per-entry inflate on demand. Method 0 is a
   plain slice; method 8 rides DecompressionStream("deflate-raw") — native
   in every Chromium the app supports, so no inflate library is bundled. */
const u16 = (d: DataView, o: number): number => d.getUint16(o, true);
const u32 = (d: DataView, o: number): number => d.getUint32(o, true);

async function inflateRaw(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface ZipEntry { method: number; compSize: number; localOff: number }

export interface ZipReader {
  has(name: string): boolean;
  names(): string[];
  bytes(name: string): Promise<Uint8Array>;
  text(name: string): Promise<string>;
}

function zipOpen(buf: ArrayBuffer): ZipReader {
  const bytes = new Uint8Array(buf);
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 22 - 65536; i--) {
    if (u32(d, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not a zip-based file");
  const count = u16(d, eocd + 10);
  let p = u32(d, eocd + 16);
  const dec = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  for (let i = 0; i < count; i++) {
    if (u32(d, p) !== 0x02014b50) throw new Error("Damaged zip directory");
    const method = u16(d, p + 10);
    const compSize = u32(d, p + 20);
    const nameLen = u16(d, p + 28), extraLen = u16(d, p + 30), cmtLen = u16(d, p + 32);
    const localOff = u32(d, p + 42);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method, compSize, localOff });
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return {
    has: name => entries.has(name),
    names: () => [...entries.keys()],
    /* Uint8Array of the stored file */
    async bytes(name) {
      const e = entries.get(name);
      if (!e) throw new Error("Missing zip entry: " + name);
      // the local header repeats name/extra with its own lengths
      const lh = e.localOff;
      if (u32(d, lh) !== 0x04034b50) throw new Error("Damaged zip entry");
      const start = lh + 30 + u16(d, lh + 26) + u16(d, lh + 28);
      const raw = bytes.subarray(start, start + e.compSize);
      if (e.method === 0) return raw;
      if (e.method === 8) return inflateRaw(raw);
      throw new Error("Unsupported zip compression");
    },
    async text(name) { return new TextDecoder().decode(await this.bytes(name)); },
  };
}

/* ---------- XML helpers ----------
   Office XML is namespaced; matching on localName keeps this immune to
   whatever prefixes a producer chose. */
const xml = (s: string): Document => {
  const doc = new DOMParser().parseFromString(s, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Damaged XML part");
  return doc;
};
const local = (node: Document | Element, name: string): Element[] =>
  [...node.getElementsByTagNameNS("*", name)];

const mdCell = (t: unknown): string =>
  String(t ?? "").replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();

function mdTable(rows: unknown[][]): string {
  if (!rows.length) return "";
  const width = Math.max(...rows.map(r => r.length));
  const pad = (r: unknown[]) => { const o = r.slice(); while (o.length < width) o.push(""); return o; };
  const line = (r: unknown[]) => "| " + pad(r).map(mdCell).join(" | ") + " |";
  return [line(rows[0]!), "| " + Array(width).fill("---").join(" | ") + " |", ...rows.slice(1).map(line)].join("\n");
}

/* ---------- CSV / TSV ---------- */
function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [[]];
  let field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === delim) { rows[rows.length - 1]!.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      rows[rows.length - 1]!.push(field); field = "";
      rows.push([]);
    } else field += c;
  }
  rows[rows.length - 1]!.push(field);
  // drop a trailing blank record from a final newline
  while (rows.length && rows[rows.length - 1]!.every(f => f === "")) rows.pop();
  return rows;
}

function csv(text: string): string {
  // sniff the delimiter from the first line, outside quotes
  const first = (text.match(/^.*$/m) || [""])[0]!.replace(/"[^"]*"/g, "");
  const counts = ([[",", 0], [";", 0], ["\t", 0]] as [string, number][])
    .map(([ch]) => [ch, first.split(ch).length - 1] as [string, number]);
  counts.sort((a, b) => b[1] - a[1]);
  const delim = counts[0]![1] > 0 ? counts[0]![0] : ",";
  // (the source file wrote the BOM as a literal U+FEFF character; ﻿ is the same regex)
  return mdTable(parseCsv(text.replace(/^﻿/, ""), delim));
}

/* ---------- XLSX ----------
   Each sheet becomes "## Sheet name" plus a table, mirroring MarkItDown.
   Covers shared strings, inline strings, numbers and booleans; dates print
   as their underlying serial number (styles are not interpreted). */
const colIndex = (ref: string | null): number => {
  const m = /^([A-Z]+)/.exec(ref || "");
  if (!m) return -1;
  let n = 0;
  for (const ch of m[1]!) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

async function xlsx(buf: ArrayBuffer): Promise<string> {
  const z = zipOpen(buf);
  const wb = xml(await z.text("xl/workbook.xml"));
  const rels = xml(await z.text("xl/_rels/workbook.xml.rels"));
  const relMap: Record<string, string | null> = {};
  local(rels, "Relationship").forEach(r => { relMap[r.getAttribute("Id") as string] = r.getAttribute("Target"); });

  let shared: string[] = [];
  if (z.has("xl/sharedStrings.xml")) {
    const ss = xml(await z.text("xl/sharedStrings.xml"));
    shared = local(ss, "si").map(si => local(si, "t").map(t => t.textContent).join(""));
  }

  const parts: string[] = [];
  for (const sh of local(wb, "sheet")) {
    const rid = sh.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || sh.getAttribute("r:id");
    let target = relMap[rid as string];
    if (!target) continue;
    target = target.replace(/^\//, "").startsWith("xl/") ? target.replace(/^\//, "") : "xl/" + target.replace(/^\.?\//, "");
    if (!z.has(target)) continue;
    const doc = xml(await z.text(target));
    const rows: string[][] = [];
    for (const row of local(doc, "row")) {
      const out: string[] = [];
      for (const c of local(row, "c")) {
        const idx = colIndex(c.getAttribute("r"));
        const t = c.getAttribute("t");
        let v = "";
        if (t === "inlineStr") v = local(c, "t").map(n => n.textContent).join("");
        else {
          const vEl = local(c, "v")[0];
          v = vEl ? vEl.textContent as string : "";
          if (t === "s") v = shared[+v] ?? "";
          else if (t === "b") v = v === "1" ? "TRUE" : "FALSE";
        }
        if (idx >= 0) { while (out.length < idx) out.push(""); out[idx] = v; }
        else out.push(v);
      }
      rows.push(out);
    }
    while (rows.length && rows[rows.length - 1]!.every(f => !String(f).trim())) rows.pop();
    if (rows.length) parts.push(`## ${sh.getAttribute("name") || "Sheet"}\n\n${mdTable(rows)}`);
  }
  if (!parts.length) throw new Error("No readable sheets in that workbook");
  return parts.join("\n\n");
}

/* ---------- PPTX ----------
   Slides in presentation order: the title placeholder becomes a heading,
   body placeholders become bullets (indented by outline level), free text
   boxes become paragraphs, tables become tables, and speaker notes arrive
   as a callout so they survive into both exports. */
const runText = (p: Document | Element): string => local(p, "t").map(t => t.textContent).join("");

function shapeParagraphs(sp: Element): { text: string; lvl: number }[] {
  const out: { text: string; lvl: number }[] = [];
  for (const p of local(sp, "p")) {
    const txt = runText(p).trim();
    if (!txt) continue;
    const pPr = local(p, "pPr")[0];
    out.push({ text: txt, lvl: pPr ? +(pPr.getAttribute("lvl") || 0) : 0 });
  }
  return out;
}

async function pptx(buf: ArrayBuffer): Promise<string> {
  const z = zipOpen(buf);
  const pres = xml(await z.text("ppt/presentation.xml"));
  const rels = xml(await z.text("ppt/_rels/presentation.xml.rels"));
  const relMap: Record<string, string | null> = {};
  local(rels, "Relationship").forEach(r => { relMap[r.getAttribute("Id") as string] = r.getAttribute("Target"); });

  const slides: string[] = [];
  for (const sid of local(pres, "sldId")) {
    const rid = sid.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || sid.getAttribute("r:id");
    const target = (relMap[rid as string] || "").replace(/^\.?\//, "");
    if (target) slides.push("ppt/" + target);
  }
  if (!slides.length) throw new Error("No slides in that deck");

  const parts: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    const path = slides[i]!;
    if (!z.has(path)) continue;
    const doc = xml(await z.text(path));
    const chunks: string[] = [];
    let title = "";

    for (const sp of local(doc, "sp")) {
      const ph = local(sp, "ph")[0];
      const type = ph ? (ph.getAttribute("type") || "body") : null;
      const paras = shapeParagraphs(sp);
      if (!paras.length) continue;
      if (!title && (type === "title" || type === "ctrTitle")) { title = paras.map(p => p.text).join(" — "); continue; }
      if (ph) chunks.push(paras.map(p => "  ".repeat(Math.min(p.lvl, 3)) + "- " + p.text).join("\n"));
      else chunks.push(paras.map(p => p.text).join("\n\n"));
    }
    for (const tbl of local(doc, "tbl")) {
      const rows = local(tbl, "tr").map(tr => local(tr, "tc").map(tc => runText(tc)));
      if (rows.length) chunks.push(mdTable(rows));
    }

    // speaker notes travel via the slide's own rels
    const slideRels = path.replace(/slides\//, "slides/_rels/") + ".rels";
    if (z.has(slideRels)) {
      const sr = xml(await z.text(slideRels));
      const note = local(sr, "Relationship").find(r => /notesSlide/.test(r.getAttribute("Type") || ""));
      if (note) {
        const notePath = "ppt/" + (note.getAttribute("Target") as string).replace(/^(\.\.\/)+/, "").replace(/^\.?\//, "");
        if (z.has(notePath)) {
          const nd = xml(await z.text(notePath));
          const text = local(nd, "sp").map(sp => shapeParagraphs(sp).map(p => p.text).join("\n"))
            .join("\n").replace(/^\s*\d+\s*$/gm, "").trim();
          if (text) chunks.push(`:::note Speaker notes\n${text}\n:::`);
        }
      }
    }

    parts.push(`# ${title || "Slide " + (i + 1)}\n\n${chunks.join("\n\n")}`.trim());
  }
  return parts.join("\n\n");
}

/* ---------- EPUB ----------
   container.xml names the OPF, the OPF's spine gives reading order, and
   each chapter runs through the app's HTML→Markdown converter. */
async function epub(
  buf: ArrayBuffer,
  htmlToMd: (html: string) => string | null | undefined,
): Promise<string> {
  const z = zipOpen(buf);
  const container = xml(await z.text("META-INF/container.xml"));
  const rootfile = local(container, "rootfile")[0];
  if (!rootfile) throw new Error("Not an EPUB (no rootfile)");
  const opfPath = rootfile.getAttribute("full-path") as string;
  const base = opfPath.includes("/") ? opfPath.replace(/[^/]+$/, "") : "";
  const opf = xml(await z.text(opfPath));

  const manifest: Record<string, string | null> = {};
  local(opf, "item").forEach(it => { manifest[it.getAttribute("id") as string] = it.getAttribute("href"); });
  const order = local(opf, "itemref").map(ir => manifest[ir.getAttribute("idref") as string]).filter(Boolean) as string[];
  if (!order.length) throw new Error("Empty EPUB spine");

  const parts: string[] = [];
  for (const href of order) {
    const path = decodeURIComponent(base + href).replace(/^\.?\//, "");
    if (!z.has(path)) continue;
    const md = htmlToMd(await z.text(path));
    if (md && md.trim()) parts.push(md.trim());
  }
  return parts.join("\n\n[pagebreak]\n\n");
}

/* ---------- Jupyter notebook ----------
   Markdown cells pass through; code cells become fenced blocks in the
   notebook's language; outputs are omitted (they rarely print well). */
function ipynb(text: string): string {
  const nb = JSON.parse(text);
  const lang = nb?.metadata?.kernelspec?.language || nb?.metadata?.language_info?.name || "";
  const src = (c: any) => Array.isArray(c.source) ? c.source.join("") : String(c.source || "");
  const parts: string[] = [];
  for (const cell of nb.cells || []) {
    const body = src(cell).trim();
    if (!body) continue;
    if (cell.cell_type === "markdown") parts.push(body);
    else if (cell.cell_type === "code") parts.push("```" + lang + "\n" + body + "\n```");
  }
  if (!parts.length) throw new Error("Empty notebook");
  return parts.join("\n\n");
}

/* Public surface — exactly the classic FileImport global. */
export const FileImport = { csv, xlsx, pptx, epub, ipynb };
export type FileImportApi = typeof FileImport;

/* Test-only access to internals (additive; NOT part of the public surface
   and NOT assigned onto the global). */
export const _internals = { zipOpen, inflateRaw, parseCsv, mdCell, mdTable, colIndex };
