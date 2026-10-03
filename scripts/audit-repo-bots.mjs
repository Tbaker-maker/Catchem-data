// Grades the other Catch'em repo jobs from files already in this checkout.
// No network. No prices. A grade is written only from a file that was read.
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const READS_REL = "research/assets/public/reads.json";
export const CATALOG_REL = "data/catalog/tcgcsv-latest.json";
export const NEWS_REL = "research/digests/news.json";
export const WEEKLY_REL = "research/digests/weekly-news.json";
export const CREATOR_REL = "research/assets/public/creator-posts.json";
export const CREATOR_STORE_REL = "data/creator-posts.json";

export const CHECK_JOBS = [
  { job: "half-price", script: "scripts/check-half-price.mjs", marker: "half-price" },
  { job: "stale", script: "scripts/check-stale.mjs", marker: "stale" },
  { job: "coverage", script: "scripts/check-coverage.mjs", marker: "coverage" },
  { job: "learning log", script: "scripts/write-learning-log.mjs", marker: "feed-loop-notes", ext: ".jsonl" },
];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function ptDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isDay(value) {
  return typeof value === "string" && DAY_RE.test(value);
}

export function asOfFromHead(text) {
  const match = String(text).match(/^\uFEFF?\s*\{\s*"asOf"\s*:\s*("(?:\\.|[^"\\])*"|null|true|false|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
  if (!match) return { found: false, value: undefined };
  try {
    return { found: true, value: JSON.parse(match[1]) };
  } catch {
    return { found: false, value: undefined };
  }
}

function shownAsOf(found, value) {
  if (!found) return "missing";
  if (value == null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return "not a date";
}

export function gradeNightly({ readsFound, readsAsOf, catalogFound, catalogAsOf, readsMissing, catalogMissing }) {
  const job = "nightly price/feed";
  if (readsMissing || catalogMissing) {
    const missing = [
      readsMissing ? READS_REL : "",
      catalogMissing ? CATALOG_REL : "",
    ].filter(Boolean).join(" and ");
    return {
      job,
      grade: "fail",
      sentence: `${missing} is missing, so the two asOf dates were not compared.`,
    };
  }
  const readsDay = readsFound && isDay(readsAsOf) ? readsAsOf : "";
  const catalogDay = catalogFound && isDay(catalogAsOf) ? catalogAsOf : "";
  if (!readsDay || !catalogDay) {
    return {
      job,
      grade: "fail",
      sentence: `${READS_REL} asOf is ${shownAsOf(readsFound, readsAsOf)} and ${CATALOG_REL} asOf is ${shownAsOf(catalogFound, catalogAsOf)}.`,
    };
  }
  if (readsDay === catalogDay) {
    return {
      job,
      grade: "pass",
      sentence: `${READS_REL} asOf ${readsDay} equals ${CATALOG_REL} asOf ${catalogDay}.`,
    };
  }
  return {
    job,
    grade: "fail",
    sentence: `${READS_REL} asOf ${readsDay} does not equal ${CATALOG_REL} asOf ${catalogDay}.`,
  };
}

export function learningHits(files, job) {
  const hits = [];
  for (const rel of files) {
    const slash = rel.split("\\").join("/");
    if (!slash.startsWith("data/learning/")) continue;
    if (!slash.includes(job.marker)) continue;
    if (job.ext && !slash.endsWith(job.ext)) continue;
    const match = slash.match(/(\d{4}-\d{2}-\d{2})/);
    if (!match) continue;
    hits.push({ rel: slash, day: match[1] });
  }
  hits.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.rel.localeCompare(b.rel)));
  return hits;
}

export function gradeCheck({ job, script, scriptExists, hits, today }) {
  if (!scriptExists) {
    return { job: job.job, grade: "not built", sentence: `${script} is not in the repo.` };
  }
  if (!hits.length) {
    return {
      job: job.job,
      grade: "not run",
      sentence: `${script} is in the repo and no dated learning file for this job is under data/learning.`,
    };
  }
  const todayHit = hits.find((hit) => hit.day === today);
  const cited = todayHit || hits[0];
  const when = todayHit ? "today" : "the latest day";
  return {
    job: job.job,
    grade: "pass",
    sentence: `${script} is in the repo and ${cited.rel} is a learning file for ${when} (${cited.day}).`,
  };
}

