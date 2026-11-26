// Market breadth and the mood gap. Prices and listings counted only.
// Thresholds come from the caller. If cfg is missing, D is null and no public read is built.
// Talk older than the freshness window is held. A raw listing-count file is never a supply score.

import { isClean } from "./copy-rules.mjs";
import { beforeBoard } from "./reads-guard.mjs";
import { PLAN_POINTS, cleanPoints } from "./custom-reads.mjs";

export const LETTER_ORDER = PLAN_POINTS;
export const PERMALINK = "https://catchemtcg.com/reads#market-breadth";
const Z90 = 1.6448536269514722;

const EXTRA = [
  { re: /\bbuy now\b/i, why: "buy now" },
  { re: /\bload up\b/i, why: "load up" },
  { re: /\b(?:can't|cannot) lose\b/i, why: "can't lose" },
  { re: /\bto the moon\b/i, why: "to the moon" },
  { re: /\bsold\b/i, why: "sold" },
  { re: /\bextreme fear\b/i, why: "Extreme fear" },
  { re: /\bgreed\b/i, why: "Greed" },
  { re: /@[A-Za-z0-9_]{2,}/, why: "creator handle" },
  { re: /[\u2013\u2014]/, why: "dash" },
];

const FEAR = new Set(["fear", "fearful", "crash", "dump", "bear", "worried", "panic", "bubble", "rug", "scared"]);
const CALM = new Set(["bull", "pump", "hype", "excited", "rip", "strong", "ath"]);

const dayOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));

export function addDays(iso, n) {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + n * 86400000).toISOString().slice(0, 10);
}

