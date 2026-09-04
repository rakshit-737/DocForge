"use client";
/* The settings drawer — the classic #settings aside rebuilt as a Radix Dialog
   that slides in from the right: a ruled tray on the desk, not a modal card.
   Non-modal on purpose (the classic drawer let you keep working while it was
   open, and settings changes want a live preview), so there is no scrim and
   outside interaction is not a dismissal; Esc closes it and Radix restores
   focus to the opener.

   Ledger fixes carried by construction:
   - §3.1 toggles: the checkbox is visually hidden, never display:none — it
     keeps tab order and the a11y tree; the track wears its focus ring.
   - §3.1 swatches: real <button aria-pressed aria-label> elements.
   - A5: every interactive control reads at ≥12px (selects at 13px so native
     option text inherits it too).
   Every field writes through useDocStore.patchSettings — the store owns the
   classic accent-follows-theme behaviour. */
import * as Dialog from "@radix-ui/react-dialog";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { loadStudio } from "@/lib/bootstrap";
import { toast } from "@/lib/find";
import type { Settings } from "@/lib/settings";
import { useDocStore } from "@/lib/store";
import {
  deletePreset,
  listPresets,
  parsePreset,
  savePreset,
  serialisePreset,
  storePreset,
  type ThemePreset,
} from "@/lib/theme-presets";
import { type UserFont, userFaceEntries, useUserFonts } from "@/lib/user-fonts";

/* ---------- drawer state — the shell (and later the palette) opens it ---------- */
interface SettingsDrawerState {
  open: boolean;
  /** One-shot: focus the Title field on open (the masthead doc-title path). */
  focusTitle: boolean;
  setOpen: (open: boolean) => void;
  openDrawer: (focus?: "title") => void;
  toggle: () => void;
}
export const useSettingsDrawer = create<SettingsDrawerState>((set) => ({
  open: false,
  focusTitle: false,
  setOpen: (open) => set((s) => ({ open, focusTitle: open ? s.focusTitle : false })),
  openDrawer: (focus) => set({ open: true, focusTitle: focus === "title" }),
  toggle: () => set((s) => ({ open: !s.open, focusTitle: false })),
}));

/* ---------- shared desk grammar ---------- */
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";
/* Printed-form fields: a ruled hairline box, not a soft well — focus swaps the
   rule for the grease pencil (the classic .field focus site). */
const CONTROL =
  "w-full rounded-desk border border-line bg-tray p-2 text-[13px] text-ink outline-none focus:border-press";
/* The one micro-caps role in the chrome: settings group labels, each set over
   its own structural ink rule — the style sheet's running heads. */
const GROUP_HEAD =
  "mb-3 border-b border-rule pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-2";

/* ---------- data (labels verbatim from src/index.html) ---------- */
const THEME_OPTIONS = [
  ["modern", "Modern — clean sans"],
  ["executive", "Executive — serif headings"],
  ["academic", "Academic — classic serif"],
  ["minimal", "Minimal — quiet & spare"],
] as const;
const ACCENTS = [
  ["#1f3a5f", "Accent: deep navy"],
  ["#2563eb", "Accent: blue"],
  ["#0f766e", "Accent: teal"],
  ["#15803d", "Accent: green"],
  ["#7f1d1d", "Accent: maroon"],
  ["#6d28d9", "Accent: violet"],
  ["#334155", "Accent: slate"],
  ["#111827", "Accent: ink black"],
] as const;
const PAGE_OPTIONS = [
  ["A4", "A4"],
  ["Letter", "Letter"],
] as const;
const MARGIN_OPTIONS = [
  ["normal", "Normal"],
  ["narrow", "Narrow"],
  ["wide", "Wide"],
] as const;
const BASE_SIZE_OPTIONS = [
  ["10", "10 pt"],
  ["10.5", "10.5 pt"],
  ["11", "11 pt"],
  ["11.5", "11.5 pt"],
  ["12", "12 pt"],
  ["13", "13 pt"],
] as const;
const LINE_SPACING_OPTIONS = [
  ["default", "Default"],
  ["1", "Single"],
  ["1.15", "1.15"],
  ["1.5", "1.5"],
  ["2", "Double"],
] as const;
const BORDER_STYLE_OPTIONS = [
  ["none", "None"],
  ["rule", "Rule — single line"],
  ["double", "Double"],
  ["triple", "Triple"],
  ["dashed", "Dashed"],
  ["dotted", "Dotted"],
  ["thickthin", "Thick–thin"],
  ["thinthick", "Thin–thick"],
] as const;
const BORDER_WEIGHT_OPTIONS = [
  ["fine", "Fine"],
  ["medium", "Medium"],
  ["bold", "Bold"],
] as const;
const BORDER_COLOR_OPTIONS = [
  ["ink", "Ink"],
  ["accent", "Accent"],
] as const;
const CITE_OPTIONS = [
  ["ieee", "Numeric — [1], IEEE-style"],
  ["apa", "Author–year — (Smith, 2020)"],
  ["apa7", "Author–year — APA 7, disambiguated"],
] as const;
const WORD_GROUPS = [
  ["sans", "Word · Sans serif"],
  ["serif", "Word · Serif"],
  ["mono", "Word · Monospace"],
  ["script", "Word · Script & handwriting"],
  ["display", "Word · Display & titling"],
] as const;

