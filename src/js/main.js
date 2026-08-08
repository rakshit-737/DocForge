/* ============================================================
   main.js — app state, UI, preview loop, exports
   ============================================================ */
"use strict";

(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  /* ---------------- storage (safe in sandboxed frames) ---------------- */
  const safeLS = {
    get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch { return false; } },
  };
  const LS_KEY = "docforge.v1";

  /* ---------------- defaults & templates ---------------- */
  const todayISO = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  const THEME_ACCENT = { modern: "#2563eb", executive: "#1f3a5f", academic: "#7f1d1d", minimal: "#111827" };
  const DEFAULTS = {
    title: "", subtitle: "", author: "", kicker: "", metaExtra: "", date: todayISO(),
    theme: "modern", accent: "#2563eb", page: "A4", margins: "normal",
    cover: true, header: true, pageNums: true, numbered: false, justify: false, h1break: false,
    hardWrap: false, citeStyle: "ieee",
    borderStyle: "none", borderWeight: "medium", borderColor: "ink",
    fontHead: "theme", fontBody: "theme",
    baseSize: "11", lineSpacing: "default",
  };

  /* Projects saved before the border system grew options carry a single
     pageBorder key — translate it and never write it back. */
  function normalizeSettings(s) {
    const out = { ...DEFAULTS, ...s };
    if (s && s.pageBorder && s.borderStyle == null) {
      const map = {
        rule:   { borderStyle: "rule", borderColor: "ink" },
        double: { borderStyle: "double", borderColor: "ink" },
        frame:  { borderStyle: "thickthin", borderColor: "accent" },
      }[s.pageBorder];
      if (map) Object.assign(out, map);
    }
    delete out.pageBorder;
    return out;
  }

  const TEMPLATES = {
    welcome: {
      label: "Quick tour (start here)",
      desc: "A five-minute working introduction to everything DocForge does.",
      patch: { title: "Welcome to DocForge", subtitle: "Type on the left — get a print-ready document on the right.", author: "Your Name", kicker: "Quick tour", theme: "modern", accent: "#2563eb" },
      source: `[toc]

# Getting started

Welcome! **DocForge** turns plain text into a polished, print-ready document — cover page, automatic table of contents, running headers, footers and page numbers included.

Write with simple *Markdown* marks (the toolbar inserts them for you):

- \`# Heading\` starts a section — \`##\` and \`###\` for sub-sections
- \`**bold**\`, \`*italic*\` and \`\` \`code\` \`\`
- \`-\` for bullets, \`1.\` for numbered lists

:::tip Try it now
Change anything on the left and watch the pages update. Open **Settings** (top right) to switch the theme, accent colour, page size and more.
:::

## Screenshot placeholders

Add a screenshot slot anywhere with a single line:

[screenshot: Homepage of the app, with the login form visible]

Leave it as a tidy placeholder in the printed PDF — or **click the box in the preview** to attach the real image. Either way it becomes a numbered figure.

## Tables and callouts

| Feature | How | Notes |
| --- | --- | --- |
| Cover page | Settings → Cover page | Title, subtitle, author, date |
| Table of contents | \`[toc]\` | Real page numbers with dotted leaders |
| Page break | \`[pagebreak]\` | Forces a new page |
| Callouts | \`:::note\` … \`:::\` | note, tip, warning, important |

# Exporting

## PDF

Hit **PDF** and choose *Save as PDF* in the print dialog. Margins, page numbers and the contents page are already handled — nothing to configure.

## Word

**Word** downloads a real \`.docx\`: styled headings, cover page, tables, figures and an auto-updating table of contents. When Word asks to *update fields*, click **Yes** so the contents page fills itself in.

# Make it yours

1. Switch themes — Modern, Executive, Academic or Minimal
2. Pick an accent colour to match your brand or college
3. Start from a template in the **Templates** menu

:::note
Everything runs in this one file — no account, no internet, nothing to install. Your work autosaves in this browser; use **Save** for a backup file you can reopen anywhere.
:::
`,
    },
    assignment: {
      label: "Assignment / academic report",
      desc: "Numbered sections, cover page, references — ready for submission.",
      patch: { theme: "academic", accent: "#7f1d1d", numbered: true, justify: true, h1break: true, title: "Assignment Title", subtitle: "A concise one-line description of what this report covers", kicker: "Course Name · CS-101", metaExtra: "Roll No. 00 · Section A", cover: true },
      source: `[toc]

# Introduction

State the problem this assignment addresses and why it matters. Keep it to two or three paragraphs: the context, the goal, and a one-line summary of your approach.

## Objectives

1. First objective of the work
2. Second objective
3. Third objective

# Background

Summarise the concepts, papers or tools the reader needs. Cite sources in brackets [1] and list them in the References section.

# Methodology

Describe your approach step by step. Include diagrams or screenshots where they help:

[screenshot: System / setup overview]

# Implementation

Explain the key parts of your implementation. Short code excerpts beat long listings:

\`\`\`
function example(input) {
  return process(input);
}
\`\`\`

# Results and Discussion

Present results in tables and figures, then interpret them — what worked, what didn't, and why.

| Test case | Expected | Observed | Result |
| --- | --- | --- | --- |
| Case 1 | Value | Value | Pass |
| Case 2 | Value | Value | Pass |

[screenshot: Output of the final run]

:::note Observation
Call out the single most important finding here so it isn't lost in the prose.
:::

# Conclusion

Summarise what was achieved against each objective, note limitations, and suggest future work.

# References

1. Author, *Title of the source*, Publisher, Year.
2. Author, *Title of the source*, Journal / Conference, Year.
`,
    },
    proposal: {
      label: "Business proposal",
      desc: "Executive summary, scope, timeline and pricing tables for a client.",
      patch: { theme: "executive", accent: "#1f3a5f", title: "Project Proposal", subtitle: "Prepared for [Client] — scope, timeline and investment", kicker: "Your Company", metaExtra: "proposal@yourcompany.com", cover: true, h1break: false, numbered: false },
      source: `# Executive Summary

One paragraph a busy decision-maker can read in thirty seconds: the problem, your solution, the outcome you're promising, and the investment required.

:::tip Why us
One or two sentences on the single strongest reason you'll deliver — track record, speed, or specialist expertise.
:::

# The Problem

Describe the client's situation in their words. Quantify the cost of doing nothing where possible.

# Proposed Solution

Explain what you will build or deliver and how it solves the problem above. Keep the technology honest and the benefits concrete.

[screenshot: Mock-up or illustrative screen of the deliverable]

# Scope & Deliverables

| Deliverable | Description | Included |
| --- | --- | --- |
| Item one | What the client receives | Yes |
| Item two | What the client receives | Yes |
| Item three | Optional add-on | Optional |

# Timeline

| Phase | Work | Duration |
| --- | --- | --- |
| Discovery | Requirements and sign-off | 1 week |
| Build | Core delivery | 3 weeks |
| Handover | Testing, training, docs | 1 week |

# Investment

| Package | What's included | Price |
| --- | --- | --- |
| Standard | Scope above | ₹ — |
| Extended | Scope + add-ons | ₹ — |

Payment terms: 50% to begin, 50% on delivery.

# Next Steps

1. Reply confirming the package
2. We send the agreement and kick-off date
3. Discovery workshop within one week

:::note Validity
This proposal is valid for 30 days from the date on the cover.
:::
`,
    },
    report: {
      label: "Project / status report",
      desc: "Progress, metrics, risks and decisions for a working team.",
      patch: { theme: "modern", accent: "#2563eb", title: "Project Report", subtitle: "Progress, decisions and next steps", kicker: "Team / Department", cover: true, h1break: true },
      source: `[toc]

# Executive Summary

Three to five sentences: where the project stands, the headline wins, the main risk, and the ask.

# Progress This Period

## Completed

- Item shipped or finished
- Item shipped or finished

## In Progress

- Item under way, with expected completion

[screenshot: Latest build / dashboard state]

# Metrics

| Metric | Last period | This period | Trend |
| --- | --- | --- | --- |
| Metric one | 0 | 0 | → |
| Metric two | 0 | 0 | ↑ |

# Risks & Issues

:::warning Top risk
Name the risk, its impact, and the mitigation you propose.
:::

# Decisions Needed

1. Decision one — options and recommendation
2. Decision two — options and recommendation

# Next Steps

- Action, owner, date
- Action, owner, date
`,
    },
    letter: {
      label: "Formal letter",
      desc: "Address block, subject line and a clean sign-off — no cover, no numbers.",
      patch: { theme: "minimal", accent: "#111827", cover: false, header: false, pageNums: false, numbered: false, h1break: false, hardWrap: true, title: "Letter", subtitle: "" },
      source: `**Your Name**
Your address line
City, PIN
your.email@example.com

[DATE]

**To**
Recipient Name
Designation, Organisation
Address line

**Subject: State the purpose of the letter in one line**

Dear Sir/Madam,

Opening paragraph: introduce yourself and state why you are writing, in two or three sentences.

Middle paragraph(s): the substance — facts, dates, reference numbers. Keep each paragraph to a single point.

Closing paragraph: state clearly what action or response you are requesting, and by when.

Thank you for your time and consideration.

Yours faithfully,

**Your Name**
`,
    },
    article: {
      label: "Article / essay",
      desc: "A quiet, minimal frame for a piece of writing that stands on its own.",
      patch: { theme: "minimal", accent: "#111827", title: "Article Title", subtitle: "A one-line standfirst that frames the piece", cover: true, header: true, pageNums: true, h1break: false },
      source: `# Opening

Start with the idea, scene or question that earns the reader's attention. No throat-clearing.

# The Argument

Develop the piece one point per section. Quote sparingly and attribute clearly:

> A short, well-chosen quotation does more work than a paragraph of summary.

# Counterpoint

Take the strongest objection seriously and answer it.

# Closing

Land the piece: return to the opening image or question and say what it means now.
`,
    },
    blank: {
      label: "Blank document",
      desc: "An empty page and nothing else.",
      patch: { title: "Untitled document", subtitle: "", kicker: "", metaExtra: "" },
      source: `# Heading

Start writing here.
`,
    },
  };

  /* ---------------- state ---------------- */
  let state = { settings: { ...DEFAULTS }, source: "", attachments: {}, accentTouched: false };
  let lastContentEl = null;
  let previewer = null;
  let rendering = false, renderPending = false, renderTimer = null;
  let autosaveTimer = null;
  let zoomMode = "fit", zoomVal = 1;
  let imgMode = null; // {type:'insert'} | {type:'attach', idx}
  let preprintZoom = null, appTitle = null;

  const editor = $("#editor");
  const scaleWrap = $("#scaleWrap");
  const DOC_CSS = Engine.fontFaceCss() + (window.__KATEX_CSS__ || "") + (window.__DOC_CSS__ || "");

  /* The chrome wears the same faces as the document (see app.css) — register them
     on the app document itself so the UI never waits for the first preview render. */
  {
    const st = document.createElement("style");
    st.textContent = Engine.fontFaceCss();
    document.head.appendChild(st);
  }

  /* ---------------- toast & confirm ---------------- */
  function toast(msg, type) {
    const d = document.createElement("div");
    d.className = "toast" + (type ? " " + type : "");
    d.textContent = msg;
    $("#toasts").appendChild(d);
    setTimeout(() => { d.style.opacity = "0"; d.style.transition = "opacity .3s"; }, 3400);
    setTimeout(() => d.remove(), 3800);
  }
  function confirmModal(title, body) {
    return new Promise(res => {
      $("#cfTitle").textContent = title;
      $("#cfBody").textContent = body;
      $("#confirmOverlay").classList.add("open");
      const done = v => { $("#confirmOverlay").classList.remove("open"); $("#cfYes").onclick = $("#cfNo").onclick = null; res(v); };
      $("#cfYes").onclick = () => done(true);
      $("#cfNo").onclick = () => done(false);
    });
  }

  /* ---------------- repeat table headers across page breaks ----------------
     Paged.js fragments a table by shallow-cloning the ancestor chain
     table > tbody > tr (rebuildAncestors) and never carries the <thead> over,
     so each continuation page holds a headerless <table>. Every rebuilt
     ancestor is stamped data-split-from, which is the marker we key off.

     This runs in the `renderNode` hook, NOT afterPageLayout: renderNode fires
     while the page is still being filled, so the injected header's height is
     seen by findBreakToken and the last row spills to the next page instead of
     being clipped. Cloning the real <thead> (rather than faking a row) is also
     what restores the accent top/bottom rules, which doc.css declares on `th`. */
  class RepeatTableHeader extends Paged.Handler {
    renderNode(clone, node) {
      const el = clone && (clone.nodeType === 1 ? clone : clone.parentElement);
      if (!el || !el.closest) return;
      const destTable = el.closest("table[data-split-from]");
      if (!destTable) return;
      if (destTable.querySelector(":scope > thead")) return; // first fragment / already done
      const srcEl = node && (node.nodeType === 1 ? node : node.parentElement);
      const srcTable = srcEl && srcEl.closest && srcEl.closest("table");
      const srcHead = srcTable && srcTable.querySelector(":scope > thead");
      if (!srcHead || !srcHead.childElementCount) return;
      const head = srcHead.cloneNode(true);
      head.removeAttribute("data-ref");                       // keep Paged.js' data-ref
      head.querySelectorAll("[data-ref]").forEach(n => n.removeAttribute("data-ref"));
      head.querySelectorAll("[id]").forEach(n => n.removeAttribute("id"));
      head.setAttribute("data-repeated-header", "");
      destTable.insertBefore(head, destTable.firstChild);
    }
  }
  Paged.registerHandlers(RepeatTableHeader);

  /* ---------------- folios ----------------
     Front matter (cover, contents) and the body run on two different sequences, and the
     body's "of N" must count body pages only. No CSS page counter can express either, so
     the folio text is written per page here and picked up by
     `@bottom-center { content: var(--df-foot) }` in Engine.dynamicCss(). */
  const ROMAN = [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  function roman(n) {
    let out = "";
    for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
    return out;
  }

  class PageNumbering extends Paged.Handler {
    afterRendered(pages) {
      const els = [...pages].map(p => p.element || p).filter(el => el && el.classList);
      const kindOf = el =>
        el.classList.contains("pagedjs_cover_page") ? "cover" :
        el.classList.contains("pagedjs_front_page") ? "front" : "body";
      const kinds = els.map(kindOf);
      const bodyTotal = kinds.filter(k => k === "body").length;

      const folio = new Map(); // page element → the number the reader actually sees on it
      let f = 0, b = 0;
      els.forEach((el, i) => {
        let num = "", txt = "";
        if (kinds[i] === "front") { num = roman(++f); txt = num; }
        else if (kinds[i] === "body") { num = String(++b); txt = `Page ${num} of ${bodyTotal}`; }
        folio.set(el, num);
        // A quoted string, because it lands in a CSS `content:` value.
        el.style.setProperty("--df-foot", JSON.stringify(txt));
      });

      // Contents entries must quote that same folio, not the absolute sheet number —
      // otherwise the contents page and the printed footer disagree.
      const esc = s => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/"/g, '\\"'));
      els.forEach(el => el.querySelectorAll('.toc a[href^="#"]').forEach(a => {
        const id = a.getAttribute("href").slice(1);
        const host = els.find(pe => pe.querySelector(`#${esc(id)}`));
        a.style.setProperty("--df-tocnum", JSON.stringify(host ? folio.get(host) || "" : ""));
      }));
    }
  }
  Paged.registerHandlers(PageNumbering);

  /* ---------------- footnote hardening ----------------
     pagedjs 0.4.3's footnote module has two defects. A note that is placed and then
     removed (because its call was pushed off the page) leaves --pagedjs-footnotes-height
     reserved, so the page keeps an empty strip — measured at up to 608px. And its
     margin/border maths runs parseInt over fractional computed values, leaving the area
     about a pixel short and clipping the descenders of the last line. */
  class FootnoteFix extends Paged.Handler {
    afterPageLayout(pageElement) {
      const area = pageElement.querySelector(".pagedjs_area");
      const cont = pageElement.querySelector(".pagedjs_footnote_content");
      const inner = pageElement.querySelector(".pagedjs_footnote_inner_content");
      if (!area || !cont || !inner) return;

      const reserved = parseFloat(area.style.getPropertyValue("--pagedjs-footnotes-height")) || 0;
      const notes = inner.querySelectorAll("[data-note='footnote']");

      if (!notes.length) {
        if (reserved > 0) area.style.setProperty("--pagedjs-footnotes-height", "0px");
        cont.classList.add("pagedjs_footnote_empty");
        return;
      }

      const px = v => parseFloat(v) || 0;
      const cs = getComputedStyle(cont);
      const chrome = px(cs.marginTop) + px(cs.marginBottom) + px(cs.paddingTop) +
        px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
      let needed = 0;
      notes.forEach(n => { needed += n.getBoundingClientRect().height; });
      const want = Math.ceil(needed + chrome);
      if (want > Math.ceil(reserved)) area.style.setProperty("--pagedjs-footnotes-height", want + "px");
      inner.style.height = "auto";
      cont.style.height = "auto";
    }
  }
  Paged.registerHandlers(FootnoteFix);

  /* ---------------- rendering ---------------- */
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(doRender, 420);
  }

  async function doRender() {
    clearTimeout(renderTimer); renderTimer = null;
    if (rendering) { renderPending = true; return; }
    rendering = true;
    $("#busy").classList.add("on");
    try {
      const { doc } = Engine.render(state.source, state.settings, state.attachments);
      lastContentEl = doc.querySelector(".content").cloneNode(true);
      const css = DOC_CSS + Engine.dynamicCss(state.settings);
      document.querySelectorAll("style[data-pagedjs-inserted-styles]").forEach(s => s.remove());
      if (previewer) { try { previewer.polisher.destroy(); } catch {} }
      scaleWrap.innerHTML = "";
      previewer = new Paged.Previewer();
      const url = URL.createObjectURL(new Blob([css], { type: "text/css" }));
      const flow = await previewer.preview(doc.outerHTML, [url], scaleWrap);
      URL.revokeObjectURL(url);
      $("#pgInfo").textContent = flow.total + (flow.total === 1 ? " page" : " pages");
      applyZoom();
      refreshOutline();
    } catch (e) {
      console.error("[DocForge] render failed", e);
      toast("Preview error — check your markup", "warn");
    }
    rendering = false;
    $("#busy").classList.remove("on");
    if (renderPending) { renderPending = false; doRender(); }
  }

  async function ensureFresh() {
    if (renderTimer) { await doRender(); }
    while (rendering) await new Promise(r => setTimeout(r, 80));
  }

  function applyZoom() {
    const pg = Engine.PAGES[state.settings.page] || Engine.PAGES.A4;
    const pgPx = pg.w * 96 / 25.4;
    const avail = $("#previewScroll").clientWidth - 44;
    const z = zoomMode === "fit" ? Math.min(1.35, Math.max(0.25, avail / pgPx)) : zoomVal;
    if (CSS.supports("zoom", "1")) { scaleWrap.style.zoom = z; scaleWrap.style.transform = ""; }
    else { scaleWrap.style.transform = `scale(${z})`; }
    $("#zoomPct").textContent = Math.round(z * 100) + "%";
  }

  /* ---------------- autosave & counts ---------------- */
  /* The document announces itself in the masthead, next to its save state. */
  function updateDocTitle() {
    const el = $("#docTitle");
    if (el) el.textContent = state.settings.title || "Untitled document";
  }

  function markDirty() {
    updateDocTitle();
    clearTimeout(autosaveTimer);
    $("#saveState").textContent = "…";
    $("#saveState").className = "";
    autosaveTimer = setTimeout(() => {
      const ok = safeLS.set(LS_KEY, JSON.stringify({ v: 1, settings: state.settings, source: state.source, attachments: state.attachments, accentTouched: state.accentTouched }));
      const el = $("#saveState");
      if (ok) { el.textContent = "Autosaved"; el.className = "saved"; }
      else { el.textContent = "Autosave unavailable — use Save"; el.className = "err"; }
    }, 1100);
    updateCounts();
    refreshLint();
  }
  function updateCounts() {
    const w = (state.source.trim().match(/\S+/g) || []).length;
    const mins = Math.max(1, Math.round(w / 200));
    $("#wordCount").textContent = w + (w === 1 ? " word" : " words") + (w > 60 ? ` · ${mins} min read` : "");
  }

  /* ---------------- settings UI ---------------- */
  const FIELDS = { sTitle: "title", sSubtitle: "subtitle", sAuthor: "author", sKicker: "kicker", sMetaExtra: "metaExtra", sDate: "date" };
  const SELECTS = {
    sTheme: "theme", sPage: "page", sMargins: "margins", sCiteStyle: "citeStyle",
    sBorderStyle: "borderStyle", sBorderWeight: "borderWeight", sBorderColor: "borderColor",
    sFontHead: "fontHead", sFontBody: "fontBody",
    sBaseSize: "baseSize", sLineSpacing: "lineSpacing",
  };
  const TOGGLES = { tCover: "cover", tHeader: "header", tPageNums: "pageNums", tNumbered: "numbered", tJustify: "justify", tH1break: "h1break", tHardWrap: "hardWrap" };

  /* ---------------- font pickers ----------------
     The two settings selects and the toolbar's selection box all carry the same
     catalogue: the embedded faces (travel inside the file) and the classic Word
     menu (used from this device, written into the .docx by name). */
  const fontInstalled = name => { try { return document.fonts.check(`12px "${name}"`); } catch { return true; } };

  function fontOptionsHtml(kind) {
    let h = kind === "settings" ? `<option value="theme">Theme default</option>` : `<option value="">Typeface…</option>`;
    h += `<optgroup label="Embedded — travel inside the file">`;
    for (const [key, face] of Object.entries(Engine.FACES)) {
      h += `<option value="${kind === "settings" ? key : face.name}">${face.label}</option>`;
    }
    h += `</optgroup><optgroup label="Word fonts — this device, named in the .docx">`;
    for (const [name] of Engine.WORD_CATALOG) {
      const miss = fontInstalled(name) ? "" : " · not on this device";
      h += `<option value="${kind === "settings" ? "sys:" + name : name}">${name}${miss}</option>`;
    }
    h += `</optgroup>`;
    if (kind === "settings") h += `<option value="custom">Custom family…</option>`;
    return h;
  }

  /* A saved custom family ("sys:Whatever") must exist as an option or the select snaps
     back to the first entry when syncSettingsUI assigns it. */
  function ensureFontOption(sel, value) {
    if (!value || [...sel.options].some(o => o.value === value)) return;
    const o = document.createElement("option");
    o.value = value;
    o.textContent = value.replace(/^sys:/, "") + " (custom)";
    sel.insertBefore(o, sel.lastElementChild);
  }

  function buildFontSelects() {
    $("#sFontHead").innerHTML = fontOptionsHtml("settings");
    $("#sFontBody").innerHTML = fontOptionsHtml("settings");
    $("#tbFont").innerHTML = fontOptionsHtml("toolbar");
    $("#tbSize").innerHTML = `<option value="">Size…</option>` +
      [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48].map(n => `<option value="${n}">${n} pt</option>`).join("");
  }

  function syncSettingsUI() {
    for (const [id, k] of Object.entries(FIELDS)) $("#" + id).value = state.settings[k] || "";
    ensureFontOption($("#sFontHead"), state.settings.fontHead);
    ensureFontOption($("#sFontBody"), state.settings.fontBody);
    for (const [id, k] of Object.entries(SELECTS)) $("#" + id).value = state.settings[k];
    for (const [id, k] of Object.entries(TOGGLES)) $("#" + id).checked = !!state.settings[k];
    $("#cAccent").value = state.settings.accent;
    $$(".sw").forEach(sw => sw.classList.toggle("on", sw.dataset.c === state.settings.accent));
    updateDocTitle();
  }

  function bindSettings() {
    for (const [id, k] of Object.entries(FIELDS)) $("#" + id).addEventListener("input", e => {
      state.settings[k] = e.target.value; markDirty(); scheduleRender();
    });
    for (const [id, k] of Object.entries(SELECTS)) $("#" + id).addEventListener("change", e => {
      let v = e.target.value;
      if ((k === "fontHead" || k === "fontBody") && v === "custom") {
        const name = (window.prompt("Font family name, exactly as installed (e.g. Segoe UI Semibold):", "") || "").trim();
        if (!name) { syncSettingsUI(); return; }
        v = "sys:" + name;
        ensureFontOption(e.target, v);
      }
      state.settings[k] = v;
      if (k === "theme" && !state.accentTouched) {
        state.settings.accent = THEME_ACCENT[e.target.value] || DEFAULTS.accent;
        syncSettingsUI();
      }
      markDirty(); scheduleRender();
    });
    for (const [id, k] of Object.entries(TOGGLES)) $("#" + id).addEventListener("change", e => {
      state.settings[k] = e.target.checked; markDirty(); scheduleRender();
    });
    $$(".sw").forEach(sw => sw.addEventListener("click", () => {
      state.settings.accent = sw.dataset.c; state.accentTouched = true;
      syncSettingsUI(); markDirty(); scheduleRender();
    }));
    $("#cAccent").addEventListener("input", e => {
      state.settings.accent = e.target.value; state.accentTouched = true;
      $$(".sw").forEach(s => s.classList.remove("on"));
      markDirty(); scheduleRender();
    });
  }

  /* ---------------- editor toolbar ---------------- */
  function setSel(start, end) { editor.focus(); editor.setSelectionRange(start, end); }
  function replaceRange(s, e, text) {
    editor.setRangeText(text, s, e, "end");
    state.source = editor.value; markDirty(); scheduleRender();
  }
  function surround(pre, post, ph) {
    const s = editor.selectionStart, e = editor.selectionEnd;
    const sel = editor.value.slice(s, e) || ph;
    editor.focus();
    editor.setRangeText(pre + sel + post, s, e, "select");
    setSel(s + pre.length, s + pre.length + sel.length);
    state.source = editor.value; markDirty(); scheduleRender();
  }
  function linePrefix(prefix, numbered) {
    const v = editor.value;
    let s = editor.selectionStart, e = editor.selectionEnd;
    const ls = v.lastIndexOf("\n", s - 1) + 1;
    let le = v.indexOf("\n", e); if (le === -1) le = v.length;
    const seg = v.slice(ls, le).split("\n");
    const out = seg.map((l, i) => {
      const clean = l.replace(/^(\s*)(#{1,4}\s+|[-*]\s+|\d+\.\s+|>\s+)?/, "$1");
      return numbered ? clean.replace(/^(\s*)/, `$1${i + 1}. `) : clean.replace(/^(\s*)/, "$1" + prefix);
    }).join("\n");
    editor.focus();
    editor.setRangeText(out, ls, le, "end");
    state.source = editor.value; markDirty(); scheduleRender();
  }
  function insertBlock(text) {
    const v = editor.value, s = editor.selectionStart;
    const before = v.slice(0, s), after = v.slice(editor.selectionEnd);
    const pre = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const post = after && !after.startsWith("\n") ? "\n\n" : "\n";
    editor.focus();
    editor.setRangeText(pre + text + post, s, editor.selectionEnd, "end");
    state.source = editor.value; markDirty(); scheduleRender();
  }

  /* Like surround(), but leading/trailing whitespace stays outside the marks —
     `++text ++` would not tokenize. */
  function wrapInline(pre, post, ph) {
    const s = editor.selectionStart, e = editor.selectionEnd;
    const raw = editor.value.slice(s, e);
    const lead = (raw.match(/^\s*/) || [""])[0];
    const trail = raw.slice(lead.length).match(/\s*$/)[0];
    const core = raw.slice(lead.length, raw.length - trail.length) || ph;
    editor.focus();
    editor.setRangeText(lead + pre + core + post + trail, s, e, "select");
    const at = s + lead.length + pre.length;
    setSel(at, at + core.length);
    state.source = editor.value; markDirty(); scheduleRender();
  }

  function scriptWrap(mark, ph) {
    const sel = editor.value.slice(editor.selectionStart, editor.selectionEnd).trim();
    if (/\s/.test(sel)) { toast("Sub/superscript can't contain spaces", "warn"); return; }
    wrapInline(mark, mark, ph);
  }

  /* UPPER → lower → Title, judged from what the selection currently is.
     Attachment keys and URLs are case-sensitive machinery, not prose — skip them. */
  const CASE_SAFE = /(\|\s*img:[A-Za-z0-9]+|\]\([^)\n]*\)|https?:\/\/\S+)/g;
  function mapProse(sel, fn) {
    return sel.split(CASE_SAFE).map((part, i) => (i % 2 ? part : fn(part))).join("");
  }
  function cycleCase() {
    const s = editor.selectionStart, e = editor.selectionEnd;
    const sel = editor.value.slice(s, e);
    if (!sel || !/[a-z]/i.test(sel)) { toast("Select some text first", "warn"); return; }
    let next;
    if (sel === mapProse(sel, t => t.toUpperCase())) next = mapProse(sel, t => t.toLowerCase());
    else if (sel === mapProse(sel, t => t.toLowerCase())) {
      next = mapProse(sel, t => t.replace(/([a-z])([a-z']*)/gi, (m, a, b) => a.toUpperCase() + b.toLowerCase()));
    } else next = mapProse(sel, t => t.toUpperCase());
    editor.focus();
    editor.setRangeText(next, s, e, "select");
    state.source = editor.value; markDirty(); scheduleRender();
  }

  /* Word's "clear formatting": peel every character-level mark off the selection.
     Runs a few passes so nested marks unwrap fully. */
  function clearFormatting() {
    const s = editor.selectionStart, e = editor.selectionEnd;
    let sel = editor.value.slice(s, e);
    if (!sel) { toast("Select some text first", "warn"); return; }
    for (let i = 0; i < 4; i++) {
      sel = sel
        .replace(/\[([^\[\]{}\n]+)\]\{[^}\n]*\}/g, "$1")
        .replace(/\*\*([^*\n]+)\*\*/g, "$1")
        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2")
        .replace(/\+\+([^+\n]+)\+\+/g, "$1")
        .replace(/~~([^~\n]+)~~/g, "$1")
        .replace(/==(?:\{[A-Za-z]+\})?([^=\n]+)==/g, "$1")
        .replace(/\^([^\s^]+)\^/g, "$1")
        .replace(/(^|[^~])~([^\s~]+)~(?!~)/g, "$1$2")
        .replace(/`([^`\n]+)`/g, "$1");
    }
    editor.focus();
    editor.setRangeText(sel, s, e, "select");
    state.source = editor.value; markDirty(); scheduleRender();
  }

  /* Wrap the selected lines in an alignment container; a second press unwraps it. */
  function wrapAlign(dir) {
    const v = editor.value;
    const s = editor.selectionStart, e = editor.selectionEnd;
    const ls = v.lastIndexOf("\n", s - 1) + 1;
    let le = v.indexOf("\n", e); if (le === -1) le = v.length;
    const prevLs = ls >= 2 ? v.lastIndexOf("\n", ls - 2) + 1 : -1;
    const prevLine = prevLs >= 0 ? v.slice(prevLs, ls - 1) : "";
    const nextLe0 = le < v.length ? v.indexOf("\n", le + 1) : -1;
    const nextLe = nextLe0 === -1 ? v.length : nextLe0;
    const nextLine = le < v.length ? v.slice(le + 1, nextLe) : "";
    editor.focus();
    if (new RegExp(`^:::${dir}\\s*$`, "i").test(prevLine) && /^:::\s*$/.test(nextLine)) {
      // Replace up to (not past) the newline after ::: — the next paragraph keeps its break.
      editor.setRangeText(v.slice(ls, le), prevLs, nextLe, "select");
    } else {
      editor.setRangeText(`:::${dir}\n${v.slice(ls, le)}\n:::`, ls, le, "select");
    }
    state.source = editor.value; markDirty(); scheduleRender();
  }

  const applyHl = name => wrapInline(name === "yellow" ? "==" : `=={${name}}`, "==", "highlighted text");
  const applyColor = hexc => wrapInline("[", `]{color=${hexc}}`, "coloured text");
  const applyFont = name => wrapInline("[", `]{font="${name}"}`, "text");

  const TOOL_ACTS = {
    bold: () => surround("**", "**", "bold text"),
    italic: () => surround("*", "*", "italic text"),
    underline: () => wrapInline("++", "++", "underlined text"),
    strike: () => wrapInline("~~", "~~", "struck-out text"),
    sub: () => scriptWrap("~", "2"),
    sup: () => scriptWrap("^", "2"),
    case: cycleCase,
    clearfmt: clearFormatting,
    alignleft: () => wrapAlign("left"),
    aligncenter: () => wrapAlign("center"),
    alignright: () => wrapAlign("right"),
    alignjustify: () => wrapAlign("justify"),
    code: () => surround("`", "`", "code"),
    h1: () => linePrefix("# "), h2: () => linePrefix("## "), h3: () => linePrefix("### "),
    ul: () => linePrefix("- "), ol: () => linePrefix("", true), quote: () => linePrefix("> "),
    link: () => surround("[", "](https://)", "link text"),
    table: () => insertBlock("| Column | Column | Column |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |"),
    callout: () => insertBlock(":::note Optional title\nYour note text here.\n:::"),
    shot: () => insertBlock("[screenshot: Describe what the screenshot shows]"),
    image: () => { imgMode = { type: "insert" }; $("#imgInput").click(); },
    pagebreak: () => insertBlock("[pagebreak]"),
    toc: () => insertBlock("[toc]"),
    hr: () => insertBlock("---"),
    codeblock: () => insertBlock("```\ncode here\n```"),
  };

  /* ---------------- screenshot attachments ---------------- */
  function newKey() { return "i" + Math.random().toString(36).slice(2, 8); }

  function processImageFile(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = rej;
      fr.onload = () => {
        const img = new Image();
        img.onerror = rej;
        img.onload = () => {
          const MAX = 1600;
          let { width: w, height: h } = img;
          const isPng = /png|gif/i.test(file.type);
          if (w > MAX || h > MAX) {
            const k = MAX / Math.max(w, h);
            const cv = document.createElement("canvas");
            cv.width = Math.round(w * k); cv.height = Math.round(h * k);
            cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
            res({ dataUrl: cv.toDataURL(isPng ? "image/png" : "image/jpeg", 0.92), w: cv.width, h: cv.height });
          } else {
            res({ dataUrl: fr.result, w, h });
          }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function rewriteShotLine(idx, key) {
    const lines = state.source.split("\n");
    let n = -1;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(Engine.RE_SHOT);
      if (!m) continue;
      n++;
      if (n !== idx) continue;
      const cap = (m[1] || "").trim();
      lines[i] = "[screenshot" + (cap ? ": " + cap : "") + (key ? " | img:" + key : "") + "]";
      state.source = lines.join("\n");
      editor.value = state.source;
      return m[2] || null; // previous key
    }
    return null;
  }

  function bindImageInput() {
    $("#imgInput").addEventListener("change", async e => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file || !imgMode) return;
      try {
        const att = await processImageFile(file);
        const key = newKey();
        state.attachments[key] = att;
        if (imgMode.type === "insert") {
          const cap = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
          insertBlock(`[screenshot: ${cap} | img:${key}]`);
        } else {
          const old = rewriteShotLine(imgMode.idx, key);
          if (old) delete state.attachments[old];
          markDirty(); scheduleRender();
        }
        toast("Image attached");
      } catch { toast("Could not read that image", "warn"); }
      imgMode = null;
    });
  }

  function bindShotClicks() {
    const menu = $("#imgMenu");
    let menuIdx = null, menuKey = null;
    scaleWrap.addEventListener("click", e => {
      const fig = e.target.closest("figure.shot");
      if (!fig) return;
      menuIdx = +fig.dataset.idx;
      menuKey = fig.dataset.key || null;
      const hasImg = menuKey && state.attachments[menuKey];
      $("#imAttach").style.display = hasImg ? "none" : "block";
      $("#imReplace").style.display = hasImg ? "block" : "none";
      $("#imRemove").style.display = hasImg ? "block" : "none";
      menu.style.display = "block";
      const mw = 180, mh = 120;
      menu.style.left = Math.min(e.clientX, innerWidth - mw) + "px";
      menu.style.top = Math.min(e.clientY, innerHeight - mh) + "px";
    });
    document.addEventListener("click", e => {
      if (!e.target.closest("#imgMenu") && !e.target.closest("figure.shot")) menu.style.display = "none";
    }, true);
    const close = () => { menu.style.display = "none"; };
    $("#imAttach").onclick = $("#imReplace").onclick = () => { close(); imgMode = { type: "attach", idx: menuIdx }; $("#imgInput").click(); };
    $("#imRemove").onclick = () => {
      close();
      const old = rewriteShotLine(menuIdx, null);
      if (old) delete state.attachments[old];
      markDirty(); scheduleRender();
      toast("Image removed — placeholder kept");
    };
  }

  /* ---------------- highlight & text-colour menus ---------------- */
  function bindColorMenus() {
    const hlMenu = $("#hlMenu"), fcMenu = $("#fcMenu");
    const openAt = (menu, btn) => {
      const r = btn.getBoundingClientRect();
      menu.style.display = "block";
      menu.style.left = Math.min(r.left, innerWidth - menu.offsetWidth - 8) + "px";
      menu.style.top = (r.bottom + 6) + "px";
    };
    const closeBoth = () => { hlMenu.style.display = "none"; fcMenu.style.display = "none"; };
    $("#hlGrid").innerHTML = Object.entries(Engine.HL_COLORS).map(([k, v]) =>
      `<div class="pm-sw" data-k="${k}" title="${k}" style="background:#${v}"></div>`).join("");
    const FC = ["#c00000", "#e36c09", "#bf8f00", "#1a7f37", "#0f766e", "#2563eb", "#1f3a5f", "#6d28d9", "#c026d3", "#64748b", "#111827", "#000000"];
    $("#fcGrid").innerHTML = FC.map(c => `<div class="pm-sw" data-c="${c}" title="${c}" style="background:${c}"></div>`).join("");
    $("#tbHl").onclick = e => { e.stopPropagation(); fcMenu.style.display = "none"; openAt(hlMenu, e.currentTarget); };
    $("#tbFc").onclick = e => { e.stopPropagation(); hlMenu.style.display = "none"; openAt(fcMenu, e.currentTarget); };
    $("#hlGrid").onclick = e => { const k = e.target.dataset.k; if (!k) return; closeBoth(); applyHl(k); };
    $("#fcGrid").onclick = e => { const c = e.target.dataset.c; if (!c) return; closeBoth(); applyColor(c); };
    $("#fcCustom").addEventListener("change", e => { closeBoth(); applyColor(e.target.value); });
    document.addEventListener("click", e => {
      if (!e.target.closest(".popmenu") && !e.target.closest("#tbHl") && !e.target.closest("#tbFc")) closeBoth();
    });
    /* Selection typeface / size — the select snaps back to its placeholder after use. */
    $("#tbFont").addEventListener("change", e => { const v = e.target.value; e.target.value = ""; if (v) applyFont(v); });
    $("#tbSize").addEventListener("change", e => { const v = e.target.value; e.target.value = ""; if (v) wrapInline("[", `]{size=${v}}`, "text"); });
  }

  /* ---------------- project save / open ---------------- */
  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    // Remove synchronously — a stray element after the page stack adds a blank
    // page to any print that happens before a timeout would have fired.
    const url = a.href;
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const safeName = () => (state.settings.title || "document").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "document";

  function saveProject() {
    const data = { app: "docforge", v: 1, savedAt: new Date().toISOString(), settings: state.settings, source: state.source, attachments: state.attachments };
    downloadBlob(new Blob([JSON.stringify(data)], { type: "application/json" }), safeName() + ".docforge.json");
    toast("Project file saved");
  }
  function bindProjectInput() {
    $("#projInput").addEventListener("change", e => {
      const f = e.target.files[0];
      e.target.value = "";
      if (f) importFile(f);
    });
  }

  /* ---------------- import: project / Word / PDF / Markdown ---------------- */
  function openProjectFile(f) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        if (d.app !== "docforge") throw new Error("not a DocForge file");
        state.settings = normalizeSettings(d.settings);
        state.source = d.source || "";
        state.attachments = d.attachments || {};
        state.accentTouched = true;
        editor.value = state.source;
        syncSettingsUI(); markDirty(); doRender();
        toast("Project opened");
      } catch { toast("That doesn't look like a DocForge project file", "warn"); }
    };
    fr.readAsText(f);
  }

  /* An imported (non-project) image arrives as a data URL, not a File — same
     downscale rules as processImageFile so attachments stay autosave-sized. */
  function dataUrlAttachment(dataUrl) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const MAX = 1600;
        const { width: w, height: h } = img;
        if (w > MAX || h > MAX) {
          const k = MAX / Math.max(w, h);
          const cv = document.createElement("canvas");
          cv.width = Math.round(w * k); cv.height = Math.round(h * k);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          const isPng = /^data:image\/(png|gif)/i.test(dataUrl);
          res({ dataUrl: cv.toDataURL(isPng ? "image/png" : "image/jpeg", 0.92), w: cv.width, h: cv.height });
        } else res({ dataUrl, w, h });
      };
      img.src = dataUrl;
    });
  }

  async function importDocxFile(f) {
    const { html, messages } = await DocxImport.toHtml(await f.arrayBuffer());
    const doc = new DOMParser().parseFromString(html, "text/html");
    const atts = {};
    // Embedded pictures become numbered figures; formats the browser can't decode
    // (EMF/WMF vector clips, mostly) are dropped rather than left as broken tags.
    for (const img of [...doc.querySelectorAll('img[src^="data:"]')]) {
      try {
        const att = await dataUrlAttachment(img.src);
        const key = newKey();
        atts[key] = att;
        img.dataset.dfKey = key;
      } catch { img.remove(); }
    }
    const md = htmlToMd(doc.body.innerHTML);
    if (!md.trim()) throw new Error("That Word file appears to be empty");
    // Images that didn't survive the conversion (table cells, undecodable formats)
    // must not ride along as orphaned bytes in every autosave.
    for (const key of Object.keys(atts)) if (!md.includes("img:" + key)) delete atts[key];
    state.source = md;
    state.attachments = atts;
    if (messages && messages.length) console.warn("[DocForge] docx import notes:", messages);
  }

  async function importPdfFile(f) {
    toast("Reading PDF — a large file can take a few seconds…");
    const { source, warnings } = await PdfImport.toMarkdown(await f.arrayBuffer());
    state.source = source;
    state.attachments = {};
    (warnings || []).slice(0, 2).forEach(w => toast(w, "warn"));
  }

  /* A PDF can be worked on two ways — edited in place (layout preserved, overlay
     edits) or converted to a reflowed DocForge document. Ask which. */
  function pdfChoice(name) {
    return new Promise(res => {
      const ov = $("#pdfChoiceOverlay");
      $("#pcTitle").textContent = name;
      ov.classList.add("open");
      const done = v => {
        ov.classList.remove("open");
        $("#pcEdit").onclick = $("#pcConvert").onclick = $("#pcCancel").onclick = null;
        res(v);
      };
      $("#pcEdit").onclick = () => done("edit");
      $("#pcConvert").onclick = () => done("convert");
      $("#pcCancel").onclick = () => done(null);
    });
  }

  async function importFile(f) {
    const ext = ((f.name.match(/\.([a-z0-9]+)$/i) || [])[1] || "").toLowerCase();
    if (ext === "json") return openProjectFile(f);
    if (ext === "doc") return toast("Old binary .doc — open it in Word and save as .docx first", "warn");
    if (!["docx", "pdf", "md", "markdown", "txt"].includes(ext)) return toast("Can't import that file type", "warn");
    if (ext === "pdf") {
      const mode = await pdfChoice(f.name);
      if (!mode) return;
      if (mode === "edit") {
        try {
          await PdfEditor.open(await f.arrayBuffer(), f.name);
          document.body.classList.add("pdf-mode");
          toast("Editing in place — the original layout stays untouched underneath");
        } catch (err) {
          console.error("[DocForge] pdf edit open failed", err);
          toast(err && err.message ? err.message : "Could not open that PDF", "warn");
        }
        return;
      }
      // "convert" falls through to the replace-confirm below
    }
    if (!await confirmModal(`Import “${f.name}”?`,
      "The imported document will replace the editor contents. Your current work stays in autosave until you type again — use Save first if you want a backup file.")) return;
    try {
      if (ext === "docx") await importDocxFile(f);
      else if (ext === "pdf") await importPdfFile(f);
      else { state.source = await f.text(); state.attachments = {}; }
      state.settings.title = f.name.replace(/\.[a-z0-9]+$/i, "");
      editor.value = state.source;
      syncSettingsUI(); markDirty(); doRender();
      toast(`Imported ${f.name} — now fully editable`);
    } catch (err) {
      console.error("[DocForge] import failed", err);
      toast(err && err.message ? err.message : "Import failed — check the console", "warn");
    }
  }

  function applyTemplate(id) {
    const t = TEMPLATES[id];
    if (!t) return;
    state.settings = { ...DEFAULTS, ...t.patch, date: todayISO() };
    state.source = t.source.replace("[DATE]", Engine.fmtDate(todayISO()));
    state.attachments = {};
    state.accentTouched = false;
    editor.value = state.source;
    syncSettingsUI(); markDirty(); doRender();
  }

  /* ---------------- PDF in-place editor chrome ---------------- */
  function bindPdfEditor() {
    PdfEditor.hooks = { toast, confirm: confirmModal };
    $("#peClose").onclick = async () => {
      if (PdfEditor.hasEdits() && !await confirmModal("Leave PDF editing?",
        "Your overlay edits live only in this view — export the PDF first if you want to keep them.")) return;
      await PdfEditor.close();
      document.body.classList.remove("pdf-mode");
    };
    $("#peExport").onclick = async () => {
      const btn = $("#peExport");
      const label = btn.innerHTML;
      btn.disabled = true; btn.classList.add("busy");
      btn.innerHTML = `<span class="btnspin"></span> Exporting…`;
      try {
        const { blob, name } = await PdfEditor.exportPdf();
        downloadBlob(blob, name);
        toast("Edited PDF downloaded — original layout intact underneath");
      } catch (e) {
        console.error("[DocForge] pdf edit export failed", e);
        toast("PDF export failed — check the console", "warn");
      }
      btn.disabled = false; btn.classList.remove("busy");
      btn.innerHTML = label;
    };
  }
  const inPdfMode = () => document.body.classList.contains("pdf-mode");

  /* ---------------- exports ---------------- */
  async function exportPdf() {
    if (inPdfMode()) { toast("You're editing a PDF — use its Export button, or ← Studio to go back", "warn"); return; }
    await ensureFresh();
    toast("Choose “Save as PDF” in the print dialog");
    setTimeout(() => { try { window.print(); } catch { toast("Printing is blocked here — open this file directly in Chrome/Edge", "warn"); } }, 350);
  }
  async function exportDocx() {
    if (inPdfMode()) { toast("You're editing a PDF — Word export needs the studio (← Studio)", "warn"); return; }
    await ensureFresh();
    if (!lastContentEl) return;
    const btn = $("#btnDocx");
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add("busy");
    btn.innerHTML = `<span class="btnspin"></span> Exporting…`;
    try {
      const blob = await DocxExport.build(lastContentEl, state.settings, state.attachments);
      downloadBlob(blob, safeName() + ".docx");
      toast("Word file downloaded — click “Yes” if Word asks to update fields");
    } catch (e) {
      console.error("[DocForge] docx failed", e);
      toast("Word export failed — check the console", "warn");
    }
    btn.disabled = false;
    btn.classList.remove("busy");
    btn.innerHTML = label;
  }

  /* ---------------- boot ---------------- */
  /* ---------------- outline navigator ---------------- */
  let outlineOpen = false;
  function refreshOutline() {
    if (!outlineOpen) return;
    const panel = $("#outlinePanel");
    const heads = [...scaleWrap.querySelectorAll(".pagedjs_page .doc .content :is(h1,h2,h3)[id]")];
    if (!heads.length) { panel.innerHTML = `<div class="ol-empty">No headings yet</div>`; return; }
    panel.innerHTML = heads.map((h, i) =>
      `<button class="ol-item l${h.tagName[1]}" data-i="${i}">${Engine.esc(h.textContent)}</button>`).join("");
    panel.querySelectorAll(".ol-item").forEach(b => b.onclick = () => {
      heads[+b.dataset.i]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ---------------- find & replace ---------------- */
  const find = { open: false, at: -1 };
  function findBar(show) {
    find.open = show;
    $("#findBar").style.display = show ? "flex" : "none";
    if (show) { $("#findInput").focus(); $("#findInput").select(); findCount(); }
    else editor.focus();
  }
  function findCount() {
    const q = $("#findInput").value;
    if (!q) { $("#findCount").textContent = ""; return 0; }
    let n = 0, i = -1;
    const hay = editor.value.toLowerCase(), needle = q.toLowerCase();
    while ((i = hay.indexOf(needle, i + 1)) !== -1) n++;
    $("#findCount").textContent = n ? n + " found" : "none";
    return n;
  }
  function findStep(back) {
    const q = $("#findInput").value;
    if (!q) return;
    const hay = editor.value.toLowerCase(), needle = q.toLowerCase();
    let i;
    if (back) {
      i = hay.lastIndexOf(needle, Math.max(0, editor.selectionStart - 1));
      if (i === -1) i = hay.lastIndexOf(needle);
    } else {
      i = hay.indexOf(needle, editor.selectionEnd);
      if (i === -1) i = hay.indexOf(needle);
    }
    if (i === -1) return;
    editor.focus();
    editor.setSelectionRange(i, i + q.length);
  }
  function replaceOne() {
    const q = $("#findInput").value;
    if (!q) return;
    const sel = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    if (sel.toLowerCase() === q.toLowerCase()) {
      editor.setRangeText($("#replInput").value, editor.selectionStart, editor.selectionEnd, "end");
      state.source = editor.value; markDirty(); scheduleRender();
    }
    findStep(false); findCount();
  }
  function replaceAll() {
    const q = $("#findInput").value;
    if (!q) return;
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const next = editor.value.replace(re, $("#replInput").value);
    if (next === editor.value) return;
    const n = (editor.value.match(re) || []).length;
    editor.value = next;
    state.source = next; markDirty(); scheduleRender();
    toast(`Replaced ${n} occurrence${n === 1 ? "" : "s"}`);
    findCount();
  }

  /* ---------------- paste cleanup ----------------
     Word and web pages paste as HTML soup; convert the useful structure to the
     app's own markdown instead of dumping tags or losing everything. */
  function htmlToMd(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,meta,link,head title").forEach(n => n.remove());
    // A [screenshot] token is line-anchored and can never parse inside a table
    // cell — strip it there rather than printing the marker literally.
    const cell = t => t.replace(/\[screenshot:[^\]]*\]/gi, " ").replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
    function inline(node) {
      let s = "";
      node.childNodes.forEach(ch => {
        if (ch.nodeType === 3) { s += ch.textContent.replace(/\s+/g, " "); return; }
        if (ch.nodeType !== 1) return;
        const t = ch.tagName.toLowerCase(), inner = inline(ch);
        if (t === "br") s += "\n";
        else if ((t === "b" || t === "strong") && inner.trim()) s += `**${inner.trim()}**`;
        else if ((t === "i" || t === "em") && inner.trim()) s += `*${inner.trim()}*`;
        else if (t === "u" && inner.trim()) s += `++${inner.trim()}++`;
        else if ((t === "s" || t === "del" || t === "strike") && inner.trim()) s += `~~${inner.trim()}~~`;
        else if (t === "mark" && inner.trim()) {
          const hl = ch.getAttribute("data-hl");
          s += `==${hl && hl !== "yellow" ? `{${hl}}` : ""}${inner.trim()}==`;
        }
        else if (t === "span" && ch.classList.contains("dfspan") && inner.trim()) {
          // Rebuild the attribute span so colour/size/face survive a round trip.
          const d = ch.dataset, parts = [];
          if (d.color) parts.push("color=#" + d.color.toLowerCase());
          if (d.bg) parts.push("bg=#" + d.bg.toLowerCase());
          if (d.size) parts.push("size=" + d.size);
          if (d.font) parts.push(`font="${d.font}"`);
          if (d.u) parts.push("u");
          if (d.sc) parts.push("sc");
          if (d.caps) parts.push("caps");
          s += parts.length ? `[${inner.trim()}]{${parts.join(" ")}}` : inner;
        }
        // The sub/sup marks take no spaces; a multi-word script stays plain text.
        else if (t === "sub" && inner.trim() && !/\s/.test(inner.trim())) s += `~${inner.trim()}~`;
        else if (t === "sup" && inner.trim() && !/\s/.test(inner.trim())) s += `^${inner.trim()}^`;
        else if (t === "code" && inner.trim()) s += "`" + inner.trim() + "`";
        else if (t === "a" && ch.getAttribute("href") && /^https?:/i.test(ch.getAttribute("href")))
          s += `[${inner.trim() || ch.getAttribute("href")}](${ch.getAttribute("href")})`;
        else if (t === "img") {
          // On its own line so the [screenshot] token parses; imported keys attach the bytes.
          const key = ch.getAttribute("data-df-key");
          const alt = (ch.getAttribute("alt") || "").replace(/[|\[\]]/g, " ").replace(/\s+/g, " ").trim();
          if (key) s += `\n[screenshot: ${alt || "Imported image"} | img:${key}]\n`;
          else if (alt) s += `\n[screenshot: ${alt}]\n`;
        }
        else s += inner;
      });
      return s;
    }
    function block(node, depth = 0) {
      let out = "";
      node.childNodes.forEach(ch => {
        if (ch.nodeType === 3) { const t = ch.textContent.trim(); if (t) out += t + "\n\n"; return; }
        if (ch.nodeType !== 1) return;
        const t = ch.tagName.toLowerCase();
        if (/^h[1-6]$/.test(t)) out += "#".repeat(Math.min(+t[1], 4)) + " " + inline(ch).trim() + "\n\n";
        else if (t === "p" || t === "div" || t === "section" || t === "article") {
          const kids = ch.querySelector("p,ul,ol,table,h1,h2,h3,h4,pre,blockquote,div");
          if (kids && t !== "p") out += block(ch, depth);
          else { const s = inline(ch).trim(); if (s) out += s + "\n\n"; }
        }
        else if (t === "ul" || t === "ol") {
          [...ch.children].forEach((li, i) => {
            if (li.tagName.toLowerCase() !== "li") return;
            const mark = t === "ol" ? `${i + 1}. ` : "- ";
            const sub = li.querySelector("ul,ol");
            const own = inline(li).trim();
            out += "  ".repeat(depth) + mark + own + "\n";
            if (sub) out += block(li, depth + 1).replace(/^(?!\s*$)/gm, "");
          });
          if (!depth) out += "\n";
        }
        else if (t === "table") {
          const rows = [...ch.querySelectorAll("tr")].map(tr =>
            [...tr.children].map(td => cell(inline(td))));
          if (rows.length) {
            out += "| " + rows[0].join(" | ") + " |\n";
            out += "| " + rows[0].map(() => "---").join(" | ") + " |\n";
            rows.slice(1).forEach(r => { out += "| " + r.join(" | ") + " |\n"; });
            out += "\n";
          }
        }
        else if (t === "pre") out += "```\n" + ch.textContent.replace(/\n$/, "") + "\n```\n\n";
        else if (t === "blockquote") out += block(ch, depth).trim().replace(/^/gm, "> ") + "\n\n";
        else if (t === "img") {
          const key = ch.getAttribute("data-df-key");
          const alt = (ch.getAttribute("alt") || "").replace(/[|\[\]]/g, " ").replace(/\s+/g, " ").trim();
          if (key) out += `[screenshot: ${alt || "Imported image"} | img:${key}]\n\n`;
          else if (alt) out += `[screenshot: ${alt}]\n\n`;
        }
        else out += block(ch, depth);
      });
      return out;
    }
    return block(doc.body).replace(/\n{3,}/g, "\n\n").replace(/[ \t]+$/gm, "").trim();
  }

  /* ---------------- structure linter ----------------
     Gentle warnings for the shapes that break exports; never blocks anything. */
  function lintSource(src) {
    const warns = [];
    const lines = src.split("\n");
    let fence = null, coDepth = 0, coLine = 0;
    lines.forEach((line, i) => {
      const n = i + 1;
      const fm = line.match(/^(```+|~~~+)/);
      if (fence) { if (fm && fm[1][0] === fence[0] && fm[1].length >= fence.length) fence = null; return; }
      if (fm) { fence = fm[1]; return; }
      if (/^:::(note|tip|warning|important|center|right|left|justify)\b/i.test(line)) { coDepth++; coLine = n; }
      else if (/^:::\s*$/.test(line)) coDepth = Math.max(0, coDepth - 1);
      if (/^#{5,}\s/.test(line)) warns.push([n, "Heading level 5+ — styled plainly and never listed in the contents. Consider #### or bold text."]);
      if (/^\s*<(?!\/?(b|i|em|strong|code|br)\b)[a-z][^>]*>/i.test(line)) warns.push([n, "Raw HTML — it will be ignored or printed as text. Use the toolbar marks instead."]);
      const t = line.match(/^\s*\|(.+)\|\s*$/);
      if (t && i && /^\s*\|.+\|\s*$/.test(lines[i - 1] || "")) {
        const cols = r => (r.match(/(?<!\\)\|/g) || []).length;
        if (cols(line) !== cols(lines[i - 1])) warns.push([n, "Table row has a different number of cells than the row above — the table will come out ragged."]);
      }
    });
    if (fence) warns.push([lines.length, "Unclosed code fence ``` — everything after it is being treated as code."]);
    if (coDepth > 0) warns.push([coLine, "Unclosed callout ::: — it swallows the rest of the document."]);
    // Undefined footnotes / citations / cross-references
    const defs = new Set(), cites = new Set(), ids = new Set();
    src.replace(/^\[\^([^\]\s]+)\]:/gm, (m, id) => defs.add(id));
    src.replace(/^\[@([^\]\s,]+)\]:/gm, (m, id) => cites.add(id));
    src.replace(/\{#([\w:.-]+)\}/g, (m, id) => ids.add(id));
    src.replace(/#([A-Za-z][\w:.-]*)/g, (m, id) => ids.add(id)); // figure/table ids declared inline
    lines.forEach((line, i) => {
      if (/^(```|~~~)/.test(line)) return;
      line.replace(/\[\^([^\]\s]+)\](?!:)/g, (m, id) => { if (!defs.has(id)) warns.push([i + 1, `Footnote [^${id}] has no definition line ([^${id}]: …).`]); });
      line.replace(/\[@([^\]\s,]+)(?:,[^\]]*)?\](?!:)/g, (m, id) => { if (!cites.has(id)) warns.push([i + 1, `Citation [@${id}] has no entry ([@${id}]: …).`]); });
    });
    return warns;
  }
  function refreshLint() {
    const warns = lintSource(state.source);
    const badge = $("#lintBadge"), panel = $("#lintPanel");
    badge.hidden = !warns.length;
    badge.textContent = warns.length === 1 ? "1 check" : warns.length + " checks";
    if (!warns.length) { panel.hidden = true; return; }
    panel.innerHTML = warns.slice(0, 40).map(([line, msg]) =>
      `<button class="lint-item" data-line="${line}"><span class="ln">line ${line}</span>${Engine.esc(msg)}</button>`).join("");
    panel.querySelectorAll(".lint-item").forEach(b => b.onclick = () => {
      const ln = +b.dataset.line;
      const pos = state.source.split("\n").slice(0, ln - 1).join("\n").length + (ln > 1 ? 1 : 0);
      editor.focus();
      editor.setSelectionRange(pos, pos);
      const lineHeight = 21;
      editor.scrollTop = Math.max(0, (ln - 6) * lineHeight);
    });
  }

  /* ---------------- chrome theme ----------------
     The chrome ships dark; this offers a light variant. App surfaces only — the
     document pages stay paper-white in either. */
  const UI_KEY = "docforge.ui";
  function applyUiTheme(light) {
    document.documentElement.toggleAttribute("data-light", !!light);
    safeLS.set(UI_KEY, light ? "light" : "dark");
    /* Paint workaround, not a mechanics change: Chromium sometimes leaves the
       composited chrome bars (promoted by z-index + shadow) rendered with the
       previous theme's custom-property values after the attribute flip — the
       background survives as a stale solid-colour quad that even a resize
       won't re-raster. Briefly toggling layer promotion forces a fresh raster
       with the new values; visually a no-op. */
    const els = [document.body, ...document.querySelectorAll("#topbar,#toolbar,#findBar,#settings,#editorPane,#embedHint,#peBar")];
    for (const el of els) el.style.transform = "translateZ(0)";
    requestAnimationFrame(() => requestAnimationFrame(() => { for (const el of els) el.style.transform = ""; }));
  }

  function bindChrome() {
    $("#btnSettings").onclick = () => $("#settings").classList.toggle("open");
    $("#btnHelp").onclick = () => $("#helpOverlay").classList.add("open");
    $$("[data-close]").forEach(b => b.onclick = () => b.closest(".overlay").classList.remove("open"));
    $("#btnSaveProj").onclick = saveProject;
    $("#btnOpen").onclick = () => $("#projInput").click();
    $("#btnNew").onclick = async () => { if (await confirmModal("Start a new document?", "The editor will be replaced with a blank document. Your current work stays in autosave until you type again — use Save first if you want a backup file.")) applyTemplate("blank"); };
    $("#btnPdf").onclick = exportPdf;
    $("#btnDocx").onclick = exportDocx;
    /* Templates: a designed menu, not a native select in a trenchcoat. */
    const tplMenu = $("#tplMenu");
    const tplBtn = $("#templateSelect");
    const closeTpl = () => { tplMenu.style.display = "none"; tplBtn.setAttribute("aria-expanded", "false"); };
    tplBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (tplMenu.style.display === "block") return closeTpl();
      const r = tplBtn.getBoundingClientRect();
      tplMenu.style.display = "block";
      tplMenu.style.left = Math.min(r.left, innerWidth - tplMenu.offsetWidth - 8) + "px";
      tplMenu.style.top = (r.bottom + 6) + "px";
      tplBtn.setAttribute("aria-expanded", "true");
    });
    tplMenu.addEventListener("click", async e => {
      const item = e.target.closest(".tpl-item");
      if (!item) return;
      closeTpl();
      const id = item.dataset.id;
      if (await confirmModal("Load template?", "“" + TEMPLATES[id].label + "” will replace the current document. Use Save first if you want a backup file.")) applyTemplate(id);
    });
    document.addEventListener("click", e => {
      if (!e.target.closest("#tplMenu") && !e.target.closest("#templateSelect")) closeTpl();
    });

    /* the masthead title opens the document's own settings */
    $("#docTitle").onclick = () => {
      $("#settings").classList.add("open");
      $("#sTitle").focus();
      $("#sTitle").select();
    };
    $$("#toolbar .tb[data-act]").forEach(b => b.addEventListener("click", () => TOOL_ACTS[b.dataset.act]?.()));
    $("#zoomIn").onclick = () => { zoomMode = "man"; zoomVal = Math.min(2, (zoomVal || 1) + 0.1); applyZoom(); };
    $("#zoomOut").onclick = () => { zoomMode = "man"; zoomVal = Math.max(0.25, (zoomVal || 1) - 0.1); applyZoom(); };
    $("#zoomFit").onclick = () => { zoomMode = "fit"; applyZoom(); };

    editor.addEventListener("input", () => { state.source = editor.value; markDirty(); scheduleRender(); });

    /* outline */
    $("#btnOutline").onclick = () => {
      outlineOpen = !outlineOpen;
      $("#outlinePanel").hidden = !outlineOpen;
      $("#btnOutline").classList.toggle("on", outlineOpen);
      refreshOutline();
    };

    /* find & replace */
    $("#findClose").onclick = () => findBar(false);
    $("#findNext").onclick = () => { findStep(false); };
    $("#findPrev").onclick = () => { findStep(true); };
    $("#replOne").onclick = replaceOne;
    $("#replAll").onclick = replaceAll;
    $("#findInput").addEventListener("input", findCount);
    $("#findInput").addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); findStep(e.shiftKey); }
      if (e.key === "Escape") findBar(false);
    });
    $("#replInput").addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); replaceOne(); }
      if (e.key === "Escape") findBar(false);
    });

    /* structure linter */
    $("#lintBadge").onclick = () => { $("#lintPanel").hidden = !$("#lintPanel").hidden; };

    /* dark chrome */
    $("#btnDark").onclick = () => applyUiTheme(!document.documentElement.hasAttribute("data-light"));

    /* paste cleanup */
    editor.addEventListener("paste", e => {
      const html = e.clipboardData && e.clipboardData.getData("text/html");
      if (!html || !/<(h[1-6]|p|li|table|b|strong|em|i|a)\b/i.test(html)) return; // plain text pastes untouched
      const md = htmlToMd(html);
      if (!md) return;
      e.preventDefault();
      editor.setRangeText(md, editor.selectionStart, editor.selectionEnd, "end");
      state.source = editor.value; markDirty(); scheduleRender();
      toast("Pasted as Markdown — Ctrl+Z restores the raw text");
    });
    editor.addEventListener("keydown", e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); TOOL_ACTS.bold(); }
      if (mod && e.key.toLowerCase() === "i") { e.preventDefault(); TOOL_ACTS.italic(); }
      if (mod && e.key.toLowerCase() === "u") { e.preventDefault(); TOOL_ACTS.underline(); }
      if (e.key === "Tab") { e.preventDefault(); replaceRange(editor.selectionStart, editor.selectionEnd, "  "); }
    });
    document.addEventListener("keydown", e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveProject(); }
      if (mod && e.key.toLowerCase() === "p") { e.preventDefault(); exportPdf(); }
      if (mod && e.key.toLowerCase() === "f") { e.preventDefault(); findBar(true); }
      if (mod && e.key.toLowerCase() === "h") { e.preventDefault(); findBar(true); $("#replInput").focus(); }
      if (mod && e.key === "/") { e.preventDefault(); $("#keysOverlay").classList.toggle("open"); }
      if (e.key === "Escape") $$(".overlay.open").forEach(o => o.classList.remove("open"));
    });
    window.addEventListener("resize", () => { if (zoomMode === "fit") applyZoom(); });

    /* Ctrl+wheel zooms the preview; clicking the percentage snaps back to fit */
    $("#previewScroll").addEventListener("wheel", e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomMode = "man";
      zoomVal = Math.min(2, Math.max(0.25, (zoomVal || 1) + (e.deltaY < 0 ? 0.1 : -0.1)));
      applyZoom();
    }, { passive: false });
    $("#zoomPct").style.cursor = "pointer";
    $("#zoomPct").title = "Reset to fit";
    $("#zoomPct").onclick = () => { zoomMode = "fit"; applyZoom(); };

    /* Drop an image file anywhere on the editor to insert it as a figure;
       a document file (.docx / .pdf / .md / project) routes through import. */
    editor.addEventListener("dragover", e => { e.preventDefault(); });
    editor.addEventListener("drop", async e => {
      const docFile = [...(e.dataTransfer?.files || [])].find(f => /\.(docx|doc|pdf|md|markdown|txt|json)$/i.test(f.name));
      if (docFile) { e.preventDefault(); importFile(docFile); return; }
      const file = [...(e.dataTransfer?.files || [])].find(f => /^image\//.test(f.type));
      if (!file) return; // let plain text drops behave natively
      e.preventDefault();
      try {
        const att = await processImageFile(file);
        const key = newKey();
        state.attachments[key] = att;
        const cap = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
        insertBlock(`[screenshot: ${cap} | img:${key}]`);
        toast("Image added as a figure");
      } catch { toast("Could not read that image", "warn"); }
    });
    window.addEventListener("beforeprint", () => {
      preprintZoom = scaleWrap.style.zoom; scaleWrap.style.zoom = ""; scaleWrap.style.transform = "";
      // Chrome names the saved PDF after the page title, so offer the document's own name.
      appTitle = document.title;
      document.title = safeName();
    });
    window.addEventListener("afterprint", () => {
      if (appTitle) { document.title = appTitle; appTitle = null; }
      if (preprintZoom != null) scaleWrap.style.zoom = preprintZoom; applyZoom();
    });
  }

  function boot() {
    // populate the templates menu (labels + one-line descriptions from TEMPLATES)
    $("#tplMenu").innerHTML = Object.entries(TEMPLATES).map(([id, t]) =>
      `<button class="tpl-item" role="menuitem" data-id="${id}"><b>${Engine.esc(t.label)}</b><span>${Engine.esc(t.desc || "")}</span></button>`
    ).join("");
    buildFontSelects();
    bindChrome(); bindSettings(); bindImageInput(); bindShotClicks(); bindProjectInput(); bindColorMenus(); bindPdfEditor();

    const saved = safeLS.get(LS_KEY);
    let restored = false;
    if (saved) {
      try {
        const d = JSON.parse(saved);
        state.settings = normalizeSettings(d.settings);
        state.source = d.source || "";
        state.attachments = d.attachments || {};
        state.accentTouched = !!d.accentTouched;
        restored = true;
      } catch {}
    }
    if (!restored) {
      state.settings = { ...DEFAULTS, ...TEMPLATES.welcome.patch };
      state.source = TEMPLATES.welcome.source;
    }
    editor.value = state.source;
    applyUiTheme(safeLS.get(UI_KEY) === "light");
    syncSettingsUI(); updateCounts(); refreshLint();
    if (window.self !== window.top) $("#embedHint").classList.add("on");
    doRender();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
