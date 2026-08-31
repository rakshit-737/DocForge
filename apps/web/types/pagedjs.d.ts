/* pagedjs 0.4.x ships no types — the members the studio drives, typed minimally. */
declare module "pagedjs" {
  export class Handler {
    // biome-ignore lint/suspicious/noExplicitAny: chunker/polisher/caller are pagedjs internals
    constructor(chunker?: any, polisher?: any, caller?: any);
  }
  export class Previewer {
    polisher: { destroy(): void };
    preview(
      content: string,
      stylesheets: string[],
      renderTo: HTMLElement,
    ): Promise<{ pages?: unknown[]; total: number }>;
  }
  export function registerHandlers(...handlers: Array<new (...a: never[]) => unknown>): void;
}

/* The prebuilt UMD dist — same API surface; consumed by lib/bootstrap.ts. */
declare module "pagedjs/dist/paged.js" {
  export * from "pagedjs";
  const mod: typeof import("pagedjs");
  export default mod;
}
