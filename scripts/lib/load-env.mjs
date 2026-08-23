// load-env.mjs — make a local API key survive the shell that set it.
//
// WHY. The PPT key has now blocked three separate sessions. The documented
// route is a User-scope Windows environment variable, and it keeps not being
// there: set via SetEnvironmentVariable, reported as succeeding, absent from
// HKCU:\Environment afterwards, and invisible to every process since. Even when
// it works, a variable set after a process starts is invisible to that process,
// so the fix always costs a fresh shell.
//
// A gitignored .env file has neither problem: it is readable immediately, by
// any process, and it survives reboots. .env and .env.* were already in this
// repo's .gitignore — the comment there anticipates exactly this file — so the
// control that keeps it out of git is one that already existed and is already
// tested.
//
// Real env vars WIN. CI sets its secrets that way and must never be overridden
// by a stray file in a checkout.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadEnv(file = ".env") {
  const path = join(ROOT, file);
  if (!existsSync(path)) return { loaded: 0, path };
  let loaded = 0;
  for (const raw of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    // Strip one layer of matching quotes — a pasted key often arrives wrapped,
    // and a key with a stray quote fails auth in a way that looks like a bad key.
    const val = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/s, "$2");
    if (process.env[key] === undefined) { process.env[key] = val; loaded++; }
  }
  return { loaded, path };
}

// Resolve one required credential, with an error that says what to do rather
// than what is missing.
export function requireKey(name, hint) {
  loadEnv();
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  console.error(`Missing ${name}.`);
  console.error(`Set it once, in the repo root, and every later session inherits it:`);
  console.error(`  echo ${name}=your-key-here >> .env`);
  console.error(`(.env is gitignored — it cannot be committed.)`);
  if (hint) console.error(hint);
  process.exit(1);
}
