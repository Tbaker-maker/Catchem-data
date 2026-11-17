// A held or unverified card must not show up in a read, a chip, a mover, or a set-value top.
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dropHeldChips, dropHeldReads, loadHeldIds, mentionsHeld, scrubHeldOutputs } from "../lib/price-hold-skip.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PUB = join(ROOT, "research/assets/public");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  const held = await loadHeldIds(ROOT);
  {
    const ids = new Set(["tcgcsv-85289"]);
    const doc = { byId: { "move-tcgcsv-85289-7": { s: 1 }, "move-tcgcsv-1-7": { s: 1 } }, bySku: { a: "move-tcgcsv-85289-7", b: "move-tcgcsv-1-7" }, samples: [{ id: "move-tcgcsv-85289-7" }] };
    const r = dropHeldChips(doc, ids);
    t("a held card's chip is left out after stamping", r.dropped === 1 && !r.doc.byId["move-tcgcsv-85289-7"] && r.doc.byId["move-tcgcsv-1-7"] && !r.doc.bySku.a && r.doc.samples.length === 0);
  }
  t("the hold file has cards", held.size > 1000);
  {
    // A card the rating flags "check" after build-feed ran must still leave the
    // reads, chips and item reads when the scrub runs again (2026-11-16 nightly).
    const tmp = await mkdtemp(join(tmpdir(), "held-scrub-"));
    try {
      const pub = join(tmp, "research/assets/public");
      await mkdir(join(pub, "feed/rating"), { recursive: true });
      await mkdir(join(pub, "feed/item-reads"), { recursive: true });
      await writeFile(join(pub, "feed/rating/06.json"), JSON.stringify({ rows: [{ id: "tcgcsv-9", check: true }, { id: "tcgcsv-8" }] }));
      await writeFile(join(pub, "reads.json"), JSON.stringify({ count: 2, reads: [{ id: "deep-set-x", family: "deep", lines: ["tcgcsv-9 up"] }, { id: "ok", family: "move", sku: "tcgcsv-8" }] }));
      await writeFile(join(pub, "signal-chips.json"), JSON.stringify({ byId: { "move-tcgcsv-9-30": { s: 1 }, "move-tcgcsv-8-30": { s: 1 } }, samples: [] }));
      await writeFile(join(pub, "feed/item-reads/09.json"), JSON.stringify({ items: { "tcgcsv-9": [{ id: "deep-rating-ir-above" }], "tcgcsv-8": [{ id: "keep" }] } }));
      await scrubHeldOutputs(tmp);
      const reads = JSON.parse(await readFile(join(pub, "reads.json"), "utf8"));
      const chips = JSON.parse(await readFile(join(pub, "signal-chips.json"), "utf8"));
      const items = JSON.parse(await readFile(join(pub, "feed/item-reads/09.json"), "utf8"));
      t("a card flagged by the rating leaves reads, chips and item reads", reads.reads.length === 1 && reads.reads[0].id === "ok" && !chips.byId["move-tcgcsv-9-30"] && !!chips.byId["move-tcgcsv-8-30"] && !items.items["tcgcsv-9"] && !!items.items["tcgcsv-8"]);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
    const writer = await readFile(join(ROOT, "scripts/write-feature-data.mjs"), "utf8");
    t("reads are scrubbed again after the rating build", writer.lastIndexOf("scrubHeldOutputs(ROOT)") > writer.indexOf("build-card-rating.mjs"));
  }
  const leaked = [];
  const note = (where, row) => {
    if (mentionsHeld(row, held)) leaked.push(`${where}:${row?.id || row?.sku || ""}`);
  };

  const reads = await readJson(join(PUB, "reads.json"));
  for (const row of reads.reads || []) note("reads", row);

  const extra = await readJson(join(PUB, "feed/extra-reads.json"));
  for (const row of extra.reads || []) note("extra", row);

  const lib = await readJson(join(PUB, "feed/read-library.json"));
  for (const row of lib.board || []) note("library-board", row);
  for (const row of lib.signals || []) note("library-signal", row);

  const chips = await readJson(join(PUB, "signal-chips.json"));
  for (const [id, row] of Object.entries(chips.byId || {})) {
    if (mentionsHeld(id, held) || mentionsHeld(row, held)) leaked.push(`chip:${id}`);
  }

  const movers = await readJson(join(PUB, "movers.json"));
  for (const [key, rows] of Object.entries(movers)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) if (mentionsHeld(row, held)) leaked.push(`mover:${key}:${row.id || ""}`);
  }

  const itemDir = join(PUB, "feed/item-reads");
  for (const name of (await readdir(itemDir)).filter((n) => n.endsWith(".json"))) {
    const doc = await readJson(join(itemDir, name));
    for (const [id, rows] of Object.entries(doc.items || {})) {
      if (held.has(id)) leaked.push(`item:${id}`);
      for (const row of rows || []) note(`item:${name}`, row);
    }
  }

  const factDir = join(PUB, "feed/facts");
  for (const name of (await readdir(factDir)).filter((n) => n.endsWith(".json"))) {
    if (mentionsHeld(name, held)) leaked.push(`fact:${name}`);
    else {
      const doc = await readJson(join(factDir, name));
      if (mentionsHeld(doc?.item?.id, held) || mentionsHeld(doc?.id, held)) leaked.push(`fact:${name}`);
    }
  }

  const valueDir = join(PUB, "set-value");
  let heldTops = 0;
  for (const name of (await readdir(valueDir)).filter((n) => n.endsWith(".json"))) {
    const doc = await readJson(join(valueDir, name));
    for (const row of doc.top || []) if (held.has(row.id)) heldTops += 1;
  }

  t("no held or unverified card appears in any read", leaked.length === 0);
  if (leaked.length) console.error(leaked.slice(0, 12).join("\n"));
  t("set value tops leave out held cards", heldTops === 0);
  const sample = dropHeldReads([
    { id: "deep-slump-tcgcsv-1", sku: "tcgcsv-1", headline: "Slump watch" },
    { id: "ok", sku: "tcgcsv-2", headline: "A modern card" },
  ], new Set(["tcgcsv-1"]));
  t("the read filter drops a held card and keeps the rest", sample.length === 1 && sample[0].id === "ok");
  return fail;
}
