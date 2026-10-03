// The active listing total is the eBay Browse response field `total`.
// A filtered page count is not that number. A failed query does not reuse
// the prior day. A bottom is not a one-day move, and it is not a buy or sell line.

const DAY = 86400000;
const BASE_DAYS = 21;

export function leadTotal(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function withActiveTotal(product, { date, total, failed }) {
  const lead = failed ? null : leadTotal(total);
  const history = Array.isArray(product?.priceHistory) ? product.priceHistory.map((row) => ({ ...row })) : [];
  const next = {
    ...product,
    listingCount: lead,
    activeTotal: lead,
    activeTotalAsOf: date,
  };
  if (lead == null) {
    const last = history[history.length - 1];
    if (last && last.date === date) {
      if (last.price == null) history.pop();
      else last.total = null;
    }
    next.priceHistory = history;
    return { product: next, blank: true };
  }
  const last = history[history.length - 1];
  if (last && last.date === date) last.total = lead;
  else history.push({ date, total: lead });
  next.priceHistory = history;
  return { product: next, blank: false };
}

function utc(iso) {
  return Date.parse(`${iso}T00:00:00Z`);
}

function consecutive(rows) {
  const runs = [];
  let run = [];
  for (const row of rows) {
    const prev = run[run.length - 1];
    if (prev && utc(row.date) - utc(prev.date) !== DAY) {
      if (run.length) runs.push(run);
      run = [];
    }
    run.push(row);
  }
  if (run.length) runs.push(run);
  return runs;
}

function listingsStep(a, b) {
  if (b.total > a.total) return "rising";
  if (b.total < a.total) return "falling";
  return "flat";
}

function priceStep(a, b) {
  if (!(a.price > 0) || !(b.price > 0)) return "";
  if (b.price > a.price) return "up";
  if (b.price < a.price) return "down";
  return "flat";
}

function confirmAt(run, index, releaseDate) {
  if (index < BASE_DAYS + 1) return null;
  const confirm = run[index];
  const before = run[index - 1];
  if (confirm.date === releaseDate) return null;
  if (listingsStep(before, confirm) === "rising") return null;
  const baseStart = index - BASE_DAYS;
  const base = run.slice(baseStart, index);
  if (base.length !== BASE_DAYS) return null;
  const stopped = run[baseStart - 1];
  const risingPoint = run[baseStart - 2];
  if (!risingPoint || !stopped) return null;
  if (listingsStep(risingPoint, stopped) !== "rising") return null;
  if (listingsStep(stopped, base[0]) === "rising") return null;
  for (let i = 1; i < base.length; i += 1) {
    if (listingsStep(base[i - 1], base[i]) === "rising") return null;
  }
  if (priceStep(base[0], base[base.length - 1]) !== "down") return null;
  for (let i = 1; i < base.length; i += 1) {
    const step = priceStep(base[i - 1], base[i]);
    if (step === "flat" || step === "up") return null;
  }
  const turned = priceStep(before, confirm);
  if (turned !== "flat" && turned !== "up") return null;
  return { date: confirm.date, total: confirm.total, price: confirm.price };
}

// Listings lead. Price lags. A base is listings flat or down across more than
// one day while price is still soft. A call needs that base already in place
// for weeks, and only then a price that has stopped falling. One day, a price
// that turns first, listings that are still rising, or a release date: no call.
// The calendar is not an input.
export function readBottom(rows, { releaseDate } = {}) {
  const none = (reason) => ({ call: null, reason, take: null, laterPrice: null, scored: false });
  const real = [];
  for (const row of rows || []) {
    const total = leadTotal(row?.total);
    if (total == null || !row?.date) continue;
    real.push({ date: row.date, total, price: Number(row.price) > 0 ? Number(row.price) : null });
  }
  real.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (real.length < 2) return none("one day");
  let found = null;
  for (const run of consecutive(real)) {
    for (let i = 0; i < run.length; i += 1) {
      const take = confirmAt(run, i, releaseDate);
      if (take) found = take;
    }
  }
  if (!found) {
    const run = consecutive(real).at(-1) || [];
    const last = run[run.length - 1];
    const prev = run[run.length - 2];
    if (!prev) return none("one day");
    if (last.date === releaseDate) return none("release date");
    if (listingsStep(prev, last) === "rising") return none("listings still rising");
    return none("shorter than weeks");
  }
  const later = real.find((row) => row.date > found.date && row.price > 0);
  const laterPrice = later ? later.price : null;
  return { call: "base", reason: "", take: found, laterPrice, scored: laterPrice != null };
}

export function countBottoms(products, releaseDates = {}) {
  const calls = [];
  for (const product of products || []) {
    const read = readBottom(product?.priceHistory || [], { releaseDate: releaseDates[product?.setId] || "" });
    if (read.call) calls.push({ id: product.id, ...read });
  }
  return calls;
}
