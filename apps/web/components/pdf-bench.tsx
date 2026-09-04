"use client";
/* PDF bench — Phase 3's in-place PDF editor as its own route (/pdf).

   The §3.2 masthead bug ("PDF-bench mode leaves the studio masthead armed")
   is designed out by construction: this route carries no studio controls at
   all — its masthead is the nameplate, a "PDF bench" kicker, a Back-to-studio
   link and the bench's one red plate (Export).

   Contract with @docforge/pdf-editor (read from its source, ported 1:1 from
   the classic build): open(buf, name) calls bindOnce(), which binds DOM by
   the classic load-bearing ids — #pdfEditor #peName #pePages "#peTools
   .pe-tool" #peFont #peSize #peColor #peZoomOut #peZoomPct #peZoomIn
   #peScroll #peDeck #peImgInput — EXACTLY ONCE per JS context (module-level
   `bound` flag; listeners are never rebound). React remounts would strand
   those bindings on dead nodes, so the bench chrome the package binds is a
   module-level singleton subtree, adopted into a ref'd container on mount and
   detached (never destroyed) on unmount. A document left open survives a trip
   back to the studio, exactly like the classic bench survived behind
   body.pdf-mode. The package's document-level keydown handler (Delete/Esc)
   keys off body.classList "pdf-mode" — this route holds that class while
   mounted.

   pdf.js arrives through the classic global contract: the pdf-editor package
   calls the global PdfImport.ensureLib(). Here the npm copies satisfy the
   same globals the importers path probes first — the worker module is
   imported before the main library (its import assigns globalThis.pdfjsWorker
   = { WorkerMessageHandler }, which pdf.js's PDFWorker probes and takes the
   classic main-thread fake-worker path; workerSrc is never consulted), then
   the main build lands on globalThis.pdfjsLib. pdf-lib lands on window.PDFLib
   before the first export, replacing the single-file __PDFLIB_SRC__ string.

   Classic behaviour is the spec: toolbar, toasts and confirm copy ported from
   src/index.html #pdfEditor + src/js/main.js bindPdfEditor()/importFile(). */
import type { PdfEditorApi } from "@docforge/pdf-editor";
import { PageTools, type PageToolsLib } from "@docforge/pdf-editor/page-tools";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ToastRack } from "@/components/find-bar";
import { downloadBlob } from "@/lib/exports";
import { toast } from "@/lib/find";
import { ZoomCluster } from "./zoom-cluster";

/* ---------------- module-level state (survives route remounts) ---------------- */

type Phase = "empty" | "opening" | "open";

let benchRoot: HTMLElement | null = null;
let openDocName: string | null = null;
let pendingFile: File | null = null;
let confirmDelegate: ((title: string, body: string) => Promise<boolean>) | null = null;
let editorLoading: Promise<PdfEditorApi> | null = null;
let editorApi: PdfEditorApi | null = null;

/** Hand-off from the studio's "edit in place" choice: stash the picked File,
    then navigate to /pdf — the bench opens it on mount. Client-side
    navigation shares the JS context, so the module variable carries it. */
export function stashBenchFile(f: File): void {
  pendingFile = f;
}

/* ---------------- pdf.js / pdf-lib globals (the importers contract) ---------------- */

async function ensurePdfJs(): Promise<void> {
  const g = globalThis as unknown as {
    pdfjsLib?: unknown;
    PdfImport?: { ensureLib(): Promise<unknown> };
  };
  if (!g.pdfjsLib) {
    // Worker first, exactly like the classic loader: importing the worker
    // module assigns globalThis.pdfjsWorker = { WorkerMessageHandler }, and
    // with that handler present pdf.js takes the main-thread fake-worker
    // path — no real Worker, no GlobalWorkerOptions.workerSrc needed.
    await import("pdfjs-dist/build/pdf.worker.min.mjs");
    g.pdfjsLib = await import("pdfjs-dist");
  }
  // pdf-editor calls the classic PdfImport.ensureLib() global. Satisfy it
  // with the npm copy — but never clobber the real importers global if the
  // studio's import path installed it first (its ensureLib already prefers
  // window.pdfjsLib, which is set above, so behaviour converges either way).
  g.PdfImport ??= { ensureLib: async () => g.pdfjsLib };
}

