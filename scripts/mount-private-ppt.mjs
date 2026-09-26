// Copy PPT history out of the private repo when the token exists.
// Missing token or a failed clone logs and exits 0. The token is never printed.
import { rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { redact, restorePrivate } from "./lib/private-ppt.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (buf) => { err += buf.toString(); });
    child.on("close", (code) => resolve({ code, err }));
  });
}

export async function mountPrivate({ token, root = ROOT, runGit = run } = {}) {
  if (!token) {
    return { mounted: false, reason: "PRIVATE_DATA_TOKEN is not set. PPT history stays unmounted. No public raw is written." };
  }
  const netrc = join(homedir(), ".netrc");
  const clone = join(tmpdir(), "catchem-data-private");
  try {
    await writeFile(netrc, `machine github.com\nlogin x-access-token\npassword ${token}\n`, { mode: 0o600 });
    await rm(clone, { recursive: true, force: true });
    const cloned = await runGit("git", ["clone", "--depth", "1", "https://github.com/Tbaker-maker/catchem-data-private.git", clone], { ...process.env, GIT_TERMINAL_PROMPT: "0" });
    if (cloned.code !== 0) {
      return { mounted: false, reason: `Private repo was not cloned (${redact(cloned.err, [token]) || "clone failed"}). Readers will skip PPT history.` };
    }
    const actions = await restorePrivate({ clone, root });
    if (!actions.length) {
      return { mounted: false, reason: "Nothing from the private repo was mounted." };
    }
    return { mounted: true, actions };
  } catch (err) {
    return { mounted: false, reason: `Private mount failed: ${redact(err.message, [token])}` };
  } finally {
    await rm(netrc, { force: true }).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await mountPrivate({ token: process.env.PRIVATE_DATA_TOKEN || "" });
  console.log(result.reason || `Mounted private PPT (${result.actions.join(", ")}). It is not committed.`);
  process.exit(0);
}
