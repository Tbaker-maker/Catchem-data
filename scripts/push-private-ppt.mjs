// Push raw PPT into Tbaker-maker/catchem-data-private.
// No token, or a failed clone: log and exit 0. The token is never printed.
// This step replaces the public Actions artifact. Raw files are not uploaded.
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { redact, stagePrivate } from "./lib/private-ppt.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REMOTE = "https://github.com/Tbaker-maker/catchem-data-private.git";

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

export async function pushPrivate({ token, checkout = ROOT, rawDir, date, env = process.env, runGit = run } = {}) {
  if (!token) {
    return { pushed: false, reason: "PRIVATE_DATA_TOKEN is not set. Raw PPT was not pushed." };
  }
  const netrc = join(homedir(), ".netrc");
  const clone = await mkdtemp(join(tmpdir(), "catchem-private-"));
  const childEnv = { ...env, GIT_TERMINAL_PROMPT: "0" };
  try {
    await writeFile(netrc, `machine github.com\nlogin x-access-token\npassword ${token}\n`, { mode: 0o600 });
    const cloned = await runGit("git", ["clone", "--depth", "1", REMOTE, clone], childEnv);
    if (cloned.code !== 0) {
      return { pushed: false, reason: `Private repo was not cloned (${redact(cloned.err, [token]) || "clone failed"}).` };
    }
    const actions = await stagePrivate({
      checkout,
      rawDir: rawDir || join(checkout, "ppt-raw-private"),
      dest: clone,
      date,
    });
    if (!actions.length) {
      return { pushed: false, reason: "Nothing to copy. Public raw folders are empty." };
    }
    await runGit("git", ["-C", clone, "config", "user.email", "bot@catchem.app"], childEnv);
    await runGit("git", ["-C", clone, "config", "user.name", "catchem-bot"], childEnv);
    await runGit("git", ["-C", clone, "add", "data", "raw"], childEnv);
    const quiet = await runGit("git", ["-C", clone, "diff", "--cached", "--quiet"], childEnv);
    const shaOf = async () => {
      const sha = await runGit("git", ["-C", clone, "rev-parse", "HEAD"], childEnv);
      return String(sha.out || "").trim();
    };
    if (quiet.code === 0) {
      const sha = await shaOf();
      return { pushed: Boolean(sha), sha, reason: sha ? "Private repo already has this copy." : "Private repo already has this copy, but the sha was not read.", actions };
    }
    const message = `Add raw PPT for ${date}`;
    const committed = await runGit("git", ["-C", clone, "commit", "-m", message], childEnv);
    if (committed.code !== 0) {
      return { pushed: false, reason: `Commit failed (${redact(committed.err || committed.out, [token])}).`, actions };
    }
    const pushed = await runGit("git", ["-C", clone, "push", "origin", "HEAD:main"], childEnv);
    if (pushed.code !== 0) {
      return { pushed: false, reason: `Push failed (${redact(pushed.err || pushed.out, [token])}).`, actions };
    }
    const sha = await shaOf();
    if (!sha) return { pushed: false, reason: "Push succeeded but the sha was not read.", actions };
    return { pushed: true, sha, actions };
  } catch (err) {
    return { pushed: false, reason: redact(err.message, [token]) };
  } finally {
    await rm(netrc, { force: true }).catch(() => {});
    await rm(clone, { recursive: true, force: true }).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  const date = new Date().toISOString().slice(0, 10);
  const result = await pushPrivate({ token, date });
  const status = token
    ? { expected: true, pushed: Boolean(result.pushed), sha: result.sha || null, reason: result.reason || "" }
    : { expected: false, pushed: false, sha: null, reason: "skipped: PRIVATE_DATA_TOKEN is not set" };
  await mkdir(join(ROOT, "data/ppt"), { recursive: true });
  await writeFile(join(ROOT, "data/ppt/push-status.json"), `${JSON.stringify(status, null, 2)}\n`);
  console.log(result.reason || `Pushed raw PPT (${(result.actions || []).join(", ")}).`);
  process.exit(0);
}
