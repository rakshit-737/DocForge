/* Shared test plumbing: render into the happy-dom document and compare
   against expected HTML fragments normalized through the same serializer. */

import type { Attachments, RenderResult, Settings } from "../src/index.js";
import { render } from "../src/index.js";

/** A neutral settings base every test starts from (mirrors the golden matrix BASE). */
export const BASE: Settings = { theme: "modern", accent: "#2563eb", page: "A4", margins: "normal" };

export function r(
  md: string,
  over: Partial<Settings> = {},
  attachments: Attachments = {},
): RenderResult & { content: HTMLElement } {
  const res = render(md, { ...BASE, ...over }, attachments);
  const content = res.doc.querySelector(".content") as HTMLElement;
  return { ...res, content };
}

/** Drop the data-ss/data-se line-map stamps so fragment comparisons stay focused. */
export function stripSpans<T extends HTMLElement>(root: T): T {
  root.querySelectorAll("[data-ss]").forEach((el) => {
    el.removeAttribute("data-ss");
    el.removeAttribute("data-se");
  });
  return root;
}

/** Round-trip an expected HTML string through the same DOM serializer the
    assertion reads, so entity/whitespace normalization matches on both sides. */
export function norm(html: string): string {
  const t = document.createElement("template");
  t.innerHTML = html;
  return t.innerHTML;
}

/** Rendered body HTML for `md`, line-map stamps stripped. */
export function body(
  md: string,
  over: Partial<Settings> = {},
  attachments: Attachments = {},
): string {
  const { content } = r(md, over, attachments);
  return stripSpans(content).innerHTML;
}
