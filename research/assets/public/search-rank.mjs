// Collector search. Browser-safe. No prices are invented here.

export const ALIASES = [
  [/moonbreon|moonbrean|moonbreom/g, "umbreon vmax alternate 215"],
  [/van gogh pikachu|vangogh pikachu|van gogh|grey felt hat/g, "pikachu grey felt hat"],
  [/poke center|pokemon center|pc etb/g, "pokemon center elite trainer box"],
  [/\betb\b/g, "elite trainer box"],
  [/\bbb\b/g, "booster box"],
  [/\bsir\b/g, "special illustration"],
  [/\bsar\b/g, "special art"],
  [/\bir\b/g, "illustration rare"],
  [/\btg\b/g, "trainer gallery"],
  [/alt art|\balt\b/g, "alternate"],
  [/1st edition|first edition|\b1st\b/g, "1st edition"],
  [/\bpe\b/g, "prismatic evolutions"],
  [/\bes\b/g, "evolving skies"],
  [/\blo\b/g, "lost origin"],
  [/\bfs\b/g, "fusion strike"],
  [/\bneo genesis\b/g, "neo genesis"],
  [/\b151\b/g, "151"],
  [/\bupc\b/g, "ultra premium collection"],
  [/\bcz\b/g, "crown zenith"],
  [/\bzard\b/g, "charizard"],
  [/charzard/g, "charizard"],
];

const STOP = new Set(["the", "a", "of", "and", "card"]);

export function expandQuery(q) {
  let s = fold(q);
  s = s.replace(/mini tins/g, "mini tin").replace(/booster boxes/g, "booster box").replace(/elite trainer boxes/g, "elite trainer box");
  for (const [re, to] of ALIASES) s = s.replace(re, to);
  s = s.replace(/(\d+)\s*\/\s*(\d+)/g, "$1 $2");
  return s;
}

function tokens(q) {
  return expandQuery(q).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));
}

function lev(a, b) {
  if (a === b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) > 1) return 2;
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b[i - 1] === a[j - 1] ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1], m[i][j - 1], m[i - 1][j]) + 1;
    }
  }
  return m[b.length][a.length];
}

function fold(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "");
}

function hay(row) {
  return fold(`${row[1]} ${row[2]} ${row[3]} ${row[4]} ${row[7] || ""} ${row[8] || ""} ${row[9] || ""}`);
}

export function withSetCodes(query, codes) {
  if (!codes) return String(query || "");
  return String(query || "").split(/(\s+)/).map((part) => {
    const hit = codes[part.toLowerCase()];
    return hit ? String(hit).replace(/-/g, " ") : part;
  }).join("");
}

function stemsOf(tok) {
  const out = [tok];
  if (tok.length >= 5 && tok.endsWith("es")) out.push(tok.slice(0, -2));
  if (tok.length >= 4 && tok.endsWith("s") && !tok.endsWith("ss")) out.push(tok.slice(0, -1));
  return out;
}

function tokenHit(tok, text) {
  const parts = text.split(/[^a-z0-9]+/).filter(Boolean);
  let best = 0;
  for (const stem of stemsOf(tok)) {
    if (parts.includes(stem)) best = Math.max(best, 2);
    else if (/^\d+$/.test(stem)) {
      for (const p of parts) if (p === stem || p.startsWith(stem)) best = Math.max(best, 2);
    } else if ((tok === "elite" || tok === "trainer" || tok === "box") && parts.includes("etb")) {
      best = Math.max(best, 2);
    } else if (stem.length >= 4) {
      for (const p of parts) if (p.startsWith(stem)) best = Math.max(best, 1);
    }
    if (best >= 2) return 2;
  }
  if (best) return best;
  if (tok.length < 5) return 0;
  for (const p of parts) {
    if (Math.abs(p.length - tok.length) > 1) continue;
    if (lev(tok, p) <= 1) return 1;
  }
  return 0;
}

function setTokens(setName) {
  return fold(setName).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t) && !/^(swsh|sm|xy|bw|dp|hgss|ex|me|sv)\d*$/.test(t));
}

function setFit(query, setName) {
  const q = tokens(query);
  const st = setTokens(setName);
  if (st.length < 2) return 0;
  if (!st.every((t) => q.includes(t))) return 0;
  return 24;
}

function nameExtra(query, name) {
  const q = new Set(tokens(query));
  const parts = fold(name).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));
  let n = 0;
  for (const p of parts) if (!q.has(p)) n += 1;
  return n * 6;
}

const JUNK = /costco|sam's club|sams club|dollar general|walmart|walgreens|best buy|target exclusive|gamestop/;

