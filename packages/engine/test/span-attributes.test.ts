/* ============================================================
   `[text]{…}` span attributes — the full matrix. Expected fragments
   copied from the ACTUAL output of src/js/engine.js (captured via a
   Node harness on 2026-08-30). parseSpanAttrs is also unit-tested
   directly, since docx-export consumes the same data-* contract.
   ============================================================ */
import { describe, expect, it } from "vitest";
import { parseSpanAttrs } from "../src/parse.js";
import { body, norm } from "./_helpers.js";

const RENDERED: [string, string][] = [
  [
    "[text]{color=#c00}",
    '<p><span class="dfspan" data-color="cc0000" style="color:#c00;">text</span></p>\n',
  ],
  [
    "[t]{color=c00}",
    '<p><span class="dfspan" data-color="cc0000" style="color:#c00;">t</span></p>\n',
  ], // bare hex gets the #
  [
    "[t]{color=#CC0000}",
    '<p><span class="dfspan" data-color="cc0000" style="color:#cc0000;">t</span></p>\n',
  ], // lowercased
  [
    "[t]{bg=#ffe28a}",
    '<p><span class="dfspan" data-bg="ffe28a" style="background:#ffe28a;">t</span></p>\n',
  ],
  [
    "[t]{bg=ffe28a}",
    '<p><span class="dfspan" data-bg="ffe28a" style="background:#ffe28a;">t</span></p>\n',
  ],
  ["[t]{size=14}", '<p><span class="dfspan" data-size="14" style="font-size:14pt;">t</span></p>\n'],
  ["[t]{size=5}", '<p><span class="dfspan" data-size="5" style="font-size:5pt;">t</span></p>\n'], // bounds inclusive
  ["[t]{size=96}", '<p><span class="dfspan" data-size="96" style="font-size:96pt;">t</span></p>\n'],
  ["[t]{size=4}", "<p>[t]{size=4}</p>\n"], // out of range → not a span
  ["[t]{size=97}", "<p>[t]{size=97}</p>\n"],
  [
    '[t]{font="Georgia"}',
    '<p><span class="dfspan" data-font="Georgia" style="font-family:&quot;Georgia&quot;, Georgia, serif;">t</span></p>\n',
  ],
  [
    "[t]{font=Consolas}",
    '<p><span class="dfspan" data-font="Consolas" style="font-family:&quot;Consolas&quot;, Consolas, monospace;">t</span></p>\n',
  ],
  [
    '[t]{font="Times New Roman"}',
    '<p><span class="dfspan" data-font="Times New Roman" style="font-family:&quot;Times New Roman&quot;, Georgia, serif;">t</span></p>\n',
  ],
  [
    "[t]{u}",
    '<p><span class="dfspan" data-u="1" style="text-decoration:underline;">t</span></p>\n',
  ],
  [
    "[t]{sc}",
    '<p><span class="dfspan" data-sc="1" style="font-variant:small-caps;">t</span></p>\n',
  ],
  [
    "[t]{caps}",
    '<p><span class="dfspan" data-caps="1" style="text-transform:uppercase;">t</span></p>\n',
  ],
  [
    "[t]{u sc caps}",
    '<p><span class="dfspan" data-u="1" data-sc="1" data-caps="1" style="text-decoration:underline;font-variant:small-caps;text-transform:uppercase;">t</span></p>\n',
  ],
  [
    '[all of it]{color=#e11 bg=#ff0 size=14 font="Georgia" u sc caps}',
    '<p><span class="dfspan" data-color="ee1111" data-bg="ffff00" data-size="14" data-font="Georgia" data-u="1" data-sc="1" data-caps="1" style="color:#e11;background:#ff0;font-size:14pt;font-family:&quot;Georgia&quot;, Georgia, serif;text-decoration:underline;font-variant:small-caps;text-transform:uppercase;">all of it</span></p>\n',
  ],
  // not ours → the link/paragraph tokenizers keep it
  ["[draft copy]{approved}", "<p>[draft copy]{approved}</p>\n"],
  ["[held for review]", "<p>[held for review]</p>\n"],
  ["[link](https://e.org/a_b_c)", '<p><a href="https://e.org/a_b_c">link</a></p>\n'],
  ["[t]{color=#12345}", "<p>[t]{color=#12345}</p>\n"], // 5-digit hex is invalid
  ["[t]{color=red}", "<p>[t]{color=red}</p>\n"], // named colours never survive to .docx
  ["[t]{size=abc}", "<p>[t]{size=abc}</p>\n"],
  [
    "[esc \\] bracket]{u}",
    '<p><span class="dfspan" data-u="1" style="text-decoration:underline;">esc ] bracket</span></p>\n',
  ],
  [
    "[a *em* b]{color=#0f0}",
    '<p><span class="dfspan" data-color="00ff00" style="color:#0f0;">a <em>em</em> b</span></p>\n',
  ],
];

describe("span attributes render (1:1 with classic engine.js)", () => {
  it.each(RENDERED)("%s", (md, expected) => {
    expect(body(md)).toBe(norm(expected));
  });
});

describe("parseSpanAttrs", () => {
  const TABLE: [string, Record<string, unknown>][] = [
    ["color=#c00", { color: "#c00" }],
    ["color=c00 bg=ffe28a", { color: "#c00", bg: "#ffe28a" }],
    ["size=14", { size: 14 }],
    ["size=4.9", {}],
    ["size=5", { size: 5 }],
    ["size=96", { size: 96 }],
    ["size=96.1", {}],
    ['font="Georgia"', { font: "Georgia" }],
    ["font=Consolas", { font: "Consolas" }],
    ["u sc caps", { u: true, sc: true, caps: true }],
    ["color=#CC0000 BG=#FF0", { color: "#cc0000", bg: "#ff0" }],
    ["color=#12345 size=200 font= u", { u: true }],
    ["approved", {}],
    ["", {}],
    ['color="#abc"', { color: "#abc" }],
    ["size=14pt", { size: 14 }], // parseFloat eats the unit — frozen behavior
  ];
  it.each(TABLE)("%s", (input, expected) => {
    expect(parseSpanAttrs(input)).toEqual(expected);
  });
});
