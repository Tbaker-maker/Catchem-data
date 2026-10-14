// Seed or update the new-set registry. New sets and sealed products get an
// entry, a logo queue line, a pull-rate queue line, and a private flag.
// Does not write logo images, site pages, or the Discord bot.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { planNewSets } from "./lib/new-set-bot.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async (p, d) => { try { return JSON.parse(await readFile(join(ROOT, p), "utf8")); } catch { return d; } };
const asOf = new Date().toISOString().slice(0, 10);

const sets = await J("research/assets/public/sets.json", { sets: [] });
const products = await J("data/sealed-products.json", []);
const pull = await J("data/pull-rates.json", { rows: [] });
const registry = await J("data/derived/new-set-registry.json", null);
const plan = planNewSets({
  sets,
  products,
  registry,
  pullSlugs: new Set((pull.rows || []).map((r) => r.setSlug)),
});
plan.registry.asOf = asOf;

await mkdir(join(ROOT, "data/derived/new-set-entries"), { recursive: true });
await writeFile(join(ROOT, "data/derived/new-set-registry.json"), JSON.stringify(plan.registry, null, 2) + "\n");

const logoPath = join(ROOT, "data/derived/logo-queue.json");
const pullPath = join(ROOT, "data/derived/pull-rate-queue.json");
const logo = await J("data/derived/logo-queue.json", { queued: [] });
const pullQ = await J("data/derived/pull-rate-queue.json", { queued: [] });
const seenLogo = new Set((logo.queued || []).map((q) => q.setSlug));
const seenPull = new Set((pullQ.queued || []).map((q) => q.setSlug));
for (const q of plan.logoQueue) if (!seenLogo.has(q.setSlug)) logo.queued.push({ ...q, queued: asOf });
for (const q of plan.pullQueue) if (!seenPull.has(q.setSlug)) pullQ.queued.push({ ...q, queued: asOf });
logo.updated = asOf;
pullQ.updated = asOf;
logo.note = "Queue for Post. This file does not write a logo image.";
pullQ.note = "Queue for a cited pull-rate row. No rate is invented here.";
await writeFile(logoPath, JSON.stringify(logo, null, 2) + "\n");
await writeFile(pullPath, JSON.stringify(pullQ, null, 2) + "\n");

for (const entry of plan.entries) {
  const name = entry.kind === "set" ? entry.setSlug : entry.id;
  await writeFile(join(ROOT, "data/derived/new-set-entries", `${name}.json`), JSON.stringify({ asOf, ...entry }, null, 2) + "\n");
}

const flagDoc = {
  asOf,
  kind: "new-set-bot",
  seed: plan.seed,
  flags: plan.flags,
  note: plan.seed
    ? "First run seeds the registry. No set is flagged as new on the seed."
    : "Sets and sealed products that were not in the registry.",
};
const store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" });
await mkdir(join(store.dir, "new-sets"), { recursive: true });
await writeFile(join(store.dir, "new-sets", "latest.json"), JSON.stringify(flagDoc, null, 2) + "\n");
await writeFile(join(store.dir, "new-sets", `${asOf}.json`), JSON.stringify(flagDoc, null, 2) + "\n");
const pushed = await store.close([`new-sets/${asOf}.json`, "new-sets/latest.json"], `new-set bot ${asOf}: ${plan.flags.length} flags`);

console.log(JSON.stringify({
  seed: plan.seed,
  entries: plan.entries.length,
  logoQueue: plan.logoQueue.length,
  pullQueue: plan.pullQueue.length,
  flags: plan.flags.length,
  sets: plan.registry.setSlugs.length,
  products: plan.registry.productIds.length,
  privatePushed: Boolean(pushed?.pushed),
  privateReason: pushed?.reason || null,
}, null, 2));
