// Gem watch research rows. Quiet patterns are not registered in the scanner
// engine while reads.gemWatch is false. A missing limits object means no row.
// Peer-lag is retired: it returns no row.

import { readFile } from "node:fs/promises";
import { daysBetween } from "./scanner/common.mjs";
import * as quietClimb from "./scanner/patterns/quiet-climb.mjs";
import * as quietHigh from "./scanner/patterns/quiet-high.mjs";

export const POKEVIZ_BRIDGE = { start: "2026-09-16", end: "2026-09-25" };
const BANNED = /\b(buy|will|breakout|undervalued|hidden gem)\b/i;

export function copyOk(text) {
  return !BANNED.test(String(text || ""));
}

export async function loadLimits(path) {
  if (!path) return null;
  try {
    const doc = JSON.parse(await readFile(path, "utf8"));
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
    return doc;
  } catch {
    return null;
  }
}

export function peerBlock(card, limits) {
  const peers = card?.peers || [];
  if (peers.length < limits.peerMin) return "peers";
  const printing = card.printing || "";
  if (peers.some((p) => (p.printing || "") !== printing)) return "printing";
  return null;
}

function tooSoon(card, pattern, prior, limits, asOf) {
  return (prior || []).some((p) => p.id === card.id && p.pattern === pattern && daysBetween(p.date, asOf) >= 0 && daysBetween(p.date, asOf) < limits.episodeGapDays);
}

export function factLine({ name, pattern, price, asOf, peerN }) {
  const label = pattern === "quiet-high" ? "Quiet high" : "Quiet climb";
  return `${label}: ${name} at $${price} on ${asOf} (TCGplayer market). Same printing peers counted: ${peerN}. Source: TCGplayer market, ${asOf}.`;
}

export function gemRows({ cards = [], limits, asOf, prior = [] } = {}) {
  if (!limits || !asOf) return [];
  const out = [];
  for (const card of cards) {
    if (peerBlock(card, limits)) continue;
    for (const mod of [quietClimb, quietHigh]) {
      if (tooSoon(card, mod.id, prior, limits, asOf)) continue;
      const hit = mod.detect(card.points || [], limits, asOf);
      if (!hit) continue;
      const line = factLine({ name: card.name, pattern: mod.id, price: hit.price, asOf, peerN: (card.peers || []).length });
      if (!copyOk(line)) continue;
      out.push({
        id: card.id,
        name: card.name,
        pattern: mod.id,
        asOf,
        price: hit.price,
        printing: card.printing || "",
        peerN: (card.peers || []).length,
        source: "TCGplayer market",
        sourceDate: asOf,
        line,
      });
    }
  }
  return out;
}

export function publicGemRows(args, flagOn = false) {
  if (flagOn !== true) return [];
  return gemRows(args);
}

export function peerLagRow() {
  return null;
}

export function sealedAgeRow(product, cohort, limits, asOf) {
  if (!limits || !product || !asOf) return null;
  const isPc = (row) => row?.pokemonCenter === true || /pokemon center/i.test(row?.name || "");
  const pc = isPc(product);
  const peers = (cohort || []).filter((p) => p && p.id !== product.id && p.type === product.type && isPc(p) === pc && p.price > 0);
  if (peers.length < limits.peerMin) return null;
  const prices = peers.map((p) => p.price).sort((a, b) => a - b);
  const mid = prices.length >> 1;
  const med = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  if (!(product.price < med)) return null;
  const cohortName = pc ? "Pokemon Center ETB" : "standard ETB";
  const line = `${product.name} at $${product.price} on ${asOf} (TCGplayer market), below the ${cohortName} median of $${med} across ${peers.length}. Source: TCGplayer market, ${asOf}.`;
  if (!copyOk(line)) return null;
  return { id: product.id, pattern: "sealed-age", pokemonCenter: pc, asOf, price: product.price, median: med, peerN: peers.length, source: "TCGplayer market", sourceDate: asOf, line };
}

export function joinPokevizBridge(own = [], bridge = []) {
  const by = new Map();
  for (const p of own) {
    if (!p?.date || !(p.price > 0)) continue;
    by.set(p.date, { date: p.date, price: p.price, source: p.source || "tcgplayer" });
  }
  for (const p of bridge) {
    if (!p?.date || !(p.price > 0)) continue;
    if (p.date < POKEVIZ_BRIDGE.start || p.date > POKEVIZ_BRIDGE.end) continue;
    if (!by.has(p.date)) by.set(p.date, { date: p.date, price: p.price, source: "pokeviz" });
  }
  return [...by.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
