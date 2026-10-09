// Official set logos keyed by set id and by site slug.
//
// The URL is copied from data/set-logos.json (pokemontcg.io /v2/sets, including
// the scrydex URLs that file already publishes). A logo is never built from a
// slug, and a name is never scored. Gallery subsets use the parent set's logo.
// A set with no official record is left without a logo.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const PARENT = {
  "swsh09-brilliant-stars-trainer-gallery": "swsh9",
  "swsh10-astral-radiance-trainer-gallery": "swsh10",
  "swsh11-lost-origin-trainer-gallery": "swsh11",
  "swsh12-silver-tempest-trainer-gallery": "swsh12",
  "swsh-crown-zenith-galarian-gallery": "swsh12pt5",
  "hidden-fates-shiny-vault": "sm115",
  "shining-fates-shiny-vault": "swsh45",
  "celebrations-classic-collection": "cel25",
  "legendary-treasures-radiant-collection": "bw11",
  "generations-radiant-collection": "g1",
};

// The 8 logos that are wrong on the live site. Crystal Guardians has a real
// set. The other seven do not, so the wrong id is removed rather than replaced.
const FIX = { "ex-crystal-guardians": "ex14" };
const DENY = new Set([
  "ex-battle-stadium",
  "league-and-championship-cards",
  "blister-exclusives",
  "battle-academy-2024",
  "mcdonald-s-promos-2023",
  "countdown-calendar-promos",
  "burger-king-promos",
]);

// Explicit ids. These names do not equal the official name, and the cards do.
const ALIAS = {
  "hgss-promos": "hsp",
  "xy-promos": "xyp",
  rumble: "ru1",
  "nintendo-promos": "",
};

// Confirmed by set id, not by name. mep's own Scrydex logo is the generic
// promo star (same bytes as svp and swshp), so the promo set uses the ME01 logo.
// mee is Scrydex's own id: card mee-1 is that set's Grass Energy, and the logo
// bytes are neither fallback.
const EXTRA = {
  "me-mega-evolution-promo": {
    setId: "mep",
    parentSetId: "me1",
    logoFrom: "me1",
    confirmed: "Catalogue cards are setId mep (mep-9, mep-10, mep-22, mep-31). Scrydex image mep-003 is Alakazam 003, a card in this set. The mep logo URL is the generic promo star, so the logo is parent me1.",
  },
  "mee-mega-evolution-energies": {
    setId: "mee",
    logo: "https://images.scrydex.com/pokemon/mee-logo/logo",
    src: "",
    confirmed: "Scrydex card id mee-1 is Basic Grass Energy from this set, not an unknown-id fallback. Logo sha256 0dd471be5fa51a263ef4487eedc11ef49ac1e3a92f0635312579b6df88922b90 matches neither rejected image.",
  },
};

// Scrydex serves these two images for ids that are not a real set logo.
const REJECT_SHA256 = {
  genericSet: "97bd74b939562df8df81ca5adb37db55632fea64eca631208e02152344c6ee3b",
  genericPromo: "7d7c739c448dfb28d03b38310f834e0cfdd748d8a37dcc34169a4f8c33bd2dd7",
};
const PTCG_LOGO = /^https:\/\/images\.pokemontcg\.io\/([A-Za-z0-9]+)\/logo\.png$/;
const SCRY_LOGO = /^https:\/\/images\.scrydex\.com\/pokemon\/([A-Za-z0-9]+)-logo\/logo$/;
const PREFIX = /^(?:ex|xy|sm|sv|swsh|mee|me|sve|bw|dp|hgss|hs)\d*(?:pt\d+)?\s+/;

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function keysFor(name) {
  const n = norm(name);
  const out = new Set([n]);
  const m = n.match(PREFIX);
  if (m) {
    const rest = n.slice(m[0].length).trim();
    if (rest && rest !== n) out.add(rest);
  }
  return out;
}

