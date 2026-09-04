"use client";
/* ============================================================
   launch-files.ts — the installed app, handed a file (§8.5).

   Two roads in from the operating system, both additive and both
   silent when the platform doesn't offer them:

     · File handling — double-click a .md, a .docforge.json or a
       .docx and the OS launches DocForge with the file's HANDLE.
       That handle is adopted, so Save writes straight back to the
       file the reader opened, exactly as the in-app Open road does.

     · Share target — text or a link shared to DocForge arrives as
       query parameters on /studio. GET, so no service-worker
       interception is needed and it works the moment the app is
       installed.

   Nothing here replaces the live document: a launched file opens as
   its own document (the workspace's rule), and a share becomes a new
   one too.
   ============================================================ */
import { adoptExternalHandle, fileFromHandle } from "./project-file";

interface LaunchParams {
  files?: unknown[];
}
interface LaunchQueue {
  setConsumer(fn: (params: LaunchParams) => void): void;
}

/* ONE consumer per page, whatever the shell's re-renders do. setConsumer is
   meant to be called once: a second consumer re-delivers the same launch, and
   the file opens twice (the probe caught exactly that). The opener is kept in
   a module slot instead, so a re-render refreshes the callback without
   registering again. */
let armed = false;
let opener: ((file: File) => Promise<boolean>) | null = null;

/** Arm the file-handling road. `open` receives the file and reports whether
    the document actually loaded; only then is the handle adopted. Does
    nothing at all where the API is missing. */
export function armLaunchQueue(open: (file: File) => Promise<boolean>): () => void {
  opener = open;
  const q = (window as unknown as { launchQueue?: LaunchQueue }).launchQueue;
  if (!q || typeof q.setConsumer !== "function") return () => {};
  if (armed) return () => {};
  armed = true;
  q.setConsumer((params) => {
    const handles = params?.files ?? [];
    if (!handles.length) return;
    void (async () => {
      /* One document per launch: the OS may hand over several files, and each
         becomes its own document rather than a merge nobody asked for. The
         handle is claimed only AFTER the document loads — opening one clears
         the open-file target by design, so adopting first would be undone. */
      for (const handle of handles) {
        try {
          const file = await fileFromHandle(handle);
          if (!file || !opener) continue;
          if (await opener(file)) await adoptExternalHandle(handle);
        } catch {
          /* a revoked permission or a vanished file — the desk stays as it was */
        }
      }
    })();
  });
  /* The consumer outlives a re-render on purpose; there is nothing to undo. */
  return () => {};
}

export interface SharedPayload {
  title: string;
  text: string;
  url: string;
}

/** Read a share-target arrival off the URL, and scrub it from the address bar
    so a reload doesn't paste the same thing twice. Null when this wasn't one. */
export function consumeSharedPayload(): SharedPayload | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const title = params.get("title") ?? "";
  const text = params.get("text") ?? "";
  const url = params.get("url") ?? "";
  if (!title && !text && !url) return null;
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch {
    /* history is unavailable in some embeddings; the payload still opens */
  }
  return { title, text, url };
}

/** A shared payload as a manuscript: the title becomes a heading, a shared
    link becomes a link, and the text is kept verbatim underneath. */
export function sharedToMarkdown(p: SharedPayload): string {
  const parts: string[] = [];
  if (p.title.trim()) parts.push(`# ${p.title.trim()}`);
  if (p.text.trim()) parts.push(p.text.trim());
  if (p.url.trim()) parts.push(`[${p.url.trim()}](${p.url.trim()})`);
  return `${parts.join("\n\n")}\n`;
}
