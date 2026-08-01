/* Minimal PNG decoder for QA pixel assertions: 8-bit RGB/RGBA/greyscale, non-interlaced. */
import zlib from "node:zlib";

export const PNG = {
  read(buf) {
    let off = 8; // skip signature
    let ihdr = null;
    const idat = [];
    while (off < buf.length) {
      const len = buf.readUInt32BE(off);
      const type = buf.toString("ascii", off + 4, off + 8);
      const data = buf.subarray(off + 8, off + 8 + len);
      if (type === "IHDR") {
        ihdr = {
          width: data.readUInt32BE(0), height: data.readUInt32BE(4),
          depth: data[8], colorType: data[9], interlace: data[12],
        };
      } else if (type === "IDAT") idat.push(data);
      else if (type === "IEND") break;
      off += 12 + len;
    }
    if (!ihdr || ihdr.depth !== 8 || ihdr.interlace) throw new Error("unsupported PNG");
    const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.colorType];
    if (!channels) throw new Error("unsupported colour type " + ihdr.colorType);

    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = ihdr.width * channels;
    const out = Buffer.alloc(ihdr.width * ihdr.height * 4);
    let prev = Buffer.alloc(stride);

    for (let y = 0; y < ihdr.height; y++) {
      const filter = raw[y * (stride + 1)];
      const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      const cur = Buffer.from(line);
      for (let x = 0; x < stride; x++) {
        const a = x >= channels ? cur[x - channels] : 0;
        const b = prev[x];
        const c = x >= channels ? prev[x - channels] : 0;
        switch (filter) {
          case 1: cur[x] = (cur[x] + a) & 0xff; break;
          case 2: cur[x] = (cur[x] + b) & 0xff; break;
          case 3: cur[x] = (cur[x] + ((a + b) >> 1)) & 0xff; break;
          case 4: {
            const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
            cur[x] = (cur[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
            break;
          }
        }
      }
      for (let x = 0; x < ihdr.width; x++) {
        const s = x * channels, d = (y * ihdr.width + x) * 4;
        if (channels === 1) { out[d] = out[d + 1] = out[d + 2] = cur[s]; out[d + 3] = 255; }
        else if (channels === 2) { out[d] = out[d + 1] = out[d + 2] = cur[s]; out[d + 3] = cur[s + 1]; }
        else if (channels === 3) { out[d] = cur[s]; out[d + 1] = cur[s + 1]; out[d + 2] = cur[s + 2]; out[d + 3] = 255; }
        else { out[d] = cur[s]; out[d + 1] = cur[s + 1]; out[d + 2] = cur[s + 2]; out[d + 3] = cur[s + 3]; }
      }
      prev = cur;
    }
    return { width: ihdr.width, height: ihdr.height, data: out };
  },
};
