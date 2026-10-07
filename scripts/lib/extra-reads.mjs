// Lag, supply, and group reads. Every price is a point already on a series.
// A missing pack or box price drops the set. Two prices that disagree are
// recorded and not averaged.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BANNED_LINE = /\b(stored|last print|printed|bigger last step|buy|sell|hold|crypto)\b/i;

export function monthDay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!match) return "";
  return `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}`;
}

export function priceWords(n) {
  const value = Number(n);
  if (!(value > 0)) return "";
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function cents(n) {
  return Math.round(Number(n) * 100);
}

export function shiftDay(iso, days) {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + days * 86400000).toISOString().slice(0, 10);
}

export function pointOnOrBefore(series, day) {
  let hit = null;
  for (const pt of series || []) {
    if (!pt || pt[0] > day) break;
    if (pt[0] <= day && Number(pt[1]) > 0) hit = pt;
  }
  return hit;
}

export function alignedEnds(series, endDay, days) {
  const end = pointOnOrBefore(series, endDay);
  if (!end) return null;
  if (end[0] < shiftDay(endDay, -3)) return null;
  const target = shiftDay(end[0], -days);
  const start = pointOnOrBefore(series, target);
  if (!start || start[0] === end[0]) return null;
  const span = Math.round((Date.parse(`${end[0]}T00:00:00Z`) - Date.parse(`${start[0]}T00:00:00Z`)) / 86400000);
  if (span < days - 2 || span > days + 5) return null;
  return { from: Number(start[1]), fromDate: start[0], to: Number(end[1]), toDate: end[0] };
}

export function directionOf(ends) {
  if (!ends) return "";
  const gap = cents(ends.to) - cents(ends.from);
  if (gap > 0) return "up";
  if (gap < 0) return "down";
  return "flat";
}

export function onePct(from, to) {
  if (!(from > 0) || !(to > 0) || cents(from) === cents(to)) return "";
  return (Math.round(Math.abs((to - from) / from) * 1000) / 10).toFixed(1);
}

function figure(row) {
  return {
    id: row.id,
    name: row.name,
    from: row.from,
    fromDate: row.fromDate,
    to: row.to,
    toDate: row.toDate,
  };
}

function supplyWord(text) {
  const raw = String(text || "");
  const shrinking = /\bshrinking\b/i.test(raw);
  const rising = /\brising\b/i.test(raw);
  if (shrinking === rising) return "";
  return shrinking ? "shrinking" : "rising";
}

function supplySentence(word, priceDir) {
  if (!word) return "";
  const same = (word === "shrinking" && priceDir === "up") || (word === "rising" && priceDir === "down");
  if (same) return ` A source says supply is ${word}.`;
  return ` A source says supply is ${word}, and the pack price moved the other way.`;
}

function lagSentence(setName, pack, box, singles, supply) {
  const dir = directionOf(pack);
  const verb = dir === "up" ? "rose" : "fell";
  const word = dir === "up" ? "up" : "down";
  const pct = onePct(pack.from, pack.to);
  if (!pct) return "";
  const packBit = `${pack.name} latest price ${verb} from ${priceWords(pack.from)} on ${monthDay(pack.fromDate)} to ${priceWords(pack.to)} on ${monthDay(pack.toDate)}, ${word} ${pct}%.`;
  const boxBit = ` The booster box ${box.name} is ${priceWords(box.to)} on ${monthDay(box.toDate)}, the same price as ${priceWords(box.from)} on ${monthDay(box.fromDate)}.`;
  const singleBit = ` Singles in the set with a price on both days: ${singles.up} up, ${singles.down} down, ${singles.flat} unchanged.`;
  const line = `${setName}: ${packBit}${boxBit}${singleBit}${supplySentence(supply, dir)}`;
  if (BANNED_LINE.test(line)) return "";
  return line.replace(/\s+/g, " ").trim();
}

export function isVintageSet(name) {
  return /^(base set|jungle|fossil|team rocket|gym heroes|gym challenge|neo )/i.test(String(name || ""));
}

