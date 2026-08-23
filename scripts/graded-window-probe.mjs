// graded-window-probe.mjs — settle whether the graded aggregate is windowed.
//
// PPT gives us ebaySold.psa8/9/10 with count, median, min and max, and no
// window. That is why every graded figure was withdrawn on 2026-08-23: a median
// over an unknown period is a historical average wearing a price's clothes.
//
// THE TEST IS ARITHMETIC, NOT OPINION. An all-time aggregate can only GROW.
// If any count DROPS between snapshots, sales are ageing out of a window, the
// window is rolling, and the medians are current — which unblocks RT-5 and the
// submission decision together.
//
// COMPARE BY CARD ID, NEVER BY POSITION. The previous attempt nearly concluded
// the window WAS rolling by comparing two snapshots that turned out to hold
// different cards in different order. That is recorded here because it is the
// easiest mistake to repeat.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv, requireKey } from "./lib/load-env.mjs";

loadEnv();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://www.pokemonpricetracker.com/api/v2";
const PROBE = join(ROOT, "data/graded-window-probe.json");

// Our slugs are not the provider's ids — the same namespace split that cost
// 9,114 credits on sets — and the catalogue carries no tcgPlayerId either. So
// resolve the way enrichment already does: search within the set by name, then
// match on the printed card NUMBER, which is what disambiguates variants.
// Numbers are padded differently between catalogues ("215" vs "215/203"), so
// compare on the leading digits only.
const numKey = n => String(n ?? "").split("/")[0].replace(/^0+/, "").toUpperCase();

async function snapshot(slugs, key) {
  const cat = JSON.parse(await readFile(join(ROOT, "data/card-catalogue.json"), "utf-8"));
  const rows = [];
  for (const slug of slugs) {
    const ours = cat.cards?.[slug];
    if (!ours) { rows.push({ id: slug, error: "not in catalogue" }); continue; }
    try {
      const u = `${BASE}/cards?setName=${encodeURIComponent(ours.setName)}`
        + `&search=${encodeURIComponent(ours.name)}&includeEbay=true&limit=10`;
      let r = await fetch(u, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(25000) });
      // A 429 is the provider asking us to wait, not an answer. Back off and
      // retry twice before giving up; a concurrent daily run is the usual cause.
      if (r.status === 429) {
        let ok = null;
        for (const wait of [8000, 20000]) {
          await new Promise(z => setTimeout(z, wait));
          const again = await fetch(u, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(25000) });
          if (again.ok) { ok = again; break; }
        }
        if (!ok) { rows.push({ id: slug, error: "HTTP 429 after 2 retries — provider busy, result VOID not negative" }); continue; }
        r = ok;
      }
      if (!r.ok) { rows.push({ id: slug, error: `HTTP ${r.status}` }); continue; }
      const body = (await r.json()).data;
      const list = Array.isArray(body) ? body : [body].filter(Boolean);
      const c = list.find(x => numKey(x?.cardNumber) === numKey(ours.number)) ?? null;
      if (!c) { rows.push({ id: slug, error: `no number match among ${list.length}` }); continue; }
      const g = c?.ebay?.salesByGrade ?? {};
      rows.push({ id: slug, name: c?.name ?? null,
        psa10: g.psa10?.count ?? null, psa9: g.psa9?.count ?? null,
        psa10Median: g.psa10?.medianPrice ?? null,
        dateRangeStart: c?.ebay?.dateRangeStart ?? null,
        dateRangeEnd: c?.ebay?.dateRangeEnd ?? null,
        totalSales: c?.ebay?.totalSales ?? null });
    } catch (e) { rows.push({ id: slug, error: e.message.slice(0, 60) }); }
    await new Promise(r => setTimeout(r, 1200));
  }
  return rows;
}

export function compare(baseline, now) {
  const byId = new Map(now.map(r => [r.id, r]));
  const moves = [];
  for (const b of baseline) {
    const n = byId.get(b.id);                     // BY ID. Never by position.
    if (!n || n.error || b.psa10 == null || n.psa10 == null) continue;
    moves.push({ id: b.id, name: b.name ?? n.name,
      psa10: { was: b.psa10, now: n.psa10, delta: n.psa10 - b.psa10 },
      psa9: { was: b.psa9, now: n.psa9, delta: (n.psa9 ?? 0) - (b.psa9 ?? 0) } });
  }
  const dropped = moves.filter(m => m.psa10.delta < 0 || m.psa9.delta < 0);
  // NO COMPARISONS IS NOT "NO DROP". On 2026-08-23 a concurrent daily run
  // rate-limited this probe: 11 of 12 cards returned HTTP 429, nothing was
  // compared, and it still printed "consistent with an all-time aggregate".
  // That is a conclusion drawn from no data — the same shape as an alarm
  // reporting silence as health. It must refuse instead.
  if (!moves.length) return { compared: 0, moves, dropped: [],
    verdict: "VOID — nothing resolved to a provider row, so nothing was compared. This is not evidence either way; re-run when no other job is calling the provider." };
  return { compared: moves.length, moves, dropped,
    verdict: dropped.length ? "ROLLING — a count fell, so sales age out of a window"
      : "NO DROP — consistent with an all-time aggregate (not proof; absence of growth is not absence of a window)" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const key = requireKey("POKEMONPRICETRACKER_API_KEY");
  const probe = JSON.parse(await readFile(PROBE, "utf-8"));
  const now = await snapshot(probe.cards.map(c => c.id), key);
  const res = compare(probe.cards, now);
  for (const m of res.moves)
    console.log(`  ${String(m.psa10.delta >= 0 ? "+" : "") + m.psa10.delta} psa10 · ${String(m.psa9.delta >= 0 ? "+" : "") + m.psa9.delta} psa9  ${m.name ?? m.id}`);
  console.log(`\n${res.verdict}`);
  probe.snapshots = [...(probe.snapshots ?? []), { takenAt: new Date().toISOString(), cards: now }];
  probe.lastComparison = { at: new Date().toISOString(), compared: res.compared, dropped: res.dropped.length, verdict: res.verdict };
  await writeFile(PROBE, JSON.stringify(probe, null, 1) + "\n");
  console.log(`recorded snapshot ${probe.snapshots.length} in data/graded-window-probe.json`);
}
