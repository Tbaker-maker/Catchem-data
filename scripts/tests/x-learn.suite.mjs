// x-learn.suite.mjs: X price-call rating rules, restock parse/dedupe/study, no-token no-op, public output has no names.
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rateAccounts, parseRestock, dedupeRestocks, restockStudy, rateRestockAccounts, spamShare, MIN_RATED } from "../lib/x-accounts.mjs";
import { runXLearn, postsFromResponse, makeXClient } from "../x-learn.mjs";

export async function run() {
  let fail = 0;
  const t = (n, c) => { if (c) console.log(`    ✓ ${n}`); else { fail++; console.error(`    ✗ ${n}`); } };
  const mk = (h, held, n) => Array.from({ length: n }, (_, i) => ({ id: `${h}${i}`, channel: h, target: "sealed", pid: 1, confidence: 1, h30: { held: i < held, excess: 0.05 } }));
  const accts = [{ handle: "good", category: "creator" }, { handle: "few", category: "creator" }, { handle: "bad", category: "creator" }, { handle: "spam", category: "creator" }, { handle: "news1", category: "news" }];
  const claims = [...mk("good", 15, 20), ...mk("few", 5, 5), ...mk("bad", 5, 20)];
  const r = Object.fromEntries(rateAccounts(accts, claims, { spam: [{ text: "GIVEAWAY retweet" }, { text: "giveaway!" }] }).map((a) => [a.handle, a]));
  t("20+ scored and good hit rate = tracked", r.good.status === "tracked" && r.good.hitRate === 75);
  t("under 20 scored = trial, unrated", r.few.status === "trial" && r.few.hitRate === null && MIN_RATED === 20);
  t("20+ scored under the bar = rejected", r.bad.status === "rejected");
  t("giveaway account = rejected", r.spam.status === "rejected");
  t("news account = source, not scored", r.news1.status === "source");
  t("spam share", spamShare([{ text: "solana:abc pump" }, { text: "ok" }]) === 0.5);

  const p = (id, ts, text, h) => parseRestock({ id, created_at: ts, text }, h, null);
  const a = p("1", "2026-10-09T09:18:23.000Z", "30th Celebration Elite Trainer Box live at Target! 🎯 https://t.co/x #ad", "A");
  t("parses retailer and keeps product null without a verified id", a.retailer === "target" && a.product === null && a.productText.includes("elite trainer box"));
  t("expected/queue posts are not events", p("2", "2026-10-09T01:00:00Z", "Walmart queue at 9 p.m. ET tonight, drop expected at 9PM", "A") === null);
  const b = p("3", "2026-10-09T09:40:00.000Z", "30th Celebration Elite Trainer Box live at Target! 🎯", "B");
  const c = p("4", "2026-10-12T09:40:00.000Z", "30th Celebration Elite Trainer Box live at Target!", "B");
  const ev = dedupeRestocks([a, b, c]);
  t("same restock from two accounts inside 3h dedupes", ev.length === 2 && ev[0].seenBy.length === 2);
  const st = restockStudy(ev);
  t("study counts retailer, PT day and gap", st.byRetailer.target === 2 && st.byDowPT.Fri === 1 && Object.values(st.gaps)[0].medianGapDays === 3);
  const rr = Object.fromEntries(rateRestockAccounts(ev, ["A", "B"]).map((x) => [x.handle, x]));
  t("restock account speed and accuracy", rr.A.medianLeadMin === 22 && rr.A.accuracyPct === 100 && rr.B.unconfirmed === 1);

  const resp = { data: [{ id: "9", created_at: "2026-10-01T00:00:00Z", text: "hi", author_id: "u1" }], includes: { users: [{ id: "u1", username: "h1" }] } };
  t("posts from saved responses carry the handle", postsFromResponse(resp, new Map())[0].handle === "h1");
  const cl = makeXClient({ token: "x", budget: 1, fetchFn: async () => ({ ok: true, json: async () => ({}) }) });
  await cl.get("a", {}); let blocked = false; try { await cl.get("b", {}); } catch (e) { blocked = Boolean(e.budget); }
  t("nightly call budget is enforced", blocked);

  const root = await mkdtemp(join(tmpdir(), "x-learn-"));
  await mkdir(join(root, "data/private/x"), { recursive: true });
  await writeFile(join(root, "data/private/x/config.json"), JSON.stringify({ accounts: [{ handle: "SecretHandle", id: "u1", category: "creator" }] }));
  const d = await runXLearn({ root, token: "", fetchFn: async () => { throw new Error("no network without token"); } });
  const pub = await readFile(join(root, "data/derived/x-status.json"), "utf8");
  t("no token = no-op, no network", d.status === "token_missing");
  t("public status has no handles", !pub.includes("SecretHandle"));
  await mkdir(join(root, "data/catalog"), { recursive: true }); await mkdir(join(root, "data/history/tcgcsv-daily"), { recursive: true });
  const imp = join(root, "imp"); await mkdir(imp);
  await writeFile(join(imp, "a.json"), JSON.stringify({ data: [{ id: "5", created_at: "2026-10-09T09:00:00Z", text: "ETB live at Target!", author_id: "u1" }] }));
  const r2 = await runXLearn({ root, importDir: imp });
  const pub2 = await readFile(join(root, "data/derived/x-status.json"), "utf8");
  t("config read from the private store; import works", r2.posts === 1 && !pub2.includes("SecretHandle"));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("x-learn.suite.mjs")) process.exit(await run() ? 1 : 0);
