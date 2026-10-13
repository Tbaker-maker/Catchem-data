// Rescore TCG Card Investor calls with Catch'em's method (7/30/90, 3% band,
// market-relative, stated horizon). Pure helpers. Private source tag: tcgci-derived.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { HORIZONS, priceAtHorizon, addDays } from "./self-check.mjs";
import { BAND, bandResult, scoreClaims, rankClaims, creatorWeights, statedHorizon } from "./youtube.mjs";
import { theirVerdict, mapChannel, directionOf, THEIR_FLAT_BAND_PCT } from "./tcgci.mjs";

export const TCGCI_SOURCE = "tcgci-derived";
export { BAND, HORIZONS };

const META = new Set(["mapping.json", "unmatched.json", "coverage.json", "manifest.json"]);

// Price book keyed by TCGplayer product id. Layers (later only fill gaps):
//   1. data/history/tcgcsv-daily/*.json
//   2. data/history/tcgplayer-market/*.json (by tcgplayerProductId)
//   3. data/history/ppt-sealed-private/ then ppt-sealed/ (long sealed archive)
export async function loadLongHistoryPriceBook(root, { sealedDirs = null } = {}) {
  const book = new Map(); // pid -> Map(day -> market)
  const put = (pid, day, market, { overwrite = false } = {}) => {
    const id = Number(pid);
    const v = Number(market);
    if (!(id > 0) || !(v > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    let m = book.get(id);
    if (!m) book.set(id, (m = new Map()));
    if (overwrite || !m.has(day)) m.set(day, v);
  };

  // Daily TCGCSV snapshots (newest layer for overlapping days — write first with overwrite later)
  try {
    for (const f of (await readdir(join(root, "data/history/tcgcsv-daily"))).sort()) {
      if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
      const day = f.slice(0, 10);
      const doc = JSON.parse(await readFile(join(root, "data/history/tcgcsv-daily", f), "utf8"));
      for (const r of doc.prices || []) put(r.id, day, r.market);
    }
  } catch {}

  // Live sealed series
  try {
    for (const f of await readdir(join(root, "data/history/tcgplayer-market"))) {
      if (!f.endsWith(".json") || META.has(f)) continue;
      const doc = JSON.parse(await readFile(join(root, "data/history/tcgplayer-market", f), "utf8"));
      const pid = doc.tcgplayerProductId;
      for (const p of doc.points || []) put(pid, p.date, p.market);
    }
  } catch {}

  // Long sealed archive (fill gaps only — daily/TCGCSV already win on overlap)
  const dirs = sealedDirs || ["data/history/ppt-sealed-private", "data/history/ppt-sealed"];
  for (const dir of dirs) {
    let names = [];
    try { names = await readdir(join(root, dir)); } catch { continue; }
    for (const f of names) {
      if (!f.endsWith(".json") || META.has(f)) continue;
      try {
        const doc = JSON.parse(await readFile(join(root, dir, f), "utf8"));
        const pid = doc.tcgplayerProductId;
        for (const p of doc.points || []) put(pid, p.date, p.market, { overwrite: false });
      } catch {}
    }
  }

  const cache = new Map();
  const marketChange = (d1, d2) => {
    const k = `${d1}|${d2}`;
    if (cache.has(k)) return cache.get(k);
    const ch = [];
    for (const m of book.values()) {
      const a = m.get(d1), b = m.get(d2);
      if (a > 0 && b > 0) ch.push(b / a - 1);
    }
    ch.sort((x, y) => x - y);
    const v = ch.length ? (ch.length % 2 ? ch[ch.length >> 1] : (ch[(ch.length >> 1) - 1] + ch[ch.length >> 1]) / 2) : null;
    cache.set(k, v);
    return v;
  };
  return {
    size: book.size,
    priceOn: (pid, day) => book.get(Number(pid))?.get(day) ?? null,
    marketChange,
  };
}

export function mapHorizon(rawHorizon, text) {
  const h = String(rawHorizon || "").toLowerCase();
  if (h === "long") return "long";
  if (h === "short") return 7;
  return statedHorizon(text) ?? null;
}

export function ourVerdictFromH(h, { hold = false } = {}) {
  if (!h || h.chg == null) return null;
  if (hold) {
    // Hold under our band: miss if it fell 3%+ or lagged the market by 3%+; flat if quiet; else hit.
    if (h.chg < -BAND) return "wrong";
    if (h.excess != null && h.excess < -BAND) return "wrong";
    if (Math.abs(h.chg) < BAND) return "flat";
    return "right";
  }
  if (h.result === "flat") return "flat";
  if (h.result === "hit" || h.held === true) return "right";
  if (h.result === "miss" || h.held === false) return "wrong";
  return null;
}

// Turn a normalized TCGCI call into a claim-shaped row for scoreClaims, or null if unmappable.
export function toClaim(call) {
  const pid = call.productId ?? call.price?.product_id;
  if (pid == null) return null;
  const channel = call.channelKey || mapChannel(call.channel);
  if (!channel) return null;
  const rating = String(call.rating || "").toLowerCase();
  const dir = directionOf(rating);
  if (dir == null && rating !== "hold") return null;
  const hold = rating === "hold";
  const text = call.text || "";
  const horizon = mapHorizon(call.horizon, text);
  const kind = String(call.kind || "").toLowerCase();
  const target = kind === "single" || kind === "singles" ? "card" : "sealed";
  return {
    id: `tcgci:${call.id}`,
    source: TCGCI_SOURCE,
    tcgciId: call.id,
    videoId: call.videoId || call.video_id || null,
    channel,
    date: call.issued,
    dir: hold ? 1 : dir, // placeholder for ledger price fill; hold re-banded after
    hold,
    rating,
    horizon,
    target,
    pid: Number(pid),
    confidence: 0.9,
    item: call.item || call.product || null,
    set: call.set || null,
    theirVerdict: call.theirVerdict || theirVerdict({
      rating,
      price: {
        product_id: pid,
        at_call: call.atCall ?? call.price?.at_call,
        at_30d: call.at30d ?? call.price?.at_30d,
      },
    }),
    topicHints: topicHints(call),
  };
}

function topicHints(call) {
  const out = [];
  const kind = String(call.kind || "").toLowerCase();
  if (kind === "sealed") out.push("sealed");
  if (kind === "single" || kind === "singles") out.push("singles");
  if (kind === "slab") out.push("grading");
  const item = `${call.item || ""} ${call.product || ""} ${call.set || ""}`;
  if (/\b(etb|elite trainer)\b/i.test(item)) out.push("etb");
  if (/\b(booster box|bb)\b/i.test(item)) out.push("booster_box");
  if (/\b(upc|ultra premium)\b/i.test(item)) out.push("upc");
  if (/\b(reprint|print run)\b/i.test(call.text || "")) out.push("print_run");
  return out;
}

export function applyHoldBands(claims) {
  for (const c of claims) {
    if (!c.hold) continue;
    for (const h of HORIZONS) {
      const x = c[`h${h}`];
      if (!x || x.chg == null) continue;
      const v = ourVerdictFromH(x, { hold: true });
      x.heldAbs = x.chg >= 0;
      x.result = v === "right" ? "hit" : v === "wrong" ? "miss" : v === "flat" ? "flat" : null;
      x.held = x.result === "hit";
    }
  }
  return claims;
}

export function rescoreCalls(calls, { priceOn, marketChange, today }) {
  const claims = [];
  let skipped = { noPid: 0, noChannel: 0, noDir: 0 };
  for (const raw of calls) {
    const c = toClaim(raw);
    if (!c) {
      if ((raw.productId ?? raw.price?.product_id) == null) skipped.noPid++;
      else if (!(raw.channelKey || mapChannel(raw.channel))) skipped.noChannel++;
      else skipped.noDir++;
      continue;
    }
    claims.push(c);
  }
  scoreClaims(claims, { priceOn, marketChange, pidsBySet: new Map(), today });
  applyHoldBands(claims);
  // Attach our 30d verdict for comparison with theirs
  for (const c of claims) {
    c.ourVerdict30 = ourVerdictFromH(c.h30, { hold: c.hold });
    c.ourVerdict7 = ourVerdictFromH(c.h7, { hold: c.hold });
    c.ourVerdict90 = ourVerdictFromH(c.h90, { hold: c.hold });
  }
  return { claims, skipped };
}

export function compareMethods(claims) {
  const rows = [];
  for (const c of claims) {
    const theirs = c.theirVerdict;
    const ours = c.ourVerdict30;
    if (!theirs || theirs === "pending" || theirs === "unscored" || !ours) continue;
    rows.push({
      id: c.tcgciId,
      channel: c.channel,
      rating: c.rating,
      issued: c.date,
      pid: c.pid,
      theirs,
      ours,
      agree: theirs === ours,
      ourChg: c.h30?.chg ?? null,
      ourExcess: c.h30?.excess ?? null,
    });
  }
  const agree = rows.filter((r) => r.agree).length;
  return {
    compared: rows.length,
    agree,
    disagree: rows.length - agree,
    agreePct: rows.length ? Math.round((100 * agree) / rows.length) : null,
    rows,
  };
}

export function buildScorecards(claims, compare) {
  const videoTopics = new Map();
  for (const c of claims) videoTopics.set(c.videoId || c.id, c.topicHints || []);
  const ranking = rankClaims(claims, videoTopics);
  const weights = creatorWeights(ranking);

  // Per-creator: our hit rates vs their ±5% rates (on the compared 30d subset).
  const byCh = new Map();
  for (const c of claims) {
    const cur = byCh.get(c.channel) || {
      channel: c.channel, source: TCGCI_SOURCE,
      claims: 0, scored7: 0, held7: 0, scored30: 0, held30: 0, scored90: 0, held90: 0,
      theirScored: 0, theirRight: 0, theirWrong: 0, theirFlat: 0,
      compared: 0, agree: 0, byTopic: {},
    };
    cur.claims++;
    for (const h of HORIZONS) {
      const x = c[`h${h}`];
      if (x && x.held != null) {
        cur[`scored${h}`]++;
        if (x.held) cur[`held${h}`]++;
      }
    }
    if (["right", "wrong", "flat"].includes(c.theirVerdict)) {
      cur.theirScored++;
      if (c.theirVerdict === "right") cur.theirRight++;
      if (c.theirVerdict === "wrong") cur.theirWrong++;
      if (c.theirVerdict === "flat") cur.theirFlat++;
    }
    for (const t of c.topicHints || []) {
      const tt = cur.byTopic[t] || { scored30: 0, held30: 0 };
      if (c.h30 && c.h30.held != null) {
        tt.scored30++;
        if (c.h30.held) tt.held30++;
      }
      cur.byTopic[t] = tt;
    }
    byCh.set(c.channel, cur);
  }
  for (const r of compare.rows || []) {
    const cur = byCh.get(r.channel);
    if (!cur) continue;
    cur.compared++;
    if (r.agree) cur.agree++;
  }

  const creators = [...byCh.values()].map((c) => ({
    ...c,
    heldPct7: c.scored7 ? Math.round((100 * c.held7) / c.scored7) : null,
    heldPct30: c.scored30 ? Math.round((100 * c.held30) / c.scored30) : null,
    heldPct90: c.scored90 ? Math.round((100 * c.held90) / c.scored90) : null,
    theirHitPct: c.theirScored ? Math.round((100 * c.theirRight) / c.theirScored) : null,
    agreePct: c.compared ? Math.round((100 * c.agree) / c.compared) : null,
    byTopic: Object.fromEntries(Object.entries(c.byTopic).map(([t, v]) => [t, {
      ...v,
      heldPct30: v.scored30 ? Math.round((100 * v.held30) / v.scored30) : null,
    }])),
    weight: weights[c.channel] || { weight: 1, basis: "neutral", scored: 0 },
  })).sort((a, b) => (b.scored30 - a.scored30) || (b.heldPct30 ?? -1) - (a.heldPct30 ?? -1));

  return {
    source: TCGCI_SOURCE,
    theirBandPct: THEIR_FLAT_BAND_PCT,
    ourBand: BAND,
    ranking,
    creators,
    weights,
  };
}

export function summarizeRescore({ claims, skipped, compare, scorecards, today, priceBookSize }) {
  const scored30 = claims.filter((c) => c.ourVerdict30).length;
  const strongest = scorecards.creators.filter((c) => c.scored30 >= 10).slice().sort((a, b) => (b.heldPct30 ?? -1) - (a.heldPct30 ?? -1)).slice(0, 5);
  const weakest = scorecards.creators.filter((c) => c.scored30 >= 10).slice().sort((a, b) => (a.heldPct30 ?? 99) - (b.heldPct30 ?? 99)).slice(0, 5);
  const topicRows = [];
  for (const c of scorecards.creators) {
    for (const [t, v] of Object.entries(c.byTopic || {})) {
      if (v.scored30 >= 5) topicRows.push({ channel: c.channel, topic: t, ...v });
    }
  }
  topicRows.sort((a, b) => (b.heldPct30 ?? -1) - (a.heldPct30 ?? -1));
  return {
    asOf: today,
    source: TCGCI_SOURCE,
    private: true,
    priceBookSize,
    claimsMapped: claims.length,
    skipped,
    scored30,
    compare: {
      compared: compare.compared,
      agree: compare.agree,
      disagree: compare.disagree,
      agreePct: compare.agreePct,
    },
    strongest: strongest.map((c) => ({ channel: c.channel, heldPct30: c.heldPct30, scored30: c.scored30, theirHitPct: c.theirHitPct, agreePct: c.agreePct })),
    weakest: weakest.map((c) => ({ channel: c.channel, heldPct30: c.heldPct30, scored30: c.scored30, theirHitPct: c.theirHitPct, agreePct: c.agreePct })),
    topTopics: topicRows.slice(0, 12),
    weakTopics: topicRows.slice().sort((a, b) => (a.heldPct30 ?? 99) - (b.heldPct30 ?? 99)).slice(0, 12),
  };
}
