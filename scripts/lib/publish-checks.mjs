// Checks around the public-data publish. Every limit lives in catchem-data-private
// (config/publish-checks.json). This file stores no numbers. No limits, no push:
// the site keeps last night's data and the job goes red.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const KEYS = ["maxDroppedFiles", "minReads", "maxReads", "maxAgeDays", "liveWaitSec"];
// Files the site cannot work without. Each must be present and not empty.
export const REQUIRED = ["reads.json", "counts.json", "today.json", "movers.json", "signal-chips.json", "releases.json"];
// Files whose day must be fresh, and where the day is kept.
// Folders rebuilt from scratch every night, one file per read or per shard.
// Reads and watch/cool/heat shards rotate nightly; minReads and maxReads guard
// volume. They do not count toward maxDroppedFiles.
export const ROTATING = ["feed/facts/", "feed/item-reads/", "feed/watch/", "feed/cool/", "feed/heat/"];
const DATED = { "reads.json": "asOf", "counts.json": "asOf", "today.json": "asOf", "movers.json": "asOf" };

export function validChecks(cfg) {
  if (!cfg || typeof cfg !== "object") return null;
  const out = {};
  for (const key of KEYS) {
    const n = Number(cfg[key]);
    if (cfg[key] == null || cfg[key] === "" || !Number.isFinite(n)) return null;
    out[key] = n;
  }
  return out;
}

export async function loadChecks(root) {
  const paths = [process.env.PUBLISH_CHECKS_FILE, join(root, "..", "catchem-data-private", "config", "publish-checks.json")].filter(Boolean);
  for (const path of paths) {
    try { const got = validChecks(JSON.parse(await readFile(path, "utf8"))); if (got) return got; } catch { /* next */ }
  }
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  if (!token) return null;
  try {
    const res = await fetch("https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents/config/publish-checks.json", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw", "User-Agent": "catchem-publish-checks" },
      signal: AbortSignal.timeout(20000),
    });
    return res.ok ? validChecks(await res.json()) : null;
  } catch { return null; }
}

function dayDiff(a, b) {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
}

// files: Map name -> { size, text? } for the new build (names relative to research/assets/public).
// before: array of names on the current public-data tip (same relative form), or null.
export function checkBuild({ files, before, cfg, today }) {
  const problems = [];
  if (!cfg) return ["publish limits not loaded from catchem-data-private"];
  for (const name of REQUIRED) {
    const f = files.get(name);
    if (!f) problems.push(`${name} is missing`);
    else if (!(f.size > 0)) problems.push(`${name} is empty`);
  }
  for (const [name, f] of files) if (!(f.size > 0)) problems.push(`${name} is empty`);
  if (Array.isArray(before) && before.length) {
    const now = new Set(files.keys());
    const gone = before.filter((n) => !now.has(n) && !ROTATING.some((d) => n.startsWith(d)));
    if (gone.length > cfg.maxDroppedFiles) problems.push(`${gone.length} files would disappear from the site`);
  }
  for (const [name, key] of Object.entries(DATED)) {
    const f = files.get(name);
    if (!f?.text) continue;
    let doc;
    try { doc = JSON.parse(f.text); } catch { problems.push(`${name} is not valid JSON`); continue; }
    const day = String(doc?.[key] || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) problems.push(`${name} has no day`);
    else if (dayDiff(today, day) > cfg.maxAgeDays) problems.push(`${name} is dated ${day}, too old`);
    if (name === "reads.json") {
      const n = Array.isArray(doc?.reads) ? doc.reads.length : 0;
      if (n < cfg.minReads || n > cfg.maxReads) problems.push(`reads.json has ${n} reads, outside the expected range`);
    }
  }
  return [...new Set(problems)];
}

// Live check after the push: the site must serve tonight's reads day and the
// public-data tip must be the commit just pushed.
export async function checkLive({ sha, asOf, fetchImpl = fetch }) {
  const problems = [];
  try {
    const tip = await fetchImpl("https://api.github.com/repos/Tbaker-maker/Catchem-data/branches/public-data", { headers: { "User-Agent": "catchem-publish-checks" }, signal: AbortSignal.timeout(20000) });
    const got = tip.ok ? (await tip.json())?.commit?.sha : "";
    if (got !== sha) problems.push("public-data tip is not the commit just pushed");
  } catch { problems.push("public-data tip could not be read"); }
  try {
    const res = await fetchImpl(`https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/${sha}/research/assets/public/reads.json`, { signal: AbortSignal.timeout(30000) });
    const doc = res.ok ? await res.json() : null;
    if (String(doc?.asOf || "") !== asOf) problems.push("published reads.json is not tonight's day");
  } catch { problems.push("published reads.json could not be read"); }
  for (const path of ["/", "/feed", "/reads"]) {
    try {
      const res = await fetchImpl(`https://catchemtcg.com${path}?publish-check=${Date.now()}`, { signal: AbortSignal.timeout(30000) });
      if (res.status !== 200) problems.push(`catchemtcg.com${path} returned ${res.status}`);
      else {
        const text = await res.text();
        if (text.length < 2000) problems.push(`catchemtcg.com${path} is nearly empty`);
      }
    } catch { problems.push(`catchemtcg.com${path} did not load`); }
  }
  return problems;
}
