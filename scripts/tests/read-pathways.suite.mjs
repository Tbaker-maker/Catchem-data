// Read pathways and their phrasing. Fixture rules are fake on purpose: the
// real thresholds live in catchem-data-private and never in this repo.
import { pathwayReads, validPathways, quietHighAt, ledgerRows, appendLedger, mergePoints } from "../lib/read-pathways.mjs";
import { renderPathway, revaryPhrasing, sentencesOf, LEADS, ANGLES } from "../lib/read-phrasing.mjs";
import { spaceFamilies, orderFiltered } from "../lib/reads-guard.mjs";
import { flagLine } from "../lib/copy-rules.mjs";
import { addDays } from "../lib/history-reads.mjs";

const ASOF = "2026-11-25";
const FAKE = {
  readsEnabled: true,
  registeredAt: "2026-01-01",
  pathways: [
    { pathway: "quiet-high", kind: "single", versionId: "qh-single-test-v1", enabled: true, maxReads: 40, rule: { priorWeeks: 40, skipWeeks: 1, minCoverage: 0.7, newHighRatio: 1.01, stepWeeks: 10, minUpWeeks: 5, maxStepRatio: 1.1, minPrice: 4, cooldownWeeks: 8 } },
    { pathway: "quiet-high", kind: "sealed", versionId: "qh-sealed-test-v1", enabled: true, maxReads: 40, rule: { priorWeeks: 40, skipWeeks: 1, minCoverage: 0.7, newHighRatio: 1.01, stepWeeks: 10, minUpWeeks: 5, maxStepRatio: 1.1, minPrice: 4, cooldownWeeks: 8 } },
    { pathway: "quiet-climber", kind: "single", versionId: "qc-single-test-v1", enabled: true, maxReads: 40, rule: { moveWeeks: 13, minPeers: 5, relLow: 1.04, relHigh: 1.3, stepWeeks: 10, minUpWeeks: 6, maxStepRatio: 1.1, minPrice: 4, cooldownWeeks: 8 } },
  ],
};

// Daily points, change only, 7-day heartbeat, from a weekly price function.
function series(fn, weeks = 60) {
  const pts = [];
  for (let k = weeks * 7; k >= 0; k -= 1) {
    const d = addDays(ASOF, -k);
    const v = Math.round(fn(k / 7) * 100) / 100;
    if (!pts.length || pts.at(-1)[1] !== v || k % 7 === 0 || k === 0) pts.push([d, v]);
  }
  return pts;
}
// Wobbles near base for a long time, dips, then climbs in small weekly steps
// and passes the old top for the first time tonight.
const gentleHigh = (base, top = 1.02, r = 1.015) => {
  const end = base * 1.03 * top;
  return (w) => (w > 10 ? base * (1 + 0.03 * Math.sin(w)) : end / Math.pow(r, w));
};
const jumpHigh = (base) => (w) => (w > 1 ? base : base * 1.4);
const flat = (base) => (w) => base * (1 + 0.004 * Math.sin(w * 3));

function single(id, name, set, rarity, fn) {
  return { id: `tcgcsv-${id}`, name, number: `${id % 200}/200`, set, setSlug: set.toLowerCase().replace(/\W+/g, "-"), release: "2021-03-19", rarity, printing: "Holofoil", pts: series(fn) };
}

