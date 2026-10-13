// Map a creator's card words to one catalogue id. A match is returned only when
// one single fits. Two cards, or a name with no set and no finish, is unmatched.
// Nicknames are a fixed list resolved against the catalogue at index time.

const STAGE = new Set(["ex", "v", "vmax", "vstar", "gx"]);

export const NICKNAME_RULES = [
  {
    alias: ["moonbreon", "moonbrean", "moonbreom"],
    nameIncludes: ["umbreon", "vmax"],
    nameAlso: ["alternate art"],
    setIncludes: "evolving skies",
    number: "215/203",
  },
];

export const SET_ABBREV = {
  es: "evolving skies",
  lo: "lost origin",
  fs: "fusion strike",
  cz: "crown zenith",
  pe: "prismatic evolutions",
};

const MIN_CONFIDENCE = 0.8;

export function normText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9/& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function setNameOf(set) {
  return normText(String(set || "").replace(/^[A-Za-z0-9]{2,8}:\s*/, ""));
}

function setCodesOf(set) {
  const m = /^([A-Za-z]{2,5})(\d+)?/i.exec(String(set || ""));
  if (!m) return [];
  const letters = m[1].toLowerCase();
  const digits = m[2] || "";
  const out = new Set();
  if (digits) {
    out.add(letters + digits);
    out.add(letters + String(Number(digits)));
  } else if (letters.length >= 4) out.add(letters);
  return [...out];
}

function baseNameOf(name) {
  const n = String(name || "")
    .replace(/\s+-\s+[^-]*$/, "")
    .replace(/\s*\([^)]*\)\s*/g, " ");
  return normText(n);
}

function spokenNameOf(base) {
  const parts = base.split(" ").filter(Boolean);
  if (parts.length >= 2 && STAGE.has(parts[parts.length - 1])) return parts.slice(0, -1).join(" ");
  return base;
}

export function normNumber(value) {
  const raw = String(value || "").trim();
  const slash = /^0*([0-9]+[a-z]?)\s*\/\s*0*([0-9a-z]+)$/i.exec(raw);
  if (slash) return `${slash[1].toLowerCase()}/${slash[2].toLowerCase()}`;
  const promo = /^([a-z]{1,5})0*(\d+[a-z]?)$/i.exec(raw.replace(/\s+/g, ""));
  if (promo) return `${promo[1].toLowerCase()}${promo[2].toLowerCase()}`;
  return "";
}

function finishOf(card) {
  const blob = `${normText(card.name)} ${normText(card.rarity)}`;
  const tags = new Set();
  if (blob.includes("alternate art") || blob.includes("alt art")) tags.add("alt");
  if (card.rarity === "Special Illustration Rare" || blob.includes("special illustration")) tags.add("sir");
  if (card.rarity === "Illustration Rare") tags.add("ir");
  return tags;
}

function phraseIn(text, phrase) {
  if (!phrase) return false;
  return ` ${text} `.includes(` ${phrase} `);
}

function resolveNicknames(cards) {
  const out = [];
  for (const rule of NICKNAME_RULES) {
    const hits = cards.filter((card) => {
      if (!rule.nameIncludes.every((part) => card.base.includes(part))) return false;
      if (rule.nameAlso && !rule.nameAlso.every((part) => `${card.base} ${normText(card.name)}`.includes(part))) return false;
      if (rule.setIncludes && !card.setNorm.includes(rule.setIncludes)) return false;
      if (rule.number && card.num !== normNumber(rule.number)) return false;
      return true;
    });
    if (hits.length !== 1) continue;
    for (const alias of rule.alias) out.push({ alias, card: hits[0] });
  }
  return out;
}

