// Private momentum reads for sealed market pulse products.
// Every cutoff arrives from the caller. This file stores none of them.
// Listings counted only. A missing count stays missing. Price outcomes are TCGplayer market.
import { readFileSync } from "node:fs";

export const ABOUT = "Momentum reads for each product on the sealed market pulse. Listings counted are picking up, slowing, or flat. The current move is longer or shorter than usual for that product, or there is no usual yet. The latest steps match or do not match the steps before them. The later price is TCGplayer market. Empty history leaves every signal empty.";

export const DEMAND_MISSING = "No dated demand series for these products. Nothing was filled in.";

export const LIMIT_KEYS = [
  "flatAbsPerDay",
  "paceDeltaMin",
  "maxGapDays",
  "minPoints",
  "durationBandDays",
  "minPastMoves",
  "patternSteps",
  "forwardDays",
  "priceFlatAbsPct",
  "minN",
  "minLift",
];

const CALL_STATES = {
  momentum: ["picking-up", "slowing", "flat"],
  duration: ["longer", "shorter", "usual"],
  pattern: ["same", "different"],
};

const CALL_OK = new Set(["opposite-listings", "same-listings", "none"]);

const ICONS = JSON.parse(readFileSync(new URL("./momentum-icons.json", import.meta.url), "utf8"));

export function iconKey() {
  return ICONS;
}

export function iconFor(id) {
  return (ICONS.icons || []).find((row) => row.id === id) || null;
}

export function iconId(signal, state) {
  if (!state) return null;
  return `${signal}-${state}`;
}

