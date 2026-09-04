/* A saved house style carries the LOOK and nothing else. That line is the
   whole design, so it is where the tests press hardest: a preset must never
   drag a title, an author or a manuscript into somebody else's assignment. */
import { describe, expect, it } from "vitest";
import type { Settings } from "./settings";
import { LOOK_KEYS, lookOf, parsePreset, sanitiseLook, serialisePreset } from "./theme-presets";

const settings = {
  // the look
  theme: "academic",
  accent: "#7f1d1d",
  page: "Letter",
  orientation: "landscape",
  margins: "wide",
  fontHead: "garamond",
  fontBody: "crimson",
  baseSize: "12",
  lineSpacing: "1.5",
  borderStyle: "double",
  borderWeight: "fine",
  borderColor: "accent",
  header: true,
  pageNums: true,
  numbered: true,
  justify: true,
  h1break: false,
  citeStyle: "apa7",
  headerLeft: "{kicker}",
  headerRight: "{section}",
  footerLeft: "",
  footerRight: "{date}",
  // the content
  title: "Someone's Dissertation",
  subtitle: "Chapter 4",
  author: "E. Marrow",
  kicker: "MECH 401",
  metaExtra: "Confidential",
  date: "2026-09-04",
  cover: true,
} as unknown as Settings;

describe("lookOf", () => {
  const look = lookOf(settings);

  it("takes every part of the appearance", () => {
    for (const key of LOOK_KEYS) expect(look).toHaveProperty(key);
    expect(look.theme).toBe("academic");
    expect(look.orientation).toBe("landscape");
    expect(look.citeStyle).toBe("apa7");
    expect(look.headerRight).toBe("{section}");
  });

  it("leaves the content behind", () => {
    for (const key of ["title", "subtitle", "author", "kicker", "metaExtra", "date", "cover"]) {
      expect(look).not.toHaveProperty(key);
    }
  });

  it("omits keys the document doesn't set rather than writing undefined", () => {
    const sparse = lookOf({ theme: "modern" } as unknown as Settings);
    expect(Object.keys(sparse)).toEqual(["theme"]);
  });
});

describe("sanitiseLook", () => {
  it("keeps only look keys, whatever the file claims", () => {
    const out = sanitiseLook({
      theme: "minimal",
      title: "Not yours",
      source: "# Someone else's manuscript",
      attachments: { a: 1 },
      __proto__: { polluted: true },
    });
    expect(out).toEqual({ theme: "minimal" });
    expect(out).not.toHaveProperty("title");
    expect(out).not.toHaveProperty("source");
  });

  it("drops values of the wrong shape", () => {
    expect(sanitiseLook({ theme: { nested: true }, accent: ["#fff"], page: "A4" })).toEqual({
      page: "A4",
    });
  });

  it("survives nonsense", () => {
    expect(sanitiseLook(null)).toEqual({});
    expect(sanitiseLook("a string")).toEqual({});
  });
});

describe("serialise / parse", () => {
  const preset = { name: "House style", look: lookOf(settings), savedAt: 0 };

  it("round-trips a preset", () => {
    const back = parsePreset(serialisePreset(preset));
    expect(back.name).toBe("House style");
    expect(back.look).toEqual(preset.look);
  });

  it("refuses what isn't a theme file, with a reason", () => {
    expect(() => parsePreset("not json")).toThrow(/isn't JSON/);
    expect(() => parsePreset('{"app":"docforge","v":1}')).toThrow(/isn't a DocForge theme file/);
    expect(() => parsePreset('{"app":"docforge-theme","v":1,"look":{}}')).toThrow(/no settings/);
  });

  it("names an unnamed shared theme rather than failing", () => {
    const back = parsePreset('{"app":"docforge-theme","v":1,"look":{"theme":"modern"}}');
    expect(back.name).toBe("Shared theme");
  });

  it("cannot be used to smuggle content in", () => {
    const back = parsePreset(
      '{"app":"docforge-theme","v":1,"name":"Trojan","look":{"theme":"modern","title":"Gotcha","source":"# no"}}',
    );
    expect(back.look).toEqual({ theme: "modern" });
  });
});