type ToggleKey = "cover" | "header" | "pageNums" | "numbered" | "justify" | "h1break" | "hardWrap";
const TOGGLES: Array<{ id: string; key: ToggleKey; label: string; hint?: string }> = [
  { id: "tCover", key: "cover", label: "Cover page" },
  { id: "tHeader", key: "header", label: "Header (running title)" },
  { id: "tPageNums", key: "pageNums", label: "Page numbers" },
  { id: "tNumbered", key: "numbered", label: "Numbered headings (1.2.3)" },
  { id: "tJustify", key: "justify", label: "Justify paragraphs" },
  { id: "tH1break", key: "h1break", label: "Each section on a new page" },
  {
    id: "tHardWrap",
    key: "hardWrap",
    label: "Every line break is a new line",
    hint: "(addresses, verse)",
  },
];

/* ---------- the engine's font catalogue, loaded through the bootstrap ----------
   @docforge/engine registers marked extensions at import time, so it must only
   ever arrive via loadStudio() (the preview has usually resolved it already —
   this await is effectively free). */
interface FaceInfo {
  name: string;
  kind: "sans" | "serif";
  label: string;
}
interface FontCatalog {
  faces: Record<string, FaceInfo>;
  words: ReadonlyArray<readonly [string, string]>;
}

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

/* ---------- small pieces ---------- */
function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-xs text-ink-2">
        {label}
        {hint ? <span className="opacity-60"> {hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <Field id={id} label={label}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={CONTROL}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}

function FontSelect({
  id,
  label,
  value,
  catalog,
  onPick,
}: {
  id: string;
  label: string;
  value: string;
  catalog: FontCatalog | null;
  onPick: (v: string, el: HTMLSelectElement) => void;
}) {
  /* A saved custom family ("sys:Whatever") must exist as an option or the
     select snaps back to the first entry (classic ensureFontOption); before the
     catalogue lands, the current value gets a placeholder option for the same
     reason. */
  let extra: { value: string; label: string } | null = null;
  if (!catalog) {
    if (value && value !== "theme") {
      extra = { value, label: value.startsWith("sys:") ? value.slice(4) : value };
    }
  } else if (value.startsWith("sys:") && !catalog.words.some(([n]) => `sys:${n}` === value)) {
    const fam = value.slice(4);
    extra = { value, label: `${fam} (custom)${fontInstalled(fam) ? "" : " · not on this device"}` };
  }
  return (
    <Field id={id} label={label}>
      <select
        id={id}
        value={value}
        onChange={(e) => onPick(e.target.value, e.target)}
        className={CONTROL}
      >
        <option value="theme">Theme default</option>
        {catalog ? (
          <optgroup label="Embedded — travel inside the file">
            {Object.entries(catalog.faces).map(([key, face]) => (
              <option key={key} value={key}>
                {face.label}
              </option>
            ))}
          </optgroup>
        ) : null}
        {catalog
          ? WORD_GROUPS.map(([kind, glabel]) => (
              <optgroup key={kind} label={glabel}>
                {catalog.words
                  .filter(([, k]) => k === kind)
                  .map(([name]) => (
                    <option key={name} value={`sys:${name}`}>
                      {name}
                      {fontInstalled(name) ? "" : " · not on this device"}
                    </option>
                  ))}
              </optgroup>
            ))
          : null}
        {extra ? <option value={extra.value}>{extra.label}</option> : null}
        {catalog ? <option value="custom">Custom family…</option> : null}
      </select>
    </Field>
  );
}

/* The classic .toggle/.tg, ported: recessed track (a true well), square ink
   knob, checked track fills with ink. The checkbox is visually hidden — never
   display:none — and its focus draws the ring on the track. */
function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="relative flex cursor-pointer select-none items-center justify-between gap-2 py-1"
    >
      <span className="text-[12.8px] text-ink">
        {label}
        {hint ? <span className="opacity-60"> {hint}</span> : null}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer pointer-events-none absolute h-px w-px opacity-0"
      />
      <span
        aria-hidden="true"
        className="relative h-[22px] w-10 flex-none rounded-menu bg-desk shadow-[var(--recess)] transition-colors duration-[160ms] ease-out after:absolute after:left-[3px] after:top-[3px] after:h-4 after:w-4 after:rounded-desk after:bg-ink-3 after:transition-[left,background-color] after:duration-[160ms] after:ease-out after:content-[''] peer-checked:bg-ink peer-checked:after:left-[21px] peer-checked:after:bg-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-focus"
      />
    </label>
  );
}

