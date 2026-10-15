import { driftOf, openFixPr, planFix } from "../lib/data-drift-bot.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  t("matching documents are not drift", driftOf("data/derived/status.json", { asOf: "2026-10-14" }, { asOf: "2026-10-14" }) == null);
  const drift = driftOf("data/derived/status.json", { asOf: "2026-10-17", ok: true }, { asOf: "2026-10-14", ok: true });
  t("a changed document is drift", drift && drift.path === "data/derived/status.json");
  const plan = planFix(drift);
  t("the plan names a branch and the restored file", plan.branch.startsWith("drift-") && plan.files[0].path === "data/derived/status.json" && plan.files[0].contents.includes("2026-10-17"));
  const blocked = openFixPr(plan, { token: "" });
  t("no token means no pull request", blocked.opened === false && blocked.blocked === "no token");
  const calls = [];
  const opened = openFixPr(plan, {
    token: "token",
    run(kind, row) { calls.push(kind); return { ok: true, url: "https://github.com/Tbaker-maker/Catchem-data/pull/1", branch: row.branch }; },
  });
  t("a token asks for the write and then the pull request", opened.opened === true && calls.join(",") === "write,pr");
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("data-drift-bot.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
