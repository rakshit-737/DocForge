"use client";
/* The formatting toolbar — the classic two-row .tbrow tray composition worn
   over Radix Toolbar. One tab stop for the whole strip (Radix supplies the
   roving tabindex + arrow keys — ledger A4); every control ≥13px (A5); rows
   never wrap — at narrow widths a row scrolls under the cursor and the
   classic 38px edge fade announces the clipped side (src/app.css .tbrow,
   ported as the useEdgeFade hook). Icons are the classic authored set:
   24 viewBox, 1.8 stroke (fine interior detail 1.4 per the icon grammar),
   letter-form actions as mono text glyphs — never emoji. */
import type { Command, EditorView } from "@codemirror/view";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Toolbar from "@radix-ui/react-toolbar";
import * as Tooltip from "@radix-ui/react-tooltip";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ImageTool } from "@/components/image-tool";
import { loadStudio } from "@/lib/bootstrap";
import {
  alignCenter,
  alignJustify,
  alignLeft,
  alignRight,
  clearFormatting,
  cycleCase,
  HL_COLORS,
  insertCallout,
  insertCitation,
  insertCodeBlock,
  insertDivider,
  insertEquation,
  insertFigure,
  insertFootnote,
  insertLink,
  insertPagebreak,
  insertTable,
  insertToc,
  setHighlight,
  setTextBg,
  setTextColor,
  setTextFont,
  setTextSize,
  toggleBold,
  toggleBulletList,
  toggleCode,
  toggleH1,
  toggleH2,
  toggleH3,
  toggleItalic,
  toggleNumberList,
  toggleQuote,
  toggleStrike,
  toggleSub,
  toggleSup,
  toggleUnderline,
} from "@/lib/editor-commands";

/* ---------------- desk plate styling ---------------- */

const TB =
  "inline-flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center gap-1 " +
  "rounded-[1px] border-0 bg-transparent px-1.5 font-mono text-[13px] text-ink-2 " +
  "transition-colors duration-[160ms] ease-desk hover:bg-tray hover:text-ink " +
  "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus " +
  "motion-safe:active:scale-[0.96] pointer-coarse:h-9 pointer-coarse:min-w-9";

const TIP =
  "z-[80] flex items-center gap-2 rounded-menu bg-ink px-2.5 py-1 text-xs font-semibold " +
  "text-surface select-none";

const MENU = "z-[60] rounded-menu bg-tray p-3";

const SW =
  "h-[22px] w-[22px] cursor-pointer rounded-menu border border-[rgba(128,128,128,0.35)] " +
  "motion-safe:transition-transform motion-safe:duration-[160ms] motion-safe:hover:scale-[1.12] " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus " +
  "data-[highlighted]:outline-2 data-[highlighted]:outline-offset-1 data-[highlighted]:outline-focus " +
  "pointer-coarse:h-[26px] pointer-coarse:w-[26px]";

const MOD =
  typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform) ? "⌘" : "Ctrl+";
const MODSHIFT = MOD === "⌘" ? "⇧⌘" : "Ctrl+Shift+";

/* ---------------- the classic edge-fade overflow affordance ---------------- */

/** Port of the .tbrow scroll observer (src/js/main.js): a 38px mask fade on
    whichever edge hides more row, kept honest by scroll + ResizeObserver +
    one post-boot rAF (fonts/layout can shift widths after mount). */
function useEdgeFade() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fade, setFade] = useState({ l: false, r: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () =>
      setFade((f) => {
        const l = el.scrollLeft > 4;
        const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
        return f.l === l && f.r === r ? f : { l, r };
      });
    el.addEventListener("scroll", upd, { passive: true });
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    upd();
    const raf = requestAnimationFrame(upd);
    return () => {
      el.removeEventListener("scroll", upd);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return { ref, fade };
}

function Row({ children }: { children: ReactNode }) {
  const { ref, fade } = useEdgeFade();
  const mask = `linear-gradient(to right, transparent 0, #000 ${fade.l ? "38px" : "0px"}, #000 calc(100% - ${fade.r ? "38px" : "0px"}), transparent 100%)`;
  return (
    <div
      ref={ref}
      className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ WebkitMaskImage: mask, maskImage: mask }}
    >
      {children}
    </div>
  );
}

