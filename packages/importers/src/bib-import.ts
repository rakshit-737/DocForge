/* ============================================================
   bib-import.ts — a reference library in, dialect entries out
   (§8.3: "drop a .bib from Zotero/Mendeley").

   Three formats, one shape: BibTeX (`.bib`), RIS (`.ris`, what
   EndNote/Scopus/PubMed export) and CSL-JSON (`.json`, what Zotero
   calls "CSL JSON"). Each parses to the same neutral record, and the
   records format into the dialect's own bibliography lines:

     [@harrow2015]: Harrow, J. (2015). *Acoustic Emission…*

   Nothing here renders anything: the engine still owns citation
   rendering, and this only writes the definition text a reader could
   have typed by hand. That keeps the golden gate out of it — importing
   a library changes the SOURCE, never the renderer.

   Dependency-free and offline, like every other importer in this
   package. LaTeX accents are decoded from a small table rather than by
   pulling in a TeX parser; anything unrecognised loses its command and
   keeps its letters, which is what a reader wants from a name.
   ============================================================ */

export type BibFormat = "bibtex" | "ris" | "csl-json";

export interface BibEntry {
  /** Sanitised so `[@key]` can address it: no space, comma or `]`. */
  key: string;
  /** article / book / inproceedings / … — kept for the formatter's judgement. */
  type: string;
  authors: string[];
  editors?: string[];
  year?: string;
  title?: string;
  /** Journal, book or proceedings the work sits in. */
  container?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  edition?: string;
  doi?: string;
  url?: string;
  note?: string;
}

/* ---------------- LaTeX-ish text ---------------- */

const ACCENTS: Record<string, string> = {
  "\\'a": "á",
  "\\'e": "é",
  "\\'i": "í",
  "\\'o": "ó",
  "\\'u": "ú",
  "\\'y": "ý",
  "\\'c": "ć",
  "\\'n": "ń",
  "\\'s": "ś",
  "\\'z": "ź",
  '\\"a': "ä",
  '\\"e': "ë",
  '\\"i': "ï",
  '\\"o': "ö",
  '\\"u': "ü",
  '\\"y': "ÿ",
  "\\`a": "à",
  "\\`e": "è",
  "\\`i": "ì",
  "\\`o": "ò",
  "\\`u": "ù",
  "\\^a": "â",
  "\\^e": "ê",
  "\\^i": "î",
  "\\^o": "ô",
  "\\^u": "û",
  "\\~a": "ã",
  "\\~n": "ñ",
  "\\~o": "õ",
  "\\ca": "ą",
  "\\cc": "ç",
  "\\ce": "ę",
  "\\cs": "ş",
  "\\va": "ă",
  "\\vc": "č",
  "\\ve": "ě",
  "\\vr": "ř",
  "\\vs": "š",
  "\\vz": "ž",
  "\\ua": "ă",
  "\\uu": "ŭ",
  "\\.z": "ż",
  "\\=a": "ā",
  "\\=e": "ē",
  "\\=i": "ī",
  "\\=o": "ō",
  "\\=u": "ū",
  "\\Ha": "ã",
  "\\oe": "œ",
  "\\ae": "æ",
  "\\o": "ø",
  "\\l": "ł",
  "\\ss": "ß",
  "\\AE": "Æ",
  "\\OE": "Œ",
  "\\O": "Ø",
  "\\L": "Ł",
};

