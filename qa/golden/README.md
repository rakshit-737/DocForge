# Golden master

The output contract. `corpus/` holds torture documents exercising every dialect construct
(one file per cluster; `qa/torture.md` is the original kitchen sink). `matrix.mjs` maps
documents × settings — every theme, paper size, margin preset, border style/weight/colour
and citation style appears in at least one case, and every case pins an explicit date so
captures never depend on the day they run.

## The merge gate

```
node qa/golden/run.mjs --against v1-classic
```

Builds the `v1-classic` tag in a throwaway worktree, builds HEAD, captures both through the
real UI (headless Chromium), and compares:

- **preview** — screenshot of every rendered `.pagedjs_page`
- **pdf** — Chromium print-to-PDF (the same engine as the in-app print dialog), rasterised
  per page; PDF bytes themselves are never compared (they carry a CreationDate)
- **docx** — exported archive unzipped; XML members normalised and hashed, embedded-font
  binaries hashed raw, `docProps/` skipped (timestamps)

A case marked `postBaseline: true` in the matrix exercises markup the baseline edition
does not have — `:::banner` is the first — so the baseline prints it as literal text and
the difference is the feature, not a regression. Those cases are captured on both sides
and compared on neither by this gate; `--compare before after` below still covers them in
full, which is where a change to the new construct has to be checked.

Pass = identical hashes, or PNGs within 0.1% differing pixels (anti-aliasing tolerance).
Failures get a magenta diff mask in `qa/out/golden/diff/` for review. The baseline is never
stored in git — it is the tag itself, rebuilt fresh, so both sides rasterise on the same
machine and platform font differences can't fake a regression. CI runs this on every push
and PR (`.github/workflows/golden.yml`).

## Day-to-day

```
node qa/golden/run.mjs --capture before            # snapshot current dist/
node qa/golden/run.mjs --capture after             # … after your change
node qa/golden/run.mjs --compare before after
node qa/golden/run.mjs --against v1-classic --only tables,math --jobs 2
```

Captures land in `qa/out/golden/<label>/` (gitignored). If a diff is intentional, show the
masks and get sign-off — "it looks about the same" is never acceptance (MASTER-PROMPT §5.1).