/* ---------------- building blocks ---------------- */

/** A ruled tray on the desk — --bg2 fill, 1px soft-rule hairline, square. */
function Tray({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset
      aria-label={label}
      className="m-0 flex shrink-0 items-center gap-px rounded-none border border-line bg-surface p-0.5"
    >
      {children}
    </fieldset>
  );
}

function Tool({
  label,
  shortcut,
  run,
  children,
}: {
  label: string;
  shortcut?: string;
  run: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Toolbar.Button type="button" className={TB} aria-label={label} onClick={run}>
          {children}
        </Toolbar.Button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content sideOffset={6} className={TIP} style={{ boxShadow: "var(--elev-m)" }}>
          {label}
          {shortcut ? (
            <kbd className="font-mono text-[10px] font-normal tracking-wide opacity-80">
              {shortcut}
            </kbd>
          ) : null}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** Highlight / text-colour popmenus: serif title over a 5-column swatch grid,
    Esc closes and hands focus back (Radix); picking hands focus to the editor. */
function SwatchMenu({
  label,
  title,
  glyph,
  swatches,
  onPick,
  custom,
  shortcut,
}: {
  label: string;
  title: string;
  glyph: ReactNode;
  swatches: { value: string; name: string; css: string }[];
  onPick: (value: string) => void;
  custom?: boolean;
  shortcut?: string;
}) {
  const [open, setOpen] = useState(false);
  const picked = useRef(false);
  const pick = (v: string) => {
    picked.current = true;
    onPick(v);
  };
  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Toolbar.Button asChild>
            <DropdownMenu.Trigger type="button" className={TB} aria-label={label}>
              {glyph}
            </DropdownMenu.Trigger>
          </Toolbar.Button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={6} className={TIP} style={{ boxShadow: "var(--elev-m)" }}>
            {label}
            {shortcut ? (
              <kbd className="font-mono text-[10px] font-normal tracking-wide opacity-80">
                {shortcut}
              </kbd>
            ) : null}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={6}
          align="start"
          className={MENU}
          style={{ boxShadow: "var(--elev-m)" }}
          onCloseAutoFocus={(e) => {
            // After a pick the editor already holds focus — keep it there.
            // A plain Esc still returns focus to the trigger.
            if (picked.current) {
              picked.current = false;
              e.preventDefault();
            }
          }}
        >
          <div className="mb-2 font-display text-sm text-ink">{title}</div>
          <div className="grid grid-cols-5 gap-1.5">
            {swatches.map((s) => (
              <DropdownMenu.Item key={s.value} asChild onSelect={() => pick(s.value)}>
                <button
                  type="button"
                  aria-label={`${label}: ${s.name}`}
                  className={SW}
                  style={{ background: s.css }}
                />
              </DropdownMenu.Item>
            ))}
          </div>
          {custom ? (
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink-2">
              Custom
              <input
                type="color"
                aria-label={`${label}: custom`}
                className="h-6 w-10 cursor-pointer border-0 bg-transparent p-0"
                style={{ boxShadow: "0 0 0 1px var(--rule)" }}
                onChange={(e) => {
                  pick(e.target.value);
                  setOpen(false);
                }}
              />
            </label>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ---------------- the authored icon set (src/index.html, one grammar) ---------------- */

const svgProps = {
  viewBox: "0 0 24 24",
  width: 15,
  height: 15,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const ic = {
  code: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" />
    </svg>
  ),
  alignLeft: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />
    </svg>
  ),
  alignCenter: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />
    </svg>
  ),
  alignRight: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />
    </svg>
  ),
  alignJustify: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  ul: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  ol: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path
        d="M4 5l1.5-1v4M3.6 11.4a1.4 1.4 0 0 1 2.6.8c0 1-2.4 1.4-2.4 2.6h2.7M3.7 16.8h1.6a1.2 1.2 0 0 1 0 2.4h-.7 .7a1.2 1.2 0 0 1 0 2.4H3.6"
        strokeWidth={1.4}
      />
    </svg>
  ),
  quote: (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="currentColor"
    >
      <path
        d="M9.6 6C6.9 7.6 5 10.2 5 13.4 5 16 6.6 18 9 18c2 0 3.4-1.5 3.4-3.4 0-1.8-1.3-3.2-3.1-3.2-.3 0-.7 0-.9.1.4-1.7 1.7-3.3 3.3-4.2zm9 0c-2.7 1.6-4.6 4.2-4.6 7.4 0 2.6 1.6 4.6 4 4.6 2 0 3.4-1.5 3.4-3.4 0-1.8-1.3-3.2-3.1-3.2-.3 0-.7 0-.9.1.4-1.7 1.7-3.3 3.3-4.2z"
        transform="scale(0.85) translate(2 1)"
      />
    </svg>
  ),
  link: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  ),
  table: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M15.5 4.5v15" />
    </svg>
  ),
  callout: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H12l-4 4v-4H5.5A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M12 7.5v3.5" />
      <circle cx="12" cy="13.2" r="0.4" fill="currentColor" />
    </svg>
  ),
  codeblock: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9.5 9.5L7 12l2.5 2.5M14.5 9.5L17 12l-2.5 2.5" />
    </svg>
  ),
  shot: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.2-1.8a1.5 1.5 0 0 1 1.25-.7h4.9a1.5 1.5 0 0 1 1.25.7L16.9 6h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  ),
  pagebreak: (
    <svg {...svgProps} aria-hidden="true" focusable="false">
      <path d="M5 4h14M5 8h14" />
      <path d="M3 12h3m3 0h3m3 0h3m3 0h0" strokeDasharray="3 3" />
      <path d="M5 16h14M5 20h14" />
    </svg>
  ),
};

