// Stage raw PkmnPrices into a checkout of the private repo, and copy state back
// for one Actions run. No network and no token.
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { redact as redactText } from "./ppp-client.mjs";

export function redact(text, secrets) {
  return redactText(text, secrets);
}

async function hasJson(dir) {
  if (!existsSync(dir)) return false;
  const names = await readdir(dir);
  return names.some((name) => name.endsWith(".json"));
}

export async function stagePrivatePpp({ checkout, rawDir, dest, date }) {
  const actions = [];
  const root = rawDir || (checkout ? join(checkout, "ppp-raw-private") : "");
  if (!root || !existsSync(root)) return actions;
  if (existsSync(join(root, "refresh-dates.json"))) {
    await mkdir(join(dest, "data/meta"), { recursive: true });
    await cp(join(root, "refresh-dates.json"), join(dest, "data/meta/ppp-refresh-dates.json"));
    actions.push("refresh-dates");
  }
  const compareName = date ? `compare-${date}.json` : "";
  if (compareName && existsSync(join(root, compareName))) {
    await mkdir(join(dest, "data/ppp-compare"), { recursive: true });
    await cp(join(root, compareName), join(dest, "data/ppp-compare", compareName));
    actions.push("compare");
  }
  const daySrc = date ? join(root, date) : "";
  if (daySrc && await hasJson(daySrc)) {
    const dayDir = join(dest, "raw/ppp", date);
    await mkdir(dayDir, { recursive: true });
    await cp(daySrc, dayDir, { recursive: true });
    actions.push(`raw:${date}`);
  }
  return actions;
}

export async function restorePrivatePpp({ clone, root }) {
  const actions = [];
  const datesFrom = join(clone, "data/meta/ppp-refresh-dates.json");
  if (existsSync(datesFrom)) {
    await mkdir(join(root, "ppp-raw-private"), { recursive: true });
    await cp(datesFrom, join(root, "ppp-raw-private/refresh-dates.json"));
    actions.push("refresh-dates");
  }
  return actions;
}

export async function writeJson(path, value) {
  await mkdir(join(path, ".."), { recursive: true }).catch(() => {});
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
