// Same name, different collector number. Reads must show the number so a
// full art is not the regular card.
import { cleanCardName, fullNumber, hasNumber } from "./card-face.mjs";

export function nameKey(name) {
  return cleanCardName(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function variantGroups(cards) {
  const groups = new Map();
  for (const card of cards || []) {
    const key = nameKey(card?.name);
    const number = fullNumber(card?.number ?? card?.num);
    if (!key || !number || !card?.id) continue;
    if (!groups.has(key)) groups.set(key, { name: cleanCardName(card.name), cards: [] });
    groups.get(key).cards.push({
      id: String(card.id),
      number,
      set: String(card.set || card.setName || ""),
    });
  }
  const flagged = [];
  for (const group of groups.values()) {
    const numbers = [...new Set(group.cards.map((c) => c.number))].sort();
    if (numbers.length < 2) continue;
    flagged.push({ name: group.name, numbers, cards: group.cards.sort((a, b) => (a.number < b.number ? -1 : 1)) });
  }
  flagged.sort((a, b) => (a.name < b.name ? -1 : 1));
  return flagged;
}

export function missingNumbers(text, numbers) {
  const body = String(text || "");
  return (numbers || []).filter((number) => number && !hasNumber(body, number));
}

export function readMissesVariant(read, group) {
  if (!group) return [];
  const blob = [read?.name, read?.headline, ...(read?.lines || [])].join(" ");
  const named = nameKey(read?.name) === nameKey(group.name) || nameKey(blob).includes(nameKey(group.name));
  if (!named) return [];
  const present = group.numbers.filter((number) => hasNumber(blob, number));
  if (present.length) return [];
  return group.numbers;
}