/* the two colour tools carry literal ink specimens, not chrome tokens */
const hlGlyph = (
  <span className="rounded-[1px] px-0.5" style={{ boxShadow: "inset 0 -4px 0 #f5d90a" }}>
    A
  </span>
);
const fcGlyph = (
  <span className="rounded-[1px] px-0.5" style={{ boxShadow: "inset 0 -4px 0 #c73434" }}>
    A
  </span>
);

/* Word's highlighter inks + the classic text-colour dozen (src/js/main.js FC). */
const HL_SWATCHES = Object.entries(HL_COLORS).map(([k, v]) => ({
  value: k,
  name: k.replace(/([A-Z])/g, " $1").toLowerCase(),
  css: `#${v}`,
}));
const FC_SWATCHES = (
  [
    ["#c00000", "dark red"],
    ["#e36c09", "orange"],
    ["#bf8f00", "dark yellow"],
    ["#1a7f37", "green"],
    ["#0f766e", "teal"],
    ["#2563eb", "blue"],
    ["#1f3a5f", "navy"],
    ["#6d28d9", "violet"],
    ["#c026d3", "magenta"],
    ["#64748b", "slate"],
    ["#111827", "ink"],
    ["#000000", "black"],
  ] as const
).map(([c, name]) => ({ value: c, name, css: c }));

/* Text shading — the dialect's `bg=` span attribute. No classic toolbar tool
   existed for it, so the palette is designed here: soft paper tints that keep
   AA text contrast underneath, plus the same custom mixer the colour tool has. */
const BG_SWATCHES = (
  [
    ["#fff3b0", "soft yellow"],
    ["#ffe28a", "manila"],
    ["#fde2cf", "peach"],
    ["#fbd3d0", "rose"],
    ["#e6d7f5", "lilac"],
    ["#d7e3fa", "powder blue"],
    ["#d2ecec", "aqua"],
    ["#d9efd7", "mint"],
    ["#eae6da", "parchment"],
    ["#e4e7eb", "fog"],
  ] as const
).map(([c, name]) => ({ value: c, name, css: c }));

/* The shading glyph is a filled specimen — explicit ink over the tint so the
   night desk's grey button text never lands on the light manila. */
