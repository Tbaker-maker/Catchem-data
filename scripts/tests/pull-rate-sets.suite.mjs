import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const pull = JSON.parse(await readFile(join(ROOT, "data/pull-rates.json"), "utf8"));
  const names = (await readdir(join(ROOT, "data/pull-rates/sets"))).filter((n) => n.endsWith(".json")).sort();
  t("one file per skipped set id", names.length === 176);
  const ids = new Set(names.map((n) => n.replace(/\.json$/, "")));
  const noSource = new Set((pull.noSource || []).map((x) => x.setId));
  t("noSource count matches the list", pull.noSourceCount === pull.noSource.length);
  let sourced = 0;
  for (const name of names) {
    const doc = JSON.parse(await readFile(join(ROOT, "data/pull-rates/sets", name), "utf8"));
    const blob = JSON.stringify(doc);
    if (blob.includes("\u2014")) { t(`no em dash ${name}`, false); continue; }
    if (doc.status === "no-citable-source") {
      const ok = doc.slots.length === 0 && (doc.sourcesChecked || []).every((s) => /^https:\/\//.test(s.url) && s.rateStated === false);
      if (!ok) t(`empty cited file ${doc.setId}`, false);
      if (!noSource.has(doc.setId)) t(`unsourced stays listed ${doc.setId}`, false);
    } else {
      sourced += 1;
      const ok = doc.slots.length > 0 && doc.slots.every((s) => s.pct > 0 && /^https:\/\//.test(s.sourceUrl || (doc.sources || [])[0]?.url) && (s.published || s.date || (doc.sources || [])[0]?.date));
      if (!ok) t(`sourced slots ${doc.setId}`, false);
      if (noSource.has(doc.setId)) t(`sourced set left noSource ${doc.setId}`, false);
    }
    ids.delete(doc.setId);
  }
  t("every file has its set id", ids.size === 0);
  t("some sets gained a source", sourced >= 25);
  t("battle styles still has no source", noSource.has("swsh5"));
  t("sword and shield base left the no-source list", !noSource.has("swsh1"));
  const added = pull.rows.filter((r) => r.pool);
  t("new rows are tagged so they do not collapse to one ultra rate", added.length > 0 && added.every((r) => r.tag && r.pct > 0 && /^https:\/\//.test(r.sourceUrl)));
  const swsh1 = pull.rows.filter((r) => r.setSlug === "swsh01-sword-and-shield-base-set");
  t("sword and shield base has five parent rows", swsh1.length === 5 && swsh1.every((r) => r.sourceUrl.startsWith("https://www.elitefourum.com/")));
  const text = await readFile(join(ROOT, "data/pull-rates.json"), "utf8");
  t("pull-rates file has no em dash", !text.includes("\u2014"));
  const second = await readFile(join(ROOT, "data/derived/pull-rate-second-source.json"), "utf8");
  t("second source notes have no em dash", !second.includes("\u2014") && second.includes("Note only"));
  return fail;
}
