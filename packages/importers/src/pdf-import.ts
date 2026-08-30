/* ============================================================
   pdf-import.ts — turn an uploaded PDF into editable Markdown

   Ported 1:1 from src/js/pdf-import.js (420 lines) — Phase 1. The only
   sanctioned change: the two `(0, eval)` calls became Blob-URL module
   imports (see blob-import.ts); everything else is the same logic with
   types added around it.

   pdf.js hands back positioned text runs, not a document: strings pinned
   to (x, y) in PDF user space with no paragraphs, headings, or lists.
   This module rebuilds the prose — runs cluster into lines, lines into
   paragraphs, font sizes into a heading scale — and strips the page
   furniture (repeating headers/footers, bare page numbers) that only made
   sense while the text was nailed to a page.

   The pdf.js bundles ship embedded as string constants and are loaded
   lazily on first import, worker bundle first: with pdfjsWorker already
   on the global, pdf.js takes its main-thread fake-worker path, so no
   real Worker is ever created.

   PdfImport.toMarkdown(arrayBuffer) -> { source, pages, warnings }
   ============================================================ */

import { importGlobalScript } from "./blob-import.js";

/* ---------- pdf.js bootstrap ---------- */

let pdfjsLoading: Promise<void> | null = null;

async function lib(): Promise<PdfjsLib> {
  if (window.pdfjsLib) return window.pdfjsLib;
  if (!window.__PDFJS_WORKER_SRC__ || !window.__PDFJS_SRC__) {
    throw new Error("PDF support is not bundled in this build");
  }
  // Blob-URL module imports so both bundles land on the global scope
  // (replacing the old indirect eval). Worker first: pdf.js probes
  // globalThis.pdfjsWorker.WorkerMessageHandler during setup and, finding
  // it, never needs GlobalWorkerOptions.workerSrc. The awaits are
  // sequential, so the worker-before-lib load ORDER of the eval era is
  // preserved exactly; the in-flight promise keeps "evaluate each bundle
  // exactly once" true now that loading is asynchronous.
  if (!pdfjsLoading) {
    const workerSrc = window.__PDFJS_WORKER_SRC__;
    const libSrc = window.__PDFJS_SRC__;
    pdfjsLoading = (async () => {
      await importGlobalScript(workerSrc, ";globalThis.pdfjsWorker=pdfjsWorker;");
      await importGlobalScript(libSrc, ";globalThis.pdfjsLib=pdfjsLib;");
    })();
    pdfjsLoading.catch(() => { pdfjsLoading = null; }); // a failed load stays retryable
  }
  await pdfjsLoading;
  // The source strings are megabytes each — drop them now that they're parsed.
  try { delete window.__PDFJS_WORKER_SRC__; } catch { window.__PDFJS_WORKER_SRC__ = null; }
  try { delete window.__PDFJS_SRC__; } catch { window.__PDFJS_SRC__ = null; }
  // Fresh read: control-flow narrowing can't see the imports mutate window.
  const pdfjsLib = (window as { pdfjsLib?: PdfjsLib }).pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF support is not bundled in this build");
  pdfjsLib.GlobalWorkerOptions.workerSrc = ""; // defensive; fake-worker path never reads it
  return pdfjsLib;
}

/* ---------- line reconstruction ---------- */

