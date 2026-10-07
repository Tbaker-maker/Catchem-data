// TCGplayer sold volume, derived from the PPT set raws the nightly refresh
// already fetches (ppt-raw-private/<day>/set-<id>.json).
//
// What a count means: PPT's priceHistory.variants[printing]["Near Mint"]
// .history[].volume is the number of copies TCGplayer recorded as sold that
// day. We add up the non-null values inside a dated window. A null volume is a
// day with no sale; it is never filled, interpolated or carried forward.
//
// Which day ends the window: the last history day in a raw is the day before
// the scrape, and it is still filling in (raws a week apart disagree on it in
// about 40% of cards; the day before that never changed). So the window ends
// two days before the scrape date and covers complete days only.
//
// Which card: a PPT card is kept only when its tcgPlayerId matches exactly one
// single in data/catalog/tcgcsv-latest.json, the card numbers agree, and the
// catalog item's printing exists in PPT's variants. Anything else is skipped
// and counted, never guessed.
//
// Output holds counts and dates only. No PPT price leaves the raw. The full
// table stays private; the public file holds only the cards shown in reads.

export const VOLUME_SOURCE = "TCGplayer sales via PokemonPriceTracker";
export const VOLUME_CONDITION = "Near Mint";
// Public file: only the cards a volume read displays (see volume-reads.mjs).
export const VOLUME_FILE = "data/derived/tcgplayer-volume.json";
// Private running state with every verified card. Lives under the gitignored
// ppt-raw-private/ and is pushed to / mounted from catchem-data-private
// (data/meta/tcgplayer-volume.json). PPT's licence forbids giving away bulk
// datasets derived from its data, so the full table is never public.
export const VOLUME_STATE_FILE = "ppt-raw-private/tcgplayer-volume.json";
export const WINDOWS = [7, 30];
// The newest history day in a raw is partial; end two days before the scrape.
export const END_LAG_DAYS = 2;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function shiftDay(iso, days) {
  if (!DAY.test(String(iso || ""))) return "";
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** "065a/119" → "65a"; "102/102" → "102"; "SWSH050" → "swsh050". */
export function normalizeNumber(value) {
  const head = String(value ?? "").split("/")[0].trim().toLowerCase();
  if (!head) return "";
  return head.replace(/^0+(?=\d)/, "");
}

/** tcgplayerProductId → catalog single. Product ids seen twice are dropped. */
export function catalogIndex(items) {
  const byPid = new Map();
  const dup = new Set();
  for (const item of items || []) {
    if (!item || item.kind !== "single") continue;
    const pid = String(item.tcgplayerProductId ?? "").trim();
    if (!/^\d+$/.test(pid)) continue;
    if (byPid.has(pid)) dup.add(pid);
    else byPid.set(pid, item);
  }
  for (const pid of dup) byPid.delete(pid);
  return byPid;
}

/** Scrape day of a raw body: metadata.historyWindow.to, else the folder day. */
export function scrapeDayOf(body, fallback = "") {
  const to = String(body?.metadata?.historyWindow?.to || "").slice(0, 10);
  if (DAY.test(to)) return to;
  return DAY.test(String(fallback || "")) ? fallback : "";
}

/**
 * Sum of non-null volumes in [from, to] (inclusive). daysWithData counts the
 * distinct dates in that range that have a history point at all, null or not.
 */
export function windowCount(history, from, to) {
  const seen = new Map();
  for (const point of history || []) {
    const day = String(point?.date || "").slice(0, 10);
    if (!DAY.test(day) || day < from || day > to) continue;
    const vol = point.volume;
    const n = typeof vol === "number" && Number.isFinite(vol) && vol >= 0 ? vol : null;
    // One value per date; if a date repeats, keep the larger recorded count.
    if (!seen.has(day)) seen.set(day, n);
    else if (n != null && (seen.get(day) == null || n > seen.get(day))) seen.set(day, n);
  }
  let sold = 0;
  for (const n of seen.values()) if (n != null) sold += n;
  return { from, to, days: Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1, daysWithData: seen.size, sold };
}

/** Count for one PPT card against one verified catalog item, or a skip reason. */
export function cardVolume(card, item, scrapeDay) {
  if (!item) return { skip: "not in catalog" };
  const printing = String(item.printing || "").trim();
  if (!printing) return { skip: "catalog has no printing" };
  const pptNo = normalizeNumber(card?.cardNumber);
  const catNo = normalizeNumber(item.number);
  if (pptNo && catNo && pptNo !== catNo) return { skip: "card number differs" };
  const series = card?.priceHistory?.variants?.[printing]?.[VOLUME_CONDITION];
  if (!series || !Array.isArray(series.history)) return { skip: "printing missing in PPT" };
  const end = shiftDay(scrapeDay, -END_LAG_DAYS);
  if (!end) return { skip: "no scrape day" };
  const out = {
    id: item.id,
    tcgplayerProductId: Number(item.tcgplayerProductId),
    printing,
    scrapedOn: scrapeDay,
  };
  for (const days of WINDOWS) {
    const w = windowCount(series.history, shiftDay(end, -(days - 1)), end);
    out[`sold${days}d`] = w.sold;
    out[`window${days}d`] = { from: w.from, to: w.to, daysWithData: w.daysWithData };
  }
  return { row: out };
}

/** Every verified card in one set raw. */
export function setVolumes(body, index, { fallbackDay = "" } = {}) {
  const rows = {};
  const skipped = {};
  const bump = (why) => { skipped[why] = (skipped[why] || 0) + 1; };
  const cards = Array.isArray(body?.data) ? body.data : [];
  const scrapeDay = scrapeDayOf(body, fallbackDay);
  // A tcgPlayerId that appears twice in one raw is ambiguous: drop both.
  const seen = new Map();
  for (const card of cards) {
    const pid = String(card?.tcgPlayerId ?? "").trim();
    if (!pid) continue;
    seen.set(pid, (seen.get(pid) || 0) + 1);
  }
  for (const card of cards) {
    const pid = String(card?.tcgPlayerId ?? "").trim();
    if (!/^\d+$/.test(pid)) { bump("no tcgPlayerId"); continue; }
    if (seen.get(pid) > 1) { bump("tcgPlayerId repeats"); continue; }
    const got = cardVolume(card, index.get(pid), scrapeDay);
    if (got.skip) { bump(got.skip); continue; }
    rows[got.row.id] = got.row;
  }
  return { rows, skipped, scrapeDay };
}

/** True when a card's window is fully covered by history points. */
export function fullWindow(row, days) {
  const w = row?.[`window${days}d`];
  if (!w || !DAY.test(String(w.from || "")) || shiftDay(w.from, days - 1) !== w.to) return false;
  return w.daysWithData === days;
}

export function summarize(cards) {
  const rows = Object.values(cards || {});
  return {
    cards: rows.length,
    full7d: rows.filter((r) => fullWindow(r, 7)).length,
    full30d: rows.filter((r) => fullWindow(r, 30)).length,
    soldAny7d: rows.filter((r) => fullWindow(r, 7) && r.sold7d > 0).length,
    soldAny30d: rows.filter((r) => fullWindow(r, 30) && r.sold30d > 0).length,
  };
}

/**
 * Merge today's rows into the file on disk. A card keeps its own window and
 * scrape day; a newer scrape replaces an older one, never the reverse.
 */
export function mergeVolumeDoc(prev, fresh, { updatedOn } = {}) {
  const cards = { ...(prev?.cards || {}) };
  for (const [id, row] of Object.entries(fresh || {})) {
    const old = cards[id];
    if (old && String(old.scrapedOn || "") > String(row.scrapedOn || "")) continue;
    cards[id] = row;
  }
  const sorted = Object.fromEntries(Object.keys(cards).sort().map((id) => [id, cards[id]]));
  return {
    schema: 1,
    source: VOLUME_SOURCE,
    condition: VOLUME_CONDITION,
    updatedOn: updatedOn || prev?.updatedOn || "",
    method: "Copies sold in Near Mint, per card printing: the sum of TCGplayer's non-null daily sold volume inside each window. A day with a null volume had no sale and is not filled. Each window ends two days before the scrape so it holds complete days only. Counts only; no prices.",
    counts: summarize(sorted),
    cards: sorted,
  };
}

/** One card per line so the nightly diff stays readable. */
export function serializeVolumeDoc(doc) {
  const { cards = {}, ...head } = doc || {};
  const lines = Object.entries(cards).map(([id, row]) => `  ${JSON.stringify(id)}: ${JSON.stringify(row)}`);
  const top = JSON.stringify(head, null, 1).replace(/\n}$/, "");
  return `${top},\n "cards": {\n${lines.join(",\n")}\n }\n}\n`;
}

/** The public slice: same shape, only the listed card ids, plus whole-table counts. */
export function publicVolumeDoc(stateDoc, ids) {
  const keep = new Set(ids || []);
  const cards = Object.fromEntries(Object.entries(stateDoc?.cards || {}).filter(([id]) => keep.has(id)));
  return {
    ...stateDoc,
    scope: "Only the cards shown in volume reads. The full table is kept privately (PPT licence: no bulk derived datasets).",
    counts: stateDoc?.counts || summarize(stateDoc?.cards || {}),
    published: Object.keys(cards).length,
    cards,
  };
}