export async function run() {
  let fail = 0;
  const t = (name, cond, info = "") => { if (cond) console.log("  ok ", name); else { fail += 1; console.error("  FAIL", name, info); } };

  // Fail closed config.
  t("no config is no pathways", validPathways(null) === null);
  t("readsEnabled false is no pathways", validPathways({ ...FAKE, readsEnabled: false }) === null);
  t("a missing rule number drops that pathway", validPathways({ ...FAKE, pathways: [{ ...FAKE.pathways[0], rule: { ...FAKE.pathways[0].rule, maxStepRatio: undefined } }] }) === null);
  t("a pathway without a version id is dropped", validPathways({ ...FAKE, pathways: [{ ...FAKE.pathways[0], versionId: "" }] }) === null);
  t("quiet climber on sealed is refused", validPathways({ ...FAKE, pathways: [{ ...FAKE.pathways[2], kind: "sealed" }] }) === null);
  const cfg = validPathways(FAKE);
  t("a full config validates with a hash", cfg && cfg.pathways.length === 3 && /^[0-9a-f]{64}$/.test(cfg.hash));
  t("no config writes no reads", pathwayReads({ singles: [single(1, "Pikachu", "Battle Styles", "Rare Holo", gentleHigh(20))], asOf: ASOF, cfg: null }).length === 0);

  // Quiet new high detector.
  const rule = cfg.pathways[0].rule;
  t("a gentle climb to a new high fires", !!quietHighAt(series(gentleHigh(20)), ASOF, rule));
  t("one big jump to a new high does not fire", !quietHighAt(series(jumpHigh(20)), ASOF, rule));
  t("a flat line does not fire", !quietHighAt(series(flat(20)), ASOF, rule));
  const gappy = series(gentleHigh(20)).filter((p) => p[0] < addDays(ASOF, -140) || p[0] > addDays(ASOF, -30));
  t("a long gap in the weekly record fails closed", !quietHighAt(gappy, ASOF, rule));
  const notTonight = series(gentleHigh(20)).slice(0, -1);
  t("no price tonight writes no read", pathwayReads({ singles: [{ ...single(2, "Eevee", "Battle Styles", "Rare Holo", flat(1)), pts: notTonight }], asOf: ASOF, cfg }).length === 0);
  const stale = series(gentleHigh(20));
  const staleItem = { ...single(3, "Mew", "Battle Styles", "Rare Holo", flat(1)), pts: stale };
  const lows = [[addDays(ASOF, -6), 18], [addDays(ASOF, -3), 19], [ASOF, 17]];
  const frozen = [[addDays(ASOF, -40), 20], [ASOF, 20]];
  t("a stale market fails closed", pathwayReads({ singles: [staleItem], asOf: ASOF, cfg, seriesOf: () => frozen, lowsOf: () => lows, staleMarketRule: { unchangedDays: 14 } }).length === 0);

  // A fixture board: 30 quiet highs over 6 sets, 12 sealed, climbers among flat peers.
  const sets = ["Battle Styles", "Evolving Skies", "Lost Origin", "Paldea Evolved", "Team Up", "Unified Minds"];
  const singles = [];
  let id = 100;
  for (let i = 0; i < 30; i += 1) singles.push(single(id++, `Card ${String.fromCharCode(65 + (i % 26))}${i}`, sets[i % sets.length], "Ultra Rare", gentleHigh(10 + i * 3.7, 1.012 + (i % 5) * 0.002, 1.014 + (i % 4) * 0.002)));
  for (const s of sets) for (let j = 0; j < 7; j += 1) singles.push(single(id++, `Peer ${j}`, s, "Rare Holo", flat(8 + j)));
  for (let i = 0; i < 12; i += 1) singles.push(single(id++, `Climber ${i}`, sets[i % sets.length], "Rare Holo", (w) => (w >= 25 && w <= 32 ? 13 + i : w >= 10 ? 9 + i : w > 0 ? (9 + i) * Math.pow(1.004, 10 - w) : (9 + i) * Math.pow(1.004, 9) * (1.008 + (i % 4) * 0.003))));
  const sealed = [];
  for (let i = 0; i < 12; i += 1) sealed.push({ id: `sealed-${i}`, name: `${sets[i % sets.length]} Booster Box ${i}`, set: sets[i % sets.length], release: "2021-03-19", rarity: "", pts: series(gentleHigh(90 + i * 11, 1.013 + (i % 3) * 0.003)) });
  const reads = pathwayReads({ singles, sealed, asOf: ASOF, cfg });
  const by = (v) => reads.filter((r) => r.pathway.version === v).length;
  t("quiet highs fire on singles", by("qh-single-test-v1") >= 20, by("qh-single-test-v1"));
  t("quiet highs fire on sealed", by("qh-sealed-test-v1") >= 8, by("qh-sealed-test-v1"));
  t("quiet climbers fire on singles", by("qc-single-test-v1") >= 5, by("qc-single-test-v1"));
  t("flat peers never fire", !reads.some((r) => /Peer /.test(r.name)));
  t("one read per item a night", new Set(reads.map((r) => r.sku)).size === reads.length);
  t("every read has a version id, config hash and registration day", reads.every((r) => /-v\d+$/.test(r.pathway.version) && /^[0-9a-f]{12}$/.test(r.pathway.configHash) && r.pathway.registeredAt === "2026-01-01"));
  t("every read has 3 lines and a public kind", reads.every((r) => r.lines.length === 3 && r.readKind === "deep" && r.board === "v3"));
  t("rebuilds are stable", JSON.stringify(pathwayReads({ singles, sealed, asOf: ASOF, cfg })) === JSON.stringify(reads));

  // Rules guard on every sentence.
  const all = reads.flatMap(sentencesOf);
  t("no advice phrase in any sentence", all.every((s) => flagLine(s, { house: false }).length === 0), all.find((s) => flagLine(s, { house: false }).length));
  t("never says sold", all.every((s) => !/\bsold\b|\bsales?\b/i.test(s)));
  t("sealed copy has no NM or condition label", reads.filter((r) => r.pathway.kind === "sealed").flatMap(sentencesOf).every((s) => !/\bNM\b|near mint|lightly played|moderately played|damaged|\bcondition\b|\bLP\b|\bMP\b/i.test(s)));
  t("no plan pricing or gating", all.every((s) => !/premium|members? only|subscribe|\/mo\b|per month|unlock|paywall/i.test(s)));
  t("no hype or forecast words", all.every((s) => !/to the moon|guarantee|can't lose|will (rise|climb|go)|next (week|month)|breakout|explod|skyrocket|soar/i.test(s)));
  t("no dash punctuation", all.every((s) => !/[\u2014\u2013]/.test(s)));
  // Every dollar amount is a number the read has on file.
  const usdNums = (s) => [...s.matchAll(/\$([\d,]+\.\d\d)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  const factNums = (f) => new Set(Object.values(f).filter((v) => typeof v === "number").map((v) => Math.round(v * 100) / 100));
  t("every dollar amount comes from facts", reads.every((r) => { const ok = factNums(r.phrase.facts); return sentencesOf(r).every((s) => usdNums(s).every((n) => ok.has(n))); }));

  // Variety on a board: pathway reads mixed with other families.
  const others = Array.from({ length: 70 }, (_, i) => ({ id: `other-${i}`, family: ["listings", "calendar", "price", "news"][i % 4], readKind: "x", headline: `Other ${i}`, lines: [`o${i}`] }));
  const board = spaceFamilies([...reads, ...others]);
  const path = board.filter((r) => r.phrase);
  const sample = path.slice(0, 50);
  t("the sample has 50 pathway reads or all of them", sample.length === Math.min(50, path.length) && sample.length >= 30, sample.length);
  const sent = sample.flatMap(sentencesOf);
  t("no exact duplicate sentence in the sample", new Set(sent).size === sent.length, sent.filter((s, i) => sent.indexOf(s) !== i).slice(0, 3).join(" | "));
  let sameAdj = 0, simAdj = 0, sameLeadAdjPath = 0;
  for (let i = 1; i < board.length; i += 1) {
    const a = board[i - 1], b = board[i];
    if (a.similar && a.similar === b.similar) simAdj += 1;
    if (a.phrase && b.phrase && a.phrase.templates.some((k) => b.phrase.templates.includes(k))) sameAdj += 1;
  }
  for (let i = 1; i < path.length; i += 1) if (path[i - 1].phrase.templates[0] === path[i].phrase.templates[0]) sameLeadAdjPath += 1;
  t("similar reads are never back to back when others can sit between", simAdj === 0, simAdj);
  t("no template repeats back to back", sameAdj === 0, sameAdj);
  t("a pathway-only view never repeats the lead template back to back", sameLeadAdjPath === 0, sameLeadAdjPath);
  const leadsUsed = new Set(sample.map((r) => r.phrase.templates[0]));
  t("the sample uses most lead templates", leadsUsed.size >= 8, leadsUsed.size);
  t("angles vary across the sample", new Set(sample.flatMap((r) => r.phrase.angles)).size >= 5);

  // A filter that leaves only similar reads: they may touch, words may not.
  const only = orderFiltered(board, (r) => r.similar === "pathway:quiet-high" && r.pathway.kind === "single");
  let touch = 0, shared = 0, sharedAngle = 0;
  for (let i = 1; i < only.length; i += 1) {
    const a = only[i - 1].phrase, b = only[i].phrase;
    touch += 1;
    if (a.templates.some((k) => b.templates.includes(k))) shared += 1;
    if (a.angles[0] === b.angles[0] && a.angles[1] === b.angles[1] && a.angles[2] === b.angles[2]) sharedAngle += 1;
  }
  t("a one-pathway filter lets similar reads sit together", only.length >= 20 && touch === only.length - 1, only.length);
  t("filtered neighbours never share a template", shared === 0, shared);
  t("filtered neighbours never share the same angle line-up", sharedAngle === 0, sharedAngle);
  const fsent = only.flatMap(sentencesOf);
  t("no duplicate sentence inside the filtered view", new Set(fsent).size === fsent.length);
  const setOnly = orderFiltered(board, (r) => r.phrase && r.phrase.facts.setName === "Team Up");
  let setShared = 0;
  for (let i = 1; i < setOnly.length; i += 1) if (setOnly[i - 1].phrase.templates.some((k) => setOnly[i].phrase.templates.includes(k))) setShared += 1;
  t("a one-set filter never repeats a template back to back", setOnly.length >= 3 && setShared === 0, `${setOnly.length}/${setShared}`);

  // Template banks: several per pathway and per fact.
  t("at least 5 leads per pathway", Object.values(LEADS).every((l) => l.length >= 5));
  t("at least 2 templates per angle", Object.values(ANGLES).every((l) => l.length >= 2));
  t("render is deterministic", JSON.stringify(renderPathway("quiet-high", reads[0].phrase.facts, "x|y")) === JSON.stringify(renderPathway("quiet-high", reads[0].phrase.facts, "x|y")));
  t("revary leaves non-pathway rows alone", revaryPhrasing(others).every((r, i) => r === others[i]));

  // Forward ledger.
  const rows = ledgerRows(reads);
  const one = appendLedger(null, rows);
  const two = appendLedger(one.doc, rows);
  t("ledger keeps one row per read, day and version", one.added === reads.length && two.added === 0 && two.doc.calls.length === reads.length);
  t("ledger rows carry version and hash", rows.every((r) => r.version && r.configHash && r.asOf === ASOF));
  t("mergePoints: the later list wins a shared day", JSON.stringify(mergePoints([["2026-01-01", 1], ["2026-01-02", 2]], [["2026-01-02", 3]])) === JSON.stringify([["2026-01-01", 1], ["2026-01-02", 3]]));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("read-pathways.suite.mjs")) {
  run().then((n) => { console.log(n ? `${n} failed` : "all passed"); process.exit(n ? 1 : 0); });
}
