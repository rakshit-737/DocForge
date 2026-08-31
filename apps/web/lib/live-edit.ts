/* ============================================================
   live-edit.ts — direct editing on the paginated manuscript.
   The web-studio port of the classic src/js/live-edit.js, kept
   faithful to that algorithm line for line.

   The galley is a real editing surface. Every top-level block carries
   its span of source lines (data-ss / data-se, stamped by Engine.render),
   and Paged.js fragments of one logical block share a data-ref. An edit:

     native contenteditable change (typing stays instant)
        → affected source-line range located from the selection
        → the range's blocks serialized DOM → Markdown
        → spliced into the store source at exactly those lines
        → stamps shifted, re-render deferred to an idle pause

   Source stays the single truth: left edits re-render the manuscript,
   right edits rewrite the source. Neither view ever writes to the other
   directly, so there is no loop to break. Around every re-render the
   viewport is anchored to the topmost visible block and the caret to a
   (block, text-offset) pair, both resolved against the fresh DOM.

   Framework-agnostic like PreviewController: a class that owns two DOM
   listeners on the deck and nothing else. React attaches it once
   (preview-deck.tsx); the press drives it at the classic doRender points
   (preview-controller.ts: flush → captureView → compose → swap → arm →
   restoreView).
   ============================================================ */

export interface SourceSplice {
  from: number;
  to: number;
  insert: string;
}

export interface LiveEditHooks {
  /** The preview scroll container ("the stone") — viewport anchoring. */
  scroller: HTMLElement;
  getSource(): string;
  /** Write the edited source back. `splice` is the minimal character change
      from the previous source — forwarded so the source pane can dispatch a
      minimal CodeMirror change instead of replacing the whole document. */
  setSource(src: string, splice: SourceSplice): void;
  /** An edit landed somewhere unmappable — put the manuscript back. */
  revert(): void;
  /** Fired per keystroke: keeps the deferred re-render pushed out while
      typing (the classic scheduleLiveRender, 1300ms of quiet). */
  editPending(): void;
  undo(): void;
  redo(): void;
}

export interface ViewAnchor {
  ss: number;
  fragIdx: number;
  delta: number;
}
export interface ViewCaret {
  ss: number;
  off: number;
}
export interface LiveEditView {
  anchor: ViewAnchor | null;
  caret: ViewCaret | null;
}

interface TopEntry {
  el: HTMLElement;
  frags: HTMLElement[];
  ss: number;
  se: number;
}
interface LineRange {
  ss: number;
  se: number;
}

/* ================= DOM → Markdown ================= */

function inlineMd(node: Node): string {
  let out = "";
  for (const ch of node.childNodes) {
    if (ch.nodeType === 3) out += ch.nodeValue ?? "";
    else if (ch.nodeType === 1) out += elMd(ch as HTMLElement);
  }
  return out;
}

function elMd(ch: HTMLElement): string {
  const cl = ch.classList;
  const d = ch.dataset;
  if (cl.contains("hnum")) return ""; // auto heading number
  if (cl.contains("footnote")) return `[^${d.fn || "1"}]`;
  if (cl.contains("cite")) return `[@${d.key || "key"}${d.loc ? `, ${d.loc}` : ""}]`;
  if (cl.contains("xref")) return `[#${(ch.getAttribute("href") || "#").slice(1)}]`;
  if (cl.contains("math-inline")) return `$${d.tex || ""}$`;
  if (cl.contains("dfspan")) {
    const a: string[] = [];
    if (d.color) a.push(`color=${d.color}`);
    if (d.bg) a.push(`bg=${d.bg}`);
    if (d.size) a.push(`size=${d.size}`);
    if (d.font) a.push(`font="${d.font}"`);
    if (d.u) a.push("u");
    if (d.sc) a.push("sc");
    if (d.caps) a.push("caps");
    const inner = inlineMd(ch);
    return a.length ? `[${inner}]{${a.join(" ")}}` : inner;
  }
  const inner = () => inlineMd(ch);
  const wrap = (m: string, mEnd?: string) => {
    const t = inner();
    return t.trim() ? m + t + (mEnd || m) : t; // an emptied <strong></strong> must not leave bare ** in the source
  };
  switch (ch.tagName) {
    case "BR":
      return "\n";
    case "STRONG":
    case "B":
      return wrap("**");
    case "EM":
    case "I":
      return wrap("*");
    case "DEL":
    case "S":
      return wrap("~~");
    case "U":
      return wrap("++");
    case "SUB":
      return wrap("~");
    case "SUP":
      return wrap("^");
    case "CODE":
      return `\`${ch.textContent}\``;
    case "MARK": {
      const hl = d.hl;
      return hl && hl !== "yellow" ? wrap(`=={${hl}}`, "==") : wrap("==");
    }
    case "A": {
      const href = ch.getAttribute("href") || "";
      return href && !href.startsWith("#") ? `[${inner()}](${href})` : inner();
    }
    case "IMG":
      return `![${(ch as HTMLImageElement).alt || ""}](${ch.getAttribute("src") || ""})`;
    default:
      return inner();
  }
}

