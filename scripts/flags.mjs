// flags.mjs — the single source for every gate.
// A gate written as an `if` in code can be duplicated by a second author and
// will stack silently; that happened on 2026-08-23 and quietly overrode a
// ruling from Tyler. A gate written as a named key here cannot be duplicated
// without either repeating the key or colliding in git. Env vars still win,
// so anything can be flipped at runtime without a commit.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let FLAGS = {};
try { FLAGS = (JSON.parse(await readFile(join(ROOT, "data/flags.json"), "utf-8")).flags) || {}; } catch {}

export function flag(name) {
  const f = FLAGS[name];
  if (!f) throw new Error(`unknown flag "${name}" — add it to data/flags.json rather than gating in code`);
  // A flag may be a SWITCH or a VALUE. Switches answer yes/no; values return
  // as they are. Treating a value flag as a boolean silently yielded `true`
  // for a URL, which is the kind of quiet wrong that takes an hour to find.
  if (f.type === "value") {
    if (f.env && process.env[f.env] != null) return process.env[f.env];
    return f.value;
  }
  if (f.env && process.env[f.env] != null) return process.env[f.env] === "1";
  return Boolean(f.value);
}
export const flagMeta = name => FLAGS[name] ?? null;
export const allFlags = () => FLAGS;
