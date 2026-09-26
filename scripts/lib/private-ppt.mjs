// Stage raw PPT into a checkout of the private repo. No network and no token.
import { cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const CROSSCHECK_FILES = ["sealed-crosscheck.json", "crosscheck-history.json"];

export function redact(text, secrets) {
  let out = String(text || "");
  for (const secret of secrets) {
    if (secret && String(secret).length > 3) out = out.split(secret).join("[redacted]");
  }
  return out.slice(0, 240);
}

async function hasJson(dir) {
  if (!existsSync(dir)) return false;
  const names = await readdir(dir);
  return names.some((name) => name.endsWith(".json"));
}

// Copies the public sealed history (one-time seed, and later updates while the
// folder is still in the checkout), the two crosscheck files, and that day's
// raw pulls. Does not invent prices. Skips anything that is not on disk.
export async function stagePrivate({ checkout, rawDir, dest, date }) {
  const actions = [];
  const sealedSrc = join(checkout, "data/history/ppt-sealed");
  if (await hasJson(sealedSrc)) {
    const sealedDest = join(dest, "data/history/ppt-sealed");
    await mkdir(sealedDest, { recursive: true });
    await cp(sealedSrc, sealedDest, { recursive: true });
    actions.push("ppt-sealed");
  }
  for (const name of CROSSCHECK_FILES) {
    const fromRaw = rawDir ? join(rawDir, "crosscheck", name) : "";
    const fromPublic = join(checkout, "data", name);
    const from = fromRaw && existsSync(fromRaw) ? fromRaw : (existsSync(fromPublic) ? fromPublic : "");
    if (!from) continue;
    await mkdir(join(dest, "data"), { recursive: true });
    await cp(from, join(dest, "data", name));
    actions.push(name);
  }
  if (rawDir && existsSync(rawDir) && date) {
    const dayDir = join(dest, "raw", date);
    await mkdir(dayDir, { recursive: true });
    await cp(rawDir, dayDir, { recursive: true });
    actions.push(`raw:${date}`);
  }
  return actions;
}
