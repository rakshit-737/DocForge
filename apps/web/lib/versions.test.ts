/* The version timeline's judgement calls, all of which are pure: when a quiet
   desk earns a snapshot, which snapshots fall off the end, and what the diff
   says came and went. The IndexedDB half is driven by the live probe. */
import { describe, expect, it } from "vitest";
import {
  CAP,
  condense,
  countWords,
  diffLines,
  MIN_CHARS,
  MIN_GAP_MS,
  pruneVictims,
  shouldSnapshot,
  type Version,
} from "./versions";

const NOW = 1_800_000_000_000;

describe("shouldSnapshot", () => {
  it("takes the first snapshot of a real document", () => {
    expect(shouldSnapshot(NOW, "# Title\n\nBody.", null)).toBe(true);
  });

  it("never snapshots an empty document", () => {
    expect(shouldSnapshot(NOW, "   \n\n ", null)).toBe(false);
  });

  it("declines when nothing changed", () => {
    const src = "# Title";
    expect(shouldSnapshot(NOW, src, { at: NOW - MIN_GAP_MS * 2, source: src })).toBe(false);
  });

  it("takes one once the gap has passed", () => {
    expect(shouldSnapshot(NOW, "# Title v2", { at: NOW - MIN_GAP_MS, source: "# Title" })).toBe(
      true,
    );
  });

  it("declines a small edit inside the gap", () => {
    expect(shouldSnapshot(NOW, "# Title!", { at: NOW - 10_000, source: "# Title" })).toBe(false);
  });

  it("takes one for a big edit inside the gap", () => {
    expect(
      shouldSnapshot(NOW, `# Title${"x".repeat(MIN_CHARS)}`, {
        at: NOW - 10_000,
        source: "# Title",
      }),
    ).toBe(true);
  });

  it("counts a big DELETION too — losing 600 characters is the moment you want back", () => {
    const long = `# Title${"x".repeat(MIN_CHARS + 100)}`;
    expect(shouldSnapshot(NOW, "# Title", { at: NOW - 10_000, source: long })).toBe(true);
  });
});

const mk = (id: string, at: number, kind: Version["kind"]): Version => ({
  id,
  at,
  kind,
  docId: "current",
  source: id,
  settings: {} as Version["settings"],
  words: 1,
});

describe("pruneVictims", () => {
  it("keeps everything under the cap", () => {
    const list = Array.from({ length: CAP }, (_, i) => mk(`a${i}`, NOW - i * 1000, "auto"));
    expect(pruneVictims(list)).toEqual([]);
  });

  it("drops the oldest automatic entries first", () => {
    const list = [
      mk("newest", NOW, "auto"),
      mk("manual-old", NOW - 9000, "manual"),
      mk("auto-old", NOW - 8000, "auto"),
      mk("auto-oldest", NOW - 10_000, "auto"),
    ];
    expect(pruneVictims(list, 2)).toEqual(["auto-oldest", "auto-old"]);
  });

  it("spares checkpoints until only checkpoints are left", () => {
    const list = [
      mk("m1", NOW - 1000, "manual"),
      mk("m2", NOW - 2000, "manual"),
      mk("m3", NOW - 3000, "manual"),
    ];
    expect(pruneVictims(list, 2)).toEqual(["m3"]);
  });

  it("never drops more than the excess", () => {
    const list = Array.from({ length: 10 }, (_, i) => mk(`a${i}`, NOW - i * 1000, "auto"));
    expect(pruneVictims(list, 7)).toHaveLength(3);
  });
});

describe("diffLines", () => {
  it("reports an untouched document as all context", () => {
    const rows = diffLines("one\ntwo", "one\ntwo");
    expect(rows.every((r) => r.type === "same")).toBe(true);
  });

  it("names what the snapshot would bring back and what stands now", () => {
    const rows = diffLines("one\nold line\nthree", "one\nnew line\nthree");
    expect(rows.filter((r) => r.type === "del").map((r) => r.text)).toEqual(["old line"]);
    expect(rows.filter((r) => r.type === "add").map((r) => r.text)).toEqual(["new line"]);
    expect(rows.filter((r) => r.type === "same").map((r) => r.text)).toEqual(["one", "three"]);
  });

  it("handles pure insertion and pure deletion", () => {
    expect(
      diffLines("a", "a\nb")
        .filter((r) => r.type === "add")
        .map((r) => r.text),
    ).toEqual(["b"]);
    expect(
      diffLines("a\nb", "a")
        .filter((r) => r.type === "del")
        .map((r) => r.text),
    ).toEqual(["b"]);
  });

  it("degrades honestly instead of hanging on runaway input", () => {
    const huge = Array.from({ length: 4100 }, (_, i) => `line ${i}`).join("\n");
    const rows = diffLines(huge, `${huge}\nmore`);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.text).toContain("4100 lines");
  });
});

describe("condense", () => {
  it("collapses long unchanged runs into a gap row", () => {
    const rows = diffLines(
      ["a", ...Array.from({ length: 20 }, (_, i) => `line ${i}`), "old"].join("\n"),
      ["a", ...Array.from({ length: 20 }, (_, i) => `line ${i}`), "new"].join("\n"),
    );
    const out = condense(rows);
    expect(out.some((r) => r.type === "gap")).toBe(true);
    expect(out.length).toBeLessThan(rows.length);
    expect(out.some((r) => r.type === "del" && r.text === "old")).toBe(true);
    expect(out.some((r) => r.type === "add" && r.text === "new")).toBe(true);
  });

  it("leaves a small diff alone", () => {
    const rows = diffLines("one\nold", "one\nnew");
    expect(condense(rows).filter((r) => r.type === "gap")).toHaveLength(0);
  });
});

describe("countWords", () => {
  it("counts words, not characters", () => {
    expect(countWords("  one two  three \n four ")).toBe(4);
    expect(countWords("   ")).toBe(0);
  });
});