/* ---------- saved house styles (§8.2) ---------- */

function ThemeShelf() {
  const settings = useDocStore((s) => s.settings);
  const patch = useDocStore((s) => s.patchSettings);
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => setPresets(await listPresets()), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    const preset = await savePreset(name || "My house style", settings);
    setName("");
    await refresh();
    toast(`“${preset.name}” saved — apply it to any document`, "info", 4500);
  };

  const apply = (preset: ThemePreset) => {
    /* Only the look moves. The document's title, author and date are its own,
       and a saved style must never carry someone else's into it. */
    patch(preset.look as Partial<Settings>);
    toast(`“${preset.name}” applied`);
  };

  const share = (preset: ThemePreset) => {
    const blob = new Blob([serialisePreset(preset)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${preset.name.replace(/[^\w-]+/g, "-").slice(0, 40) || "theme"}.docforge-theme.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const take = async (file: File | undefined) => {
    if (!file) return;
    try {
      const preset = parsePreset(await file.text());
      await storePreset(preset);
      await refresh();
      toast(`“${preset.name}” added to your styles`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "That theme file could not be read", "warn", 5000);
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="mt-3">
      <p className="m-0 mb-1.5 text-[11.5px] leading-[1.5] text-ink-3">
        Save this document&rsquo;s look — theme, accent, page, typefaces, spacing, borders, the
        running head — and apply it to any other. A style carries no title, author or date.
      </p>
      {presets.length > 0 ? (
        <ul className="m-0 mb-2 list-none border border-line p-0">
          {presets.map((p) => (
            <li
              key={p.name}
              className="flex items-center gap-1.5 border-line border-b px-2.5 py-1.5 last:border-b-0"
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-[12.5px] text-ink hover:text-press"
                onClick={() => apply(p)}
                title="Apply this look to the current document"
              >
                {p.name}
              </button>
              <button
                type="button"
                className="btn-quiet shrink-0"
                onClick={() => share(p)}
                title="Save it as a file to share"
              >
                Share
              </button>
              <button
                type="button"
                className="btn-quiet shrink-0"
                onClick={async () => {
                  await deletePreset(p.name);
                  await refresh();
                }}
                title={`Forget ${p.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
          placeholder="Name this look"
          aria-label="Name for the saved look"
          className="h-7 min-w-0 flex-1 border border-line bg-tray px-2 text-[12.5px] text-ink placeholder:text-ink-3"
        />
        <button type="button" className="btn-tray border border-line" onClick={() => void save()}>
          Save
        </button>
        <button
          type="button"
          className="btn-quiet"
          onClick={() => input.current?.click()}
          title="Add a style someone shared with you"
        >
          Add a file…
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void take(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

/* ---------- the reader's own typefaces (§8.2) ---------- */

function UserFontShelf() {
  const fonts = useUserFonts((s) => s.fonts);
  const add = useUserFonts((s) => s.add);
  const remove = useUserFonts((s) => s.remove);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const take = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const font = await add(file);
      const cuts = Object.keys(font.cuts).length;
      toast(
        `“${font.name}” installed — ${cuts} cut${cuts === 1 ? "" : "s"}. It travels inside your Word exports`,
        "info",
        5000,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "That font could not be read", "warn", 6000);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="mt-3">
      <p className="m-0 mb-1.5 text-[11.5px] text-ink-3">
        Your typefaces — embedded in the preview, the PDF <i>and</i> the Word file
      </p>
      {fonts.length > 0 ? (
        <ul className="m-0 mb-2 list-none border border-line p-0">
          {fonts.map((f: UserFont) => (
            <li
              key={f.name}
              className="flex items-center gap-2 border-line border-b px-2.5 py-1.5 last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{f.name}</span>
              <span className="shrink-0 font-mono text-[10.5px] text-ink-3">
                {Object.keys(f.cuts).length} cut{Object.keys(f.cuts).length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="btn-quiet shrink-0"
                onClick={() => void remove(f.name)}
                title={`Remove ${f.name} from this device`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        className="btn-tray"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Reading…" : "Add a typeface…"}
      </button>
      <input
        ref={input}
        type="file"
        accept=".ttf,.otf,font/ttf,font/otf"
        className="hidden"
        onChange={(e) => void take(e.target.files?.[0])}
      />
    </div>
  );
}

/* ---------- the drawer ---------- */
export function SettingsDrawer() {
  const open = useSettingsDrawer((s) => s.open);
  const setOpen = useSettingsDrawer((s) => s.setOpen);
  const settings = useDocStore((s) => s.settings);
  const patch = useDocStore((s) => s.patchSettings);
  const [catalog, setCatalog] = useState<FontCatalog | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  /* The reader's own families come from the store rather than from a second
     read of Engine.FACES, so a font installed mid-session appears in the
     pickers the moment it lands (§8.2). */
  const userFonts = useUserFonts((s) => s.fonts);
  const withUserFaces = useMemo(
    () =>
      catalog
        ? { ...catalog, faces: { ...catalog.faces, ...userFaceEntries(userFonts) } }
        : catalog,
    [catalog, userFonts],
  );

  useEffect(() => {
    let alive = true;
    loadStudio()
      .then(({ Engine }) => {
        if (alive) setCatalog({ faces: { ...Engine.FACES }, words: Engine.WORD_CATALOG });
      })
      .catch(() => {
        /* the drawer still works — the selects just stay at "Theme default" */
      });
    return () => {
      alive = false;
    };
  }, []);

  const pickFont = (key: "fontHead" | "fontBody") => (v: string, el: HTMLSelectElement) => {
    if (v === "custom") {
      const name = (
        window.prompt("Font family name, exactly as installed (e.g. Segoe UI Semibold):", "") || ""
      ).trim();
      if (!name) {
        el.value = String(settings[key]); // controlled value; snap the DOM back
        return;
      }
      patch({ [key]: `sys:${name}` });
      return;
    }
    patch({ [key]: v });
  };

  const text = (
    id: string,
    key: keyof Settings & string,
    label: string,
    placeholder: string,
    hint?: string,
  ) => (
    <Field id={id} label={label} hint={hint}>
      <input
        id={id}
        ref={key === "title" ? titleInput : undefined}
        type="text"
        value={String(settings[key] ?? "")}
        placeholder={placeholder}
        onChange={(e) => patch({ [key]: e.target.value })}
        className={CONTROL}
      />
    </Field>
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => {
            if (useSettingsDrawer.getState().focusTitle) {
              e.preventDefault();
              requestAnimationFrame(() => titleInput.current?.focus());
              useSettingsDrawer.setState({ focusTitle: false });
            }
          }}
          className="fixed inset-y-0 right-0 z-40 flex w-[min(300px,94vw)] flex-col bg-surface bg-[image:var(--grain)] shadow-[var(--elev-l)] outline-none"
          style={{ animation: "df-drawer-in var(--dur2) var(--ease)" }}
        >
          <style>{`
            @keyframes df-drawer-in { from { transform: translateX(24px); opacity: 0; } }
            .df-accent-well::-webkit-color-swatch-wrapper { padding: 0; }
            .df-accent-well::-webkit-color-swatch { border: 0; border-radius: var(--rm); }
            .df-accent-well::-moz-color-swatch { border: 0; border-radius: var(--rm); }
          `}</style>

          <div className="flex flex-none items-center justify-between border-b border-line px-5 py-3">
            <Dialog.Title className="font-display text-base font-normal text-ink">
              Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close settings"
                className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-desk text-ink-2 transition-colors duration-[160ms] ease-out hover:bg-tray hover:text-ink ${FOCUS_RING}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-3">
            <h3 className={`mt-1 ${GROUP_HEAD}`}>Document</h3>
            {text("sTitle", "title", "Title", "Document title")}
            {text("sSubtitle", "subtitle", "Subtitle", "One-line description")}
            {text("sAuthor", "author", "Author", "Your name")}
            {text("sKicker", "kicker", "Top label", "e.g. CS-101 · Sem 4", "(course / company)")}
            {text("sMetaExtra", "metaExtra", "Extra line", "e.g. Roll No. 42", "(roll no / email)")}
            <Field id="sDate" label="Date">
              <input
                id="sDate"
                type="date"
                value={settings.date}
                onChange={(e) => patch({ date: e.target.value })}
                className={CONTROL}
              />
            </Field>

            <h3 className={`mt-6 ${GROUP_HEAD}`}>Style</h3>
            <SelectField
              id="sTheme"
              label="Theme"
              value={settings.theme}
              options={THEME_OPTIONS}
              onChange={(v) => patch({ theme: v })}
            />
            <fieldset className="mb-3 min-w-0 border-0 p-0">
              <legend className="mb-1 block p-0 text-xs text-ink-2">Accent colour</legend>
              <div className="flex flex-wrap items-center gap-1">
                {ACCENTS.map(([c, label]) => {
                  const on = settings.accent === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-label={label}
                      aria-pressed={on}
                      onClick={() => patch({ accent: c })}
                      style={{ background: c }}
                      className={`h-[22px] w-[22px] cursor-pointer rounded-menu border-2 p-0 transition-transform duration-[160ms] ease-out hover:scale-[1.12] ${FOCUS_RING} ${
                        on ? "border-surface shadow-[0_0_0_2px_var(--tx)]" : "border-transparent"
                      }`}
                    />
                  );
                })}
                {/* the custom colour well is a peer swatch — a hairline ink
                    ring is what says "this one you mix yourself" */}
                <input
                  type="color"
                  aria-label="Custom accent colour"
                  title="Custom colour"
                  value={settings.accent}
                  onChange={(e) => patch({ accent: e.target.value })}
                  className={`df-accent-well h-[22px] w-[22px] cursor-pointer rounded-menu border-0 bg-transparent p-0 shadow-[0_0_0_1px_var(--rule)] ${FOCUS_RING}`}
                />
              </div>
            </fieldset>
            <div className="flex gap-2 [&>div]:flex-1 [&>div]:min-w-0">
              <SelectField
                id="sPage"
                label="Page size"
                value={settings.page}
                options={PAGE_OPTIONS}
                onChange={(v) => patch({ page: v })}
              />
              <SelectField
                id="sMargins"
                label="Margins"
                value={settings.margins}
                options={MARGIN_OPTIONS}
                onChange={(v) => patch({ margins: v })}
              />
            </div>

            <details className="group mt-6" open>
              <summary
                className={`flex cursor-pointer select-none list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden ${GROUP_HEAD} ${FOCUS_RING}`}
              >
                Typography
                <span
                  aria-hidden="true"
                  className="ml-auto mr-1 h-[7px] w-[7px] -rotate-45 border-b-[1.5px] border-r-[1.5px] border-ink-3 transition-transform duration-[160ms] ease-out group-open:rotate-45"
                />
              </summary>
              <FontSelect
                id="sFontHead"
                label="Headings typeface"
                value={settings.fontHead}
                catalog={withUserFaces}
                onPick={pickFont("fontHead")}
              />
              <FontSelect
                id="sFontBody"
                label="Body typeface"
                value={settings.fontBody}
                catalog={withUserFaces}
                onPick={pickFont("fontBody")}
              />
              <UserFontShelf />
              <div className="flex gap-2 [&>div]:flex-1 [&>div]:min-w-0">
                <SelectField
                  id="sBaseSize"
                  label="Base font size"
                  value={settings.baseSize}
                  options={BASE_SIZE_OPTIONS}
                  onChange={(v) => patch({ baseSize: v })}
                />
                <SelectField
                  id="sLineSpacing"
                  label="Line spacing"
                  value={settings.lineSpacing}
                  options={LINE_SPACING_OPTIONS}
                  onChange={(v) => patch({ lineSpacing: v })}
                />
              </div>
            </details>

            <details className="group mt-6">
              <summary
                className={`flex cursor-pointer select-none list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden ${GROUP_HEAD} ${FOCUS_RING}`}
              >
                Border &amp; citations
                <span
                  aria-hidden="true"
                  className="ml-auto mr-1 h-[7px] w-[7px] -rotate-45 border-b-[1.5px] border-r-[1.5px] border-ink-3 transition-transform duration-[160ms] ease-out group-open:rotate-45"
                />
              </summary>
              <SelectField
                id="sBorderStyle"
                label="Page border"
                value={settings.borderStyle}
                options={BORDER_STYLE_OPTIONS}
                onChange={(v) => patch({ borderStyle: v })}
              />
              <div className="flex gap-2 [&>div]:flex-1 [&>div]:min-w-0">
                <SelectField
                  id="sBorderWeight"
                  label="Border weight"
                  value={settings.borderWeight}
                  options={BORDER_WEIGHT_OPTIONS}
                  onChange={(v) => patch({ borderWeight: v })}
                />
                <SelectField
                  id="sBorderColor"
                  label="Border colour"
                  value={settings.borderColor}
                  options={BORDER_COLOR_OPTIONS}
                  onChange={(v) => patch({ borderColor: v })}
                />
              </div>
              <SelectField
                id="sCiteStyle"
                label="Citation style"
                value={settings.citeStyle}
                options={CITE_OPTIONS}
                onChange={(v) => patch({ citeStyle: v })}
              />
            </details>

            <details className="group mt-6">
              <summary
                className={`flex cursor-pointer select-none list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden ${GROUP_HEAD} ${FOCUS_RING}`}
              >
                Running header &amp; footer
                <span
                  aria-hidden="true"
                  className="ml-auto mr-1 h-[7px] w-[7px] -rotate-45 border-b-[1.5px] border-r-[1.5px] border-ink-3 transition-transform duration-[160ms] ease-out group-open:rotate-45"
                />
              </summary>
              <p className="mb-2.5 text-[11.5px] leading-[1.5] text-ink-3">
                Leave these empty for the house style — the title at the head&rsquo;s left, the
                current section at its right. Tokens: <code>{"{title}"}</code>{" "}
                <code>{"{author}"}</code> <code>{"{date}"}</code> <code>{"{kicker}"}</code>{" "}
                <code>{"{section}"}</code>. Page numbers stay in the footer&rsquo;s centre, the one
                place both the PDF and Word can count the front matter and the body separately.
              </p>
              <div className="flex gap-2 [&>div]:flex-1 [&>div]:min-w-0">
                <Field id="sHeaderLeft" label="Header, left">
                  <input
                    id="sHeaderLeft"
                    type="text"
                    className={CONTROL}
                    placeholder="{title}"
                    value={String(settings.headerLeft ?? "")}
                    onChange={(e) => patch({ headerLeft: e.target.value })}
                  />
                </Field>
                <Field id="sHeaderRight" label="Header, right">
                  <input
                    id="sHeaderRight"
                    type="text"
                    className={CONTROL}
                    placeholder="{section}"
                    value={String(settings.headerRight ?? "")}
                    onChange={(e) => patch({ headerRight: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex gap-2 [&>div]:flex-1 [&>div]:min-w-0">
                <Field id="sFooterLeft" label="Footer, left">
                  <input
                    id="sFooterLeft"
                    type="text"
                    className={CONTROL}
                    placeholder="—"
                    value={String(settings.footerLeft ?? "")}
                    onChange={(e) => patch({ footerLeft: e.target.value })}
                  />
                </Field>
                <Field id="sFooterRight" label="Footer, right">
                  <input
                    id="sFooterRight"
                    type="text"
                    className={CONTROL}
                    placeholder="—"
                    value={String(settings.footerRight ?? "")}
                    onChange={(e) => patch({ footerRight: e.target.value })}
                  />
                </Field>
              </div>
            </details>

            <h3 className={`mt-6 ${GROUP_HEAD}`}>Saved looks</h3>
            <ThemeShelf />

            <h3 className={`mt-6 ${GROUP_HEAD}`}>Layout</h3>
            {TOGGLES.map((t) => (
              <ToggleRow
                key={t.id}
                id={t.id}
                label={t.label}
                hint={t.hint}
                checked={Boolean(settings[t.key])}
                onChange={(v) => patch({ [t.key]: v })}
              />
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