function listMd(list: HTMLElement, depth: number): string {
  const ordered = list.tagName === "OL";
  const pad = "  ".repeat(depth);
  const lines: string[] = [];
  let n = 0;
  for (const li of list.children) {
    if (li.tagName !== "LI") continue;
    n++;
    let inline = "";
    const subs: HTMLElement[] = [];
    for (const ch of li.childNodes) {
      if (
        ch.nodeType === 1 &&
        /^(UL|OL|P|PRE|TABLE|BLOCKQUOTE|H[1-6]|FIGURE|DIV)$/.test((ch as Element).tagName)
      ) {
        subs.push(ch as HTMLElement);
        continue;
      }
      inline += ch.nodeType === 3 ? (ch.nodeValue ?? "") : elMd(ch as HTMLElement);
    }
    lines.push(pad + (ordered ? `${n}. ` : "- ") + inline.replace(/\s+/g, " ").trim());
    for (const sub of subs) {
      if (sub.tagName === "UL" || sub.tagName === "OL") lines.push(listMd(sub, depth + 1));
      else {
        const md = blockMd(sub);
        if (md.trim())
          lines.push(
            md
              .split("\n")
              .map((l) => `${pad}  ${l}`)
              .join("\n"),
          );
      }
    }
  }
  return lines.join("\n");
}

function tableMd(tb: HTMLElement): string {
  const lines: string[] = [];
  if (tb.dataset.tbl && (tb.dataset.caption || tb.dataset.explicitId)) {
    const id = tb.dataset.explicitId && tb.id ? ` | #${tb.id}` : "";
    lines.push(`[table: ${tb.dataset.caption || ""}${id}]`);
  }
  const cellMd = (td: Element) => inlineMd(td).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  const rows = [
    ...tb.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tr"),
  ].filter((tr) => !tr.closest("thead[data-repeated-header]"));
  rows.forEach((tr) => lines.push(`| ${[...tr.children].map(cellMd).join(" | ")} |`));
  if (rows.length) {
    const aligns = [...rows[0]!.children].map((c) => c.getAttribute("align"));
    const sep = `| ${aligns
      .map((a) =>
        a === "center" ? ":---:" : a === "right" ? "---:" : a === "left" ? ":---" : "---",
      )
      .join(" | ")} |`;
    lines.splice(lines[0]!.startsWith("[table:") ? 2 : 1, 0, sep);
  }
  return lines.join("\n");
}

function childrenMd(el: Element | null): string {
  if (!el) return "";
  return [...el.children]
    .map((c) => blockMd(c as HTMLElement))
    .filter((s) => s.trim())
    .join("\n\n");
}

