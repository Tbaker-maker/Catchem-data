import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  QUARANTINE_REASON, catalogSetCount, logoOnDisk, quarantineEntry, setCountFollowsCatalog, shouldQuarantine,
} from "../lib/set-quarantine.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const root = await mkdtemp(join(tmpdir(), "set-q-"));
  try {
    t("a missing logo is quarantined", await shouldQuarantine(root, ""));
    t("a logo path with no file is quarantined", await shouldQuarantine(root, "/img/mcd26/logo.png"));
    await mkdir(join(root, "research/assets/img/mcd26"), { recursive: true });
    await writeFile(join(root, "research/assets/img/mcd26/logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    t("a logo file on disk is kept", await logoOnDisk(root, "/img/mcd26/logo.png") && !(await shouldQuarantine(root, "/img/mcd26/logo.png")));
    t("a remote logo is not a file", !(await logoOnDisk(root, "https://images.pokemontcg.io/mcd26/logo.png")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  const entry = quarantineEntry({ slug: "mcdonald-s-promos-2026", name: "McDonald's Promos 2026" });
  const packed = JSON.stringify(entry);
  t("the log names the set and the skip", entry.slug === "mcdonald-s-promos-2026" && entry.reason === QUARANTINE_REASON);
  t("the log has no placeholder, no image, no condition, no sold", !("logo" in entry) && !("image" in entry) && !/placeholder|\bNM\b|\bsold\b|—|–/.test(packed));

  const catalog = { items: [{ set: "Base Set" }, { set: "Base Set" }, { set: "Jungle" }] };
  t("catalog set count is distinct names", catalogSetCount(catalog) === 2);
  t("one new set still follows the catalog", setCountFollowsCatalog(206, 218) && setCountFollowsCatalog(219, 219));
  t("a floor alone does not hide a mass under-publish", !setCountFollowsCatalog(150, 218) && setCountFollowsCatalog(198, 218) && !setCountFollowsCatalog(197, 218));
  t("an empty publish does not follow the catalog", !setCountFollowsCatalog(0, 218) && !setCountFollowsCatalog(400, 218));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("set-quarantine.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
