// Root cause of the 2026-10-20 failed price run: the price run and the Listing counts run
// both wrote data/derived/listing-counts/ and the rebase before push stopped on conflicts,
// so the sealed prices commit and the public feed never landed. This builds that exact
// conflict in a scratch repo and checks the resolver lands both sides' reads and calls.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";

const RESOLVER = fileURLToPath(new URL("../resolve-listing-counts-conflict.mjs", import.meta.url));
const LIB = fileURLToPath(new URL("../lib/listing-counts-merge.mjs", import.meta.url));

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name} ${detail}`); }
  };
  const root = mkdtempSync(join(tmpdir(), "lc-merge-"));
  const remote = join(root, "remote.git"), work = join(root, "work"), other = join(root, "other");
  const g = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const D = "data/derived/listing-counts";
  const write = (dir, { state, latest, usage, hist, extra }) => {
    mkdirSync(join(dir, D, "history"), { recursive: true });
    mkdirSync(join(dir, "scripts/lib"), { recursive: true });
    writeFileSync(join(dir, D, "state.json"), JSON.stringify(state) + "\n");
    writeFileSync(join(dir, D, "latest.json"), JSON.stringify(latest) + "\n");
    writeFileSync(join(dir, D, "api-usage.json"), JSON.stringify(usage, null, 1) + "\n");
    if (hist) writeFileSync(join(dir, D, "history/2026-10-20.json.gz"), gzipSync(JSON.stringify(hist)));
    if (extra) writeFileSync(join(dir, "data-sealed.json"), extra);
  };
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote]);
  g(root, "clone", "-q", remote, work);
  for (const d of [work]) { g(d, "config", "user.email", "t@t"); g(d, "config", "user.name", "t"); }
  write(work, {
    state: { last: { a: "2026-10-19T09:00:00Z", b: "2026-10-19T09:00:00Z" }, log: [{ at: "2026-10-19T09:00:00Z", n: 5, source: "listing-counts" }] },
    latest: { rows: { a: { id: "a", date: "2026-10-19", listingsCounted: 1 }, b: { id: "b", date: "2026-10-19", listingsCounted: 1 } }, asOf: "2026-10-19" },
    usage: { nights: [{ date: "2026-10-19", at: "2026-10-19T09:00:00Z", ebayBrowse: { listingCountCalls: 5 } }] },
  });
  g(work, "add", "-A"); g(work, "commit", "-qm", "base"); g(work, "push", "-q", "origin", "main");
  g(root, "clone", "-q", remote, other);
  g(other, "config", "user.email", "t@t"); g(other, "config", "user.name", "t");
  // Standalone Listing counts run pushes first (counts id a at 09:45).
  write(other, {
    state: { last: { a: "2026-10-20T09:45:00Z", b: "2026-10-19T09:00:00Z" }, log: [{ at: "2026-10-19T09:00:00Z", n: 5, source: "listing-counts" }, { at: "2026-10-20T09:45:00Z", n: 700, source: "listing-counts" }] },
    latest: { rows: { a: { id: "a", date: "2026-10-20", listingsCounted: 10 }, b: { id: "b", date: "2026-10-19", listingsCounted: 1 } }, asOf: "2026-10-20" },
    usage: { nights: [{ date: "2026-10-19", at: "2026-10-19T09:00:00Z", ebayBrowse: { listingCountCalls: 5 } }, { date: "2026-10-20", at: "2026-10-20T09:45:00Z", ebayBrowse: { listingCountCalls: 700 } }] },
    hist: { date: "2026-10-20", rows: [{ id: "a", date: "2026-10-20", listingsCounted: 10 }] },
  });
  g(other, "add", "-A"); g(other, "commit", "-qm", "data: listing counts"); g(other, "push", "-q", "origin", "main");
  // Price run (after-sealed listing step counts id b at 10:05) commits prices too, then tries to push.
  write(work, {
    state: { last: { a: "2026-10-19T09:00:00Z", b: "2026-10-20T10:05:00Z" }, log: [{ at: "2026-10-19T09:00:00Z", n: 5, source: "listing-counts" }, { at: "2026-10-20T10:05:00Z", n: 60, source: "listing-counts" }] },
    latest: { rows: { a: { id: "a", date: "2026-10-19", listingsCounted: 1 }, b: { id: "b", date: "2026-10-20", listingsCounted: 20 } }, asOf: "2026-10-20" },
    usage: { nights: [{ date: "2026-10-19", at: "2026-10-19T09:00:00Z", ebayBrowse: { listingCountCalls: 5 } }, { date: "2026-10-20", at: "2026-10-20T10:05:00Z", ebayBrowse: { listingCountCalls: 60 } }] },
    hist: { date: "2026-10-20", rows: [{ id: "b", date: "2026-10-20", listingsCounted: 20 }] },
    extra: "prices\n",
  });
  g(work, "add", "-A"); g(work, "commit", "-qm", "data: sealed prices");
  let pulled = true;
  try { g(work, "pull", "-q", "--rebase", "--autostash", "origin", "main"); } catch { pulled = false; }
  t("the scenario reproduces the conflict", pulled === false);
  // The resolver imports its lib relative to itself; run it from the real scripts folder inside the scratch repo.
  let ok = true, out = "";
  try { out = execFileSync("node", [RESOLVER], { cwd: work, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { ok = false; out = String(e.stderr || e.message); }
  t("the resolver finishes the rebase", ok && !existsSync(join(work, ".git/rebase-merge")), out);
  const rd = (f) => JSON.parse(readFileSync(join(work, D, f), "utf8"));
  const latest = rd("latest.json"), state = rd("state.json"), usage = rd("api-usage.json");
  t("latest keeps the standalone run's read for a", latest.rows.a.listingsCounted === 10);
  t("latest keeps the price run's read for b", latest.rows.b.listingsCounted === 20);
  t("both runs' eBay calls stay in the 24h log", state.log.reduce((s, e) => s + e.n, 0) === 765, JSON.stringify(state.log));
  t("api usage keeps both runs", usage.nights.filter((n) => n.date === "2026-10-20").length === 2);
  const hist = JSON.parse(gunzipSync(readFileSync(join(work, D, "history/2026-10-20.json.gz"))));
  t("today's history has both ids", hist.rows.map((r) => r.id).sort().join(",") === "a,b");
  t("the price data commit is still on top", g(work, "log", "-1", "--format=%s").trim() === "data: sealed prices" && existsSync(join(work, "data-sealed.json")));
  let pushed = true;
  try { g(work, "push", "-q", "origin", "main"); } catch { pushed = false; }
  t("the price commit pushes after the merge", pushed);

  // Any conflict outside listing counts aborts the rebase instead of leaving a half-rebased tree.
  g(other, "pull", "-q", "origin", "main");
  writeFileSync(join(other, "data-sealed.json"), "theirs\n"); g(other, "commit", "-qam", "x"); g(other, "push", "-q", "origin", "main");
  writeFileSync(join(work, "data-sealed.json"), "ours\n"); g(work, "commit", "-qam", "y");
  try { g(work, "pull", "-q", "--rebase", "origin", "main"); } catch {}
  let exitCode = 0;
  try { execFileSync("node", [RESOLVER], { cwd: work, stdio: "ignore" }); } catch (e) { exitCode = e.status; }
  t("a conflict outside listing counts exits 1 and aborts", exitCode === 1 && !existsSync(join(work, ".git/rebase-merge")));
  t("the merge lib exists for the workflow", existsSync(LIB));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("listing-counts-merge.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