function blockMd(el: HTMLElement): string {
  const cl = el.classList;
  if (cl.contains("toc-wrap"))
    return cl.contains("list-wrap") ? (el.dataset.kind === "tbl" ? "[lot]" : "[lof]") : "[toc]";
  if (cl.contains("refs")) return "[references]";
  if (cl.contains("page-break")) return "[pagebreak]";
  if (cl.contains("math-display")) return `$$\n${el.dataset.tex || ""}\n$$`;
  if (cl.contains("callout")) {
    const type = ["note", "tip", "warning", "important"].find((t) => cl.contains(t)) || "note";
    const title = (el.querySelector(":scope > .co-title")?.textContent || "").trim();
    return `:::${type}${title ? ` ${title}` : ""}\n${childrenMd(el.querySelector(":scope > .co-body"))}\n:::`;
  }
  if (cl.contains("banner")) return `:::banner\n${childrenMd(el)}\n:::`;
  const alignCls = [...cl].find((c) => /^align-(center|right|left|justify)$/.test(c));
  if (alignCls) return `:::${alignCls.slice(6)}\n${childrenMd(el)}\n:::`;
  if (el.tagName === "FIGURE") {
    if (cl.contains("shot")) {
      const opts: string[] = [];
      if (el.dataset.key) opts.push(`img:${el.dataset.key}`);
      if (el.dataset.reqW) opts.push(`w:${el.dataset.reqW}`);
      if (cl.contains("noborder")) opts.push("noborder");
      if (el.id && !/^fig-auto-/.test(el.id)) opts.push(`#${el.id}`);
      return `[screenshot: ${el.dataset.caption || ""}${opts.length ? ` | ${opts.join(" | ")}` : ""}]`;
    }
    const img = el.querySelector("img");
    return img ? `![${el.dataset.caption || img.alt || ""}](${img.getAttribute("src") || ""})` : "";
  }
  if (/^H[1-6]$/.test(el.tagName)) {
    const label = el.dataset.label ? ` {#${el.dataset.label}}` : "";
    return `${"#".repeat(+el.tagName[1]!)} ${inlineMd(el).replace(/\s+/g, " ").trim()}${label}`;
  }
  if (el.tagName === "P") return inlineMd(el).trim();
  if (el.tagName === "HR") return "---";
  if (el.tagName === "BLOCKQUOTE")
    return childrenMd(el)
      .split("\n")
      .map((l) => `> ${l}`.trimEnd())
      .join("\n");
  if (el.tagName === "PRE") {
    const code = (el.querySelector("code") as HTMLElement | null) || el;
    const lang = ((code.className || "").match(/language-([\w+-]+)/) || [])[1] || "";
    return `\`\`\`${lang}\n${(code.textContent || "").replace(/\n$/, "")}\n\`\`\``;
  }
  if (el.tagName === "UL" || el.tagName === "OL") return listMd(el, 0);
  if (el.tagName === "TABLE") return tableMd(el);
  if (el.tagName === "DIV" || el.tagName === "SECTION") return childrenMd(el);
  return inlineMd(el).trim();
}

/* A logical block may lie across pages as fragments sharing one data-ref.
   Serialize each and stitch: inline blocks joined with a space (Paged.js
   collapses the whitespace at the break), structural blocks line-wise with
   a merge when the continuation starts mid-item. */
