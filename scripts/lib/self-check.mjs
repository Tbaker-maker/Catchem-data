// Self-check: did past reads and Card Rating verdicts hold after 7, 30 and 90 days?
// Pure functions. The runner (scripts/self-check.mjs) loads files and writes the
// private ledger and scores. Prices are TCGplayer market from the daily files,
// never from a headline. A horizon with no price inside its window is not scored.

export const HORIZONS = [7, 30, 90];
// Price days have gaps. A horizon scores on day h, else the first priced day up to h+3.
export const HORIZON_SLACK = 3;
export const MIN_SCORED = 20;
// Direction band for the market-relative read score: |change| must clear it.
export const BAND = 0.03; // below this a rate is reported as null, not a number

export function addDays(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

const pidOf = (sku) => {
  const m = /^tcgcsv-(\d+)$/.exec(String(sku || ""));
  return m ? Number(m[1]) : 0;
};
// Older boards (before Oct 2026) carry no sku; the product is in href or id.
export const readPid = (r) => pidOf(r?.sku) || Number(/\/c\/tcgcsv-(\d+)$/.exec(String(r?.href || ""))?.[1] || 0) || Number(/tcgcsv-(\d+)$/.exec(String(r?.id || ""))?.[1] || 0);

function signOfReceipt(rc) {
  if (!rc || typeof rc !== "object") return 0;
  const from = Number(rc.from ?? rc.then), to = Number(rc.to ?? rc.now?.price ?? rc.now);
  if (from > 0 && to > 0 && from !== to) return to > from ? 1 : -1;
  return 0;
}

function signOfHeadline(h) {
  const s = String(h || "");
  if (/\bUp \d+ days in a row|\bUp \d+%/.test(s)) return 1;
  if (/\bDown \d+ days in a row|\bDown \d+%/.test(s)) return -1;
  return 0;
}

// What a read claims, as a direction on one product. 0 means not scored.
export function claimOf(read) {
  const kind = String(read?.readKind || read?.kind || "");
  const take = String(read?.take || "");
  if (take === "up") return 1;
  if (["dip", "avoid", "stretched"].includes(take)) return -1;
  if (kind === "high") return 1;
  if (kind === "low") return -1;
  if (["year", "plain", "single", "sealed", "streak"].includes(kind)) {
    const s = signOfReceipt(read.receipt) || signOfHeadline(read.headline);
    if (s) return s;
  }
  if (kind === "climb") return 1;
  // Older boards: type heating/cooling with a changePct.
  const type = String(read?.type || "");
  if (/heating|rising|climb/.test(type)) return 1;
  if (/cooling|falling|slide/.test(type)) return -1;
  const pct = Number(read?.changePct);
  if (kind === "single" && Number.isFinite(pct) && pct !== 0) return pct > 0 ? 1 : -1;
  return 0;
}

// One night's ledger rows. Reads: one row per scoreable read. Rating: one row per
// card with a below/above verdict priced on the night.
export function snapshotNight({ asOf, reads = [], ratingRows = [], priceOn, weightsVersion = "base" }) {
  const out = [];
  const seen = new Set();
  for (const r of reads) {
    const dir = claimOf(r);
    const pid = readPid(r);
    if (!dir || !pid) continue;
    const kind = String(r.readKind || r.type || r.kind || "");
    const key = `read:${kind}:${pid}:${asOf}`;
    if (seen.has(key)) continue;
    const price = priceOn(pid, asOf);
    if (!(price > 0)) continue;
    seen.add(key);
    out.push({ t: "read", kind, pid, date: asOf, dir, price });
  }
  for (const row of ratingRows) {
    const v = String(row?.verdict || "");
    const verdict = /below/i.test(v) ? "below" : /above/i.test(v) ? "above" : "";
    const pid = pidOf(row?.id);
    if (!pid || row?.check) continue;
    if (row?.price?.date && row.price.date !== asOf) continue;
    const price = priceOn(pid, asOf);
    if (!(price > 0)) continue;
    const f = {};
    for (const [k, val] of Object.entries(row.factors || {})) if (Number.isFinite(val?.v)) f[k] = Math.round(val.v * 100) / 100;
    out.push({ t: "rating", kind: verdict || "inline", group: row.group || "", pid, date: asOf, price, score: Number.isFinite(row.score) ? row.score : null, f, wv: weightsVersion });
  }
  return out;
}

export function priceAtHorizon(priceOn, pid, date, h) {
  for (let d = 0; d <= HORIZON_SLACK; d++) {
    const day = addDays(date, h + d);
    const p = priceOn(pid, day);
    if (p > 0) return { day, price: p };
  }
  return null;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Adds .h{7,30,90} = { day, chg, excess, held } to each ledger row that can be scored by today.
export function scoreLedger(ledger, priceOn, today, marketChange = null) {
  for (const h of HORIZONS) {
    const due = ledger.filter((e) => !e[`h${h}`] && addDays(e.date, h) <= today);
    const changes = [];
    for (const e of due) {
      const at = priceAtHorizon(priceOn, e.pid, e.date, h);
      if (!at) continue;
      changes.push([e, at, at.price / e.price - 1]);
    }
    // Baselines: every scored product on the same night (market), and the same
    // rating group on the same night (group).
    const market = new Map(), group = new Map();
    for (const [e, , c] of changes) {
      if (!market.has(e.date)) market.set(e.date, []);
      market.get(e.date).push(c);
      if (e.t === "rating") {
        const k = `${e.date}|${e.group}`;
        if (!group.has(k)) group.set(k, []);
        group.get(k).push(c);
      }
    }
    for (const [e, at, c] of changes) {
      // Reads compare with every priced product between the same two days when the
      // runner gives a market baseline; otherwise with the other reads that night.
      const base = e.t === "rating" ? median(group.get(`${e.date}|${e.group}`)) : (marketChange ? marketChange(e.date, at.day) : median(market.get(e.date)));
      const excess = base == null ? null : c - base;
      let held = null;
      if (e.t === "read") held = e.dir > 0 ? at.price >= e.price : at.price <= e.price;
      else if (e.kind === "below" && excess != null) held = excess > 0;
      else if (e.kind === "above" && excess != null) held = excess < 0;
      // Band + market-relative (secondary column; the tuner still reads held).
      const bandHeld = e.t === "read" && excess != null ? Math.abs(c) >= BAND && Math.sign(c) === e.dir && Math.sign(excess) === e.dir : null;
      e[`h${h}`] = { day: at.day, chg: Math.round(c * 10000) / 10000, excess: excess == null ? null : Math.round(excess * 10000) / 10000, held, bandHeld };
    }
  }
  return ledger;
}

export function summarize(ledger) {
  const buckets = new Map();
  for (const e of ledger) {
    const key = `${e.t}:${e.kind}`;
    if (!buckets.has(key)) buckets.set(key, { type: e.t, kind: e.kind, logged: 0 });
    const b = buckets.get(key);
    b.logged++;
    for (const h of HORIZONS) {
      const s = e[`h${h}`];
      if (!s || s.held == null) continue;
      b[`n${h}`] = (b[`n${h}`] || 0) + 1;
      b[`held${h}`] = (b[`held${h}`] || 0) + (s.held ? 1 : 0);
      if (s.bandHeld != null) { b[`nb${h}`] = (b[`nb${h}`] || 0) + 1; b[`bh${h}`] = (b[`bh${h}`] || 0) + (s.bandHeld ? 1 : 0); }
      if (s.excess != null) (b[`_ex${h}`] ||= []).push(s.excess);
    }
  }
  const rows = [];
  for (const b of buckets.values()) {
    const row = { type: b.type, kind: b.kind, logged: b.logged };
    for (const h of HORIZONS) {
      const n = b[`n${h}`] || 0;
      row[`scored${h}`] = n;
      row[`heldPct${h}`] = n >= MIN_SCORED ? Math.round((100 * (b[`held${h}`] || 0)) / n) : null;
      const nb = b[`nb${h}`] || 0;
      row[`bandHeldPct${h}`] = nb >= MIN_SCORED ? Math.round((100 * (b[`bh${h}`] || 0)) / nb) : null;
      const ex = b[`_ex${h}`] || [];
      row[`medianExcess${h}`] = ex.length >= MIN_SCORED ? Math.round(median(ex) * 1000) / 10 : null;
    }
    rows.push(row);
  }
  return rows.sort((a, b) => (a.type + a.kind < b.type + b.kind ? -1 : 1));
}

// Keep the ledger bounded: rows older than the longest horizon plus slack are
// dropped once fully scored or past any chance of scoring.
export function pruneLedger(ledger, today) {
  const cutoff = addDays(today, -(Math.max(...HORIZONS) + HORIZON_SLACK + 7));
  return ledger.filter((e) => e.date >= cutoff);
}