const bgGlyph = (
  <span className="rounded-[1px] px-0.5" style={{ background: "#ffe28a", color: "#1a1a17" }}>
    A
  </span>
);

/* ---------------- typeface & size (classic #tbFont / #tbSize) ----------------
   The classic fontOptionsHtml("toolbar") grammar, ported: a "Typeface…"
   placeholder, the Embedded optgroup (option value = face.name), then the five
   Word specimen-book groups (value = plain family name — no "sys:" prefix in
   the toolbar kind). JSX closes every optgroup by construction — the classic
   string builder's unclosed-optgroup trap cannot recur. Engine values arrive
   at runtime through globalThis.Engine (assigned by bootstrap); only TYPES are
   imported from @docforge/engine. Until boot the select renders disabled. */

/* Mirrors packages/engine/src/themes.ts WordFontKind — the union is not
   re-exported from the frozen package index, so the chrome keeps a copy
   (same pattern as editor-commands' HL_COLORS mirror). */
type WordFontKind = "sans" | "serif" | "mono" | "script" | "display";

interface FaceInfo {
  name: string;
  kind: "sans" | "serif";
  label: string;
}
interface FontCatalog {
  faces: Record<string, FaceInfo>;
  words: ReadonlyArray<readonly [string, WordFontKind]>;
}
/** The slice of the classic Engine global this toolbar reads. */
interface EngineFontApi {
  FACES: Record<string, FaceInfo>;
  WORD_CATALOG: ReadonlyArray<readonly [string, WordFontKind]>;
}

const WORD_GROUPS: ReadonlyArray<readonly [WordFontKind, string]> = [
  ["sans", "Word · Sans serif"],
  ["serif", "Word · Serif"],
  ["mono", "Word · Monospace"],
  ["script", "Word · Script & handwriting"],
  ["display", "Word · Display & titling"],
];

/* Is this family actually available to the renderer? document.fonts.check()
   cannot answer that (Chromium says yes to every unknown name), so measure: a
   probe string laid out in the family with a generic behind it moves in width
   if the family resolves. Three generics with very different metrics, cached —
   the classic fontInstalled, ported. */
const fontInstalled = (() => {
  const cache = new Map<string, boolean>();
  const GENERIC = ["monospace", "sans-serif", "serif"];
  const PROBE = "mmmmmmmmmmlliWWMMwi0Oo—“”";
  let ctx: CanvasRenderingContext2D | null | undefined;
  let base: number[] = [];
  const width = (font: string): number => {
    (ctx as CanvasRenderingContext2D).font = font;
    return (ctx as CanvasRenderingContext2D).measureText(PROBE).width;
  };
  return (name: string): boolean => {
    if (ctx === undefined) {
      try {
        ctx = document.createElement("canvas").getContext("2d");
      } catch {
        ctx = null;
      }
      if (ctx) base = GENERIC.map((g) => width(`72px ${g}`));
    }
    if (!ctx) return true;
    const key = String(name || "");
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const q = `"${key.replace(/["\\]/g, "")}"`;
    const found = GENERIC.some((g, i) => width(`72px ${q}, ${g}`) !== base[i]);
    cache.set(key, found);
    return found;
  };
})();

/** Read the font catalogue off globalThis.Engine; if the studio has not booted
    yet, await the shared loadStudio() promise (idempotent) and read again. */
function useFontCatalog(): FontCatalog | null {
  const [catalog, setCatalog] = useState<FontCatalog | null>(null);
  useEffect(() => {
    let alive = true;
    const grab = (): boolean => {
      const eng = (globalThis as Record<string, unknown>).Engine as EngineFontApi | undefined;
      if (!eng?.FACES || !eng.WORD_CATALOG) return false;
      setCatalog({ faces: eng.FACES, words: eng.WORD_CATALOG });
      return true;
    };
    if (grab()) return;
    loadStudio()
      .then(() => {
        if (alive) grab();
      })
      .catch(() => {
        /* boot failed — the selects simply stay disabled */
      });
    return () => {
      alive = false;
    };
  }, []);
  return catalog;
}

