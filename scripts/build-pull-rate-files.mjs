// Writes one pull-rate file per set id that Rip value listed as having no source,
// and appends rows to data/pull-rates.json only when a public source states the rate.
// Parent rows only. Child breakdowns of the same hits are not added.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const E4 = "https://www.elitefourum.com/t/pull-rates-in-sun-moon-sword-shield-sets/25220";
const PN = "https://pullnomics.com/guides/pokemon-tcg-pull-rates-by-set";
const POKE = "https://www.pokemon.com/us/pokemon-tcg/trading-card-expansions";
const UPDATED = "2026-10-13";
const SLOT = "any card of this rarity, per booster pack";

const E4_METHOD = "Parent row from a community count of opening videos. Child rows that split the same hits are not added. The guide says it found no official English rates.";
const PN_METHOD = "Midpoint of published ranges (TCGplayer pack-opening counts and community counts), collected September 2026. The guide says it found no official English or Japanese pull rates.";

function encodeUrl(url) {
  return String(url || "").replaceAll("\u2014", "%E2%80%94");
}
const J = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));
const pctOf = (oneIn) => Math.round((100 / oneIn) * 10000) / 10000;
const bps = (pct) => Math.round(pct * 100);

function e4(setId, date, samplePacks, slots, extra = {}) {
  return { setId, date, samplePacks, author: "Elite Fourum", url: E4, method: E4_METHOD, slots, ...extra };
}
function slot(articleRarity, rarity, tag, pool, pct, ci95, rip = true) {
  return { articleRarity, rarity, tag, pool, pct, ci95, rip };
}
const UR = (pct, ci) => slot("Ultra Rare", "Ultra Rare", "Full Art", "swsh-full-art", pct, ci);
const V = (pct, ci) => slot("Holo Rare V", "Ultra Rare", "Holo Rare V", "swsh-v", pct, ci);
const VX = (pct, ci) => slot("Holo Rare VMAX", "Ultra Rare", "Holo Rare VMAX", "swsh-vmax", pct, ci);
const RB = (pct, ci) => slot("Rainbow Rare", "Secret Rare", "Rainbow Rare", "swsh-rainbow", pct, ci);
const GD = (pct, ci) => slot("Secret Rare", "Secret Rare", "Gold", "swsh-gold", pct, ci);
const SU = (pct, ci) => slot("rare Ultra", "Ultra Rare", "Full Art", "sm-full-art", pct, ci);
const GX = (pct, ci) => slot("rare Holo GX", "Ultra Rare", "GX", "sm-gx", pct, ci);
const SRB = (pct, ci) => slot("rare Rainbow", "Rainbow Rare", "Rainbow Rare", "sm-rainbow", pct, ci);
const SEC = (pct, ci) => slot("rare Secret", "Secret Rare", "Secret", "sm-secret", pct, ci);
const PR = (pct, ci) => slot("rare Prism Star", "Rare Prism Star", "Prism Star", "sm-prism", pct, ci);
const SH = (pct, ci) => slot("rare Shiny", "Shiny Holo Rare", "Shiny", "sm-shiny", pct, ci);
const SHX = (pct, ci) => slot("rare Shiny GX", "Shiny Holo Rare", "Shiny GX", "sm-shiny-gx", pct, ci);

