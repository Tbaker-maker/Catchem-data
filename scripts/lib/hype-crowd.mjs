// Hype-effect reads and crowded-call flags at three levels: set, single, sealed.
// Script only, no AI. Public wording is neutral/factual; banned advice words and
// creator names never appear. n≥20 holdout gate per level; failures stay private.
import { isBanned } from "./youtube.mjs";

export const MIN_N = 20;
export const WEEK_DAYS = 7;
export const CROWD_WINDOW = 14;
export const CROWD_MIN_CREATORS = 3;
export const CROWD_MIN_CALLS = 5;
export const HYPE_MIN_CREATORS = 3;
export const HYPE_MIN_CALLS = 5;
export const HOLDOUT = 0.3;
export const LEVELS = ["set", "single", "sealed"];

const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const round1 = (x) => Math.round(x * 10) / 10;
const round4 = (x) => Math.round(x * 10000) / 10000;

function median(xs) {
  const s = xs.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function hashSplit(id, seed = 7) {
  const h = [...String(id)].reduce((a, c) => (a * 33 + c.charCodeAt(0) + seed) >>> 0, 0);
  return h % 100 < HOLDOUT * 100 ? "test" : "train";
}

/** Classify a claim into set | single | sealed subject keys. */
export function subjectsOf(call, metaByPid = new Map()) {
  const pid = Number(call.pid ?? call.productId);
  const date = call.date || call.issued;
  const dir = call.hold ? 0 : Number(call.dir);
  const channel = call.channel || null;
  if (!date) return [];
  const meta = (pid && metaByPid.get(pid)) || {};
  const kind = call.target === "sealed" || meta.kind === "sealed" ? "sealed"
    : call.target === "card" || meta.kind === "single" ? "single"
    : meta.kind || null;
  const setKey = call.set || meta.set || null;
  const setLabel = setKey ? String(setKey).replace(/^(SV|SWSH|SM|ME|XY|BW)[^:]*:\s*/i, "").trim() : null;
  const groupId = call.groupId ?? meta.groupId ?? null;
  const out = [];
  if (setKey || groupId) {
    out.push({
      level: "set",
      key: groupId != null ? `group:${groupId}` : `set:${setKey}`,
      label: setLabel || setKey || `group ${groupId}`,
      pid: pid || null,
      date, dir, channel,
    });
  }
  if (pid && kind === "single") {
    out.push({
      level: "single",
      key: `single:${pid}`,
      label: meta.name || call.item || `card ${pid}`,
      pid, date, dir, channel,
      setLabel,
    });
  }
  if (pid && kind === "sealed") {
    out.push({
      level: "sealed",
      key: `sealed:${pid}`,
      label: meta.name || call.item || `sealed ${pid}`,
      pid, date, dir, channel,
      setLabel,
    });
  }
  return out;
}

/** Cluster same-direction subjects within windowDays. */
export function crowdClusters(subjects, {
  windowDays = CROWD_WINDOW,
  minCreators = CROWD_MIN_CREATORS,
  minCalls = CROWD_MIN_CALLS,
} = {}) {
  const byKeyDir = new Map();
  for (const s of subjects) {
    if (s.dir == null || s.dir === 0) continue; // skip flat_call / hold
    const k = `${s.level}|${s.key}|${s.dir > 0 ? "up" : "down"}`;
    if (!byKeyDir.has(k)) byKeyDir.set(k, []);
    byKeyDir.get(k).push(s);
  }
  const clusters = [];
  for (const [, arr] of byKeyDir) {
    arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    let i = 0;
    while (i < arr.length) {
      let j = i;
      const creators = new Set();
      while (j < arr.length && daysBetween(arr[i].date, arr[j].date) <= windowDays) {
        if (arr[j].channel) creators.add(arr[j].channel);
        j++;
      }
      const slice = arr.slice(i, j);
      if (creators.size >= minCreators || slice.length >= minCalls) {
        clusters.push({
          level: slice[0].level,
          key: slice[0].key,
          label: slice[0].label,
          direction: slice[0].dir > 0 ? "up" : "down",
          start: slice[0].date,
          end: slice.at(-1).date,
          calls: slice.length,
          creators: creators.size,
          pids: [...new Set(slice.map((x) => x.pid).filter(Boolean))],
        });
      }
      i = Math.max(i + 1, j);
    }
  }
  return clusters;
}

/** Attention windows (any direction) for hype-effect. */
export function attentionWindows(subjects, {
  windowDays = WEEK_DAYS,
  minCreators = HYPE_MIN_CREATORS,
  minCalls = HYPE_MIN_CALLS,
} = {}) {
  const byKey = new Map();
  for (const s of subjects) {
    const k = `${s.level}|${s.key}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(s);
  }
  const wins = [];
  for (const [, arr] of byKey) {
    arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    let i = 0;
    while (i < arr.length) {
      let j = i;
      const creators = new Set();
      while (j < arr.length && daysBetween(arr[i].date, arr[j].date) <= windowDays) {
        if (arr[j].channel) creators.add(arr[j].channel);
        j++;
      }
      const slice = arr.slice(i, j);
      if (creators.size >= minCreators || slice.length >= minCalls) {
        wins.push({
          level: slice[0].level,
          key: slice[0].key,
          label: slice[0].label,
          start: slice[0].date,
          end: slice.at(-1).date,
          calls: slice.length,
          creators: creators.size,
          pids: [...new Set(slice.map((x) => x.pid).filter(Boolean))],
        });
      }
      i = Math.max(i + 1, j);
    }
  }
  return wins;
}

/**
 * Score a cluster/window's 30d median move using priceOn(pid, day).
 * For set level, uses all pids attached to the event.
 */

/** One attention event per UTC week per subject when the week clears thresholds. */
export function weeklyAttention(subjects, {
  minCreators = HYPE_MIN_CREATORS,
  minCalls = HYPE_MIN_CALLS,
} = {}) {
  const weekKey = (iso) => {
    const d = new Date(`${iso}T00:00:00Z`);
    const day = d.getUTCDay(); // 0=Sun
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const mon = new Date(d.getTime() + mondayOffset * 86400000);
    return mon.toISOString().slice(0, 10);
  };
  const by = new Map();
  for (const s of subjects) {
    const w = weekKey(s.date);
    const k = `${s.level}|${s.key}|${w}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(s);
  }
  const out = [];
  for (const [, arr] of by) {
    const creators = new Set(arr.map((x) => x.channel).filter(Boolean));
    if (creators.size < minCreators && arr.length < minCalls) continue;
    arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    out.push({
      level: arr[0].level,
      key: arr[0].key,
      label: arr[0].label,
      start: arr[0].date,
      end: arr.at(-1).date,
      calls: arr.length,
      creators: creators.size,
      pids: [...new Set(arr.map((x) => x.pid).filter(Boolean))],
    });
  }
  return out;
}

/** Weekly same-direction crowded events. */
export function weeklyCrowded(subjects, {
  minCreators = CROWD_MIN_CREATORS,
  minCalls = CROWD_MIN_CALLS,
} = {}) {
  const weekKey = (iso) => {
    const d = new Date(`${iso}T00:00:00Z`);
    const day = d.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const mon = new Date(d.getTime() + mondayOffset * 86400000);
    return mon.toISOString().slice(0, 10);
  };
  const by = new Map();
  for (const s of subjects) {
    if (s.dir == null || s.dir === 0) continue;
    const w = weekKey(s.date);
    const dir = s.dir > 0 ? "up" : "down";
    const k = `${s.level}|${s.key}|${dir}|${w}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(s);
  }
  const out = [];
  for (const [, arr] of by) {
    const creators = new Set(arr.map((x) => x.channel).filter(Boolean));
    if (creators.size < minCreators && arr.length < minCalls) continue;
    arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    out.push({
      level: arr[0].level,
      key: arr[0].key,
      label: arr[0].label,
      direction: arr[0].dir > 0 ? "up" : "down",
      start: arr[0].date,
      end: arr.at(-1).date,
      calls: arr.length,
      creators: creators.size,
      pids: [...new Set(arr.map((x) => x.pid).filter(Boolean))],
    });
  }
  return out;
}

export function scoreMove30(event, priceOn, { pidsByKey = null } = {}) {
  let pids = event.pids?.length ? [...event.pids] : (event.pid ? [event.pid] : []);
  if (event.level === "set" && pidsByKey?.has(event.key)) {
    const extra = pidsByKey.get(event.key) || [];
    pids = [...new Set([...pids, ...extra])];
  }
  if (!pids.length || !event.start) return null;
  const ch = [];
  for (const pid of pids) {
    const a = priceOn(pid, event.start);
    const b = priceOn(pid, addDays(event.start, 30));
    if (a > 0 && b > 0) ch.push(b / a - 1);
  }
  if (!ch.length) return null;
  return { chg: round4(median(ch)), priced: ch.length, day: addDays(event.start, 30) };
}

/**
 * Holdout gate for descriptive 30d medians:
 * - scored history n ≥ minN (20)
 * - test split ≥ 6 events
 * - train/test medians agree (same sign or within 15 pts)
 * Levels that fail stay private. Public line n is the full scored history count.
 */
export function holdoutGate(scoredEvents, { minN = MIN_N } = {}) {
  const ready = scoredEvents.filter((e) => e.move30 != null);
  const train = ready.filter((e) => hashSplit(`${e.key}|${e.start}`) === "train");
  const test = ready.filter((e) => hashSplit(`${e.key}|${e.start}`) === "test");
  const med = (xs) => median(xs.map((e) => e.move30.chg));
  const trainMedianPct = train.length ? round1(med(train) * 100) : null;
  const testMedianPct = test.length ? round1(med(test) * 100) : null;
  const minTest = Math.max(6, Math.ceil(minN * HOLDOUT));
  const agree = trainMedianPct != null && testMedianPct != null && (
    Math.sign(trainMedianPct) === Math.sign(testMedianPct)
    || Math.abs(trainMedianPct - testMedianPct) <= 15
  );
  const passed = ready.length >= minN && test.length >= minTest && agree;
  return {
    n: ready.length,
    trainN: train.length,
    testN: test.length,
    trainMedianPct,
    testMedianPct,
    medianPct: ready.length ? round1(med(ready) * 100) : null,
    from: ready.length ? ready.map((e) => e.start).sort()[0] : null,
    to: ready.length ? ready.map((e) => e.start).sort().at(-1) : null,
    passedHoldout: passed,
    status: passed ? "passed_holdout" : "private_candidate",
    minTest,
  };
}

export function hypeEffectLine({ label, medianPct, n, from, to }) {
  const moved = medianPct == null ? "n/a" : `${medianPct >= 0 ? "+" : ""}${medianPct}%`;
  const line = `Heavy creator attention on ${label} this week. Past sets with this much attention moved ${moved} over 30 days (n=${n}, ${from} to ${to}).`;
  // For non-set levels, say "Past products" / "Past cards"
  return line;
}

export function hypeEffectLineForLevel(level, { label, medianPct, n, from, to }) {
  const moved = medianPct == null ? "n/a" : `${medianPct >= 0 ? "+" : ""}${medianPct}%`;
  const past = level === "set" ? "Past sets" : level === "single" ? "Past cards" : "Past sealed products";
  const line = `Heavy creator attention on ${label} this week. ${past} with this much attention moved ${moved} over 30 days (n=${n}, ${from} to ${to}).`;
  if (isBanned(line) || /\u2014/.test(line)) throw new Error(`hype line banned/emdash: ${line}`);
  return line;
}

export function crowdedCallLine(level, {
  label, creators, calls, start, end, direction, histMedianPct, histN, histFrom, histTo,
}) {
  const dirWord = direction === "up" ? "up-direction" : "down-direction";
  const moved = histMedianPct == null ? "n/a" : `${histMedianPct >= 0 ? "+" : ""}${histMedianPct}%`;
  const unit = level === "set" ? "set" : level === "single" ? "card" : "sealed product";
  const line = `Crowded ${dirWord} attention on ${unit} ${label}: ${creators} creators, ${calls} calls, ${start} to ${end}. Past crowded calls moved ${moved} over 30 days (n=${histN}, ${histFrom} to ${histTo}).`;
  if (isBanned(line) || /\u2014/.test(line)) throw new Error(`crowded line banned/emdash: ${line}`);
  return line;
}

/**
 * Build hype-effect public reads + private ledger per level.
 * thisWeekWins: attention windows overlapping [today-6, today]
 * histWins: all older windows scored with move30
 */
export function buildHypeEffect({ windows, priceOn, today, minN = MIN_N, pidsByKey = null }) {
  // Current surface: windows ending in the last 14 days (dates shown in the line).
  const weekStart = addDays(today, -13);
  const byLevel = { set: [], single: [], sealed: [] };
  const privateByLevel = { set: [], single: [], sealed: [] };
  const gateByLevel = {};

  for (const level of LEVELS) {
    const levelWins = windows.filter((w) => w.level === level);
    const scored = [];
    for (const w of levelWins) {
      // Historical only if 30d has elapsed
      if (addDays(w.start, 30) > today) continue;
      const move30 = scoreMove30(w, priceOn, { pidsByKey });
      if (move30) scored.push({ ...w, move30 });
    }
    const gate = holdoutGate(scored, { minN });
    gateByLevel[level] = gate;

    const current = levelWins.filter((w) => w.end >= weekStart && w.end <= today);
    // Dedupe by key, keep most recent
    const seen = new Map();
    for (const w of current.sort((a, b) => (a.end < b.end ? 1 : -1))) {
      if (!seen.has(w.key)) seen.set(w.key, w);
    }
    for (const w of seen.values()) {
      const row = {
        level,
        key: w.key,
        label: w.label,
        asOf: today,
        week: { start: w.start, end: w.end, creators: w.creators, calls: w.calls },
        history: {
          n: gate.n,
          testN: gate.testN,
          medianPct: gate.medianPct,
          testMedianPct: gate.testMedianPct,
          from: gate.from,
          to: gate.to,
        },
        passedHoldout: gate.passedHoldout,
        status: gate.status,
      };
      privateByLevel[level].push(row);
      if (gate.passedHoldout && gate.medianPct != null && gate.from && gate.to) {
        try {
          const line = hypeEffectLineForLevel(level, {
            label: w.label,
            medianPct: gate.medianPct,
            n: gate.n,
            from: gate.from,
            to: gate.to,
          });
          byLevel[level].push({
            id: `hype:${level}:${w.key}:${today}`,
            level,
            key: w.key,
            label: w.label,
            line,
            n: gate.n,
            medianPct: gate.medianPct,
            from: gate.from,
            to: gate.to,
            weekFrom: w.start,
            weekTo: w.end,
            status: "passed_holdout",
          });
        } catch {
          // banned wording → stay private
        }
      }
    }
  }
  return { public: byLevel, private: privateByLevel, gates: gateByLevel };
}

/**
 * Crowded-call flags for current week + historical outcome per level.
 */
export function buildCrowdedCalls({ clusters, priceOn, today, minN = MIN_N, pidsByKey = null }) {
  const weekStart = addDays(today, -13);
  const byLevel = { set: [], single: [], sealed: [] };
  const privateByLevel = { set: [], single: [], sealed: [] };
  const gateByLevel = {};

  for (const level of LEVELS) {
    const levelCl = clusters.filter((c) => c.level === level);
    const hist = [];
    for (const c of levelCl) {
      if (addDays(c.start, 30) > today) continue;
      const move30 = scoreMove30(c, priceOn, { pidsByKey });
      if (move30) hist.push({ ...c, move30 });
    }
    const gate = holdoutGate(hist, { minN });
    gateByLevel[level] = gate;

    const current = levelCl.filter((c) => c.end >= weekStart && c.end <= today);
    const seen = new Map();
    for (const c of current.sort((a, b) => (a.end < b.end ? 1 : -1))) {
      if (!seen.has(`${c.key}|${c.direction}`)) seen.set(`${c.key}|${c.direction}`, c);
    }
    for (const c of seen.values()) {
      const row = {
        level,
        key: c.key,
        label: c.label,
        direction: c.direction,
        asOf: today,
        window: { start: c.start, end: c.end, creators: c.creators, calls: c.calls },
        history: {
          n: gate.n,
          testN: gate.testN,
          medianPct: gate.medianPct,
          testMedianPct: gate.testMedianPct,
          from: gate.from,
          to: gate.to,
        },
        passedHoldout: gate.passedHoldout,
        status: gate.status,
      };
      privateByLevel[level].push(row);
      if (gate.passedHoldout && gate.medianPct != null && gate.from && gate.to) {
        try {
          const line = crowdedCallLine(level, {
            label: c.label,
            creators: c.creators,
            calls: c.calls,
            start: c.start,
            end: c.end,
            direction: c.direction,
            histMedianPct: gate.medianPct,
            histN: gate.n,
            histFrom: gate.from,
            histTo: gate.to,
          });
          byLevel[level].push({
            id: `crowded:${level}:${c.key}:${c.direction}:${today}`,
            type: "CROWDED_CALL",
            severity: c.creators >= 5 ? "medium" : "low",
            key: `crowded:${level}:${c.key}:${c.direction}:${c.end}`,
            level,
            subjectKey: c.key,
            label: c.label,
            line,
            n: gate.n,
            medianPct: gate.medianPct,
            from: gate.from,
            to: gate.to,
            creators: c.creators,
            calls: c.calls,
            direction: c.direction,
            windowFrom: c.start,
            windowTo: c.end,
            status: "passed_holdout",
            // Card pages must never see sealed; sealed pages never see singles.
            surface: level === "set" ? "set" : level === "single" ? "card" : "sealed",
          });
        } catch {
          // banned → private
        }
      }
    }
  }
  return { public: byLevel, private: privateByLevel, gates: gateByLevel };
}

/** Flatten per-level derived docs (or a {set,single,sealed} map of item arrays). */
function itemsForLevel(doc, level) {
  if (!doc) return [];
  const node = doc[level] ?? doc.public?.[level];
  if (Array.isArray(node)) return node;
  if (node && Array.isArray(node.items)) return node.items;
  if (Array.isArray(doc.items) && doc.level === level) return doc.items;
  return [];
}

/** Flag docs for flagger: flatten public crowded calls (all levels, tagged). */
export function crowdedCallFlags(doc) {
  if (!doc) return [];
  const out = [];
  for (const level of LEVELS) {
    for (const f of itemsForLevel(doc, level)) {
      if (f.status !== "passed_holdout") continue;
      out.push({
        type: "CROWDED_CALL",
        severity: f.severity || "low",
        key: f.key,
        line: f.line,
        data: {
          level: f.level,
          subjectKey: f.subjectKey || f.key,
          label: f.label,
          n: f.n,
          medianPct: f.medianPct,
          from: f.from,
          to: f.to,
          creators: f.creators,
          calls: f.calls,
          direction: f.direction,
          windowFrom: f.windowFrom,
          windowTo: f.windowTo,
          surface: f.surface,
          source: `data/derived/crowded-calls-${level}.json`,
        },
      });
    }
  }
  return out;
}

/** Hype-effect flags (optional mirror into flags.json). */
export function hypeEffectFlags(doc) {
  if (!doc) return [];
  const out = [];
  for (const level of LEVELS) {
    for (const r of itemsForLevel(doc, level)) {
      if (r.status !== "passed_holdout") continue;
      out.push({
        type: "HYPE_EFFECT",
        severity: "medium",
        key: r.id || `hype:${level}:${r.key}`,
        line: r.line,
        data: {
          level: r.level,
          label: r.label,
          n: r.n,
          medianPct: r.medianPct,
          from: r.from,
          to: r.to,
          surface: level === "set" ? "set" : level === "single" ? "card" : "sealed",
          source: `data/derived/hype-effect-${level}.json`,
        },
      });
    }
  }
  return out;
}
