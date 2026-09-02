/* ============================================================
   sanitize.ts — markdown → DOM sanitization boundary.
   Routes raw HTML strings through DOMPurify with an explicit
   allowlist for DocForge dialect data-attributes (data-tex,
   data-hl, .dfspan attributes, source mapping data-ss/se) while
   strictly preventing script injection, event handlers and
   dangerous protocols.
   ============================================================ */

export const SANITIZE_CONFIG: DOMPurifyConfig = {
  ALLOW_DATA_ATTR: true,
  ADD_TAGS: ["mark", "figure", "figcaption", "section", "nav"],
  ADD_ATTR: [
    // KaTeX & Word equation preservation (ledger §3.4, issue 11)
    "data-tex",
    // Highlight marks
    "data-hl",
    // Word-ribbon dialect span attributes
    "data-color",
    "data-bg",
    "data-size",
    "data-font",
    "data-u",
    "data-sc",
    "data-caps",
    // Tables & figures
    "data-tbl",
    "data-tid",
    "data-fig",
    "data-tablecap",
    "data-caption",
    "data-req-w",
    "data-idx",
    "data-w",
    "data-explicit-id",
    "data-split-from",
    "data-repeated-header",
    // Citations & footnotes
    "data-key",
    "data-loc",
    "data-fn",
    "data-note",
    "data-refs",
    // Navigation, callouts, and numbering
    "data-toc",
    "data-list",
    "data-callout",
    "data-kind",
    "data-num",
    "data-label",
    // Source map stamps for live editing
    "data-ss",
    "data-se",
    // Contenteditable islands
    "contenteditable",
    // Inline styling
    "style",
  ],
  FORBID_TAGS: [
    "script",
    "iframe",
    "object",
    "embed",
    "base",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "meta",
    "link",
    "applet",
    "frame",
    "frameset",
  ],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "onmouseover",
    "onmouseout",
    "onfocus",
    "onblur",
    "onkeydown",
    "onkeyup",
    "onchange",
    "onsubmit",
    "onloadstart",
    "onpageshow",
    "onanimationstart",
    "ontoggle",
  ],
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$)|data:image\/|blob:)/i,
};

/**
 * Sanitize an untrusted HTML string before inserting into the DOM.
 * If DOMPurify is not available, falls back to escaping all HTML tags
 * to avoid executing untrusted content.
 */
export function sanitizeHtml(dirty: string, customConfig?: DOMPurifyConfig): string {
  if (typeof DOMPurify !== "undefined" && typeof DOMPurify.sanitize === "function") {
    return DOMPurify.sanitize(dirty, { ...SANITIZE_CONFIG, ...customConfig });
  }
  const g = typeof globalThis !== "undefined" ? (globalThis as Record<string, unknown>) : {};
  const dp = g.DOMPurify as DOMPurifyLib | undefined;
  if (dp && typeof dp.sanitize === "function") {
    return dp.sanitize(dirty, { ...SANITIZE_CONFIG, ...customConfig });
  }
  // Safe fallback if DOMPurify is unexpectedly absent
  console.warn("DOMPurify not found; falling back to text escaping");
  return dirty.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