export function scoreRow(query, row, codes = null) {
  const toks = tokens(withSetCodes(query, codes));
  if (!toks.length || !row) return 0;
  const text = hay(row);
  const name = fold(row[1]);
  let score = 0;
  let hit = 0;
  for (const tok of toks) {
    const h = tokenHit(tok, text);
    if (!h) return 0;
    hit += 1;
    score += h * 8;
    if (tokenHit(tok, name) === 2) score += 6;
  }
  if (hit !== toks.length) return 0;
  const q = fold(expandQuery(query));
  const raw = fold(query);
  const wantsSealed = /elite trainer box|booster box|booster bundle|booster pack|mini tin|ultra premium/.test(q);
  if (wantsSealed && row[5] === "sealed") score += 30;
  if (wantsSealed && row[5] !== "sealed") score -= 20;
  if (/mini tin/.test(q) && row[5] === "sealed" && /mini tin/.test(name)) score += 24;
  score += setFit(query, row[2]);
  score -= nameExtra(query, row[1]);
  if (/\b151\b/.test(q) && /\b151\b/.test(name)) score += 25;
  if (/elite trainer box/.test(q) && /^151 elite trainer box/.test(name) && !/pokemon center|costco/.test(name)) score += 35;
  if (/pokemon center|pc etb/.test(raw) && /pokemon center/.test(name)) score += 30;
  if (!/pokemon center|pc etb/.test(raw) && /pokemon center/.test(name) && /elite trainer box/.test(q)) score -= 45;
  if (!/costco|sam|dollar|walmart|exclusive|collection/.test(raw) && JUNK.test(name)) score -= 80;
  if (/\bcostco\b/.test(raw) && /\bcostco\b/.test(name)) score += 40;
  if (/elite trainer box/.test(q) && /collection|bundle|tin|pack/.test(name) && !/elite trainer box/.test(name)) score -= 30;
  if (/booster box/.test(q) && !/booster box/.test(text)) score -= 70;
  if (!/\bhalf\b/.test(q) && /\bhalf\b/.test(name)) score -= 30;
  const num = String(row[3] || "").toLowerCase();
  for (const tok of toks) {
    if (/^\d+$/.test(tok) && (num === tok || num.startsWith(tok + "/") || num.startsWith(tok + " "))) score += 18;
  }
  if (row[6] > 0) score += Math.min(12, Math.log10(row[6]));
  return score;
}

const PREPARED = new WeakMap();

export function prepareCatalog(rows) {
  const cached = PREPARED.get(rows);
  if (cached) return cached;
  const byToken = new Map();
  const words = [];
  const seenWord = new Set();
  for (let i = 0; i < (rows || []).length; i += 1) {
    const parts = hay(rows[i]).split(/[^a-z0-9]+/).filter(Boolean);
    const seen = new Set();
    for (const part of parts) {
      if (seen.has(part)) continue;
      seen.add(part);
      let list = byToken.get(part);
      if (!list) { list = []; byToken.set(part, list); }
      list.push(i);
      if (part.length >= 4 && !seenWord.has(part)) { seenWord.add(part); words.push(part); }
      if (part === "etb") {
        for (const extra of ["elite", "trainer", "box"]) {
          if (seen.has(extra)) continue;
          seen.add(extra);
          let extraList = byToken.get(extra);
          if (!extraList) { extraList = []; byToken.set(extra, extraList); }
          extraList.push(i);
        }
      }
    }
  }
  const index = { byToken, words };
  if (rows) PREPARED.set(rows, index);
  return index;
}

function listsFor(prepared, tok) {
  const bag = new Set();
  let any = false;
  for (const stem of stemsOf(tok)) {
    const exact = prepared.byToken.get(stem);
    if (exact && exact.length) { any = true; for (const id of exact) bag.add(id); }
    if (stem.length >= 4) {
      let n = 0;
      for (const word of prepared.words) {
        if (!word.startsWith(stem) || word === stem) continue;
        const arr = prepared.byToken.get(word);
        if (!arr) continue;
        any = true;
        for (const id of arr) bag.add(id);
        n += 1;
        if (n > 8) break;
      }
    }
  }
  if (any) return [...bag];
  if (tok.length >= 5) {
    const near = [];
    for (const word of prepared.words) {
      if (Math.abs(word.length - tok.length) > 1) continue;
      if (lev(tok, word) <= 1) near.push(word);
      if (near.length > 6) break;
    }
    for (const word of near) {
      const arr = prepared.byToken.get(word);
      if (arr) for (const id of arr) bag.add(id);
    }
    if (bag.size) return [...bag];
  }
  return null;
}