const BULLET_RE = /^[•◦▪‣–—*-]\s+/;
const NUM_RE = /^\(?(\d{1,3}|[a-z]|[ivxIVX]{1,5})[.)]\s+/;
const PAGENUM_RE = /^\s*(page\s*)?\d+(\s*(of|\/)\s*\d+)?\s*$/i;
const TERMINAL_RE = /[.!?:;"]$/;

type Run = { str: string; x: number; y: number; w: number; size: number; bold: boolean };
type Cluster = { y: number; size: number; runs: Run[] };
type Seg = { x: number; endX: number; text: string; boldChars: number; chars: number; size: number };

export type Line = { text: string; x: number; y: number; size: number; bold: boolean; split: boolean };
export type PageRec = { n: number; width: number; height: number; lines: Line[] };
export type Block =
  | { t: "h"; level: number; text: string }
  | { t: "li"; ordered: boolean; x: number; text: string }
  | { t: "p"; text: string };
type LiBlock = Extract<Block, { t: "li" }>;

/* Cluster text runs into baseline lines, splitting a baseline into
   separate records at very large x-gaps so columns and table cells stay
   distinguishable downstream. */
function buildLines(
  content: PdfjsTextContent,
  pageWidth: number,
  boldMap: Map<string, string> | null | undefined,
): Line[] {
  const styles = content.styles || {};
  const runs: Run[] = [];
  for (const it of content.items) {
    if (!it.str || !it.str.trim()) continue; // word gaps are recovered geometrically
    const size = Math.hypot(it.transform[0], it.transform[1]) || 1; // rotation-proof
    const st = styles[it.fontName as string];
    // The styles map only carries generic fallbacks ("sans-serif") — the real
    // "…+Calibri-Bold" name comes from commonObjs via boldMap when available.
    const face = (boldMap && boldMap.get(it.fontName as string)) || (st && st.fontFamily) || it.fontName || "";
    runs.push({
      str: it.str, x: it.transform[4], y: it.transform[5],
      w: it.width || 0, size, bold: /bold|black|heavy/i.test(face),
    });
  }
  // PDF y grows upward, so top of page = largest y.
  runs.sort((a, b) => b.y - a.y || a.x - b.x);

  // Same baseline = same cluster: y within ~a third of the font size.
  const clusters: Cluster[] = [];
  let cur: Cluster | null = null;
  for (const r of runs) {
    if (cur && Math.abs(r.y - cur.y) <= 0.35 * Math.max(r.size, cur.size)) {
      cur.runs.push(r);
      cur.size = Math.max(cur.size, r.size);
    } else {
      cur = { y: r.y, size: r.size, runs: [r] };
      clusters.push(cur);
    }
  }

  const lines: Line[] = [];
  for (const cl of clusters) {
    cl.runs.sort((a, b) => a.x - b.x);
    const splitGap = Math.max(3 * cl.size, 0.15 * pageWidth);
    const segs: Seg[] = [];
    let seg: Seg | null = null;
    for (const r of cl.runs) {
      if (seg && r.x - seg.endX > splitGap) { segs.push(seg); seg = null; }
      if (!seg) {
        seg = { x: r.x, endX: -Infinity, text: "", boldChars: 0, chars: 0, size: 0 };
      } else if (r.x - seg.endX > 0.25 * r.size &&
                 !/\s$/.test(seg.text) && !/^\s/.test(r.str)) {
        seg.text += " ";
      }
      seg.text += r.str;
      seg.endX = Math.max(seg.endX, r.x + r.w);
      seg.size = Math.max(seg.size, r.size);
      const n = r.str.replace(/\s/g, "").length;
      seg.chars += n;
      if (r.bold) seg.boldChars += n;
    }
    if (seg) segs.push(seg);
    for (const s of segs) {
      const text = s.text.replace(/\s+/g, " ").trim();
      if (!text) continue;
      lines.push({
        text, x: s.x, y: cl.y, size: s.size,
        bold: s.chars > 0 && s.boldChars / s.chars > 0.5,
        split: segs.length > 1, // baseline had a big x-jump — table/column suspect
      });
    }
  }
  return lines;
}

/* ---------- document-wide heuristics ---------- */

/* Body size = the mode of sizes weighted by text length; headings are
   rare enough that prose always wins the vote. */
function bodySize(pageList: PageRec[]): number {
  const weight = new Map<number, number>();
  for (const p of pageList) {
    for (const ln of p.lines) {
      const s = Math.round(ln.size * 2) / 2;
      weight.set(s, (weight.get(s) || 0) + ln.text.length);
    }
  }
  let best = 12, bestW = -1;
  for (const [s, w] of weight) if (w > bestW) { best = s; bestW = w; }
  return best;
}

const normEdge = (t: string): string => t.replace(/\d+/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/* A header/footer is whatever repeats on most pages inside the ~50pt strips
   at the paper's top and bottom, once digits (page numbers, dates) are
   ignored. Strips rather than "the first/last line": a running header often
   yields two line records (title left, section right) on one baseline, and
   both must go. */
function stripFurniture(pageList: PageRec[]): boolean {
  const inBand = (p: PageRec, ln: Line) => ln.y >= p.height - 50 || ln.y <= 50;
  const hits = new Map<string, number>();
  for (const p of pageList) {
    const seen = new Set<string>();
    for (const ln of p.lines) {
      if (!inBand(p, ln)) continue;
      const e = normEdge(ln.text);
      if (e && !seen.has(e)) { seen.add(e); hits.set(e, (hits.get(e) || 0) + 1); }
    }
  }
  const need = Math.max(3, Math.ceil(0.6 * pageList.length));
  const drop = new Set<string>();
  for (const [e, n] of hits) if (n >= need) drop.add(e);

  let removed = false;
  for (const p of pageList) {
    p.lines = p.lines.filter(ln => {
      if (inBand(p, ln) && drop.has(normEdge(ln.text))) { removed = true; return false; }
      // Standalone page numbers hide in the top/bottom 12% of the page.
      if ((ln.y >= p.height * 0.88 || ln.y <= p.height * 0.12) && PAGENUM_RE.test(ln.text)) {
        removed = true;
        return false;
      }
      return true;
    });
  }
  return removed;
}

/* Two-column pages: read the left column fully, then the right, rather
   than zigzagging across the gutter line by line. */
function splitColumns(p: PageRec): { groups: Line[][]; multi: boolean } {
  const mid = p.width / 2;
  if (p.lines.length < 6) return { groups: [p.lines], multi: false };
  const right = p.lines.filter((l) => l.x >= mid);
  const nearLeft = p.lines.filter((l) => l.x < p.width * 0.3);
  if (right.length && right.length < p.lines.length &&
      right.length / p.lines.length >= 0.4 && nearLeft.length >= 2) {
    return { groups: [p.lines.filter((l) => l.x < mid), right], multi: true };
  }
  return { groups: [p.lines], multi: false };
}

/* ---------- block classification ---------- */

function headingLevel(ln: Line, body: number): number {
  // Headings are short and don't end mid-thought.
  if (ln.text.length >= 90 || ln.text.endsWith(".")) return 0;
  const r = ln.size / body;
  if (r >= 1.6) return 1;
  if (r >= 1.3) return 2;
  if (r >= 1.12) return 3;
  return 0;
}

/* Body-sized bold lines read as minor headings only when they're clearly
   labels: short, no terminal period, and genuinely the same size. */
function boldHeading(ln: Line, body: number): boolean {
  const r = ln.size / body;
  return ln.bold && ln.text.length < 60 && !ln.text.endsWith(".") &&
    r >= 0.95 && r < 1.12;
}

/* Single-space join with de-hyphenation: "exam-" + "ple" -> "example". */
function joinWrapped(a: string, b: string): string {
  if (a.endsWith("-") && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
  return a + " " + b;
}

function groupBlocks(lines: Line[], body: number): Block[] {
  if (!lines.length) return [];
  // Median vertical gap ≈ line height; anything much bigger separates paragraphs.
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1]!.y - lines[i]!.y;
    if (g > 0.1) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const lineH = gaps.length ? gaps[gaps.length >> 1]! : body * 1.4;

  // Chromium's print engine never writes ::marker glyphs into the text layer,
  // so a printed bullet list arrives as bare indented lines. Recover them by
  // shape: a run of same-x lines sitting 8–60pt off the column's left edge.
  const xFreq = new Map<number, number>();
  for (const l of lines) {
    const k = Math.round(l.x);
    xFreq.set(k, (xFreq.get(k) || 0) + 1);
  }
  let baseX = Math.round(lines[0]!.x), bw = -1;
  for (const [k, w] of xFreq) if (w > bw || (w === bw && k < baseX)) { baseX = k; bw = w; }

  const blocks: Block[] = [];
  let prev: Line | null = null;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]!;
    const gap = prev ? prev.y - ln.y : Infinity;
    const near = gap <= 1.6 * lineH;
    const last = blocks[blocks.length - 1];

    const hSize = headingLevel(ln, body); // size outranks a "1." prefix
    const bullet = !hSize && BULLET_RE.test(ln.text);
    const num = !hSize && !bullet && NUM_RE.test(ln.text);
    const nxt = lines[i + 1];
    const markerless = !hSize && !bullet && !num &&
      ln.x >= baseX + 8 && ln.x <= baseX + 60 &&
      ln.size / body < 1.12 && ln.text.length < 140 &&
      // ...only as part of a run: another item follows at the same x, or one precedes.
      ((nxt && Math.abs(nxt.x - ln.x) < 2 && (ln.y - nxt.y) <= 1.8 * lineH) ||
       (last && last.t === "li" && !last.ordered && near && Math.abs(ln.x - last.x) < 2));

    if (hSize) {
      // A tall title wrapped over two lines is still one heading.
      if (last && last.t === "h" && last.level === hSize && gap <= 1.6 * Math.max(lineH, ln.size)) {
        last.text = joinWrapped(last.text, ln.text);
      } else {
        blocks.push({ t: "h", level: hSize, text: ln.text });
      }
    } else if (bullet || num) {
      blocks.push({ t: "li", ordered: num, x: ln.x, text: ln.text.replace(bullet ? BULLET_RE : NUM_RE, "") });
    } else if (markerless) {
      blocks.push({ t: "li", ordered: false, x: ln.x, text: ln.text });
    } else if (last && last.t === "li" && near && ln.x > last.x + 4) {
      last.text = joinWrapped(last.text, ln.text); // wrapped tail of the item above
    } else if (boldHeading(ln, body) && !(last && last.t === "p" && near)) {
      blocks.push({ t: "h", level: 3, text: ln.text });
    } else if (last && last.t === "p" && near) {
      last.text = joinWrapped(last.text, ln.text);
    } else {
      blocks.push({ t: "p", text: ln.text });
    }
    prev = ln;
  }
  return blocks;
}

