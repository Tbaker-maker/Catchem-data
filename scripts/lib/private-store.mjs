// Opens a working copy of catchem-data-private for one run, or a gitignored local
// folder when PRIVATE_DATA_TOKEN is not set. The token is never printed.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const REMOTE = "https://github.com/Tbaker-maker/catchem-data-private.git";

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let err = "", out = "";
    child.stderr.on("data", (b) => { err += b; });
    child.stdout.on("data", (b) => { out += b; });
    child.on("close", (code) => resolve({ code, err, out }));
  });
}
const redact = (t, token) => (token ? String(t || "").split(token).join("[token]") : String(t || ""));

export async function openPrivate({ root, token = "", git = run, env = process.env } = {}) {
  if (!token) {
    const dir = join(root, "data/private");
    await mkdir(dir, { recursive: true });
    return { dir, remote: false, close: async () => ({ pushed: false, reason: "PRIVATE_DATA_TOKEN is not set. Kept in gitignored data/private/." }) };
  }
  const netrc = join(homedir(), ".netrc");
  const clone = await mkdtemp(join(tmpdir(), "catchem-selfcheck-"));
  const childEnv = { ...env, GIT_TERMINAL_PROMPT: "0" };
  await writeFile(netrc, `machine github.com\nlogin x-access-token\npassword ${token}\n`, { mode: 0o600 });
  const cleanup = async () => { await rm(netrc, { force: true }).catch(() => {}); await rm(clone, { recursive: true, force: true }).catch(() => {}); };
  const cloned = await git("git", ["clone", "--depth", "1", REMOTE, clone], childEnv);
  if (cloned.code !== 0) { await cleanup(); throw new Error(`private repo was not cloned (${redact(cloned.err, token)})`); }
  const dir = join(clone, "data/private");
  await mkdir(dir, { recursive: true });
  return {
    dir,
    remote: true,
    close: async (paths, message) => {
      try {
        await git("git", ["-C", clone, "config", "user.email", "bot@catchem.app"], childEnv);
        await git("git", ["-C", clone, "config", "user.name", "catchem-bot"], childEnv);
        await git("git", ["-C", clone, "add", "--", ...paths.map((p) => join("data/private", p))], childEnv);
        if ((await git("git", ["-C", clone, "diff", "--cached", "--quiet"], childEnv)).code === 0) return { pushed: true, reason: "no change" };
        const c = await git("git", ["-C", clone, "commit", "-m", message], childEnv);
        if (c.code !== 0) return { pushed: false, reason: redact(c.err || c.out, token) };
        for (let i = 0; i < 3; i++) {
          const p = await git("git", ["-C", clone, "push", "origin", "HEAD:main"], childEnv);
          if (p.code === 0) return { pushed: true, sha: String((await git("git", ["-C", clone, "rev-parse", "HEAD"], childEnv)).out).trim() };
          await git("git", ["-C", clone, "pull", "--rebase", "--depth", "1", "origin", "main"], childEnv);
        }
        return { pushed: false, reason: "push rejected 3 times" };
      } finally { await cleanup(); }
    },
  };
}
