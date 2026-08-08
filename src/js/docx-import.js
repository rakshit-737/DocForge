/* ============================================================
   docx-import.js — turn an uploaded .docx into clean HTML

   mammoth.js does the heavy lifting, but its defaults drop underline,
   strikethrough and highlight, and it renders Word's Title/Quote/Caption
   styles as anonymous paragraphs. The style map below keeps those and maps
   them onto structures the HTML→Markdown converter already understands.

   The browser bundle is embedded as a string on window.__MAMMOTH_SRC__ and
   eval'd on first use, so a user who never imports Word files never pays
   for parsing ~1 MB of library at startup.
   ============================================================ */
"use strict";

const DocxImport = (() => {

  function lib() {
    if (window.mammoth) return window.mammoth;
    if (window.__MAMMOTH_SRC__) {
      // Indirect eval runs in global scope, so the UMD bundle lands on window.
      (0, eval)(window.__MAMMOTH_SRC__);
      window.__MAMMOTH_SRC__ = null; // the string is dead weight once eval'd
      return window.mammoth;
    }
    throw new Error("Word import is not bundled in this build");
  }

  const STYLE_MAP = [
    "u => u",
    "strike => s",
    "highlight => mark",
    "p[style-name='Title'] => h1:fresh",
    "p[style-name='Subtitle'] => p.subtitle:fresh",
    "p[style-name='Quote'] => blockquote:fresh",
    "p[style-name='Intense Quote'] => blockquote:fresh",
    "p[style-name='Caption'] => p.caption:fresh",
    "r[style-name='Intense Emphasis'] => em",
    "r[style-name='Book Title'] => em",
    "r[style-name='Subtle Emphasis'] => em",
  ];

  const solid = s => s.replace(/\s+/g, "").length;

  function cleanup(html) {
    const body = new DOMParser().parseFromString(html, "text/html").body;

    // Stale Word TOC lines: almost all of the text sits in links-to-anchors
    // and the line ends with a page number. Must run before the anchors are
    // unwrapped below, or nothing distinguishes them from ordinary prose.
    // DocForge regenerates its own [toc], so these only cause clutter.
    for (const p of [...body.querySelectorAll("p")]) {
      const text = p.textContent;
      const total = solid(text);
      if (!total || !/\d\s*$/.test(text)) continue;
      let anchored = 0;
      for (const a of p.querySelectorAll('a[href^="#"]')) anchored += solid(a.textContent);
      if (anchored >= total * 0.8) p.remove();
    }

    // Internal anchors (bookmarks, cross-references) point nowhere once the
    // document leaves Word — keep the text, lose the link.
    for (const a of [...body.querySelectorAll("a")]) {
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) a.replaceWith(...a.childNodes);
    }

    for (const p of [...body.querySelectorAll("p")]) {
      if (!p.textContent.trim() && !p.querySelector("img")) p.remove();
    }

    return body.innerHTML;
  }

  /* Keep the messages worth showing: mammoth emits one "unrecognised style"
     warning per exotic style, which drowns out anything actionable. */
  function tidyMessages(messages) {
    let list = messages.map(m => m.message || String(m));
    if (list.length >= 3) list = list.filter(m => !/unrecognised\b.*\bstyle/i.test(m));
    return [...new Set(list)].slice(0, 8);
  }

  /**
   * @param arrayBuffer  the raw bytes of a .docx file
   * @returns {Promise<{html: string, messages: string[]}>}
   */
  async function toHtml(arrayBuffer) {
    const mammoth = lib();
    // images.inline is the pre-1.4 name for imgElement; tolerate either.
    const imgEl = mammoth.images && (mammoth.images.imgElement || mammoth.images.inline);

    let result;
    try {
      result = await mammoth.convertToHtml({ arrayBuffer }, {
        styleMap: STYLE_MAP,
        ignoreEmptyParagraphs: true,
        convertImage: imgEl && imgEl(img =>
          img.read("base64").then(b64 => ({
            src: "data:" + img.contentType + ";base64," + b64,
            alt: img.altText || "",
          }))),
      });
    } catch (err) {
      throw new Error(
        "Could not read that Word file — if it is an old binary .doc, save it as .docx first.",
        { cause: err });
    }

    return { html: cleanup(result.value), messages: tidyMessages(result.messages || []) };
  }

  return { toHtml };
})();
