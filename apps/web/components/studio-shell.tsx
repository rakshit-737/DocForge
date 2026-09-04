"use client";
/* The studio shell — the whole desk assembled: masthead, toolbar, source
   galley, the stone, settings drawer, templates, find, palette, outline,
   help, toasts, persistence and the ports of exit. */
import { EditorView } from "@codemirror/view";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { captionForFile, insertFigure, processImageFile } from "@/lib/attachments";
import { importReport, mergeDefinitions } from "@/lib/bibliography";
import { downloadBlob, exportDocx, exportPdf } from "@/lib/exports";
import { toast, useFindStore } from "@/lib/find";
import { useFocusMode, useMobilePane } from "@/lib/focus-mode";
import { importFile, isHeavyImport } from "@/lib/imports";
import { flushActiveLiveEdit } from "@/lib/live-edit";
import { armAutosave, persistNow, restoreSession } from "@/lib/persistence";
import type { PreviewController } from "@/lib/preview-controller";
import {
  forgetOpenFile,
  openFileName,
  openWithPicker,
  parseProject,
  saveDocumentFile,
} from "@/lib/project-file";
import type { Settings } from "@/lib/settings";
import { useDocStore, useUiStore } from "@/lib/store";
import type { TemplateDocument } from "@/lib/templates";
import { resolveTemplate, TEMPLATES } from "@/lib/templates";
import { useUserFonts } from "@/lib/user-fonts";
import { armVersionSnapshots, snapshot } from "@/lib/versions";
import { anyDialogOpen, CommandPalette } from "./command-palette";
import { ConfirmDialog } from "./confirm-dialog";
import { DropZone } from "./drop-zone";
import { EmptyState } from "./empty-state";
import { FindBar, ToastRack } from "./find-bar";
import { FirstRun } from "./first-run";
import { HelpDialog } from "./help-dialog";
import { LintBadge, LintPanel } from "./lint-panel";
import { OutlinePanel, useRenderTick } from "./outline-panel";
import { stashBenchFile } from "./pdf-bench";
import { PreviewDeck } from "./preview-deck";
import { SettingsDrawer, useSettingsDrawer } from "./settings-drawer";
import { SourcePane } from "./source-pane";
import { TemplatesMenu } from "./templates-menu";
import { FormatToolbar } from "./toolbar";
import { VersionPanel } from "./version-panel";

