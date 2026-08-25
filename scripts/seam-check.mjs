// seam-check.mjs — does the artwork actually JOIN?
//
// A full-card composite cannot answer that, and believing it can is how a wrong
// group would ship. Every card puts a border, a name bar and a text box between
// one art window and the next, so nine correct cards in the correct order still
// render as nine separate pictures — and nine cards in the WRONG order render
// as nine separate pictures too. The two are indistinguishable in that image.
//
// So this crops each card to its art window and abuts the crops with no gap. If
// the group is real and the order is right, the horizon, the water and the
// ground run straight across the seams. If the order is wrong, they step.
//
// USE: node scripts/seam-check.mjs out.png <cardId> <cardId> ...  (COLS=3 env)
//
// WHAT IT CANNOT DO: the window geometry below is the modern SV/SWSH frame.
// Older frames sit differently, and a Stage 1 card carries an evolution bar
// that intrudes into the crop. Both are cosmetic here — they do not move the
// artwork — but a vintage group needs its own geometry before this is evidence.
import sharp from "sharp";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2];
const IDS = process.argv.slice(3);
const COLS = Number(process.env.COLS || 3);
const DIR = "C:/Users/Mike/AppData/Local/Temp/claude/C--Users-Mike/9c792d21-15fd-431a-8d7a-0b11bcbc3e0f/scratchpad/art";
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

// Art-window geometry as a fraction of the card, for the modern (SV/SWSH) frame.
// Measured off the rendered cards rather than guessed.
const WIN = { left: 0.074, top: 0.098, width: 0.852, height: 0.365 };

const cat = JSON.parse(await (await import("node:fs/promises")).readFile("C:/Users/Mike/Catchem-data/data/card-catalogue.json", "utf-8")).cards;

const tiles = [];
for (const id of IDS) {
  const [setId, num] = [id.slice(0, id.lastIndexOf("-")), id.slice(id.lastIndexOf("-") + 1)];
  const url = `https://images.pokemontcg.io/${setId}/${num}_hires.png`;
  const f = join(DIR, id.replace(/[^a-z0-9-]/gi, "_") + ".png");
  if (!existsSync(f)) {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) { console.error("  MISSING IMAGE", id, r.status); process.exit(1); }
    writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  const meta = await sharp(f).metadata();
  const box = {
    left: Math.round(meta.width * WIN.left),
    top: Math.round(meta.height * WIN.top),
    width: Math.round(meta.width * WIN.width),
    height: Math.round(meta.height * WIN.height),
  };
  const buf = await sharp(f).extract(box).resize(600, 257, { fit: "fill" }).toBuffer();
  tiles.push({ id, buf, name: cat[id] ? cat[id].name : id });
}

const TW = 600, TH = 257;
const rows = Math.ceil(tiles.length / COLS);
const canvas = sharp({ create: { width: TW * COLS, height: TH * rows, channels: 3, background: "#000" } });
const comp = tiles.map((t, i) => ({ input: t.buf, left: (i % COLS) * TW, top: Math.floor(i / COLS) * TH }));
await canvas.composite(comp).png().toFile(OUT);
console.log("seam check written:", OUT, `${TW * COLS}x${TH * rows}`, tiles.length, "tiles,", COLS, "cols");