function serializeLogical(frags: HTMLElement[]): string {
  if (frags.length === 1) return blockMd(frags[0]!);
  const tag = frags[0]!.tagName;
  if (/^(P|H[1-6])$/.test(tag)) {
    return frags.map(blockMd).reduce((a, b) => {
      if (!a) return b;
      if (!b) return a;
      return a + (/\s$/.test(a) || /^\s/.test(b) ? "" : " ") + b;
    }, "");
  }
  let lines = blockMd(frags[0]!).split("\n");
  for (let i = 1; i < frags.length; i++) {
    // continuation fragments carry cloned attributes — drop their duplicate
    // caption line and separator row before stitching
    let bLines = blockMd(frags[i]!)
      .split("\n")
      .filter((l) => !/^\|\s*:?-{3}/.test(l) && !/^\[table:/.test(l));
    const contFirst =
      frags[i]!.firstElementChild && frags[i]!.firstElementChild!.hasAttribute("data-split-from");
    if (contFirst && lines.length && bLines.length && tag !== "TABLE") {
      const b0 = bLines[0]!.replace(/^\s*(?:[-*]|\d+\.)\s+/, "").replace(/^>\s?/, "");
      lines[lines.length - 1] += (/\s$/.test(lines[lines.length - 1]!) ? "" : " ") + b0;
      bLines = bLines.slice(1);
    }
    lines = lines.concat(bLines);
  }
  if (tag === "OL") {
    // fragment-local numbering restarts — renumber the top level
    let n = 0;
    lines = lines.map((l) => (/^\d+\. /.test(l) ? `${++n}. ${l.replace(/^\d+\. /, "")}` : l));
  }
  return lines.join("\n");
}

/* ================= small helpers ================= */

const TOP_SEL = ".pagedjs_page .content > [data-ss]";

const union = (a: LineRange | null, b: LineRange | null): LineRange | null =>
  !a ? b : !b ? a : { ss: Math.min(a.ss, b.ss), se: Math.max(a.se, b.se) };

/** Minimal character splice turning `a` into `b` (common prefix/suffix trim) —
    what the classic line splice looks like as a single {from,to,insert}. */
function diffSplice(a: string, b: string): SourceSplice {
  let from = 0;
  const max = Math.min(a.length, b.length);
  while (from < max && a.charCodeAt(from) === b.charCodeAt(from)) from++;
  let ta = a.length;
  let tb = b.length;
  while (ta > from && tb > from && a.charCodeAt(ta - 1) === b.charCodeAt(tb - 1)) {
    ta--;
    tb--;
  }
  return { from, to: ta, insert: b.slice(from, tb) };
}

function editableTextNodes(root: Element): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    let p = (n as Text).parentElement;
    let skip = false;
    while (p && p !== root) {
      if (p.getAttribute("contenteditable") === "false") {
        skip = true;
        break;
      }
      p = p.parentElement;
    }
    if (!skip) out.push(n as Text);
  }
  return out;
}

/* ================= the surface ================= */

let active: LiveEdit | null = null;
/** Flush whichever LiveEdit instance is attached — the classic
    editor-focus call site ("the source pane must never act on a source the
    manuscript hasn't written yet"), importable without a handle. */
export function flushActiveLiveEdit(): void {
  active?.flush();
}

export class LiveEdit {
  private deck: HTMLElement | null = null;
  private hooks: LiveEditHooks | null = null;
  /** source-line range captured at beforeinput (survives deletions/merges) */
  private pending: LineRange | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** an edit landed somewhere unmappable — revert at flush */
  private lost = false;

  attach(deck: HTMLElement, hooks: LiveEditHooks): void {
    this.deck = deck;
    this.hooks = hooks;
    deck.addEventListener("beforeinput", this.onBeforeInput);
    deck.addEventListener("input", this.onInput);
    active = this;
  }

  detach(): void {
    if (this.deck) {
      this.deck.removeEventListener("beforeinput", this.onBeforeInput);
      this.deck.removeEventListener("input", this.onInput);
    }
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.pending = null;
    this.lost = false;
    if (active === this) active = null;
    this.deck = null;
    this.hooks = null;
  }

  /* ================= locating blocks ================= */

  private topEntries(): TopEntry[] {
    /* Fold same-data-ref elements into one logical block ONLY when the later
       one is a genuine Paged.js continuation (data-split-from). A browser
       Enter-split clones the node WITH its data-ref — those clones are new,
       separate blocks and must serialize as two paragraphs, not be glued. */
    const byRef = new Map<string, TopEntry>();
    const out: TopEntry[] = [];
    if (!this.deck) return out;
    for (const el of this.deck.querySelectorAll<HTMLElement>(TOP_SEL)) {
      const ref = el.getAttribute("data-ref") || "";
      if (ref && byRef.has(ref) && el.hasAttribute("data-split-from")) {
        byRef.get(ref)!.frags.push(el);
        continue;
      }
      const entry: TopEntry = {
        el,
        frags: [el],
        ss: Number(el.dataset.ss),
        se: Number(el.dataset.se),
      };
      if (ref && !byRef.has(ref)) byRef.set(ref, entry);
      out.push(entry);
    }
    return out;
  }

