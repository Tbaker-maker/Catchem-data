// scripts/fetch-singles-prices.mjs
// Catch'em singles price layer — pokemontcg.io v2 (TCGplayer market prices).
// Phase 1: pulls sets index → writes data/set-ids-verified.json (finally
//          verifies real Mega-era setIds from the source).
// Phase 2: resolves data/singles-watchlist.json queries → writes
//          data/singles-prices.json with per-printing prices + history.
//
// TRUST STANDARD gates:
//  - Provenance on every price: "TCGplayer market via pokemontcg.io" + their
//    updatedAt. Stale (>3 days) or missing market price → dataStatus "stale"
//    / "unavailable" — newsletter may NOT cite those.
//  - First-time resolutions get needsReview:true — a human confirms the
//    printing is the intended chase before it's citable.
//  - Supply/demand claims remain SEALED-ONLY (this source has no supply data).
// Optional: POKEMONTCG_API_KEY env raises rate limits. English cards only.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Node's fetch has NO default timeout: a host that accepts the connection
// and never answers hangs this script until the CI runner kills the job.
// A hung job is worse than a failed one — nothing goes red, the whole
// allowance burns and no guard reports. Every call below is bounded.
const FETCH_TIMEOUT_MS = 20000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(dirname(__dirname), "data");
const API = "https://api.pokemontcg.io/v2";
const HEADERS = process.env.POKEMONTCG_API_KEY ? { "X-Api-Key": process.env.POKEMONTCG_API_KEY } : {};
const STALE_DAYS = 3;
const today = new Date().toISOString().split("T")[0];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Retry transient failures (5xx/429) with backoff before giving up.
// Evidence (2026-08-18, keyless): pokemontcg.io 500s hit ~1/3 of queries per
// run at random; the same two watchlist queries failed 4 consecutive runs on
// single-shot fetches. One 500 must not fail a whole query.
const RETRIES = 3;
const BACKOFF_MS = [2000, 8000, 20000];

async function getJSON(url) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1]);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: HEADERS });
      if (res.ok) return res.json();
      lastErr = new Error(`${res.status} ${url.slice(0, 90)}`);
      if (res.status < 500 && res.status !== 429) throw lastErr; // non-transient: don't retry
    } catch (e) {
      lastErr = e; // network errors also retry
    }
  }
  throw lastErr;
}

async function phase1_sets() {
  console.log("Phase 1: sets index…");
  const all = [];
  for (let page = 1; page <= 4; page++) {
    const d = await getJSON(`${API}/sets?page=${page}&pageSize=250&orderBy=releaseDate`);
    all.push(...(d.data || []));
    if ((d.data || []).length < 250) break;
    await sleep(300);
  }
  const recent = all.filter(s => (s.releaseDate || "") >= "2025/01/01")
    .map(s => ({ id: s.id, name: s.name, series: s.series, releaseDate: s.releaseDate }));
  await writeFile(join(DATA, "set-ids-verified.json"),
    JSON.stringify({ verifiedAt: new Date().toISOString(), source: "pokemontcg.io /v2/sets",
      note: "Authoritative setIds. Use these to correct pc-etb-skus + any me1..me5 guesses.",
      totalSets: all.length, from2025: recent }, null, 2) + "\n");
  console.log(`  ✓ ${all.length} sets; ${recent.length} from 2025+ → data/set-ids-verified.json`);
  for (const s of recent) console.log(`    ${s.id.padEnd(12)} ${s.releaseDate}  ${s.name}`);
}

