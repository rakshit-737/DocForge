/* Node-environment tests for pdf-editor's PURE helpers, reached through the
   additive _internals export — nothing was extracted or changed to test this.
   The browser flow (open/paint/pointer tools/exportPdf against real pdf.js +
   pdf-lib) is integration-proved by qa/pdfedit-smoke.mjs at rewire time.

   The baseline invariant itself (yTop = pageH − baseline − 0.83·size on
   extraction, y = H − yTop − 0.83·size at export, so a rewrite lands on the
   original baseline) lives inline in ensureLines/exportPdf and is not
   extractable without changing code — the smoke test owns it. */
import { describe, it, expect } from "vitest";
import { _internals, api } from "../src/index.js";

const { encodeWith, wrapWidth, wrapLines, hexRgb, clamp } = _internals;

/* ---------- public surface (the classic PdfEditor global, exactly) ---------- */

describe("public surface", () => {
  it("exposes exactly the classic PdfEditor members", () => {
    expect(Object.keys(api).sort()).toEqual([
      "addEdit", "close", "editLineAt", "exportPdf", "getEdits",
      "getTextLines", "hasEdits", "hooks", "isOpen", "open",
    ]);
  });
  it("starts closed, clean and empty", () => {
    expect(api.isOpen()).toBe(false);
    expect(api.hasEdits()).toBe(false);
    expect(api.getEdits()).toBeInstanceOf(Map);
    expect(api.getEdits().size).toBe(0);
  });
  it("default hooks are silent no-ops that confirm", async () => {
    expect(api.hooks.toast("anything", "warn")).toBeUndefined();
    await expect(api.hooks.confirm()).resolves.toBe(true);
  });
});

/* ---------- encodeWith: charcodes -> hex show-string ---------- */

describe("encodeWith", () => {
  const rev = new Map<string, number>([
    ["A", 0x41], ["B", 0x42], ["z", 0x7a], ["\u0001", 1],
    ["→", 0x2192],        // only reachable through a 2-byte (Type0) resource
    ["é", 0xe9],
  ]);

  describe("simple (1-byte) resources pad to 2 hex digits", () => {
    it.each([
      ["AB", "4142"],
      ["z", "7a"],
      ["é", "e9"],
      ["\u0001", "01"],
      ["", ""],
    ])("%j -> %j", (s, hex) => {
      expect(encodeWith(rev, false, s)).toBe(hex);
    });
  });

  describe("Type0 resources pad to 4 hex digits", () => {
    it.each([
      ["AB", "00410042"],
      ["→", "2192"],
      ["A→", "00412192"],
      ["\u0001", "0001"],
      ["", ""],
    ])("%j -> %j", (s, hex) => {
      expect(encodeWith(rev, true, s)).toBe(hex);
    });
  });

  describe("null means 'this font cannot carry that string'", () => {
    it.each([
      ["a glyph outside the subset", "AQ", false],
      ["a charcode above 255 through a 1-byte resource", "→", false],
      ["one bad character poisons the whole line", "AB→", false],
      ["outside the subset even for Type0", "Q", true],
    ])("%s", (_name, s, type0) => {
      expect(encodeWith(rev, type0, s)).toBeNull();
    });
  });

  it("iterates by code point, so an astral-plane char is one lookup (and misses)", () => {
    // rev maps only single UTF-16 units (u.length === 1), so a surrogate
    // pair can never be present — the native path refuses, and the caller
    // falls back to a standard face.
    expect(encodeWith(rev, true, "𝒜")).toBeNull();
  });
});

/* ---------- hexRgb: #rrggbb -> pdf-lib rgb() ---------- */

describe("hexRgb", () => {
  const rgb = (red: number, green: number, blue: number) => ({ red, green, blue });

  it.each([
    ["#ffffff", { red: 1, green: 1, blue: 1 }],
    ["#000000", { red: 0, green: 0, blue: 0 }],
    ["#ff0000", { red: 1, green: 0, blue: 0 }],
    ["#0080ff", { red: 0, green: 128 / 255, blue: 1 }],
    ["112233", { red: 0x11 / 255, green: 0x22 / 255, blue: 0x33 / 255 }], // leading # optional
    ["#FFAA00", { red: 1, green: 0xaa / 255, blue: 0 }],                   // case-insensitive
  ])("%s", (hex, expected) => {
    expect(hexRgb(hex, rgb)).toEqual(expected);
  });

  it.each([
    ["short form is not accepted", "#fff"],
    ["empty string", ""],
    ["garbage", "zzzzzz"],
    ["too long", "#1234567"],
  ])("falls back to black: %s", (_name, hex) => {
    expect(hexRgb(hex, rgb)).toEqual({ red: 0, green: 0, blue: 0 });
  });
});

/* ---------- wrapWidth: greedy word wrap under a measure function ---------- */

describe("wrapWidth", () => {
  const byLength = (s: string) => s.length; // 1 unit per char

  it.each([
    ["short line stays whole", "alpha beta", 20, ["alpha beta"]],
    ["wraps at word boundaries", "aaa bbb ccc", 3.5, ["aaa", "bbb", "ccc"]],
    ["fills greedily", "aa bb cc dd", 5, ["aa bb", "cc dd"]],
    ["exact fit does not wrap (strictly greater-than)", "aaa bb", 6, ["aaa bb"]],
    ["an overlong first word is never split", "aaaaaaaaaa b", 4, ["aaaaaaaaaa", "b"]],
    ["blank lines survive", "a\n\nb", 80, ["a", "", "b"]],
    ["CRLF splits like LF", "a\r\nb", 80, ["a", "b"]],
    ["whitespace-only line becomes empty", "a\n   \nb", 80, ["a", "", "b"]],
    ["runs of spaces collapse to single separators", "a    b", 80, ["a b"]],
    ["empty text is one empty line", "", 80, [""]],
  ])("%s", (_name, text, maxW, expected) => {
    expect(wrapWidth(text, byLength, maxW)).toEqual(expected);
  });
});

/* ---------- wrapLines: wrapWidth through a pdf-lib font, with the
     un-encodable-glyph measurement fallback ---------- */

describe("wrapLines", () => {
  const plainFont = {
    widthOfTextAtSize: (s: string, size: number) => s.length * size,
  };

  it("measures through widthOfTextAtSize at the given size", () => {
    expect(wrapLines("aa bb cc", plainFont, 10, 50)).toEqual(["aa bb", "cc"]);
  });

  it("swaps non-WinAnsi glyphs for '?' when measurement throws", () => {
    const winAnsiOnly = {
      widthOfTextAtSize: (s: string, size: number) => {
        if (/[^\x20-\xFF]/.test(s)) throw new Error("no glyph");
        return s.length * size;
      },
    };
    // "→→" measures as "??" (width 2·10) via the catch path — same wrap
    // decisions as two ordinary characters, no exception escapes.
    expect(wrapLines("→→ x →→", winAnsiOnly, 10, 45)).toEqual(["→→ x", "→→"]);
  });
});

/* ---------- clamp ---------- */

describe("clamp", () => {
  it.each([
    [5, 0, 10, 5],
    [-1, 0, 10, 0],
    [11, 0, 10, 10],
    [0.5, 0.5, 3, 0.5],
  ])("clamp(%d, %d, %d) = %d", (v, a, b, expected) => {
    expect(clamp(v, a, b)).toBe(expected);
  });
});
