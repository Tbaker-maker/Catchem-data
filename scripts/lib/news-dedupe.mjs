// One row per story. The label is Official, Confirmed, or Unconfirmed.

export function storyKey(item) {
  const title = String(item?.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return title || String(item?.url || "");
}

export function tierRank(tier) {
  if (tier === "Official") return 3;
  if (tier === "Confirmed") return 2;
  return 1;
}

export function labelFor(group, tierOf) {
  const tiers = group.map((item) => tierOf(item.source));
  if (tiers.includes("Official")) return "Official";
  const names = new Set(group.map((item) => item.source).filter(Boolean));
  if (names.size >= 2) return "Confirmed";
  return "Unconfirmed";
}

export function dedupeNews(items, tierOf = () => "Unconfirmed") {
  const groups = new Map();
  for (const item of items || []) {
    const key = storyKey(item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const rows = [];
  for (const group of groups.values()) {
    const ranked = [...group].sort((a, b) => tierRank(tierOf(b.source)) - tierRank(tierOf(a.source)) || String(a.url).localeCompare(String(b.url)));
    const kept = ranked[0];
    rows.push({
      title: kept.title,
      url: kept.url,
      date: kept.date || "",
      source: kept.source,
      label: labelFor(group, tierOf),
      sources: [...new Set(group.map((item) => item.source).filter(Boolean))].sort(),
    });
  }
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.title.localeCompare(b.title));
  return rows;
}
