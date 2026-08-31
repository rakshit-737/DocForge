"use client";
/* The classic screenshot-attachment flow (src/js/main.js newKey /
   processImageFile) rehomed on the studio store. An attached image is a
   downscaled data URL held in useDocStore.attachments; the manuscript refers
   to it through the line-anchored dialect marker the engine parses with
   RE_SHOT (packages/engine/src/parse.ts):

       [screenshot: caption | img:key]

   Keys are short and random ("i" + 6 base-36 chars). The bytes ride along
   wherever the document goes — project-file.ts serialises `attachments`
   verbatim and persistence.ts autosaves them — which is exactly why the
   classic downscale numbers are load-bearing: they keep autosaves sized. */
import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { Attachment } from "@docforge/engine";
import { useDocStore } from "./store";

/* The classic bounds (src/js/main.js processImageFile): nothing wider or
   taller than 1600px survives; PNG/GIF stay PNG (sharp UI text), everything
   else re-encodes as JPEG at 0.92. */
const MAX_DIM = 1600;
const JPEG_QUALITY = 0.92;

/** Attachment keys: "i" + 6 random base-36 characters — the classic newKey. */
export function newKey(): string {
  return `i${Math.random().toString(36).slice(2, 8)}`;
}

/** The classic caption guess for a picked file: name minus extension,
    dashes and underscores as spaces. */
export function captionForFile(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

/** The classic pixel work: read the file, downscale anything over the max
    dimension on its longest side, report the placed size alongside the URL. */
function downscale(file: File): Promise<Attachment> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error("could not read the image file"));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error("could not decode the image"));
      img.onload = () => {
        const { width: w, height: h } = img;
        const isPng = /png|gif/i.test(file.type);
        if (w > MAX_DIM || h > MAX_DIM) {
          const k = MAX_DIM / Math.max(w, h);
          const cv = document.createElement("canvas");
          cv.width = Math.round(w * k);
          cv.height = Math.round(h * k);
          const ctx = cv.getContext("2d");
          if (!ctx) {
            rej(new Error("canvas is unavailable here"));
            return;
          }
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          res({
            dataUrl: cv.toDataURL(isPng ? "image/png" : "image/jpeg", JPEG_QUALITY),
            w: cv.width,
            h: cv.height,
          });
        } else {
          res({ dataUrl: String(fr.result), w, h });
        }
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}

/** Downscale `file` exactly like the classic edition, store the result in the
    document's attachments under a fresh key, and return that key. The
    attachments map is replaced, never mutated — autosave (persistence.ts)
    watches object identity. */
export async function processImageFile(file: File): Promise<string> {
  const att = await downscale(file);
  const key = newKey();
  useDocStore.setState((s) => ({ attachments: { ...s.attachments, [key]: att } }));
  return key;
}

/** Insert the dialect marker for an attached image at the cursor, as its own
    block — blank-line separation before and after, caret lands after the
    block (the classic insertBlock placement). The caption is scrubbed of the
    marker's own delimiters so RE_SHOT always parses what we wrote. */
export function insertFigure(view: EditorView, key: string, caption: string): void {
  const cap = caption
    .replace(/[[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const text = `[screenshot${cap ? `: ${cap}` : ""} | img:${key}]`;
  const { state } = view;
  const main = state.selection.main;
  const before = state.sliceDoc(0, main.from);
  const after = state.sliceDoc(main.to);
  const pre = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
  const post = after && !after.startsWith("\n") ? "\n\n" : "\n";
  const insert = pre + text + post;
  view.dispatch({
    changes: { from: main.from, to: main.to, insert },
    selection: EditorSelection.cursor(main.from + insert.length),
    userEvent: "input.insert",
    scrollIntoView: true,
  });
}
