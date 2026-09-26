import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { redact, stagePrivate } from "../lib/private-ppt.mjs";
import { pushPrivate } from "../push-private-ppt.mjs";

export async function runPrivatePptTests() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };
  t("redact strips the token", redact("clone failed password SECRET", ["SECRET"]) === "clone failed password [redacted]");
  const root = await mkdtemp(join(tmpdir(), "ppt-stage-"));
  const checkout = join(root, "public");
  const dest = join(root, "private");
  const raw = join(root, "raw");
  await mkdir(join(checkout, "data/history/ppt-sealed"), { recursive: true });
  await mkdir(join(raw, "crosscheck"), { recursive: true });
  await writeFile(join(checkout, "data/history/ppt-sealed/me1-etb.json"), JSON.stringify({ id: "me1-etb", points: [{ date: "2026-03-31", market: 10 }] }));
  await writeFile(join(checkout, "data/sealed-crosscheck.json"), "{\"products\":[]}\n");
  await writeFile(join(raw, "crosscheck/sealed-crosscheck.json"), "{\"products\":[{\"id\":\"a\"}]}\n");
  await writeFile(join(raw, "pull.json"), "{\"raw\":true}\n");
  const actions = await stagePrivate({ checkout, rawDir: raw, dest, date: "2026-09-26" });
  t("seed copies sealed history", actions.includes("ppt-sealed"));
  const seeded = JSON.parse(await readFile(join(dest, "data/history/ppt-sealed/me1-etb.json"), "utf8"));
  t("seed keeps the March 31 point", seeded.points[0].date === "2026-03-31" && seeded.points[0].market === 10);
  const cross = await readFile(join(dest, "data/sealed-crosscheck.json"), "utf8");
  t("raw crosscheck wins over the public file", cross.includes("\"a\""));
  t("history crosscheck is skipped when absent", !actions.includes("crosscheck-history.json"));
  const day = JSON.parse(await readFile(join(dest, "raw/2026-09-26/pull.json"), "utf8"));
  t("day folder holds the raw pull", day.raw === true);
  const skipped = await pushPrivate({ token: "" });
  t("no token does not push", skipped.pushed === false && /not set/.test(skipped.reason));
  await rm(root, { recursive: true, force: true });
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fail = await runPrivatePptTests();
  if (fail) process.exit(1);
}