  private blockOf(node: Node | null): HTMLElement | null {
    const el = node && (node.nodeType === 1 ? (node as Element) : node.parentElement);
    if (!el) return null;
    const stamped = el.closest<HTMLElement>(".content > [data-ss]");
    if (stamped) return stamped;
    // fresh, unstamped element (a paragraph typed after the last block):
    // anchor on the nearest stamped sibling so its content joins that range
    const top = el.closest<HTMLElement>(".content > *");
    if (!top) return null;
    for (
      let p = top.previousElementSibling as HTMLElement | null;
      p;
      p = p.previousElementSibling as HTMLElement | null
    )
      if (p.dataset.ss != null) return p;
    for (
      let n = top.nextElementSibling as HTMLElement | null;
      n;
      n = n.nextElementSibling as HTMLElement | null
    )
      if (n.dataset.ss != null) return n;
    return null;
  }

  private rangeOfSelection(): LineRange | null {
    if (!this.deck) return null;
    const sel = document.getSelection();
    if (!sel || !sel.anchorNode || !this.deck.contains(sel.anchorNode)) return null;
    const a = this.blockOf(sel.anchorNode);
    const f = sel.focusNode && this.deck.contains(sel.focusNode) ? this.blockOf(sel.focusNode) : a;
    const els = [a, f].filter((x): x is HTMLElement => !!x);
    if (!els.length) return null;
    return {
      ss: Math.min(...els.map((e) => Number(e.dataset.ss))),
      se: Math.max(...els.map((e) => Number(e.dataset.se))),
    };
  }

  /* ================= write-back ================= */

  private syncRange(ss: number, se: number): void {
    const deck = this.deck;
    const hooks = this.hooks;
    if (!deck || !hooks) return;
    const entries = this.topEntries();
    let lo = -1;
    let hi = -1;
    entries.forEach((en, i) => {
      if (en.se >= ss && en.ss <= se) {
        if (lo < 0) lo = i;
        hi = i;
      }
    });
    if (lo < 0) {
      hooks.revert();
      return;
    }

    /* fold in fresh unstamped siblings sitting inside or against the window —
       DOM-ordered .content children between (and touching) the slice */
    const sliceEls = entries.slice(lo, hi + 1);
    const first = sliceEls[0]!.frags[0]!;
    const last = sliceEls[sliceEls.length - 1]!.frags.at(-1)!;
    const domSlice: HTMLElement[] = [];
    const pages = [...deck.querySelectorAll<HTMLElement>(".pagedjs_page .content")];
    let on = false;
    outer: for (const pageContent of pages) {
      for (const child of pageContent.children) {
        if (child === first) on = true;
        if (on && child.nodeType === 1) domSlice.push(child as HTMLElement);
        if (child === last) {
          // keep swallowing trailing unstamped siblings
          for (
            let n = child.nextElementSibling as HTMLElement | null;
            n && n.dataset.ss == null;
            n = n.nextElementSibling as HTMLElement | null
          )
            domSlice.push(n);
          break outer;
        }
      }
    }
    // serialize in DOM order; true Paged continuations fold into their first
    // appearance, browser-made clones stay separate blocks
    const seenRef = new Set<string>();
    const parts: { el: HTMLElement; frags: HTMLElement[]; md: string }[] = [];
    for (const el of domSlice) {
      const ref = el.getAttribute("data-ref") || "";
      if (ref && seenRef.has(ref) && el.hasAttribute("data-split-from")) continue;
      if (ref) seenRef.add(ref);
      const en = sliceEls.find((x) => x.frags[0] === el);
      parts.push({
        el,
        frags: en ? en.frags : [el],
        md: en ? serializeLogical(en.frags) : blockMd(el),
      });
    }

    const rangeSS = Math.min(ss, ...sliceEls.map((e) => e.ss));
    const rangeSE = Math.max(se, ...sliceEls.map((e) => e.se));
    const src = hooks.getSource();
    const lines = src.split("\n");
    const kept = parts.filter((p) => p.md.trim() !== "");
    // an emptied block renders nothing and keeps a stale stamp — remove it now
    // so a follow-up edit before the re-render can't splice against it
    parts
      .filter((p) => p.md.trim() === "")
      .forEach((p) => {
        p.el.remove();
      });
    const newLines = kept.length
      ? kept
          .map((p) => p.md)
          .join("\n\n")
          .split("\n")
      : [];
    const from = Math.max(0, Math.min(rangeSS, lines.length - 1));
    const to = Math.max(from, Math.min(rangeSE, lines.length - 1));
    lines.splice(from, to - from + 1, ...newLines);
    const delta = newLines.length - (to - from + 1);
    const next = lines.join("\n");
    hooks.setSource(next, diffSplice(src, next));

    // restamp the edited window, then shift everything after it
    let cursor = from;
    for (const p of kept) {
      const span = p.md.split("\n").length;
      for (const t of p.frags) {
        t.dataset.ss = String(cursor);
        t.dataset.se = String(cursor + span - 1);
      }
      cursor += span + 1;
    }
    for (const el of deck.querySelectorAll<HTMLElement>("[data-ss]")) {
      const elSS = Number(el.dataset.ss);
      if (elSS > to && !domSlice.includes(el)) {
        el.dataset.ss = String(elSS + delta);
        el.dataset.se = String(Number(el.dataset.se) + delta);
      }
    }
  }