async function ensurePdfLib(): Promise<void> {
  // The package's export loader takes window.PDFLib verbatim when present;
  // __PDFLIB_SRC__ is the single-file edition's string path, honoured if set.
  if (window.PDFLib || window.__PDFLIB_SRC__) return;
  window.PDFLib = (await import("pdf-lib")) as unknown as PdfLibNamespace;
}

function loadPdfEditor(): Promise<PdfEditorApi> {
  if (!editorLoading) {
    editorLoading = (async () => {
      await ensurePdfJs();
      const mod = await import("@docforge/pdf-editor");
      // main.js reassigned PdfEditor.hooks wholesale; same move here.
      mod.api.hooks = {
        toast: (msg: string, kind?: string) => toast(msg, kind === "warn" ? "warn" : "info"),
        confirm: (...args: unknown[]) => {
          const title = typeof args[0] === "string" ? args[0] : "Continue?";
          const body = typeof args[1] === "string" ? args[1] : "";
          return confirmDelegate ? confirmDelegate(title, body) : Promise.resolve(true);
        },
      };
      editorApi = mod.api;
      return mod.api;
    })();
    editorLoading.catch(() => {
      editorLoading = null; // a failed load stays retryable
    });
  }
  return editorLoading;
}

/* ---------------- the page toolbox (§8.4) ----------------
   Rotate, delete, reorder, merge, split and number pages — all of it
   client-side, on the bytes.

   Every operation runs on an EXPORT of the current state, not on the file as
   opened: overlay edits are baked in first, the pages are rearranged, and the
   result is re-opened on the bench. That is what keeps the two halves honest
   with each other — a page index can never drift out from under an edit. */

/** Pages currently on the bench, read from the deck the package rendered. */
function benchPageCount(): number {
  return benchRoot ? benchRoot.querySelectorAll(".pe-page").length : 0;
}

/** The studio's zoom instrument, driven by the bench's own scale (ledger I4). */
function BenchZoom() {
  const [pct, setPct] = useState(100);
  useEffect(() => {
    let live = true;
    void loadPdfEditor().then((api) => {
      if (!live) return;
      setPct(Math.round(api.getZoom() * 100));
      api.onZoomChange((z) => setPct(Math.round(z * 100)));
    });
    return () => {
      live = false;
      editorApi?.onZoomChange(null);
    };
  }, []);
  const step = (delta: number) => {
    void loadPdfEditor().then((api) => api.setZoom(api.getZoom() + delta));
  };
  const fit = () => {
    void loadPdfEditor().then((api) => api.fitZoom());
  };
  return <ZoomCluster pct={pct} onStep={step} onFit={fit} label="Zoom the proof" />;
}

