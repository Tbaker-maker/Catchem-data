// Fail the daily job when reads, search, or the index wrote nothing.
// Does not fill gaps and does not invent a price. The five missing days stay null.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const GAP_DAYS = ["2026-09-28", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-04"];

export function assessWrites({ reads, search, index }) {
  const problems = [];
  const list = reads && reads.reads;
  if (!Array.isArray(list) || list.length === 0) problems.push("reads wrote nothing");
  const items = search && search.items;
  if (!Array.isArray(items) || items.length === 0) problems.push("search wrote nothing");
  else if (items.some((item) => item && Object.prototype.hasOwnProperty.call(item, "price") && !(Number(item.price) > 0))) {
    problems.push("unpriced was given a price");
  }
  for (const side of ["singles", "sealed"]) {
    const points = index && index[side];
    if (!Array.isArray(points) || points.length === 0) {
      problems.push(`index ${side} wrote nothing`);
      continue;
    }
    for (const day of GAP_DAYS) {
      const point = points.find((row) => row && row.d === day);
      if (point && point.v !== null) problems.push(`index filled gap ${side} ${day}`);
    }
  }
  return problems;
}

function outcomeProblem(label, outcome) {
  if (outcome === "failure") return `${label} wrote nothing`;
  return "";
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function checkPublishWrites(root = ROOT, outcomes = {}) {
  const problems = [];
  for (const [label, outcome] of Object.entries(outcomes)) {
    const note = outcomeProblem(label, outcome);
    if (note) problems.push(note);
  }
  let reads;
  let search;
  let index;
  try { reads = await readJson(join(root, "research/assets/public/reads.json")); }
  catch { problems.push("reads wrote nothing"); }
  try { search = await readJson(join(root, "data/search/search-index.json")); }
  catch { problems.push("search wrote nothing"); }
  try { index = await readJson(join(root, "research/assets/public/indexes.json")); }
  catch { problems.push("index wrote nothing"); }
  if (reads && search && index) problems.push(...assessWrites({ reads, search, index }));
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = await checkPublishWrites(ROOT, {
    reads: process.env.READS_OUTCOME || "",
    search: process.env.SEARCH_OUTCOME || "",
    index: process.env.INDEX_OUTCOME || "",
  });
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log("reads, search, and the index wrote");
}
