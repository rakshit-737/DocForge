/* ============================================================
   ambient.d.ts — the vendored globals this package touches, typed
   honestly but minimally (only the members this package actually uses).

   The docx library stays a global this phase (MASTER-PROMPT Phase 1):
   the single-file build inlines the same UMD bytes and the module
   reads it as window.docx, exactly as the classic file did. Its
   members are deliberately `any` — typing the vendored lib here is
   busywork, and the golden gate compares output bytes, not types.
   Engine stays an ambient global too (bundling the whole engine into
   this package would defeat the parallel-implementation phase).
   ============================================================ */

import type { DocxExportApi, DocxFontsApi } from "./index";

declare global {
  /* ----- the docx UMD global (window.docx) ----- */
  interface DocxLib {
    Document: any;
    Packer: any;
    Paragraph: any;
    TextRun: any;
    HeadingLevel: any;
    AlignmentType: any;
    Table: any;
    TableRow: any;
    TableCell: any;
    WidthType: any;
    BorderStyle: any;
    PageNumber: any;
    Footer: any;
    Header: any;
    PageBreak: any;
    TableOfContents: any;
    ExternalHyperlink: any;
    ImageRun: any;
    LevelFormat: any;
    HeightRule: any;
    VerticalAlign: any;
    SectionType: any;
    TableLayoutType: any;
    SimpleField: any;
    Tab: any;
    TabStopType: any;
    NumberFormat: any;
    FootnoteReferenceRun: any;
    ImportedXmlComponent: any;
    LineRuleType: any;
    PageBorderDisplay: any;
    PageBorderOffsetFrom: any;
    PageBorderZOrder: any;
    convertMillimetersToTwip: (mm: number) => number;
  }

  interface Window {
    docx: DocxLib;
    /** base64 TTF bytes keyed "<stem>-<Cut>", inlined by the single-file build. */
    __FONT_DATA__?: Record<string, string>;
  }

  /* ----- the Engine global (sibling module; stays global to avoid bundling it) ----- */
  interface EngineTints {
    a50: string;
    a75: string;
    a100: string;
    a200: string;
    a300: string;
    a400: string;
    a500: string;
    a600: string;
    a700: string;
    a800: string;
    a900: string;
  }
  interface EnginePage {
    w: number;
    h: number;
    label: string;
  }
  interface EngineMargin {
    t: number;
    r: number;
    b: number;
    l: number;
  }
  interface EngineEmbeddedFamily {
    name: string;
    stem: string;
    family: string;
    pitch: string;
    cuts: Record<string, number>;
  }
  interface EngineApi {
    tints(accent: string): EngineTints;
    faceName(key: unknown): string | null;
    fmtDate(iso?: string): string;
    PAGES: Record<string, EnginePage> & { A4: EnginePage };
    MARGINS: Record<string, EngineMargin> & { normal: EngineMargin };
    EMBEDDED: EngineEmbeddedFamily[];
    CUT_FILE: Record<string, string>;
    HL_COLORS: Record<string, string>;
  }
  // eslint-disable-next-line no-var
  var Engine: EngineApi;

  /* The classic globals src/global.ts assigns (plain, mutable objects). */
  // eslint-disable-next-line no-var
  var DocxExport: DocxExportApi;
  // eslint-disable-next-line no-var
  var DocxFonts: DocxFontsApi;
}
