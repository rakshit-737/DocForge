/* ============================================================
   build.mjs — bundle src/cli.ts → dist/cli.mjs.

   Uses the ROOT esbuild via a relative import of the root
   node_modules (the same trick as the repo's build.mjs): the CLI
   package carries no esbuild of its own, and this build must work
   before the workspace has linked the new package.

   The workspace packages (@docforge/engine, @docforge/export-docx
   and, through the exporter, @docforge/mathml-omml) are INLINED via
   absolute-path aliases — no node_modules linking needed at build
   time, and esbuild's lazy __esm wrappers keep their import-time
   side effects (marked.use) behind the CLI's global assignments,
   exactly like the studio's dynamic-import bootstrap. The npm
   libraries stay external: they are real dependencies, resolved
   from node_modules at run time.
   ============================================================ */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "../../node_modules/esbuild/lib/main.js";

const here = dirname(fileURLToPath(import.meta.url));

buildSync({
  entryPoints: [resolve(here, "src/cli.ts")],
  outfile: resolve(here, "dist/cli.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
  alias: {
    "@docforge/engine": resolve(here, "../engine/src/index.ts"),
    "@docforge/export-docx": resolve(here, "../export-docx/src/index.ts"),
    "@docforge/mathml-omml": resolve(here, "../mathml-omml/src/index.ts"),
  },
  // playwright-core is a ROOT dependency, imported dynamically by --pdf only —
  // external so Node resolves it by its ordinary walk-up at run time.
  external: [
    "happy-dom",
    "marked",
    "katex",
    "highlight.js",
    "highlight.js/*",
    "docx",
    "playwright-core",
  ],
  logLevel: "info",
});