export function clampScore(n) {
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function copyProblems(text) {
  const line = String(text || "");
  const out = [];
  if (!line.trim()) return out;
  if (!isClean(line)) out.push("copy");
  for (const rule of EXTRA) if (rule.re.test(line)) out.push(rule.why);
  return out;
}

export function copyOk(text) {
  return copyProblems(text).length === 0;
}

function wilson90(hits, n) {
  if (!(n > 0)) return { lo: 0, hi: 0 };
  const p = Math.min(1, Math.max(0, hits / n));
  const z2 = Z90 * Z90;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (Z90 * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return { lo: Math.max(0, center - margin), hi: Math.min(1, center + margin) };
}

function blankCounts() {
  return { up: 0, down: 0, flat: 0 };
}

function packCounts(bucket) {
  const n = bucket.up + bucket.down + bucket.flat;
  const share = (k) => (n ? Math.round((bucket[k] / n) * 10000) / 10000 : null);
  return { up: bucket.up, down: bucket.down, flat: bucket.flat, n, upShare: share("up"), downShare: share("down"), flatShare: share("flat") };
}

export function lastOnOrBefore(dates, target) {
  let hit = "";
  for (const day of dates || []) {
    if (!dayOk(day) || day > target) continue;
    if (!hit || day > hit) hit = day;
  }
  return hit;
}

export function productBreadth(startRows, endRows) {
  const end = new Map((endRows || []).map((row) => [String(row.id), row]));
  const all = blankCounts();
  const single = blankCounts();
  const sealed = blankCounts();
  for (const row of startRows || []) {
    const next = end.get(String(row?.id));
    if (!next) continue;
    const a = Number(row.market);
    const b = Number(next.market);
    if (!(a > 0) || !(b > 0)) continue;
    const kind = row.kind === "sealed" || next.kind === "sealed" ? "sealed" : "single";
    const dir = b > a ? "up" : b < a ? "down" : "flat";
    all[dir] += 1;
    (kind === "sealed" ? sealed : single)[dir] += 1;
  }
  return { all: packCounts(all), single: packCounts(single), sealed: packCounts(sealed) };
}

function windowBreadth(days, boardDay, span) {
  const dates = Object.keys(days || {}).filter(dayOk).sort();
  const askedStart = addDays(boardDay, -span);
  if (!dates.includes(boardDay)) {
    return { held: true, reason: "end date is not the board day", askedStart, askedEnd: boardDay, span };
  }
  const usedStart = lastOnOrBefore(dates, askedStart);
  if (!usedStart || usedStart === boardDay) {
    return { held: true, reason: "no start day on or before the target", askedStart, end: boardDay, span };
  }
  const counts = productBreadth(days[usedStart], days[boardDay]);
  return {
    held: false,
    span,
    askedStart,
    start: usedStart,
    startGap: usedStart !== askedStart,
    end: boardDay,
    ...counts.all,
    single: counts.single,
    sealed: counts.sealed,
  };
}

function seriesRows(series) {
  return (series || []).filter((row) => row && dayOk(row.d) && Number(row.v) > 0).slice().sort((a, b) => (a.d < b.d ? -1 : 1));
}

export function indexWindow(series, boardDay, span) {
  const rows = seriesRows(series);
  const askedStart = addDays(boardDay, -span);
  const end = rows.find((row) => row.d === boardDay);
  if (!end) return { held: true, reason: "end date is not the board day", askedStart, askedEnd: boardDay, span };
  let start = null;
  for (const row of rows) if (row.d <= askedStart) start = row;
  if (!start || start.d === end.d) return { held: true, reason: "no start day on or before the target", askedStart, end: boardDay, span };
  const pct = Math.round(((end.v - start.v) / start.v) * 1000) / 10;
  return {
    held: false,
    span,
    askedStart,
    start: start.d,
    startGap: start.d !== askedStart,
    end: boardDay,
    from: end.v == null ? start.v : start.v,
    to: end.v,
    pct,
    nStart: start.n ?? null,
    nEnd: end.n ?? null,
  };
}

function weaknessOf(breadth) {
  if (!breadth || breadth.held || !(breadth.n > 0)) return null;
  return clampScore((100 * (breadth.down + 0.5 * breadth.flat)) / breadth.n);
}

function ageDays(asOf, boardDay) {
  if (!dayOk(asOf) || !dayOk(boardDay)) return null;
  return Math.round((Date.parse(`${boardDay}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86400000);
}

export function talkScore(talk, boardDay, freshnessDays) {
  const sources = Array.isArray(talk) ? talk : (talk ? [talk] : []);
  const fresh = [];
  for (const src of sources) {
    const age = ageDays(String(src?.asOf || "").slice(0, 10), boardDay);
    if (age == null || age < 0 || !(freshnessDays >= 0) || age > freshnessDays) continue;
    fresh.push(src);
  }
  if (!fresh.length) return { T: null, held: true, used: [] };
  let fear = 0;
  let calm = 0;
  for (const src of fresh) {
    const weight = Number(src.weight) > 0 ? Number(src.weight) : 1;
    const tokens = (src.texts || []).join(" ").toLowerCase().split(/[^a-z0-9']+/);
    for (const tok of tokens) {
      if (FEAR.has(tok)) fear += weight;
      if (CALM.has(tok)) calm += weight;
    }
  }
  const T = fear + calm === 0 ? 50 : clampScore(50 + (50 * (fear - calm)) / (fear + calm));
  return { T, held: false, used: fresh.map((src) => String(src.source || "talk")), fear, calm };
}

export function gapOf(T, D) {
  if (T == null || D == null) return null;
  return Math.max(-100, Math.min(100, Math.round(T - D)));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

export function scoreBacktest(rows, minN) {
  const ready = (rows || []).filter((row) => row && dayOk(row.date) && typeof row.call === "boolean").slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const need = Number(minN);
  if (!(need > 0) || ready.length < need * 2) {
    return { passed: false, reason: "not passed yet", n: ready.length, horizons: {} };
  }
  const mid = Math.floor(ready.length / 2);
  const parts = { earlier: ready.slice(0, mid), later: ready.slice(mid) };
  const horizons = {};
  let passed = true;
  for (const span of [7, 30]) {
    const hitKey = span === 7 ? "hit7" : "hit30";
    const sides = {};
    for (const [name, part] of Object.entries(parts)) {
      const calls = part.filter((row) => row.call === true && typeof row[hitKey] === "boolean");
      const baseRows = part.filter((row) => typeof row[hitKey] === "boolean");
      const n = calls.length;
      const hits = calls.filter((row) => row[hitKey]).length;
      const baseN = baseRows.length;
      const baseHits = baseRows.filter((row) => row[hitKey]).length;
      const base = baseN ? baseHits / baseN : null;
      const ci = n ? wilson90(hits, n) : { lo: 0, hi: 0 };
      const ok = n >= need && baseN >= need && base != null && ci.lo > base;
      if (!ok) passed = false;
      sides[name] = { n, hits, rateLo: round1(ci.lo * 100), base: base == null ? null : round1(base * 100), passed: ok };
    }
    horizons[`h${span}`] = sides;
  }
  return { passed, reason: passed ? "passed" : "not passed yet", n: ready.length, horizons };
}

export function listingCoverageMove(prevRows, nextRows) {
  const prev = Array.isArray(prevRows) ? prevRows : [];
  const next = Array.isArray(nextRows) ? nextRows : [];
  const prevIds = new Set(prev.map((row) => String(row?.id)));
  const nextIds = new Set(next.map((row) => String(row?.id)));
  const sum = (rows) => rows.reduce((total, row) => total + (Number(row?.listingsCounted) || 0), 0);
  const fewer = nextIds.size < prevIds.size;
  return {
    scored: false,
    direction: null,
    reason: fewer ? "fewer ids fetched" : "listing count files are not a breadth score",
    prevIds: prevIds.size,
    nextIds: nextIds.size,
    prevTotal: sum(prev),
    nextTotal: sum(next),
  };
}

function publicName(text) {
  return String(text || "").replace(/\s*&\s*/g, " and ").replace(/\s+/g, " ").trim();
}

function keepFact(text, source, date) {
  const row = { text: String(text || "").trim(), source: String(source || "").trim(), date: String(date || "").slice(0, 10) };
  if (!row.text || !row.source || !dayOk(row.date)) return null;
  if (!copyOk(row.text) || !copyOk(row.source)) return null;
  return row;
}

function countLine(label, row) {
  if (!row || row.held || !(row.n > 0)) return "";
  const gap = row.startGap ? ` The start day on file is ${row.start}, before the asked day ${row.askedStart}.` : "";
  return `${label}: ${row.up} up, ${row.down} down, ${row.flat} flat, of ${row.n} products on both days, ${row.start} to ${row.end}.${gap}`;
}

function indexLine(name, row) {
  if (!row || row.held || row.pct == null) return "";
  const dir = row.pct > 0 ? "up" : row.pct < 0 ? "down" : "flat";
  const gap = row.startGap ? ` Start day on file is ${row.start}.` : "";
  return `${name} index ${dir} ${Math.abs(row.pct)}% from ${row.from} on ${row.start} to ${row.to} on ${row.end}.${gap}`;
}

function eraMove(entries, boardDay, span) {
  const rows = (entries || []).filter((row) => row && dayOk(row.date) && row.era);
  const dates = [...new Set(rows.map((row) => row.date))].sort();
  if (!dates.includes(boardDay)) return [];
  const asked = addDays(boardDay, -span);
  const start = lastOnOrBefore(dates, asked);
  if (!start) return [];
  const byEra = new Map();
  for (const row of rows) {
    if (row.date !== start && row.date !== boardDay) continue;
    const bag = byEra.get(row.era) || {};
    bag[row.date === boardDay ? "end" : "start"] = row;
    byEra.set(row.era, bag);
  }
  const out = [];
  for (const [era, bag] of byEra) {
    if (!bag.start || !bag.end) continue;
    out.push({
      era: publicName(era),
      start,
      end: boardDay,
      askedStart: asked,
      startGap: start !== asked,
      listingsStart: Number(bag.start.listings),
      listingsEnd: Number(bag.end.listings),
      levelStart: Number(bag.start.level),
      levelEnd: Number(bag.end.level),
    });
  }
  return out;
}

function cohortMove(entries, boardDay, span) {
  const rows = (entries || []).filter((row) => row && dayOk(row.date) && row.class);
  const dates = [...new Set(rows.map((row) => row.date))].sort();
  if (!dates.includes(boardDay)) return [];
  const asked = addDays(boardDay, -span);
  const start = lastOnOrBefore(dates, asked);
  if (!start) return [];
  const out = [];
  const classes = [...new Set(rows.map((row) => row.class))];
  for (const name of classes) {
    const a = rows.find((row) => row.class === name && row.date === start);
    const b = rows.find((row) => row.class === name && row.date === boardDay);
    if (!a || !b) continue;
    out.push({
      class: publicName(name),
      start,
      end: boardDay,
      startGap: start !== asked,
      listingsStart: Number(a.totalSupply),
      listingsEnd: Number(b.totalSupply),
    });
  }
  return out;
}

export function setSlices(slices, minN) {
  const need = Number(minN);
  const out = [];
  for (const row of slices || []) {
    const n = Number(row?.n);
    const up = Number(row?.up);
    if (!(n >= 0) || !(up >= 0) || n < need) continue;
    out.push({
      name: publicName(row.name || row.scope || "slice"),
      up,
      n,
      upShare: n ? Math.round((up / n) * 10000) / 10000 : null,
    });
  }
  return out;
}

export function breadthFromFact(fact) {
  const m = String(fact || "").match(/\((\d+) of (\d+)\)/);
  if (!m) return null;
  return { up: Number(m[1]), n: Number(m[2]) };
}

export function slicesFromMeter(meter) {
  const out = [];
  const take = (row, name) => {
    const input = (row?.inputs || []).find((item) => item?.id === "breadth");
    const hit = breadthFromFact(input?.fact);
    if (!hit) return;
    out.push({ name: publicName(name), up: hit.up, n: hit.n });
  };
  const sets = meter?.sets && typeof meter.sets === "object" ? meter.sets : {};
  for (const [slug, row] of Object.entries(sets)) take(row, row?.name || slug);
  for (const key of ["modern", "vintage", "market", "singles", "sealed"]) take(meter?.[key], key);
  return out;
}

export function rowsFromDaily(doc, sealedIds) {
  const ids = sealedIds instanceof Set ? sealedIds : new Set((sealedIds || []).map(String));
  const rows = [];
  for (const row of doc?.prices || []) {
    const id = String(row?.id ?? "");
    const market = Number(row?.market);
    if (!id || !(market > 0)) continue;
    rows.push({ id, market, kind: ids.has(id) ? "sealed" : "single" });
  }
  return { day: String(doc?.date || "").slice(0, 10), rows };
}

export function viewWeight(views) {
  const n = Number(views);
  if (!(n >= 0)) return 1;
  return 1 + Math.log10(1 + n);
}

function sinceLine(current, prior) {
  if (!current || current.held) return "This week's breadth line was missed.";
  if (!prior || prior.held || prior.up == null || !(prior.n > 0)) return "No prior week on file.";
  const missed = prior.missed ? " Last week's line was missed." : "";
  return `Since last week, products up went from ${prior.up} of ${prior.n} on ${prior.end} to ${current.up} of ${current.n} on ${current.end}.${missed}`;
}

function chartPoints(series, end) {
  const rows = seriesRows(series).filter((row) => !end || row.d <= end).slice(-8);
  return rows.map((row) => ({ d: row.d, v: row.v }));
}

export function buildMoodGap({
  boardDay = "",
  cfg = null,
  flag = false,
  days = {},
  indexes = {},
  eras = [],
  cohorts = [],
  slices = [],
  talk = null,
  prior = null,
  backtestRows = [],
} = {}) {
  const held = [];
  if (!cfg || typeof cfg !== "object") {
    held.push("thresholds missing");
    return {
      asOf: boardDay || null,
      held,
      D: null,
      T: null,
      G: null,
      breadth7: null,
      breadth30: null,
      publicRead: null,
      sections: [],
      backtest: { passed: false, reason: "not passed yet", n: 0, horizons: {} },
    };
  }
  if (!dayOk(boardDay)) held.push("board day missing");
  const breadth7 = dayOk(boardDay) ? windowBreadth(days, boardDay, 7) : { held: true };
  const breadth30 = dayOk(boardDay) ? windowBreadth(days, boardDay, 30) : { held: true };
  if (breadth7.held) held.push("7 day breadth held");
  if (breadth30.held) held.push("30 day breadth held");
  const singles7 = dayOk(boardDay) ? indexWindow(indexes.singles, boardDay, 7) : { held: true };
  const sealed7 = dayOk(boardDay) ? indexWindow(indexes.sealed, boardDay, 7) : { held: true };
  const singles30 = dayOk(boardDay) ? indexWindow(indexes.singles, boardDay, 30) : { held: true };
  const sealed30 = dayOk(boardDay) ? indexWindow(indexes.sealed, boardDay, 30) : { held: true };
  const indexGap7 = singles7.held || sealed7.held ? null : round1(sealed7.pct - singles7.pct);
  const indexGap30 = singles30.held || sealed30.held ? null : round1(sealed30.pct - singles30.pct);
  const D = weaknessOf(breadth7);
  if (D == null) held.push("D held");
  const talkRow = talkScore(talk, boardDay, Number(cfg.freshnessDays));
  const T = talkRow.T;
  if (T == null) held.push("talk held");
  const G = gapOf(T, D);
  const sets = setSlices(slices, cfg.minSliceN);
  const eraRows = dayOk(boardDay) ? eraMove(eras, boardDay, 7) : [];
  const cohortRows = dayOk(boardDay) ? cohortMove(cohorts, boardDay, 7) : [];
  const facts = [];
  const b7 = countLine("7 day product breadth", breadth7);
  if (b7) facts.push(keepFact(b7, "TCGCSV daily", breadth7.end));
  const b30 = countLine("30 day product breadth", breadth30);
  if (b30) facts.push(keepFact(b30, "TCGCSV daily", breadth30.end));
  const modern = sets.find((row) => /modern/i.test(row.name));
  if (modern && breadth7 && !breadth7.held) {
    const line = `Modern sets: ${modern.up} of ${modern.n} up over 7 days. All products on both days: ${breadth7.up} of ${breadth7.n} up. As of ${boardDay}.`;
    facts.push(keepFact(line, "market-meter.json and TCGCSV daily", boardDay));
  }
  const i7s = indexLine("Singles", singles7);
  const i7b = indexLine("Sealed", sealed7);
  if (i7s && i7b && indexGap7 != null) {
    const line = `${i7s} ${i7b} Sealed minus singles is ${indexGap7} points.`;
    facts.push(keepFact(line, "indexes.json", boardDay));
  }
  const era = eraRows.find((row) => Number.isFinite(row.listingsStart) && Number.isFinite(row.listingsEnd));
  if (era) {
    const line = `${era.era} listings counted ${era.listingsStart} on ${era.start} and ${era.listingsEnd} on ${era.end}. Level ${era.levelStart} to ${era.levelEnd}.`;
    facts.push(keepFact(line, "era-index-history-tcg.json", era.end));
  }
  const cohort = cohortRows.find((row) => Number.isFinite(row.listingsStart) && Number.isFinite(row.listingsEnd));
  if (cohort && facts.length < 5) {
    const line = `${cohort.class} basket listings counted ${cohort.listingsStart} on ${cohort.start} and ${cohort.listingsEnd} on ${cohort.end}.`;
    facts.push(keepFact(line, "cohort-history.json", cohort.end));
  }
  const cleanFacts = facts.filter(Boolean).slice(0, 5);
  const since = sinceLine(breadth7, prior?.breadth7 || prior);
  const talkHeld = T == null;
  const heldLine = talkHeld ? "Talk is held. These lines are prices and listings counted only." : "";
  const plainBits = [...cleanFacts.map((row) => row.text), since];
  if (heldLine) plainBits.push(heldLine);
  const plain = plainBits.join("\n");
  const backtest = scoreBacktest(backtestRows, cfg.minBacktestN);
  const share = {
    asOf: boardDay,
    permalink: PERMALINK,
    numbers: {
      up: breadth7?.up ?? null,
      down: breadth7?.down ?? null,
      flat: breadth7?.flat ?? null,
      n: breadth7?.n ?? null,
      singles7: singles7?.pct ?? null,
      sealed7: sealed7?.pct ?? null,
      gap7: indexGap7,
    },
    series: [
      { name: "singles", points: chartPoints(indexes.singles, boardDay) },
      { name: "sealed", points: chartPoints(indexes.sealed, boardDay) },
    ],
    sources: [
      { name: "TCGCSV daily", date: breadth7?.end || "" },
      { name: "indexes.json", date: boardDay },
      { name: "market-meter.json", date: boardDay },
    ],
  };
  const section = {
    id: "breadth",
    title: "Market breadth",
    order: LETTER_ORDER.indexOf("breadth"),
    held: heldLine,
    facts: cleanFacts,
    sinceLastWeek: since,
    plain,
    share,
    asOf: boardDay,
  };
  let publicRead = null;
  const showG = flag === true && backtest.passed === true && G != null && breadth7?.end === boardDay;
  if (flag === true && D != null && breadth7?.end === boardDay && cleanFacts.length >= 3) {
    const lead = cleanFacts[0].text;
    const gapBit = showG ? ` Mood gap ${G}.` : "";
    const line = `Market breadth, ${boardDay}. ${lead}${gapBit}${heldLine ? ` ${heldLine}` : ""}`;
    const read = {
      id: "market-breadth",
      readKind: "moodgap",
      kind: "moodgap",
      name: "Market breadth",
      asOf: boardDay,
      endDate: breadth7.end,
      headline: line,
      line,
      source: "TCGCSV daily, indexes.json",
      permalink: PERMALINK,
    };
    if (!beforeBoard(read, boardDay) && copyOk(line)) publicRead = read;
  }
  return {
    asOf: boardDay,
    held,
    D,
    T,
    G,
    talkHeld,
    breadth7,
    breadth30,
    singles7,
    sealed7,
    singles30,
    sealed30,
    indexGap7,
    indexGap30,
    sets,
    eras: eraRows,
    cohorts: cohortRows,
    facts: cleanFacts,
    plain,
    share,
    sinceLastWeek: since,
    sections: cleanFacts.length ? [section] : [{ ...section, facts: [], plain: section.held || since }],
    backtest,
    publicRead,
  };
}

export function attachLetterPoints(follow, moodGap) {
  const picked = new Set(cleanPoints(follow?.points));
  if (!picked.has("breadth")) return [];
  const found = (moodGap?.sections || []).find((row) => row?.id === "breadth" && Array.isArray(row.facts) && row.facts.length);
  if (found) return [{ ...found, order: LETTER_ORDER.indexOf("breadth") }];
  const line = "No market breadth line for this day.";
  return [{
    id: "breadth",
    title: "Market breadth",
    order: LETTER_ORDER.indexOf("breadth"),
    held: line,
    facts: [],
    sinceLastWeek: "No prior week on file.",
    plain: line,
    share: null,
    asOf: moodGap?.asOf || "",
  }];
}
