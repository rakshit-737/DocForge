/* Publish build — the workspace consumes src/*.ts directly (Next transpiles
   it, the single-file build bundles it), so this exists only for npm.

   tsc emits ESM plus declarations into dist/, then every relative specifier
   gains its .js extension: the sources keep them extensionless because
   Turbopack cannot map .js → .ts inside transpilePackages, and Node's ESM
   resolver cannot load them without. Emitted code is machine-written, so the
   rewrite sees only clean `from "./x"` / `import("./x")` forms. */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
rmSync(dist, { recursive: true, force: true });

/* The workspace's own tsc, run as a plain script: no shell, so the same line
   works on Windows (where spawning npx.cmd without a shell is EINVAL).
   TypeScript 7's exports map covers only the library entries, so the binary
   is located from the package.json it does export. */
const tsc = join(
  dirname(createRequire(import.meta.url).resolve("typescript/package.json")),
  "bin",
  "tsc",
);
execFileSync(process.execPath, [tsc, "-p", join(here, "tsconfig.build.json")], {
  stdio: "inherit",
  cwd: here,
});

const RELATIVE = /(from\s+|import\s*\(\s*)(["'])(\.\.?\/[^"']+)\2/g;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
    } else if (/\.(js|d\.ts)$/.test(name)) {
      const src = readFileSync(p, "utf8");
      const out = src.replace(RELATIVE, (m, lead, q, spec) =>
        /\.(js|json|css)$/.test(spec) ? m : `${lead}${q}${spec}.js${q}`,
      );
      if (out !== src) writeFileSync(p, out);
    }
  }
};
walk(dist);
console.log(`built ${dist}`);
