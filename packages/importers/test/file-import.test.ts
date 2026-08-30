/* Node-environment tests: csv/ipynb need no DOM, and the zip reader gets
   real Blob/Response/DecompressionStream("deflate-raw") from Node itself
   (Node >= 21.2; the repo pins Node 24 LTS). */
import { describe, it, expect } from "vitest";
import { FileImport } from "../src/index.js";
import { _internals } from "../src/file-import.js";
import { buildZip } from "./_build-zip.js";

describe("csv", () => {
  const cases: [name: string, input: string, expected: string][] = [
    ["comma", "a,b\n1,2", "| a | b |\n| --- | --- |\n| 1 | 2 |"],
    ["semicolon sniffed", "a;b\n1;2", "| a | b |\n| --- | --- |\n| 1 | 2 |"],
    ["tab sniffed", "a\tb\n1\t2", "| a | b |\n| --- | --- |\n| 1 | 2 |"],
    ["semicolons outnumber commas", "a;b;c,d\n1;2;3,4", "| a | b | c,d |\n| --- | --- | --- |\n| 1 | 2 | 3,4 |"],
    ["quoted delimiter stays in the cell", '"a,x",b\n1,2', "| a,x | b |\n| --- | --- |\n| 1 | 2 |"],
    ['escaped "" quotes', '"say ""hi""",x', '| say "hi" | x |\n| --- | --- |'],
    ["CRLF + trailing newline drops the blank record", "a,b\r\n1,2\r\n", "| a | b |\n| --- | --- |\n| 1 | 2 |"],
    ["BOM stripped", "﻿a,b\n1,2", "| a | b |\n| --- | --- |\n| 1 | 2 |"],
    ["pipes escaped in cells", "a|b,c\n", "| a\\|b | c |\n| --- | --- |"],
    ["no delimiter found falls back to comma", "hello\nworld", "| hello |\n| --- |\n| world |"],
    ["ragged rows padded to the widest", "a,b,c\n1,2", "| a | b | c |\n| --- | --- | --- |\n| 1 | 2 |  |"],
    ["inner whitespace collapsed", "a  b,c", "| a b | c |\n| --- | --- |"],
  ];
  it.each(cases)("%s", (_name, input, expected) => {
    expect(FileImport.csv(input)).toBe(expected);
  });

  it("sniffs the delimiter outside quotes only", () => {
    // the quoted region full of semicolons must not elect ";"
    expect(FileImport.csv('"1;2;3",x')).toBe("| 1;2;3 | x |\n| --- | --- |");
  });
});

describe("parseCsv (internal)", () => {
  it("keeps a bare final record", () => {
    expect(_internals.parseCsv("a,b\nc", ",")).toEqual([["a", "b"], ["c"]]);
  });
  it("treats lone \\r as a row break", () => {
    expect(_internals.parseCsv("a\rb", ",")).toEqual([["a"], ["b"]]);
  });
});

describe("mdTable / mdCell (internal)", () => {
  it("returns empty string for no rows", () => {
    expect(_internals.mdTable([])).toBe("");
  });
  it("pads, escapes pipes and collapses whitespace", () => {
    expect(_internals.mdTable([["x|y", "  spaced  out "], ["1"]]))
      .toBe("| x\\|y | spaced out |\n| --- | --- |\n| 1 |  |");
  });
  it("stringifies null-ish cells to empty", () => {
    expect(_internals.mdCell(null)).toBe("");
    expect(_internals.mdCell(undefined)).toBe("");
    expect(_internals.mdCell(42)).toBe("42");
  });
});

describe("colIndex (internal)", () => {
  const cases: [ref: string | null, idx: number][] = [
    ["A1", 0], ["B7", 1], ["Z9", 25], ["AA10", 26], ["AB1", 27], ["9", -1], [null, -1], ["", -1],
  ];
  it.each(cases)("%s -> %s", (ref, idx) => {
    expect(_internals.colIndex(ref)).toBe(idx);
  });
});

