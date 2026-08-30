/* Minimal zip reader for .docx inspection — the same technique as
   qa/golden/_zip.mjs (copied here because tests must not import qa/).
   Handles stored (0) and deflated (8) members — everything the docx lib
   and Office emit. No dependency. */

import { Buffer } from "node:buffer";
import zlib from "node:zlib";

/** member name → bytes */
export function readZip(buf: Buffer): Map<string, Buffer> {
  // End of central directory: scan backwards for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("not a zip: no end-of-central-directory");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);

  const out = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("bad central directory entry");
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);

    // Local header carries its own (possibly different) name/extra lengths.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataOff = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataOff, dataOff + compSize);

    if (!name.endsWith("/")) {
      out.set(name, method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw));
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
