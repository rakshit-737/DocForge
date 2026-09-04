# Spec — Version history (§8.1, Phase 6 wave 1)

**One line:** the studio keeps a local timeline of the document and can put any
past state back, so "your work is never lost" stops being a claim about
autosave and becomes something you can look at.

## Why this one first

Wave 1's other items either need a dependency the owner has not signed off
(citeproc-js for real CSL, Mermaid) or change export bytes (custom font
upload). Version history needs nothing new, touches no export path, and is the
strongest answer to the audience's actual fear — the deadline-eve document that
went wrong an hour ago. It also retires the last of the destructive-replace
worry: a template load, an import, a bad restore all become reversible past the
lifetime of one Undo toast.

## What it is

- **Automatic snapshots.** After the document has been quiet for 20 s, a
  snapshot is taken if either three minutes have passed since the last one or
  the source has moved by 500+ characters. Idle typing bursts therefore cost
  one snapshot, not one per keystroke.
- **Manual checkpoints.** "Save a checkpoint" from the palette (or the panel)
  writes one immediately, with an optional label.
- **A timeline.** Newest first: time, kind, an optional label, the word count
  and its delta against the document as it stands.
- **A diff.** Selecting an entry shows a line-level diff of its source against
  the current source — what would come back, and what would go away.
- **Restore.** One click. The restore goes through `applyWithUndo`, so the
  toast's Undo still works, *and* a checkpoint of the pre-restore state is
  written first, so the road back exists even after the toast is gone.

## What a snapshot holds

`{ id, at, kind: "auto" | "manual", label?, source, settings, words }`

Source and settings only. **Attachments are deliberately not copied**: they are
content-addressed by key in the live document, an image can be several
megabytes, and 60 snapshots of a photo-heavy manuscript would eat the origin's
quota for no gain. A restored source resolves every attachment key that still
exists, which is all of them unless the reader has removed one.

## Storage and pruning

The existing `docforge` IndexedDB database gains a `versions` store (schema
version 2, created in the same `upgrade` path so an existing reader's documents
survive untouched), keyed by id with a `by-time` index.

The cap is 60 entries per document. Pruning drops the **oldest automatic**
entries first and only touches manual checkpoints when manual entries alone
exceed the cap — a deliberate act should outlive a machine-made one.

## Not in this pass

- Rendered (side-by-side page) diff — the source diff is the honest half that
  fits; the rendered half wants the compose pipeline and its own design pass.
- Per-document timelines beyond the `current` slot — that arrives with the
  multi-document workspace (§8.1), which is what the store's key shape is for.
- Snapshot export/import. The `.docforge.json` project file remains the way a
  document travels between machines.

## Gate

Pure-logic unit tests for the snapshot policy, the pruning order and the diff;
a live probe on the built studio: edit → checkpoint → edit again → the panel
lists both states with an honest diff → restore puts the earlier text back →
the pre-restore checkpoint exists. Golden corpus untouched (no engine, no
export path is involved).
