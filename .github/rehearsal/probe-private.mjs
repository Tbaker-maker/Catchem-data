// Probe: what one private clone (scripts/lib/private-clone.mjs) and the
// push-retry "pull --rebase" cost on this runner. Read only. Pushes nothing.
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { clonePrivate } from "../../scripts/lib/private-clone.mjs";
const run = (cmd, args, env) => new Promise((res) => { const t = Date.now(); const c = spawn("/usr/bin/time", ["-f", "%M", cmd, ...args], { env, stdio: ["ignore", "pipe", "pipe"] }); let err = ""; c.stderr.on("data", (b) => { err += b; }); c.on("close", (code) => { const rss = Number((err.trim().split("\n").pop() || "0")); console.log(`${args.slice(0, 4).join(" ")}: exit ${code} ${((Date.now() - t) / 1000).toFixed(1)}s peak ${Math.round(rss / 1024)}MB`); res({ code, err }); }); });
const token = process.env.PRIVATE_DATA_TOKEN || "";
if (!token) { console.log("no token"); process.exit(0); }
const netrc = join(homedir(), ".netrc");
await writeFile(netrc, `machine github.com\nlogin x-access-token\npassword ${token}\n`, { mode: 0o600 });
const dir = await mkdtemp(join(tmpdir(), "probe-"));
const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
await clonePrivate(run, "https://github.com/Tbaker-maker/catchem-data-private.git", dir, env);
await run("du", ["-sm", dir], env).catch(() => {});
await run("git", ["-C", dir, "-c", "user.name=x", "-c", "user.email=x@x", "commit", "--allow-empty", "-m", "probe"], env);
await run("git", ["-C", dir, "pull", "--rebase", "--depth", "1", "origin", "main"], env);
await rm(dir, { recursive: true, force: true }); await rm(netrc, { force: true });
