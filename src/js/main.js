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
  };

  const TEMPLATES = {
    welcome: {
      label: "Quick tour (start here)",
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
      patch: { theme: "minimal", accent: "#111827", cover: false, header: false, pageNums: false, numbered: false, h1break: false, title: "Letter", subtitle: "" },
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
  let preprintZoom = null;

  const editor = $("#editor");
  const scaleWrap = $("#scaleWrap");
  const DOC_CSS = window.__DOC_CSS__ || "";

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
  function markDirty() {
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
  }
  function updateCounts() {
    const w = (state.source.trim().match(/\S+/g) || []).length;
    $("#wordCount").textContent = w + (w === 1 ? " word" : " words");
  }

  /* ---------------- settings UI ---------------- */
  const FIELDS = { sTitle: "title", sSubtitle: "subtitle", sAuthor: "author", sKicker: "kicker", sMetaExtra: "metaExtra", sDate: "date" };
  const SELECTS = { sTheme: "theme", sPage: "page", sMargins: "margins" };
  const TOGGLES = { tCover: "cover", tHeader: "header", tPageNums: "pageNums", tNumbered: "numbered", tJustify: "justify", tH1break: "h1break" };

  function syncSettingsUI() {
    for (const [id, k] of Object.entries(FIELDS)) $("#" + id).value = state.settings[k] || "";
    for (const [id, k] of Object.entries(SELECTS)) $("#" + id).value = state.settings[k];
    for (const [id, k] of Object.entries(TOGGLES)) $("#" + id).checked = !!state.settings[k];
    $("#cAccent").value = state.settings.accent;
    $$(".sw").forEach(sw => sw.classList.toggle("on", sw.dataset.c === state.settings.accent));
  }

  function bindSettings() {
    for (const [id, k] of Object.entries(FIELDS)) $("#" + id).addEventListener("input", e => {
      state.settings[k] = e.target.value; markDirty(); scheduleRender();
    });
    for (const [id, k] of Object.entries(SELECTS)) $("#" + id).addEventListener("change", e => {
      state.settings[k] = e.target.value;
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

  const TOOL_ACTS = {
    bold: () => surround("**", "**", "bold text"),
    italic: () => surround("*", "*", "italic text"),
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

  /* ---------------- project save / open ---------------- */
  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 600);
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
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const d = JSON.parse(fr.result);
          if (d.app !== "docforge") throw new Error("not a DocForge file");
          state.settings = { ...DEFAULTS, ...d.settings };
          state.source = d.source || "";
          state.attachments = d.attachments || {};
          state.accentTouched = true;
          editor.value = state.source;
          syncSettingsUI(); markDirty(); doRender();
          toast("Project opened");
        } catch { toast("That doesn't look like a DocForge project file", "warn"); }
      };
      fr.readAsText(f);
    });
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

  /* ---------------- exports ---------------- */
  async function exportPdf() {
    await ensureFresh();
    toast("Choose “Save as PDF” in the print dialog");
    setTimeout(() => { try { window.print(); } catch { toast("Printing is blocked here — open this file directly in Chrome/Edge", "warn"); } }, 350);
  }
  async function exportDocx() {
    await ensureFresh();
    if (!lastContentEl) return;
    const btn = $("#btnDocx");
    btn.disabled = true;
    try {
      const blob = await DocxExport.build(lastContentEl, state.settings, state.attachments);
      downloadBlob(blob, safeName() + ".docx");
      toast("Word file downloaded — click “Yes” if Word asks to update fields");
    } catch (e) {
      console.error("[DocForge] docx failed", e);
      toast("Word export failed — check the console", "warn");
    }
    btn.disabled = false;
  }

  /* ---------------- boot ---------------- */
  function bindChrome() {
    $("#btnSettings").onclick = () => $("#settings").classList.toggle("open");
    $("#btnHelp").onclick = () => $("#helpOverlay").classList.add("open");
    $$("[data-close]").forEach(b => b.onclick = () => b.closest(".overlay").classList.remove("open"));
    $("#btnSaveProj").onclick = saveProject;
    $("#btnOpen").onclick = () => $("#projInput").click();
    $("#btnNew").onclick = async () => { if (await confirmModal("Start a new document?", "The editor will be replaced with a blank document. Your current work stays in autosave until you type again — use Save first if you want a backup file.")) applyTemplate("blank"); };
    $("#btnPdf").onclick = exportPdf;
    $("#btnDocx").onclick = exportDocx;
    $("#templateSelect").addEventListener("change", async e => {
      const id = e.target.value;
      e.target.value = "";
      if (!id) return;
      if (await confirmModal("Load template?", "“" + TEMPLATES[id].label + "” will replace the current document. Use Save first if you want a backup file.")) applyTemplate(id);
    });
    $$("#toolbar .tb[data-act]").forEach(b => b.addEventListener("click", () => TOOL_ACTS[b.dataset.act]?.()));
    $("#zoomIn").onclick = () => { zoomMode = "man"; zoomVal = Math.min(2, (zoomVal || 1) + 0.1); applyZoom(); };
    $("#zoomOut").onclick = () => { zoomMode = "man"; zoomVal = Math.max(0.25, (zoomVal || 1) - 0.1); applyZoom(); };
    $("#zoomFit").onclick = () => { zoomMode = "fit"; applyZoom(); };

    editor.addEventListener("input", () => { state.source = editor.value; markDirty(); scheduleRender(); });
    editor.addEventListener("keydown", e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); TOOL_ACTS.bold(); }
      if (mod && e.key.toLowerCase() === "i") { e.preventDefault(); TOOL_ACTS.italic(); }
      if (e.key === "Tab") { e.preventDefault(); replaceRange(editor.selectionStart, editor.selectionEnd, "  "); }
    });
    document.addEventListener("keydown", e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveProject(); }
      if (mod && e.key.toLowerCase() === "p") { e.preventDefault(); exportPdf(); }
    });
    window.addEventListener("resize", () => { if (zoomMode === "fit") applyZoom(); });
    window.addEventListener("beforeprint", () => { preprintZoom = scaleWrap.style.zoom; scaleWrap.style.zoom = ""; scaleWrap.style.transform = ""; });
    window.addEventListener("afterprint", () => { if (preprintZoom != null) scaleWrap.style.zoom = preprintZoom; applyZoom(); });
  }

  function boot() {
    // populate template select
    const sel = $("#templateSelect");
    for (const [id, t] of Object.entries(TEMPLATES)) {
      const o = document.createElement("option");
      o.value = id; o.textContent = t.label;
      sel.appendChild(o);
    }
    bindChrome(); bindSettings(); bindImageInput(); bindShotClicks(); bindProjectInput();

    const saved = safeLS.get(LS_KEY);
    let restored = false;
    if (saved) {
      try {
        const d = JSON.parse(saved);
        state.settings = { ...DEFAULTS, ...d.settings };
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
    syncSettingsUI(); updateCounts();
    if (window.self !== window.top) $("#embedHint").classList.add("on");
    doRender();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