/* The inline select — DESIGN.md "Ruled trays": a hairline box on --bg3, square,
   ink-2 warming to ink on hover, printed-form grease-pencil focus border. 13px,
   NOT the classic 11.5px (ledger issue #3). The native select keeps its own
   tab stop and arrow-key semantics — it does not join Radix's roving tabindex
   (a roving item would steal the arrows a closed select needs). */
const SEL =
  "h-7 shrink-0 cursor-pointer rounded-desk border border-line bg-tray px-1 text-[13px] " +
  "text-ink-2 outline-none transition-colors duration-[160ms] ease-desk hover:text-ink " +
  "focus:border-press disabled:cursor-default disabled:opacity-55 pointer-coarse:h-9";

function FontSelect({
  catalog,
  onPick,
}: {
  catalog: FontCatalog | null;
  onPick: (name: string) => void;
}) {
  return (
    <select
      aria-label="Typeface for the selected text"
      className={`${SEL} max-w-[150px]`}
      value=""
      disabled={!catalog}
      onChange={(e) => {
        // The classic snap-back: apply, then rest at the placeholder again.
        const v = e.target.value;
        e.target.value = "";
        if (v) onPick(v);
      }}
    >
      <option value="">Typeface…</option>
      {catalog ? (
        <>
          <optgroup label="Embedded — travel inside the file">
            {Object.entries(catalog.faces).map(([key, face]) => (
              <option key={key} value={face.name}>
                {face.label}
              </option>
            ))}
          </optgroup>
          {WORD_GROUPS.map(([kind, glabel]) => (
            <optgroup key={kind} label={glabel}>
              {catalog.words
                .filter(([, k]) => k === kind)
                .map(([name]) => (
                  <option key={name} value={name}>
                    {name}
                    {fontInstalled(name) ? "" : " · not on this device"}
                  </option>
                ))}
            </optgroup>
          ))}
        </>
      ) : null}
    </select>
  );
}

/* The classic size ladder, verbatim (src/js/main.js buildFontSelects). */
const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48] as const;

function SizeSelect({ onPick }: { onPick: (pt: string) => void }) {
  return (
    <select
      aria-label="Size for the selected text"
      className={`${SEL} max-w-[76px]`}
      value=""
      onChange={(e) => {
        const v = e.target.value;
        e.target.value = "";
        if (v) onPick(v);
      }}
    >
      <option value="">Size…</option>
      {SIZES.map((n) => (
        <option key={n} value={n}>
          {n} pt
        </option>
      ))}
    </select>
  );
}

/* ---------------- the toolbar ---------------- */

