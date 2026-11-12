// PkmnPrices read pathways. Made-up rows in the real API shapes only.
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fixtureRoot } from "../fixtures/ppp/fixture-root.mjs";
import { ASOF } from "../fixtures/ppp/make-fixture.mjs";
import { collectPppReads, pickFacts } from "../lib/ppp-reads/collect.mjs";
import { resetPppContext } from "../lib/ppp-reads/context.mjs";
import { compRows, mergeInputs, popRows, titleFlag } from "../lib/ppp-reads/inputs.mjs";
import { shardsToInput, detailToHistory } from "../lib/ppp-reads/raw-shards.mjs";
import { LIMITS, mergeLimits } from "../lib/ppp-reads/limits.mjs";
import { rawComps, soldGap, soldMedian, soldPace, sellThrough, msrpSold, range52, thinDaysOf } from "../lib/ppp-reads/pathways.mjs";
import { dropHalfPrice } from "../lib/ppp-reads/series.mjs";
import { parseEcb } from "../lib/ppp-reads/fx.mjs";
import { factRead } from "../lib/ppp-reads/copy.mjs";
import { PATTERNS, buildMedians, expectedDir, replayOne, scoreGates } from "../lib/scanner/engine.mjs";
import { buildScannerReads, scannerCopyOk } from "../lib/scanner/reads.mjs";
import { PPP_PATTERNS, setPppScannerContext } from "../lib/ppp-reads/scanner-patterns.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok, detail = "") => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}${detail ? ` (${detail})` : ""}`); } };
  process.env.PPP_READS_NO_NET = "1";
  resetPppContext();
  const { root, catalog } = await fixtureRoot();
  try {
    const out = await collectPppReads({ root, asOf: ASOF, catalog, token: "" });
    const hits = out.hits.filter((h) => !h.error);
    const has = (id, pathway, dir) => hits.some((h) => h.itemId === id && h.pathway === pathway && (!dir || h.dir === dir));

    // Loader
    t("three input nights merge into four items", out.summary.inputFiles === 3 && out.summary.pppItems === 4);
    t("no pathway threw", out.summary.errors === 0, JSON.stringify(out.hits.filter((h) => h.error)));

    // Pathways fire on the rows built to fire them
    t("sales pace spike", has("tcgcsv-900001", "sold-pace", "up"));
    t("sold median trend apart from the market", has("tcgcsv-900001", "sold-trend", "up"));
    t("graded population growth week over week", has("tcgcsv-900001", "pop-growth"));
    t("PSA 10 to raw spread narrowed", has("tcgcsv-900001", "graded-spread", "down"));
    t("52-week high from a year of history", has("tcgcsv-900001", "range52", "up"));
    t("sealed sold median over the market", has("tcgcsv-900003", "sold-gap", "up"));
    t("sealed sell-through rose", has("tcgcsv-900003", "sell-through", "up"));
    t("sealed sold median against sourced MSRP", has("tcgcsv-900003", "msrp-sold", "up"));
    t("low gem pop while the price rose", has("tcgcsv-900002", "low-pop", "up"));
    t("Cardmarket gap moved", has("tcgcsv-900004", "eu-gap", "up"));
    t("Japanese printing moved apart from English", has("tcgcsv-900004", "jp-en", "up"));

    // Minimum samples and filters
    t("three comps write no sold read", !has("tcgcsv-900002", "sold-gap") && !has("tcgcsv-900002", "sold-trend"));
    const ctxItems = mergeInputs((await Promise.all([0, 1, 2].map((i) => readFile(join(root, "data/private/ppp/reads-input", `night-${i}.json`), "utf8")))).map((s) => JSON.parse(s))).items;
    const item = { ...ctxItems.get("tcgcsv-900001"), kind: "single", printing: "Holofoil" };
    item.ppp = { comps: item.comps, volume: item.volume, history: item.history, pop: item.pop, volumeFrom: item.volumeFrom };
    const raw = rawComps(item, ASOF, 14);
    t("shared-attribution comps are left out", raw.every((c) => c.attribution === "exact"));
    t("graded comps are left out of raw", raw.every((c) => !c.graded));
    const med = soldMedian(raw, 5);
    t("half-price comps are dropped before the median", med && med.dropped === 4 && med.median >= 58, JSON.stringify(med));
    t("half-price rule matches the eBay client", dropHalfPrice([{ price: 100 }, { price: 90 }, { price: 40 }, { price: 50 }]).dropped.length === 2 && dropHalfPrice([{ price: 12 }]).dropped.length === 0);
    const late = compRows([{ id: 1, price: 10, currency: "USD", sold_at: "2026-11-01T00:00:00Z", ingested_at: "2026-11-20T00:00:00Z", attribution: "exact" }]);
    t("a comp ingested after the read date is not seen (no look-ahead)", rawComps({ kind: "single", ppp: { comps: late } }, "2026-11-12", 30).length === 0 && rawComps({ kind: "single", ppp: { comps: late } }, "2026-11-21", 30).length === 1);
    const multi = { kind: "single", ppp: { comps: compRows([{ id: 1, price: 10, currency: "USD", sold_at: "2026-11-10", attribution: "exact", variant: "Holofoil" }, { id: 2, price: 11, currency: "USD", sold_at: "2026-11-10", attribution: "exact", variant: "Reverse Holofoil" }]) } };
    t("comps from two printings with no printing named are not mixed", rawComps(multi, "2026-11-12", 14).length === 0);
    t("EUR comps never count as USD", rawComps({ kind: "sealed", ppp: { comps: compRows([{ id: 1, price: 10, currency: "EUR", sold_at: "2026-11-10" }]) } }, "2026-11-12", 14).length === 0);
    t("pace needs eight weeks of coverage", soldPace({ ppp: { volume: [{ date: "2026-11-10", sales: 30, graded: false }], volumeFrom: "2026-11-01" } }, ASOF, LIMITS) === null);
    t("sell-through needs listings counted", sellThrough({ ...item, listings: [] }, ASOF, LIMITS) === null);
    t("MSRP needs a sourced amount", msrpSold({ kind: "sealed", pid: 1, ppp: { comps: [] } }, ASOF, LIMITS, { msrp: new Map() }) === null);
    t("52-week needs 300 days of cover", range52({ points: [{ date: ASOF, price: 50, src: "own" }], ppp: { history: [] } }, ASOF, LIMITS) === null);
    t("gap needs the market within 3 days", soldGap({ ...item, points: [{ date: "2026-10-01", price: 30, src: "own" }] }, ASOF, LIMITS) === null);
    t("pop rows read the documented response", popRows({ variants: [{ variant: "Holofoil", total_population: 3822, total_gems: 854, gem_rate: 22.34, updated_at: "2026-10-20T21:00:00+00:00", graders: {} }] })[0]?.total === 3822);
    t("ECB rates parse", parseEcb('<Cube time="2026-11-11"><Cube currency="USD" rate="1.1127"/></Cube>')[0]?.usdPerEur === 1.1127);
    t("a private limit file only changes known numbers", mergeLimits(LIMITS, { soldGap: { minComps: 8, bogus: 1 }, nope: 3 }).soldGap.minComps === 8 && !("nope" in mergeLimits(LIMITS, { nope: 3 })));

    // Real-data guards (from the first PkmnPrices night, 2026-11-12)
    t("titles naming a played, damaged, graded or foreign copy are flagged",
      titleFlag("Blastoise 137/135 Plasma Storm Holo LP Portuguese") === "language" && titleFlag("Shiny Blastoise 137/135 Secret Rare HP/DMG") === "condition"
      && titleFlag("PSA 10 Umbreon VMAX") === "graded" && titleFlag("Team Aqua's Kyogre EX 6/34 Holo 190 HP Eng 2015") === null && titleFlag("Pikachu ex 276/217 SIR NM") === null);
    const titled = compRows([
      ...[20, 21, 22, 23, 24].map((p, i) => ({ id: i, price: p, currency: "USD", sold_at: "2026-11-10", attribution: "exact", title: "Card NM" })),
      { id: 9, price: 8, currency: "USD", sold_at: "2026-11-10", attribution: "exact", title: "Card Damaged" },
    ]);
    const tr = rawComps({ kind: "single", ppp: { comps: titled } }, ASOF, 14);
    t("flagged titles leave raw medians and are counted", tr.length === 5 && tr.titleDropped === 1 && soldMedian(tr, 5).titleDropped === 1);
    const mixed = compRows([500, 520, 540, 560, 580, 600, 1300].map((p, i) => ({ id: i, price: p, currency: "USD", sold_at: "2026-11-10", attribution: "exact" })));
    t("one high comp that drops most of the window writes no median", soldMedian(rawComps({ kind: "single", ppp: { comps: mixed } }, ASOF, 14), 1, LIMITS) === null);
    const cut = { kind: "single", ppp: { comps: titled, compsFrom: "2026-11-05" } };
    t("a truncated comps page cannot count a window before its oldest comp", rawComps(cut, ASOF, 14).length === 0 && rawComps(cut, ASOF, 6).length === 5);
    const wide = { ...item, points: [{ date: ASOF, price: 100, src: "own" }] };
    t("a sold gap over 60% is left out as a likely mismatch", soldGap({ ...wide, ppp: { comps: compRows([30, 31, 32, 33, 34].map((p, i) => ({ id: i, price: p, currency: "USD", sold_at: "2026-11-10", attribution: "exact", variant: "Holofoil" }))) } }, ASOF, LIMITS) === null);
    const vol = (d, n) => ({ date: d, sales: n, graded: false });
    const days = Array.from({ length: 70 }, (_, i) => new Date(Date.parse("2026-09-01T00:00:00Z") + i * 864e5).toISOString().slice(0, 10));
    const many = Array.from({ length: 25 }, () => days.map((d) => vol(d, d >= "2026-10-05" && d <= "2026-10-12" ? 0 : 2)).filter((r) => r.sales > 0));
    const thin = thinDaysOf(many, LIMITS);
    t("a day every product is quiet is a tracking gap", thin.has("2026-10-08") && !thin.has("2026-09-20"));
    t("a tracking gap is not judged from a few products", thinDaysOf(many.slice(0, 5), LIMITS).size === 0);
    const zero = { ppp: { volume: days.map((d) => vol(d, d < "2026-11-01" ? 2 : 0)).filter((r) => r.sales > 0).map((r) => ({ ...r })), volumeFrom: "2026-08-01" } };
    t("a sales drop needs a sale in the recent week", soldPace(zero, "2026-11-12", LIMITS) === null);
    const shardDoc = shardsToInput({
      comps: { 123: { at: "2026-11-12T05:00:00Z", more: true, rows: [{ id: 1, price: 10, currency: "USD", sold_at: "2026-11-03T00:00:00Z", attribution: "exact" }], gradedRows: [] } },
      detail: { 123: { at: "2026-11-12T05:00:00Z", body: { prices: [{ source: "cardmarket", currency: "EUR", market_price: 9.5, condition: "Near Mint", variant: "Holofoil", created_at: "2026-11-11T00:00:00Z" }] } } },
    }, { single: { 123: 77 } });
    t("the enrich store becomes one input doc", shardDoc.kind === "ppp-reads-input" && shardDoc.asOf === "2026-11-12" && shardDoc.items["tcgcsv-123"].pppId === 77 && shardDoc.items["tcgcsv-123"].compsFrom === "2026-11-04");
    t("Cardmarket rows from the detail call become EUR history", detailToHistory({ prices: [{ source: "cardmarket", currency: "EUR", market_price: 9.5, created_at: "2026-11-11T03:00:00Z" }] })[0]?.currency === "EUR");

    // Public copy
    const reads = out.reads;
    t("fact reads are written", reads.length >= 4, String(reads.length));
    t("one read per product", new Set(reads.map((r) => r.sku)).size === reads.length);
    const textOf = (r) => [r.headline, r.source, r.why, ...r.lines].join(" ");
    t("every line passes the shared copy rules", reads.every((r) => [r.headline, r.source, r.why, ...r.lines].every(scannerCopyOk)));
    t("each read names its source and dates", reads.every((r) => /PkmnPrices|ECB|TCGplayer/.test(r.source) && /\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/.test(r.source) && r.asOf === ASOF));
    t("'sold' appears only on sold-comp pathways", reads.every((r) => !/\bsold\b/i.test(textOf(r)) || ["sold-gap", "sold-pace", "sold-trend", "sell-through", "msrp-sold", "graded-spread"].includes(r.readKind)));
    t("no condition label on sealed", reads.filter((r) => r.href.startsWith("/p/")).every((r) => !/near mint|lightly played|\bNM\b|mint condition/i.test(textOf(r))));
    t("no hit rate on a fact read", reads.every((r) => !/hit rate|past cases/i.test(textOf(r)) && r.receipt.scored === false));
    t("no null, undefined or NaN in copy", reads.every((r) => !/\bnull\b|\bundefined\b|NaN/.test(textOf(r))));
    const st = factRead(hits.find((h) => h.pathway === "sell-through"), { id: "tcgcsv-900003", kind: "sealed", name: "Fixture Booster Box" }, ASOF);
    t("sell-through says listings counted, not sold listings", st && /listings counted/.test(textOf(st)) && !/sold listings/i.test(textOf(st)));
    const allClean = hits.every((h) => factRead(h, { id: h.itemId, kind: h.kind, name: catalog.items.find((i) => i.id === h.itemId).name }, ASOF) !== null);
    t("every pathway's lines pass the copy rules", allClean);
    t("all twelve pathways fire on the fixture", new Set(hits.map((h) => h.pathway)).size === 12, [...new Set(hits.map((h) => h.pathway))].join(","));
    const flagged = [];
    const bad = factRead({ pathway: "sold-gap", dir: "up", metrics: { soldMedian: 10, comps: 5, dropped: 0, market: 8, marketDate: ASOF, gapPct: 25 }, evidence: { from: ASOF, to: ASOF, source: "eBay sold comps via PkmnPrices" } }, { id: "tcgcsv-1", kind: "single", name: "Buy now Pikachu" }, ASOF, { flags: flagged });
    t("an advice phrase leaves the read out and is flagged with the line", bad === null && flagged.length > 0 && flagged[0].line.includes("Buy now"));
    t("the cap holds per pathway", pickFacts(Array.from({ length: 30 }, (_, i) => ({ ...hits.find((h) => h.pathway === "sold-gap"), itemId: `x${i}` })), new Map(Array.from({ length: 30 }, (_, i) => [`x${i}`, { id: `tcgcsv-9${i}`, kind: "sealed", name: `Box ${i}`, price: 100, points: [{ date: ASOF, price: 100 }] }])), ASOF, LIMITS).reads.length === 12);

    // Kill switch
    process.env.CATCHEM_PPP_READS = "0";
    resetPppContext();
    const off = await collectPppReads({ root, asOf: ASOF, catalog, token: "" });
    delete process.env.CATCHEM_PPP_READS;
    t("flag off: no public read, private hits still logged", off.reads.length === 0 && off.hits.length > 0);
    const log = JSON.parse(await readFile(join(root, "data/private/ppp-reads", `${ASOF}.json`), "utf8"));
    t("private log carries every hit", log.private === true && log.hits.length === off.hits.length);
    const popHist = JSON.parse(await readFile(join(root, "data/private/ppp-reads/pop-history.json"), "utf8"));
    t("pop snapshots are kept privately", popHist.items["tcgcsv-900001"]?.length >= 3);

    // Scanner: same replay and gate as every other pattern
    t("ppp patterns are in the scanner", PPP_PATTERNS.every((p) => PATTERNS.includes(p)) && PPP_PATTERNS.length === 12);
    t("ppp direction comes from the hit", expectedDir({ pattern: "ppp-sold-gap", metrics: { dir: "down" } }) === "down");
    resetPppContext();
    const ctx = (await import("../lib/ppp-reads/context.mjs")).loadPppContext;
    const c = await ctx(root, { token: "" });
    setPppScannerContext(c);
    const { buildItems } = await import("../lib/ppp-reads/collect.mjs");
    const items = await buildItems(root, c, catalog);
    const { medians, base } = buildMedians(items, ASOF);
    const dets = items.flatMap((it) => replayOne({ ...it, dailyReplay: true }, ASOF, medians));
    const pppDets = dets.filter((d) => d.pattern.startsWith("ppp-"));
    t("replay finds ppp detections", pppDets.length > 0, String(pppDets.length));
    const gates = scoreGates(dets, base, ASOF);
    t("thin fixture history passes no ppp gate", gates.filter((g) => g.pattern.startsWith("ppp-")).every((g) => !g.passed && g.weight === 0));
    t("no scanner read without a passed gate", buildScannerReads(pppDets.map((d) => ({ ...d, date: ASOF })), gates, ASOF).filter((r) => String(r.receipt?.pattern || "").startsWith("ppp-")).length === 0);
    const live = pppDets.find((d) => d.pattern === "ppp-sold-gap") || pppDets[0];
    const fake = [{ pattern: live.pattern, stage: live.stage, kind: live.kind, dir: live.dir, horizon: 30, passed: true, n: 40, rate: 61, baseRate: 40, decayedRate: 0.61, baseDecayed: 0.4, medianPct: 6.2, from: "2026-01-05", to: "2026-10-01", examples: [], train: { n: 24, rate: 60, detectedFrom: "2026-01-05", detectedTo: "2026-06-30" }, test: { n: 16, rate: 63, detectedFrom: "2026-07-10", detectedTo: "2026-10-01" } }];
    const scored = buildScannerReads([{ ...live, date: ASOF, explore: false, candidate: "" }], fake, ASOF).find((r) => String(r.receipt?.pattern || "") === live.pattern);
    t("a passed gate writes a scored ppp read with its past cases", scored && scored.receipt.scored === true && scored.lines.some((l) => /Past cases like this/.test(l)) && scored.id.startsWith("ppp-"), JSON.stringify(scored || null).slice(0, 300));
  } finally {
    await rm(root, { recursive: true, force: true });
    resetPppContext();
    delete process.env.PPP_READS_NO_NET;
  }
  return fail;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = await run();
  console.log(n ? `${n} failed` : "all passed");
  process.exit(n ? 1 : 0);
}
