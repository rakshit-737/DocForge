/* Tiny zip WRITER for tests — emits exactly the fields the package's
   central-directory reader consumes (CRCs and timestamps stay zero, which
   the reader never checks). Method 8 entries are deflated via node:zlib. */

import { deflateRawSync } from "node:zlib";

const enc = new TextEncoder();

const u16le = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const u32le = (n: number): number[] => [
  n & 0xff,
  (n >> 8) & 0xff,
  (n >> 16) & 0xff,
  (n >>> 24) & 0xff,
];

export interface ZipInput {
  name: string;
  data: Uint8Array | string;
  /** 0 = stored (default), 8 = deflate; anything else is written verbatim
      with the raw bytes, to exercise the "Unsupported zip compression" path. */
  method?: number;
}

export function buildZip(inputs: ZipInput[]): ArrayBuffer {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const inp of inputs) {
    const nameBytes = enc.encode(inp.name);
    const raw = typeof inp.data === "string" ? enc.encode(inp.data) : inp.data;
    const method = inp.method ?? 0;
    const stored = method === 8 ? new Uint8Array(deflateRawSync(raw)) : raw;

    const localHeader = new Uint8Array([
      ...u32le(0x04034b50),
      ...u16le(20),
      ...u16le(0),
      ...u16le(method),
      ...u16le(0),
      ...u16le(0), // time, date
      ...u32le(0), // crc32 (reader ignores it)
      ...u32le(stored.length),
      ...u32le(raw.length),
      ...u16le(nameBytes.length),
      ...u16le(0),
    ]);
    const centralHeader = new Uint8Array([
      ...u32le(0x02014b50),
      ...u16le(20),
      ...u16le(20),
      ...u16le(0),
      ...u16le(method),
      ...u16le(0),
      ...u16le(0),
      ...u32le(0), // time, date, crc32
      ...u32le(stored.length),
      ...u32le(raw.length),
      ...u16le(nameBytes.length),
      ...u16le(0),
      ...u16le(0),
      ...u16le(0),
      ...u16le(0),
      ...u32le(0), // disk, int attrs, ext attrs
      ...u32le(offset),
    ]);

    parts.push(localHeader, nameBytes, stored);
    central.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + stored.length;
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array([
    ...u32le(0x06054b50),
    ...u16le(0),
    ...u16le(0),
    ...u16le(inputs.length),
    ...u16le(inputs.length),
    ...u32le(cdSize),
    ...u32le(offset),
    ...u16le(0),
  ]);

  const all = [...parts, ...central, eocd];
  const size = all.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(size);
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out.buffer;
}
