/* ============================================================
   Word-ribbon inline marks — table-driven per construct.
   Expected fragments are copied from the ACTUAL output of
   src/js/engine.js (marked 18.0.11 + the dialect extensions),
   captured via a Node harness on 2026-08-30.
   ============================================================ */
import { describe, expect, it } from "vitest";
import { HL_COLORS } from "../src/index.js";
import { body, norm } from "./_helpers.js";

const CASES: [string, string][] = [
  // ---- ++underline++ ----
  ["++underline++", "<p><u>underline</u></p>\n"],
  ["a ++ul++ b", "<p>a <u>ul</u> b</p>\n"],
  ["++two words++", "<p><u>two words</u></p>\n"],
  ["i++ +j++ stays", "<p>i++ +j++ stays</p>\n"], // closer must not run into a word
  ["++x++y literal", "<p>++x++y literal</p>\n"],
  ["++**bold under**++", "<p><u><strong>bold under</strong></u></p>\n"],
  ["++a `code` b++", "<p><u>a <code>code</code> b</u></p>\n"],
  ["\\++not a rule++", "<p>++not a rule++</p>\n"], // escaped stays inert
  ["++ spaced ++", "<p>++ spaced ++</p>\n"], // content must start/end on \S
  ["++a++++b++", "<p><u>a+</u>+b++</p>\n"], // greedy content quirk, frozen

  // ---- ==mark== / =={colour}mark== ----
  ["==mark==", '<p><mark data-hl="yellow" style="background:#FFFF00">mark</mark></p>\n'],
  ["=={green}go==", '<p><mark data-hl="green" style="background:#00FF00">go</mark></p>\n'],
  ["=={GREEN}shout==", '<p><mark data-hl="green" style="background:#00FF00">shout</mark></p>\n'], // caseless
  ["=={darkblue}low==", '<p><mark data-hl="darkBlue" style="background:#00008B">low</mark></p>\n'], // canonicalized
  [
    "=={bogus}fallback==",
    '<p><mark data-hl="yellow" style="background:#FFFF00">fallback</mark></p>\n',
  ], // unknown → yellow
  ["done==1 and i==n", "<p>done==1 and i==n</p>\n"], // prose operators stay literal
  ["==m==x literal", "<p>==m==x literal</p>\n"],
  [
    "==a **b** c==",
    '<p><mark data-hl="yellow" style="background:#FFFF00">a <strong>b</strong> c</mark></p>\n',
  ],
  ["\\==review pending==", "<p>==review pending==</p>\n"],

  // ---- ^sup^ / ~sub~ ----
  ["x^2^", "<p>x<sup>2</sup></p>\n"],
  ["10^6^ cells", "<p>10<sup>6</sup> cells</p>\n"],
  ["2^**10**^", "<p>2<sup><strong>10</strong></sup></p>\n"],
  ["m^2 ^ literal", "<p>m^2 ^ literal</p>\n"], // no interior space
  ["a ^ b", "<p>a ^ b</p>\n"],
  ["H~2~O", "<p>H<sub>2</sub>O</p>\n"],
  ["x~i~ and x~j~", "<p>x<sub>i</sub> and x<sub>j</sub></p>\n"],
  ["k~B~^2^", "<p>k<sub>B</sub><sup>2</sup></p>\n"],
  ["~sub~", "<p><sub>sub</sub></p>\n"],
  ["~~strike~~", "<p><del>strike</del></p>\n"], // doubled tilde stays GFM strikethrough
  ["~~ lone doubled", "<p>~~ lone doubled</p>\n"],
  ["~40 boxes", "<p>~40 boxes</p>\n"],
  ["a ~ b", "<p>a ~ b</p>\n"],
  // dfSub rejects interior space, and marked's GFM tokenizer then takes ~a b~
  // as single-tilde strikethrough — frozen behavior of the classic build.
  ["x~a b~ literal", "<p>x<del>a b</del> literal</p>\n"],

  // ---- codespan protection & extension-vs-codespan ordering ----
  [
    "`==not a highlight== ++not a rule++`",
    "<p><code>==not a highlight== ++not a rule++</code></p>\n",
  ],
  ['`i++ == "raw"`', "<p><code>i++ == &quot;raw&quot;</code></p>\n"],
  ["a `~x~` b", "<p>a <code>~x~</code> b</p>\n"],

  // ---- nesting ----
  [
    "++==an underlined highlight==++",
    '<p><u><mark data-hl="yellow" style="background:#FFFF00">an underlined highlight</mark></u></p>\n',
  ],
  [
    "==++a highlighted underline++==",
    '<p><mark data-hl="yellow" style="background:#FFFF00"><u>a highlighted underline</u></mark></p>\n',
  ],
  [
    "~~an estimate containing ==its own marked correction== inside~~",
    '<p><del>an estimate containing <mark data-hl="yellow" style="background:#FFFF00">its own marked correction</mark> inside</del></p>\n',
  ],
  [
    "==a highlight carrying ~~struck words~~ inside==",
    '<p><mark data-hl="yellow" style="background:#FFFF00">a highlight carrying <del>struck words</del> inside</mark></p>\n',
  ],
  [
    "==the corrected H~2~O yield of 10^3^ units==",
    '<p><mark data-hl="yellow" style="background:#FFFF00">the corrected H<sub>2</sub>O yield of 10<sup>3</sup> units</mark></p>\n',
  ],
];

describe("inline marks (1:1 with classic engine.js)", () => {
  it.each(CASES)("%s", (md, expected) => {
    expect(body(md)).toBe(norm(expected));
  });
});

describe("the full highlighter palette", () => {
  const HEX: Record<string, string> = {
    yellow: "FFFF00",
    green: "00FF00",
    cyan: "00FFFF",
    magenta: "FF00FF",
    blue: "0000FF",
    red: "FF0000",
    darkBlue: "00008B",
    darkCyan: "008B8B",
    darkGreen: "006400",
    darkMagenta: "8B008B",
    darkRed: "8B0000",
    darkYellow: "808000",
    darkGray: "808080",
    lightGray: "D3D3D3",
    black: "000000",
  };
  it("HL_COLORS is exactly Word's fifteen, in catalogue order", () => {
    expect(HL_COLORS).toEqual(HEX);
    expect(Object.keys(HL_COLORS)).toEqual(Object.keys(HEX)); // insertion order is API
  });
  it.each(Object.entries(HEX))("=={%s}…== renders name and hex", (name, hex) => {
    expect(body(`=={${name}}word==`)).toBe(
      norm(`<p><mark data-hl="${name}" style="background:#${hex}">word</mark></p>\n`),
    );
  });
  it("adjacent marks on one line fuse across the space (frozen quirk)", () => {
    // The greedy optional content group prefers the longer match; the classic
    // build behaves identically, so the quirk is part of the contract.
    expect(
      body("=={yellow}y== =={green}g== =={cyan}c== =={magenta}m== =={blue}b== =={red}r=="),
    ).toBe(
      norm(
        '<p><mark data-hl="yellow" style="background:#FFFF00">y== =={green}g</mark> <mark data-hl="cyan" style="background:#00FFFF">c== =={magenta}m</mark> <mark data-hl="blue" style="background:#0000FF">b== =={red}r</mark></p>\n',
      ),
    );
  });
});
