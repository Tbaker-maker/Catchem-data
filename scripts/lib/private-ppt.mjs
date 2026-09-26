// Stage raw PPT into a checkout of the private repo, and copy it back
// for one Actions run. No network and no token.
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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

async function readJsonSafe(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

// crosscheck-history.json is append-only. A fresh runner only holds the days it
// fetched, so merge by date+id instead of overwriting the private history.
export function mergeHistory(existing, incoming) {
  const rows = new Map();
  for (const row of Array.isArray(existing) ? existing : []) rows.set(`${row.date}|${row.id}`, row);
  for (const row of Array.isArray(incoming) ? incoming : []) rows.set(`${row.date}|${row.id}`, row);
  return [...rows.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
}

async function hasJson(dir) {
  if (!existsSync(dir)) return false;
  const names = await readdir(dir);
  return names.some((name) => name.endsWith(".json"));
}

async function overlayJson(src, dest) {
  if (!(await hasJson(src))) return false;
  await mkdir(dest, { recursive: true });
  await cp(src, dest, { recursive: true });
  return true;
}

// Copies the public sealed history (one-time seed, while that folder is still
// in the checkout), then overlays ppt-raw-private/ppt-sealed so later days
// keep landing in data/history/ppt-sealed after the public copy is removed.
// Also copies the two crosscheck files and that day's raw pulls.
export async function stagePrivate({ checkout, rawDir, dest, date }) {
  const actions = [];
  const sealedDest = join(dest, "data/history/ppt-sealed");
  if (await overlayJson(join(checkout, "data/history/ppt-sealed"), sealedDest)) {
    actions.push("ppt-sealed");
  }
  if (rawDir && await overlayJson(join(rawDir, "ppt-sealed"), sealedDest)) {
    actions.push("ppt-sealed-update");
  }
  for (const name of CROSSCHECK_FILES) {
    const fromRaw = rawDir ? join(rawDir, "crosscheck", name) : "";
    const fromPublic = join(checkout, "data", name);
    const from = fromRaw && existsSync(fromRaw) ? fromRaw : (existsSync(fromPublic) ? fromPublic : "");
    if (!from) continue;
    await mkdir(join(dest, "data"), { recursive: true });
    const target = join(dest, "data", name);
    if (name === "crosscheck-history.json" && existsSync(target)) {
      const merged = mergeHistory(await readJsonSafe(target), await readJsonSafe(from));
      await writeFile(target, JSON.stringify(merged) + "\n");
    } else {
      await cp(from, target);
    }
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

// What the daily job mounts back into the public checkout. The sealed history
// goes to a gitignored folder. The two crosscheck files go to the gitignored
// raw path the readers already check. Nothing here is committed.
export async function restorePrivate({ clone, root }) {
  const actions = [];
  if (await overlayJson(join(clone, "data/history/ppt-sealed"), join(root, "data/history/ppt-sealed-private"))) {
    actions.push("ppt-sealed");
  }
  const crossDest = join(root, "ppt-raw-private/crosscheck");
  for (const name of CROSSCHECK_FILES) {
    const from = join(clone, "data", name);
    if (!existsSync(from)) continue;
    await mkdir(crossDest, { recursive: true });
    await cp(from, join(crossDest, name));
    actions.push(name);
  }
  return actions;
}
