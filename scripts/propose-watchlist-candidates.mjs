// scripts/propose-watchlist-candidates.mjs — Wave A candidate generator ($0)
// Per research/expansion-waves.md: for each modern set (swsh1 → me5), pull
// top-N cards by TCGplayer market via pokemontcg.io (keyless, retry/backoff
// pattern from fetch-singles-prices.mjs) and emit
// research/watchlist-candidates.md grouped by set.
// PROPOSES ONLY — no watchlist changes; Tyler curates with collector
// judgment ("the data proposes, Tyler disposes").

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const API = "https://api.pokemontcg.io/v2";
const HEADERS = process.env.POKEMONTCG_API_KEY ? { "X-Api-Key": process.env.POKEMONTCG_API_KEY } : {};
const N = 8;
const MODERN_FROM = "2020/02/07"; // Sword & Shield base
const MODERN_TO = "2026/07/18";   // through Pitch Black (me5)
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url) {
  let lastErr;
  for (let a = 0; a <= 3; a++) {
    if (a > 0) await sleep([2000, 8000, 20000][a - 1]);
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok) return res.json();
      lastErr = new Error(`${res.status}`);
      if (res.status < 500 && res.status !== 429) throw lastErr;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const bestMarket = c => {
  const v = c.tcgplayer?.prices || {};
  let best = null;
  for (const k of Object.keys(v)) if (v[k]?.market != null && (best == null || v[k].market > best)) best = v[k].market;
  return best;
};

async function main() {
  // watched printings (any resolution, confirmed or pending) → flag
  let watched = new Set();
  try {
    const sp = JSON.parse(await readFile(join(ROOT, "data", "singles-prices.json"), "utf-8"));
    watched = new Set(sp.cards.filter(c => c.cardId).map(c => c.cardId));
  } catch {}

  console.log("sets index…");
  const all = [];
  for (let page = 1; page <= 4; page++) {
    const d = await getJSON(`${API}/sets?page=${page}&pageSize=250&orderBy=releaseDate`);
    all.push(...(d.data || []));
    if ((d.data || []).length < 250) break;
    await sleep(300);
  }
  const modern = all.filter(s =>
    s.releaseDate >= MODERN_FROM && s.releaseDate <= MODERN_TO &&
    !/promo|mcdonald|pop series|trick or trade/i.test(s.name) && !/p$/.test(s.id));
  console.log(`${modern.length} modern sets in window`);

  const sections = [];
  for (const s of modern) {
    await sleep(400);
    const cards = [];
    try {
      for (let page = 1; page <= 2; page++) {
        const d = await getJSON(`${API}/cards?q=${encodeURIComponent(`set.id:${s.id}`)}&select=id,name,number,rarity,tcgplayer&pageSize=250&page=${page}`);
        cards.push(...(d.data || []));
        if ((d.data || []).length < 250) break;
        await sleep(400);
      }
    } catch (e) {
      sections.push({ set: s, error: e.message });
      console.log(`  ${s.id.padEnd(12)} ERROR ${e.message}`);
      continue;
    }
    const ranked = cards
      .map(c => ({ ...c, _market: bestMarket(c) }))
      .filter(c => c._market != null)
      .sort((a, b) => b._market - a._market)
      .slice(0, N);
    sections.push({ set: s, ranked });
    console.log(`  ${s.id.padEnd(12)} ${s.name.padEnd(28)} top: ${ranked[0] ? `$${ranked[0]._market} ${ranked[0].name}` : "no priced cards"}`);
  }

  const lines = [
    "# Watchlist Candidates — Wave A (auto-generated, Tyler curates)",
    "",
    `Generated ${new Date().toISOString()} by scripts/propose-watchlist-candidates.mjs.`,
    `Top ${N} per modern set by TCGplayer market (via pokemontcg.io, keyless).`,
    "PROPOSAL ONLY — nothing here is watched until Tyler picks it and it passes",
    "the standard needsReview flow. ✔ = a printing already on the watchlist.",
    "",
  ];
  for (const sec of sections) {
    lines.push(`## ${sec.set.name} (${sec.set.id}, ${sec.set.releaseDate})`);
    if (sec.error) { lines.push(`- ERROR fetching: ${sec.error}`, ""); continue; }
    if (!sec.ranked.length) { lines.push("- no priced cards", ""); continue; }
    for (const c of sec.ranked) {
      lines.push(`- ${watched.has(c.id) ? "✔ " : ""}$${c._market.toFixed(2).padStart(9)} — ${c.name} #${c.number} · ${c.rarity || "?"} · \`${c.id}\``);
    }
    lines.push("");
  }
  await writeFile(join(ROOT, "research", "watchlist-candidates.md"), lines.join("\n") + "\n");
  console.log(`✓ research/watchlist-candidates.md (${sections.length} sets)`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