function PageToolbar({ onReopened }: { onReopened: () => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ranges, setRanges] = useState("");
  const mergeInput = useRef<HTMLInputElement>(null);

  /* The deck is the package's DOM, so the strip watches it rather than being
     told: every operation that changes the page set re-renders it. */
  useEffect(() => {
    const tick = () => setCount(benchPageCount());
    tick();
    const id = window.setInterval(tick, 900);
    return () => window.clearInterval(id);
  }, []);

  const pages = Array.from({ length: count }, (_, i) => i);
  const chosen = selected.size ? [...selected].sort((a, b) => a - b) : pages;

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  /** Bake the edits, run one operation on the bytes, put the result back on
      the bench. `fn` returns the new document, or null when it handed its own
      output over (the split downloads its parts). */
  const run = useCallback(
    async (
      label: string,
      fn: (lib: PageToolsLib, bytes: Uint8Array, name: string) => Promise<Uint8Array | null>,
    ) => {
      setBusy(true);
      try {
        const api = await loadPdfEditor();
        await ensurePdfLib();
        /* ensurePdfLib only guarantees the global — the vendored single-file
           path never returns a namespace, so the toolbox reads it from where
           both editions put it. */
        const lib = window.PDFLib as unknown as PageToolsLib;
        const { blob, name: exported } = await api.exportPdf();
        /* exportPdf stamps "-edited" on the name; five toolbox passes would
           otherwise leave tools-edited-edited-edited-edited-edited.pdf. */
        const name = exported.replace(/(?:-edited)+(?=\.pdf$)/i, "-edited");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const out = await fn(lib, bytes, name);
        if (out) {
          const buf = new ArrayBuffer(out.byteLength);
          new Uint8Array(buf).set(out);
          await api.open(buf, name);
          setSelected(new Set());
          setCount(benchPageCount());
          onReopened();
          toast(`${label} — the bench is showing the result`);
        }
      } catch (e) {
        console.error("[DocForge] page tool failed", e);
        toast(e instanceof Error && e.message ? e.message : `${label} failed`, "warn", 5000);
      } finally {
        setBusy(false);
      }
    },
    [onReopened],
  );

  const scope = selected.size ? `${selected.size} selected` : "all pages";

  return (
    <div
      data-chrome=""
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-line border-b bg-desk px-4 py-1.5"
    >
      <span className="font-mono text-[11px] text-ink-3">
        Pages <b className="text-ink-2">{count || "—"}</b>
      </span>
      <div className="flex max-w-[38vw] flex-wrap items-center gap-1 overflow-x-auto">
        {pages.map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={selected.has(i)}
            onClick={() => toggle(i)}
            title={`Page ${i + 1}`}
            className={`h-6 min-w-6 border px-1.5 font-mono text-[11px] ${
              selected.has(i)
                ? "border-press bg-press text-press-ink"
                : "border-line bg-tray text-ink-2 hover:text-ink"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <span className="font-mono text-[10.5px] text-ink-3">{scope}</span>
      <BenchZoom />
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || !count}
          onClick={() =>
            void run("Rotated left", (lib, b) => PageTools.rotatePages(lib, b, chosen, -90))
          }
          title="Turn the selected pages a quarter turn anticlockwise"
        >
          ⟲
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || !count}
          onClick={() =>
            void run("Rotated right", (lib, b) => PageTools.rotatePages(lib, b, chosen, 90))
          }
          title="Turn the selected pages a quarter turn clockwise"
        >
          ⟳
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || selected.size === 0 || selected.size >= count}
          onClick={() =>
            void run("Pages deleted", (lib, b) => PageTools.deletePages(lib, b, chosen))
          }
          title="Remove the selected pages"
        >
          Delete
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || selected.size !== 1 || chosen[0] === 0}
          onClick={() =>
            void run("Page moved", (lib, b) => {
              const i = chosen[0] as number;
              const order = pages.slice();
              order.splice(i - 1, 0, ...order.splice(i, 1));
              return PageTools.reorderPages(lib, b, order);
            })
          }
          title="Move the selected page one place earlier"
        >
          ←
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || selected.size !== 1 || chosen[0] === count - 1}
          onClick={() =>
            void run("Page moved", (lib, b) => {
              const i = chosen[0] as number;
              const order = pages.slice();
              order.splice(i + 1, 0, ...order.splice(i, 1));
              return PageTools.reorderPages(lib, b, order);
            })
          }
          title="Move the selected page one place later"
        >
          →
        </button>
        <span className="h-4 w-px bg-line" aria-hidden />
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || !count}
          onClick={() => mergeInput.current?.click()}
          title="Append another PDF to this one"
        >
          Merge…
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || !count}
          onClick={() =>
            void run("Pages numbered", (lib, b) =>
              PageTools.stampPageNumbers(lib, b, {
                skip: selected.size ? [...selected] : [],
                format: "{n}",
              }),
            )
          }
          title="Stamp page numbers into the pages — selected pages are skipped"
        >
          Number
        </button>
        <input
          value={ranges}
          onChange={(e) => setRanges(e.target.value)}
          placeholder="1-3, 5-"
          aria-label="Page ranges to split out"
          className="h-6 w-24 border border-line bg-tray px-1.5 font-mono text-[11px] text-ink placeholder:text-ink-3"
        />
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || !count || !ranges.trim()}
          onClick={() =>
            void run("Split", async (lib, b, name) => {
              const parsed = PageTools.parseRanges(ranges, count);
              const parts = await PageTools.splitPdf(lib, b, parsed);
              const stem = name.replace(/\.pdf$/i, "");
              parts.forEach((part: Uint8Array, i: number) => {
                const copy = new Uint8Array(part.byteLength);
                copy.set(part);
                downloadBlob(new Blob([copy], { type: "application/pdf" }), `${stem}-${i + 1}.pdf`);
              });
              toast(`${parts.length} file${parts.length === 1 ? "" : "s"} downloaded`);
              return null; // the parts were handed over; the bench keeps the original
            })
          }
          title="Download each range as its own PDF"
        >
          Split
        </button>
      </div>
      <input
        ref={mergeInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const extra = new Uint8Array(await f.arrayBuffer());
          void run("Merged", (lib, b) => PageTools.mergePdfs(lib, [b, extra]));
        }}
      />
    </div>
  );
}

/* ---------------- the singleton bench chrome ----------------
   Markup ported from src/index.html §#pdfEditor with the classic ids intact
   (they are the package's binding contract). #peClose and #peExport moved to
   the React masthead — main.js wired those, not the package. */

const BENCH_HTML = `
<div id="peBar">
  <span id="peName" class="pe-name"></span>
  <span id="pePages" class="pe-meta"></span>
  <span class="pe-hint">double-click any text to rewrite it</span>
  <div class="grow"></div>
  <div id="peTools" role="group" aria-label="Bench tools">
    <button type="button" class="pe-tool on" data-tool="select" title="Select / move" aria-label="Select / move" aria-pressed="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3l14 8-6.5 1.5L16 19l-3 1.4-3.4-6.6L5 17z"/></svg>
    </button>
    <button type="button" class="pe-tool" data-tool="text" title="Add text" aria-label="Add text" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 6V4h14v2M12 4v16m-3 0h6"/></svg>
    </button>
    <button type="button" class="pe-tool" data-tool="whiteout" title="Whiteout — cover original content" aria-label="Whiteout — cover original content" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="7" width="16" height="10" rx="1.5"/><path d="M7 10h10M7 13h6" opacity="0.45"/></svg>
    </button>
    <button type="button" class="pe-tool" data-tool="highlight" title="Highlight" aria-label="Highlight" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 15l-4 4H3v-2l4-4M8 12l7-7 4 4-7 7z"/></svg>
    </button>
    <button type="button" class="pe-tool" data-tool="image" title="Place image" aria-label="Place image" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 18.5l5-5 3.5 3.5 3-3 3.5 3.5"/></svg>
    </button>
  </div>
  <div class="tbsep"></div>
  <select id="peFont" class="tbsel" title="Text font — rewritten lines keep the PDF's own font unless you switch" aria-label="Text font">
    <option value="orig">Original — as printed</option>
    <option value="helv">Helvetica</option>
    <option value="helvB">Helvetica Bold</option>
    <option value="times">Times</option>
    <option value="timesB">Times Bold</option>
    <option value="timesI">Times Italic</option>
    <option value="courier">Courier</option>
  </select>
  <input type="number" id="peSize" class="tbsel narrow" value="12" min="6" max="72" step="1" title="Text size (pt)" aria-label="Text size in points">
  <input type="color" id="peColor" value="#111111" title="Text colour" aria-label="Text colour">
  <div class="tbsep"></div>
  <!-- The zoom cluster is NOT here any more (ledger I4): the React chrome
       mounts the studio's own −/%/+/Fit, so the same instrument behaves the
       same way in both modes. The package tolerates their absence and is
       driven through its api instead. -->
</div>
<div id="peScroll"><div id="peDeck"></div></div>
<input type="file" id="peImgInput" hidden accept="image/png,image/jpeg">
`;

function syncToolAria(active: string): void {
  if (!benchRoot) return;
  for (const b of benchRoot.querySelectorAll<HTMLElement>("#peTools .pe-tool")) {
    b.setAttribute("aria-pressed", String(b.dataset.tool === active));
  }
}

function acquireBench(): HTMLElement {
  if (benchRoot) return benchRoot;
  const host = document.createElement("section");
  host.id = "pdfEditor";
  host.setAttribute("aria-label", "PDF proofing bench");
  host.innerHTML = BENCH_HTML; // static, trusted markup (ported from index.html)
  benchRoot = host;
  // The package toggles the .on class in its own click listener; this earlier
  // delegated listener mirrors the same choice into aria-pressed.
  host.querySelector("#peTools")?.addEventListener("click", (e) => {
    const t = e.target as Element | null;
    const b = t?.closest<HTMLElement>(".pe-tool");
    if (b?.dataset.tool) syncToolAria(b.dataset.tool);
  });
  return host;
}

/* ---------------- bench styles ----------------
   Ported from src/app.css "PDF in-place editor" block onto the shared token
   custom properties (globals.css defines the same --bg/--line/--rule/… both
   desks). Deviations from the classic sheet: .tbsel steps 11.5px → 12px (the
   ≥12px control-text floor) and keyframes carry pe- names so nothing leaks. */

const BENCH_CSS = `
#pdfEditor { display: flex; flex-direction: column; flex: 1; min-height: 0; animation: pe-desk-in var(--dur2) var(--ease); }
@keyframes pe-desk-in { from { opacity: 0; transform: translateY(8px); } }
@keyframes pe-proof-in { from { opacity: 0; transform: translateY(5px); } }
@keyframes pe-fade { from { opacity: 0; } }
@keyframes pe-modal-in { from { translate: -50% calc(-50% + 8px); scale: 0.99; opacity: 0; } to { translate: -50% -50%; scale: 1; } }
#peBar { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background-image: var(--grain); background-color: var(--bg2); flex-wrap: wrap; }
#peBar .grow { flex: 1; }
.pe-name { font-weight: 600; color: var(--tx); margin-left: 4px; font-size: 13px; }
.pe-meta { color: var(--tx3); font-family: var(--mono); font-size: 12px; font-variant-numeric: tabular-nums; }
.pe-hint { color: var(--tx3); font-size: 12px; margin-left: var(--sp3); font-style: italic; font-family: var(--display); }
@media (max-width: 1024px) { .pe-hint { display: none; } }
#peTools { display: flex; gap: 2px; background: var(--bg2); border: 1px solid var(--line); border-radius: var(--rc); padding: 2px; }
.pe-tool { background: transparent; border: 0; color: var(--tx2); border-radius: var(--rc); width: 30px; height: 26px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.pe-tool svg { width: 16px; height: 16px; }
.pe-tool:hover { color: var(--tx); background: var(--bg3); }
.pe-tool.on { background: var(--bg); color: var(--tx); box-shadow: var(--recess); }
#peColor { width: 30px; height: 26px; padding: 1px; border: 0; border-radius: var(--rc); background: var(--bg); box-shadow: var(--recess); cursor: pointer; }
#peZoomPct { font-family: var(--mono); font-size: 12px; color: var(--tx2); min-width: 42px; text-align: center; font-variant-numeric: tabular-nums; }
#pdfEditor .tbsel { background: var(--bg3); color: var(--tx2); border: 1px solid var(--line); border-radius: var(--rc); font-size: 12px; padding: 0 4px; max-width: 132px; height: 28px; }
#pdfEditor .tbsel.narrow { max-width: 64px; }
#pdfEditor .tbsel:hover { color: var(--tx); }
#pdfEditor .tbsep { width: 1px; height: 16px; background: var(--line); margin: 0 6px; flex: none; }
#pdfEditor .btn { background: var(--bg3); border: 1px solid var(--line); border-radius: var(--rc); height: 32px; padding: 0 12px; cursor: pointer; color: var(--tx); font-size: 13px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
#pdfEditor .btn:hover { border-color: var(--rule); }
#pdfEditor .btn:active { transform: translateY(0.5px); }
#pdfEditor .btn.ghost { background: transparent; border-color: transparent; }
#pdfEditor .btn.ghost:hover { background: var(--bg3); border-color: var(--line); }
#pdfEditor .btn.small { height: 24px; padding: 0 8px; font-size: 12px; }
#peScroll { flex: 1; overflow: auto; background: var(--deck); padding: 28px 0 64px; }
#peDeck { display: flex; flex-direction: column; align-items: center; gap: 24px; }
.pe-page { position: relative; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 12px 32px rgba(0, 0, 0, 0.3); animation: pe-proof-in var(--dur2) var(--ease) backwards; }
.pe-page canvas { display: block; }
.pe-layer { position: absolute; inset: 0; }
.pe-edit { position: absolute; box-sizing: border-box; }
.pe-text { outline: none; cursor: text; white-space: pre-wrap; overflow-wrap: break-word; }
.pe-white { background: #fff; }
.pe-hl { background: rgba(245, 213, 10, 0.42); mix-blend-mode: multiply; }
.pe-img img { width: 100%; height: 100%; display: block; }
.pe-edit:hover { outline: 1px dashed color-mix(in srgb, var(--pri) 65%, transparent); }
.pe-edit.sel { outline: 1.5px solid var(--pri); }
.pe-resize { position: absolute; right: -6px; bottom: -6px; width: 12px; height: 12px; background: var(--pri); border: 2px solid #fff; border-radius: var(--rm); cursor: nwse-resize; }
.pe-drawing { position: absolute; border: 1px dashed var(--pri); background: color-mix(in srgb, var(--pri) 8%, transparent); pointer-events: none; }
@media (pointer: coarse) { .pe-tool { width: 38px; height: 34px; } }
`;

/* ---------------- the copy-desk skin shared by the dialog buttons ---------------- */

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";
const CANCEL_BTN = `inline-flex h-8 cursor-pointer items-center whitespace-nowrap rounded-desk border border-line bg-tray px-3 text-[13px] text-ink transition-colors duration-[160ms] ease-out hover:border-rule active:translate-y-[0.5px] ${FOCUS_RING}`;
const CONFIRM_BTN = `inline-flex h-8 cursor-pointer items-center whitespace-nowrap rounded-desk border border-press-hover bg-press px-3 text-[13px] font-semibold text-press-ink transition-colors duration-[160ms] ease-out hover:bg-press-hover active:translate-y-[0.5px] ${FOCUS_RING}`;

/* ---------------- the bench ---------------- */

export function PdfBench() {
  const router = useRouter();
  const holder = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const confirmResolve = useRef<((ok: boolean) => void) | null>(null);

  const [phase, setPhase] = useState<Phase>(() => (openDocName ? "open" : "empty"));
  const [exporting, setExporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmBox, setConfirmBox] = useState<{ title: string; body: string } | null>(null);

  /* adopt the singleton chrome; hold the classic pdf-mode body class the
     package's document-level keydown handler keys off */
  useEffect(() => {
    const host = holder.current;
    if (!host) return;
    const bench = acquireBench();
    host.appendChild(bench);
    document.body.classList.add("pdf-mode");
    return () => {
      document.body.classList.remove("pdf-mode");
      bench.remove(); // detached, never destroyed — an open document survives
    };
  }, []);

  /* ---------------- confirm plumbing (api.hooks.confirm → Radix AlertDialog) ---------------- */
  const askConfirm = useCallback(
    (title: string, body: string) =>
      new Promise<boolean>((resolve) => {
        confirmResolve.current?.(false); // a newer ask supersedes a stale one
        confirmResolve.current = resolve;
        setConfirmBox({ title, body });
      }),
    [],
  );
  const settleConfirm = useCallback((ok: boolean) => {
    confirmResolve.current?.(ok);
    confirmResolve.current = null;
    setConfirmBox(null);
  }, []);
  useEffect(() => {
    confirmDelegate = askConfirm;
    return () => {
      if (confirmDelegate === askConfirm) confirmDelegate = null;
      confirmResolve.current?.(false);
      confirmResolve.current = null;
    };
  }, [askConfirm]);

  /* ---------------- open / export / leave ---------------- */
  const openFile = useCallback(
    async (f: File) => {
      if (phase === "opening") return;
      if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
        toast("That's not a PDF — other formats import in the studio", "warn");
        return;
      }
      setPhase("opening");
      try {
        const api = await loadPdfEditor();
        await api.open(await f.arrayBuffer(), f.name);
        openDocName = f.name;
        syncToolAria("select"); // open() resets the package's tool to select
        setPhase("open");
        toast("Double-click any text to rewrite it — the layout stays exactly as printed");
      } catch (err) {
        console.error("[DocForge] pdf edit open failed", err);
        toast(
          err instanceof Error && err.message ? err.message : "Could not open that PDF",
          "warn",
        );
        // open() closes any previous document before parsing the new one,
        // so a failed open always lands back on the empty bench.
        openDocName = null;
        setPhase("empty");
      }
    },
    [phase],
  );

  const doExport = useCallback(async () => {
    setExporting(true);
    try {
      const api = await loadPdfEditor();
      await ensurePdfLib();
      const { blob, name } = await api.exportPdf();
      downloadBlob(blob, name);
      toast("Edited PDF downloaded — original layout intact underneath");
    } catch (e) {
      console.error("[DocForge] pdf edit export failed", e);
      toast("PDF export failed — your edits are still here; try again", "warn");
    } finally {
      setExporting(false);
    }
  }, []);

  const backToStudio = useCallback(async () => {
    const api = editorApi;
    if (api?.isOpen() && api.hasEdits()) {
      const ok = await askConfirm(
        "Leave PDF editing?",
        "Your overlay edits live only in this view — export the PDF first if you want to keep them.",
      );
      if (!ok) return;
    }
    if (api?.isOpen()) await api.close();
    openDocName = null;
    router.push("/studio");
  }, [askConfirm, router]);

  /* a File stashed by the studio's "edit in place" choice opens on arrival */
  useEffect(() => {
    if (!pendingFile) return;
    const f = pendingFile;
    pendingFile = null;
    void openFile(f);
  }, [openFile]);

  /* ---------------- inline drag-drop ----------------
     Window-level capture listeners, the same pattern as the studio's
     DropZone: counted dragenter/dragleave so child churn can't flicker the
     affordance, files-only so text drags behave natively. */
  useEffect(() => {
    let depth = 0;
    const dragHas = (e: DragEvent) => [...(e.dataTransfer?.types || [])].includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!dragHas(e)) return;
      depth++;
      setDragOver(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!dragHas(e)) return;
      if (--depth <= 0) {
        depth = 0;
        setDragOver(false);
      }
    };
    // preventDefault on dragover is what makes the window a legal drop target.
    const onOver = (e: DragEvent) => {
      if (dragHas(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      depth = 0;
      setDragOver(false);
      const files = [...(e.dataTransfer?.files || [])];
      if (!files.length) return; // let plain text drops behave natively
      e.preventDefault();
      const f = files.find((x) => /\.pdf$/i.test(x.name) || x.type === "application/pdf");
      if (f) void openFile(f);
      else toast("Drop a PDF — other formats import in the studio", "warn");
    };
    window.addEventListener("dragenter", onEnter, true);
    window.addEventListener("dragleave", onLeave, true);
    window.addEventListener("dragover", onOver, true);
    window.addEventListener("drop", onDrop, true);
    return () => {
      window.removeEventListener("dragenter", onEnter, true);
      window.removeEventListener("dragleave", onLeave, true);
      window.removeEventListener("dragover", onOver, true);
      window.removeEventListener("drop", onDrop, true);
    };
  }, [openFile]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-shell="">
      <style>{BENCH_CSS}</style>

      {/* nameplate masthead — Back-to-studio, the wordmark, the bench kicker */}
      <header
        data-chrome=""
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-4 border-double border-rule bg-desk px-4 py-2"
      >
        <Link
          href="/studio"
          className="btn-ghost"
          onClick={(e) => {
            e.preventDefault();
            void backToStudio();
          }}
        >
          ← Studio
        </Link>
        <span className="font-display text-xl font-bold tracking-tight text-ink">DocForge</span>
        <span className="border-l border-line pl-3 font-mono text-xs text-ink-2">PDF bench</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button type="button" className="btn-ghost" onClick={() => fileInput.current?.click()}>
            Open PDF…
          </button>
          {phase === "open" && (
            <button
              type="button"
              onClick={doExport}
              disabled={exporting}
              title="Download the edited PDF — original layout untouched underneath"
              className="border border-rule bg-press px-3 py-1.5 font-mono text-[12px] uppercase tracking-widest text-press-ink hover:bg-press-hover disabled:opacity-60"
            >
              {exporting ? "Exporting…" : "Export PDF"}
            </button>
          )}
        </div>
      </header>

      {phase === "open" ? <PageToolbar onReopened={() => setPhase("open")} /> : null}

      {/* the bench floor: singleton chrome when a proof is open, else the invitation */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={holder}
          className="min-h-0 flex-1 flex-col"
          style={{ display: phase === "open" ? "flex" : "none" }}
        />
        {phase !== "open" && (
          <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6">
            {phase === "opening" ? (
              <p className="font-mono text-sm text-ink-3" role="status">
                reading the PDF — a large file can take a few seconds…
              </p>
            ) : (
              <>
                <div className="max-w-md border-2 border-dashed border-rule px-8 py-10 text-center">
                  <h1 className="font-display text-[22px] italic text-ink-2">The proofing bench</h1>
                  <p className="mt-3 text-[13px] leading-6 text-ink-2">
                    Open a PDF and edit it in place — rewrite printed lines, add text, cover or
                    highlight content, place images. The export keeps the original layout untouched
                    underneath.
                  </p>
                  <button
                    type="button"
                    className="btn-ghost mt-5"
                    onClick={() => fileInput.current?.click()}
                  >
                    Open a PDF…
                  </button>
                  <p className="mt-4 font-mono text-xs text-ink-3">
                    or drop one anywhere on this page
                  </p>
                </div>
                <p className="font-mono text-xs text-ink-3">
                  Need the text itself? The studio's Open converts a PDF to an editable document.
                </p>
              </>
            )}
          </main>
        )}
        {dragOver && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed border-rule bg-desk/90 p-8"
            style={{ animation: "pe-fade var(--dur) var(--ease)" }}
          >
            <div className="text-center">
              <p className="font-display text-[22px] italic text-ink-2">
                Drop the PDF on the bench
              </p>
              <p className="mt-2 font-mono text-xs text-ink-3">
                it opens for in-place editing — the layout stays as printed
              </p>
            </div>
          </div>
        )}
      </div>

      {/* the bench's own Radix AlertDialog — api.hooks.confirm resolves through it */}
      <AlertDialog.Root
        open={!!confirmBox}
        onOpenChange={(next) => {
          if (!next) settleConfirm(false);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay
            className="fixed inset-0 z-[60] bg-[rgba(10,8,5,0.72)]"
            style={{ animation: "pe-fade var(--dur) var(--ease)" }}
          />
          <AlertDialog.Content
            className="fixed left-1/2 top-1/2 z-[60] flex max-h-[84vh] w-[min(430px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-modal bg-surface shadow-[var(--elev-l)] outline-none"
            style={{ animation: "pe-modal-in var(--dur) var(--ease)" }}
          >
            <AlertDialog.Title className="border-b border-line px-5 py-4 font-display text-base font-normal text-ink">
              {confirmBox?.title}
            </AlertDialog.Title>
            <AlertDialog.Description className="overflow-y-auto px-5 py-4 text-[13px] leading-[1.65] text-ink-2">
              {confirmBox?.body}
            </AlertDialog.Description>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
              <AlertDialog.Cancel asChild>
                <button type="button" className={CANCEL_BTN}>
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button type="button" className={CONFIRM_BTN} onClick={() => settleConfirm(true)}>
                  Continue
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <ToastRack />
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void openFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
