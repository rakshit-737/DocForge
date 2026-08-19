/* ============================================================
   live-edit.js — direct editing on the paginated manuscript

   The galley is a real editing surface. Every top-level block carries
   its span of source lines (data-ss / data-se, stamped by Engine.render),
   and Paged.js fragments of one logical block share a data-ref. An edit:

     native contenteditable change (typing stays instant)
        → affected source-line range located from the selection
        → the range's blocks serialized DOM → Markdown
        → spliced into state.source at exactly those lines
        → stamps shifted, re-render deferred to an idle pause

   Source stays the single truth: left edits re-render the manuscript,
   right edits rewrite the source. Neither view ever writes to the other
   directly, so there is no loop to break. Around every re-render the
   viewport is anchored to the topmost visible block and the caret to a
   (block, text-offset) pair, both resolved against the fresh DOM.
   ============================================================ */
"use strict";

const LiveEdit = (() => {

  let hooks = null;      // { scaleWrap, scroller, getSource, setSource, scheduleRender, revert, undo, redo, toast }
  let pending = null;    // source-line range captured at beforeinput (survives deletions/merges)

  /* ================= DOM → Markdown ================= */

  const EMPTYABLE = new Set(["STRONG", "B", "EM", "I", "DEL", "S", "U", "MARK", "SUB", "SUP"]);

  function inlineMd(node) {
    let out = "";
    for (const ch of node.childNodes) {
      if (ch.nodeType === 3) out += ch.nodeValue;
      else if (ch.nodeType === 1) out += elMd(ch);
    }
    return out;
  }

  function elMd(ch) {
    const cl = ch.classList;
    if (cl.contains("hnum")) return "";                          // auto heading number
    if (cl.contains("footnote")) return `[^${ch.dataset.fn || "1"}]`;
    if (cl.contains("cite")) return `[@${ch.dataset.key || "key"}${ch.dataset.loc ? ", " + ch.dataset.loc : ""}]`;
    if (cl.contains("xref")) return `[#${(ch.getAttribute("href") || "#").slice(1)}]`;
    if (cl.contains("math-inline")) return `$${ch.dataset.tex || ""}$`;
    if (cl.contains("dfspan")) {
      const d = ch.dataset, a = [];
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
    const wrap = (m, mEnd) => {
      const t = inner();
      return t.trim() ? m + t + (mEnd || m) : t;   // an emptied <strong></strong> must not leave bare ** in the source
    };
    switch (ch.tagName) {
      case "BR": return "\n";
      case "STRONG": case "B": return wrap("**");
      case "EM": case "I": return wrap("*");
      case "DEL": case "S": return wrap("~~");
      case "U": return wrap("++");
      case "SUB": return wrap("~");
      case "SUP": return wrap("^");
      case "CODE": return "`" + ch.textContent + "`";
      case "MARK": {
        const hl = ch.dataset.hl;
        return hl && hl !== "yellow" ? wrap(`=={${hl}}`, "==") : wrap("==");
      }
      case "A": {
        const href = ch.getAttribute("href") || "";
        return href && !href.startsWith("#") ? `[${inner()}](${href})` : inner();
      }
      case "IMG": return `![${ch.alt || ""}](${ch.getAttribute("src") || ""})`;
      default: return inner();
    }
  }

  function listMd(list, depth) {
    const ordered = list.tagName === "OL";
    const pad = "  ".repeat(depth);
    const lines = [];
    let n = 0;
    for (const li of list.children) {
      if (li.tagName !== "LI") continue;
      n++;
      let inline = "";
      const subs = [];
      for (const ch of li.childNodes) {
        if (ch.nodeType === 1 && /^(UL|OL|P|PRE|TABLE|BLOCKQUOTE|H[1-6]|FIGURE|DIV)$/.test(ch.tagName)) { subs.push(ch); continue; }
        inline += ch.nodeType === 3 ? ch.nodeValue : elMd(ch);
      }
      lines.push(pad + (ordered ? `${n}. ` : "- ") + inline.replace(/\s+/g, " ").trim());
      for (const sub of subs) {
        if (sub.tagName === "UL" || sub.tagName === "OL") lines.push(listMd(sub, depth + 1));
        else {
          const md = blockMd(sub);
          if (md.trim()) lines.push(md.split("\n").map(l => pad + "  " + l).join("\n"));
        }
      }
    }
    return lines.join("\n");
  }

  function tableMd(tb) {
    const lines = [];
    if (tb.dataset.tbl && (tb.dataset.caption || tb.dataset.explicitId)) {
      const id = tb.dataset.explicitId && tb.id ? ` | #${tb.id}` : "";
      lines.push(`[table: ${tb.dataset.caption || ""}${id}]`);
    }
    const cellMd = td => inlineMd(td).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
    const rows = [...tb.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tr")]
      .filter(tr => !tr.closest("thead[data-repeated-header]"));
    rows.forEach(tr => lines.push("| " + [...tr.children].map(cellMd).join(" | ") + " |"));
    if (rows.length) {
      const aligns = [...rows[0].children].map(c => c.getAttribute("align"));
      const sep = "| " + aligns.map(a =>
        a === "center" ? ":---:" : a === "right" ? "---:" : a === "left" ? ":---" : "---").join(" | ") + " |";
      lines.splice(lines[0].startsWith("[table:") ? 2 : 1, 0, sep);
    }
    return lines.join("\n");
  }

  function childrenMd(el) {
    if (!el) return "";
    return [...el.children].map(blockMd).filter(s => s.trim()).join("\n\n");
  }

  function blockMd(el) {
    const cl = el.classList;
    if (cl.contains("toc-wrap")) return cl.contains("list-wrap") ? (el.dataset.kind === "tbl" ? "[lot]" : "[lof]") : "[toc]";
    if (cl.contains("refs")) return "[references]";
    if (cl.contains("page-break")) return "[pagebreak]";
    if (cl.contains("math-display")) return "$$\n" + (el.dataset.tex || "") + "\n$$";
    if (cl.contains("callout")) {
      const type = ["note", "tip", "warning", "important"].find(t => cl.contains(t)) || "note";
      const title = (el.querySelector(":scope > .co-title")?.textContent || "").trim();
      return `:::${type}${title ? " " + title : ""}\n${childrenMd(el.querySelector(":scope > .co-body"))}\n:::`;
    }
    const alignCls = [...cl].find(c => /^align-(center|right|left|justify)$/.test(c));
    if (alignCls) return `:::${alignCls.slice(6)}\n${childrenMd(el)}\n:::`;
    if (el.tagName === "FIGURE") {
      if (cl.contains("shot")) {
        const opts = [];
        if (el.dataset.key) opts.push(`img:${el.dataset.key}`);
        if (el.dataset.reqW) opts.push(`w:${el.dataset.reqW}`);
        if (cl.contains("noborder")) opts.push("noborder");
        if (el.id && !/^fig-auto-/.test(el.id)) opts.push(`#${el.id}`);
        return `[screenshot: ${el.dataset.caption || ""}${opts.length ? " | " + opts.join(" | ") : ""}]`;
      }
      const img = el.querySelector("img");
      return img ? `![${el.dataset.caption || img.alt || ""}](${img.getAttribute("src") || ""})` : "";
    }
    if (/^H[1-6]$/.test(el.tagName)) {
      const label = el.dataset.label ? ` {#${el.dataset.label}}` : "";
      return "#".repeat(+el.tagName[1]) + " " + inlineMd(el).replace(/\s+/g, " ").trim() + label;
    }
    if (el.tagName === "P") return inlineMd(el).trim();
    if (el.tagName === "HR") return "---";
    if (el.tagName === "BLOCKQUOTE") return childrenMd(el).split("\n").map(l => ("> " + l).trimEnd()).join("\n");
    if (el.tagName === "PRE") {
      const code = el.querySelector("code") || el;
      const lang = ((code.className || "").match(/language-([\w+-]+)/) || [])[1] || "";
      return "```" + lang + "\n" + code.textContent.replace(/\n$/, "") + "\n```";
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
  function serializeLogical(frags) {
    if (frags.length === 1) return blockMd(frags[0]);
    const tag = frags[0].tagName;
    if (/^(P|H[1-6])$/.test(tag)) {
      return frags.map(blockMd).reduce((a, b) => {
        if (!a) return b;
        if (!b) return a;
        return a + (/\s$/.test(a) || /^\s/.test(b) ? "" : " ") + b;
      }, "");
    }
    let lines = blockMd(frags[0]).split("\n");
    for (let i = 1; i < frags.length; i++) {
      // continuation fragments carry cloned attributes — drop their duplicate
      // caption line and separator row before stitching
      let bLines = blockMd(frags[i]).split("\n").filter(l => !/^\|\s*:?-{3}/.test(l) && !/^\[table:/.test(l));
      const contFirst = frags[i].firstElementChild && frags[i].firstElementChild.hasAttribute("data-split-from");
      if (contFirst && lines.length && bLines.length && tag !== "TABLE") {
        const b0 = bLines[0].replace(/^\s*(?:[-*]|\d+\.)\s+/, "").replace(/^>\s?/, "");
        lines[lines.length - 1] += (/\s$/.test(lines[lines.length - 1]) ? "" : " ") + b0;
        bLines = bLines.slice(1);
      }
      lines = lines.concat(bLines);
    }
    if (tag === "OL") {     // fragment-local numbering restarts — renumber the top level
      let n = 0;
      lines = lines.map(l => /^\d+\. /.test(l) ? `${++n}. ` + l.replace(/^\d+\. /, "") : l);
    }
    return lines.join("\n");
  }

  /* ================= locating blocks ================= */

  const TOP_SEL = ".pagedjs_page .content > [data-ss]";

  function topEntries() {
    /* Fold same-data-ref elements into one logical block ONLY when the later
       one is a genuine Paged.js continuation (data-split-from). A browser
       Enter-split clones the node WITH its data-ref — those clones are new,
       separate blocks and must serialize as two paragraphs, not be glued. */
    const byRef = new Map();
    const out = [];
    for (const el of hooks.scaleWrap.querySelectorAll(TOP_SEL)) {
      const ref = el.getAttribute("data-ref") || "";
      if (ref && byRef.has(ref) && el.hasAttribute("data-split-from")) {
        byRef.get(ref).frags.push(el);
        continue;
      }
      const entry = { el, frags: [el], ss: +el.dataset.ss, se: +el.dataset.se };
      if (ref && !byRef.has(ref)) byRef.set(ref, entry);
      out.push(entry);
    }
    return out;
  }

  function blockOf(node) {
    let el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el) return null;
    const stamped = el.closest(".content > [data-ss]");
    if (stamped) return stamped;
    // fresh, unstamped element (a paragraph typed after the last block):
    // anchor on the nearest stamped sibling so its content joins that range
    const top = el.closest(".content > *");
    if (!top) return null;
    for (let p = top.previousElementSibling; p; p = p.previousElementSibling) if (p.dataset.ss != null) return p;
    for (let n = top.nextElementSibling; n; n = n.nextElementSibling) if (n.dataset.ss != null) return n;
    return null;
  }

  function rangeOfSelection() {
    const sel = document.getSelection();
    if (!sel || !sel.anchorNode || !hooks.scaleWrap.contains(sel.anchorNode)) return null;
    const a = blockOf(sel.anchorNode);
    const f = sel.focusNode && hooks.scaleWrap.contains(sel.focusNode) ? blockOf(sel.focusNode) : a;
    const els = [a, f].filter(Boolean);
    if (!els.length) return null;
    return {
      ss: Math.min(...els.map(e => +e.dataset.ss)),
      se: Math.max(...els.map(e => +e.dataset.se)),
    };
  }

  const union = (a, b) => !a ? b : !b ? a : { ss: Math.min(a.ss, b.ss), se: Math.max(a.se, b.se) };

  /* ================= write-back ================= */

  function syncRange(ss, se) {
    const entries = topEntries();
    let lo = -1, hi = -1;
    entries.forEach((en, i) => {
      if (en.se >= ss && en.ss <= se) { if (lo < 0) lo = i; hi = i; }
    });
    if (lo < 0) { hooks.revert(); return; }

    /* fold in fresh unstamped siblings sitting inside or against the window —
       DOM-ordered .content children between (and touching) the slice */
    const sliceEls = entries.slice(lo, hi + 1);
    const first = sliceEls[0].frags[0], last = sliceEls[sliceEls.length - 1].frags.at(-1);
    const domSlice = [];
    const pages = [...hooks.scaleWrap.querySelectorAll(".pagedjs_page .content")];
    let on = false;
    outer: for (const pageContent of pages) {
      for (const child of pageContent.children) {
        if (child === first) on = true;
        if (on && child.nodeType === 1) domSlice.push(child);
        if (child === last) { // keep swallowing trailing unstamped siblings
          for (let n = child.nextElementSibling; n && n.dataset.ss == null; n = n.nextElementSibling) domSlice.push(n);
          break outer;
        }
      }
    }
    // serialize in DOM order; true Paged continuations fold into their first
    // appearance, browser-made clones stay separate blocks
    const seenRef = new Set();
    const parts = [];
    for (const el of domSlice) {
      const ref = el.getAttribute("data-ref") || "";
      if (ref && seenRef.has(ref) && el.hasAttribute("data-split-from")) continue;
      if (ref) seenRef.add(ref);
      const en = sliceEls.find(x => x.frags[0] === el);
      parts.push({ el, frags: en ? en.frags : [el], md: en ? serializeLogical(en.frags) : blockMd(el) });
    }

    const rangeSS = Math.min(ss, ...sliceEls.map(e => e.ss));
    const rangeSE = Math.max(se, ...sliceEls.map(e => e.se));
    const lines = hooks.getSource().split("\n");
    const kept = parts.filter(p => p.md.trim() !== "");
    // an emptied block renders nothing and keeps a stale stamp — remove it now
    // so a follow-up edit before the re-render can't splice against it
    parts.filter(p => p.md.trim() === "").forEach(p => p.el.remove());
    const newLines = kept.length ? kept.map(p => p.md).join("\n\n").split("\n") : [];
    const from = Math.max(0, Math.min(rangeSS, lines.length - 1));
    const to = Math.max(from, Math.min(rangeSE, lines.length - 1));
    lines.splice(from, to - from + 1, ...newLines);
    const delta = newLines.length - (to - from + 1);
    hooks.setSource(lines.join("\n"));

    // restamp the edited window, then shift everything after it
    let cursor = from;
    for (const p of kept) {
      const span = p.md.split("\n").length;
      for (const t of p.frags) { t.dataset.ss = cursor; t.dataset.se = cursor + span - 1; }
      cursor += span + 1;
    }
    for (const el of hooks.scaleWrap.querySelectorAll("[data-ss]")) {
      const elSS = +el.dataset.ss;
      if (elSS > to && !domSlice.includes(el)) {
        el.dataset.ss = elSS + delta;
        el.dataset.se = +el.dataset.se + delta;
      }
    }
  }

  /* ================= caret & viewport ================= */

  function editableTextNodes(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      let p = n.parentElement, skip = false;
      while (p && p !== root) {
        if (p.getAttribute && p.getAttribute("contenteditable") === "false") { skip = true; break; }
        p = p.parentElement;
      }
      if (!skip) out.push(n);
    }
    return out;
  }

  function captureCaret() {
    const sel = document.getSelection();
    if (!sel || !sel.rangeCount || !sel.focusNode || !hooks.scaleWrap.contains(sel.focusNode)) return null;
    const block = blockOf(sel.focusNode);
    if (!block || block.dataset.ss == null) return null;
    const entry = topEntries().find(e => e.frags.includes(block));
    const frags = entry ? entry.frags : [block];
    let off = 0;
    for (const frag of frags) {
      for (const t of editableTextNodes(frag)) {
        if (t === sel.focusNode) return { ss: +block.dataset.ss, off: off + sel.focusOffset };
        off += t.nodeValue.length;
      }
    }
    return { ss: +block.dataset.ss, off };
  }

  function restoreCaret(c) {
    if (!c) return;
    const entries = topEntries();
    const entry = entries.find(e => e.ss === c.ss) ||
      entries.reduce((best, e) => e.ss <= c.ss && (!best || e.ss > best.ss) ? e : best, null);
    if (!entry) return;
    let remaining = c.off;
    let target = null, local = 0;
    for (const frag of entry.frags) {
      for (const t of editableTextNodes(frag)) {
        if (remaining <= t.nodeValue.length) { target = t; local = remaining; break; }
        remaining -= t.nodeValue.length;
      }
      if (target) break;
    }
    if (!target) {
      const all = entry.frags.flatMap(editableTextNodes);
      target = all.at(-1);
      local = target ? target.nodeValue.length : 0;
    }
    if (!target) return;
    const pc = target.parentElement.closest(".pagedjs_page_content");
    if (pc) pc.focus({ preventScroll: true });
    const sel = document.getSelection();
    try { sel.collapse(target, Math.min(local, target.nodeValue.length)); } catch {}
  }

  function captureAnchor() {
    const contTop = hooks.scroller.getBoundingClientRect().top;
    const els = [...hooks.scaleWrap.querySelectorAll(TOP_SEL)];
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (r.height && r.bottom > contTop + 1) {
        const ss = +els[i].dataset.ss;
        // a block split across pages shares one ss — remember WHICH fragment
        // was on screen, or the restore lands a page early
        let fragIdx = 0;
        for (let j = i - 1; j >= 0 && +els[j].dataset.ss === ss; j--) fragIdx++;
        return { ss, fragIdx, delta: r.top - contTop };
      }
    }
    return null;
  }

  function restoreAnchor(a) {
    if (!a) return;
    const els = [...hooks.scaleWrap.querySelectorAll(TOP_SEL)];
    const matches = els.filter(el => +el.dataset.ss === a.ss);
    let best = null;
    if (matches.length) {
      best = matches[Math.min(a.fragIdx || 0, matches.length - 1)];
    } else {
      for (const el of els) {
        const ss = +el.dataset.ss;
        if (ss <= a.ss || !best) best = el;
        if (ss > a.ss) break;
      }
    }
    if (!best) return;
    const d = best.getBoundingClientRect().top - hooks.scroller.getBoundingClientRect().top;
    hooks.scroller.scrollTop += d - a.delta;
  }

  function captureView() {
    if (!hooks) return null;
    return { anchor: captureAnchor(), caret: captureCaret() };
  }
  function restoreView(v) {
    if (!hooks || !v) return;
    if (v.caret) restoreCaret(v.caret);
    restoreAnchor(v.anchor);
  }

  /* ================= events ================= */

  /* Typing must cost nothing: each keystroke only widens the pending source
     window (two closest() calls); serialization and the source splice run on
     a short pause — and always flush before anything reads the source. */
  let flushTimer = 0;
  let lost = false;   // an edit landed somewhere unmappable — revert at flush

  function flush() {
    clearTimeout(flushTimer); flushTimer = 0;
    if (!hooks) return;
    if (lost) { lost = false; pending = null; hooks.revert(); return; }
    if (!pending) return;
    const r = pending; pending = null;
    syncRange(r.ss, r.se);
  }

  function onBeforeInput(e) {
    const t = e.inputType || "";
    if (t === "historyUndo") { e.preventDefault(); flush(); hooks.undo(); return; }
    if (t === "historyRedo") { e.preventDefault(); flush(); hooks.redo(); return; }
    pending = union(pending, rangeOfSelection());
    if (t === "insertFromPaste" || t === "insertFromDrop") {
      // plain text only — arbitrary pasted HTML would not survive the round-trip
      e.preventDefault();
      const text = (e.dataTransfer || e.clipboardData)?.getData("text/plain") ?? "";
      if (text) document.execCommand("insertText", false, text);
    }
  }

  function onInput() {
    const r = union(pending, rangeOfSelection());
    if (!r) { lost = true; }
    pending = r;
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 250);
    hooks.editPending();   // keeps the deferred re-render pushed out while typing
  }

  function arm() {
    if (!hooks) return;
    hooks.scaleWrap.querySelectorAll(".pagedjs_area > .pagedjs_page_content").forEach(pc => {
      pc.setAttribute("contenteditable", "true");
      pc.setAttribute("spellcheck", "false");
    });
  }

  function attach(h) {
    hooks = h;
    hooks.scaleWrap.addEventListener("beforeinput", onBeforeInput);
    hooks.scaleWrap.addEventListener("input", onInput);
  }

  return { attach, arm, captureView, restoreView, flush };
})();
