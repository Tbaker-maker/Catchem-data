import { readFileSync } from "node:fs";
import { buildOutbox, dueOn, fetchFollows, memberMatch, poolFromData, putOutbox } from "../lib/custom-reads-pipe.mjs";
import { isClean } from "../lib/copy-rules.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const catalogue = { asOf: "2026-10-18", sets: [{ slug: "me-30th-celebration", name: "ME: 30th Celebration", released: true, prices: [{ id: "tcgcsv-1", number: "001/100", price: 12.5 }, { id: "tcgcsv-2", number: "002/100", price: 3 }] }] };
  const sealed = { updatedAt: "2026-10-18T13:00:00Z", products: [{ id: "x-etb", name: "30th Celebration Elite Trainer Box", set: "30th Celebration", tcgPlayerId: "77", dataStatus: "live", askMedian: 80, listingCount: 40 }] };
  const pool = poolFromData({ catalogue, sealed });
  t("pool has a set line, card lines and a sealed line", pool.reads.some((r) => r.kind === "single") && pool.reads.filter((r) => r.kind === "card").length === 2 && pool.reads.some((r) => r.kind === "sealed" && r.set === "me-30th-celebration"));
  t("sealed lines say listings counted and never NM", pool.reads.filter((r) => r.kind === "sealed").every((r) => r.line.includes("listings counted") && !/\bNM\b/.test(r.line) && !/\bsold\b|\bsales\b/i.test(r.line)));
  t("every pool line is clean and has no dashes", pool.reads.every((r) => isClean(r.line) && !/[\u2013\u2014]/.test(r.line)));
  const follow = { id: "123456789012345678", discordId: "123456789012345678", sets: ["me-30th-celebration"], cards: [], sealed: [], kinds: ["single"], frequency: "weekly" };
  t("a set follow gets its set line, not every card", pool.reads.filter((r) => memberMatch(follow, r)).length === 1);
  t("a kind alone does not match the whole catalogue", pool.reads.filter((r) => memberMatch({ kinds: ["single"] }, r)).length === 0);
  t("a watched card matches", pool.reads.some((r) => memberMatch({ cards: ["tcgcsv-1"] }, r) && r.cardId === "tcgcsv-1"));
  t("a watched sealed product matches", pool.reads.some((r) => memberMatch({ sealed: ["tcgcsv-77"] }, r) && r.kind === "sealed"));
  const sunday = "2026-10-18";
  const now = Date.parse("2026-10-18T04:00:00Z");
  t("weekly lands on Sunday", dueOn(follow, sunday, now) && !dueOn(follow, "2026-10-19", now));
  t("a fresh Save gets a first read the next night", dueOn({ ...follow, savedAt: "2026-10-19T17:00:00Z" }, "2026-10-20", Date.parse("2026-10-20T04:00:00Z")));
  t("monthly and quarterly land on day one", dueOn({ frequency: "monthly" }, "2026-11-01", now) && !dueOn({ frequency: "quarterly" }, "2026-11-01", now) && dueOn({ frequency: "quarterly" }, "2026-10-01", now));
  const out = buildOutbox({ follows: [follow, { id: "bad" }, { ...follow, id: "222222222222", discordId: "222222222222", sets: ["nope"] }], pool, now });
  t("outbox holds one DM per due member with reads", out.members.length === 1 && out.members[0].discordId === "123456789012345678" && out.members[0].reads.length === 1 && out.counts.quiet === 1);
  t("outbox lead is clean", isClean(out.members[0].lead) && !/[\u2013\u2014]/.test(out.members[0].lead));
  let seen = null;
  const fake = async (url, init = {}) => { seen = { url: String(url), init }; return new Response(JSON.stringify(init.method === "PUT" ? { ok: true, members: 1 } : { ok: true, follows: [follow] }), { status: 200 }); };
  const got = await fetchFollows({ base: "https://catchemtcg.com", token: "secret-token", fetchImpl: fake });
  t("follows come from the export endpoint with a bearer", got.length === 1 && seen.url.endsWith("/api/reads/export") && seen.init.headers.authorization === "Bearer secret-token");
  await putOutbox({ base: "https://catchemtcg.com", token: "secret-token", outbox: out, fetchImpl: fake });
  t("the outbox goes back with PUT and no counts", seen.init.method === "PUT" && !JSON.parse(seen.init.body).counts);
  const script = readFileSync(new URL("../build-custom-reads-members.mjs", import.meta.url), "utf8");
  t("the member script never logs the token or writes member files", !/console\.log\([^)]*token/.test(script) && !script.includes("writeFile"));
  const wf = readFileSync(new URL("../../.github/workflows/update-sealed-prices.yml", import.meta.url), "utf8");
  t("the nightly runs the member step with the secret", wf.includes("node scripts/build-custom-reads-members.mjs") && wf.includes("secrets.CUSTOM_READS_TOKEN"));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("custom-reads-pipe.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