export function hasSourceUrl(item) {
  return typeof item?.url === "string" && /^https?:\/\/\S+$/.test(item.url);
}

export function gradeDigest({ job, rel, onMain, doc, readError }) {
  if (!onMain) {
    return { job, grade: "not on main", sentence: `${rel} is not on main.` };
  }
  if (readError || doc == null) {
    return { job, grade: "fail", sentence: `${rel} is on main and could not be read.` };
  }
  if (!Array.isArray(doc.items)) {
    return {
      job,
      grade: "fail",
      sentence: `${rel} is on main and has no items list, so a source URL was not checked.`,
    };
  }
  const groups = [doc.items];
  if (rel === NEWS_REL && doc.filters && Object.prototype.hasOwnProperty.call(doc.filters, "news")) {
    const extra = doc.filters.news?.items;
    if (!Array.isArray(extra)) {
      return {
        job,
        grade: "fail",
        sentence: `${rel} is on main and filters.news.items is not a list.`,
      };
    }
    groups.push(extra);
  }
  let total = 0;
  let missing = 0;
  for (const group of groups) {
    for (const item of group) {
      total += 1;
      if (!hasSourceUrl(item)) missing += 1;
    }
  }
  if (missing > 0) {
    return {
      job,
      grade: "fail",
      sentence: `${rel} is on main and ${missing} of ${total} items lack a source URL.`,
    };
  }
  return {
    job,
    grade: "pass",
    sentence: `${rel} is on main and all ${total} items have a source URL.`,
  };
}

export function unapprovedInPublic(publicDoc, storeDoc) {
  const posts = Array.isArray(publicDoc?.posts) ? publicDoc.posts : [];
  const bad = [];
  for (const post of posts) {
    if (post && post.approved === false) bad.push(post.id || "(no id)");
  }
  if (storeDoc && Array.isArray(storeDoc.posts)) {
    const approved = new Set(
      storeDoc.posts
        .filter((post) => post && post.approved === true && post.submitterTier === "premium")
        .map((post) => post.id),
    );
    for (const post of posts) {
      if (!approved.has(post?.id)) bad.push(post?.id || "(no id)");
    }
    const blob = JSON.stringify(publicDoc ?? {});
    for (const post of storeDoc.posts) {
      if (!post || post.approved === true) continue;
      if (post.id && blob.includes(post.id)) bad.push(post.id);
    }
  }
  return [...new Set(bad)];
}

export function gradeCreators({ onMain, publicDoc, storeDoc, readError }) {
  if (!onMain) {
    return { job: "creator posts", grade: "not on main", sentence: `${CREATOR_REL} is not on main.` };
  }
  if (readError || publicDoc == null) {
    return { job: "creator posts", grade: "fail", sentence: `${CREATOR_REL} is on main and could not be read.` };
  }
  if (!Array.isArray(publicDoc.posts)) {
    return { job: "creator posts", grade: "fail", sentence: `${CREATOR_REL} is on main and has no posts list.` };
  }
  const bad = unapprovedInPublic(publicDoc, storeDoc);
  if (bad.length) {
    return {
      job: "creator posts",
      grade: "fail",
      sentence: `${CREATOR_REL} is on main and contains unapproved post ${bad.join(", ")}.`,
    };
  }
  return {
    job: "creator posts",
    grade: "pass",
    sentence: `${CREATOR_REL} is on main and contains no unapproved post.`,
  };
}

export function buildReport({ today, nightly, checks, news, weekly, creators }) {
  const grades = [nightly, ...checks, news, weekly, creators];
  const failCount = grades.filter((row) => row.grade === "fail").length;
  return { date: today, failCount, grades };
}