  /* ================= caret & viewport ================= */

  private captureCaret(): ViewCaret | null {
    const deck = this.deck;
    if (!deck) return null;
    const sel = document.getSelection();
    if (!sel || !sel.rangeCount || !sel.focusNode || !deck.contains(sel.focusNode)) return null;
    const block = this.blockOf(sel.focusNode);
    if (!block || block.dataset.ss == null) return null;
    const entry = this.topEntries().find((e) => e.frags.includes(block));
    const frags = entry ? entry.frags : [block];
    let off = 0;
    for (const frag of frags) {
      for (const t of editableTextNodes(frag)) {
        if (t === sel.focusNode)
          return { ss: Number(block.dataset.ss), off: off + sel.focusOffset };
        off += (t.nodeValue ?? "").length;
      }
    }
    return { ss: Number(block.dataset.ss), off };
  }

  private restoreCaret(c: ViewCaret): void {
    const entries = this.topEntries();
    const entry =
      entries.find((e) => e.ss === c.ss) ||
      entries.reduce<TopEntry | null>(
        (best, e) => (e.ss <= c.ss && (!best || e.ss > best.ss) ? e : best),
        null,
      );
    if (!entry) return;
    let remaining = c.off;
    let target: Text | null = null;
    let local = 0;
    for (const frag of entry.frags) {
      for (const t of editableTextNodes(frag)) {
        if (remaining <= (t.nodeValue ?? "").length) {
          target = t;
          local = remaining;
          break;
        }
        remaining -= (t.nodeValue ?? "").length;
      }
      if (target) break;
    }
    if (!target) {
      const all = entry.frags.flatMap(editableTextNodes);
      target = all.at(-1) ?? null;
      local = target ? (target.nodeValue ?? "").length : 0;
    }
    if (!target) return;
    const pc = target.parentElement?.closest<HTMLElement>(".pagedjs_page_content");
    if (pc) pc.focus({ preventScroll: true });
    const sel = document.getSelection();
    try {
      sel?.collapse(target, Math.min(local, (target.nodeValue ?? "").length));
    } catch {}
  }

  private captureAnchor(): ViewAnchor | null {
    const deck = this.deck;
    const hooks = this.hooks;
    if (!deck || !hooks) return null;
    const contTop = hooks.scroller.getBoundingClientRect().top;
    const els = [...deck.querySelectorAll<HTMLElement>(TOP_SEL)];
    for (let i = 0; i < els.length; i++) {
      const r = els[i]!.getBoundingClientRect();
      if (r.height && r.bottom > contTop + 1) {
        const ss = Number(els[i]!.dataset.ss);
        // a block split across pages shares one ss — remember WHICH fragment
        // was on screen, or the restore lands a page early
        let fragIdx = 0;
        for (let j = i - 1; j >= 0 && Number(els[j]!.dataset.ss) === ss; j--) fragIdx++;
        return { ss, fragIdx, delta: r.top - contTop };
      }
    }
    return null;
  }

