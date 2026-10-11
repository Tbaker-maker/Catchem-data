// Join a tcgcsv single to a catalogue card by set code + collector number.
// A name is never the match. SWSH07 is not rewritten into swsh7.

const PATTERN = [" (Poke Ball Pattern)", " (Master Ball Pattern)"];

export function normCollectorNumber(raw) {
  if (raw == null) return "";
  const text = String(raw).trim();
  if (!text || /^(n\/a|na|\?|!)$/i.test(text)) return "";
  const left = text.split("/")[0].trim();
  const m = left.match(/^([A-Za-z]*)(\d+)([A-Za-z]*)$/);
  if (!m) return "";
  return m[1].toUpperCase() + String(parseInt(m[2], 10)) + m[3].toLowerCase();
}

function letters(value) {
  const bare = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return bare.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ")
    .split(" ").filter((token) => token && token !== "and");
}

// Used only to reject a ptcgo-code join whose names do not describe the same
// set (BST is Battle Stadium on TCGCSV and Battle Styles on the catalogue).
// It never creates a join.
export function sameSetName(groupName, setName) {
  let group = letters(groupName);
  if (group.length && /^(swsh|sm|sv|xy|bw|dp|hgss|me|ex)\d+[a-z0-9]*$/.test(group[0])) {
    group = group.slice(1);
  }
  const set = letters(setName);
  if (!group.length || !set.length) return false;
  const has = (need, hay) => need.every((token) => hay.includes(token));
  return has(set, group) || has(group, set);
}

export function joinGroups(groups, sets) {
  const setById = new Map(sets.map((set) => [set.id, set]));
  const ptcgo = new Map();
  for (const set of sets) {
    const code = String(set.ptcgoCode || "").trim().toUpperCase();
    if (!code) continue;
    if (!ptcgo.has(code)) ptcgo.set(code, []);
    ptcgo.get(code).push(set.id);
  }
  const abbr = new Map();
  for (const group of groups) {
    const code = String(group.abbreviation || "").trim().toUpperCase();
    if (!abbr.has(code)) abbr.set(code, []);
    abbr.get(code).push(group);
  }
  const joined = new Map();
  const rejected = [];
  for (const group of groups) {
    const code = String(group.abbreviation || "").trim();
    const upper = code.toUpperCase();
    if (!code || (abbr.get(upper) || []).length !== 1) {
      rejected.push({ groupId: group.groupId, abbreviation: code, reason: "no-unique-set-code" });
      continue;
    }
    const exact = [...setById.keys()].filter((id) => id.toLowerCase() === code.toLowerCase());
    const via = ptcgo.get(upper) || [];
    if (via.length > 1 || (exact.length === 1 && via.length === 1 && exact[0] !== via[0])) {
      rejected.push({ groupId: group.groupId, abbreviation: code, reason: "set-code-collision" });
      continue;
    }
    if (exact.length === 1) {
      joined.set(group.groupId, { setId: exact[0], setCode: code, how: "set-id" });
      continue;
    }
    if (via.length !== 1) {
      rejected.push({ groupId: group.groupId, abbreviation: code, reason: "set-code-not-in-catalogue" });
      continue;
    }
    const set = setById.get(via[0]);
    if (!sameSetName(group.name, set && set.name)) {
      rejected.push({ groupId: group.groupId, abbreviation: code, reason: "set-code-name-conflict" });
      continue;
    }
    joined.set(group.groupId, { setId: via[0], setCode: code, how: "ptcgo" });
  }
  return { joined, rejected };
}

function isPattern(name) {
  const text = String(name || "");
  return PATTERN.some((suffix) => text.endsWith(suffix));
}

export function mapSingles({ groups, sets, cards, items }) {
  const { joined, rejected } = joinGroups(groups, sets);
  const rejectReason = new Map(rejected.map((row) => [row.groupId, row.reason]));
  const catalogue = new Map();
  for (const [id, card] of Object.entries(cards || {})) {
    const number = normCollectorNumber(card && card.number);
    if (!number) continue;
    const key = `${card.setId}\0${number}`;
    if (!catalogue.has(key)) catalogue.set(key, []);
    catalogue.get(key).push(id);
  }
  const buckets = new Map();
  const skipped = [];
  for (const item of items || []) {
    if (item.kind && item.kind !== "single") continue;
    const reason = rejectReason.get(item.groupId);
    if (reason) {
      skipped.push({ id: item.id, reason });
      continue;
    }
    if (!joined.has(item.groupId)) {
      skipped.push({ id: item.id, reason: "no-unique-set-code" });
      continue;
    }
    if (isPattern(item.name)) {
      skipped.push({ id: item.id, reason: "pattern-card" });
      continue;
    }
    const number = normCollectorNumber(item.number);
    if (!number) {
      skipped.push({ id: item.id, reason: "no-collector-number" });
      continue;
    }
    const key = `${item.groupId}\0${number}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  const mapped = [];
  for (const [key, rows] of buckets) {
    if (rows.length !== 1) {
      for (const row of rows) skipped.push({ id: row.id, reason: "ambiguous-same-number" });
      continue;
    }
    const item = rows[0];
    const link = joined.get(item.groupId);
    const number = key.split("\0")[1];
    const cands = catalogue.get(`${link.setId}\0${number}`) || [];
    if (cands.length === 0) {
      skipped.push({ id: item.id, reason: "no-catalogue-card" });
      continue;
    }
    if (cands.length !== 1) {
      skipped.push({ id: item.id, reason: "clashing-catalogue-numbers" });
      continue;
    }
    mapped.push({
      id: item.id,
      catalogueId: cands[0],
      setId: link.setId,
      setCode: link.setCode,
      groupId: item.groupId,
      number,
      printing: item.printing || null,
      join: link.how,
    });
  }
  mapped.sort((a, b) => a.id.localeCompare(b.id));
  skipped.sort((a, b) => a.id.localeCompare(b.id));
  const skippedByReason = {};
  for (const row of skipped) skippedByReason[row.reason] = (skippedByReason[row.reason] || 0) + 1;
  return { mapped, skipped, skippedByReason, joined: [...joined.entries()].map(([groupId, link]) => ({ groupId, ...link })), rejected };
}

export function applyMappedPictures(images, mapped) {
  let applied = 0;
  for (const row of mapped || []) {
    if (!row || !row.id || !row.catalogueId) continue;
    if (row.catalogueImage === false) continue;
    if (images[row.id]) continue;
    const src = images[row.catalogueId];
    if (!src) continue;
    images[row.id] = src;
    applied += 1;
  }
  return applied;
}
