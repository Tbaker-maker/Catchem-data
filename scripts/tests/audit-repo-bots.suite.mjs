// No network. Grades are checked against files this test writes in a temp directory.
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  asOfFromHead,
  auditRepo,
  gradeCheck,
  gradeCreators,
  gradeDigest,
  gradeNightly,
  hasSourceUrl,
  learningHits,
  NEWS_REL,
  WEEKLY_REL,
  CHECK_JOBS,
} from "../audit-repo-bots.mjs";

const SCRIPT_URL = new URL("../audit-repo-bots.mjs", import.meta.url);

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const source = await readFile(fileURLToPath(SCRIPT_URL), "utf8");
  t("the audit script does not call the network", !/\bfetch\s*\(|\bebay\b|node:https|node:http|https?:\/\//i.test(source));

  const same = gradeNightly({
    readsFound: true, readsAsOf: "2026-09-27", catalogFound: true, catalogAsOf: "2026-09-27",
  });
  t("matching asOf dates pass and both dates are quoted",
    same.grade === "pass" && same.sentence.includes("2026-09-27") && same.sentence.indexOf("2026-09-27") !== same.sentence.lastIndexOf("2026-09-27"));
  const differ = gradeNightly({
    readsFound: true, readsAsOf: "2026-09-27", catalogFound: true, catalogAsOf: "2026-09-29",
  });
  t("different asOf dates fail and both dates are quoted",
    differ.grade === "fail" && differ.sentence.includes("2026-09-27") && differ.sentence.includes("2026-09-29"));
  const missingDate = gradeNightly({
    readsFound: true, readsAsOf: "yesterday", catalogFound: false, catalogAsOf: undefined,
  });
  t("a missing asOf is not replaced with a date",
    missingDate.grade === "fail" && !/20\d{2}-\d{2}-\d{2}/.test(missingDate.sentence) && missingDate.sentence.includes("missing"));
  t("asOf is read from the top of the file only", asOfFromHead('{\n "asOf": "2026-09-27",\n "items": [{"asOf": "1999-01-01"}]').value === "2026-09-27");

  const half = CHECK_JOBS[0];
  t("a missing check script is not built",
    gradeCheck({ job: half, script: half.script, scriptExists: false, hits: [], today: "2026-10-02" }).grade === "not built");
  t("a check with no learning file is not run",
    gradeCheck({ job: half, script: half.script, scriptExists: true, hits: [], today: "2026-10-02" }).grade === "not run");
  const hits = learningHits([
    "data/learning/half-copies/2026-09-27.json",
    "data/learning/half-price-2026-10-01.json",
  ], half);
  t("half-copies is not treated as the half-price learning file", hits.length === 1 && hits[0].day === "2026-10-01");
  t("the latest learning day passes when today is absent",
    gradeCheck({ job: half, script: half.script, scriptExists: true, hits, today: "2026-10-02" }).grade === "pass"
    && gradeCheck({ job: half, script: half.script, scriptExists: true, hits, today: "2026-10-02" }).sentence.includes("data/learning/half-price-2026-10-01.json"));

  const bare = { title: "No link", date: "2026-10-02", source: "PokeBeach" };
  const sourced = { ...bare, url: "https://press.pokemon.com/en/a" };
  t("a source name is not a source URL", hasSourceUrl(bare) === false && hasSourceUrl(sourced) === true);
  t("news off main is not on main", gradeDigest({ job: "news", rel: NEWS_REL, onMain: false }).grade === "not on main");
  const newsFail = gradeDigest({ job: "news", rel: NEWS_REL, onMain: true, doc: { items: [sourced, bare], filters: { news: { items: [sourced] } } } });
  t("one item without a source URL fails the digest", newsFail.grade === "fail" && newsFail.sentence.includes("1 of 3"));
  const newsPass = gradeDigest({ job: "weekly letter", rel: WEEKLY_REL, onMain: true, doc: { items: [sourced] } });
  t("a digest whose items all have a source URL passes", newsPass.grade === "pass");

  t("creator posts off main are not on main", gradeCreators({ onMain: false }).grade === "not on main");
  t("an empty public creator file passes",
    gradeCreators({ onMain: true, publicDoc: { audience: "public", posts: [] } }).grade === "pass");
  const leaked = gradeCreators({
    onMain: true,
    publicDoc: { audience: "public", posts: [{ id: "hidden-post", text: "no" }] },
    storeDoc: { posts: [{ id: "hidden-post", approved: false, submitterTier: "premium" }] },
  });
  t("an unapproved creator post in the public file fails", leaked.grade === "fail" && leaked.sentence.includes("hidden-post"));

  const dir = await mkdtemp(join(tmpdir(), "audit-bots-"));
  await mkdir(join(dir, "research/assets/public"), { recursive: true });
  await mkdir(join(dir, "data/catalog"), { recursive: true });
  await mkdir(join(dir, "data/learning"), { recursive: true });
  await writeFile(join(dir, "research/assets/public/reads.json"), '{ "asOf": "2026-09-27", "reads": [] }\n');
  await writeFile(join(dir, "data/catalog/tcgcsv-latest.json"), '{ "asOf": "2026-09-27", "items": [] }\n');
  const mainFiles = new Map();
  const report = await auditRepo(dir, {
    today: "2026-10-02",
    onMain: async (rel) => mainFiles.has(rel),
    readMainJson: async (rel) => mainFiles.get(rel),
  });
  t("the temp repo does not invent a pass for jobs that are not built",
    report.grades.filter((row) => row.job === "half-price" || row.job === "stale" || row.job === "coverage" || row.job === "learning log")
      .every((row) => row.grade === "not built"));
  t("the temp nightly grade passes only because both files say 2026-09-27",
    report.grades[0].grade === "pass" && report.grades[0].sentence.includes("2026-09-27"));
  t("fail count counts only fail grades", report.failCount === 0 && report.grades.some((row) => row.grade === "not on main"));

  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("audit-repo-bots.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
