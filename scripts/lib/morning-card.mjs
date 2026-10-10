// Five lines, only from files already written. The supply line stays off with the flag.

const COPY_BAN = /\b(resistance|support|breakout|bottom|cheap|crash|buys?|sells?|selling|holds?|holding|printed)\b/i;

export function pickMorning({ reads = [], news = [], asOf = "", supplyOn = false } = {}) {
  const priced = (reads || []).filter((read) => Number(read?.price) > 0 && Number.isFinite(Number(read?.changePct)) && read.headline);
  priced.sort((a, b) => Math.abs(Number(b.changePct)) - Math.abs(Number(a.changePct)) || String(a.id).localeCompare(String(b.id)));
  const mover = priced[0] || null;
  const highs = (reads || []).filter((read) => /6-month high/.test(String(read?.headline || "")));
  highs.sort((a, b) => Math.abs(Number(b.changePct) || 0) - Math.abs(Number(a.changePct) || 0));
  const high = highs[0] || null;
  const setFact = (reads || []).find((read) => (read?.readKind || read?.type) === "set" && read.headline) || null;
  const species = (reads || []).find((read) => (read?.readKind || read?.type) === "pokemon" && read.headline) || null;
  const releases = (news || []).filter((item) => item && item.kind === "release" && item.title && item.url && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || "")));
  const upcoming = releases.filter((item) => !asOf || item.date >= asOf);
  upcoming.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(b.title).length - String(a.title).length);
  const item = upcoming[0] || null;
  const lines = [];
  if (mover) lines.push({ slot: "mover", text: mover.headline, href: mover.href || "", id: mover.id });
  if (high) lines.push({ slot: "high", text: high.headline, href: high.href || "", id: high.id });
  if (supplyOn) lines.push({ slot: "supply", text: "", href: "" });
  if (setFact) lines.push({ slot: "fact", text: setFact.headline, href: setFact.href || "", id: setFact.id });
  else if (species) lines.push({ slot: "fact", text: species.headline, href: species.href || "", id: species.id, note: "Species fact on the short list. No set move was shipped." });
  else lines.push({ slot: "fact", text: "No set fact on tonight's short list.", href: "" });
  if (item) lines.push({ slot: "news", text: `${item.title} (${item.source}, ${item.date}).`, href: item.url, source: item.source, date: item.date });
  const doc = {
    asOf,
    supplyOn: supplyOn === true,
    supply: supplyOn ? "on" : "off",
    lines: lines.filter((line) => line.text),
  };
  if (COPY_BAN.test(JSON.stringify(doc))) throw new Error("morning card used a banned word");
  return doc;
}