export function lagFromSets(sets, { asOf, days = 30, supplyBySet = new Map() } = {}) {
  const reads = [];
  const missingPrice = [];
  const omitted = [];
  for (const set of sets || []) {
    const packs = set.packs || [];
    const boxes = set.boxes || [];
    if (!packs.length && !boxes.length) continue;
    const pricedPacks = [];
    const pricedBoxes = [];
    for (const row of packs) {
      const ends = alignedEnds(row.series, asOf, days);
      if (ends) pricedPacks.push({ ...row, ...ends });
    }
    for (const row of boxes) {
      const ends = alignedEnds(row.series, asOf, days);
      if (ends) pricedBoxes.push({ ...row, ...ends });
    }
    if (!pricedPacks.length || !pricedBoxes.length) {
      missingPrice.push({
        set: set.name,
        vintage: isVintageSet(set.name),
        packProducts: packs.length,
        boxProducts: boxes.length,
        packsWithPrice: pricedPacks.length,
        boxesWithPrice: pricedBoxes.length,
      });
      continue;
    }
    if (pricedPacks.length !== 1 || pricedBoxes.length !== 1) {
      omitted.push({
        set: set.name,
        reason: "more than one pack or box price",
        packs: pricedPacks.map(figure),
        boxes: pricedBoxes.map(figure),
      });
      continue;
    }
    const pack = pricedPacks[0];
    const box = pricedBoxes[0];
    const packDir = directionOf(pack);
    const boxDir = directionOf(box);
    if (packDir === "flat" || boxDir !== "flat") {
      omitted.push({
        set: set.name,
        reason: boxDir !== "flat" ? "booster box moved" : "loose pack did not move",
        packs: [figure(pack)],
        boxes: [figure(box)],
      });
      continue;
    }
    const singles = { up: 0, down: 0, flat: 0, withBoth: 0 };
    for (const row of set.singles || []) {
      const ends = alignedEnds(row.series, pack.toDate, days);
      if (!ends || ends.toDate !== pack.toDate) continue;
      const gap = Math.abs(Date.parse(`${ends.fromDate}T00:00:00Z`) - Date.parse(`${pack.fromDate}T00:00:00Z`));
      if (gap > 5 * 86400000) continue;
      singles.withBoth += 1;
      singles[directionOf(ends)] += 1;
    }
    if (singles[packDir] < 1 || (packDir === "up" ? singles.down : singles.up) > 0) {
      omitted.push({
        set: set.name,
        reason: "singles did not move with the pack",
        singles,
        packs: [figure(pack)],
        boxes: [figure(box)],
      });
      continue;
    }
    const supply = supplyWord(supplyBySet.get(set.name) || "");
    const path = lagSentence(set.name, pack, box, singles, supply);
    if (!path) continue;
    const slug = String(set.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    reads.push({
      id: `lag-${slug}`,
      sku: pack.id,
      readKind: "lag",
      kind: "lag",
      name: set.name,
      set: set.name,
      path,
      headline: path,
      why: "Loose pack and booster box prices are the two series. The box price did not change. Singles are counted only when both days have a price.",
      vintage: isVintageSet(set.name),
      pack: figure(pack),
      box: figure(box),
      singles,
      supply: supply || null,
    });
  }
  return { reads, missingPrice, omitted };
}

export function eraOfSet(setName) {
  const name = String(setName || "");
  if (name.startsWith("SWSH")) return "swsh";
  if (name.startsWith("SV") || name.startsWith("ME")) return "modern";
  return "";
}

export function kindOfCard(item) {
  const name = String(item?.name || "");
  if (/\sVMAX$/.test(name)) return "vmax";
  if (/\sVSTAR$/.test(name)) return "vstar";
  if (/\sV$/.test(name)) return "v";
  if (/illustration rare/i.test(String(item?.rarity || ""))) return "chase";
  return "";
}

function extremeMarks(rows) {
  const highs = [];
  const lows = [];
  for (const row of rows) {
    const series = (row.series || []).filter((pt) => Number(pt[1]) > 0);
    if (series.length < 2) continue;
    const last = series[series.length - 1];
    let max = series[0];
    let min = series[0];
    for (const pt of series) {
      if (pt[1] > max[1]) max = pt;
      if (pt[1] < min[1]) min = pt;
    }
    if (cents(last[1]) === cents(max[1]) && cents(last[1]) > cents(min[1])) {
      highs.push({ id: row.id, name: row.name, price: last[1], date: last[0], mark: "▲ high" });
    }
    if (cents(last[1]) === cents(min[1]) && cents(last[1]) < cents(max[1])) {
      lows.push({ id: row.id, name: row.name, price: last[1], date: last[0], mark: "▼ low" });
    }
  }
  return { highs, lows };
}

function sideCounts(members, asOf, days) {
  const counts = { up: 0, down: 0, flat: 0, rows: [] };
  for (const row of members) {
    const ends = alignedEnds(row.series, asOf, days);
    if (!ends) continue;
    const dir = directionOf(ends);
    counts[dir] += 1;
    counts.rows.push({ ...row, ...ends, dir });
  }
  return counts;
}

function groupSide(label, counts) {
  return `${label}: ${counts.up} up, ${counts.down} down, ${counts.flat} unchanged`;
}

export function groupReadsFromMembers(members, { asOf, days = 30 } = {}) {
  const buckets = new Map();
  for (const row of members || []) {
    const era = eraOfSet(row.set);
    const kind = kindOfCard(row);
    if (!era || !kind || !row.id) continue;
    const key = `${era}:${kind}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  const swshV = sideCounts([...(buckets.get("swsh:v") || []), ...(buckets.get("swsh:vmax") || [])], asOf, days);
  const modern = sideCounts(buckets.get("modern:chase") || [], asOf, days);
  const swshUp = swshV.up > swshV.down && swshV.up >= 5;
  const swshDown = swshV.down > swshV.up && swshV.down >= 5;
  const modernUp = modern.up > modern.down && modern.up >= 5;
  const modernDown = modern.down > modern.up && modern.down >= 5;
  const reads = [];
  const pairs = [];
  if (swshUp && modernDown) pairs.push({ climbing: "swsh", falling: "modern" });
  if (swshDown && modernUp) pairs.push({ climbing: "modern", falling: "swsh" });
  for (const pair of pairs) {
    const climbing = pair.climbing === "swsh" ? swshV : modern;
    const falling = pair.falling === "swsh" ? swshV : modern;
    const climbLabel = pair.climbing === "swsh" ? "Sword & Shield V and VMAX cards" : "Modern chase cards";
    const fallLabel = pair.falling === "swsh" ? "Sword & Shield V and VMAX cards" : "Modern chase cards";
    const marks = extremeMarks([...climbing.rows, ...falling.rows]);
    const still = climbing.rows.filter((row) => row.dir === "flat");
    const stillIds = still.map((row) => ({ id: row.id, name: row.name, kind: kindOfCard(row), era: eraOfSet(row.set), price: row.to, date: row.toDate }));
    const namedStill = stillIds.slice(0, 8);
    const stillBit = namedStill.length
      ? ` A take, not a rule: ${namedStill.map((row) => `${row.name} (${row.id})`).join(", ")} have not moved${stillIds.length > namedStill.length ? `, and ${stillIds.length - namedStill.length} more sit in the full file` : ""}.`
      : "";
    const markBit = [
      ...marks.highs.slice(0, 5).map((row) => `${row.name} (${row.id}) ${row.mark} ${priceWords(row.price)} on ${monthDay(row.date)}`),
      ...marks.lows.slice(0, 5).map((row) => `${row.name} (${row.id}) ${row.mark} ${priceWords(row.price)} on ${monthDay(row.date)}`),
    ];
    const fromDates = [...climbing.rows, ...falling.rows].map((row) => row.fromDate).sort();
    const toDates = [...climbing.rows, ...falling.rows].map((row) => row.toDate).sort();
    const path = `${climbLabel} are up while ${fallLabel} are down, from ${monthDay(fromDates[0])} to ${monthDay(toDates[toDates.length - 1])}. ${groupSide(climbLabel, climbing)}. ${groupSide(fallLabel, falling)}.${markBit.length ? " " + markBit.join(". ") + "." : ""}${stillBit}`;
    if (BANNED_LINE.test(path)) continue;
    reads.push({
      id: `group-${pair.climbing}-up-${pair.falling}-down`,
      sku: `group-${pair.climbing}-up-${pair.falling}-down`,
      readKind: "group",
      kind: "group",
      name: `${climbLabel} up, ${fallLabel} down`,
      path: path.replace(/\s+/g, " ").trim(),
      headline: path.replace(/\s+/g, " ").trim(),
      why: "Both sides are counts of product ids with a price on both window days. A high or low is only against that id's own series. Similar cards are the same era and the same kind.",
      climbing: pair.climbing,
      falling: pair.falling,
      counts: {
        swshV: { up: swshV.up, down: swshV.down, flat: swshV.flat },
        modernChase: { up: modern.up, down: modern.down, flat: modern.flat },
      },
      highs: marks.highs,
      lows: marks.lows,
      similarStill: stillIds,
    });
  }
  return { reads };
}

export function seededShuffle(ids, seedText) {
  const arr = [...ids];
  let seed = 2166136261;
  const text = String(seedText || "");
  for (let i = 0; i < text.length; i += 1) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    seed = Math.imul(seed ^ (seed >>> 16), 2246822519) >>> 0;
    const j = seed % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function buildBrowse({ asOf, cardIds, rankedIds, news, waves, flagged, dives, volume }) {
  const shuffled = seededShuffle(cardIds, asOf);
  const out = {
    asOf,
    rule: "A ranked filter stays in order. Every other loop is shuffled, unless a filter is on.",
    unfiltered: shuffled,
    ranked: rankedIds,
    filters: {
      prices: { order: "ranked", field: "changePct" },
      sealed: { order: "ranked", field: "kind", value: "sealed" },
      set: { order: "ranked", field: "set" },
      news: { order: "ranked", windowDays: 14, furtherBackWhenFiltered: true, file: "research/digests/news.json" },
      pokemon: { order: "shuffled unless the filter is on", readKind: "pokemon", premiumCanHide: true },
      wave: { order: "ranked", items: waves || [] },
      flagged: { order: "ranked", readKind: "outlier", items: flagged || [], empty: "No flagged prices." },
      dive: { order: "ranked", readKind: "dive", items: dives || [], empty: "No deep dives." },
    },
    newsCount: Array.isArray(news) ? news.length : 0,
  };
  // The Volume filter exists only when a real TCGplayer sold count is on file.
  if (Array.isArray(volume) && volume.length) {
    out.filters.volume = {
      order: "ranked",
      readKind: "volume",
      items: volume,
      source: "TCGplayer sales via PokemonPriceTracker",
      empty: "No sold counts on file.",
    };
  }
  return out;
}

export function seriesRows(seriesMap, pid) {
  const days = seriesMap.get(Number(pid));
  if (!days) return [];
  return [...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

export function assembleCatalog(items, seriesMap, { asOf, supplyBySet = new Map() } = {}) {
  const bySet = new Map();
  const members = [];
  for (const item of items || []) {
    const row = {
      id: item.id,
      name: item.name,
      set: item.set || "",
      rarity: item.rarity || "",
      series: seriesRows(seriesMap, item.tcgplayerProductId),
    };
    if (!bySet.has(row.set)) bySet.set(row.set, { name: row.set, packs: [], boxes: [], singles: [] });
    const bucket = bySet.get(row.set);
    if (item.kind === "sealed" && item.subtype === "booster-pack") bucket.packs.push(row);
    else if (item.kind === "sealed" && item.subtype === "booster-box") bucket.boxes.push(row);
    else if (item.kind === "single") {
      bucket.singles.push(row);
      members.push(row);
    }
  }
  const lag = lagFromSets([...bySet.values()], { asOf, supplyBySet });
  const group = groupReadsFromMembers(members, { asOf });
  return {
    asOf,
    volume: [],
    volumeNote: "No sold count is on file, so no volume read ships.",
    lag,
    group,
    reads: [...lag.reads, ...group.reads],
  };
}

export function supplyNotes(rows) {
  const notes = [];
  for (const row of rows || []) {
    const text = [row.read, row.note, row.statement, row.method].filter(Boolean).join(" ");
    if (/\bshrinking\b/i.test(text) || /\brising\b/i.test(text)) notes.push({ id: row.id || "", set: row.set || "", text });
  }
  return notes;
}