export function FormatToolbar({ view }: { view: EditorView | null }) {
  const catalog = useFontCatalog();
  // Dispatch into the live editor, then hand focus back to the writing surface.
  const pick = (cmd: Command) => {
    if (!view) return;
    cmd(view);
    view.focus();
  };
  const run = (cmd: Command) => () => pick(cmd);

  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={500}>
      <Toolbar.Root
        aria-label="Formatting"
        orientation="horizontal"
        loop
        className="flex flex-col gap-1 bg-desk p-2"
        style={{ backgroundImage: "var(--grain)" }}
      >
        <Row>
          <Tray label="Headings">
            <Tool label="Heading 1" shortcut={`${MOD}1`} run={run(toggleH1)}>
              H1
            </Tool>
            <Tool label="Heading 2" shortcut={`${MOD}2`} run={run(toggleH2)}>
              H2
            </Tool>
            <Tool label="Heading 3" shortcut={`${MOD}3`} run={run(toggleH3)}>
              H3
            </Tool>
          </Tray>
          <Tray label="Marks">
            <Tool label="Bold" shortcut={`${MOD}B`} run={run(toggleBold)}>
              <b className="font-bold">B</b>
            </Tool>
            <Tool label="Italic" shortcut={`${MOD}I`} run={run(toggleItalic)}>
              <i>I</i>
            </Tool>
            <Tool label="Underline" shortcut={`${MOD}U`} run={run(toggleUnderline)}>
              <span style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>U</span>
            </Tool>
            <Tool label="Strikethrough" shortcut={`${MODSHIFT}X`} run={run(toggleStrike)}>
              <span style={{ textDecoration: "line-through" }}>S</span>
            </Tool>
            <Tool label="Inline code" shortcut={`${MOD}E`} run={run(toggleCode)}>
              {ic.code}
            </Tool>
            <Tool label="Subscript" run={run(toggleSub)}>
              x₂
            </Tool>
            <Tool label="Superscript" run={run(toggleSup)}>
              x²
            </Tool>
          </Tray>
          <Tray label="Colour and case">
            <SwatchMenu
              label="Highlight"
              title="Highlighter"
              glyph={hlGlyph}
              shortcut={`${MODSHIFT}H`}
              swatches={HL_SWATCHES}
              onPick={(name) => pick(setHighlight(name))}
            />
            <SwatchMenu
              label="Text colour"
              title="Text colour"
              glyph={fcGlyph}
              swatches={FC_SWATCHES}
              custom
              onPick={(hex) => pick(setTextColor(hex))}
            />
            <SwatchMenu
              label="Text shading"
              title="Text shading"
              glyph={bgGlyph}
              swatches={BG_SWATCHES}
              custom
              onPick={(hex) => pick(setTextBg(hex))}
            />
            <Tool label="Change case (UPPER → lower → Title)" run={run(cycleCase)}>
              Aa
            </Tool>
            <Tool label="Clear formatting" run={run(clearFormatting)}>
              T✕
            </Tool>
          </Tray>
          <Tray label="Alignment">
            <Tool label="Align left" run={run(alignLeft)}>
              {ic.alignLeft}
            </Tool>
            <Tool label="Centre" run={run(alignCenter)}>
              {ic.alignCenter}
            </Tool>
            <Tool label="Align right" run={run(alignRight)}>
              {ic.alignRight}
            </Tool>
            <Tool label="Justify" run={run(alignJustify)}>
              {ic.alignJustify}
            </Tool>
          </Tray>
        </Row>
        <Row>
          <Tray label="Type">
            <FontSelect catalog={catalog} onPick={(name) => pick(setTextFont(name))} />
            <SizeSelect onPick={(pt) => pick(setTextSize(pt))} />
          </Tray>
          <Tray label="Lists">
            <Tool label="Bullet list" run={run(toggleBulletList)}>
              {ic.ul}
            </Tool>
            <Tool label="Numbered list" run={run(toggleNumberList)}>
              {ic.ol}
            </Tool>
            <Tool label="Quote" run={run(toggleQuote)}>
              {ic.quote}
            </Tool>
            <Tool label="Divider" run={run(insertDivider)}>
              —
            </Tool>
            <Tool label="Link" shortcut={`${MOD}K`} run={run(insertLink)}>
              {ic.link}
            </Tool>
          </Tray>
          <Tray label="Insert">
            <Tool label="Table" run={run(insertTable)}>
              {ic.table}
            </Tool>
            <Tool label="Equation" run={run(insertEquation)}>
              ∑
            </Tool>
            <Tool label="Footnote" run={run(insertFootnote)}>
              f¹
            </Tool>
            <Tool label="Citation" run={run(insertCitation)}>
              [@]
            </Tool>
            <Tool label="Callout (note / tip / warning)" run={run(insertCallout)}>
              {ic.callout}
            </Tool>
            <Tool label="Code block" run={run(insertCodeBlock)}>
              {ic.codeblock}
            </Tool>
          </Tray>
          <Tray label="Figures">
            <Tool label="Screenshot placeholder" run={run(insertFigure)}>
              {ic.shot}
            </Tool>
            <ImageTool view={view} />
          </Tray>
          <Tray label="Structure">
            <Tool label="Table of contents" run={run(insertToc)}>
              TOC
            </Tool>
            <Tool label="Page break" run={run(insertPagebreak)}>
              {ic.pagebreak}
            </Tool>
          </Tray>
        </Row>
      </Toolbar.Root>
    </Tooltip.Provider>
  );
}
