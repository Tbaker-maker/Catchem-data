// Review holds for pull requests. No live threshold is stored here.
// A number in a test is a hit only when the same key has that number in the
// private config the caller loaded. Callers pass that index in. This file
// does not fetch it.

const DASH = /[\u2014\u2013]/;
const LIMIT_KEY = /(min|max|floor|cap|ratio|pct|band|threshold|limit|cutoff|age|wait|reads|listings|days|gap|jump|spike|flip|step|anchor)/i;

export function isLimitKey(key) {
  return LIMIT_KEY.test(String(key || ""));
}

export function indexLimits(config) {
  const index = new Map();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "number" && Number.isFinite(value) && isLimitKey(key)) {
        if (!index.has(key)) index.set(key, new Set());
        index.get(key).add(value);
      } else walk(value);
    }
  };
  walk(config);
  return index;
}

export function mergeIndexes(configs) {
  const index = new Map();
  for (const config of configs || []) {
    for (const [key, values] of indexLimits(config)) {
      if (!index.has(key)) index.set(key, new Set());
      for (const value of values) index.get(key).add(value);
    }
  }
  return index;
}

function addHit(hits, key, raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return;
  hits.push({ key, value });
}

export function limitHits(text, index) {
  const hits = [];
  if (!index || !index.size) return hits;
  let doc = null;
  try { doc = JSON.parse(text); } catch { doc = null; }
  if (doc && typeof doc === "object") {
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === "number" && index.has(key) && index.get(key).has(value)) hits.push({ key, value });
        else walk(value);
      }
    };
    walk(doc);
    return hits;
  }
  const re = /["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s*[:=]\s*(-?\d+(?:\.\d+)?)/g;
  for (const match of String(text).matchAll(re)) {
    const key = match[1];
    const value = Number(match[2]);
    if (index.has(key) && index.get(key).has(value)) addHit(hits, key, value);
  }
  return hits;
}

export function isTestPath(file) {
  const path = String(file || "").replaceAll("\\", "/");
  return path.startsWith("scripts/tests/") || path.includes("/fixtures/");
}

export function isFixturePath(file) {
  const path = String(file || "").replaceAll("\\", "/");
  return path.includes("/fixtures/") || path.startsWith("scripts/tests/fixtures/") || /limits\.json$/.test(path);
}

export function privateLimitProblems(files, index) {
  const problems = [];
  for (const file of files || []) {
    if (!isTestPath(file.path)) continue;
    const keys = [...new Set(limitHits(file.text, index).map((hit) => hit.key))];
    for (const key of keys) problems.push(`${file.path} key ${key} matches a live private limit`);
  }
  return problems;
}

export function fixtureMarkerProblems(files) {
  const problems = [];
  for (const file of files || []) {
    if (!isFixturePath(file.path)) continue;
    if (!/\bfake\b/i.test(String(file.text || ""))) problems.push(`${file.path} has no fake marker`);
  }
  return problems;
}

export function coveredCopyPath(file) {
  const path = String(file || "");
  return path.startsWith("scripts/") || path.startsWith("data/") || path.startsWith("docs/") || path.endsWith(".md");
}

export function dashProblems(diffText) {
  const problems = [];
  let file = "";
  for (const line of String(diffText || "").split("\n")) {
    if (line.startsWith("+++ b/")) {
      file = line.slice(6);
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    if (!coveredCopyPath(file)) continue;
    if (DASH.test(line)) problems.push(`${file} adds an em or en dash`);
  }
  return problems;
}

function writersFor(file, readers) {
  const found = [];
  let known = false;
  for (const row of readers || []) {
    const target = String(row.file || "");
    const match = file === target || (target.endsWith("/") && file.startsWith(target));
    if (!match) continue;
    known = true;
    if (row.writer && row.writer !== "hand" && String(row.writer).startsWith("scripts/")) found.push(row.writer);
  }
  if (known) return found.length ? found : null;
  if (file.startsWith("research/assets/public/")) return ["scripts/build-public-bundle.mjs"];
  if (file.startsWith("research/pulse/") || /^trending\.(json|md|html)$/.test(file)) return ["scripts/generate-pulse.mjs"];
  if (/^data\/[^/]+\.json$/.test(file)) return [null];
  return null;
}

export function writerProblems({ files, messages, readers }) {
  const changed = new Set(files || []);
  const msg = String(messages || "");
  const problems = [];
  for (const file of changed) {
    const writers = writersFor(file, readers);
    if (!writers) continue;
    const named = writers.filter(Boolean);
    const scriptChanged = named.some((writer) => changed.has(writer));
    const messageNamesWriter = named.some((writer) => msg.includes(writer) || msg.includes(`node ${writer}`));
    const messageNamesCommand = /node scripts\/[A-Za-z0-9_./-]+\.mjs/.test(msg);
    if (scriptChanged || messageNamesWriter) continue;
    if (!named.length && messageNamesCommand) continue;
    const which = named.length ? named.join(" or ") : "a writer command";
    problems.push(`${file} changed without ${which}`);
  }
  return problems;
}