  private restoreAnchor(a: ViewAnchor | null): void {
    const deck = this.deck;
    const hooks = this.hooks;
    if (!deck || !hooks || !a) return;
    const els = [...deck.querySelectorAll<HTMLElement>(TOP_SEL)];
    const matches = els.filter((el) => Number(el.dataset.ss) === a.ss);
    let best: HTMLElement | null = null;
    if (matches.length) {
      best = matches[Math.min(a.fragIdx || 0, matches.length - 1)]!;
    } else {
      for (const el of els) {
        const ss = Number(el.dataset.ss);
        if (ss <= a.ss || !best) best = el;
        if (ss > a.ss) break;
      }
    }
    if (!best) return;
    const d = best.getBoundingClientRect().top - hooks.scroller.getBoundingClientRect().top;
    const shift = d - a.delta;
    let z = 1;
    // transform:scale fallback only — with CSS zoom (the usual path) rects and
    // scrollTop live in the same coordinate space and z stays 1, as classic.
    if (deck.style.transform?.includes("scale(")) {
      const m = deck.style.transform.match(/scale\(([^)]+)\)/);
      if (m) z = parseFloat(m[1]!) || 1;
    }
    hooks.scroller.scrollTop += shift / z;
  }

  captureView(): LiveEditView | null {
    if (!this.deck || !this.hooks) return null;
    return { anchor: this.captureAnchor(), caret: this.captureCaret() };
  }

  restoreView(v: LiveEditView | null): void {
    if (!this.deck || !this.hooks || !v) return;
    if (v.caret) this.restoreCaret(v.caret);
    this.restoreAnchor(v.anchor);
  }

  /* ================= events ================= */

  /* Typing must cost nothing: each keystroke only widens the pending source
     window (two closest() calls); serialization and the source splice run on
     a short pause — and always flush before anything reads the source. */

  flush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (!this.hooks) return;
    if (this.lost) {
      this.lost = false;
      this.pending = null;
      this.hooks.revert();
      return;
    }
    if (!this.pending) return;
    const r = this.pending;
    this.pending = null;
    this.syncRange(r.ss, r.se);
  }

  private onBeforeInput = (e: Event): void => {
    const hooks = this.hooks;
    if (!hooks) return;
    const ie = e as InputEvent;
    const t = ie.inputType || "";
    if (t === "historyUndo") {
      // Ctrl+Z with focus in the manuscript: the ONE app-level history
      // (lib/history.ts), never the browser's contenteditable history.
      e.preventDefault();
      this.flush();
      hooks.undo();
      return;
    }
    if (t === "historyRedo") {
      e.preventDefault();
      this.flush();
      hooks.redo();
      return;
    }
    this.pending = union(this.pending, this.rangeOfSelection());
    if (t === "insertFromPaste" || t === "insertFromDrop") {
      // plain text only — arbitrary pasted HTML would not survive the round-trip
      e.preventDefault();
      const dt =
        ie.dataTransfer || (ie as unknown as { clipboardData?: DataTransfer }).clipboardData;
      const text = dt?.getData("text/plain") ?? "";
      if (text) document.execCommand("insertText", false, text);
    }
  };

  private onInput = (): void => {
    const hooks = this.hooks;
    if (!hooks) return;
    const r = union(this.pending, this.rangeOfSelection());
    if (!r) this.lost = true;
    this.pending = r;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), 250);
    hooks.editPending(); // keeps the deferred re-render pushed out while typing
  };

  /** After each flow swap: the pages become editing surfaces. Generated
      furniture — TOC/LOF/LOT, references, page-breaks, footnote markers,
      citations, heading numbers, figures, math — arrives from Engine.render
      already stamped contenteditable="false" (packages/engine/src/render.ts)
      and Paged.js clones those stamps onto every page fragment; folios live
      in margin boxes outside the editable area. Exactly the classic
      read-only inventory. */
  arm(): void {
    if (!this.deck) return;
    this.deck
      .querySelectorAll<HTMLElement>(".pagedjs_area > .pagedjs_page_content")
      .forEach((pc) => {
        pc.setAttribute("contenteditable", "true");
        pc.setAttribute("spellcheck", "false");
      });
  }
}
