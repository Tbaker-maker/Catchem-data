// Writes the scored take record to a gitignored private path and, when the
// token is set, to catchem-data-private. The public file is a stub: public
// false, no rows. A missing later daily price is left unscored.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { buildTrackRecord, publicTrackPage, priorReads } from "./lib/track-record.mjs";
import { openPrivate } from "./lib/private-store.mjs";
import { shipPriceMap } from "./lib/second-library.mjs";
import { buildPremiumProof } from "./lib/premium-proof.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REMOTE = "https://github.com/Tbaker-maker/catchem-data-private.git";
const PRIVATE_REL = "data/private/track-record.json";

function runGit(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    let out = "";
    child.stderr.on("data", (buf) => { err += buf.toString(); });
    child.stdout.on("data", (buf) => { out += buf.toString(); });
    child.on("close", (code) => resolve({ code, err, out }));
  });
}

function redact(text, token) {
  return String(text || "").split(token).join("[token]");
}

export async function pushTrackRecord({ token, text, env = process.env, git = runGit } = {}) {
  if (!token) return { pushed: false, reason: "PRIVATE_DATA_TOKEN is not set. Scored rows stay in data/private/." };
  const netrc = join(homedir(), ".netrc");
  const clone = await mkdtemp(join(tmpdir(), "catchem-track-"));
  const childEnv = { ...env, GIT_TERMINAL_PROMPT: "0" };
  try {
    await writeFile(netrc, `machine github.com\nlogin x-access-token\npassword ${token}\n`, { mode: 0o600 });
    const cloned = await git("git", ["clone", "--depth", "1", REMOTE, clone], childEnv);
    if (cloned.code !== 0) return { pushed: false, reason: `Private repo was not cloned (${redact(cloned.err, token) || "clone failed"}).` };
    const file = join(clone, PRIVATE_REL);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text);
    await git("git", ["-C", clone, "config", "user.email", "bot@catchem.app"], childEnv);
    await git("git", ["-C", clone, "config", "user.name", "catchem-bot"], childEnv);
    await git("git", ["-C", clone, "add", "--", PRIVATE_REL], childEnv);
    const quiet = await git("git", ["-C", clone, "diff", "--cached", "--quiet"], childEnv);
    const shaOf = async () => String((await git("git", ["-C", clone, "rev-parse", "HEAD"], childEnv)).out || "").trim();
    if (quiet.code === 0) {
      const sha = await shaOf();
      return { pushed: true, sha, reason: "Private repo already has this track record." };
    }
    const committed = await git("git", ["-C", clone, "commit", "-m", "Store the private track record"], childEnv);
    if (committed.code !== 0) return { pushed: false, reason: `Commit failed (${redact(committed.err || committed.out, token)}).` };
    const pushed = await git("git", ["-C", clone, "push", "origin", "HEAD:main"], childEnv);
    if (pushed.code !== 0) return { pushed: false, reason: `Push failed (${redact(pushed.err || pushed.out, token)}).` };
    return { pushed: true, sha: await shaOf(), reason: "Stored the private track record." };
  } catch (err) {
    return { pushed: false, reason: redact(err.message, token) };
  } finally {
    await rm(netrc, { force: true }).catch(() => {});
    await rm(clone, { recursive: true, force: true }).catch(() => {});
  }
}

// Last night's private rows, so a read that left the board keeps being scored.
async function loadPrior(root, token) {
  try {
    const local = JSON.parse(await readFile(join(root, PRIVATE_REL), "utf8"));
    if (local?.rows?.length) return local;
  } catch { /* not on this machine */ }
  if (!token) return null;
  try {
    const store = await openPrivate({ root, token });
    try { return JSON.parse(await readFile(join(store.dir, "track-record.json"), "utf8")); } catch { return null; } finally { await store.close([], "track record read only"); }
  } catch { return null; }
}

export async function writeTrackRecord(root = ROOT, token = process.env.PRIVATE_DATA_TOKEN || "") {
  const reads = JSON.parse(await readFile(join(root, "research/assets/public/reads.json"), "utf8"));
  const today = String(reads.asOf || "").slice(0, 10);
  const prior = await loadPrior(root, token);
  const prices = await shipPriceMap(root, [...(reads.reads || []), ...priorReads(prior, reads.reads || [])]);
  const doc = buildTrackRecord(reads.reads || [], prices.later, today, prices.ship, prior);
  let receipts = { asOf: today, rows: [] };
  try { receipts = JSON.parse(await readFile(join(root, "research/assets/public/receipts.json"), "utf8")); } catch { /* thin page */ }
  const stub = publicTrackPage(receipts, today);
  if (stub.public !== true || stub.scoreMin || stub.types || stub.rule) {
    throw new Error("public track record leaked a private score");
  }
  const privatePath = join(root, PRIVATE_REL);
  await mkdir(dirname(privatePath), { recursive: true });
  const privateText = JSON.stringify(doc, null, 2) + "\n";
  await writeFile(privatePath, privateText);
  await writeFile(join(root, "research/assets/public/track-record.json"), JSON.stringify(stub, null, 2) + "\n");
  const proof = await buildPremiumProof(root, today);
  await writeFile(join(root, "research/assets/public/premium-proof.json"), JSON.stringify(proof, null, 2) + "\n");
  const pushed = await pushTrackRecord({ token, text: privateText });
  return { doc, stub, pushed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  const { doc, stub, pushed } = await writeTrackRecord(ROOT, token);
  console.log(JSON.stringify({
    asOf: stub.asOf,
    public: stub.public,
    publicRows: stub.rows.length,
    privateRows: doc.count,
    privatePushed: Boolean(pushed.pushed),
    privateReason: pushed.reason,
  }));
  // Self-check of past reads and ratings, and the bounded weight tuner. Private
  // scores go to catchem-data-private with the same token. Never fails this step.
  try {
    const { runSelfCheck } = await import("./self-check.mjs");
    console.log(JSON.stringify({ selfCheck: await runSelfCheck({ root: ROOT, token }) }));
  } catch (err) { console.error(`self-check skipped: ${String(err.message).split(token || "\u0000").join("[token]")}`); }
  if (token && !pushed.pushed) process.exit(1);
}
