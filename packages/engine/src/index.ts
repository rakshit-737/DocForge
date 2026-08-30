/* ============================================================
   @docforge/engine — the markdown → document DOM pipeline, ported
   1:1 from src/js/engine.js (Phase 1, mechanical port).

   The public surface is EXACTLY the classic `Engine` global:
   the 17 members of the IIFE's return object, same names, same
   order. The single-file shell keeps its global via ./global.ts.

   Top-level side effects: only parse.ts touches anything at import
   time (the two marked.use calls, gfm before extensions — the same
   relative order the IIFE ran them in).
   ============================================================ */

import { HL_COLORS, RE_SHOT } from "./parse.js";
import { fmtDate, render } from "./render.js";
import {
  CUT_FILE,
  dynamicCss,
  EMBEDDED,
  FACES,
  FONTS,
  faceName,
  fontFaceCss,
  MARGINS,
  PAGES,
  sysStack,
  tints,
  WORD_CATALOG,
} from "./themes.js";
import { esc } from "./util.js";

/** Exactly today's public surface — the classic `Engine` global, key order preserved. */
export const api = {
  render,
  dynamicCss,
  fontFaceCss,
  tints,
  PAGES,
  MARGINS,
  FONTS,
  FACES,
  EMBEDDED,
  CUT_FILE,
  fmtDate,
  esc,
  RE_SHOT,
  WORD_CATALOG,
  HL_COLORS,
  sysStack,
  faceName,
};

export type {
  Attachment,
  Attachments,
  DfMarkToken,
  DfSpanToken,
  DfSubToken,
  DfSupToken,
  DfUnderToken,
  DialectToken,
  HlColorName,
  LineSpan,
  MarginSpec,
  MarkedToken,
  PageSpec,
  PreprocessInherited,
  RenderMeta,
  RenderResult,
  Settings,
  SpanAttrs,
  Tints,
} from "./types.js";
export {
  CUT_FILE,
  dynamicCss,
  EMBEDDED,
  esc,
  FACES,
  FONTS,
  faceName,
  fmtDate,
  fontFaceCss,
  HL_COLORS,
  MARGINS,
  PAGES,
  RE_SHOT,
  render,
  sysStack,
  tints,
  WORD_CATALOG,
};
