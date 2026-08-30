/* Golden-master orchestrator.

   node qa/golden/run.mjs --against v1-classic      the merge gate: build the baseline
                                                    ref in a throwaway worktree, build
                                                    HEAD, capture both, compare
   node qa/golden/run.mjs --capture <label>         capture the current dist/ under a label
   node qa/golden/run.mjs --compare <a> <b>         compare two capture labels
   Options: --only id1,id2   --scale N   --dist path/to/DocForge.html

   Captures land in qa/out/golden/<label>/ (gitignored). The baseline is never stored
   in git — it is the v1-classic tag itself, rebuilt fresh, so both sides rasterise on
   the same machine and platform font differences can't masquerade as regressions. */
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { capture } from "./capture.mjs";
import { compare } from "./compare.mjs";
import { CASES } from "./matrix.mjs";
import { launch } from "../_browser.mjs";

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
const only = arg("only", null)?.split(",") ?? null;
const scale = +arg("scale", 2);
const jobs = +arg("jobs", 0);
const OUT = resolve("qa/out/golden");

const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit" });

async function captureLabel(label, distPath, browser) {
  console.log(`\ncapture [${label}] ← ${distPath}`);
  return capture(distPath, join(OUT, label), { only, scale, browser, jobs });
}

if (arg("against", null)) {
  const ref = arg("against");
  const wt = mkdtempSync(join(tmpdir(), "docforge-golden-"));
  let ok = false;
  try {
    console.log(`building baseline ${ref} in ${wt} …`);
    sh(`git worktree add --detach "${wt}" ${ref}`);
    sh("npm ci --no-audit --no-fund", wt);
    sh("node build.mjs", wt);

    console.log("building HEAD …");
    sh("node build.mjs");

    const browser = await launch();
    try {
      await captureLabel("baseline", join(wt, "dist", "DocForge.html"), browser);
      await captureLabel("current", arg("dist", "dist/DocForge.html"), browser);
    } finally {
      await browser.close();
    }
    /* Cases the baseline edition cannot render — they exercise markup added after the
       tag, so the baseline prints it as literal text. Captured on both sides, compared
       on neither; `--compare before after` still covers them fully. */
    const exempt = CASES.filter(c => c.postBaseline).map(c => c.id);
    ok = compare(join(OUT, "baseline"), join(OUT, "current"), { reportDir: join(OUT, "diff"), exempt }).ok;
  } finally {
    try { sh(`git worktree remove --force "${wt}"`); } catch { rmSync(wt, { recursive: true, force: true }); }
  }
  process.exit(ok ? 0 : 1);
} else if (arg("capture", null)) {
  const dist = arg("dist", "dist/DocForge.html");
  if (!existsSync(dist)) sh("node build.mjs");
  const m = await captureLabel(arg("capture"), dist);
  const failed = Object.entries(m.cases).filter(([, c]) => c.failed);
  process.exit(failed.length ? 1 : 0);
} else if (arg("compare", null)) {
  const ok = compare(join(OUT, arg("compare")), join(OUT, argv[argv.indexOf("--compare") + 2]), { reportDir: join(OUT, "diff") }).ok;
  process.exit(ok ? 0 : 1);
} else {
  console.log("usage: run.mjs --against <ref> | --capture <label> | --compare <a> <b>  [--only ids] [--scale n] [--dist path]");
  process.exit(2);
}
