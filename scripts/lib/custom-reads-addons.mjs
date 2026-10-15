// Shared Custom Reads add-ons. No network. A source is included only when the
// allow list says so. Items are a headline, one line, and a link.

export function newsItem(row) {
  const headline = String(row?.title || row?.headline || "").replace(/\s+/g, " ").trim();
  const line = String(row?.sentence || row?.line || headline).replace(/\s+/g, " ").trim();
  const url = String(row?.url || "").trim();
  if (!headline || !/^https:\/\//.test(url)) return null;
  if (line.length > 220) return null;
  return {
    headline,
    line,
    url,
    source: String(row?.source || ""),
    date: String(row?.date || "").slice(0, 10),
  };
}

export function allowedNames(allow) {
  const rows = Array.isArray(allow?.sources) ? allow.sources : [];
  return new Set(rows.filter((row) => row && row.allowed === true && row.name).map((row) => row.name));
}

export function selectAddons(rows, allow, watch = []) {
  const names = allowedNames(allow);
  const needles = (watch || []).map((name) => String(name || "").trim().toLowerCase()).filter(Boolean);
  const out = [];
  for (const row of rows || []) {
    if (!names.has(String(row?.source || ""))) continue;
    const item = newsItem(row);
    if (!item) continue;
    if (needles.length) {
      const hay = `${item.headline} ${item.line}`.toLowerCase();
      if (!needles.some((needle) => hay.includes(needle))) continue;
    }
    out.push(item);
  }
  return out;
}

export function watchNeedles(watch = []) {
  return (watch || []).map((name) => String(name || "").trim().toLowerCase()).filter(Boolean);
}

export function filterWatch(items, watch = []) {
  const needles = watchNeedles(watch);
  const out = [];
  for (const row of items || []) {
    const item = row && row.headline && row.url ? row : newsItem(row);
    if (!item || !item.headline || !/^https:\/\//.test(String(item.url || ""))) continue;
    if (String(item.line || "").length > 220) continue;
    if (needles.length) {
      const hay = `${item.headline} ${item.line}`.toLowerCase();
      if (!needles.some((needle) => hay.includes(needle))) continue;
    }
    out.push(item);
  }
  return out;
}

export function attachAddons(follow, news, games) {
  if (!follow) return {};
  const all = follow.all === true;
  const extra = {};
  const watch = follow.watch || [];
  if (all || follow.news === true) {
    const rows = filterWatch(news, watch);
    if (rows.length) extra.news = rows;
  }
  if (all || follow.games === true) {
    const rows = filterWatch(games, watch);
    if (rows.length) extra.games = rows;
  }
  return extra;
}
