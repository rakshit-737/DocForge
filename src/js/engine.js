/* ============================================================
   engine.js — markdown → document DOM pipeline
   ============================================================ */
"use strict";

const Engine = (() => {

  marked.use({ gfm: true, breaks: true });

  const esc = s => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const cssStr = s => String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const slugify = t => (t.toLowerCase().replace(/[^\w\s-]/g, "").trim()
    .replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60)) || "sec";

  /* ---------- color math ---------- */
  function hexRgb(hex) {
    const m = hex.replace("#", "");
    const v = m.length === 3 ? m.split("").map(c => c + c).join("") : m;
    return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) || 0);
  }
  const rgbHex = (r, g, b) => "#" + [r, g, b].map(v =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  function mix(hex, other, k) { // k = amount of `other`
    const a = hexRgb(hex), b = hexRgb(other);
    return rgbHex(...a.map((v, i) => v + (b[i] - v) * k));
  }
  function tints(accent) {
    return {
      a50:  mix(accent, "#ffffff", 0.955),
      a75:  mix(accent, "#ffffff", 0.93),
      a100: mix(accent, "#ffffff", 0.88),
      a200: mix(accent, "#ffffff", 0.74),
      a300: mix(accent, "#ffffff", 0.55),
      a400: mix(accent, "#ffffff", 0.32),
      a500: accent,
      a600: mix(accent, "#000000", 0.12),
      a700: mix(accent, "#000000", 0.26),
      a800: mix(accent, "#000000", 0.4),
      a900: mix(accent, "#000000", 0.55),
    };
  }

  /* ---------- page geometry ---------- */
  const PAGES = {
    A4:     { w: 210,   h: 297,   label: "A4" },
    Letter: { w: 215.9, h: 279.4, label: "Letter" },
  };
  const MARGINS = {
    normal: { t: 22, r: 20, b: 24, l: 20 },
    narrow: { t: 15, r: 14, b: 18, l: 14 },
    wide:   { t: 28, r: 26, b: 30, l: 26 },
  };
  const FONTS = {
    modern:    { head: `"Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif`,
                 body: `"Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif` },
    executive: { head: `Georgia, "Times New Roman", serif`,
                 body: `"Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif` },
    academic:  { head: `Cambria, Georgia, "Times New Roman", serif`,
                 body: `Cambria, Georgia, "Times New Roman", serif` },
    minimal:   { head: `"Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif`,
                 body: `"Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif` },
  };

  const CAMERA_SVG = `<svg class="shot-ic" viewBox="0 0 24 24" fill="none" stroke="var(--a500)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.2-1.8A1.5 1.5 0 0 1 9.55 3.5h4.9a1.5 1.5 0 0 1 1.25.7L16.9 6h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.6"/></svg>`;

  /* ---------- token regexes (line-based) ---------- */
  const RE_SHOT = /^\[screenshot(?::\s*([^\]|]*?))?(?:\s*\|\s*img:([A-Za-z0-9_-]+))?\]\s*$/i;
  const RE_TOC = /^\[toc\]\s*$/i;
  const RE_BREAK = /^\[pagebreak\]\s*$/i;
  const RE_CO_OPEN = /^:::(note|tip|warning|important)(?:\s+(.*))?$/i;
  const RE_CO_CLOSE = /^:::\s*$/;
  const CO_LABELS = { note: "Note", tip: "Tip", warning: "Warning", important: "Important" };

  /* Pre-process custom tokens outside code fences. */
  function preprocess(src) {
    const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fm = line.match(/^(```+|~~~+)/);
      if (fence) { out.push(line); if (fm && fm[1][0] === fence[0] && fm[1].length >= fence.length) fence = null; continue; }
      if (fm) { fence = fm[1]; out.push(line); continue; }

      if (RE_TOC.test(line)) { out.push("", `<div data-toc="1"></div>`, ""); continue; }
      if (RE_BREAK.test(line)) { out.push("", `<div class="page-break"></div>`, ""); continue; }
      const sm = line.match(RE_SHOT);
      if (sm) {
        out.push("", `<figure class="shot" data-caption="${esc(sm[1] || "")}" data-key="${esc(sm[2] || "")}"></figure>`, "");
        continue;
      }
      const cm = line.match(RE_CO_OPEN);
      if (cm) {
        const type = cm[1].toLowerCase();
        const title = (cm[2] || "").trim() || CO_LABELS[type];
        const inner = [];
        let j = i + 1, innerFence = null;
        for (; j < lines.length; j++) {
          const l2 = lines[j];
          const f2 = l2.match(/^(```+|~~~+)/);
          if (innerFence) { if (f2 && f2[1][0] === innerFence[0] && f2[1].length >= innerFence.length) innerFence = null; }
          else if (f2) innerFence = f2[1];
          else if (RE_CO_CLOSE.test(l2)) break;
          inner.push(l2);
        }
        i = j; // skip past close (or EOF)
        const innerHtml = marked.parse(preprocess(inner.join("\n"))).replace(/\n/g, " ");
        out.push("", `<div class="callout ${type}"><div class="co-title">${esc(title)}</div><div class="co-body">${innerHtml}</div></div>`, "");
        continue;
      }
      out.push(line);
    }
    return out.join("\n");
  }

  /* ---------- post-processing of rendered DOM ---------- */
  function postprocess(root, settings, attachments) {
    // 1. heading ids
    const seen = {};
    const heads = [...root.querySelectorAll("h1,h2,h3,h4")];
    heads.forEach(h => {
      let id = slugify(h.textContent);
      if (seen[id] != null) id = id + "-" + (++seen[id]); else seen[id] = 0;
      h.id = id;
    });

    // 2. heading numbering
    if (settings.numbered) {
      const c = [0, 0, 0];
      heads.forEach(h => {
        const lvl = +h.tagName[1];
        if (lvl > 3) return;
        c[lvl - 1]++; for (let k = lvl; k < 3; k++) c[k] = 0;
        const num = c.slice(0, lvl).join(".");
        const sp = document.createElement("span");
        sp.className = "hnum";
        sp.textContent = num;
        h.prepend(sp, " ");
        h.dataset.num = num;
      });
    }

    // 3. images typed in markdown → figures
    root.querySelectorAll("p > img:only-child").forEach(img => {
      const p = img.parentElement;
      if (p.childNodes.length !== 1) return;
      const fig = document.createElement("figure");
      fig.className = "img";
      p.replaceWith(fig);
      fig.appendChild(img);
      if (img.alt) fig.dataset.caption = img.alt;
    });

    // 4. figure numbering + screenshot placeholder content
    let fig = 0, shotIdx = 0;
    root.querySelectorAll("figure").forEach(f => {
      const isShot = f.classList.contains("shot");
      const cap = f.dataset.caption || "";
      if (isShot) {
        f.dataset.idx = shotIdx++;
        const key = f.dataset.key;
        const att = key && attachments[key];
        f.innerHTML = "";
        if (att) {
          const img = document.createElement("img");
          img.src = att.dataUrl;
          if (att.w && att.h) {
            img.width = att.w; img.height = att.h;
            img.style.aspectRatio = `${att.w}/${att.h}`;
            img.style.width = Math.min(100, (att.w / 1500) * 100 + 42) + "%";
          }
          f.appendChild(img);
        } else {
          const box = document.createElement("div");
          box.className = "shot-box";
          box.innerHTML = `${CAMERA_SVG}<div class="shot-t">Screenshot placeholder</div>` +
            (cap ? `<div class="shot-c">${esc(cap)}</div>` : "");
          f.appendChild(box);
          const hint = document.createElement("div");
          hint.className = "shot-hint";
          hint.textContent = "click to attach image";
          f.appendChild(hint);
        }
      }
      if (isShot || f.dataset.caption) {
        fig++;
        const fc = document.createElement("figcaption");
        fc.innerHTML = `<span class="fig-label">Figure ${fig}</span>${cap ? " — " + esc(cap) : ""}`;
        f.appendChild(fc);
        f.dataset.fig = fig;
      }
    });

    // 5. TOC
    const tocMarker = root.querySelector("div[data-toc]");
    if (tocMarker) {
      const wrap = document.createElement("div");
      wrap.className = "toc-wrap";
      const entries = heads.filter(h => +h.tagName[1] <= 3 && !wrap.contains(h));
      let html = `<div class="toc-title">Contents</div><nav class="toc">`;
      entries.forEach(h => {
        const lvl = +h.tagName[1];
        const num = h.dataset.num ? `<span class="hnum">${h.dataset.num}</span>` : "";
        const txt = esc(h.textContent.replace(/^[\d.]+\s*/, settings.numbered ? "" : "$&").trim());
        html += `<a class="l${lvl}" href="#${h.id}"><span class="t">${num}${txt}</span><span class="dots"></span></a>`;
      });
      html += `</nav>`;
      wrap.innerHTML = html;
      tocMarker.replaceWith(wrap);
    }
    return { figures: fig, headings: heads.length };
  }

  /* ---------- cover ---------- */
  function coverHtml(s) {
    const dateStr = fmtDate(s.date);
    const meta = [
      s.author ? `<div class="m-strong">${esc(s.author)}</div>` : "",
      s.metaExtra ? `<div>${esc(s.metaExtra)}</div>` : "",
      dateStr ? `<div class="m-dim">${esc(dateStr)}</div>` : "",
    ].join("");
    return `<section class="cover">` +
      (s.kicker ? `<div class="cv-kicker">${esc(s.kicker)}</div>` : "") +
      `<h1 class="cv-title">${esc(s.title || "Untitled document")}</h1>` +
      (s.subtitle ? `<div class="cv-sub">${esc(s.subtitle)}</div>` : "") +
      `<div class="cv-spacer"></div><div class="cv-rule"></div>` +
      `<div class="cv-meta">${meta}</div></section>`;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso + "T12:00:00");
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    } catch { return iso; }
  }

  /* ---------- main render ---------- */
  function render(source, settings, attachments) {
    const body = marked.parse(preprocess(source));
    const doc = document.createElement("div");
    doc.className = "doc" +
      (settings.justify ? " justify" : "") +
      (settings.h1break ? " h1break" : "");
    doc.dataset.theme = settings.theme;
    if (settings.cover) doc.insertAdjacentHTML("beforeend", coverHtml(settings));
    const content = document.createElement("div");
    content.className = "content";
    content.innerHTML = body;
    doc.appendChild(content);
    const meta = postprocess(content, settings, attachments);
    return { doc, meta };
  }

  /* ---------- dynamic CSS (@page + vars) ---------- */
  function dynamicCss(settings) {
    const t = tints(settings.accent);
    const f = FONTS[settings.theme] || FONTS.modern;
    const pg = PAGES[settings.page] || PAGES.A4;
    const m = MARGINS[settings.margins] || MARGINS.normal;
    const title = cssStr(settings.title || "");

    let css = `
.doc{--a50:${t.a50};--a75:${t.a75};--a100:${t.a100};--a200:${t.a200};--a300:${t.a300};--a400:${t.a400};--a500:${t.a500};--a600:${t.a600};--a700:${t.a700};--a800:${t.a800};--a900:${t.a900};--font-head:${f.head};--font-body:${f.body};--page-w:${pg.w}mm;--page-h:${pg.h}mm;}
@page {
  size: ${pg.label};
  margin: ${m.t}mm ${m.r}mm ${m.b}mm ${m.l}mm;`;
    if (settings.header) {
      css += `
  @top-left { content: "${title}"; font-family:${f.head}; font-size:7.6pt; letter-spacing:0.13em; text-transform:uppercase; color:#828a99; margin-bottom:9mm; }
  @top-right { content: string(sect); font-family:${f.body}; font-size:7.6pt; color:#828a99; margin-bottom:9mm; max-width:60mm; overflow:hidden; }`;
    }
    if (settings.pageNums) {
      css += `
  @bottom-center { content: "Page " counter(page) " of " counter(pages); font-family:${f.body}; font-size:8.2pt; color:#71798a; margin-top:9mm; }`;
    }
    css += `
}
@page cover { margin: 0;
  @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; }
}
.doc .content h1 { string-set: sect content(text); }
`;
    return css;
  }

  return { render, dynamicCss, tints, PAGES, MARGINS, FONTS, fmtDate, esc, RE_SHOT };
})();
