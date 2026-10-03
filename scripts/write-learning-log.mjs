// Append one fact line from reads.json. Does not rewrite feed copy.
// Lead length is reads.length. A different count in the file is kept beside it.
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith("--")) out[name] = true;
    else { out[name] = value; i += 1; }
  }
  return out;
}

function localDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isDay(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function noteFromReads(doc) {
  const reads = Array.isArray(doc?.reads) ? doc.reads : null;
  if (!reads) return null;
  let sealed = 0;
  let singles = 0;
  let unnamed = 0;
  const names = [];
  for (const row of reads) {
    if (row?.kind === "sealed") sealed += 1;
    else if (row?.kind === "single") singles += 1;
    if (typeof row?.name === "string" && row.name) names.push(row.name);
    else unnamed += 1;
  }
  const note = { lead: reads.length, sealed, singles, names };
  const untyped = reads.length - sealed - singles;
  if (untyped > 0) note.untyped = untyped;
  if (unnamed > 0) note.unnamed = unnamed;
  if (typeof doc.count === "number" && doc.count !== reads.length) note.count = doc.count;
  if (note.lead !== note.sealed + note.singles + (note.untyped || 0)) return null;
  return note;
}

export async function writeLearningLog({
  root = ROOT,
  reads = join(ROOT, "research/assets/public/reads.json"),
  catalogue = "",
  out = "",
  date = "",
} = {}) {
  const stamp = isDay(date) ? date : localDay();
  let doc;
  try {
    doc = JSON.parse(await readFile(reads, "utf8"));
  } catch (err) {
    const sentence = err && err.code === "ENOENT" ? "The feed file is missing." : "The feed file could not be read.";
    return { exitCode: 1, sentence };
  }
  const note = noteFromReads(doc);
  if (!note) return { exitCode: 1, sentence: "Refused the learning-log line because the reads list could not be counted." };

  if (catalogue) {
    try {
      const extra = JSON.parse(await readFile(catalogue, "utf8"));
      if (typeof extra.count === "number" && extra.count !== note.count && !(extra.count === note.lead && typeof note.count !== "number")) {
        if (extra.count !== note.count) note.catalogueCount = extra.count;
      }
    } catch (err) {
      if (!err || err.code !== "ENOENT") return { exitCode: 1, sentence: "The catalogue file could not be read." };
    }
  }

  const path = out || join(root, "data/learning/feed-loop-notes", `${stamp}.jsonl`);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(note) + "\n", "utf8");
  const countClause = typeof note.count === "number" ? `, and left the file count ${note.count} beside the lead count` : "";
  const catalogueClause = typeof note.catalogueCount === "number" ? `, and left catalogue count ${note.catalogueCount} beside it` : "";
  return {
    exitCode: 0,
    sentence: `Appended ${note.lead} lead lines (${note.singles} singles, ${note.sealed} sealed) to ${path}${countClause}${catalogueClause}.`,
    path,
    note,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const result = await writeLearningLog({
    root: args.root || ROOT,
    reads: args.reads || join(ROOT, "research/assets/public/reads.json"),
    catalogue: args.catalogue === undefined ? join(ROOT, "research/assets/public/feed/catalogue.json") : (args.catalogue || ""),
    out: args.out || "",
    date: args.date || "",
  });
  console.log(result.sentence);
  process.exit(result.exitCode);
}
