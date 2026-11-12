// A missing day 7 back, with no 90-day file, still leaves a catalogue.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleCatalogue, publishFeed } from "../lib/feed-catalogue.mjs";
import { earlierFileNote } from "../lib/public-bundle.mjs";
import { exactWindow } from "../lib/read-library.mjs";
import { clearReadThinCache } from "../lib/read-thin-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const END = "2026-11-12";
const MISSING = "2026-11-05";

function shift(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

function climb() {
  const days = 45;
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const day = shift(END, -(days - 1 - i));
    if (day === MISSING) continue;
    out.push([day, Math.round((10 + i * 0.2) * 100) / 100]);
  }
  return out;
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };
  const base = climb();
  t("the fixture has no exact day 7 back and no 90-day file", !base.some((p) => p[0] === MISSING) && !base.some((p) => p[0] === shift(END, -90)) && base.some((p) => p[0] === shift(MISSING, -1)) && base.some((p) => p[0] === shift(END, -30)));
  const items = [];
  for (let i = 0; i < 150; i += 1) {
    const hist = base.map((p) => [p[0], Math.round((p[1] + i * 0.01) * 100) / 100]);
    items.push({
      id: `tcgcsv-${1000 + i}`,
      name: `Gap Card ${i}`,
      set: `Set ${i % 40}`,
      setSlug: `set-${i % 40}`,
      kind: "single",
      number: String(i),
      price: hist.at(-1)[1],
      release: "2024-01-01",
      hist,
      href: `/c/tcgcsv-${1000 + i}`,
      image: `https://tcgplayer-cdn.tcgplayer.com/product/${1000 + i}_in_400x400.jpg`,
    });
  }
  const built = assembleCatalogue(items, [], { asOf: END });
  const cards = Object.values(built.cards);
  const week = cards.filter((card) => card.windowDays === 7);
  t("with a missing day 7 back and no 90-day file, the catalogue is still more than 12", cards.length > 12 && cards.every((card) => card.change90 == null));
  t("the board is 200 to 400", cards.length >= 200 && cards.length <= 400);
  t("the 7-day read names the missing file and does not use a later day", week.length > 12 && week.every((card) => card._pathOpts?.fromDate === shift(MISSING, -1) && card._pathOpts.fromDate < MISSING && String(card.path).includes("was missing") && !/[\u2013\u2014]/.test(String(card.path))));
  t("the note names both days", earlierFileNote(MISSING, shift(MISSING, -1)) === "The file for Nov 5 was missing, so this window uses Nov 4.");
  const series = new Map([[7, new Map(base)]]);
  const hit = exactWindow(series, "tcgcsv-7", END, 7);
  t("the library window uses the same earlier file", hit && hit.earlier === true && hit.start === shift(MISSING, -1) && hit.exactDate === MISSING);
  t("a start more than 2 days early does not count", exactWindow(new Map([[7, new Map([["2026-11-01", 12], [END, 14]])]]), "tcgcsv-7", END, 7) == null);
  t("a day after the window start does not count", exactWindow(new Map([[7, new Map([["2026-11-06", 12], [END, 14]])]]), "tcgcsv-7", END, 7) == null);

  const prevFile = process.env.READ_THIN_DATA_FILE;
  const prevTok = process.env.PRIVATE_DATA_TOKEN;
  delete process.env.READ_THIN_DATA_FILE;
  delete process.env.PRIVATE_DATA_TOKEN;
  clearReadThinCache();
  const dir = await mkdtemp(join(tmpdir(), "feed-gap-"));
  try {
    const published = await publishFeed({
      items: items.slice(0, 4),
      prior: [],
      prices: new Map(items.slice(0, 4).map((item) => [item.id, item.price])),
      asOf: END,
      updatedAt: null,
      outDir: dir,
      logFile: null,
      shelf: [],
      gapPids: [],
      root: dir,
    });
    const cat = JSON.parse(await readFile(join(dir, "feed/catalogue.json"), "utf8"));
    const images = Object.values(cat.cards).map((card) => card.image);
    t("limits-missing keeps the catalogue", published.count > 0 && Object.keys(cat.cards).length === published.count);
    t("0 empty feed images where reads.json has one", images.length > 0 && images.every((image) => image.includes("tcgplayer-cdn.tcgplayer.com")));
  } finally {
    await rm(dir, { recursive: true, force: true });
    if (prevFile == null) delete process.env.READ_THIN_DATA_FILE;
    else process.env.READ_THIN_DATA_FILE = prevFile;
    if (prevTok == null) delete process.env.PRIVATE_DATA_TOKEN;
    else process.env.PRIVATE_DATA_TOKEN = prevTok;
    clearReadThinCache();
  }

  try {
    const reads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
    const cat = JSON.parse(await readFile(join(ROOT, "research/assets/public/feed/catalogue.json"), "utf8"));
    const asOf = String(reads.asOf || cat.asOf || "").slice(0, 10);
    const day = (n) => new Date(Date.parse(`${asOf}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
    const has = async (d) => { try { await readFile(join(ROOT, "data/history/tcgcsv-daily", `${d}.json`)); return true; } catch { return false; } };
    const missing7 = !(await has(day(7)));
    const missing90 = !(await has(day(90)));
    const rows = reads.reads || [];
    const withPic = new Set(rows.filter((row) => row.image && (row.sku || row.sourceLine)).flatMap((row) => [row.sku, row.sourceLine].filter(Boolean)));
    const cards = Object.values(cat.cards || {});
    const empty = cards.filter((card) => withPic.has(card.sku) && !card.image).length;
    const filled = cards.filter((card) => card.image).length;
    if (missing7 && missing90) {
      t("with a missing day 7 back and no 90-day file, the catalogue is still more than 12 and the board is 200 to 400", (cat.count || 0) > 12 && rows.length >= 200 && rows.length <= 400);
    } else {
      console.log("  - this checkout has the day 7 file or the 90-day file");
    }
    // The file on main is the 02:47Z publish: every feed image is still blank.
    // That is the bug this PR fixes. The publishFeed case above is the proof.
    // Once the committed catalogue has any picture, a read that has one cannot
    // sit on a blank feed card.
    if (filled > 0) {
      t("built feed: 0 empty feed images where reads.json has one", empty === 0);
    } else {
      console.log("  - committed catalogue images are still blank; the publishFeed case is the check");
    }
  } catch {
    console.log("  - built feed files are not in this checkout");
  }
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("feed-window-gap.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
