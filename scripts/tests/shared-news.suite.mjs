import { SHARED_NEWS_PATH, newsSlot, stampSharedNews } from "../lib/shared-news.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const night = newsSlot(new Date("2026-10-15T04:00:00.000Z"));
  const noon = newsSlot(new Date("2026-10-14T19:00:00.000Z"));
  t("the night run and the midday run use the same file", night.path === SHARED_NEWS_PATH && noon.path === SHARED_NEWS_PATH && night.path === noon.path);
  t("late evening Pacific is the night slot", night.slot === "nightly" && night.day === "2026-10-14");
  t("noon Pacific is the midday slot", noon.slot === "midday" && noon.day === "2026-10-14");

  const base = { items: [{ url: "https://press.pokemon.com/en/a", title: "A note" }] };
  const once = stampSharedNews(base, { slot: "nightly", day: "2026-10-14", at: "2026-10-15T04:00:00.000Z" });
  const twice = stampSharedNews(once, { slot: "nightly", day: "2026-10-14", at: "2026-10-15T04:05:00.000Z" });
  const both = stampSharedNews(twice, { slot: "midday", day: "2026-10-14", at: "2026-10-14T19:00:00.000Z" });
  t("a second night stamp does not add a second row", twice.runs.length === 1 && twice.items.length === 1);
  t("midday is recorded on the same document", both.runs.length === 2 && both.runs.every((row) => row.path === SHARED_NEWS_PATH));
  t("stamping does not create another news file", both.runs.every((row) => row.path === "research/digests/news.json"));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("shared-news.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
