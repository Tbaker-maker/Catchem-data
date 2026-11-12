import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { redact, restorePrivatePpp, stagePrivatePpp } from "../lib/private-ppp.mjs";
import { pushPrivatePpp } from "../push-private-ppp.mjs";
import { mountPrivatePpp } from "../mount-private-ppp.mjs";

export async function runPrivatePppTests() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name, detail); }
  };
  t("redact strips the token", redact("clone failed password SECRETTOK", ["SECRETTOK"]) === "clone failed password [redacted]");
  const root = await mkdtemp(join(tmpdir(), "ppp-stage-"));
  const raw = join(root, "raw");
  const dest = join(root, "private");
  await mkdir(join(raw, "2026-11-12"), { recursive: true });
  await writeFile(join(raw, "refresh-dates.json"), JSON.stringify({ asOf: "2026-11-12", dates: { "sealed-1": "2026-11-12" } }));
  await writeFile(join(raw, "compare-2026-11-12.json"), JSON.stringify({ asOf: "2026-11-12", sealedVsTcgcsv: { nCompared: 1, outliers: [{ ppp: 10, baseline: 9 }] } }));
  await writeFile(join(raw, "2026-11-12/sealed-1.json"), JSON.stringify({ tcgPlayerId: "1", body: { prices: [{ market_price: 10 }] } }));
  const actions = await stagePrivatePpp({ checkout: root, rawDir: raw, dest, date: "2026-11-12" });
  t("stage copies dates, compare, and the day raw", actions.includes("refresh-dates") && actions.includes("compare") && actions.includes("raw:2026-11-12"));
  t("raw PPP lands under raw/ppp/<date>/ in the private repo", (await readFile(join(dest, "raw/ppp/2026-11-12/sealed-1.json"), "utf8")).includes("market_price"));
  const mountedRoot = join(root, "mounted");
  const restored = await restorePrivatePpp({ clone: dest, root: mountedRoot });
  t("mount restores refresh dates only, not public raw", restored.includes("refresh-dates") && !(await readFile(join(mountedRoot, "ppp-raw-private/refresh-dates.json"), "utf8")).includes("market_price"));

  const skipped = await pushPrivatePpp({ token: "" });
  t("no token does not push", skipped.pushed === false && /not set/.test(skipped.reason));
  const down = await pushPrivatePpp({
    token: "not-a-real-token-value",
    checkout: root,
    rawDir: raw,
    date: "2026-11-12",
    runGit: async () => ({ code: 128, err: "fatal: could not read Password not-a-real-token-value", out: "" }),
  });
  t("a down private repo does not throw or print the token", down.pushed === false && !String(down.reason).includes("not-a-real-token-value"));
  const unmounted = await mountPrivatePpp({ token: "" });
  t("mount without a token does not clone", unmounted.mounted === false);

  const workflow = await readFile(join(dirname(fileURLToPath(import.meta.url)), "../../.github/workflows/update-sealed-prices.yml"), "utf8");
  const mountAt = workflow.indexOf("node scripts/mount-private-ppp.mjs");
  const refreshAt = workflow.indexOf("node scripts/ppp-refresh.mjs");
  const pushAt = workflow.indexOf("node scripts/push-private-ppp.mjs");
  t("PPP mount runs before the PPP refresh", mountAt > 0 && mountAt < refreshAt);
  t("PPP push runs after the PPP refresh", pushAt > refreshAt);
  t("PPT and PPP refreshes both remain in the workflow", workflow.includes("node scripts/ppt-refresh.mjs") && refreshAt > 0);
  await rm(root, { recursive: true, force: true });
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fail = await runPrivatePppTests();
  if (fail) process.exit(1);
}