describe("zip central-directory reader (internal)", () => {
  it("reads stored and deflated entries", async () => {
    const zip = buildZip([
      { name: "a.txt", data: "hello stored" },
      { name: "dir/b.txt", data: "hello deflated hello deflated hello deflated", method: 8 },
    ]);
    const z = _internals.zipOpen(zip);
    expect(z.names()).toEqual(["a.txt", "dir/b.txt"]);
    expect(z.has("a.txt")).toBe(true);
    expect(z.has("nope")).toBe(false);
    expect(await z.text("a.txt")).toBe("hello stored");
    expect(await z.text("dir/b.txt")).toBe("hello deflated hello deflated hello deflated");
  });

  it("rejects a missing entry by name", async () => {
    const z = _internals.zipOpen(buildZip([{ name: "a.txt", data: "x" }]));
    await expect(z.bytes("nope")).rejects.toThrow("Missing zip entry: nope");
  });

  it("rejects unsupported compression methods", async () => {
    const z = _internals.zipOpen(buildZip([{ name: "x", data: "abc", method: 12 }]));
    await expect(z.bytes("x")).rejects.toThrow("Unsupported zip compression");
  });

  it("rejects non-zip buffers (including ones too small for an EOCD)", () => {
    expect(() => _internals.zipOpen(new ArrayBuffer(10))).toThrow("Not a zip-based file");
    expect(() => _internals.zipOpen(new ArrayBuffer(100))).toThrow("Not a zip-based file");
  });

  it("reports a damaged central directory", () => {
    const buf = buildZip([{ name: "a.txt", data: "x" }]);
    const bytes = new Uint8Array(buf);
    // no comment was written, so the EOCD sits in the last 22 bytes;
    // u32 at eocd+16 is the central-directory offset — corrupt its signature.
    const eocd = bytes.length - 22;
    const d = new DataView(buf);
    const cdOff = d.getUint32(eocd + 16, true);
    bytes[cdOff] = 0x00;
    expect(() => _internals.zipOpen(buf)).toThrow("Damaged zip directory");
  });

  it("inflateRaw round-trips node-deflated bytes", async () => {
    const { deflateRawSync } = await import("node:zlib");
    const raw = new TextEncoder().encode("round trip round trip round trip");
    const back = await _internals.inflateRaw(new Uint8Array(deflateRawSync(raw)));
    expect(new TextDecoder().decode(back)).toBe("round trip round trip round trip");
  });
});

describe("ipynb", () => {
  it("converts markdown and code cells, drops raw cells and outputs", () => {
    const nb = JSON.stringify({
      metadata: { kernelspec: { language: "python" } },
      cells: [
        { cell_type: "markdown", source: ["# Title"] },
        { cell_type: "code", source: ["print(1)"], outputs: [{ text: "1" }] },
        { cell_type: "code", source: "" },
        { cell_type: "raw", source: ["raw stuff"] },
        { cell_type: "code", source: ["a\n", "b"] },
      ],
    });
    expect(FileImport.ipynb(nb)).toBe(
      "# Title\n\n```python\nprint(1)\n```\n\n```python\na\nb\n```");
  });

  it("falls back to language_info.name", () => {
    const nb = JSON.stringify({
      metadata: { language_info: { name: "r" } },
      cells: [{ cell_type: "code", source: "x <- 1" }],
    });
    expect(FileImport.ipynb(nb)).toBe("```r\nx <- 1\n```");
  });

  it("tolerates a missing language and string sources", () => {
    const nb = JSON.stringify({ cells: [{ cell_type: "code", source: "1+1" }] });
    expect(FileImport.ipynb(nb)).toBe("```\n1+1\n```");
  });

  it("throws on an empty notebook", () => {
    expect(() => FileImport.ipynb("{}")).toThrow("Empty notebook");
    expect(() => FileImport.ipynb(JSON.stringify({ cells: [{ cell_type: "code", source: " " }] })))
      .toThrow("Empty notebook");
  });
});
