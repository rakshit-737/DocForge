"use client";
/* The studio shell — the whole desk assembled: masthead, toolbar, source
   galley, the stone, settings drawer, templates, find, palette, outline,
   help, toasts, persistence and the ports of exit. */
import type { EditorView } from "@codemirror/view";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { exportDocx, exportPdf } from "@/lib/exports";
import { toast, useFindStore } from "@/lib/find";
import { armAutosave, persistNow, restoreSession } from "@/lib/persistence";
import type { PreviewController } from "@/lib/preview-controller";
import { parseProject, saveProjectFile } from "@/lib/project-file";
import type { Settings } from "@/lib/settings";
import { useDocStore, useUiStore } from "@/lib/store";
import type { TemplateDocument } from "@/lib/templates";
import { resolveTemplate, TEMPLATES } from "@/lib/templates";
import { anyDialogOpen, CommandPalette } from "./command-palette";
import { ConfirmDialog } from "./confirm-dialog";
import { FindBar, ToastRack } from "./find-bar";
import { HelpDialog } from "./help-dialog";
import { OutlinePanel, useRenderTick } from "./outline-panel";
import { PreviewDeck } from "./preview-deck";
import { SettingsDrawer, useSettingsDrawer } from "./settings-drawer";
import { SourcePane } from "./source-pane";
import { TemplatesMenu } from "./templates-menu";
import { FormatToolbar } from "./toolbar";

export function StudioShell() {
  const [view, setView] = useState<EditorView | null>(null);
  const [controller, setController] = useState<PreviewController | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [savedStamp, setSavedStamp] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const pageInfo = useUiStore((s) => s.pageInfo);
  const busy = useUiStore((s) => s.busy);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const zoomPct = useUiStore((s) => s.zoomPct);
  const title = useDocStore((s) => s.settings.title);
  const findOpen = useFindStore((s) => s.open);
  const renderTick = useRenderTick((s) => s.tick);
  const settingsOpen = useSettingsDrawer((s) => s.open);

  /* ---------------- boot: restore the last session, arm autosave ---------------- */
  useEffect(() => {
    let disarm = () => {};
    (async () => {
      const restored = await restoreSession();
      if (!restored && !useDocStore.getState().source) {
        const t = resolveTemplate("welcome");
        useDocStore.getState().replaceDocument({ source: t.source, settings: t.settings });
      }
      disarm = armAutosave((at) =>
        setSavedStamp(new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })),
      );
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
    const s = useDocStore.getState();
    try {
      const how = await saveProjectFile({
        source: s.source,
        settings: s.settings,
        attachments: s.attachments,
      });
      toast(how === "saved" ? "Project saved in place" : "Project downloaded");
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") toast("Project save failed", "warn");
    }
  }, []);

  const openProjectFile = useCallback(
    async (file: File) => {
      try {
        const doc = parseProject(await file.text());
        applyWithUndo(file.name.replace(/\.docforge\.json$|\.json$/i, ""), doc);
      } catch (e) {
        toast(e instanceof Error ? e.message : "That file did not open", "warn", 5000);
      }
    },
    [applyWithUndo],
  );

  const newDocument = useCallback(() => {
    handleTemplate(resolveTemplate("blank"));
  }, [handleTemplate]);

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
      const k = e.key.toLowerCase();
      if (mod && k === "k") {
        e.preventDefault();
        setPaletteOpen((o) => (o ? false : anyDialogOpen() ? o : true));
      } else if (mod && k === "s") {
        e.preventDefault();
        void saveLocal();
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
  }, [helpOpen, saveLocal]);

  /* ---------------- palette commands (built fresh so labels stay truthful) ---------------- */
  const commands = [
    { group: "Actions", label: "Export Word document", hint: "one click", run: doExportDocx },
    { group: "Actions", label: "Export PDF", hint: "print route", run: doExportPdf },
    { group: "Actions", label: "Save on this device", hint: "Ctrl+S", run: saveLocal },
    { group: "Actions", label: "Save project file", hint: ".docforge.json", run: saveProject },
    { group: "Actions", label: "Open project…", run: () => fileInput.current?.click() },
    { group: "Actions", label: "New document", run: () => setConfirmNew(true) },
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
    <div className="flex h-full flex-col" data-shell="">
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
        <span className="font-mono text-[11.5px] text-ink-3" aria-live="polite">
          {savedStamp ? `saved ${savedStamp}` : ""}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <TemplatesMenu onApply={handleTemplate} />
          <button type="button" className="btn-ghost" onClick={() => fileInput.current?.click()}>
            Open
          </button>
          <button type="button" className="btn-ghost" onClick={saveProject}>
            Save project
          </button>
          <button type="button" className="btn-ghost" onClick={() => setConfirmNew(true)}>
            New
          </button>
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
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
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <button
            type="button"
            className="btn-ghost"
            aria-expanded={settingsOpen}
            onClick={() => useSettingsDrawer.getState().toggle()}
          >
            Settings
          </button>
          <button type="button" className="btn-ghost" onClick={() => setHelpOpen(true)}>
            Help
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-ghost"
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? "Day desk" : "Night shift"}
          </button>
        </div>
      </header>

      {/* the desk: source galley left, the stone right */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(340px,42%)_1fr]" data-desk="">
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
          <div className="min-h-0 flex-1">
            <SourcePane viewRef={setView} />
          </div>
        </section>
        <section aria-label="Preview" className="relative min-h-0">
          <PreviewDeck controllerRef={controllerRef} onRendered={onRendered} />
          {outlineOpen && (
            <OutlinePanel
              deck={controller?.deck ?? null}
              refreshKey={renderTick}
              onClose={() => setOutlineOpen(false)}
            />
          )}
        </section>
      </div>

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
        <fieldset className="ml-auto flex items-center gap-1 border-0 p-0" aria-label="Zoom">
          <button
            type="button"
            onClick={() => zoom(-0.1)}
            className="px-1 hover:text-ink"
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
            className="px-1 hover:text-ink"
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
      <ToastRack />
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void openProjectFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
