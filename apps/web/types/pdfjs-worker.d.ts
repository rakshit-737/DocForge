/* pdfjs-dist types only its main entry; the worker bundle ships untyped.
   lib/imports.ts imports it for its side effect (it assigns
   globalThis.pdfjsWorker = { WorkerMessageHandler } as it evaluates, which
   puts pdf.js on its main-thread fake-worker path) — typed minimally here,
   following the types/pagedjs.d.ts convention. */
declare module "pdfjs-dist/build/pdf.worker.min.mjs" {
  export const WorkerMessageHandler: unknown;
}
