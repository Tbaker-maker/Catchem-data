// Variant tags on Feed reads. Rebuilds the variant file from the catalog (so it
// refreshes every night with build-feed), stamps tags on each read that points at
// one card, and names the headline tag in the line when the line names the card.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { variantTags, subtypeIndex, TAG_ORDER } from "./variant-tags.mjs";

// Tags worth naming in a sentence. Printing and promo tags stay as chips only.
export const SAY = ["Special Illustration Rare", "Illustration Rare", "Alternate Art", "Trainer Gallery", "Galarian Gallery", "Shiny Vault", "Gold", "Rainbow Rare", "Amazing Rare", "Radiant", "Classic Collection"];

export async function buildVariantFile(root) {
  const J = async (p) => JSON.parse(await readFile(join(root, p), "utf8"));
  const catalog = await J("data/catalog/tcgcsv-latest.json");
  const map = await J("data/tcgcsv-to-catalogue.json").catch(() => ({}));
  const subs = subtypeIndex(map, await J("data/card-attrs.json").catch(() => ({})));
  const catId = new Map((map.mapped || []).map((m) => [m.id, m.catalogueId]));
  const cards = {};
  const counts = Object.fromEntries(TAG_ORDER.map((t) => [t, 0]));
  for (const item of catalog.items || []) {
    const tags = variantTags(item, { subtypes: subs.get(item.id) });
    if (!tags.length) continue;
    cards[item.id] = { tags, ...(catId.get(item.id) ? { catalogueId: catId.get(item.id) } : {}) };
    for (const t of tags) counts[t] += 1;
  }
  const doc = {
    asOf: catalog.asOf,
    note: "Variant tags describe how a card was made in its set. Separate from rarity. Derived only from TCGplayer rarity and product name, the collector number, pokemontcg.io subtypes, and printings. A card with no clear signal has no tag.",
    counts,
    cards,
  };
  const body = JSON.stringify(doc) + "\n";
  await writeFile(join(root, "data/card-variants.json"), body);
  await mkdir(join(root, "research/assets/public/feed"), { recursive: true });
  await writeFile(join(root, "research/assets/public/feed/card-variants.json"), body);
  return doc;
}

const baseName = (n) => String(n || "").replace(/\s+-\s+[A-Z]*\d+[a-z]?(\/[A-Z]*\d+)?$/i, "").trim();

export function tagRead(read, cards) {
  const m = String(read?.href || "").match(/^\/c\/(tcgcsv-\d+)$/);
  const tags = m ? cards[m[1]]?.tags : null;
  if (!tags?.length) return read;
  const out = { ...read, tags };
  const say = tags.find((t) => SAY.includes(t));
  const base = baseName(read.name);
  if (say && base && !/\(alternate/i.test(base)) {
    const at = (s) => {
      if (typeof s !== "string" || s.toLowerCase().includes(say.toLowerCase())) return s;
      const i = s.indexOf(base + " (");
      return i < 0 ? s : s.slice(0, i + base.length) + " " + say + s.slice(i + base.length);
    };
    out.headline = at(read.headline);
    if (read.path === read.headline) out.path = out.headline;
    else if (typeof read.path === "string") out.path = at(read.path);
  }
  return out;
}

export async function tagReadsFile(root, cards) {
  const p = join(root, "research/assets/public/reads.json");
  const doc = JSON.parse(await readFile(p, "utf8"));
  let tagged = 0, named = 0;
  doc.reads = (doc.reads || []).map((r) => {
    const t = tagRead(r, cards);
    if (t !== r) { tagged += 1; if (t.headline !== r.headline) named += 1; }
    return t;
  });
  await writeFile(p, JSON.stringify(doc, null, 1) + "\n");
  return { tagged, named };
}