export function buildCardIndex(items = []) {
  const cards = [];
  const byPid = new Map();
  const byNum = new Map();
  const setPhrases = new Map();
  for (const it of items) {
    if (it.kind !== "single") continue;
    const pid = Number(it.tcgplayerProductId);
    if (!pid) continue;
    const base = baseNameOf(it.name);
    if (!base) continue;
    const card = {
      pid,
      id: it.id || `tcgcsv-${pid}`,
      name: it.name,
      set: it.set || "",
      number: it.number || "",
      base,
      spoken: spokenNameOf(base),
      setNorm: setNameOf(it.set),
      codes: setCodesOf(it.set),
      num: normNumber(it.number),
      tags: finishOf(it),
    };
    cards.push(card);
    byPid.set(pid, card);
    if (card.num) {
      if (!byNum.has(card.num)) byNum.set(card.num, []);
      byNum.get(card.num).push(card);
    }
    if (card.setNorm.length >= 3) {
      if (!setPhrases.has(card.setNorm)) setPhrases.set(card.setNorm, new Set());
      setPhrases.get(card.setNorm).add(card.set);
    }
  }
  const phrases = [...setPhrases.keys()].sort((a, b) => b.length - a.length);
  const byPhrase = new Map();
  const buckets = new Map();
  const codeToSets = new Map();
  const addPhrase = (phrase, card) => {
    if (!phrase) return;
    if (!byPhrase.has(phrase)) byPhrase.set(phrase, []);
    byPhrase.get(phrase).push(card);
  };
  for (const card of cards) {
    addPhrase(card.base, card);
    if (card.spoken !== card.base) addPhrase(card.spoken, card);
    const key = card.base.split(" ")[0];
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(card);
    const spokenKey = card.spoken.split(" ")[0];
    if (spokenKey !== key) {
      if (!buckets.has(spokenKey)) buckets.set(spokenKey, []);
      buckets.get(spokenKey).push(card);
    }
    for (const code of card.codes) {
      if (code.length < 4 && !/\d/.test(code)) continue;
      if (!codeToSets.has(code)) codeToSets.set(code, new Set());
      codeToSets.get(code).add(card.setNorm);
    }
  }
  return { cards, byPid, byNum, phrases, nicknames: resolveNicknames(cards), buckets, byPhrase, codeToSets };
}

function textSets(text, index) {
  const found = [];
  let rest = ` ${text} `;
  for (const phrase of index.phrases) {
    const needle = ` ${phrase} `;
    if (!rest.includes(needle)) continue;
    found.push(phrase);
    rest = rest.split(needle).join(" ");
  }
  if (phraseIn(text, "151") && !found.some((p) => p.split(" ").includes("151"))) {
    const hit = index.phrases.filter((p) => p.split(" ").includes("151"));
    if (hit.length === 1) found.push(hit[0]);
  }
  for (const [abbr, phrase] of Object.entries(SET_ABBREV)) {
    if (!phraseIn(text, abbr)) continue;
    if (!index.phrases.includes(phrase)) continue;
    if (!found.includes(phrase)) found.push(phrase);
  }
  const codeToSets = index.codeToSets;
  if (codeToSets) {
    for (const token of text.split(" ")) {
      const hit = codeToSets.get(token);
      if (!hit) continue;
      for (const setNorm of hit) if (!found.includes(setNorm)) found.push(setNorm);
    }
  }
  return [...new Set(found)];
}

function textFinish(text) {
  const sir = /\bsir\b/.test(text) || text.includes("special illustration rare") || text.includes("special illustration");
  const ir = !sir && (/\bir\b/.test(text) || (text.includes("illustration rare") && !text.includes("special illustration")));
  const alt = text.includes("alt art") || text.includes("alternate art");
  const tags = new Set();
  if (sir) tags.add("sir");
  if (ir) tags.add("ir");
  if (alt) tags.add("alt");
  return tags;
}

function textNumbers(raw, index) {
  const out = [];
  const seen = new Set();
  for (const m of String(raw || "").matchAll(/\b0*([0-9]{1,3}[a-z]?)\s*\/\s*0*([0-9]{2,3}|[a-z]{1,4}[0-9]{0,3})\b/gi)) {
    const num = normNumber(`${m[1]}/${m[2]}`);
    if (num && !seen.has(num)) { seen.add(num); out.push(num); }
  }
  for (const m of String(raw || "").matchAll(/\b([A-Za-z]{2,5})(\d{2,4}[a-z]?)\b/g)) {
    const num = normNumber(`${m[1]}${m[2]}`);
    if (!num || seen.has(num) || !index.byNum.has(num)) continue;
    seen.add(num);
    out.push(num);
  }
  return out;
}

function inSets(card, sets) {
  if (!sets.length) return true;
  // "Crown Zenith" also names the Galarian Gallery. A shorter set phrase that
  // prefixes another set stays ambiguous until the text names the longer set.
  return sets.some((phrase) => card.setNorm === phrase || card.setNorm.startsWith(`${phrase} `));
}

function rowOf(card, confidence, reason) {
  return {
    pid: card.pid,
    id: card.id,
    name: card.name,
    set: card.set,
    number: card.number,
    confidence,
    reason,
  };
}

function one(cards, confidence, reason) {
  if (cards.length !== 1) return null;
  if (confidence < MIN_CONFIDENCE) return null;
  return rowOf(cards[0], confidence, reason);
}