const QUOTED = [
  e4("sm1", "2020-07-18", 7020, [SU(4.22, 0.47), GX(11.15, 0.74), SRB(1.47, 0.28), SEC(0.81, 0.21)]),
  e4("sm2", "2020-07-18", 2088, [SU(3.59, 0.80), GX(11.11, 1.35), SRB(1.29, 0.48), SEC(0.81, 0.39)]),
  e4("sm3", "2020-07-18", 2010, [SU(3.93, 0.85), GX(10.95, 1.37), SRB(1.59, 0.55), SEC(0.95, 0.42)]),
  e4("sm35", "2020-07-18", 1536, [SU(3.97, 0.98), GX(11.85, 1.62), SRB(1.50, 0.61), SEC(0.91, 0.48), SH(8.72, 1.41)]),
  e4("sm4", "2020-07-18", 1530, [SU(4.44, 1.03), GX(8.30, 1.38), SRB(1.11, 0.53), SEC(1.11, 0.53)]),
  e4("sm5", "2020-07-18", 1674, [SU(4.30, 0.97), GX(8.00, 1.30), SRB(1.49, 0.58), SEC(0.78, 0.42), PR(8.72, 1.35)]),
  e4("sm6", "2020-07-18", 1264, [SU(3.56, 1.02), GX(7.44, 1.45), SRB(1.34, 0.64), SEC(0.71, 0.46), PR(7.91, 1.49)]),
  e4("sm7", "2020-07-18", 1480, [SU(3.78, 0.97), GX(10.34, 1.55), SRB(1.22, 0.56), SEC(0.88, 0.48), PR(5.47, 1.16)]),
  e4("sm75", "2020-07-18", 389, [SU(6.94, 2.53), GX(15.42, 3.59), SRB(2.31, 1.50), SEC(0.77, 0.87), PR(10.80, 3.09)], {
    caveat: "The study says special sets such as Dragon Majesty are not statistically significant. The stated rates are still recorded, with the sample size and the 95% interval.",
  }),
  e4("sm8", "2020-07-18", 1274, [SU(4.40, 1.13), GX(10.28, 1.67), SRB(1.33, 0.63), SEC(1.02, 0.55), PR(12.17, 1.80)]),
  e4("sm9", "2020-07-18", 872, [SU(4.82, 1.42), GX(9.29, 1.93), SRB(1.03, 0.67), SEC(0.69, 0.55), PR(5.96, 1.57)]),
  e4("det1", "2020-07-18", 240, [slot("rare Holo", "Holo Rare", "Holo", null, 37.08, 6.12, false)], {
    caveat: "The study says the Detective Pikachu sample is not statistically significant. The rare Holo line is recorded and is not applied to Rip value, because it is not a separate hit slot above the rare slot.",
  }),
  e4("sm10", "2020-07-18", 3888, [SU(4.12, 0.62), GX(9.88, 0.94), SRB(1.39, 0.37), SEC(0.90, 0.30)]),
  e4("sm11", "2020-07-18", 3672, [SU(4.36, 0.66), GX(12.72, 1.08), SRB(1.44, 0.39), SEC(0.90, 0.31)]),
  e4("sm115", "2020-07-18", 1580, [SU(4.87, 1.06), GX(15.06, 1.76), SRB(1.71, 0.64), SEC(1.77, 0.65), SH(21.20, 2.02), SHX(10.19, 1.49)]),
  e4("sm12", "2020-07-18", 3136, [SU(3.67, 0.66), GX(11.93, 1.13), SRB(1.50, 0.43), SEC(11.00, 1.10)]),
  e4("swsh1", "2020-02-13", 4628, [UR(3.74, 0.55), V(14.20, 1.01), VX(2.20, 0.42), RB(1.23, 0.32), GD(0.91, 0.27)]),
  e4("swsh2", "2020-07-18", 2736, [UR(3.76, 0.71), V(12.65, 1.25), VX(3.40, 0.68), RB(1.50, 0.46), GD(0.95, 0.36)]),
  e4("swsh3", "2020-09-16", 5040, [UR(3.85, 0.53), V(12.58, 0.92), VX(3.85, 0.53), RB(1.19, 0.30), GD(0.87, 0.26)]),
  e4("swsh35", "2020-09-26", 3192, [UR(5.39, 0.78), V(15.73, 1.26), VX(3.55, 0.62), RB(1.57, 0.43), GD(1.32, 0.40)]),
];

