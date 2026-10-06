// held-pulse-e2e.mjs — build the whole Pulse with held products present and
// prove none of them reaches an output.
//
//   node scripts/tests/held-pulse-e2e.mjs [--keep]
//
// Works in a throwaway `git worktree` of HEAD, so the real checkout is never
// touched. In that copy it holds one product from every product list the
// Pulse, cards and Discord read (pickHeld, same as held-products.suite), by
// adding them to data/quarantine.json. Then it runs generate-pulse (which
// runs qa-gate, mints cards and builds the social bank), generate-board,
// mint-cards and send-discord-alerts with no webhook set, and greps every
// output. A held product may appear only on the Board and in the feed's
// product catalog, and only labeled held. Not part of run-tests: a full Pulse
// takes a few minutes and opens a headless browser for its smoke checks.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, readdir, symlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const keep = process.argv.includes("--keep");
const today = new Date().toISOString().slice(0, 10);
const dir = await mkdtemp(join(tmpdir(), "held-pulse-"));
const wt = join(dir, "repo");
execFileSync("git", ["-C", REPO, "worktree", "add", "--detach", "-q", wt, "HEAD"], { stdio: "inherit" });
let failed = 0;
try {
  if (existsSync(join(REPO, "node_modules"))) await symlink(join(REPO, "node_modules"), join(wt, "node_modules"));
  const J = async (rel) => { try { return JSON.parse(await readFile(join(wt, rel), "utf8")); } catch { return null; } };
  const { pickHeld, EDITORIAL_FILES } = await import(join(wt, "scripts/tests/held-products.suite.mjs"));
  const sp = await J("data/sealed-prices.json");
  const docs = {};
  for (const rel of EDITORIAL_FILES) docs[rel] = await J(rel);
  const held = [...pickHeld(docs, sp.products || [])];
  const names = held.map((id) => sp.products.find((p) => p.id === id)?.name).filter(Boolean);
  console.log(`holding ${held.length}: ${names.join(" · ")}`);
  const q = await J("data/quarantine.json") || { entries: [] };
  for (const id of held) if (!q.entries.some((e) => e.id === id)) q.entries.push({ id, since: today, by: "held-pulse-e2e", reason: "test hold", clears_when: "test ends" });
  await writeFile(join(wt, "data/quarantine.json"), JSON.stringify(q, null, 2) + "\n");

  const env = { ...process.env, CATCHEM_SKIP_GUARD_AUDIT: "1" };
  delete env.DISCORD_WEBHOOK_URL; delete env.CREATOR_WEBHOOKS_JSON;
  for (const s of ["generate-pulse", "generate-board", "mint-cards", "send-discord-alerts"]) {
    const r = spawnSync("node", [`scripts/${s}.mjs`], { cwd: wt, env, encoding: "utf8", maxBuffer: 1 << 28, timeout: 900000 });
    const tail = `${r.stdout || ""}${r.stderr || ""}`.trim().split("\n").slice(-2).join(" | ");
    console.log(`  ${s}: exit ${r.status} — ${tail.slice(0, 200)}`);
    if (r.status !== 0) { failed += 1; console.error(`  FAIL ${s} exited ${r.status}`); }
  }

  const hit = (text) => {
    const out = [];
    // Names are checked raw and HTML-escaped ("Scarlet &amp; Violet ...").
    for (const n of names) if (text.includes(n) || text.includes(n.replaceAll("&", "&amp;"))) out.push(n);
    for (const id of held) if (text.includes(`"${id}"`)) out.push(id);
    return out;
  };
  const surfaces = [
    `research/pulse/${today}.md`, `research/pulse/${today}.html`, "research/assets/the-pulse.html",
    "research/pulse/social-queue.json", "research/pulse/post-bank.json", "research/pulse/discord-embed-preview.json",
    "research/assets/creators.html",
  ];
  const cards = (await readdir(join(wt, "research/pulse/cards")).catch(() => []))
    .filter((f) => (f.startsWith(today) || f.startsWith("latest-")) && f.endsWith(".svg")).map((f) => `research/pulse/cards/${f}`);
  for (const rel of [...surfaces, ...cards]) {
    let text; try { text = await readFile(join(wt, rel), "utf8"); } catch { continue; }
    const h = hit(text);
    if (h.length) { failed += 1; console.error(`  FAIL ${rel}: ${h.join(", ")}`); }
    else console.log(`  ok  ${rel}`);
  }
  // The feed: every key except the product catalog and its sparklines is
  // editorial; catalog rows for a held product must carry held:true.
  const feed = await J("research/pulse/pulse-feed.json");
  if (!feed) { failed += 1; console.error("  FAIL pulse-feed.json was not written"); }
  else {
    const { products = [], history, ...editorial } = feed;
    const h = hit(JSON.stringify(editorial));
    if (h.length) { failed += 1; console.error(`  FAIL pulse-feed.json editorial keys: ${h.join(", ")}`); } else console.log("  ok  pulse-feed.json editorial keys");
    const unlabeled = products.filter((p) => held.includes(p.id) && !p.held).map((p) => p.id);
    if (unlabeled.length) { failed += 1; console.error(`  FAIL feed catalog rows not labeled held: ${unlabeled.join(", ")}`); } else console.log("  ok  pulse-feed.json catalog rows labeled held");
  }
  // The Board: a held product's row must say held and show no price.
  const board = await readFile(join(wt, "research/assets/the-board.html"), "utf8").catch(() => "");
  const rows = board.split("<tr>").slice(1);
  const badRows = names.filter((n) => rows.some((r) => (r.includes(`>${n}<`) || r.includes(`>${n.replaceAll("&", "&amp;")}<`)) && !/data-label="Median">held</.test(r)));
  if (!board) { failed += 1; console.error("  FAIL the-board.html was not written"); }
  else if (badRows.length) { failed += 1; console.error(`  FAIL Board rows priced instead of held: ${badRows.join(", ")}`); }
  else console.log("  ok  the-board.html held rows labeled, no price");
} finally {
  if (!keep) {
    execFileSync("git", ["-C", REPO, "worktree", "remove", "--force", wt]);
    await rm(dir, { recursive: true, force: true });
  } else console.log(`kept ${wt}`);
}
console.log(failed ? `\n✗ held-pulse e2e: ${failed} problem(s)` : "\n✓ held-pulse e2e: no held product reached an output");
process.exit(failed ? 1 : 0);