/* ---------- Markdown emission ---------- */

/* Just enough escaping to keep reconstructed prose out of Markdown's way. */
const escProse = (t: string): string => t.replace(/\|/g, "\\|").replace(/^([#>])/, "\\$1");

function emitList(items: LiBlock[]): string {
  const base = items[0]!.x;
  let n = 0, nn = 0;
  const out: string[] = [];
  for (const it of items) {
    const nested = it.x >= base + 18; // ~a quarter inch deeper = one level in
    if (!nested) nn = 0;
    if (it.ordered) {
      out.push(nested ? "  " + (++nn) + ". " + escProse(it.text)
                      : (++n) + ". " + escProse(it.text));
    } else {
      if (!nested) n = 0;
      out.push((nested ? "  - " : "- ") + escProse(it.text));
    }
  }
  return out.join("\n");
}

const pageNames = (nums: number[]): string => "page" + (nums.length > 1 ? "s " : " ") + nums.join(", ");

/* ---------- entry point ---------- */

async function toMarkdown(arrayBuffer: ArrayBuffer): Promise<{ source: string; pages: number; warnings: string[] }> {
  const pdfjs = await lib();
  const task = pdfjs.getDocument({ data: arrayBuffer, isEvalSupported: false, useSystemFonts: true });
  let doc: PdfjsDocument | null = null;
  try {
    try {
      doc = await task.promise;
    } catch (err) {
      if ((err as { name?: string } | null | undefined)?.name === "PasswordException") {
        throw new Error("This PDF is password-protected — remove the password and try again.");
      }
      throw err;
    }
    const numPages = doc!.numPages;

    const pageList: PageRec[] = [];
    for (let i = 1; i <= numPages; i++) {
      const page = await doc!.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      // Fonts only land in commonObjs once the operator list has run; that is
      // the sole place the true "ABCDEF+Calibri-Bold" name (weight included) lives.
      const boldMap = new Map<string, string>();
      try {
        await page.getOperatorList();
        for (const it of content.items) {
          if (!it.fontName || boldMap.has(it.fontName)) continue;
          try {
            const f = page.commonObjs.get(it.fontName);
            if (f && f.name) boldMap.set(it.fontName, f.name);
          } catch { /* font not resolved — generic fallback still applies */ }
        }
      } catch { /* a broken page's graphics must not sink the text import */ }
      pageList.push({ n: i, width: vp.width, height: vp.height, lines: buildLines(content, vp.width, boldMap) });
    }

    let chars = 0;
    for (const p of pageList) for (const ln of p.lines) chars += ln.text.replace(/\s/g, "").length;
    if (chars < 3) {
      throw new Error("No selectable text found — this looks like a scanned PDF. Run OCR on it first, or attach its pages as images.");
    }

    const droppedFurniture = stripFurniture(pageList);
    const body = bodySize(pageList);

    const columnPages: number[] = [], tablePages: number[] = [];
    const pageBlocks: Block[][] = [];
    for (const p of pageList) {
      const { groups, multi } = splitColumns(p);
      if (multi) columnPages.push(p.n);
      else {
        const jumps = p.lines.filter((l) => l.split).length;
        if (p.lines.length >= 6 && jumps >= 3 && jumps / p.lines.length >= 0.3) tablePages.push(p.n);
      }
      const blocks: Block[] = [];
      for (const g of groups) blocks.push(...groupBlocks(g, body));
      pageBlocks.push(blocks);
    }

    // Sentences don't respect page breaks; sew split paragraphs back together.
    const blocks: Block[] = [];
    for (const pb of pageBlocks) {
      const tail = blocks[blocks.length - 1];
      if (tail && pb[0] && tail.t === "p" && pb[0].t === "p" &&
          !TERMINAL_RE.test(tail.text) && /^[a-z]/.test(pb[0].text)) {
        tail.text = joinWrapped(tail.text, pb[0].text);
        blocks.push(...pb.slice(1));
      } else {
        blocks.push(...pb);
      }
    }

    const out: string[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]!;
      if (b.t === "h") {
        out.push("#".repeat(b.level) + " " + b.text.replace(/\|/g, "\\|"));
      } else if (b.t === "li") {
        const items: LiBlock[] = [b];
        while (i + 1 < blocks.length && blocks[i + 1]!.t === "li") items.push(blocks[++i] as LiBlock);
        out.push(emitList(items));
      } else {
        out.push(escProse(b.text));
      }
    }
    const source = out.join("\n\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const warnings = ["Imported as reflowed text — the PDF's exact layout is not preserved."];
    if (columnPages.length || tablePages.length) {
      warnings.push("Tables and multi-column layouts are flattened to running text");
    }
    if (columnPages.length) {
      warnings.push("Multi-column layout detected on " + pageNames(columnPages) +
        " — each was read left column first, then right.");
    }
    if (tablePages.length) {
      warnings.push("Text on " + pageNames(tablePages) +
        " looks like a table or grid; its cells were flattened into lines.");
    }
    if (droppedFurniture) {
      warnings.push("Repeating headers/footers and standalone page numbers were removed.");
    }

    return { source, pages: numPages, warnings };
  } finally {
    // v6 keeps destroy() on the loading task; older builds had it on the proxy.
    try { await task.destroy(); }
    catch { try { await (doc && doc.destroy()); } catch { /* already torn down */ } }
  }
}

/* Public surface — exactly the classic PdfImport global. */
export const PdfImport = { toMarkdown, ensureLib: lib };
export type PdfImportApi = typeof PdfImport;

/* Pure helpers exposed for unit tests only (additive; NOT part of the
   public surface and NOT assigned onto the global). */
export const _internals = {
  buildLines, bodySize, stripFurniture, splitColumns, headingLevel,
  boldHeading, joinWrapped, groupBlocks, emitList, escProse, pageNames,
  BULLET_RE, NUM_RE, PAGENUM_RE, TERMINAL_RE,
};
