import { citedFiles, pendingBuilds, prsFromLog, renderBrief, weekWindow } from "../lib/founder-brief.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const window = weekWindow("2026-10-18");
  t("the week is seven days ending on the brief day", window.start === "2026-10-12" && window.end === "2026-10-18");
  const text = renderBrief({
    asOf: "2026-10-18",
    prs: [
      { number: 298, title: "Add a read-only cost and limit watcher.", mergedAt: "2026-10-15T23:00:00Z", repo: "Catchem-data" },
      { number: 10, title: "Old work", mergedAt: "2026-09-01T00:00:00Z", repo: "Catchem-data" },
    ],
    status: { asOf: "2026-10-15", failures: ["scanner"] },
    limits: { sources: [{ id: "ebay-browse", asOf: "2026-10-15", used: 1446, limit: 4277 }] },
    listings: { asOf: "2026-10-15", rows: 1200 },
    queue: [
      { id: "RD8", title: "Weekly brief", status: "SHIPPED", prompt: "skip" },
      { id: "DC1", title: "Member pulse", status: "OPEN", prompt: "FOR: catchem-bot · P-1017-DC1\n\nCount members only. Store no message content." },
      { id: "TF9", title: "Scorecard", status: "OPEN", prompt: "FOR: catchem-site · P-1017-TF9\n\nHidden page. Leave SCORECARD_PUBLIC false." },
      { id: "RD6", title: "Story finder", status: "OPEN", prompt: "FOR: Catchem-data · P-1017-RD6\n\nGroup official items into one story." },
      { id: "RD7", title: "Extra", status: "OPEN", prompt: "no" },
    ],
  });
  t("shipped keeps this week and drops an older PR", text.includes("#298") && !text.includes("#10"));
  t("a failure and a dated number are both present", text.includes("scanner failed on 2026-10-15") && text.includes("1446 of 4277") && text.includes("1200"));
  t("only three next builds are listed", text.includes("### 1. DC1") && text.includes("### 3. RD6") && !text.includes("### 4."));
  const cites = citedFiles(text);
  t("every number cites a dated json file", cites.length >= 2 && cites.every((path) => path.endsWith(".json")) && text.includes("(data/derived/status.json)") && text.includes("(data/derived/limits/latest.json)"));
  const quiet = renderBrief({ asOf: "2026-10-18" });
  t("empty inputs hide the sections", !quiet.includes("## Shipped") && !quiet.includes("## Broke") && !quiet.includes("## Numbers") && !quiet.includes("No data"));
  let threw = false;
  try { renderBrief({ asOf: "" }); } catch { threw = true; }
  t("a brief without a date is refused", threw);
  const parsed = prsFromLog("2026-10-16T00:50:12Z\tAdd a Canada retail gap read. (#301)\nnope");
  t("a merge title becomes a dated PR row", parsed.length === 1 && parsed[0].number === 301 && parsed[0].mergedAt.startsWith("2026-10-16"));
  const kept = pendingBuilds(
    [{ id: "RD5", title: "Done", status: "OPEN", prompt: "skip me" }, { id: "DC1", title: "Member pulse", status: "OPEN", prompt: "Count members only." }],
    "## RD5\n- status: SHIPPED\n",
  );
  t("a shipped job is not a next build", kept.length === 1 && kept[0].id === "DC1");
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("founder-brief.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("founder brief ok");
}