export function rankCatalog(query, rows, limit = 8, codes = null) {
  const scored = [];
  const prepared = prepareCatalog(rows);
  if (prepared) {
    const toks = tokens(withSetCodes(query, codes));
    let ids = null;
    for (const tok of toks) {
      const list = listsFor(prepared, tok);
      if (!list || !list.length) { ids = new Set(); break; }
      const set = new Set(list);
      ids = ids ? new Set([...ids].filter((id) => set.has(id))) : set;
      if (!ids.size) break;
    }
    const pool = ids && ids.size ? [...ids] : null;
    const list = pool || (toks.length ? [] : rows.map((_, index) => index));
    for (const index of list) {
      const row = rows[index];
      const s = scoreRow(query, row, codes);
      if (s > 0) scored.push([s, row]);
    }
  } else {
    for (const row of rows) {
      const s = scoreRow(query, row, codes);
      if (s > 0) scored.push([s, row]);
    }
  }
  scored.sort((a, b) => b[0] - a[0] || String(a[1][1]).length - String(b[1][1]).length);
  return scored.slice(0, limit).map((x) => x[1]);
}

function partialScore(query, row) {
  const toks = tokens(query);
  if (!toks.length || !row) return 0;
  const nameParts = fold(row[1]).split(/[^a-z0-9]+/).filter(Boolean);
  const setParts = fold(row[2]).split(/[^a-z0-9]+/).filter(Boolean);
  let score = 0;
  let nameHits = 0;
  for (const tok of toks) {
    if (nameParts.includes(tok)) {
      nameHits += 1;
      score += 40;
      if (nameParts[0] === tok) score += 20;
    } else if (setParts.includes(tok)) score += 4;
  }
  // A set that merely mentions the word is not a nearest card.
  return nameHits ? score : 0;
}

export function searchCatalog(query, rows, limit = 8) {
  const hits = rankCatalog(query, rows, limit);
  if (hits.length) return { hits, missing: false, nearest: [] };
  const scored = [];
  for (const row of rows) {
    const s = partialScore(query, row);
    if (s > 0) scored.push([s, row]);
  }
  scored.sort((a, b) => b[0] - a[0] || String(a[1][1]).length - String(b[1][1]).length);
  return { hits: [], missing: true, nearest: scored.slice(0, limit).map((x) => x[1]) };
}

function samePrinting(a, b) {
  return fold(a[1]) === fold(b[1]) && fold(a[2]) === fold(b[2]) && String(a[3] || "") === String(b[3] || "");
}

function preferRow(list) {
  return list.slice().sort((a, b) => {
    const artist = (b[4] ? 1 : 0) - (a[4] ? 1 : 0);
    if (artist) return artist;
    return String(a[0]).localeCompare(String(b[0]));
  })[0];
}

export function pickTarget(query, rows, limit = 8, codes = null) {
  const hits = rankCatalog(query, rows, Math.max(limit, 8), codes);
  if (!hits.length) return { mode: "none", hits: [], href: "", id: "" };
  const scored = hits.map((row) => [scoreRow(query, row, codes), row]);
  scored.sort((a, b) => b[0] - a[0] || String(a[1][1]).length - String(b[1][1]).length);
  const top = scored[0][0];
  const close = scored.filter((pair) => top - pair[0] < 12);
  const distinct = [];
  for (const pair of close) {
    if (!distinct.some((have) => samePrinting(have[1], pair[1]))) distinct.push(pair);
  }
  const cluster = close.filter((pair) => samePrinting(pair[1], distinct[0][1])).map((pair) => pair[1]);
  const best = preferRow(cluster);
  const href = (best[5] === "sealed" ? "/p/" : "/c/") + best[0];
  if (distinct.length === 1) return { mode: "page", hits, href, id: best[0] };
  const q = String(query || "").trim();
  return { mode: "list", hits, href: "/search?q=" + encodeURIComponent(q), id: best[0] };
}

export function typeLabel(row) {
  const kind = String(row?.[5] || "");
  const name = fold(row?.[1] || "");
  if (kind === "sealed") {
    if (/mini tin/.test(name)) return "Mini Tin";
    if (/elite trainer/.test(name)) return "ETB";
    if (/booster box/.test(name)) return "Booster Box";
    if (/ultra premium|\bupc\b/.test(name)) return "UPC";
    if (/booster bundle/.test(name)) return "Bundle";
    if (/\btin\b/.test(name)) return "Tin";
    if (/booster pack/.test(name)) return "Pack";
    return "Sealed";
  }
  if (kind === "slab") return "Slab";
  return "Single";
}
