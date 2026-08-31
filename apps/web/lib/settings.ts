/* Document settings — the same contract the classic app and the golden
   matrix speak. DEFAULTS mirrors src/js/main.js (and the parity harness). */

export interface Settings {
  /* The engine's Settings carries an index signature (the dialect grows
     additively); ours stays assignable to it. */
  [key: string]: unknown;
  title: string;
  subtitle: string;
  author: string;
  kicker: string;
  metaExtra: string;
  date: string;
  theme: string;
  accent: string;
  page: string;
  margins: string;
  cover: boolean;
  header: boolean;
  pageNums: boolean;
  numbered: boolean;
  justify: boolean;
  h1break: boolean;
  hardWrap: boolean;
  citeStyle: string;
  borderStyle: string;
  borderWeight: string;
  borderColor: string;
  fontHead: string;
  fontBody: string;
  baseSize: string;
  lineSpacing: string;
}

export const THEME_ACCENT: Record<string, string> = {
  modern: "#2563eb",
  executive: "#1f3a5f",
  academic: "#7f1d1d",
  minimal: "#111827",
};

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function defaultSettings(): Settings {
  return {
    title: "",
    subtitle: "",
    author: "",
    kicker: "",
    metaExtra: "",
    date: todayISO(),
    theme: "modern",
    accent: "#2563eb",
    page: "A4",
    margins: "normal",
    cover: false,
    header: true,
    pageNums: true,
    numbered: false,
    justify: false,
    h1break: false,
    hardWrap: false,
    citeStyle: "ieee",
    borderStyle: "none",
    borderWeight: "medium",
    borderColor: "ink",
    fontHead: "theme",
    fontBody: "theme",
    baseSize: "11",
    lineSpacing: "default",
  };
}
