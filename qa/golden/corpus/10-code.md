# Ingest Service: Implementation Review

## Scope and method

This review covers the scheduler core, the batch preparation script, and the
print stylesheet of the ingest service, as they stand in the release
candidate. Every fragment quoted below was lifted verbatim from the tree; the
review deliberately quotes at length, because most of the defects found in
earlier rounds lived in lines that the summaries had elided. Names such as
`ingest-service`, `lease`, and `requeue` refer to identifiers in the source,
not to concepts, and are set in the code face throughout this document.

## The scheduler core

The scheduler decides which pending jobs a worker may claim. The heart of it
is a pure function, which makes the ordering rules testable without standing
up a queue:

```javascript
// scheduler.js -- pure selection logic, no I/O
export function selectJobs(pending, capacity, now) {
  const eligible = pending.filter(job =>
    job.ready_at <= now && !job.held && job.attempts < job.max_attempts
  );
  eligible.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.enqueued_at - b.enqueued_at;         // FIFO within a class
  });
  const picked = eligible.slice(0, capacity);
  return picked.map(job => ({
    ...job,
    attempts: job.attempts + 1,
    lease_until: now + LEASE_MS,
    state: "claimed",
  }));
}

export const LEASE_MS = 60000;
```

Two observations. First, the tie-break on `enqueued_at` is what keeps the
queue fair under sustained load; earlier drafts sorted on priority alone and
starved the bulk class for hours. Second, the function never mutates its
input -- the spread copy is deliberate, and the review recommends a lint rule
to keep it that way.

## The batch preparation script

Preparation runs ahead of the scheduler and turns raw drop-folder files into
normalised batches. The script below is quoted in full because its length is
itself a finding: it has grown past the point where it should be split, and
the reviewer wants the eventual split checked against this exact text.

```python
"""prepare_batches.py -- normalise drop-folder files into batches."""

import csv
import json
import pathlib

BATCH_LIMIT = 500
ENCODINGS = ("utf-8", "latin-1")


def read_rows(path):
    """Yield dictionaries from a CSV file, trying encodings in order."""
    last_error = None
    for enc in ENCODINGS:
        try:
            with open(path, newline="", encoding=enc) as fh:
                yield from csv.DictReader(fh)
                return
        except UnicodeDecodeError as exc:
            last_error = exc
    raise last_error


def normalise(row):
    """Lower-case keys, strip whitespace, drop empty cells."""
    out = {}
    for key, value in row.items():
        if value is None:
            continue
        cleaned = value.strip()
        if cleaned:
            out[key.strip().lower()] = cleaned
    return out


def batches(rows, limit=BATCH_LIMIT):
    """Group rows into lists of at most `limit` items."""
    bucket = []
    for row in rows:
        bucket.append(row)
        if len(bucket) >= limit:
            yield bucket
            bucket = []
    if bucket:
        yield bucket


def main(source_dir, target_dir):
    src = pathlib.Path(source_dir)
    dst = pathlib.Path(target_dir)
    dst.mkdir(parents=True, exist_ok=True)
    manifest = []
    for path in sorted(src.glob("*.csv")):
        rows = (normalise(r) for r in read_rows(path))
        for index, batch in enumerate(batches(rows)):
            name = f"{path.stem}-{index:04d}.json"
            (dst / name).write_text(json.dumps(batch, indent=2))
            manifest.append({"file": name, "rows": len(batch)})
    (dst / "manifest.json").write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main("drop", "batches")
```

The encoding fallback in `read_rows` is a pragmatic choice for the files the
service actually receives, but the silent switch to `latin-1` should at least
be logged; a mis-decoded batch is far harder to diagnose downstream than a
loud failure at the door.

## The print stylesheet

Reports produced by the service are printed and archived, so the stylesheet
is part of the operational contract rather than a cosmetic afterthought:

```css
/* report.css -- print rules for archived job reports */
@page {
  size: A4;
  margin: 22mm 18mm;
}
.report-table {
  border-collapse: collapse;
  width: 100%;
}
.report-table th,
.report-table td {
  border-bottom: 0.3mm solid #444444;
  padding: 2mm 3mm;
  font-variant-numeric: tabular-nums;
}
.report-table tr {
  break-inside: avoid;
}
```

## Operational configuration

The deployment carries its configuration as a plain key-value file. The block
below is deliberately untagged, because nothing should try to colour it:

```
# ingest.conf -- one key per line, no sections
workers          = 8
lease_seconds    = 60
batch_limit      = 500
drop_dir         = /var/lib/ingest/drop
batch_dir        = /var/lib/ingest/batches
retry_backoff    = 2,4,8,16,32
alert_channel    = ops-ingest
```

## Pathological input: unbroken lines

Two lines in the wild have no break opportunities at all and must be carried
by the code block rather than the paragraph. The first is a release artifact
address, the second a minified selection expression found in a vendored file:

```
https://artifacts.example.com/releases/ingest-service/9f2c41d8/bundles/linux-x86_64/ingest-service-2.14.0-rc.3-standalone-with-vendored-dependencies.tar.gz
export const q=(a,b)=>a.filter(x=>x.ready&&!x.held).sort((x,y)=>x.due-y.due).slice(0,b).map(x=>({id:x.id,due:x.due,attempts:x.attempts+1,worker:null,lease:60}));
```

Neither line may leak outside its box in either export, and neither may be
reflowed; an address that gains a hyphen at a line break stops resolving.

## Inline fragments and special characters

The running text of this review leans on inline code, and the fragments are
chosen to be hostile. The queue accepts parameter strings such as
`retry_limit=3&mode=strict&window=250ms`, markup fragments such as
`<section data-page="4">`, boolean guards such as `a || (b && !c)`, printf
shapes such as `printf("%d\n", n)`, shell paths such as
`~/.config/ingest/rules.d`, environment references such as
`$INGEST_HOME/cache`, arithmetic over shell variables such as
`cost = $rate * $hours`, and glob patterns such as `src/**/*.spec.js`. A
literal backtick is quoted with doubled delimiters: `` the `lease` column ``.
None of these fragments may be re-styled, re-quoted, or mistaken for markup.

## Review checklist

The items below gate the release. Each one carries the fragment it refers to,
so the checklist can be worked through without opening the tree:

1. Confirm that `selectJobs` is called with a monotonic clock; `Date.now()`
   drifts under NTP correction and has broken the lease arithmetic before.
2. Verify that the lease renewal path handles the expiry race:

   ```
   lease = renew(lease, now)
   if lease is None:
       requeue(job)
   ```

3. Check that `manifest.json` is written last, after every batch file it
   names, so a half-written run is never mistaken for a complete one.
4. Re-run the soak test with `workers = 1` to confirm that ordering is stable
   when the pool cannot mask an unstable sort.

:::important Hold the release until this lands
The exporter must guard the empty-manifest case before the candidate ships:

```javascript
function verifyManifest(m) {
  if (!m || !m.entries.length) throw new Error("empty manifest");
  return m.entries.every(isSealed);
}
```
:::

## Sign-off

With the callout above resolved and the checklist worked through, the
reviewer recommends promotion of the candidate. The quoted fragments in this
document are the reference copies; any divergence between them and the tree
at tag time voids the review and returns the candidate to the queue.
