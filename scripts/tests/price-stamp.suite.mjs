import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { priceFileStamp, stampCountsText, nextCountsUpdatedAt } from "../lib/price-stamp.mjs";

const script = fileURLToPath(new URL("../stamp-public-updated.mjs", import.meta.url));

function runScript(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { env: { ...process.env, ...env } });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (code) => resolve({ code, out }));
  });
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  const iso = "2026-10-03T09:46:08.660Z";
  t("the price file clock is kept as written", priceFileStamp({ updatedAt: iso }) === iso);
  t("a missing clock is not filled in", priceFileStamp({}) === null && priceFileStamp({ updatedAt: "2026-10-03" }) === null);
  t("a missing price clock keeps the line that is already there", nextCountsUpdatedAt({}, "2026-09-27T10:19:31.933Z") === "2026-09-27T10:19:31.933Z");
  t("no price clock and no previous line invents nothing", nextCountsUpdatedAt({}, null) === null && nextCountsUpdatedAt({ updatedAt: "2026-10-03" }, "") === null);
  t("the price file clock replaces the old line", nextCountsUpdatedAt({ updatedAt: iso }, "2026-09-27T10:19:31.933Z") === iso);
  const before = '{\n "asOf": "2026-09-27",\n "updatedAt": "2026-09-27T10:19:31.933Z"\n}\n';
  const after = stampCountsText(before, iso);
  t("only the updated line moves", after.includes(`"updatedAt": "${iso}"`) && after.includes('"asOf": "2026-09-27"'));
  t("a file with no updated field is left alone", stampCountsText('{"asOf":"2026-09-27"}\n', iso) === null);
  t("the same clock is not rewritten", stampCountsText(after, iso) === after);

  const dir = await mkdtemp(join(tmpdir(), "price-stamp-"));
  const price = join(dir, "prices.json");
  const counts = join(dir, "counts.json");
  await writeFile(price, JSON.stringify({ updatedAt: iso, products: [] }));
  await writeFile(counts, before);
  const ok = await runScript({ PRICE_FILE: price, COUNTS_FILE: counts });
  const written = await readFile(counts, "utf8");
  t("the script writes the price file clock", ok.code === 0 && written.includes(iso) && written.includes("2026-09-27"));
  const blank = join(dir, "blank.json");
  await writeFile(blank, JSON.stringify({ products: [] }));
  const held = await runScript({ PRICE_FILE: blank, COUNTS_FILE: counts });
  const still = await readFile(counts, "utf8");
  t("no clock on the price file leaves the line", held.code === 0 && still === written);
  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("price-stamp.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
