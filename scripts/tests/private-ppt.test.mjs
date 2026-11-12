import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { redact, restorePrivate, stagePrivate } from "../lib/private-ppt.mjs";
import { pushPrivate } from "../push-private-ppt.mjs";
import { mountPrivate } from "../mount-private-ppt.mjs";
import { clonePrivate, PRIVATE_SPARSE } from "../lib/private-clone.mjs";

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
  await mkdir(join(raw, "ppt-sealed"), { recursive: true });
  await writeFile(join(checkout, "data/history/ppt-sealed/me1-etb.json"), JSON.stringify({ id: "me1-etb", points: [{ date: "2026-03-31", market: 10 }] }));
  await writeFile(join(raw, "ppt-sealed/me1-etb.json"), JSON.stringify({ id: "me1-etb", points: [{ date: "2026-03-31", market: 10 }, { date: "2026-09-26", market: 12 }] }));
  await writeFile(join(checkout, "data/sealed-crosscheck.json"), "{\"products\":[]}\n");
  await writeFile(join(checkout, "data/crosscheck-history.json"), "[]\n");
  await writeFile(join(raw, "crosscheck/sealed-crosscheck.json"), "{\"products\":[{\"id\":\"a\"}]}\n");
  await writeFile(join(raw, "pull.json"), "{\"raw\":true}\n");
  const actions = await stagePrivate({ checkout, rawDir: raw, dest, date: "2026-09-26" });
  t("seed copies sealed history", actions.includes("ppt-sealed"));
  t("later days overlay the seed", actions.includes("ppt-sealed-update"));
  const seeded = JSON.parse(await readFile(join(dest, "data/history/ppt-sealed/me1-etb.json"), "utf8"));
  t("seed keeps the March 31 point", seeded.points[0].date === "2026-03-31" && seeded.points[0].market === 10);
  t("overlay keeps the new day", seeded.points[1]?.date === "2026-09-26");
  const cross = await readFile(join(dest, "data/sealed-crosscheck.json"), "utf8");
  t("raw crosscheck wins over the public file", cross.includes("\"a\""));
  t("history crosscheck is copied from the public file", actions.includes("crosscheck-history.json"));
  const day = JSON.parse(await readFile(join(dest, "raw/2026-09-26/pull.json"), "utf8"));
  t("day folder holds the raw pull", day.raw === true);

  const mountedRoot = join(root, "mounted");
  const restored = await restorePrivate({ clone: dest, root: mountedRoot });
  t("mount restores sealed history", restored.includes("ppt-sealed"));
  t("mount restores both crosscheck files", restored.includes("sealed-crosscheck.json") && restored.includes("crosscheck-history.json"));
  const mounted = JSON.parse(await readFile(join(mountedRoot, "data/history/ppt-sealed-private/me1-etb.json"), "utf8"));
  t("mounted history still starts on March 31", mounted.points[0].date === "2026-03-31" && mounted.points[0].market === 10);
  const mountedCross = await readFile(join(mountedRoot, "ppt-raw-private/crosscheck/crosscheck-history.json"), "utf8");
  t("mounted history crosscheck is the private copy", mountedCross.trim() === "[]");

  const skipped = await pushPrivate({ token: "" });
  t("no token does not push", skipped.pushed === false && /not set/.test(skipped.reason));
  const down = await pushPrivate({
    token: "not-a-real-token-value",
    checkout,
    rawDir: raw,
    date: "2026-09-26",
    runGit: async () => ({ code: 128, err: "fatal: could not read Password not-a-real-token-value", out: "" }),
  });
  t("a down private repo does not throw", down.pushed === false && typeof down.reason === "string" && !down.reason.includes("not-a-real-token-value"));
  await writeFile(join(dest, "data/crosscheck-history.json"), JSON.stringify([{ date: "2026-06-01", id: "a", tcgMarket: 5 }]) + "\n");
  await writeFile(join(raw, "crosscheck/crosscheck-history.json"), JSON.stringify([{ date: "2026-09-27", id: "a", tcgMarket: 6 }]) + "\n");
  await stagePrivate({ checkout: join(root, "gone"), rawDir: raw, dest, date: "2026-09-27" });
  const mergedHist = JSON.parse(await readFile(join(dest, "data/crosscheck-history.json"), "utf8"));
  t("a fresh runner's crosscheck history is merged, not overwritten", mergedHist.length === 2 && mergedHist[0].date === "2026-06-01" && mergedHist[1].date === "2026-09-27");
  const unmounted = await mountPrivate({ token: "" });
  t("mount without a token does not clone", unmounted.mounted === false);
  const mountDown = await mountPrivate({
    token: "not-a-real-token-value",
    runGit: async () => ({ code: 128, err: "auth failed not-a-real-token-value", out: "" }),
  });
  t("a down mount does not throw or print the token", mountDown.mounted === false && !String(mountDown.reason).includes("not-a-real-token-value"));
  const workflow = await readFile(join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".github/workflows/update-sealed-prices.yml"), "utf8");
  const mountAt = workflow.indexOf("node scripts/mount-private-ppt.mjs");
  const crossAt = workflow.indexOf("node scripts/fetch-sealed-crosscheck.mjs");
  const refreshAt = workflow.indexOf("node scripts/ppt-refresh.mjs");
  t("mount runs before the crosscheck fetch", mountAt > 0 && mountAt < crossAt);
  t("mount runs before the PPT refresh", mountAt < refreshAt);
  t("slab status is in the commit list", workflow.includes("data/history/slabs/status.json"));
  t("the one-off id review file stays off the nightly commit list (PR #116)", !workflow.includes("data/ppt/sealed-id-review.json"));
  const heartbeatAdds = workflow.split("git add").filter((part) => part.includes("data/heartbeat.json"));
  t("heartbeat.json is on both daily commit lists", heartbeatAdds.length >= 2);
  const watchdog = await readFile(join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".github/workflows/watchdog.yml"), "utf8");
  t("watchdog can write the retry log", /contents:\s*write/.test(watchdog));
  t("watchdog does not swallow a failed push", !watchdog.includes("git push || true"));
  await rm(root, { recursive: true, force: true });
  // Private clones skip raw/ (about 19 GB by 2026-11-11). Run 43111961381 lost its runner in the rebuild.
  const calls = [];
  const okGit = async (cmd, args) => { calls.push(args); return { code: 0, err: "", out: "" }; };
  const cloned = await clonePrivate(okGit, "https://example.invalid/private.git", "/tmp/x", {});
  t("a private clone is shallow and fetches no blobs up front", cloned.code === 0 && calls[0].includes("--depth") && calls[0].includes("--filter=blob:none") && calls[0].includes("--no-checkout"));
  t("a private clone leaves raw/ out of the checkout", calls[1].join(" ").includes("sparse-checkout set --no-cone") && PRIVATE_SPARSE.includes("!/raw/") && calls[2].at(-1) === "checkout");
  const failCalls = [];
  const badGit = async (cmd, args) => { failCalls.push(args); return { code: 128, err: "auth failed", out: "" }; };
  const failed = await clonePrivate(badGit, "https://example.invalid/private.git", "/tmp/x", {});
  t("a failed private clone stops before the checkout", failed.code === 128 && failCalls.length === 1);
  const incCalls = [];
  await clonePrivate(async (cmd, args) => { incCalls.push(args); return { code: 0, err: "", out: "" }; }, "https://example.invalid/private.git", "/tmp/x", {}, { include: ["/raw/2026-11-12/"] });
  t("an include pattern is added after the raw/ exclusion", incCalls[1].at(-1) === "/raw/2026-11-12/" && incCalls[1].indexOf("!/raw/") < incCalls[1].indexOf("/raw/2026-11-12/"));

  // Run 43126099936 lost its runner in "Dated reads, rip value, and status":
  // full 21 GB private checkouts. The push step must not check out old raw/ days either.
  const pushRoot = await mkdtemp(join(tmpdir(), "ppt-push-"));
  await mkdir(join(pushRoot, "raw/ppt-sealed"), { recursive: true });
  await writeFile(join(pushRoot, "raw/ppt-sealed/a.json"), "{}\n");
  const pushCalls = [];
  const recGit = async (_cmd, args) => {
    pushCalls.push(args);
    if (args.includes("--quiet")) return { code: 1, err: "", out: "" };
    if (args.includes("rev-parse")) return { code: 0, err: "", out: "abc123\n" };
    return { code: 0, err: "", out: "" };
  };
  await pushPrivate({ token: "not-a-real-token-value", checkout: join(pushRoot, "gone"), rawDir: join(pushRoot, "raw"), date: "2026-11-12", runGit: recGit });
  const cloneCall = pushCalls.find((a) => a[0] === "clone") || [];
  const sparseCall = pushCalls.find((a) => a.includes("sparse-checkout")) || [];
  const adds = pushCalls.filter((a) => a.includes("add")).map((a) => a.slice(a.indexOf("add") + 1).join(" "));
  t("the raw PPT push clones shallow and blob-less", cloneCall.includes("--depth") && cloneCall.includes("--filter=blob:none") && cloneCall.includes("--no-checkout"));
  t("the raw PPT push checks out only tonight's raw day", sparseCall.includes("!/raw/") && sparseCall.at(-1) === "/raw/2026-11-12/");
  t("the raw PPT push adds data/ and raw/<date>, never all of raw/", adds.includes("data") && adds.includes(join("raw", "2026-11-12")) && !adds.includes("raw"));
  await rm(pushRoot, { recursive: true, force: true });

  const wf = await readFile(join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".github/workflows/update-sealed-prices.yml"), "utf8");
  const datedAt = wf.indexOf("- name: Dated reads, rip value, and status");
  const datedHead = wf.slice(datedAt, wf.indexOf("run:", datedAt));
  t("the dated reads step has a time cap", /timeout-minutes:\s*\d+/.test(datedHead));
  t("a hung dated reads step does not skip the price commit", /continue-on-error:\s*true/.test(datedHead));
  const earlyAt = wf.indexOf("- name: Commit price data (before anything reports on it)");
  const earlyBody = wf.slice(earlyAt, wf.indexOf("- name:", earlyAt + 10));
  t("the watch log is committed before the reports run", earlyBody.includes("git add research/pulse/watch-log.json"));
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fail = await runPrivatePptTests();
  if (fail) process.exit(1);
}
