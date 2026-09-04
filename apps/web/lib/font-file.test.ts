/* The font reader, against REAL font files — the 26 OFL cuts this repo ships
   are exactly the shape a reader would upload, so the name-table parser is
   tested on bytes rather than on a mock of them. (lib/font-file.ts is the
   engine-free half on purpose; the registration half needs loadStudio and is
   driven by the live probe.) */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { cutOf, kindOf, readFontNames, stemFor, userFontCss } from "./font-file";

/** Walk up to the repo root (apps/web → …), wherever vitest was started. */
function repoRoot(): string {
  let d = process.cwd();
  for (let i = 0; i < 6; i++) {
    try {
      readFileSync(join(d, "fonts", "DocForgeSerif-Regular.ttf"));
      return d;
    } catch {
      d = dirname(d);
    }
  }
  throw new Error(`fonts/ not found from ${process.cwd()}`);
}
const ROOT = repoRoot();
const font = (name: string): ArrayBuffer => {
  const buf = readFileSync(join(ROOT, "fonts", name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

describe("readFontNames", () => {
  it("reads the family and subfamily out of a real TTF", () => {
    const n = readFontNames(font("DocForgeSerif-Regular.ttf"));
    expect(n.family).toBeTruthy();
    expect(n.subfamily.toLowerCase()).toContain("regular");
    expect(n.cff).toBe(false);
  });

  it("tells the cuts of one family apart", () => {
    const bold = readFontNames(font("DocForgeSerif-Bold.ttf"));
    const italic = readFontNames(font("DocForgeSerif-Italic.ttf"));
    const bi = readFontNames(font("DocForgeSerif-BoldItalic.ttf"));
    expect(cutOf(bold.subfamily)).toBe("bold");
    expect(cutOf(italic.subfamily)).toBe("italic");
    expect(cutOf(bi.subfamily)).toBe("boldItalic");
  });

  it("reads every cut this repo ships without throwing", () => {
    for (const name of [
      "DocForgeSans-Regular.ttf",
      "DocForgeMono-Regular.ttf",
      "DocForgeGaramond-Italic.ttf",
      "DocForgeCrimson-BoldItalic.ttf",
      "DocForgeInter-Bold.ttf",
    ]) {
      expect(() => readFontNames(font(name))).not.toThrow();
    }
  });

  it("refuses a WOFF with the reason a reader can act on", () => {
    const woff = new Uint8Array([0x77, 0x4f, 0x46, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(() => readFontNames(woff.buffer as ArrayBuffer)).toThrow(/can't be embedded in Word/);
  });

  it("refuses anything that is not a font at all", () => {
    expect(() =>
      readFontNames(new TextEncoder().encode("not a font, just text").buffer as ArrayBuffer),
    ).toThrow(/doesn't look like a .ttf or .otf/);
    expect(() => readFontNames(new Uint8Array(4).buffer as ArrayBuffer)).toThrow(/too small/);
  });
});

describe("cutOf", () => {
  it("maps the words foundries actually use", () => {
    expect(cutOf("Regular")).toBe("regular");
    expect(cutOf("Book")).toBe("regular");
    expect(cutOf("SemiBold")).toBe("bold");
    expect(cutOf("Black")).toBe("bold");
    expect(cutOf("Oblique")).toBe("italic");
    expect(cutOf("Bold Italic")).toBe("boldItalic");
    expect(cutOf("Heavy Oblique")).toBe("boldItalic");
  });
});

describe("kindOf / stemFor", () => {
  it("guesses the fallback class from the family name", () => {
    expect(kindOf("EB Garamond")).toBe("serif");
    expect(kindOf("Source Serif 4")).toBe("serif");
    expect(kindOf("Source Sans 3")).toBe("sans");
    expect(kindOf("PT Sans Serif")).toBe("sans"); // "sans" wins when both appear
    expect(kindOf("Futura")).toBe("sans");
  });

  it("builds a key-safe stem — the __FONT_DATA__ key is `<stem>-<Cut>`", () => {
    expect(stemFor("EB Garamond")).toBe("UserEBGaramond");
    expect(stemFor("Weird-Name 2.0")).toBe("UserWeirdName20");
    expect(stemFor("!!!")).toBe("UserUserFont");
    expect(stemFor("x".repeat(80)).length).toBeLessThanOrEqual(44);
  });
});

describe("userFontCss", () => {
  const f = {
    name: "My Face",
    stem: "UserMyFace",
    kind: "serif" as const,
    cuts: { regular: "QUFB", bold: "QkJC" },
    addedAt: 0,
  };

  it("writes one @font-face per cut, with the right weight and style", () => {
    const css = userFontCss([f]);
    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css).toContain('font-family:"My Face"');
    expect(css).toContain("font-weight:400");
    expect(css).toContain("font-weight:700");
    expect(css).toContain("base64,QUFB");
  });

  it("is empty when nothing is installed", () => {
    expect(userFontCss([])).toBe("");
  });
});