function pn(setId, pairs) {
  const slots = pairs.map(([article, rarity, tag, pool, oneIn]) => ({
    articleRarity: article, rarity, tag, pool, pct: pctOf(oneIn), ci95: null, oneIn, rip: true,
  }));
  return { setId, date: "2026-09-15", dataAsOf: "2026-09-20", samplePacks: null, author: "Pullnomics", url: PN, method: PN_METHOD, slots };
}
const QUOTED_PN = [
  pn("swsh4", [
    ["Pokemon V", "Ultra Rare", "Holo Rare V", "swsh-v", 8],
    ["VMAX", "Ultra Rare", "Holo Rare VMAX", "swsh-vmax", 23.5],
    ["Full art", "Ultra Rare", "Full Art", "swsh-full-art", 25],
    ["Rainbow", "Secret Rare", "Rainbow Rare", "swsh-rainbow", 74.5],
    ["Gold secret", "Secret Rare", "Gold", "swsh-gold", 93],
  ]),
  pn("swsh6", [
    ["VMAX", "Ultra Rare", "Holo Rare VMAX", "swsh-vmax", 30],
    ["Full art", "Ultra Rare", "Full Art", "swsh-full-art", 27],
    ["Rainbow", "Secret Rare", "Rainbow Rare", "swsh-rainbow", 122],
  ]),
  pn("swsh8", [
    ["Pokemon V", "Ultra Rare", "Holo Rare V", "swsh-v", 11],
    ["VMAX", "Ultra Rare", "Holo Rare VMAX", "swsh-vmax", 26.5],
    ["Full art", "Ultra Rare", "Full Art", "swsh-full-art", 26],
    ["Rainbow", "Secret Rare", "Rainbow Rare", "swsh-rainbow", 92],
    ["Gold secret", "Secret Rare", "Gold", "swsh-gold", 120],
  ]),
  pn("swsh9", [
    ["Pokemon V", "Ultra Rare", "Holo Rare V", "swsh-v", 7.5],
    ["Full art", "Ultra Rare", "Full Art", "swsh-full-art", 19],
    ["Rainbow", "Secret Rare", "Rainbow Rare", "swsh-rainbow", 78],
    ["Gold secret", "Secret Rare", "Gold", "swsh-gold", 67],
  ]),
  pn("swsh45", [
    ["Pokemon V", "Ultra Rare", "Holo Rare V", "swsh-v", 9],
    ["VMAX", "Ultra Rare", "Holo Rare VMAX", "swsh-vmax", 19],
    ["Full art", "Ultra Rare", "Full Art", "swsh-full-art", 32],
    ["Rainbow", "Secret Rare", "Rainbow Rare", "swsh-rainbow", 91],
    ["Gold secret", "Secret Rare", "Gold", "swsh-gold", 156],
  ]),
];

const SHINING_CROSS = {
  "Pokemon V": { pct: 10.84, oneInPacks: 9.23, note: "Holo Rare V, n=2187, 95% CI 1.30 percentage points" },
  "VMAX": { pct: 5.44, oneInPacks: 18.38, note: "Holo Rare VMAX, n=2187, 95% CI 0.95 percentage points" },
  "Full art": { pct: 3.25, oneInPacks: 30.80, note: "Ultra Rare parent, n=2187, 95% CI 0.74 percentage points" },
  Rainbow: { pct: 1.19, oneInPacks: 84.12, note: "Rainbow Rare, n=2187, 95% CI 0.45 percentage points" },
  "Gold secret": { pct: 0.91, oneInPacks: 109.35, note: "Secret Rare Pokemon (Gold), n=2187, 95% CI 0.40 percentage points. This line is the gold slot in that table, not a child of a wider secret row." },
};
const SHINING_EXTRA = [
  slot("Amazing Rare", "Amazing Rare", "Amazing Rare", "swsh-amazing", 5.76, 0.98),
  slot("Shiny Rare", "Shiny Holo Rare", "Shiny", "swsh-shiny", 22.73, 1.76),
  slot("Shiny Rare V or VMAX", "Shiny Holo Rare", "Shiny V", "swsh-shiny-v", 8.96, 1.20),
];

function rowFrom(set, s, setSlug, setName) {
  const cross = set.setId === "swsh45" && set.author === "Pullnomics" ? SHINING_CROSS[s.articleRarity] : null;
  return {
    setSlug,
    setName,
    slot: SLOT,
    articleRarity: s.articleRarity,
    rarity: s.rarity,
    tag: s.tag,
    pool: s.pool,
    pct: s.pct,
    ci95: s.ci95,
    basisPoints: bps(s.pct),
    samplePacks: set.samplePacks,
    oneIn: s.oneIn || null,
    sourceUrl: set.url,
    published: set.date,
    dataAsOf: set.dataAsOf || null,
    updated: UPDATED,
    author: set.author,
    method: set.method,
    rip: s.rip !== false,
    ...(cross ? { crossChecks: [{ source: "Elite Fourum", url: E4, date: "2021-03-10", pct: cross.pct, oneInPacks: cross.oneInPacks, note: cross.note }] } : {}),
  };
}

