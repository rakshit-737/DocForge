/* ============================================================
   util.ts — shared helpers, extracted verbatim from the top of
   src/js/engine.js. No behavior change; no top-level side effects.
   ============================================================ */
import type { Settings } from "./types";

/* Whether a lone newline inside a paragraph is a hard line break. Off by default:
   authors wrap their source, and burning those wraps into the printed page is the
   single loudest "generated" signal there is. The Formal letter template — an address
   block, where every line really is its own line — turns it back on. */
export const mdOpts = (s?: Settings | null) => ({ breaks: !!(s && s.hardWrap) });

export const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const cssStr = (s: unknown) =>
  String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');

export const slugify = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "sec";

/** The cover's date wording, and the running head's. Moved here from render.ts
    unchanged, so themes.ts can use it without a circular import. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}
