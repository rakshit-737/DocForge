"use client";
import type { EditorView } from "@codemirror/view";
/* The equation palette (§8.2) — the symbols a coursework equation needs,
   searchable by the words a student would actually use ("power", "implies",
   "tolerance"), each rendered as it will print. Picking one inserts correct
   LaTeX and leaves the caret where the writing continues; the insert brings
   its own $…$ unless the caret is already inside maths.

   The previews are drawn with the same KaTeX the document uses, so what the
   picker shows and what the page prints cannot drift apart. */
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { loadStudio } from "@/lib/bootstrap";
import { insertSymbol, type MathSymbol, searchSymbols } from "@/lib/equation-palette";

interface KatexLike {
  renderToString(tex: string, opts?: Record<string, unknown>): string;
}

/** One symbol, drawn. KaTeX arrives with the studio, so the tile shows its
    LaTeX until then rather than an empty box. */
function Preview({ tex, katex }: { tex: string; katex: KatexLike | null }) {
  const clean = tex.replace("|", "");
  const html = useMemo(() => {
    if (!katex) return null;
    try {
      return katex.renderToString(clean, { throwOnError: false, displayMode: false });
    } catch {
      return null;
    }
  }, [clean, katex]);
  if (!html) {
    return <span className="font-mono text-[11px] text-ink-3">{clean}</span>;
  }
  /* KaTeX's own output, from a fixed table in this repo — never reader input. */
  // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output for a literal from SYMBOLS
  return <span className="text-[15px] text-ink" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function EquationPalette({
  open,
  onOpenChange,
  view,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: EditorView | null;
}) {
  const [query, setQuery] = useState("");
  const [katex, setKatex] = useState<KatexLike | null>(null);
  const inputId = useId();
  const firstTile = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    loadStudio()
      .then(() => {
        const k = (globalThis as { katex?: KatexLike }).katex;
        if (k) setKatex(k);
      })
      .catch(() => {
        /* the palette still works — the tiles just show their LaTeX */
      });
  }, [open]);

  const results = useMemo(() => searchSymbols(query), [query]);
  const groups = useMemo(() => {
    const out = new Map<string, MathSymbol[]>();
    for (const s of results) {
      const list = out.get(s.group) ?? [];
      list.push(s);
      out.set(s.group, list);
    }
    return [...out.entries()];
  }, [results]);

  const take = (s: MathSymbol) => {
    if (view) insertSymbol(view, s.tex);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-df-motion="fade"
          className="fixed inset-0 z-[60] bg-[rgba(10,8,5,0.72)]"
        />
        <Dialog.Content
          data-df-motion="sheet"
          aria-describedby={undefined}
          /* The search field takes the focus, not the sheet: a picker you can
             start typing into the moment it opens. */
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            search.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-[60] flex max-h-[80vh] w-[min(640px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-modal bg-surface shadow-(--elev-l) outline-none"
        >
          <header className="flex items-center gap-3 border-b border-line px-5 py-4">
            <Dialog.Title className="font-display text-base font-normal text-ink">
              Equation symbols
            </Dialog.Title>
            <input
              id={inputId}
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) {
                  e.preventDefault();
                  take(results[0]);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  firstTile.current?.focus();
                }
              }}
              placeholder="fraction · theta · implies · tolerance…"
              aria-label="Search symbols"
              className="ml-auto h-8 w-64 max-w-[50%] border border-line bg-tray px-2 font-mono text-[12.5px] text-ink placeholder:text-ink-3"
            />
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {groups.length === 0 ? (
              <p className="m-0 text-[12.5px] text-ink-2">
                Nothing matches &ldquo;{query}&rdquo;. Try the shape you want —
                &ldquo;fraction&rdquo;, &ldquo;root&rdquo;, &ldquo;sum&rdquo; — or the
                symbol&rsquo;s name.
              </p>
            ) : (
              groups.map(([group, items], gi) => (
                <section key={group} className="mb-4">
                  <h3 className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
                    {group}
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1.5">
                    {items.map((s, i) => (
                      <button
                        key={s.tex}
                        ref={gi === 0 && i === 0 ? firstTile : undefined}
                        type="button"
                        onClick={() => take(s)}
                        title={s.tex.replace("|", "")}
                        className="flex h-[52px] cursor-pointer flex-col items-center justify-center gap-0.5 border border-line bg-tray px-1 hover:border-rule hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                      >
                        <Preview tex={s.tex} katex={katex} />
                        <span className="w-full truncate text-center text-[10.5px] text-ink-3">
                          {s.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>

          <footer className="border-t border-line px-5 py-2 font-mono text-[11px] text-ink-3">
            Enter takes the first match · a symbol brings its own <code>$…$</code> unless the caret
            is already inside maths
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
