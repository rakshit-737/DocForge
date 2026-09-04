/* ============================================================
   qa/stamp.mjs — the watermark and the letterhead, in both formats (§8.2).

   The claim this harness holds to account: a stamped document carries the
   same mark and the same letterhead whether it is printed or opened in Word.
   So it builds ONE document both ways through the CLI, opens the .docx with
   the real Word and prints that too, rasterises both, and looks at the
   pixels — a watermark you cannot see in the print is not a watermark, and a
   .docx Word has to repair is not a .docx.

   Windows + Word only, like qa/_docx2pdf.ps1; the Word half is skipped with
   a note where Word is not installed. Everything else runs anywhere.

   Usage: node qa/stamp.mjs
   ============================================================ */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { PNG } from "./_png.mjs";
import { pdfText, rasterise } from "./_raster.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(REPO, "qa", "out", "stamp");
const CLI = join(REPO, "packages", "cli", "dist", "cli.mjs");

const fails = [];
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) fails.push(name);
};

if (!existsSync(CLI)) {
  console.log("build the CLI first: pnpm --filter @docforge/cli... build");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

/* ---------- the fixtures: a letterhead and a manuscript ---------- */

/** A 480×120 PNG letterhead — a dark bar top and bottom, an accent block at
    the left — written by hand so no binary has to live in the repo. */
function makeLogo(path) {
  const W = 480;
  const H = 120;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  let p = 0;
  for (let y = 0; y < H; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      const bar = y < 24 || y > H - 24;
      const block = x < 120 && y > 30 && y < H - 30;
      const rgb = bar ? [15, 23, 42] : block ? [37, 99, 235] : [255, 255, 255];
      raw[p++] = rgb[0];
      raw[p++] = rgb[1];
      raw[p++] = rgb[2];
    }
  }
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    let crc = 0xffffffff;
    for (const byte of body) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([len, body, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

const logo = join(OUT, "letterhead.png");
const source = join(OUT, "stamp.md");
makeLogo(logo);
writeFileSync(
  source,
  "# Method\n\nThe first paragraph of a stamped document.\n\n## Results\n\nA second section so the running head has something to say.\n",
);

const build = (extra) =>
  execFileSync(
    process.execPath,
    [CLI, "build", source, "--title", "Fracture Mechanics", "--out", OUT, ...extra],
    { stdio: "pipe" },
  );

/* ---------- what a print actually shows ---------- */

/** Grey ink in the middle of the sheet is the watermark; accent ink in the top
    tenth is the letterhead. Both are counted rather than compared to a golden
    image, because Word sets its own type and never will match pixel for
    pixel — what must hold is that the mark and the logo are THERE, at a
    comparable size, in both. */
async function look(pdf, label) {
  const { files } = await rasterise(pdf, join(OUT, label), { scale: 2, maxPages: 1 });
  const img = PNG.read(readFileSync(files[0]));
  let grey = 0;
  let logoInk = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      if (Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && r > 150 && r < 240) grey++;
      /* The top tenth clears the h1's accent rule, which every document has. */
      if (b > 150 && b - r > 60 && y < img.height * 0.1) logoInk++;
    }
  }
  return { grey, logoInk };
}

/* ---------- the run ---------- */

build(["--pdf", "--docx", "--watermark", "DRAFT", "--letterhead", logo]);

let wordPdf = join(OUT, "word.pdf");
if (process.platform !== "win32") {
  console.log("note: Word conversion skipped — not Windows");
  wordPdf = null;
} else {
  try {
    const said = execFileSync(
      "powershell",
      [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(REPO, "qa", "_docx2pdf.ps1"),
        "-In",
        join(OUT, "stamp.docx"),
        "-Out",
        wordPdf,
      ],
      { encoding: "utf8" },
    );
    check("Word opens the .docx without repairing it", /PAGES=\d+/.test(said), said.trim());
  } catch (e) {
    check("Word opens the .docx without repairing it", false, String(e).slice(0, 160));
    wordPdf = null;
  }
}

const stamped = await look(join(OUT, "stamp.pdf"), "pdf");
check("the PDF carries a grey diagonal mark", stamped.grey > 20000, `${stamped.grey} grey pixels`);
check(
  "the PDF carries the letterhead in the top margin",
  stamped.logoInk > 500,
  `${stamped.logoInk} accent pixels up top`,
);

if (wordPdf && existsSync(wordPdf)) {
  const word = await look(wordPdf, "word");
  check("Word's print carries the same mark", word.grey > 20000, `${word.grey} grey pixels`);
  check(
    "Word's print carries the letterhead too",
    word.logoInk > 500,
    `${word.logoInk} accent pixels up top`,
  );
  const ratio = word.grey / Math.max(stamped.grey, 1);
  check(
    "and the two marks are the same order of size",
    ratio > 0.5 && ratio < 2,
    `Word/PDF grey ratio ${ratio.toFixed(2)}`,
  );
}

/* An unstamped document must be untouched — the running head is grey type and
   every h1 carries an accent rule, so the test is that the mark and the logo
   are GONE, not that the page is blank. */
build(["--pdf"]);
const plain = await look(join(OUT, "stamp.pdf"), "plain");
check(
  "a document that asks for neither has neither",
  plain.grey < stamped.grey * 0.2 && plain.logoInk < 100,
  `${plain.grey}/${stamped.grey} grey · ${plain.logoInk} accent`,
);
const text = await pdfText(join(OUT, "stamp.pdf"));
check("and still reads as itself", /Fracture Mechanics|Method/.test(text.join(" ")));

console.log(fails.length ? `\n${fails.length} FAILURE(S)` : "\nSTAMP HARNESS PASSES");
process.exit(fails.length ? 1 : 0);