async function exists(path) {
  try {
    await readFile(path);
    return true;
  } catch (err) {
    if (err && err.code === "ENOENT") return false;
    throw err;
  }
}

async function readHead(path, bytes = 1024) {
  const fh = await (await import("node:fs/promises")).open(path, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead).toString("utf8");
  } finally {
    await fh.close();
  }
}

async function listLearning(root) {
  const base = join(root, "data/learning");
  const files = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err && err.code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else if (entry.isFile()) files.push(relative(root, abs));
    }
  }
  await walk(base);
  return files;
}

async function onOriginMain(root, rel) {
  try {
    await execFileAsync("git", ["cat-file", "-e", `origin/main:${rel}`], { cwd: root });
    return true;
  } catch {
    return false;
  }
}

async function readOriginMainJson(root, rel) {
  const { stdout } = await execFileAsync("git", ["show", `origin/main:${rel}`], {
    cwd: root,
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

export async function auditRepo(root, { today = ptDay(), onMain, readMainJson } = {}) {
  const seeMain = onMain || ((rel) => onOriginMain(root, rel));
  const readMain = readMainJson || ((rel) => readOriginMainJson(root, rel));

  const readsPath = join(root, READS_REL);
  const catalogPath = join(root, CATALOG_REL);
  const readsMissing = !(await exists(readsPath));
  const catalogMissing = !(await exists(catalogPath));
  let readsFound = false;
  let readsAsOf;
  let catalogFound = false;
  let catalogAsOf;
  if (!readsMissing) {
    const head = asOfFromHead(await readHead(readsPath));
    readsFound = head.found;
    readsAsOf = head.value;
  }
  if (!catalogMissing) {
    const head = asOfFromHead(await readHead(catalogPath));
    catalogFound = head.found;
    catalogAsOf = head.value;
  }
  const nightly = gradeNightly({ readsFound, readsAsOf, catalogFound, catalogAsOf, readsMissing, catalogMissing });

  const learning = await listLearning(root);
  const checks = [];
  for (const job of CHECK_JOBS) {
    const scriptExists = await exists(join(root, job.script));
    const hits = learningHits(learning, job);
    checks.push(gradeCheck({ job, script: job.script, scriptExists, hits, today }));
  }

  async function digest(job, rel) {
    const present = await seeMain(rel);
    if (!present) return gradeDigest({ job, rel, onMain: false });
    try {
      const doc = await readMain(rel);
      return gradeDigest({ job, rel, onMain: true, doc });
    } catch {
      return gradeDigest({ job, rel, onMain: true, readError: true });
    }
  }

  const news = await digest("news", NEWS_REL);
  const weekly = await digest("weekly letter", WEEKLY_REL);

  const creatorsOnMain = await seeMain(CREATOR_REL);
  let creators;
  if (!creatorsOnMain) {
    creators = gradeCreators({ onMain: false });
  } else {
    try {
      const publicDoc = await readMain(CREATOR_REL);
      let storeDoc = null;
      if (await seeMain(CREATOR_STORE_REL)) {
        try {
          storeDoc = await readMain(CREATOR_STORE_REL);
        } catch {
          storeDoc = null;
        }
      }
      creators = gradeCreators({ onMain: true, publicDoc, storeDoc });
    } catch {
      creators = gradeCreators({ onMain: true, readError: true });
    }
  }

  return buildReport({ today, nightly, checks, news, weekly, creators });
}

export function formatReport(report) {
  const lines = report.grades.map((row) => `${row.job}: ${row.grade} — ${row.sentence}`);
  lines.push(`fails: ${report.failCount}`);
  return lines.join("\n");
}

async function main() {
  const today = ptDay();
  const report = await auditRepo(ROOT, { today });
  const outRel = join("data", "learning", `grades-${today}.json`);
  const outAbs = join(ROOT, outRel);
  await mkdir(dirname(outAbs), { recursive: true });
  await writeFile(outAbs, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(formatReport(report));
  console.log(`wrote ${outRel}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}
