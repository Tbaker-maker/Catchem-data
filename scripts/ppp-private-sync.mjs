// Sync raw PkmnPrices state with Tbaker-maker/catchem-data-private under ppp/.
//   node scripts/ppp-private-sync.mjs pull   private ppp/ -> ppp-raw-private/
//   node scripts/ppp-private-sync.mjs push   ppp-raw-private/ -> private ppp/ (commit + push)
// No PRIVATE_DATA_TOKEN: log and exit 0. The token is never printed.
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { redact } from "./lib/private-ppt.mjs";
import { clonePrivate } from "./lib/private-clone.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REMOTE = "https://github.com/Tbaker-maker/catchem-data-private.git";
const LOCAL = join(ROOT, "ppp-raw-private");

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let err = "", out = "";
    child.stderr.on("data", (b) => { err += b; });
    child.stdout.on("data", (b) => { out += b; });
    child.on("close", (code) => resolve({ code, err, out }));
  });
}

export async function syncPrivate(mode, { token = process.env.PRIVATE_DATA_TOKEN || "" } = {}) {
  if (!token) return { ok: false, reason: "PRIVATE_DATA_TOKEN is not set; PkmnPrices raw stays local to this run." };
  const netrc = join(homedir(), ".netrc");
  const clone = join(tmpdir(), `catchem-private-ppp-${process.pid}`);
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  try {
    await writeFile(netrc, `machine github.com\nlogin x-access-token\npassword ${token}\n`, { mode: 0o600 });
    await rm(clone, { recursive: true, force: true });
    const c = await clonePrivate(run, REMOTE, clone, env);
    if (c.code !== 0) return { ok: false, reason: `clone failed (${redact(c.err, [token])})` };
    const remoteDir = join(clone, "ppp");
    if (mode === "pull") {
      if (!existsSync(remoteDir)) return { ok: true, reason: "private repo has no ppp/ yet" };
      await mkdir(LOCAL, { recursive: true });
      await cp(remoteDir, LOCAL, { recursive: true });
      return { ok: true, reason: "pulled ppp/" };
    }
    if (!existsSync(LOCAL)) return { ok: true, reason: "nothing to push" };
    await mkdir(remoteDir, { recursive: true });
    await cp(LOCAL, remoteDir, { recursive: true });
    await run("git", ["-C", clone, "config", "user.email", "bot@catchem.app"], env);
    await run("git", ["-C", clone, "config", "user.name", "catchem-bot"], env);
    await run("git", ["-C", clone, "add", "ppp"], env);
    const quiet = await run("git", ["-C", clone, "diff", "--cached", "--quiet"], env);
    if (quiet.code === 0) return { ok: true, reason: "private ppp/ already current" };
    const day = new Date().toISOString().slice(0, 10);
    const cm = await run("git", ["-C", clone, "commit", "-m", `ppp: raw PkmnPrices enrichment ${day}`], env);
    if (cm.code !== 0) return { ok: false, reason: `commit failed (${redact(cm.err || cm.out, [token])})` };
    for (let i = 0; i < 4; i++) {
      const p = await run("git", ["-C", clone, "push", "origin", "HEAD:main"], env);
      if (p.code === 0) return { ok: true, reason: "pushed ppp/" };
      await run("git", ["-C", clone, "pull", "--rebase", "origin", "main"], env);
    }
    return { ok: false, reason: "push failed after retries" };
  } catch (err) {
    return { ok: false, reason: redact(err.message, [token]) };
  } finally {
    await rm(netrc, { force: true }).catch(() => {});
    await rm(clone, { recursive: true, force: true }).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  if (mode !== "pull" && mode !== "push") { console.error("usage: pull|push"); process.exit(2); }
  const r = await syncPrivate(mode);
  console.log(r.reason);
  process.exit(0);
}