/** BibTeX's braces and escapes into plain text a reader would recognise. */
export function deTex(raw: string): string {
  let s = raw;
  /* `{\"o}` / `\"{o}` / `\"o` — all three shapes the wild produces. */
  s = s.replace(/\{?\\([`'^"~=.]|c|v|u|H)\{?([A-Za-z])\}?\}?/g, (m, cmd: string, ch: string) => {
    return ACCENTS[`\\${cmd}${ch}`] ?? ch;
  });
  s = s.replace(/\{?\\(oe|ae|ss|AE|OE|[oOlL])\}?(?![A-Za-z])/g, (m, cmd: string) => {
    return ACCENTS[`\\${cmd}`] ?? cmd;
  });
  s = s
    .replace(/\\&/g, "&")
    .replace(/\\%/g, "%")
    .replace(/\\\$/g, "$")
    .replace(/\\_/g, "_")
    .replace(/\\#/g, "#")
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\textit\{([^}]*)\}/g, "$1")
    .replace(/\\emph\{([^}]*)\}/g, "$1")
    .replace(/\\url\{([^}]*)\}/g, "$1")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

/** `[@key]` accepts anything but whitespace, comma and `]` (engine parse.ts). */
export const sanitiseKey = (raw: string): string =>
  raw
    .replace(/[\s,\][]+/g, "")
    .replace(/^[:@]+/, "")
    .slice(0, 64) || "ref";

/* ---------------- names ---------------- */

/** "Last, First M." / "First M. Last" → "Last, F. M." (the corpus's shape). */
export function formatName(raw: string): string {
  const name = deTex(raw).trim();
  if (!name) return "";
  if (/^\{.*\}$/.test(raw.trim())) return name; // a braced corporate author stays whole
  let last: string;
  let rest: string;
  if (name.includes(",")) {
    const [l, ...r] = name.split(",");
    last = (l ?? "").trim();
    rest = r.join(",").trim();
  } else {
    const parts = name.split(/\s+/);
    if (parts.length === 1) return name; // a single word is the whole name
    last = parts.pop() as string;
    rest = parts.join(" ");
  }
  const initials = rest
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => `${w[0]?.toUpperCase() ?? ""}.`)
    .join(" ");
  return initials ? `${last}, ${initials}` : last;
}

const splitAuthors = (field: string): string[] =>
  field
    .split(/\s+and\s+/i)
    .map((n) => formatName(n))
    .filter(Boolean);

/* ---------------- BibTeX ---------------- */

/** Read one brace-balanced or quote-delimited value starting at `i`. */
function readValue(src: string, i: number): { value: string; next: number } {
  while (i < src.length && /\s/.test(src[i] as string)) i++;
  const ch = src[i];
  if (ch === "{") {
    let depth = 0;
    const start = i;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) return { value: src.slice(start + 1, i), next: i + 1 };
      }
    }
    return { value: src.slice(start + 1), next: src.length };
  }
  if (ch === '"') {
    let depth = 0;
    const start = i;
    for (i++; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      else if (src[i] === '"' && depth === 0)
        return { value: src.slice(start + 1, i), next: i + 1 };
    }
    return { value: src.slice(start + 1), next: src.length };
  }
  // bare word or number, ending at a comma or the entry's close
  const m = /^[^,}\n]*/.exec(src.slice(i));
  const value = m ? m[0].trim() : "";
  return { value, next: i + (m ? m[0].length : 0) };
}

export function parseBibtex(text: string): BibEntry[] {
  const out: BibEntry[] = [];
  const strings = new Map<string, string>();
  const re = /@(\w+)\s*[{(]/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: the exec-loop idiom
  while ((m = re.exec(text))) {
    const type = (m[1] ?? "").toLowerCase();
    let i = m.index + m[0].length;
    if (type === "comment" || type === "preamble") continue;

    if (type === "string") {
      const eq = text.indexOf("=", i);
      if (eq < 0) continue;
      const name = text.slice(i, eq).trim();
      const { value } = readValue(text, eq + 1);
      strings.set(name.toLowerCase(), deTex(value));
      continue;
    }

    // key, then fields
    const keyEnd = text.slice(i).search(/[,}\n]/);
    if (keyEnd < 0) continue;
    const key = sanitiseKey(text.slice(i, i + keyEnd));
    i += keyEnd + 1;

    const fields: Record<string, string> = {};
    let depth = 1;
    while (i < text.length && depth > 0) {
      while (i < text.length && /[\s,]/.test(text[i] as string)) i++;
      if (text[i] === "}" || text[i] === ")") {
        depth = 0;
        break;
      }
      const eq = text.indexOf("=", i);
      if (eq < 0) break;
      const name = text.slice(i, eq).trim().toLowerCase();
      if (!name || /[{}@]/.test(name)) break;
      const { value, next } = readValue(text, eq + 1);
      /* A bare word is either a @string macro or a number (a year, a month). */
      fields[name] = strings.get(value.toLowerCase()) ?? deTex(value);
      i = next;
    }
    re.lastIndex = Math.max(re.lastIndex, i);
    out.push(fromFields(key, type, fields));
  }
  return out;
}

function fromFields(key: string, type: string, f: Record<string, string>): BibEntry {
  const year = (f.year || f.date || "").match(/\d{4}/)?.[0];
  const entry: BibEntry = {
    key,
    type,
    authors: f.author ? splitAuthors(f.author) : [],
    ...(f.editor ? { editors: splitAuthors(f.editor) } : {}),
    ...(year ? { year } : {}),
    ...(f.title ? { title: f.title } : {}),
    ...(f.journal || f.booktitle || f.journaltitle
      ? { container: f.journal || f.booktitle || f.journaltitle }
      : {}),
    ...(f.publisher || f.school || f.institution
      ? { publisher: f.publisher || f.school || f.institution }
      : {}),
    ...(f.volume ? { volume: f.volume } : {}),
    ...(f.number || f.issue ? { issue: f.number || f.issue } : {}),
    ...(f.pages ? { pages: f.pages.replace(/--/g, "–") } : {}),
    ...(f.edition ? { edition: f.edition } : {}),
    ...(f.doi ? { doi: f.doi } : {}),
    ...(f.url || f.howpublished ? { url: f.url || f.howpublished } : {}),
    ...(f.note ? { note: f.note } : {}),
  };
  return entry;
}

/* ---------------- RIS ---------------- */

const RIS_TYPE: Record<string, string> = {
  JOUR: "article",
  BOOK: "book",
  CHAP: "incollection",
  CONF: "inproceedings",
  CPAPER: "inproceedings",
  THES: "phdthesis",
  RPRT: "techreport",
  ELEC: "misc",
};

export function parseRis(text: string): BibEntry[] {
  const out: BibEntry[] = [];
  let cur: Record<string, string[]> | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9])\s+-\s?(.*)$/.exec(rawLine);
    if (!m) {
      // a wrapped continuation belongs to the previous tag
      if (cur && rawLine.trim() && cur.__last) {
        const tag = cur.__last[0] as string;
        const list = cur[tag];
        if (list?.length) list[list.length - 1] += ` ${rawLine.trim()}`;
      }
      continue;
    }
    const [, tag = "", value = ""] = m;
    if (tag === "TY") {
      cur = { TY: [value.trim()], __last: ["TY"] };
      continue;
    }
    if (!cur) continue;
    if (tag === "ER") {
      out.push(fromRis(cur));
      cur = null;
      continue;
    }
    (cur[tag] ??= []).push(value.trim());
    cur.__last = [tag];
  }
  if (cur) out.push(fromRis(cur));
  return dedupeKeys(out);
}

function fromRis(r: Record<string, string[]>): BibEntry {
  const one = (t: string): string | undefined => r[t]?.[0]?.trim() || undefined;
  const authors = [...(r.AU ?? []), ...(r.A1 ?? [])].map((a) => formatName(a)).filter(Boolean);
  const year = (one("PY") || one("Y1") || one("DA") || "").match(/\d{4}/)?.[0];
  const pages = one("SP") && one("EP") ? `${one("SP")}–${one("EP")}` : one("SP") || undefined;
  const type = RIS_TYPE[(one("TY") || "").toUpperCase()] ?? "misc";
  const surname = (authors[0] ?? "anon").split(",")[0]?.toLowerCase().replace(/\W+/g, "") ?? "ref";
  return {
    key: sanitiseKey(`${surname}${year ?? ""}`),
    type,
    authors,
    ...(r.ED ? { editors: r.ED.map(formatName) } : {}),
    ...(year ? { year } : {}),
    ...(one("TI") || one("T1") ? { title: (one("TI") || one("T1")) as string } : {}),
    ...(one("JO") || one("JF") || one("T2")
      ? { container: (one("JO") || one("JF") || one("T2")) as string }
      : {}),
    ...(one("PB") ? { publisher: one("PB") as string } : {}),
    ...(one("VL") ? { volume: one("VL") as string } : {}),
    ...(one("IS") ? { issue: one("IS") as string } : {}),
    ...(pages ? { pages } : {}),
    ...(one("ET") ? { edition: one("ET") as string } : {}),
    ...(one("DO") ? { doi: one("DO") as string } : {}),
    ...(one("UR") ? { url: one("UR") as string } : {}),
  };
}

/* ---------------- CSL-JSON ---------------- */

interface CslName {
  family?: string;
  given?: string;
  literal?: string;
}
interface CslItem {
  id?: string | number;
  type?: string;
  title?: string;
  author?: CslName[];
  editor?: CslName[];
  issued?: { "date-parts"?: unknown[][]; raw?: string };
  "container-title"?: string;
  publisher?: string;
  volume?: string | number;
  issue?: string | number;
  page?: string | number;
  edition?: string | number;
  DOI?: string;
  URL?: string;
  note?: string;
}

const CSL_TYPE: Record<string, string> = {
  "article-journal": "article",
  "paper-conference": "inproceedings",
  chapter: "incollection",
  thesis: "phdthesis",
  report: "techreport",
  webpage: "misc",
};

const cslName = (n: CslName): string =>
  n.literal ? deTex(n.literal) : formatName([n.family, n.given].filter(Boolean).join(", "));

/** True when the text is a CSL-JSON library rather than, say, a project file. */
export function looksLikeCslJson(text: string): boolean {
  try {
    const v = JSON.parse(text);
    return (
      Array.isArray(v) &&
      v.length > 0 &&
      v.every((x) => x && typeof x === "object" && ("id" in x || "title" in x)) &&
      v.some((x) => "type" in x || "author" in x || "issued" in x)
    );
  } catch {
    return false;
  }
}

export function parseCslJson(text: string): BibEntry[] {
  const data = JSON.parse(text) as CslItem[];
  if (!Array.isArray(data)) return [];
  return dedupeKeys(
    data.map((it, i) => {
      const authors = (it.author ?? []).map(cslName).filter(Boolean);
      const yearPart = it.issued?.["date-parts"]?.[0]?.[0];
      const year = String(yearPart ?? it.issued?.raw ?? "").match(/\d{4}/)?.[0];
      const surname = (authors[0] ?? "").split(",")[0]?.toLowerCase().replace(/\W+/g, "");
      const key = sanitiseKey(String(it.id ?? "") || `${surname || "ref"}${year ?? i + 1}`);
      return {
        key,
        type: CSL_TYPE[it.type ?? ""] ?? it.type ?? "misc",
        authors,
        ...(it.editor?.length ? { editors: it.editor.map(cslName) } : {}),
        ...(year ? { year } : {}),
        ...(it.title ? { title: deTex(it.title) } : {}),
        ...(it["container-title"] ? { container: deTex(it["container-title"]) } : {}),
        ...(it.publisher ? { publisher: deTex(it.publisher) } : {}),
        ...(it.volume != null ? { volume: String(it.volume) } : {}),
        ...(it.issue != null ? { issue: String(it.issue) } : {}),
        ...(it.page != null ? { pages: String(it.page).replace(/-{1,2}/g, "–") } : {}),
        ...(it.edition != null ? { edition: String(it.edition) } : {}),
        ...(it.DOI ? { doi: it.DOI } : {}),
        ...(it.URL ? { url: it.URL } : {}),
        ...(it.note ? { note: deTex(it.note) } : {}),
      } satisfies BibEntry;
    }),
  );
}

/** Keys must be unique to address anything: collisions take a, b, c. */
function dedupeKeys(entries: BibEntry[]): BibEntry[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    const n = seen.get(e.key) ?? 0;
    seen.set(e.key, n + 1);
    return n === 0 ? e : { ...e, key: `${e.key}${String.fromCharCode(96 + n)}` };
  });
}

/* ---------------- out: the dialect ---------------- */

function authorList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0] as string;
  if (names.length > 20) return `${names.slice(0, 19).join(", ")}, … ${names[names.length - 1]}`;
  return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
}

/** One `[@key]: …` line — the entry a reader would have typed by hand.
    Shape follows the corpus specimen (07-citations.md): author list, year in
    brackets, italic title for standalone works, then where it appeared. */
export function formatEntry(e: BibEntry): string {
  const bits: string[] = [];
  const who = authorList(e.authors) || authorList(e.editors ?? []);
  const standalone = /book|thesis|report|misc|manual/i.test(e.type) && !e.container;
  bits.push(who ? `${who}${/[.?!]$/.test(who) ? "" : "."}` : "");
  if (e.year) bits.push(`(${e.year}).`);
  if (e.title) bits.push(standalone ? `*${e.title}*.` : `${e.title}.`);
  if (e.container) {
    let where = standalone ? e.container : `*${e.container}*`;
    if (e.volume) where += `, ${e.volume}`;
    if (e.issue) where += `(${e.issue})`;
    if (e.pages) where += `, ${e.pages}`;
    bits.push(`${where}.`);
  } else if (e.pages) {
    bits.push(`pp. ${e.pages}.`);
  }
  if (e.edition) bits.push(`${e.edition} ed.`);
  if (e.publisher) bits.push(`${e.publisher}.`);
  if (e.doi) bits.push(`https://doi.org/${e.doi.replace(/^https?:\/\/doi\.org\//i, "")}`);
  else if (e.url) bits.push(e.url);
  return bits.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

/** The block of definitions to splice into a manuscript, newest last. */
export function toDefinitions(entries: BibEntry[]): string {
  return entries.map((e) => `[@${e.key}]: ${formatEntry(e)}`).join("\n");
}

/** Sniff the format when the extension doesn't settle it. */
export function detectFormat(text: string, filename = ""): BibFormat | null {
  const ext = (filename.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
  if (ext === "bib" || ext === "bibtex") return "bibtex";
  if (ext === "ris") return "ris";
  if (ext === "json") return looksLikeCslJson(text) ? "csl-json" : null;
  if (/^\s*@\w+\s*[{(]/m.test(text)) return "bibtex";
  if (/^TY\s+-\s+/m.test(text)) return "ris";
  if (looksLikeCslJson(text)) return "csl-json";
  return null;
}

/** Parse whatever a reader dropped. Throws only on a format we can't name. */
export function parseLibrary(text: string, filename = ""): BibEntry[] {
  const format = detectFormat(text, filename);
  if (format === "bibtex") return dedupeKeys(parseBibtex(text));
  if (format === "ris") return parseRis(text);
  if (format === "csl-json") return parseCslJson(text);
  throw new Error("That doesn't look like a BibTeX, RIS or CSL-JSON library");
}

export const BibImport = {
  parseLibrary,
  parseBibtex,
  parseRis,
  parseCslJson,
  detectFormat,
  looksLikeCslJson,
  toDefinitions,
  formatEntry,
};
export type BibImportApi = typeof BibImport;