async function phase2_singles() {
  console.log("Phase 2: watchlist…");
  const wl = JSON.parse(await readFile(join(DATA, "singles-watchlist.json"), "utf-8"));
  let prev = { cards: [] };
  try { prev = JSON.parse(await readFile(join(DATA, "singles-prices.json"), "utf-8")); } catch {}
  const prevById = new Map(prev.cards.map(c => [c.cardId, c]));
  const out = [];
  for (const entry of wl.cards) {
    await sleep(350);
    try {
      const d = await getJSON(`${API}/cards?q=${encodeURIComponent(entry.q)}&pageSize=20&select=id,name,number,rarity,set,tcgplayer,cardmarket`);
      for (const c of d.data || []) {
        const variants = c.tcgplayer?.prices || {};
        const vKey = Object.keys(variants).find(k => variants[k]?.market != null);
        const market = vKey ? variants[vKey].market : null;
        const tUpdated = c.tcgplayer?.updatedAt || null; // "YYYY/MM/DD"
        const fresh = tUpdated && ((Date.now() - new Date(tUpdated.replaceAll("/", "-"))) / 86400000) <= STALE_DAYS;
        const prevC = prevById.get(c.id);
        const hist = prevC?.priceHistory ? [...prevC.priceHistory] : [];
        if (market != null && fresh) {
          const last = hist[hist.length - 1];
          if (last?.date === today) last.price = market; else hist.push({ date: today, price: market });
          while (hist.length > 120) hist.shift();
        }
        out.push({
          watchLabel: entry.label, cardId: c.id, name: c.name, number: c.number,
          rarity: c.rarity || null, setId: c.set?.id, setName: c.set?.name,
          priceMarket: market, priceVariant: vKey || null,
          provenance: `TCGplayer market via pokemontcg.io, updated ${tUpdated || "unknown"}`,
          dataStatus: market == null ? "unavailable" : fresh ? "live" : "stale",
          // Cardmarket (EU) layer — added Aug 18, $0 (same API call). EUR prices,
          // different market semantics. STORED ONLY: not citable until reviewed
          // and FX/market-framing decided (Trust Standard: separate provenance).
          cmTrendEur: c.cardmarket?.prices?.trendPrice ?? null,
          cmAvg7Eur: c.cardmarket?.prices?.avg7 ?? null,
          cmAvg30Eur: c.cardmarket?.prices?.avg30 ?? null,
          cmUpdatedAt: c.cardmarket?.updatedAt || null,
          needsReview: prevC ? (prevC.needsReview ?? false) : true,
          priceHistory: hist,
        });
      }
      if (!(d.data || []).length) out.push({ watchLabel: entry.label, dataStatus: "no-match", needsReview: true, note: "query returned nothing — verify set name/card name" });
    } catch (e) {
      // Carry previously-resolved rows forward instead of overwriting them with
      // an error stub. Evidence (2026-08-18 first runs, keyless): pokemontcg.io
      // 500s hit ~1/3 of queries per run at random, and each run rewrites the
      // file wholesale — run 3 lost the Giratina/Umbreon/Espeon resolutions
      // that run 1 had. Carried rows keep their old data but are marked stale
      // so the citation gate (live-only) still excludes them until refreshed.
      const carried = prev.cards.filter(c => c.watchLabel === entry.label && c.cardId);
      if (carried.length) {
        for (const c of carried) out.push({ ...c, dataStatus: c.dataStatus === "live" ? "stale" : c.dataStatus, note: `refresh failed ${today}: ${e.message.slice(0, 60)} — carried from previous run` });
      } else {
        out.push({ watchLabel: entry.label, dataStatus: "error", note: e.message.slice(0, 120) });
      }
    }
  }
  const live = out.filter(c => c.dataStatus === "live").length;
  await writeFile(join(DATA, "singles-prices.json"), JSON.stringify({
    updatedAt: new Date().toISOString(), source: "pokemontcg.io v2 (TCGplayer market)",
    citationRule: "Newsletter/content may cite ONLY dataStatus:live entries with needsReview:false. Supply/demand claims remain sealed-only.",
    counts: { printings: out.length, live, stale: out.filter(c=>c.dataStatus==="stale").length,
              needsReview: out.filter(c=>c.needsReview).length },
    cards: out }, null, 2) + "\n");
  console.log(`  ✓ ${out.length} printings (${live} live) → data/singles-prices.json`);
  console.log("  ⚠ First run: everything needsReview — human confirms intended printings before citing.");
}

(async () => { await phase1_sets(); await phase2_singles(); })().catch(e => { console.error("Fatal:", e); process.exit(1); });
