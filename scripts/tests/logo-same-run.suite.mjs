// Same-run logo registration must keep the published sets in search.
// The startup catalogue map still points at the old missing paths.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerMissingSets } from "../lib/set-logo-register.mjs";
import { resolveSetLogo, shouldQuarantine } from "../lib/set-quarantine.mjs";

const ROOT = join(new URL("../../", import.meta.url).pathname);

const TEN = [
  { slug: "base-set", name: "Base Set", oldId: "base1" },
  { slug: "black-and-white-promos", name: "Black and White Promos", oldId: "bwp" },
  { slug: "diamond-and-pearl-promos", name: "Diamond and Pearl Promos", oldId: "dpp" },
  { slug: "hgss-promos", name: "HGSS Promos", oldId: "hsp" },
  { slug: "sm-promos", name: "SM Promos", oldId: "smp" },
  { slug: "sv-scarlet-and-violet-promo-cards", name: "SV: Scarlet & Violet Promo Cards", oldId: "svp" },
  { slug: "sve-scarlet-and-violet-energies", name: "SVE: Scarlet & Violet Energies", oldId: "sve" },
  { slug: "swsh-sword-and-shield-promo-cards", name: "SWSH: Sword & Shield Promo Cards", oldId: "swshp" },
  { slug: "wotc-promo", name: "WoTC Promo", oldId: "basep" },
  { slug: "xy-promos", name: "XY Promos", oldId: "xyp" },
];

const SV_ROWS = [
  ["tcgcsv-518861", "Pikachu with Grey Felt Hat", "SV: Scarlet & Violet Promo Cards", "085", "", "single", 0, "sv-scarlet-and-violet-promo-cards", ""],
  ["tcgcsv-542481", "Pikachu - 088", "SV: Scarlet & Violet Promo Cards", "088", "", "single", 0, "sv-scarlet-and-violet-promo-cards", ""],
];

function staleLogos() {
  const logos = {};
  for (const row of TEN) {
    const path = `/img/${row.oldId}/logo.png`;
    const entry = { setId: row.oldId, slug: row.slug, name: row.name, logo: path, src: path };
    logos[row.slug] = entry;
    logos[row.oldId] = entry;
  }
  return logos;
}

function catalogueFrom(logos) {
  const images = {};
  for (const [id, row] of Object.entries(logos)) {
    if (row && typeof row.src === "string") images[id] = row.src;
    if (row && row.setId && typeof row.src === "string") images[row.setId] = row.src;
  }
  return images;
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const dir = await mkdtemp(join(tmpdir(), "logo-same-run-"));
  try {
    const logos = staleLogos();
    const catalogueImages = catalogueFrom(logos);
    const before = [];
    for (const row of TEN) {
      const logo = await resolveSetLogo(row.slug, { logos, catalogueImages, root: dir });
      const quarantined = await shouldQuarantine(dir, logo);
      before.push(`${quarantined ? "QUARANTINE" : "KEEP"} ${row.slug} ${logo}`);
      if (row.slug === "base-set" || row.slug === "sv-scarlet-and-violet-promo-cards") {
        t(`before registration ${row.slug} is quarantined`, quarantined && logo === `/img/${row.oldId}/logo.png`);
      }
    }
    t("before registration all ten are quarantined", before.every((line) => line.startsWith("QUARANTINE")) && before.length === 10);

    const registered = await registerMissingSets({
      root: dir,
      sets: TEN.map((row) => ({ slug: row.slug, name: row.name })),
      logos,
      fetchImpl: async () => new Response("no", { status: 404 }),
      pace: async () => {},
    });
    const search = [];
    const after = [];
    for (const row of TEN) {
      const logo = await resolveSetLogo(row.slug, { logos, catalogueImages, root: dir });
      const quarantined = await shouldQuarantine(dir, logo);
      after.push(`${quarantined ? "QUARANTINE" : "KEEP"} ${row.slug} ${logo}`);
      if (quarantined) continue;
      if (row.slug === "base-set") {
        search.push(["tcgcsv-42382", "Charizard", "Base Set", "004/102", "", "single", 0, row.slug, ""]);
      }
      if (row.slug === "sv-scarlet-and-violet-promo-cards") search.push(...SV_ROWS);
    }
    t("same-run registration registers all ten", registered.registered.length === 10 && TEN.every((row) => registered.registered.includes(row.slug)));
    t("after registration none of the ten are quarantined", after.every((line) => line.startsWith("KEEP")) && after.length === 10);
    t("base set stays in search", search.some((row) => row[7] === "base-set" && row[1] === "Charizard"));
    t("sv promo grey felt hat stays in search", search.some((row) => row[0] === "tcgcsv-518861" && row[7] === "sv-scarlet-and-violet-promo-cards"));
    t("sv promo pikachu 088 stays in search", search.some((row) => row[0] === "tcgcsv-542481" && /088/.test(String(row[3])) && row[7] === "sv-scarlet-and-violet-promo-cards"));
    t("a just registered logo is the file on disk", after.every((line) => /\/img\/[a-z0-9]+\/logo\.png$/.test(line) && !/\/img\/(base1|bwp|dpp|hsp|smp|svp|sve|swshp|basep|xyp)\//.test(line)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const liveLogos = JSON.parse(await readFile(join(ROOT, "research/assets/public/set-logos.json"), "utf8")).logos;
  const liveImages = catalogueFrom(liveLogos);
  for (const row of TEN) {
    const logo = await resolveSetLogo(row.slug, { logos: liveLogos, catalogueImages: liveImages, root: ROOT });
    const quarantined = await shouldQuarantine(ROOT, logo);
    t(`committed ${row.slug} stays published`, !quarantined && logo.startsWith("/img/") && !logo.includes("images.scrydex.com"));
  }
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("logo-same-run.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