function matchOne(raw, index) {
  const text = normText(raw);
  if (!text || !index) return { matches: [], unmatched: [] };
  const sets = textSets(text, index);
  const finish = textFinish(text);
  const numbers = textNumbers(raw, index);
  const matches = [];
  const unmatched = [];
  const usedPid = new Set();

  for (const nick of index.nicknames) {
    if (!phraseIn(text, nick.alias)) continue;
    if (sets.length && !sets.includes(nick.card.setNorm)) {
      unmatched.push({ text: nick.alias, reason: "nickname_set_conflict" });
      continue;
    }
    if (usedPid.has(nick.card.pid)) continue;
    matches.push(rowOf(nick.card, 0.9, "nickname"));
    usedPid.add(nick.card.pid);
  }

  const tokens = new Set(text.split(" ").filter(Boolean));
  const seenPhrase = new Set();
  const phrases = [];
  for (const token of tokens) {
    for (const card of index.buckets.get(token) || []) {
      for (const phrase of [card.base, card.spoken]) {
        if (!phrase || phrase.split(" ").length < 1) continue;
        if (phrase.split(" ").length === 1 && !sets.length && !finish.size && !numbers.length) continue;
        if (phrase.length < 3 || seenPhrase.has(phrase)) continue;
        if (!phraseIn(text, phrase)) continue;
        seenPhrase.add(phrase);
        phrases.push(phrase);
      }
    }
  }
  phrases.sort((a, b) => b.length - a.length);
  const kept = [];
  for (const phrase of phrases) {
    if (kept.some((longer) => ` ${longer} `.includes(` ${phrase} `))) continue;
    kept.push(phrase);
  }

  for (const phrase of kept) {
    if (!sets.length && !finish.size && !numbers.length) {
      unmatched.push({ text: phrase, reason: "name_alone" });
      continue;
    }
    let pool = index.byPhrase?.get(phrase) || index.cards.filter((card) => card.base === phrase || card.spoken === phrase);
    pool = pool.filter((card) => inSets(card, sets));
    if (finish.size) pool = pool.filter((card) => [...finish].every((tag) => card.tags.has(tag)));
    if (numbers.length) pool = pool.filter((card) => numbers.includes(card.num));
    let reason = "name_set";
    let confidence = 0.82;
    if (numbers.length && sets.length && finish.size) { reason = "number_name_set_finish"; confidence = 0.93; }
    else if (numbers.length && sets.length) { reason = "number_set"; confidence = 0.92; }
    else if (numbers.length && finish.size) { reason = "number_name_finish"; confidence = 0.9; }
    else if (numbers.length) { reason = "number_name"; confidence = 0.88; }
    else if (sets.length && finish.size) { reason = "name_set_finish"; confidence = 0.85; }
    else if (finish.size) { reason = "name_finish"; confidence = 0.84; }
    const hit = one(pool, confidence, reason);
    if (!hit) {
      if (pool.length !== 1) unmatched.push({ text: phrase, reason: pool.length ? "ambiguous" : "no_card", count: pool.length });
      continue;
    }
    if (usedPid.has(hit.pid)) continue;
    matches.push(hit);
    usedPid.add(hit.pid);
  }

  if (!kept.length && numbers.length && sets.length) {
    let pool = [];
    for (const num of numbers) pool.push(...(index.byNum.get(num) || []));
    pool = pool.filter((card) => inSets(card, sets));
    if (finish.size) pool = pool.filter((card) => [...finish].every((tag) => card.tags.has(tag)));
    const hit = one(pool, 0.92, "number_set");
    if (hit && !usedPid.has(hit.pid)) matches.push(hit);
    else if (pool.length !== 1) unmatched.push({ text: numbers.join(" "), reason: pool.length ? "ambiguous" : "no_card", count: pool.length });
  }

  matches.sort((a, b) => a.pid - b.pid);
  return { matches, unmatched };
}

// One sentence or chapter line at a time. A set named later in a description
// must not veto a card named on its own line.
export function matchCards(raw, index) {
  const text = String(raw || "");
  if (!text.trim() || !index) return { matches: [], unmatched: [] };
  const parts = text.split(/\n+|(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return matchOne(text, index);
  const matches = [];
  const unmatched = [];
  const seen = new Set();
  for (const part of parts) {
    const got = matchOne(part, index);
    for (const hit of got.matches) {
      if (seen.has(hit.pid)) continue;
      seen.add(hit.pid);
      matches.push(hit);
    }
    unmatched.push(...got.unmatched);
  }
  matches.sort((a, b) => a.pid - b.pid);
  return { matches, unmatched };
}
