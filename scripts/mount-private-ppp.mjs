// Copy PPP refresh dates out of the private repo when the token exists.
// Missing token or a failed clone logs and exits 0. The token is never printed.
import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { redact, restorePrivatePpp } from "./lib/private-ppp.mjs";
import { clonePrivate } from "./lib/private-clone.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (buf) => { err += buf.toString(); });
    child.on("close", (code) => resolve({ code, err }));
  });
}

export async function mountPrivatePpp({ token, root = ROOT, runGit = run } = {}) {
  if (!token) {
    return { mounted: false, reason: "PRIVATE_DATA_TOKEN is not set. PPP state stays unmounted. No public raw is written." };
  }
  const netrc = join(homedir(), ".netrc");
  const clone = join(tmpdir(), "catchem-data-private-ppp");
  try {
    await writeFile(netrc, `machine github.com\nlogin x-access-token\npassword ${token}\n`, { mode: 0o600 });
    await rm(clone, { recursive: true, force: true });
    const cloned = await clonePrivate(runGit, "https://github.com/Tbaker-maker/catchem-data-private.git", clone, { ...process.env, GIT_TERMINAL_PROMPT: "0" });
    if (cloned.code !== 0) {
      return { mounted: false, reason: `Private repo was not cloned (${redact(cloned.err, [token]) || "clone failed"}). Readers will skip PPP state.` };
    }
    const actions = await restorePrivatePpp({ clone, root });
    if (!actions.length) {
      return { mounted: false, reason: "Nothing from the private repo was mounted for PPP." };
    }
    return { mounted: true, actions };
  } catch (err) {
    return { mounted: false, reason: `Private PPP mount failed: ${redact(err.message, [token])}` };
  } finally {
    await rm(netrc, { force: true }).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await mountPrivatePpp({ token: process.env.PRIVATE_DATA_TOKEN || "" });
  const status = {
    restored: result.mounted === true,
    actions: result.actions || [],
    reason: result.reason || "",
  };
  await mkdir(join(ROOT, "data/ppp"), { recursive: true });
  await writeFile(join(ROOT, "data/ppp/mount-status.json"), `${JSON.stringify(status, null, 2)}\n`);
  console.log(result.reason || `Mounted private PPP (${(result.actions || []).join(", ")}). It is not committed.`);
  process.exit(0);
}
