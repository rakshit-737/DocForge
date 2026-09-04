/* ============================================================
   smart-paste.ts — what the clipboard means (§8.1 "smart paste").

   Two of the four cases already had homes: a clipboard image becomes an
   attached figure (image-tool.ts), and rich HTML — Word, a web page, and a
   spreadsheet range, which all put a <table> on the clipboard — converts to
   Markdown through html-to-md.ts. What was left is the plain-text half:

   - a tab-separated block, which is what a spreadsheet leaves for editors
     that ask for text only, becomes a dialect table;
   - a URL pasted over a selection wraps that selection in a link, which is
     the one paste every editor on earth has taught people to expect.

   Both are pure string work so the rules can be argued with in tests. Both
   are deliberately narrow: an ordinary paste must arrive untouched, because
   silently rewriting what someone pasted is worse than not helping at all.
   ============================================================ */

/** Cells may carry pipes; a dialect table's column rule may not. */
const cell = (s: string) => s.trim().replace(/\|/g, "\\|");

/**
 * A tab-separated block as a dialect table, or null to paste it as it came.
 *
 * TABS only, never commas: Excel, Sheets and Numbers all put tabs on the
 * clipboard, while a comma is just as likely to be a sentence. Prose pasted
 * as a table is a worse outcome than a table pasted as prose.
 */
export function tableFromTsv(text: string): string | null {
  const raw = String(text ?? "").replace(/\r\n?/g, "\n");
  if (!raw.includes("\t")) return null;
  const lines = raw.replace(/\n+$/, "").split("\n");
  if (lines.length < 2 || lines.length > 200) return null;

  const rows = lines.map((l) => l.split("\t"));
  const width = rows[0]?.length ?? 0;
  if (width < 2 || width > 20) return null;
  /* Every row the same shape, or this is not a range — a ragged block is
     someone's indented notes, and they should arrive as they were written. */
  if (!rows.every((r) => r.length === width)) return null;
  /* A cell wide enough to be a paragraph means the tabs were layout, not
     structure. */
  if (rows.some((r) => r.some((c) => c.length > 200))) return null;

  const head = (rows[0] ?? []).map(cell);
  const body = rows.slice(1).map((r) => r.map(cell));
  return [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...body.map((r) => `| ${r.join(" | ")} |`),
    "",
  ].join("\n");
}

/** http(s) and mailto only — a `javascript:` "link" is not a link. */
const URL_ONLY = /^(?:https?:\/\/[^\s<>"']+|mailto:[^\s<>"']+)$/i;

/**
 * A URL pasted over selected text, as a link around that text — or null when
 * the paste is anything else, in which case it lands as it came.
 */
export function linkAround(pasted: string, selected: string): string | null {
  const url = String(pasted ?? "").trim();
  const text = String(selected ?? "").trim();
  if (!url || !text) return null;
  if (!URL_ONLY.test(url)) return null;
  /* Replacing a URL with a link to the pasted URL loses the one the reader
     had; leave that alone. */
  if (URL_ONLY.test(text)) return null;
  /* A selection spanning blocks is not a link label. */
  if (/\n/.test(selected)) return null;
  return `[${text.replace(/[[\]]/g, "\\$&")}](${url})`;
}
