"use client";
/* ============================================================
   html-to-md.ts — HTML soup in, DocForge Markdown out.

   Verbatim port of the htmlToMd closure (src/js/main.js, "paste cleanup"):
   Word and web pages paste as HTML soup; convert the useful structure to the
   app's own markdown instead of dumping tags or losing everything. The same
   function serves paste cleanup, .html/.htm import, .docx import (after
   mammoth) and EPUB chapters — every rule below is classic behaviour and is
   the spec. Pure function; browser only (DOMParser).
   ============================================================ */

export function htmlToMd(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,meta,link,head title").forEach((n) => n.remove());
  // A [screenshot] token is line-anchored and can never parse inside a table
  // cell — strip it there rather than printing the marker literally.
  const cell = (t: string) =>
    t
      .replace(/\[screenshot:[^\]]*\]/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/\|/g, "\\|")
      .trim();
  function inline(node: Node): string {
    let s = "";
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        s += (child.textContent || "").replace(/\s+/g, " ");
        return;
      }
      if (child.nodeType !== 1) return;
      const ch = child as HTMLElement;
      const t = ch.tagName.toLowerCase(),
        inner = inline(ch);
      if (t === "br") s += "\n";
      else if ((t === "b" || t === "strong") && inner.trim()) s += `**${inner.trim()}**`;
      else if ((t === "i" || t === "em") && inner.trim()) s += `*${inner.trim()}*`;
      else if (t === "u" && inner.trim()) s += `++${inner.trim()}++`;
      else if ((t === "s" || t === "del" || t === "strike") && inner.trim())
        s += `~~${inner.trim()}~~`;
      else if (t === "mark" && inner.trim()) {
        const hl = ch.getAttribute("data-hl");
        s += `==${hl && hl !== "yellow" ? `{${hl}}` : ""}${inner.trim()}==`;
      } else if (t === "span" && ch.classList.contains("dfspan") && inner.trim()) {
        // Rebuild the attribute span so colour/size/face survive a round trip.
        const d = ch.dataset,
          parts: string[] = [];
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
      else if (
        t === "a" &&
        ch.getAttribute("href") &&
        /^https?:/i.test(ch.getAttribute("href") as string)
      )
        s += `[${inner.trim() || ch.getAttribute("href")}](${ch.getAttribute("href")})`;
      else if (t === "img") {
        // On its own line so the [screenshot] token parses; imported keys attach the bytes.
        const key = ch.getAttribute("data-df-key");
        const alt = (ch.getAttribute("alt") || "")
          .replace(/[|[\]]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (key) s += `\n[screenshot: ${alt || "Imported image"} | img:${key}]\n`;
        else if (alt) s += `\n[screenshot: ${alt}]\n`;
      } else s += inner;
    });
    return s;
  }
  function block(node: Node, depth = 0): string {
    let out = "";
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        const t = (child.textContent || "").trim();
        if (t) out += t + "\n\n";
        return;
      }
      if (child.nodeType !== 1) return;
      const ch = child as HTMLElement;
      const t = ch.tagName.toLowerCase();
      if (/^h[1-6]$/.test(t))
        out += "#".repeat(Math.min(+t[1], 4)) + " " + inline(ch).trim() + "\n\n";
      else if (t === "p" || t === "div" || t === "section" || t === "article") {
        const kids = ch.querySelector("p,ul,ol,table,h1,h2,h3,h4,pre,blockquote,div");
        if (kids && t !== "p") out += block(ch, depth);
        else {
          const s = inline(ch).trim();
          if (s) out += s + "\n\n";
        }
      } else if (t === "ul" || t === "ol") {
        [...ch.children].forEach((li, i) => {
          if (li.tagName.toLowerCase() !== "li") return;
          const mark = t === "ol" ? `${i + 1}. ` : "- ";
          const sub = li.querySelector("ul,ol");
          const own = inline(li).trim();
          out += "  ".repeat(depth) + mark + own + "\n";
          if (sub) out += block(li, depth + 1).replace(/^(?!\s*$)/gm, "");
        });
        if (!depth) out += "\n";
      } else if (t === "table") {
        const rows = [...ch.querySelectorAll("tr")].map((tr) =>
          [...tr.children].map((td) => cell(inline(td))),
        );
        if (rows.length) {
          out += "| " + rows[0].join(" | ") + " |\n";
          out += "| " + rows[0].map(() => "---").join(" | ") + " |\n";
          rows.slice(1).forEach((r) => {
            out += "| " + r.join(" | ") + " |\n";
          });
          out += "\n";
        }
      } else if (t === "pre")
        out += "```\n" + (ch.textContent || "").replace(/\n$/, "") + "\n```\n\n";
      else if (t === "blockquote") out += block(ch, depth).trim().replace(/^/gm, "> ") + "\n\n";
      else if (t === "img") {
        const key = ch.getAttribute("data-df-key");
        const alt = (ch.getAttribute("alt") || "")
          .replace(/[|[\]]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (key) out += `[screenshot: ${alt || "Imported image"} | img:${key}]\n\n`;
        else if (alt) out += `[screenshot: ${alt}]\n\n`;
      } else out += block(ch, depth);
    });
    return out;
  }
  return block(doc.body)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}
