/* Running header and footer content (§8.2). The rule that matters most is the
   first one: a document that sets nothing must emit exactly the CSS it always
   did — the byte-parity suite proves that against the frozen classic engine,
   and these tests pin the behaviour the settings buy. */
import { describe, expect, it } from "vitest";
import type { Settings } from "../src/index.js";
import { dynamicCss, headContent, headParts } from "../src/index.js";

const base = {
  title: "Fracture Mechanics",
  author: "E. Marrow",
  kicker: "MECH 401",
  date: "2026-09-04",
  theme: "modern",
  accent: "#2563eb",
  page: "A4",
  margins: "normal",
  header: true,
  pageNums: true,
  baseSize: "11",
  fontHead: "theme",
  fontBody: "theme",
  borderStyle: "none",
} as unknown as Settings;

const withSlots = (slots: Record<string, string | boolean>) =>
  ({ ...base, ...slots }) as unknown as Settings;

describe("headParts", () => {
  it("is empty for an empty slot, which is what keeps the default bytes", () => {
    expect(headParts("", base)).toEqual([]);
    expect(headParts("   ", base)).toEqual([]);
    expect(headParts(undefined, base)).toEqual([]);
  });

  it("resolves the static tokens at render", () => {
    expect(headParts("{title} · {author}", base)).toEqual([
      { kind: "text", text: "Fracture Mechanics · E. Marrow" },
    ]);
    expect(headParts("{kicker}", base)).toEqual([{ kind: "text", text: "MECH 401" }]);
  });

  it("writes the date the way the cover does", () => {
    expect(headParts("{date}", base)).toEqual([{ kind: "text", text: "4 September 2026" }]);
  });

  it("keeps {section} live rather than freezing one heading", () => {
    expect(headParts("§ {section}", base)).toEqual([
      { kind: "text", text: "§ " },
      { kind: "section", text: "" },
    ]);
  });

  it("merges the literals around a live token", () => {
    const parts = headParts("{title} — {section} — {author}", base);
    expect(parts.map((p) => p.kind)).toEqual(["text", "section", "text"]);
    expect(parts[0]?.text).toBe("Fracture Mechanics — ");
    expect(parts[2]?.text).toBe(" — E. Marrow");
  });

  it("leaves an unknown token alone rather than eating it", () => {
    expect(headParts("{page} of {pages}", base)).toEqual([
      { kind: "text", text: "{page} of {pages}" },
    ]);
  });

  it("drops a token whose field is empty, without leaving a gap in the wrong place", () => {
    expect(headParts("{subtitle}x", { ...base, subtitle: "" } as Settings)).toEqual([
      { kind: "text", text: "{subtitle}x" },
    ]);
    expect(headParts("{author}", { ...base, author: "" } as Settings)).toEqual([]);
  });
});

describe("headContent", () => {
  it("quotes literals and passes the section through as string(sect)", () => {
    expect(headContent("{title}", base)).toBe('"Fracture Mechanics"');
    expect(headContent("{section}", base)).toBe("string(sect)");
    expect(headContent("A {section} B", base)).toBe('"A " string(sect) " B"');
  });

  it("escapes what would otherwise close the CSS string", () => {
    expect(headContent('He said "stop"', base)).toBe('"He said \\"stop\\""');
    expect(headContent("back\\slash", base)).toBe('"back\\\\slash"');
  });

  it("is empty for an empty slot", () => {
    expect(headContent("", base)).toBe("");
  });
});

describe("dynamicCss — the page furniture", () => {
  it("emits the classic pair when nothing is set", () => {
    const css = dynamicCss(base);
    expect(css).toContain('@top-left { content: "Fracture Mechanics"');
    expect(css).toContain("@top-right { content: string(sect)");
    expect(css).not.toContain("@bottom-left");
    expect(css).not.toContain("@bottom-right");
  });

  it("puts the reader's text in the header slots instead", () => {
    const css = dynamicCss(withSlots({ headerLeft: "{kicker}", headerRight: "{author}" }));
    expect(css).toContain('@top-left { content: "MECH 401"');
    expect(css).toContain('@top-right { content: "E. Marrow"');
    expect(css).not.toContain('content: "Fracture Mechanics"');
  });

  it("adds foot slots only when asked, and exempts the cover then", () => {
    const plain = dynamicCss(base);
    expect(plain).not.toContain("@bottom-left");
    const css = dynamicCss(withSlots({ footerLeft: "{title}", footerRight: "{date}" }));
    expect(css).toContain('@bottom-left { content: "Fracture Mechanics"');
    expect(css).toContain('@bottom-right { content: "4 September 2026"');
    expect(css).toContain("@bottom-left { content: none; } @bottom-right { content: none; }");
  });

  it("leaves the header off entirely when the toggle is off", () => {
    const css = dynamicCss(withSlots({ header: false, headerLeft: "{title}" }));
    /* `@page cover` always carries its own `@top-left { content: none }`, so
       what must be absent is a header box with real content in it. */
    expect(css).not.toMatch(/@top-left \{ content: (?!none)/);
  });

  it("keeps the folio's centre box to itself", () => {
    const css = dynamicCss(withSlots({ footerLeft: "{author}" }));
    expect(css).toContain("@bottom-center { content: var(--df-foot");
  });
});