function logoId(logo) {
  const m = String(logo || "").match(/\/img\/([^/]+)\//);
  return m ? m[1] : "";
}

const NO_RATE_NOTE = "No official English pull rate was found for this set id. Checked the Pokemon TCG expansion list (no rates on the page), the Pullnomics guide (this set is not in the table; the guide says it found no official English rates), and the Elite Fourum Sun and Moon / Sword and Shield study (this set is not in that study, or its section has no numbers). No rate was invented.";

const setsPub = await J("research/assets/public/sets.json");
const pull = await J("data/pull-rates.json");
const byCode = new Map();
for (const s of setsPub.sets || []) {
  const code = logoId(s.logo);
  if (code) byCode.set(code, s);
}
const quoted = new Map([...QUOTED, ...QUOTED_PN].map((s) => [s.setId, s]));
const coveredSlug = new Map();
for (const r of pull.rows) {
  if (!coveredSlug.has(r.setSlug)) coveredSlug.set(r.setSlug, []);
  coveredSlug.get(r.setSlug).push(r);
}

const dir = join(ROOT, "data/pull-rates/sets");
await mkdir(dir, { recursive: true });
const newRows = [];
const sourcedIds = new Set();
let files = 0;

for (const entry of pull.noSource || []) {
  const setId = entry.setId;
  const cat = byCode.get(setId) || null;
  const setSlug = cat?.slug || "";
  const setName = cat?.name || setId;
  const base = {
    setId,
    setName,
    setSlug: setSlug || null,
    era: cat?.era || null,
    release: cat?.release || null,
    updated: UPDATED,
  };
  const q = quoted.get(setId);
  let doc;
  if (q) {
    if (!setSlug) throw new Error(`no catalogue slug for sourced set ${setId}`);
    const slots = q.slots.map((s) => rowFrom(q, s, setSlug, setName));
    if (setId === "swsh45") {
      for (const s of SHINING_EXTRA) {
        slots.push(rowFrom({
          setId, date: "2021-03-10", samplePacks: 2187, author: "Elite Fourum", url: E4, method: E4_METHOD,
        }, s, setSlug, setName));
      }
    }
    for (const row of slots) {
      if (!(row.pct > 0)) throw new Error(`bad pct ${setId} ${row.articleRarity}`);
      newRows.push(row);
    }
    sourcedIds.add(setId);
    doc = {
      ...base,
      status: "sourced",
      note: q.caveat || "Rates below are the parent figures the source states. Child breakdowns of the same hits are not listed.",
      sources: [{
        url: q.url,
        date: q.date,
        dataAsOf: q.dataAsOf || null,
        author: q.author,
        samplePacks: q.samplePacks,
        rateStated: true,
        method: q.method,
      }, ...(setId === "swsh45" ? [{
        url: E4,
        date: "2021-03-10",
        author: "Elite Fourum",
        samplePacks: 2187,
        rateStated: true,
        method: "Cross-check on the Pullnomics slots, plus Amazing Rare and Shiny slots that the Pullnomics table does not list.",
      }] : [])],
      slots,
    };
  } else if (setSlug && coveredSlug.has(setSlug)) {
    const rows = coveredSlug.get(setSlug);
    sourcedIds.add(setId);
    doc = {
      ...base,
      status: "already-recorded",
      note: `Rates for this set id are already in data/pull-rates.json under setSlug ${setSlug}. This file cites those same sources. No second row was added.`,
      sources: [...new Map(rows.map((r) => [r.sourceUrl, { url: encodeUrl(r.sourceUrl), date: r.published || r.dataAsOf, author: r.author || null, rateStated: true }])).values()],
      slots: rows.map((r) => ({
        articleRarity: r.articleRarity,
        rarity: r.rarity,
        tag: r.tag || null,
        pct: r.pct,
        ci95: r.ci95 ?? null,
        samplePacks: r.samplePacks ?? null,
        sourceUrl: encodeUrl(r.sourceUrl),
        published: r.published || r.dataAsOf,
        author: r.author || null,
      })),
    };
  } else {
    doc = {
      ...base,
      status: "no-citable-source",
      note: setId === "swsh5"
        ? "Battle Styles is not in the Pullnomics table and has no table in the Elite Fourum study. No rate was invented."
        : NO_RATE_NOTE,
      sourcesChecked: [
        { url: POKE, date: "2026-10-10", rateStated: false },
        { url: PN, date: "2026-09-15", rateStated: false },
        { url: E4, date: "2026-10-13", rateStated: false },
      ],
      slots: [],
    };
  }
  const text = JSON.stringify(doc, null, 2) + "\n";
  if (text.includes("\u2014")) throw new Error(`em dash in ${setId}`);
  await writeFile(join(dir, `${setId}.json`), text);
  files += 1;
}

const seen = new Set(pull.rows.map((r) => `${r.setSlug}|${r.articleRarity}|${r.tag || ""}`));
for (const row of newRows) {
  const key = `${row.setSlug}|${row.articleRarity}|${row.tag || ""}`;
  if (seen.has(key)) throw new Error(`duplicate row ${key}`);
  seen.add(key);
  pull.rows.push(row);
}
pull.noSource = (pull.noSource || []).filter((x) => !sourcedIds.has(x.setId));
pull.noSourceCount = pull.noSource.length;
pull.filled = pull.rows.length;
pull.updated = UPDATED;
pull.sourcesChecked = [
  ...(pull.sourcesChecked || []),
  { url: E4, date: "2026-10-13", rateStated: true, note: "Parent rows for Sun and Moon and early Sword and Shield. Vivid Voltage has no numbers in that post." },
  { url: PN, date: "2026-09-15", dataAsOf: "2026-09-20", rateStated: true, note: "Midpoints used for Vivid Voltage, Chilling Reign, Fusion Strike, Brilliant Stars, and Shining Fates." },
];
const pullText = JSON.stringify(pull, null, 2) + "\n";
if (JSON.stringify(newRows).includes("\u2014")) throw new Error("em dash in new pull-rate rows");
await writeFile(join(ROOT, "data/pull-rates.json"), pullText);

// Second source notes. Does not replace a primary row.
const SECOND = {
  "sv10-destined-rivals": { DR: null, IR: 12, UR: null, SIR: 94, HR: 149 },
  "sv09-journey-together": { DR: 5, IR: 11, UR: 15, SIR: 93, HR: 131 },
  "sv-prismatic-evolutions": { DR: 6, IR: null, UR: 19.5, SIR: 49, HR: 166 },
  "sv08-surging-sparks": { DR: null, IR: 13, UR: 15, SIR: 85, HR: 189 },
  "sv07-stellar-crown": { DR: 6, IR: 13, UR: 15, SIR: 90, HR: 131 },
  "sv-shrouded-fable": { DR: null, IR: 12, UR: 30, SIR: 57, HR: 118 },
  "sv06-twilight-masquerade": { DR: 6, IR: 13, UR: 15, SIR: 86, HR: 146 },
  "sv05-temporal-forces": { DR: 6, IR: 12.5, UR: 14, SIR: 74.5, HR: 139 },
  "sv-paldean-fates": { DR: null, IR: 13, UR: 14.5, SIR: 62.5, HR: 97.5 },
  "sv04-paradox-rift": { DR: 6.5, IR: 12.5, UR: 14, SIR: 49.5, HR: 81.5 },
  "sv-scarlet-and-violet-151": { DR: 8, IR: 12, UR: 16, SIR: 32, HR: 51 },
  "sv03-obsidian-flames": { DR: 7, IR: 13, UR: 15.5, SIR: 29.5, HR: 51 },
  "sv02-paldea-evolved": { DR: 7, IR: 12.5, UR: 14, SIR: 33.5, HR: 49.5 },
  "sv01-scarlet-and-violet-base-set": { DR: 7, IR: 13, UR: 15, SIR: 32, HR: 53 },
  "me05-pitch-black": { DR: 5, IR: 10, UR: 12, MAR: null, SIR: 102.5, MHR: 1315 },
  "me04-chaos-rising": { DR: 4.5, IR: 9.5, UR: 16.5, MAR: null, SIR: 82.5, MHR: 975 },
  "me03-perfect-order": { DR: null, IR: 9, UR: 11, MAR: 40, SIR: 80, MHR: 1400 },
  "me-ascended-heroes": { DR: null, IR: 8.5, UR: 11, MAR: 35, SIR: 88.5, MHR: 540 },
  "me02-phantasmal-flames": { DR: null, IR: 9, UR: 12, MAR: 40, SIR: 80, MHR: 1260 },
  "me01-mega-evolution": { DR: 5, IR: 9, UR: 12.5, MAR: null, SIR: 101, MHR: 1260 },
  "me-30th-celebration": { DR: 4.5, IR: 5.5, UR: null, MAR: null, SIR: 19.5, MHR: null },
  "swsh-crown-zenith": { V: 8, VMAX: null, FA: null, RB: null, G: 100 },
  "swsh12-silver-tempest": { V: 8.5, VMAX: null, FA: 48, RB: 79.5, G: 106 },
  "swsh11-lost-origin": { V: 8.5, VMAX: null, FA: 51, RB: 71.5, G: 114 },
  "swsh10-astral-radiance": { V: 7.5, VMAX: null, FA: 50.5, RB: 83, G: 130 },
  "swsh07-evolving-skies": { V: 9, VMAX: 16.5, FA: 36.5, RB: 113, G: 105.5 },
};
function colOf(row) {
  const tag = row.tag || "";
  if (["Alternate Art", "Trainer Gallery", "Galarian Gallery", "Radiant"].includes(tag)) return null;
  const a = String(row.articleRarity || "");
  if (/special illustration/i.test(a)) return "SIR";
  if (/mega hyper/i.test(a)) return "MHR";
  if (/mega attack/i.test(a)) return "MAR";
  if (/illustration rare/i.test(a)) return "IR";
  if (/hyper rare/i.test(a)) return "HR";
  if (/double rare/i.test(a)) return "DR";
  if (/^ultra rare$/i.test(a) && !tag) return "UR";
  return null;
}
const diffs = [];
const slugs = [...new Set(pull.rows.map((r) => r.setSlug))].sort();
for (const setSlug of slugs) {
  const table = SECOND[setSlug];
  const rows = pull.rows.filter((r) => r.setSlug === setSlug);
  if (!table) {
    diffs.push({ setSlug, kind: "no-second-table", note: "This set is not in the Pullnomics table that was checked. No second-source rate was copied." });
    continue;
  }
  const used = new Set();
  for (const row of rows) {
    if ((row.sourceUrl || "").includes("pullnomics.com")) {
      diffs.push({ setSlug, articleRarity: row.articleRarity, kind: "same-guide", primaryPct: row.pct, note: "The primary row is already the Pullnomics guide, so that guide is not a second source for it." });
      continue;
    }
    const col = colOf(row);
    if (!col || !(col in table)) continue;
    used.add(col);
    const oneIn = table[col];
    if (oneIn == null) {
      diffs.push({ setSlug, articleRarity: row.articleRarity, column: col, kind: "not-listed", primaryPct: row.pct, primaryUrl: encodeUrl(row.sourceUrl), note: "Pullnomics does not list this slot. The primary row was kept." });
      continue;
    }
    const secondPct = pctOf(oneIn);
    const delta = Math.round((row.pct - secondPct) * 10000) / 10000;
    diffs.push({
      setSlug, articleRarity: row.articleRarity, column: col, kind: "compared",
      primaryPct: row.pct, primaryUrl: encodeUrl(row.sourceUrl), primaryPublished: row.published || null,
      secondOneIn: oneIn, secondPct, pctDiff: delta,
      note: "Note only. The primary row was not replaced.",
    });
  }
  for (const [col, oneIn] of Object.entries(table)) {
    if (used.has(col) || oneIn == null) continue;
    const have = rows.some((r) => colOf(r) === col);
    if (have) continue;
    diffs.push({
      setSlug, column: col, kind: "missing-row", secondOneIn: oneIn, secondPct: pctOf(oneIn),
      note: "Pullnomics states this slot. Our file has no matching primary row. It was not added, so existing Rip value rows do not move.",
    });
  }
}
const second = {
  asOf: UPDATED,
  primary: "data/pull-rates.json",
  secondSource: { url: PN, published: "2026-09-15", dataAsOf: "2026-09-20" },
  rule: "Differences are notes only. Where TCGplayer is the primary row, it stays the row. Pullnomics is not swapped in.",
  skippedSecondSource: "The TCGplayer 30th Celebration article page was fetched and returned an empty shell with no rate table. The content URL returned 404. No 30th Celebration figures were copied from that page.",
  diffs,
};
const secondText = JSON.stringify(second, null, 2) + "\n";
if (secondText.includes("\u2014")) throw new Error("em dash in second source");
await mkdir(join(ROOT, "data/derived"), { recursive: true });
await writeFile(join(ROOT, "data/derived/pull-rate-second-source.json"), secondText);

console.log(JSON.stringify({
  files,
  newRows: newRows.length,
  noSource: pull.noSourceCount,
  sourcedIds: [...sourcedIds].sort(),
  diffs: diffs.length,
}, null, 2));
