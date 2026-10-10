// Exact-day eBay listing counts. A listing is not a sale.
// The public read stays off until supply.leadReads is true.

const COPY_BAN = /\b(resistance|support|breakout|bottom|cheap|crash|buys?|sells?|selling|holds?|holding|printed)\b/i;

export function dayBefore(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
}

export function moneyAsk(n) {
  const v = Number(n);
  if (!(v > 0)) return "";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function groupListings(rows) {
  const by = new Map();
  for (const row of rows || []) {
    if (!row || typeof row.id !== "string" || !row.id) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ""))) continue;
    const count = Number(row.listingCount);
    if (!Number.isInteger(count) || count < 0) continue;
    const price = Number(row.price);
    if (!by.has(row.id)) by.set(row.id, []);
    by.get(row.id).push({
      date: row.date,
      listingCount: count,
      ask: Number.isFinite(price) && price > 0 ? price : null,
    });
  }
  for (const arr of by.values()) {
    arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const seen = new Set();
    const uniq = [];
    for (const point of arr) {
      if (seen.has(point.date)) uniq[uniq.length - 1] = point;
      else {
        seen.add(point.date);
        uniq.push(point);
      }
    }
    arr.splice(0, arr.length, ...uniq);
  }
  return by;
}

export function listingWindow(points, days, minPct = 15) {
  const pts = points || [];
  if (!pts.length || (days !== 7 && days !== 30)) {
    return { qualify: false, reason: "no-series", days };
  }
  const end = pts[pts.length - 1];
  const startDate = dayBefore(end.date, days);
  const start = pts.find((point) => point.date === startDate) || null;
  const base = {
    days,
    startDate,
    endDate: end.date,
    from: start ? start.listingCount : null,
    to: end.listingCount,
    askFrom: start ? start.ask : null,
    askTo: end.ask,
  };
  if (!start) return { ...base, qualify: false, reason: "missing-exact-day", pct: null, askStayed: false };
  if (!(start.listingCount > 0)) return { ...base, qualify: false, reason: "empty-start", pct: null, askStayed: false };
  const pct = Math.round(((end.listingCount - start.listingCount) / start.listingCount) * 1000) / 10;
  const askStayed = start.ask != null && end.ask != null && start.ask === end.ask;
  if (!Number.isFinite(pct) || Math.abs(pct) < minPct) {
    return { ...base, qualify: false, reason: "under-15", pct, askStayed };
  }
  return { ...base, qualify: true, reason: "ok", pct, askStayed };
}

export function listingSentence(name, win) {
  if (!win?.qualify || !name) return "";
  const fewer = win.pct < 0;
  const verb = fewer ? "fell" : "rose";
  const lead = fewer ? "Fewer copies listed" : "More copies listed";
  let line = `${lead}: ${name} eBay listings ${verb} ${Math.abs(win.pct)}% in ${win.days} days (${win.from} → ${win.to}).`;
  if (win.askStayed) line += ` The eBay ask stayed at ${moneyAsk(win.askTo)}.`;
  if (COPY_BAN.test(line)) throw new Error("listing sentence used a banned word");
  return line;
}

export function wrongLine() {
  const line = "What would make this wrong: either exact night is missing, the listing change is under 15%, or a listing was treated as a sale.";
  if (COPY_BAN.test(line)) throw new Error("wrong line used a banned word");
  return line;
}

export function gapDates(points) {
  const dates = (points || []).map((point) => point.date).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day));
  if (dates.length < 2) return [];
  const missing = [];
  let cursor = Date.parse(`${dates[0]}T00:00:00Z`);
  const end = Date.parse(`${dates[dates.length - 1]}T00:00:00Z`);
  const have = new Set(dates);
  while (cursor <= end) {
    const day = new Date(cursor).toISOString().slice(0, 10);
    if (!have.has(day)) missing.push(day);
    cursor += 86400000;
  }
  return missing;
}

export function chartSegments(points, key) {
  const rows = (points || []).filter((point) => point && /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(Number(point[key])));
  const segments = [];
  let run = [];
  let prev = "";
  for (const point of rows) {
    const gap = prev && dayBefore(point.date, 1) !== prev;
    if (gap && run.length) {
      segments.push(run);
      run = [];
    }
    run.push([point.date, Number(point[key])]);
    prev = point.date;
  }
  if (run.length) segments.push(run);
  return segments;
}

export function buildSupplyLead(rows, names = {}, { enabled = false, minPct = 15 } = {}) {
  const grouped = groupListings(rows);
  const nights = [...new Set([].concat(...[...grouped.values()].map((points) => points.map((point) => point.date))))].sort();
  const latest = nights[nights.length - 1] || "";
  const windows = {};
  const qualified = [];
  const belowGate = [];
  for (const days of [7, 30]) {
    const start = latest ? dayBefore(latest, days) : "";
    let withBoth = 0;
    let pass = 0;
    for (const [id, points] of grouped) {
      const win = listingWindow(points, days, minPct);
      if (win.reason !== "missing-exact-day" && win.reason !== "no-series") withBoth += 1;
      if (!win.qualify) {
        if (win.reason === "under-15") {
          belowGate.push({
            id,
            name: names[id] || id,
            days,
            pct: win.pct,
            from: win.from,
            to: win.to,
            fromDate: win.startDate,
            toDate: win.endDate,
          });
        }
        continue;
      }
      pass += 1;
      const name = names[id] || id;
      qualified.push({
        id,
        name,
        days,
        pct: win.pct,
        from: win.from,
        to: win.to,
        fromDate: win.startDate,
        toDate: win.endDate,
        askFrom: win.askFrom,
        askTo: win.askTo,
        askStayed: win.askStayed,
        sentence: listingSentence(name, win),
        wrong: wrongLine(),
        label: "eBay listings",
        series: points.map((point) => ({ date: point.date, ask: point.ask, listings: point.listingCount })),
        gaps: gapDates(points),
      });
    }
    windows[String(days)] = {
      days,
      exactStart: start,
      exactStartOnFile: nights.includes(start),
      productsWithBothDays: withBoth,
      qualify: pass,
    };
  }
  qualified.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || a.name.localeCompare(b.name));
  return {
    enabled: enabled === true,
    flag: "supply.leadReads",
    asOf: latest,
    label: "eBay listings",
    rule: "Exact calendar day before that product's latest night. A missing night drops the read. Counts are active eBay listings, not sales. A read needs a change of at least 15% and both exact days.",
    nights,
    nightCount: nights.length,
    products: grouped.size,
    productsOnLatest: latest ? [...grouped.values()].filter((points) => points.some((point) => point.date === latest)).length : 0,
    windows,
    wouldQualify: qualified.length,
    belowGate,
    reads: enabled === true ? qualified : [],
  };
}
