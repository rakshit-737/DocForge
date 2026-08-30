/* ============================================================
   docx-fonts — embed real bold/italic cuts into the .docx
   (1:1 port of src/js/docx-fonts.js)

   The docx library can embed fonts, but its font table only ever writes
   <w:embedRegular>. A document whose every heading is bold would therefore be
   set in Word's synthetic bold — a smeared algorithmic weight, not the real cut.

   So each cut is handed to the library as its own throwaway family (which makes
   it obfuscate the bytes, write the parts, the relationships and the content
   types correctly), and afterwards this module rewrites word/fontTable.xml to
   regroup those parts into one <w:font> per real family carrying
   embedRegular / embedBold / embedItalic / embedBoldItalic.

   Only that one entry is rewritten; every other byte of the package is copied
   through untouched, so nothing else has to be understood or re-deflated.
   ============================================================ */

/** One real typeface family to regroup: each cut value is the throwaway
    font name that was passed to Document({fonts}). */
export interface EmbedFamily {
  name: string;
  family?: string;
  pitch?: string;
  cuts: Record<string, string | undefined>;
}

interface ZipEntry {
  flags: number;
  method: number;
  time: number;
  crc: number;
  compSize: number;
  rawSize: number;
  localOffset: number;
  name: string;
  extAttr: number;
  dataOffset: number;
}

/* ---------- zip ---------- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u16 = (d: DataView, o: number) => d.getUint16(o, true);
const u32 = (d: DataView, o: number) => d.getUint32(o, true);

/* Parse the central directory. Entry data is never inflated here. */
function readEntries(bytes: Uint8Array): ZipEntry[] {
  const d = new DataView(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 22 - 65536; i--) {
    if (u32(d, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip");
  const count = u16(d, eocd + 10);
  let p = u32(d, eocd + 16);
  const entries: ZipEntry[] = [];
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (u32(d, p) !== 0x02014b50) throw new Error("bad central directory");
    const nameLen = u16(d, p + 28), extraLen = u16(d, p + 30), cmtLen = u16(d, p + 32);
    const e = {
      flags: u16(d, p + 8),
      method: u16(d, p + 10),
      time: u32(d, p + 12),          // modtime+moddate as one dword
      crc: u32(d, p + 16),
      compSize: u32(d, p + 20),
      rawSize: u32(d, p + 24),
      localOffset: u32(d, p + 42),
      name: dec.decode(bytes.subarray(p + 46, p + 46 + nameLen)),
      extAttr: u32(d, p + 38),
    } as ZipEntry;
    // Where the compressed bytes actually start
    const lh = e.localOffset;
    e.dataOffset = lh + 30 + u16(d, lh + 26) + u16(d, lh + 28);
    entries.push(e);
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return entries;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const buf = await new Response(new Blob([bytes] as BlobPart[]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}

/* Rebuild the archive, swapping in `replacements` (stored, uncompressed). */
function rebuild(bytes: Uint8Array, entries: ZipEntry[], replacements: Map<string, Uint8Array>): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const repl = replacements.get(e.name);
    const nameBytes = enc.encode(e.name);
    let method: number, crc: number, compSize: number, rawSize: number, data: Uint8Array;

    if (repl) {
      method = 0; data = repl;
      crc = crc32(repl); compSize = repl.length; rawSize = repl.length;
    } else {
      method = e.method; crc = e.crc; compSize = e.compSize; rawSize = e.rawSize;
      data = bytes.subarray(e.dataOffset, e.dataOffset + e.compSize);
    }

    const lh = new Uint8Array(30 + nameBytes.length);
    const ld = new DataView(lh.buffer);
    ld.setUint32(0, 0x04034b50, true);
    ld.setUint16(4, 20, true);
    ld.setUint16(6, 0, true);                 // no data descriptor — sizes are known
    ld.setUint16(8, method, true);
    ld.setUint32(10, e.time, true);
    ld.setUint32(14, crc, true);
    ld.setUint32(18, compSize, true);
    ld.setUint32(22, rawSize, true);
    ld.setUint16(26, nameBytes.length, true);
    ld.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cd.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, method, true);
    cdv.setUint32(12, e.time, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, compSize, true);
    cdv.setUint32(24, rawSize, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint32(38, e.extAttr, true);
    cdv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);

    parts.push(lh, data);
    central.push(cd);
    offset += lh.length + compSize;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) cdSize += c.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdStart, true);

  return new Blob([...parts, ...central, eocd] as BlobPart[], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/* ---------- font table ---------- */
const ROLE_TAG: Record<string, string> = {
  regular: "w:embedRegular", bold: "w:embedBold",
  italic: "w:embedItalic", boldItalic: "w:embedBoldItalic",
};

/* Rewrite <w:fonts> so each real family owns the four parts already in the package. */
function regroup(xml: string, families: EmbedFamily[]): string {
  // Harvest the (cut name -> rId, fontKey) pairs the library generated.
  const parts: Record<string, { id: string; key: string; sig: string }> = {};
  const re = /<w:font w:name="([^"]+)">([\s\S]*?)<\/w:font>/g;
  let m;
  while ((m = re.exec(xml))) {
    const embed = /<w:embedRegular r:id="([^"]+)" w:fontKey="([^"]+)"\/>/.exec(m[2]!);
    const sig = /<w:sig [^/]*\/>/.exec(m[2]!);
    if (embed) parts[m[1]!] = { id: embed[1]!, key: embed[2]!, sig: sig ? sig[0] : "" };
  }

  const body = families.map(fam => {
    const embeds = Object.keys(ROLE_TAG)
      .filter(role => fam.cuts[role] && parts[fam.cuts[role]!])
      .map(role => {
        const p = parts[fam.cuts[role]!]!;
        return `<${ROLE_TAG[role]} r:id="${p.id}" w:fontKey="${p.key}"/>`;
      }).join("");
    if (!embeds) return "";
    const sig = (parts[fam.cuts.regular as string] || ({} as { sig?: string })).sig || "";
    return `<w:font w:name="${fam.name}">` +
      `<w:charset w:val="00"/><w:family w:val="${fam.family || "auto"}"/>` +
      `<w:pitch w:val="${fam.pitch || "variable"}"/>${sig}${embeds}</w:font>`;
  }).join("");

  const open = xml.slice(0, xml.indexOf(">", xml.indexOf("<w:fonts")) + 1);
  return xml.slice(0, xml.indexOf("<w:fonts")) + open.slice(open.indexOf("<w:fonts")) + body + "</w:fonts>";
}

/**
 * @param blob      the .docx produced by Packer.toBlob
 * @param families  [{ name, family, pitch, cuts: {regular, bold, italic, boldItalic} }]
 *                  where each cut value is the throwaway name passed to Document({fonts})
 */
export async function embed(blob: Blob, families: EmbedFamily[]): Promise<Blob> {
  if (!families || !families.length) return blob; // nothing embedded — nothing to regroup
  if (typeof DecompressionStream === "undefined") return blob; // older browser: named fonts only
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const entries = readEntries(bytes);
  const ft = entries.find(e => e.name === "word/fontTable.xml");
  if (!ft) return blob;

  const raw = bytes.subarray(ft.dataOffset, ft.dataOffset + ft.compSize);
  const xml = new TextDecoder().decode(ft.method === 0 ? raw : await inflateRaw(raw));
  const next = regroup(xml, families);
  return rebuild(bytes, entries, new Map([["word/fontTable.xml", new TextEncoder().encode(next)]]));
}