export function round4(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

export function dayNumber(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(iso, n) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function limitsOk(cfg) {
  if (!cfg || typeof cfg !== "object") return false;
  for (const key of LIMIT_KEYS) {
    if (typeof cfg[key] !== "number" || !Number.isFinite(cfg[key])) return false;
  }
  if (cfg.flatAbsPerDay < 0 || cfg.paceDeltaMin < 0 || cfg.maxGapDays < 1 || cfg.minPoints < 3) return false;
  if (cfg.durationBandDays < 0 || cfg.minPastMoves < 1 || cfg.patternSteps < 2) return false;
  if (cfg.forwardDays < 1 || cfg.priceFlatAbsPct < 0 || cfg.minN < 1 || cfg.minLift < 0) return false;
  if (!cfg.calls || typeof cfg.calls !== "object") return false;
  for (const [signal, states] of Object.entries(CALL_STATES)) {
    const row = cfg.calls[signal];
    if (!row || typeof row !== "object") return false;
    for (const state of states) {
      if (!CALL_OK.has(row[state])) return false;
    }
  }
  return true;
}

export function assertLimits(cfg) {
  if (!limitsOk(cfg)) {
    const err = new Error("momentum limits not loaded");
    err.code = "LIMITS_MISSING";
    throw err;
  }
  return cfg;
}

export function median(xs) {
  const vals = (xs || []).filter((n) => n != null && Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

function bare(missing) {
  return { state: null, direction: null, icon: null, missing, inputs: null };
}

function emptyRead(missing) {
  return { asOf: null, momentum: bare(missing), duration: bare(missing), pattern: bare(missing) };
}

export function normalizeCounts(rows) {
  const by = new Map();
  for (const row of rows || []) {
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ""))) continue;
    if (row.n == null || !Number.isFinite(Number(row.n))) continue;
    by.set(row.date, { date: row.date, n: Number(row.n) });
  }
  return [...by.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function normalizePrices(rows) {
  const by = new Map();
  for (const row of rows || []) {
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ""))) continue;
    const price = Number(row.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    by.set(row.date, { date: row.date, price, source: row.source || "TCGplayer market" });
  }
  return [...by.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function changesOf(points, limits) {
  const out = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const days = dayNumber(cur.date) - dayNumber(prev.date);
    if (days == null || days <= 0) continue;
    if (days > limits.maxGapDays) {
      out.push({ break: true, from: prev.date, to: cur.date, days });
      continue;
    }
    const perDayRaw = (cur.n - prev.n) / days;
    const direction = Math.abs(perDayRaw) <= limits.flatAbsPerDay ? "flat" : (perDayRaw > 0 ? "up" : "down");
    out.push({
      break: false,
      from: prev.date,
      to: cur.date,
      days,
      fromN: prev.n,
      toN: cur.n,
      perDay: round4(perDayRaw),
      perDayRaw,
      direction,
    });
  }
  return out;
}

function latestReal(changes) {
  let start = 0;
  for (let i = 0; i < changes.length; i += 1) if (changes[i].break) start = i + 1;
  return changes.slice(start).filter((row) => !row.break);
}

function slimChange(row) {
  return {
    from: row.from,
    to: row.to,
    days: row.days,
    fromN: row.fromN,
    toN: row.toN,
    perDay: row.perDay,
    direction: row.direction,
  };
}

export function momentumOf(changes, limits) {
  const seg = latestReal(changes);
  if (seg.length < 2) return bare("not enough listings counted");
  const prev = seg[seg.length - 2];
  const cur = seg[seg.length - 1];
  let state = "flat";
  if (cur.direction !== "flat") {
    const faster = Math.abs(cur.perDayRaw) - Math.abs(prev.perDayRaw);
    if (faster > limits.paceDeltaMin) state = "picking-up";
    else if (-faster > limits.paceDeltaMin) state = "slowing";
  }
  const direction = state === "flat" ? "flat" : cur.direction;
  return {
    state,
    direction,
    icon: iconId("momentum", state),
    missing: null,
    inputs: { prev: slimChange(prev), cur: slimChange(cur) },
  };
}

export function movesFrom(changes) {
  const moves = [];
  let open = null;
  const close = (reason) => {
    if (!open) return;
    moves.push({ ...open, open: false, endReason: reason });
    open = null;
  };
  for (const row of changes) {
    if (row.break || row.direction === "flat") {
      close(row.break ? "gap" : "flat");
      continue;
    }
    if (!open) {
      open = { direction: row.direction, from: row.from, to: row.to, days: row.days, steps: 1 };
    } else if (open.direction === row.direction) {
      open.to = row.to;
      open.days = dayNumber(row.to) - dayNumber(open.from);
      open.steps += 1;
    } else {
      close("turn");
      open = { direction: row.direction, from: row.from, to: row.to, days: row.days, steps: 1 };
    }
  }
  if (open) moves.push({ ...open, open: true, endReason: null });
  return moves;
}

export function durationOf(changes, limits) {
  const moves = movesFrom(changes);
  const past = moves.filter((move) => !move.open);
  const current = moves.length && moves[moves.length - 1].open ? moves[moves.length - 1] : null;
  const inputs = {
    current: current ? { from: current.from, to: current.to, days: current.days, direction: current.direction } : null,
    past: past.map((move) => ({ from: move.from, to: move.to, days: move.days, direction: move.direction })),
  };
  if (!current) return { state: null, direction: null, icon: null, missing: "no current move", inputs };
  if (past.length < limits.minPastMoves) {
    return { state: null, direction: current.direction, icon: null, missing: "not enough past moves", inputs };
  }
  const usualDays = median(past.map((move) => move.days));
  inputs.usualDays = usualDays;
  let state = "usual";
  if (current.days > usualDays + limits.durationBandDays) state = "longer";
  else if (current.days < usualDays - limits.durationBandDays) state = "shorter";
  return {
    state,
    direction: current.direction,
    icon: iconId("duration", state),
    missing: null,
    inputs,
  };
}

export function patternOf(changes, limits) {
  const seg = latestReal(changes);
  const need = limits.patternSteps * 2;
  if (seg.length < need) return bare("not enough steps");
  const cur = seg.slice(-limits.patternSteps);
  const prev = seg.slice(-need, -limits.patternSteps);
  const same = cur.every((row, i) => row.direction === prev[i].direction);
  const state = same ? "same" : "different";
  return {
    state,
    direction: cur[cur.length - 1].direction,
    icon: iconId("pattern", state),
    missing: null,
    inputs: { current: cur.map(slimChange), prior: prev.map(slimChange) },
  };
}

export function readProduct(countRows, limits) {
  assertLimits(limits);
  const points = normalizeCounts(countRows);
  if (!points.length) return emptyRead("empty history");
  if (points.length < limits.minPoints) return emptyRead("not enough listings counted");
  const changes = changesOf(points, limits);
  if (!changes.some((row) => !row.break)) return emptyRead("not enough listings counted");
  return {
    asOf: points[points.length - 1].date,
    momentum: momentumOf(changes, limits),
    duration: durationOf(changes, limits),
    pattern: patternOf(changes, limits),
  };
}

export function signalOn(countRows, asOf, limits) {
  assertLimits(limits);
  const past = normalizeCounts(countRows).filter((row) => row.date <= asOf);
  return readProduct(past, limits);
}

export function callFor(signal, part, limits) {
  if (!part || !part.state) return null;
  const rule = limits.calls?.[signal]?.[part.state];
  if (!rule || rule === "none") return null;
  if (part.direction !== "up" && part.direction !== "down") return null;
  if (rule === "opposite-listings") return part.direction === "up" ? "down" : "up";
  if (rule === "same-listings") return part.direction;
  return null;
}

export function forwardMove(prices, asOf, limits) {
  const start = [...prices].reverse().find((row) => row.date <= asOf);
  if (!start) return null;
  const target = addDays(asOf, limits.forwardDays);
  const end = prices.find((row) => row.date >= target);
  if (!end || end.date <= asOf) return null;
  const pct = ((end.price - start.price) / start.price) * 100;
  const direction = Math.abs(pct) <= limits.priceFlatAbsPct ? "flat" : (pct > 0 ? "up" : "down");
  return {
    from: start.price,
    to: end.price,
    fromDate: start.date,
    toDate: end.date,
    pct: round4(pct),
    direction,
    source: end.source || start.source || "TCGplayer market",
  };
}

export function backtestProduct(id, countRows, priceRows, limits) {
  assertLimits(limits);
  const counts = normalizeCounts(countRows);
  const prices = normalizePrices(priceRows);
  const events = [];
  const universe = [];
  for (const point of counts) {
    const asOf = point.date;
    const past = counts.filter((row) => row.date <= asOf);
    if (past.length < limits.minPoints) continue;
    const move = forwardMove(prices, asOf, limits);
    if (!move) continue;
    universe.push({
      id,
      asOf,
      actual: move.direction,
      priceFrom: move.from,
      priceTo: move.to,
      priceFromDate: move.fromDate,
      priceToDate: move.toDate,
      priceSource: move.source,
    });
    const read = readProduct(past, limits);
    for (const signal of ["momentum", "duration", "pattern"]) {
      const part = read[signal];
      if (!part || !part.state) continue;
      const call = callFor(signal, part, limits);
      if (!call) continue;
      events.push({
        id,
        signal,
        state: part.state,
        asOf,
        listingsDirection: part.direction,
        call,
        actual: move.direction,
        hit: move.direction === call,
        priceFrom: move.from,
        priceTo: move.to,
        priceFromDate: move.fromDate,
        priceToDate: move.toDate,
        priceSource: move.source,
      });
    }
  }
  return { events, universe };
}

export function summarize(events, universe, limits) {
  assertLimits(limits);
  const baseN = universe.length;
  const pUp = baseN ? universe.filter((row) => row.actual === "up").length / baseN : null;
  const pDown = baseN ? universe.filter((row) => row.actual === "down").length / baseN : null;
  const signals = {};
  for (const name of ["momentum", "duration", "pattern"]) {
    const rows = (events || []).filter((row) => row.signal === name);
    const n = rows.length;
    const hits = rows.filter((row) => row.hit === true).length;
    const hitRate = n ? round4(hits / n) : null;
    let baseRate = null;
    if (n && pUp != null) {
      let expected = 0;
      for (const row of rows) expected += row.call === "up" ? pUp : pDown;
      baseRate = round4(expected / n);
    }
    const lift = hitRate != null && baseRate != null ? round4(hitRate - baseRate) : null;
    signals[name] = {
      hitRate,
      baseRate,
      n,
      hits,
      lift,
      proven: Boolean(n >= limits.minN && lift != null && lift >= limits.minLift),
      baseN,
    };
  }
  return signals;
}