function currentId(logo) {
  const p = String(logo || "").match(PTCG_LOGO);
  if (p) return p[1];
  const s = String(logo || "").match(SCRY_LOGO);
  return s ? s[1] : "";
}

function catalogueSrc(logo, setId) {
  const m = String(logo || "").match(PTCG_LOGO);
  if (!m || m[1] !== setId) return "";
  return `/img/${setId}/logo.png`;
}

export async function buildSetLogoIndex(root = ROOT) {
  const officialDoc = JSON.parse(await readFile(join(root, "data/set-logos.json"), "utf8"));
  const official = officialDoc.sets || {};
  const keyToIds = new Map();
  for (const [id, meta] of Object.entries(official)) {
    for (const key of keysFor(meta.name)) {
      if (!keyToIds.has(key)) keyToIds.set(key, new Set());
      keyToIds.get(key).add(id);
    }
  }
  const dir = join(root, "research/assets/public/sets");
  const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  const rows = [];
  for (const name of names) {
    const doc = JSON.parse(await readFile(join(dir, name), "utf8"));
    rows.push({
      slug: doc.slug || name.slice(0, -5),
      name: doc.name || "",
      logo: typeof doc.logo === "string" ? doc.logo : "",
      lid: currentId(doc.logo),
    });
  }

  const assigned = new Map();
  for (const row of rows) {
    const { slug } = row;
    if (PARENT[slug]) {
      assigned.set(slug, { id: PARENT[slug], reason: "parent" });
      continue;
    }
    if (FIX[slug]) {
      assigned.set(slug, { id: FIX[slug], reason: "fix" });
      continue;
    }
    if (EXTRA[slug]) {
      assigned.set(slug, { id: EXTRA[slug].setId, reason: "confirmed" });
      continue;
    }
    if (DENY.has(slug)) {
      assigned.set(slug, { id: "", reason: "deny" });
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(ALIAS, slug)) {
      assigned.set(slug, { id: ALIAS[slug], reason: ALIAS[slug] ? "alias" : "alias-none" });
      continue;
    }
    const year = norm(row.name).match(/mcdonald s promos (\d{4})/);
    if (year) {
      const id = `mcd${year[1].slice(2)}`;
      assigned.set(slug, { id: official[id] ? id : "", reason: official[id] ? "mcd-year" : "mcd-no-official" });
      continue;
    }
    if (row.lid && official[row.lid]) {
      assigned.set(slug, { id: row.lid, reason: "preserve" });
      continue;
    }
    const hits = new Set();
    for (const key of keysFor(row.name)) {
      for (const id of keyToIds.get(key) || []) hits.add(id);
    }
    if (hits.size === 1) assigned.set(slug, { id: [...hits][0], reason: "exact" });
    else if (hits.size > 1) assigned.set(slug, { id: "", reason: `collision:${[...hits].sort().join(",")}` });
    else assigned.set(slug, { id: "", reason: "none" });
  }

  for (const row of rows) {
    const { id } = assigned.get(row.slug);
    if (!row.lid || !official[row.lid]) continue;
    if (PARENT[row.slug] || FIX[row.slug] || DENY.has(row.slug)) continue;
    if (id !== row.lid) throw new Error(`${row.slug} would change ${row.lid} to ${id || "(none)"}`);
  }

  const entries = [];
  const noLogo = [];
  for (const row of rows) {
    const spec = EXTRA[row.slug];
    if (spec) {
      const parent = spec.logoFrom ? official[spec.logoFrom] : null;
      const logo = spec.logo || parent?.logo || "";
      if (!/^https:\/\//.test(logo)) throw new Error(`${row.slug} has no confirmed logo`);
      if (spec.logoFrom && spec.logoFrom !== "me1") throw new Error(`${row.slug} parent is not me1`);
      const entry = {
        setId: spec.setId,
        slug: row.slug,
        name: row.name,
        logo,
        src: spec.src != null ? spec.src : catalogueSrc(logo, spec.logoFrom || spec.setId),
        confirmed: spec.confirmed,
        via: "confirmed",
      };
      if (spec.parentSetId) entry.parentSetId = spec.parentSetId;
      entries.push(entry);
      continue;
    }
    const { id, reason } = assigned.get(row.slug);
    if (!id) {
      noLogo.push({ slug: row.slug, name: row.name });
      continue;
    }
    const meta = official[id];
    if (!meta || !/^https:\/\//.test(meta.logo || "")) throw new Error(`${row.slug} -> ${id} has no official logo`);
    const entry = {
      setId: id,
      slug: row.slug,
      name: row.name,
      logo: meta.logo,
      src: catalogueSrc(meta.logo, id),
    };
    if (PARENT[row.slug]) entry.parentSetId = id;
    if (reason) entry.via = reason;
    entries.push(entry);
  }

  const folded = official.me55;
  if (!folded || !/^https:\/\//.test(folded.logo || "")) throw new Error("me55 has no official logo");
  const classic = {
    setId: "me55",
    slug: "me-30th-celebration",
    name: "30th Celebration: Classic Collection",
    parentSetId: "me55",
    gallerySetId: "me55c",
    foldedInto: "me-30th-celebration",
    logo: folded.logo,
    src: catalogueSrc(folded.logo, "me55"),
    via: "parent",
  };

  const logos = {};
  for (const entry of entries) {
    const { via, ...publicEntry } = entry;
    void via;
    logos[entry.slug] = publicEntry;
    if (!logos[entry.setId] || !PARENT[entry.slug]) logos[entry.setId] = publicEntry;
  }
  const galleryIds = {
    swsh9tg: "swsh9",
    swsh10tg: "swsh10",
    swsh11tg: "swsh11",
    swsh12tg: "swsh12",
    swsh12pt5gg: "swsh12pt5",
    sma: "sm115",
    swsh45sv: "swsh45",
    cel25c: "cel25",
    me55c: "me55",
  };
  for (const [galleryId, parentId] of Object.entries(galleryIds)) {
    const parent = logos[parentId];
    if (!parent) throw new Error(`missing parent ${parentId} for ${galleryId}`);
    logos[galleryId] = {
      setId: parentId,
      slug: parent.slug,
      name: official[galleryId]?.name || parent.name,
      parentSetId: parentId,
      gallerySetId: galleryId,
      logo: parent.logo,
      src: parent.src,
    };
  }
  logos.me55c = {
    setId: "me55",
    slug: classic.slug,
    name: classic.name,
    parentSetId: "me55",
    gallerySetId: "me55c",
    foldedInto: classic.foldedInto,
    logo: classic.logo,
    src: classic.src,
  };

  const ordered = {};
  for (const key of Object.keys(logos).sort()) ordered[key] = logos[key];
  noLogo.sort((a, b) => a.slug.localeCompare(b.slug));
  const withLogo = entries.length + 1;
  return {
    index: {
      source: "Official logos from data/set-logos.json (pokemontcg.io /v2/sets, including scrydex URLs that file already publishes), plus two ids confirmed on Scrydex: mep uses the parent me1 logo, mee uses its own logo. Keyed by set id and by site slug. Gallery subsets use the parent logo. No logo was invented. A name is not a match.",
      read: "Look up research/assets/public/set-logos.json by site slug or by set id. Write logo (the https URL) onto the set. src is /img/{setId}/logo.png only when that logo is on images.pokemontcg.io. Reject a Scrydex image whose sha256 is rejectSha256.genericSet (the Pokémon Trading Card Game fallback returned for any unknown id) or rejectSha256.genericPromo (the shared PROMO star).",
      rejectSha256: REJECT_SHA256,
      universe: names.length + 1,
      publishedSets: names.length,
      withLogo,
      logos: ordered,
      noLogo,
    },
    entries,
    noLogo,
    rows,
    assigned,
  };
}

function patchSetText(text, logo) {
  const header = /^(\{"slug":"[^"]+","name":"(?:\\.|[^"\\])*","era":"[^"]*","release":"[^"]*","single":\d+,"sealed":\d+,"priced":\d+)(,"logo":"[^"]+")?(,"source":)/;
  const m = text.match(header);
  if (!m) throw new Error("set header did not match");
  const next = logo ? `${m[1]},"logo":${JSON.stringify(logo)}${m[3]}` : `${m[1]}${m[3]}`;
  return next + text.slice(m[0].length);
}

async function writeOutputs(root, built) {
  const pub = join(root, "research/assets/public");
  await writeFile(join(pub, "set-logos.json"), JSON.stringify(built.index));
  const bySlug = new Map(built.entries.map((entry) => [entry.slug, entry]));
  for (const row of built.rows) {
    const entry = bySlug.get(row.slug);
    const logo = entry ? entry.logo : "";
    if ((row.logo || "") === logo) continue;
    const path = join(pub, "sets", `${row.slug}.json`);
    const text = await readFile(path, "utf8");
    const next = patchSetText(text, logo);
    JSON.parse(next);
    await writeFile(path, next);
  }
  const setsPath = join(pub, "sets.json");
  const setsDoc = JSON.parse(await readFile(setsPath, "utf8"));
  for (const set of setsDoc.sets || []) {
    const entry = bySlug.get(set.slug);
    if (entry) set.logo = entry.logo;
    else delete set.logo;
  }
  await writeFile(setsPath, JSON.stringify(setsDoc));

  const catPath = join(pub, "catalogue-images.json");
  const cat = JSON.parse(await readFile(catPath, "utf8"));
  const images = cat.images || {};
  for (const [key, row] of Object.entries(built.index.logos)) {
    if (!row.src) continue;
    const prev = images[key];
    if (prev && prev !== row.src) throw new Error(`catalogue key ${key} is ${prev}, not ${row.src}`);
    images[key] = row.src;
  }
  const ordered = {};
  for (const id of Object.keys(images).sort()) ordered[id] = images[id];
  await writeFile(catPath, JSON.stringify({ source: cat.source, images: ordered }));

  const missingPath = join(pub, "missing-from-catalogue.json");
  const missing = JSON.parse(await readFile(missingPath, "utf8"));
  const absent = [];
  let matched = 0;
  for (const row of built.rows) {
    const entry = bySlug.get(row.slug);
    if (entry && entry.src && images[row.slug] === entry.src) matched += 1;
    else absent.push(row.slug);
  }
  absent.sort();
  missing.matchedById = { ...(missing.matchedById || {}), setLogos: matched };
  missing.setLogos = {
    status: "missing from the catalogue",
    count: absent.length,
    ids: absent,
  };
  await writeFile(missingPath, JSON.stringify(missing));
  return { matched, absent: absent.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const built = await buildSetLogoIndex(ROOT);
  const stats = await writeOutputs(ROOT, built);
  const fixed = [
    ["ex-crystal-guardians", "ex14"],
    ["ex-battle-stadium", ""],
    ["league-and-championship-cards", ""],
    ["blister-exclusives", ""],
    ["battle-academy-2024", ""],
    ["mcdonald-s-promos-2023", ""],
    ["countdown-calendar-promos", ""],
    ["burger-king-promos", ""],
  ];
  for (const [slug, id] of fixed) {
    const got = built.assigned.get(slug)?.id || "";
    if (got !== id) throw new Error(`fix ${slug} is ${got}, expected ${id || "(none)"}`);
  }
  for (const [slug, id] of Object.entries(PARENT)) {
    if (built.assigned.get(slug)?.id !== id) throw new Error(`parent ${slug} is not ${id}`);
  }
  console.log(`published ${built.index.publishedSets} withLogo ${built.index.withLogo} of ${built.index.universe}`);
  console.log(`no logo ${built.noLogo.length}`);
  console.log(`catalogue set paths ${stats.matched} still missing ${stats.absent}`);
  for (const row of built.noLogo) console.log(`no-logo ${row.slug} ${row.name}`);
}
