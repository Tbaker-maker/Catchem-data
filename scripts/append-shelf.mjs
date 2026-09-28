// Append today's shelf rows to the private learning log. Does not write a
// public file and does not fetch listings.
import { readFile } from "node:fs/promises";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { redact } from "./lib/private-ppt.mjs";
import { appendShelfText, ptDate, shelfRows } from "./lib/shelf.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REMOTE = "https://github.com/Tbaker-maker/catchem-data-private.git";
const REL = "data/learning/shelf.jsonl";

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    let out = "";
    child.stderr.on("data", (buf) => { err += buf.toString(); });
    child.stdout.on("data", (buf) => { out += buf.toString(); });
    child.on("close", (code) => resolve({ code, err, out }));
  });
}

export async function loadShelfInputs(root = ROOT) {
  const sealed = JSON.parse(await readFile(join(root, "data/sealed-prices.json"), "utf8"));
  const map = JSON.parse(await readFile(join(root, "data/crosscheck-id-map.json"), "utf8"));
  const date = ptDate(sealed.updatedAt);
  let prices = [];
  if (date) {
    try {
      const day = JSON.parse(await readFile(join(root, "data/history/tcgcsv-daily", `${date}.json`), "utf8"));
      if (day.date === date) prices = day.prices || [];
    } catch (err) {
      if (!err || err.code !== "ENOENT") throw err;
    }
  }
  const rows = shelfRows({ products: sealed.products, entries: map.entries, prices, date });
  return { date, rows };
}

export async function pushShelf({ token, rows, date, env = process.env, runGit = run }) {
  if (!token) return { pushed: false, reason: "PRIVATE_DATA_TOKEN is not set. Shelf rows were not pushed." };
  if (!rows?.length) return { pushed: false, reason: "No shelf rows to store." };
  const netrc = join(homedir(), ".netrc");
  const clone = await mkdtemp(join(tmpdir(), "catchem-shelf-"));
  const childEnv = { ...env, GIT_TERMINAL_PROMPT: "0" };
  try {
    await writeFile(netrc, `machine github.com\nlogin x-access-token\npassword ${token}\n`, { mode: 0o600 });
    const cloned = await runGit("git", ["clone", "--depth", "1", REMOTE, clone], childEnv);
    if (cloned.code !== 0) return { pushed: false, reason: `Private repo was not cloned (${redact(cloned.err, [token]) || "clone failed"}).` };
    const file = join(clone, REL);
    let existing = "";
    try { existing = await readFile(file, "utf8"); } catch (err) { if (!err || err.code !== "ENOENT") throw err; }
    const next = appendShelfText(existing, rows);
    if (!next.added) {
      const sha = await runGit("git", ["-C", clone, "rev-parse", "HEAD"], childEnv);
      return { pushed: false, added: 0, sha: String(sha.out || "").trim(), reason: `Shelf already has ${date}.` };
    }
    await writeFile(file, next.text);
    await runGit("git", ["-C", clone, "config", "user.email", "bot@catchem.app"], childEnv);
    await runGit("git", ["-C", clone, "config", "user.name", "catchem-bot"], childEnv);
    await runGit("git", ["-C", clone, "add", REL], childEnv);
    const committed = await runGit("git", ["-C", clone, "commit", "-m", `Store shelf counts for ${date}`], childEnv);
    if (committed.code !== 0) return { pushed: false, reason: `Commit failed (${redact(committed.err || committed.out, [token])}).` };
    const pushed = await runGit("git", ["-C", clone, "push", "origin", "HEAD:main"], childEnv);
    if (pushed.code !== 0) return { pushed: false, reason: `Push failed (${redact(pushed.err || pushed.out, [token])}).` };
    const sha = await runGit("git", ["-C", clone, "rev-parse", "HEAD"], childEnv);
    return { pushed: true, added: next.added, sha: String(sha.out || "").trim(), reason: `Stored ${next.added} shelf rows for ${date}.` };
  } catch (err) {
    return { pushed: false, reason: redact(err.message, [token]) };
  } finally {
    await rm(netrc, { force: true }).catch(() => {});
    await rm(clone, { recursive: true, force: true }).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { date, rows } = await loadShelfInputs();
  console.log(`shelf ${date || "no date"} rows ${rows.length}`);
  if (process.argv.includes("--dry-run")) process.exit(0);
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  const result = await pushShelf({ token, rows, date });
  console.log(result.reason || "shelf done");
  process.exit(token && rows.length && !result.pushed && result.added !== 0 ? 1 : 0);
}
