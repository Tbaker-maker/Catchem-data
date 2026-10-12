// Writes data/derived/flags.json (what changed or broke tonight) and the script
// research scan (data/derived/research-scan.json and .md). Runs at the end of
// build-feed.mjs. Script only, no AI, no network. Never fails the nightly.
// Last night's view is kept in data/derived/flags-state.json so "new" means new.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FLAG_TYPES, newSetFlags, releaseFlags, priceMoveFlags, newsSourceFlags, dataGapFlags, staleFlags, oddPriceFlags, readTypeFlags, summarizeFlags } from "./lib/flags.mjs";
import { newsLeads, radarCheck, renderDigest, LEFT_FOR_AI } from "./lib/research-scan.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async (root, rel, d = null) => { try { return JSON.parse(await readFile(join(root, rel), "utf8")); } catch { return d; } };
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export async function runFlagger({ root = ROOT, now = new Date(), write = true } = {}) {
  const catalog = await J(root, "data/catalog/tcgcsv-latest.json", {});
  const today = String(catalog.asOf || "").slice(0, 10) || now.toISOString().slice(0, 10);
  const state = await J(root, "data/derived/flags-state.json", {});
  const reads = await J(root, "research/assets/public/reads.json", {});
  const news = await J(root, "research/digests/news.json", {});
  const radar = await J(root, "data/release-radar.json", {});
  const releases = await J(root, "research/assets/public/releases.json", {});
  const groupDates = await J(root, "data/tcgcsv-group-dates.json", {});
  const rating = await J(root, "research/assets/public/feed/card-rating.json", {});
  const held = await J(root, "data/derived/card-rating-held.json", {});
  const outliers = await J(root, "data/derived/sealed-price-outliers.json", {});

  const groupMap = new Map();
  const names = new Map();
  for (const it of catalog.items || []) {
    if (it.groupId && !groupMap.has(it.groupId)) groupMap.set(it.groupId, { id: it.groupId, name: it.set, published: groupDates[String(it.groupId)] || null });
    names.set(Number(it.tcgplayerProductId), { name: it.name, set: it.set, kind: it.kind });
  }
  const groups = [...groupMap.values()];

  const dailyDir = join(root, "data/history/tcgcsv-daily");
  const days = (await readdir(dailyDir).catch(() => [])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort();
  const counts = { ...(state.dayCounts || {}) };
  const priceDay = async (d) => {
    const doc = await J(root, `data/history/tcgcsv-daily/${d}.json`, {});
    const m = new Map();
    for (const r of doc.prices || []) if (r.market > 0 && !m.has(Number(r.id))) m.set(Number(r.id), Number(r.market));
    counts[d] = m.size;
    return m;
  };
  const last = days.at(-1), prev = days.at(-2);
  const lastP = last ? await priceDay(last) : new Map();
  const prevP = prev ? await priceDay(prev) : new Map();

  const ebayDays = (await readdir(join(root, "data/raw/ebay-sealed")).catch(() => [])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f)).sort();
  const stamps = {
    catalog: { file: "data/catalog/tcgcsv-latest.json", date: catalog.asOf },
    reads: { file: "research/assets/public/reads.json", date: reads.asOf },
    news: { file: "research/digests/news.json", date: news.asOf },
    ebaySealed: { file: "data/raw/ebay-sealed/", date: ebayDays.at(-1)?.slice(0, 10) },
    cardRating: { file: "research/assets/public/feed/card-rating.json", date: rating.asOf },
    radarCheck: { file: "data/release-radar.json (checkedAt)", date: radar.checkedAt || radar.updated },
    releases: { file: "research/assets/public/releases.json (checked)", date: releases.checked },
  };
  const kindCounts = {};
  for (const r of reads.reads || []) { const k = r.readKind || r.kind; kindCounts[k] = (kindCounts[k] || 0) + 1; }

  // Research scan (folded from the daily research routine).
  const since = addDays(today, -2);
  const scan = {
    asOf: today,
    generatedAt: now.toISOString(),
    method: "Script. Reads news.json (fetched nightly from free feeds), release-radar.json, TCGCSV groups. Leads only; never edits the radar.",
    newsLeads: newsLeads(news.catalog || news.items || [], { since, until: today }),
    ...(() => { const rc = radarCheck({ radar, calendar: news.releaseCalendar || [], groupDates, groups, today }); return { radar: rc.lines, radarLeads: rc.leads }; })(),
    leftForAi: LEFT_FOR_AI,
  };

  const flags = [
    ...newSetFlags(groups, state),
    ...releaseFlags(radar, state),
    ...scan.radarLeads.map((l) => ({ type: l.type === "DATE_CHANGE" ? "RELEASE_DATE_CHANGE" : "NEW_SET", severity: "medium", key: `scan:${l.type}:${l.name}:${l.seenDate}`, line: l.type === "DATE_CHANGE" ? `${l.source} lists ${l.name} on ${l.seenDate}; the radar says ${l.radarDate} (single source).` : `${l.source} lists ${l.name} for ${l.seenDate}; not on the radar (single source).`, data: l })),
    ...(last && prev ? priceMoveFlags(prev, prevP, last, lastP, names) : []),
    ...newsSourceFlags(news),
    ...scan.newsLeads.map((l) => ({ type: "NEWS_LEAD", severity: "low", key: `news:${l.type}:${l.url}`, line: `${l.type}: ${l.title} (${l.source}, ${l.date}).`, data: l })),
    ...dataGapFlags(days, today, counts),
    ...staleFlags(stamps, today),
    ...oddPriceFlags(held, outliers),
    ...readTypeFlags(kindCounts, state),
  ];
  const prevKeys = new Set(state.flagKeys || []);
  for (const f of flags) f.new = !prevKeys.has(f.key);
  const doc = { asOf: today, generatedAt: now.toISOString(), note: "Internal. What changed or broke tonight, for the weekly review. Script only.", types: FLAG_TYPES, summary: summarizeFlags(flags), newTonight: flags.filter((f) => f.new).length, flags };
  const nextState = {
    asOf: today,
    groups: groups.map((g) => g.id),
    radar: (radar.upcoming || []).map((u) => ({ name: u.name, date: u.date })),
    readKinds: kindCounts,
    dayCounts: Object.fromEntries(Object.entries(counts).sort().slice(-40)),
    flagKeys: flags.map((f) => f.key),
  };
  if (write) {
    await mkdir(join(root, "data/derived"), { recursive: true });
    await writeFile(join(root, "data/derived/flags.json"), JSON.stringify(doc, null, 1) + "\n");
    await writeFile(join(root, "data/derived/flags-state.json"), JSON.stringify(nextState) + "\n");
    await writeFile(join(root, "data/derived/research-scan.json"), JSON.stringify(scan, null, 1) + "\n");
    await writeFile(join(root, "data/derived/research-scan.md"), renderDigest(scan));
  }
  return { doc, scan, state: nextState };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { doc, scan } = await runFlagger();
  console.log(JSON.stringify({ flags: doc.flags.length, newTonight: doc.newTonight, ...doc.summary, newsLeads: scan.newsLeads.length, radarLeads: scan.radarLeads.length }));
}
