// Fails if a watched creator name ships in the live deck, the presenter, or public files.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function watchNames(accounts, channels) {
  const names = [];
  for (const row of accounts?.accounts || []) if (row?.handle) names.push(String(row.handle));
  for (const row of channels?.channels || []) {
    if (row?.name) names.push(String(row.name));
    if (row?.handle) names.push(String(row.handle).replace(/^@/, ""));
  }
  return [...new Set(names.filter((name) => name.length >= 4))];
}

export function namePattern(names) {
  const body = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`(?<![A-Za-z0-9_])(?:${body})(?![A-Za-z0-9_])`, "i");
}

async function filesUnder(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await filesUnder(path));
    else if (/\.(json|html)$/i.test(entry.name)) out.push(path);
  }
  return out;
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const accounts = JSON.parse(await readFile(join(ROOT, "data/observed-accounts.json"), "utf8"));
  const channels = JSON.parse(await readFile(join(ROOT, "config/youtube-channels.json"), "utf8"));
  const names = watchNames(accounts, channels);
  const pattern = namePattern(names);
  t("the watch list has creator names", names.length >= 5);
  const named = [
    join(ROOT, "research/assets/live-presenter.html"),
    join(ROOT, "research/pulse/live-deck.json"),
  ];
  const pub = await filesUnder(join(ROOT, "research/assets/public"));
  const leaks = [];
  for (const path of [...named, ...pub]) {
    const text = await readFile(path, "utf8");
    const hit = text.match(pattern);
    if (hit) leaks.push(`${path.slice(ROOT.length)}:${hit[0]}`);
  }
  t("no watched creator name ships in the deck, presenter, or public files", leaks.length === 0);
  if (leaks.length) console.error(leaks.slice(0, 8).join("\n"));
  return fail;
}