export function StudioShell() {
  const [view, setView] = useState<EditorView | null>(null);
  const [controller, setController] = useState<PreviewController | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [lintOpen, setLintOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [pdfPending, setPdfPending] = useState<File | null>(null);
  const [savedStamp, setSavedStamp] = useState<string>("");
  /* Mirrors project-file.ts's open target so the desk can name the file a
     Save would overwrite; that module stays the single source of truth. */
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const pageInfo = useUiStore((s) => s.pageInfo);
  const busy = useUiStore((s) => s.busy);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const zoomPct = useUiStore((s) => s.zoomPct);
  const title = useDocStore((s) => s.settings.title);
  const findOpen = useFindStore((s) => s.open);
  const renderTick = useRenderTick((s) => s.tick);
  const settingsOpen = useSettingsDrawer((s) => s.open);
  const mobilePane = useMobilePane((s) => s.pane);
  const focusOn = useFocusMode((s) => s.on);

  /* ---------------- boot: restore the last session, arm autosave ---------------- */
  useEffect(() => {
    let disarm = () => {};
    /* The reader's own typefaces register before the first compose, so a
       document set in one is drawn in it from the first paint (§8.2). */
    void useUserFonts.getState().refresh();
    (async () => {
      const restored = await restoreSession();
      if (!restored && !useDocStore.getState().source) {
        const t = resolveTemplate("welcome");
        useDocStore.getState().replaceDocument({ source: t.source, settings: t.settings });
      }
      disarm = armAutosave((at) =>
        setSavedStamp(new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })),
      );
      /* The timeline arms with autosave: autosave keeps the current state,
         version history keeps the road back to the earlier ones (§8.1). */
      const disarmVersions = armVersionSnapshots();
      const autosaveOnly = disarm;
      disarm = () => {
        autosaveOnly();
        disarmVersions();
      };
    })();
    try {
      if (localStorage.getItem("docforge.ui.theme") === "dark") {
        useUiStore.setState({ theme: "dark" });
      }
    } catch {}
    return () => disarm();
  }, []);

  /* ---------------- undoable whole-document replace (ledger I7) ---------------- */
  const applyWithUndo = useCallback(
    (
      label: string,
      doc: { source: string; settings: Settings; attachments?: Record<string, unknown> },
    ) => {
      const s = useDocStore.getState();
      const snap = {
        source: s.source,
        settings: s.settings,
        attachments: s.attachments,
        accentTouched: s.accentTouched,
      };
      /* Whatever file was open on disk no longer holds THIS document — the
         open-in-place road re-adopts its handle right after this call, and
         nothing else may inherit it (a template must never be saved over the
         reader's manuscript). */
      forgetOpenFile();
      setOpenFile(null);
      s.replaceDocument(doc);
      toast(`Loaded “${label}”`, "info", 6000, {
        label: "Undo",
        onClick: () => {
          useDocStore.getState().replaceDocument({
            source: snap.source,
            settings: snap.settings,
            attachments: snap.attachments,
          });
          useDocStore.setState({ accentTouched: snap.accentTouched });
        },
      });
    },
    [],
  );
  const handleTemplate = useCallback(
    ({ label, source, settings }: TemplateDocument) => applyWithUndo(label, { source, settings }),
    [applyWithUndo],
  );

  /* ---------------- save / open / new ---------------- */
  const saveLocal = useCallback(async () => {
    try {
      const at = await persistNow();
      setSavedStamp(new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      toast("Saved on this device — export or Save project for a file", "info", 2600);
    } catch {
      toast("Local save failed — storage may be blocked here", "warn");
    }
  }, []);

  const saveProject = useCallback(async () => {
    flushActiveLiveEdit();
    const s = useDocStore.getState();
    try {
      const out = await saveDocumentFile({
        source: s.source,
        settings: s.settings,
        attachments: s.attachments,
      });
      setOpenFile(openFileName());
      toast(
        out.how === "in-place"
          ? `Saved to “${out.name}”`
          : out.how === "saved"
            ? `Project saved as “${out.name}” — Save writes straight back now`
            : "Project downloaded",
      );
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") toast("Project save failed", "warn");
    }
  }, []);

  const openProjectFile = useCallback(
    async (file: File): Promise<boolean> => {
      try {
        const doc = parseProject(await file.text());
        applyWithUndo(file.name.replace(/\.docforge\.json$|\.json$/i, ""), doc);
        return true;
      } catch (e) {
        toast(e instanceof Error ? e.message : "That file did not open", "warn", 5000);
        return false;
      }
    },
    [applyWithUndo],
  );

  const newDocument = useCallback(() => {
    handleTemplate(resolveTemplate("blank"));
  }, [handleTemplate]);

  /* ---------------- ports of entry: one handler for Open and the drop zone ---------------- */
  /* Resolves true when the document was REPLACED — the open-in-place road
     only adopts a file handle for a load that actually took. */
  const convertFile = useCallback(
    async (f: File): Promise<boolean> => {
      if (isHeavyImport(f.name)) toast(`Reading “${f.name}”…`, "info", 1800);
      const res = await importFile(f);
      if (res.error) {
        toast(res.error, "warn", 5000);
        return false;
      }
      if (res.project) return openProjectFile(f);
      /* A reference library is an ADDITION: the entries merge into the
         manuscript's own bibliography lines, the document keeps its text, and
         a key the reader has already defined by hand is never overwritten. */
      if (res.definitions) {
        const s = useDocStore.getState();
        const merged = mergeDefinitions(s.source, res.definitions);
        if (merged.added.length === 0) {
          toast(`Every reference in “${f.name}” was already defined here`, "info", 5000);
          return false;
        }
        s.setSource(merged.source);
        toast(importReport(merged, merged.source), "info", 6000);
        return false; // the document was extended, not replaced
      }
      if (res.image) {
        try {
          const key = await processImageFile(res.image);
          if (view) insertFigure(view, key, captionForFile(res.image.name));
          toast("Image added as a figure");
        } catch {
          toast("Could not read that image", "warn");
        }
        return false;
      }
      if (res.source != null) {
        const title = f.name.replace(/\.[a-z0-9]+$/i, "");
        applyWithUndo(f.name, {
          source: res.source,
          settings: { ...useDocStore.getState().settings, title },
          attachments: res.attachments ?? {},
        });
        for (const w of res.warnings ?? []) toast(w, "warn", 5000);
        return true;
      }
      return false;
    },
    [view, applyWithUndo, openProjectFile],
  );

  /* A PDF has two roads (classic parity): edit it in place on the bench, or
     convert it to a manuscript. Ask before doing either. */
  const handleImport = useCallback(
    async (f: File): Promise<boolean> => {
      if (/\.pdf$/i.test(f.name)) {
        setPdfPending(f);
        return false; // the dialog decides; nothing is loaded yet
      }
      return convertFile(f);
    },
    [convertFile],
  );

  /* The Open door, Phase 5: where the browser can hand back a writable handle
     the file opens IN PLACE — the same file the next Save writes back to —
     and everywhere else the hidden `<input type=file>` does what it always
     did. A cancelled picker is not an error; a broken one falls back. */
  const doOpen = useCallback(async () => {
    try {
      const picked = await openWithPicker();
      if (!picked) {
        fileInput.current?.click();
        return;
      }
      if (await handleImport(picked.file)) {
        picked.adopt();
        setOpenFile(openFileName());
      }
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
      fileInput.current?.click();
    }
  }, [handleImport]);

  const jumpToLine = useCallback(
    (n: number) => {
      if (!view) return;
      const line = view.state.doc.line(Math.max(1, Math.min(n, view.state.doc.lines)));
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 80 }),
      });
      view.focus();
    },
    [view],
  );

  /* ---------------- exports ---------------- */
  const doExportDocx = useCallback(async () => {
    if (!controller) return;
    setExporting(true);
    try {
      await exportDocx(
        controller,
        useDocStore.getState().settings,
        useDocStore.getState().attachments,
      );
      toast("Word file downloaded — click “Yes” if Word asks to update fields");
    } catch (e) {
      console.error("[DocForge] docx failed", e);
      toast("Word export failed — nothing was lost; try again", "warn");
    } finally {
      setExporting(false);
    }
  }, [controller]);

  const doExportMd = useCallback(() => {
    flushActiveLiveEdit();
    const s = useDocStore.getState();
    const name = `${
      ((s.settings.title as string) || "document")
        .replace(/[^\w-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "document"
    }.md`;
    downloadBlob(new Blob([s.source], { type: "text/markdown" }), name);
    toast("Markdown downloaded");
  }, []);

  const doExportPdf = useCallback(() => {
    if (!controller) return;
    toast(
      "In the print dialog: destination “Save as PDF” · untick “Headers and footers”",
      "info",
      8000,
    );
    setTimeout(() => {
      try {
        exportPdf(controller, useDocStore.getState().settings);
      } catch {
        toast("Printing is blocked here — try the browser menu", "warn");
      }
    }, 350);
  }, [controller]);

  /* ---------------- shell keyboard ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        useFocusMode.getState().toggle();
        return;
      }
      const k = e.key.toLowerCase();
      if (mod && k === "k") {
        // In the editor Ctrl+K belongs to link insertion (deskKeymap wins there);
        // the palette answers everywhere else.
        if ((e.target as HTMLElement)?.closest?.(".cm-editor")) return;
        e.preventDefault();
        setPaletteOpen((o) => (o ? false : anyDialogOpen() ? o : true));
      } else if (mod && k === "s") {
        e.preventDefault();
        void saveLocal();
      } else if (mod && k === "p") {
        // Ctrl+P = the pre-flighted PDF export, not the browser's raw print
        e.preventDefault();
        doExportPdf();
      } else if (mod && k === "/") {
        e.preventDefault();
        if (!helpOpen && anyDialogOpen()) return;
        setHelpOpen((o) => !o);
      } else if (mod && (k === "f" || k === "h")) {
        // fallback when focus is outside the editor; the CM keymap handles inside
        const inEditor = (e.target as HTMLElement)?.closest?.(".cm-editor");
        if (!inEditor) {
          e.preventDefault();
          useFindStore.getState().setOpen(true, k === "h");
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [helpOpen, saveLocal, doExportPdf]);

  /* ---------------- palette commands (built fresh so labels stay truthful) ---------------- */
  const commands = [
    { group: "Actions", label: "Export Word document", hint: "one click", run: doExportDocx },
    { group: "Actions", label: "Export PDF", hint: "print route", run: doExportPdf },
    { group: "Actions", label: "Export Markdown", hint: ".md source", run: doExportMd },
    { group: "Actions", label: "Save on this device", hint: "Ctrl+S", run: saveLocal },
    { group: "Actions", label: "Save project file", hint: ".docforge.json", run: saveProject },
    { group: "Actions", label: "Open project…", run: () => void doOpen() },
    { group: "Actions", label: "New document", run: () => setConfirmNew(true) },
    {
      group: "Actions",
      label: "Version history…",
      hint: "restore an earlier state",
      run: () => setVersionsOpen(true),
    },
    {
      group: "Actions",
      label: "Save a checkpoint",
      hint: "a named point to come back to",
      run: () => {
        void snapshot("manual").then((v) =>
          toast(
            v ? "Checkpoint saved — find it in Version history" : "Nothing to check point yet",
            v ? "info" : "warn",
          ),
        );
      },
    },
    {
      group: "Actions",
      label: "Find in source",
      hint: "Ctrl+F",
      run: () => useFindStore.getState().setOpen(true, false),
    },
    {
      group: "Actions",
      label: "Replace in source",
      hint: "Ctrl+H",
      run: () => useFindStore.getState().setOpen(true, true),
    },
    {
      group: "Actions",
      label: outlineOpen ? "Hide outline" : "Show outline",
      run: () => setOutlineOpen((o) => !o),
    },
    {
      group: "Actions",
      label: focusOn ? "Leave focus mode" : "Focus mode — the writer and the page",
      hint: "Ctrl+Shift+Enter",
      run: () => useFocusMode.getState().toggle(),
    },
    {
      group: "Actions",
      label: lintOpen ? "Hide document checks" : "Document checks",
      run: () => setLintOpen((o) => !o),
    },
    {
      group: "Actions",
      label: "Open the PDF bench",
      hint: "/pdf",
      run: () => window.location.assign("/pdf"),
    },
    {
      group: "Actions",
      label: "Import a file…",
      hint: "docx · pdf · xlsx · epub …",
      run: () => void doOpen(),
    },
    { group: "Actions", label: theme === "dark" ? "Day desk" : "Night shift", run: toggleTheme },
    {
      group: "Actions",
      label: "Zoom to fit",
      run: () => controller?.setZoom("fit", controller.zoomVal, useDocStore.getState().settings),
    },
    { group: "Actions", label: "Keyboard help", hint: "Ctrl+/", run: () => setHelpOpen(true) },
    ...Object.entries(TEMPLATES).map(([id, t]) => ({
      group: "Templates",
      label: t.label,
      hint: t.desc,
      run: () => handleTemplate(resolveTemplate(id as Parameters<typeof resolveTemplate>[0])),
    })),
    {
      group: "Settings",
      label: "Open settings",
      run: () => useSettingsDrawer.getState().openDrawer(),
    },
    {
      group: "Settings",
      label: "Edit title & cover fields",
      run: () => useSettingsDrawer.getState().openDrawer("title"),
    },
  ];

  const zoom = (delta: number) => {
    if (!controller) return;
    const next = Math.min(2, Math.max(0.25, (controller.zoomVal || 1) + delta));
    controller.setZoom("man", next, useDocStore.getState().settings);
  };
  const zoomFit = () =>
    controller?.setZoom("fit", controller.zoomVal, useDocStore.getState().settings);

  const onRendered = useCallback(() => useRenderTick.getState().bump(), []);
  const controllerRef = useCallback((c: PreviewController | null) => setController(c), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-shell="">
      {/* masthead — the serif nameplate over a double ink rule */}
      <header
        data-chrome=""
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-4 border-double border-rule bg-desk px-4 py-2"
      >
        <Link href="/" className="font-display text-xl font-bold tracking-tight text-ink">
          DocForge
        </Link>
        <button
          type="button"
          className="min-w-0 max-w-64 truncate text-[13px] text-ink-2 hover:text-ink"
          title="Edit title and cover fields"
          onClick={() => useSettingsDrawer.getState().openDrawer("title")}
        >
          {(title as string) || "Untitled document"}
        </button>
        {openFile ? (
          <span
            className="max-w-48 truncate font-mono text-[11.5px] text-ink-3"
            title={`Save writes straight back to “${openFile}”`}
          >
            {openFile}
          </span>
        ) : null}
        {/* The autosave stamp is also the door to the timeline: the moment a
            reader wonders "when was that saved?" is the moment they want the
            earlier states (§8.1). */}
        <button
          type="button"
          className="font-mono text-[11.5px] text-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
          onClick={() => setVersionsOpen(true)}
          title="Version history — earlier states of this document"
        >
          <span aria-live="polite">{savedStamp ? `saved ${savedStamp}` : "version history"}</span>
        </button>

        {/* Hierarchy answers "what do I click first" (§7.2): the file-ops tray
            holds the small verbs, the products stand apart with ONE red plate,
            and the utilities recede to quiet ink. */}
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <TemplatesMenu onApply={handleTemplate} />
          <fieldset
            aria-label="Project"
            className="m-0 flex items-center gap-px rounded-none border border-line bg-surface p-0.5"
          >
            <button
              type="button"
              className="btn-tray"
              onClick={() => void doOpen()}
              title="Open a document or project file"
            >
              Open
            </button>
            <button
              type="button"
              className="btn-tray"
              onClick={saveProject}
              title={
                openFile
                  ? `Save straight back to “${openFile}”`
                  : "Save a .docforge.json project file"
              }
            >
              Save
            </button>
            <button type="button" className="btn-tray" onClick={() => setConfirmNew(true)}>
              New
            </button>
          </fieldset>
          <span className="h-5 w-px bg-line" aria-hidden />
          <button type="button" className="btn-ghost" onClick={doExportPdf}>
            PDF
          </button>
          <button
            type="button"
            onClick={doExportDocx}
            disabled={exporting}
            className="border border-rule bg-press px-3 py-1.5 font-mono text-[12px] uppercase tracking-widest text-press-ink hover:bg-press-hover disabled:opacity-60"
          >
            {exporting ? "Exporting…" : "Export Word"}
          </button>
          <span className="h-5 w-px bg-line" aria-hidden />
          <button
            type="button"
            className="btn-quiet"
            aria-expanded={settingsOpen}
            onClick={() => useSettingsDrawer.getState().toggle()}
          >
            Settings
          </button>
          <Link href="/pdf" className="btn-quiet" title="Edit an existing PDF in place">
            Bench
          </Link>
          <button type="button" className="btn-quiet" onClick={() => setHelpOpen(true)}>
            Help
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-quiet"
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? "Day desk" : "Night shift"}
          </button>
        </div>
      </header>

      {/* the desk: source galley left, the stone right */}
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(340px,42%)_1fr]" data-desk="">
        <section
          aria-label="Source"
          data-chrome=""
          className="flex min-h-0 flex-col border-r border-line"
        >
          <FormatToolbar view={view} />
          <FindBar
            view={view}
            open={findOpen}
            onOpenChange={(o) => useFindStore.getState().setOpen(o)}
          />
          <div className="relative min-h-0 flex-1">
            <SourcePane viewRef={setView} />
            <LintPanel open={lintOpen} onOpenChange={setLintOpen} onJump={jumpToLine} />
          </div>
        </section>
        <section aria-label="Preview" className="relative min-h-0">
          <PreviewDeck controllerRef={controllerRef} onRendered={onRendered} />
          <EmptyState
            onWrite={() => {
              useMobilePane.getState().setPane("source");
              view?.focus();
            }}
            onTemplates={() => setPaletteOpen(true)}
            onOpen={() => void doOpen()}
          />
          {outlineOpen && (
            <OutlinePanel
              deck={controller?.deck ?? null}
              refreshKey={renderTick}
              onClose={() => setOutlineOpen(false)}
            />
          )}
        </section>
      </main>

      {/* the wire ticker */}
      <footer
        data-chrome=""
        className="flex items-center gap-4 border-t border-rule bg-surface px-4 py-1 font-mono text-xs text-ink-2"
      >
        <output aria-live="polite" className="tabular-nums">
          {busy && !pageInfo ? "composing…" : pageInfo || "—"}
        </output>
        <button
          type="button"
          className="hover:text-ink"
          aria-expanded={outlineOpen}
          onClick={() => setOutlineOpen((o) => !o)}
        >
          Outline
        </button>
        <LintBadge expanded={lintOpen} onClick={() => setLintOpen((o) => !o)} />
        <fieldset data-mobile-tabs="" className="m-0 border-0 p-0" aria-label="Pane">
          <button
            type="button"
            aria-pressed={mobilePane === "source"}
            onClick={() => useMobilePane.getState().setPane("source")}
          >
            Source
          </button>
          <button
            type="button"
            aria-pressed={mobilePane === "preview"}
            onClick={() => useMobilePane.getState().setPane("preview")}
          >
            Preview
          </button>
        </fieldset>
        <fieldset className="ml-auto flex items-center gap-1 border-0 p-0" aria-label="Zoom">
          <button
            type="button"
            onClick={() => zoom(-0.1)}
            className="min-h-6 min-w-6 px-1 hover:text-ink"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={zoomFit}
            className="min-w-12 px-1 tabular-nums hover:text-ink"
            title="Reset to fit"
          >
            {zoomPct}%
          </button>
          <button
            type="button"
            onClick={() => zoom(0.1)}
            className="min-h-6 min-w-6 px-1 hover:text-ink"
            aria-label="Zoom in"
          >
            +
          </button>
          <button type="button" onClick={zoomFit} className="px-1 hover:text-ink">
            Fit
          </button>
        </fieldset>
      </footer>

      {/* surfaces */}
      <SettingsDrawer />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <VersionPanel
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        onRestore={(label, doc) => applyWithUndo(label, doc)}
      />
      <FirstRun />
      <ConfirmDialog
        open={confirmNew}
        onOpenChange={setConfirmNew}
        title="Start a new document?"
        body="The current manuscript is saved on this device; loading a blank sheet is undoable from the toast."
        confirmLabel="New document"
        onConfirm={() => {
          setConfirmNew(false);
          newDocument();
        }}
      />
      {/* the classic edit-or-convert ask for an incoming PDF */}
      {pdfPending ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Open PDF"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40"
        >
          <div className="w-[26rem] max-w-[90vw] border border-rule bg-tray p-5 shadow-(--elev-l)">
            <h2 className="font-display text-lg text-ink">“{pdfPending.name}”</h2>
            <p className="mt-2 text-[13px] leading-5 text-ink-2">
              Edit the PDF itself on the proofing bench, or convert its text into an editable
              manuscript?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setPdfPending(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  const f = pdfPending;
                  setPdfPending(null);
                  if (f) void convertFile(f);
                }}
              >
                Convert to manuscript
              </button>
              <button
                type="button"
                className="border border-rule bg-press px-3 py-1.5 font-mono text-[12px] uppercase tracking-widest text-press-ink hover:bg-press-hover"
                onClick={() => {
                  const f = pdfPending;
                  setPdfPending(null);
                  if (f) {
                    // client navigation — the stashed File lives in module state
                    stashBenchFile(f);
                    router.push("/pdf");
                  }
                }}
              >
                Edit in place
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ToastRack />
      <DropZone
        onFiles={(files) => {
          for (const f of files) void handleImport(f);
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".md,.markdown,.txt,.json,.docx,.pdf,.csv,.tsv,.xlsx,.pptx,.epub,.ipynb,.html,.htm,.bib,.ris,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImport(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
