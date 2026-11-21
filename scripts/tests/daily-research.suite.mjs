// Mocked xAI responses for the weekday research script.
// Never calls the real API. A fake key is used.
import { mkdtemp, mkdir, writeFile, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDailyResearch, defaultResolveUrl, MODEL_DEFAULT } from "../daily-research.mjs";
import { dailyResearchVendorProblem } from "../check-daily-research-vendor.mjs";

const PROMPT = `# Catch'em Daily Research Brief

## Check, in priority order

1. New set / product announcements
2. Date changes
3. Supply events
4. Grading news
5. Market-moving news

## STANDING WATCH
- TPCi PRINT CAPACITY
- SPECIALTY-SET CADENCE SENTIMENT

## PART 3
This part is not used by the script.
`;

function fakeFetch(text) {
  return async (url) => {
    if (String(url).includes("api.x.ai")) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          output_text: text,
          usage: { input_tokens: 1200, output_tokens: 400 },
          server_side_tool_usage: { SERVER_SIDE_TOOL_WEB_SEARCH: 5 },
        }),
      };
    }
    return { ok: true, status: 200, text: async () => "" };
  };
}

async function fixture(radar, news) {
  const root = await mkdtemp(join(tmpdir(), "research-"));
  await mkdir(join(root, "data"), { recursive: true });
  await mkdir(join(root, "research", "digests"), { recursive: true });
  await mkdir(join(root, "research", "assets", "public"), { recursive: true });
  await writeFile(join(root, "research", "RESEARCH_PROMPT.md"), PROMPT);
  await writeFile(join(root, "data", "release-radar.json"), JSON.stringify(radar, null, 2) + "\n");
  await writeFile(join(root, "research", "digests", "news.json"), JSON.stringify(news || { items: [] }));
  return root;
}

async function exists(p) {
  try { await access(p); return true; }
  catch { return false; }
}

const baseRadar = {
  updated: "2026-11-13",
  notes: "",
  checkedAt: "2026-11-13T00:00:00.000Z",
  checkedBy: "assistant-research",
  lastCheck: "radar updated",
  upcoming: [
    { name: "Future Set", type: "main-set", date: "2026-12-04", confidence: "verified", note: "on schedule", sources: ["https://pokemon.com/a", "https://pokebeach.com/a"] },
    { name: "Past Set", type: "product", date: "2026-11-10", confidence: "verified", note: "released", sources: ["https://pokemon.com/b"] },
  ],
};

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok  " + name);
    else { fail += 1; console.error("  FAIL " + name); }
  };
  const today = "2026-11-17";
  const alwaysResolve = async () => true;
  const writePublic = async (root) => {
    await writeFile(join(root, "research", "assets", "public", "releases.json"), '{"checked":"2026-11-17"}\n');
    return true;
  };

  // new set found
  {
    const root = await fixture(baseRadar);
    const body = JSON.stringify({
      digest: "# Research Digest - 2026-11-17\n\n## Flags\n- NEW_SET: Sample Set on 2027-01-15. https://pokebeach.com/sample\n\n## New since yesterday\n- Sample Set. https://pokebeach.com/sample\n\n## Radar check\n- Future Set: on schedule.\n\n## Notable but not urgent\n- None.",
      claims: [{ text: "Sample Set announced for 2027-01-15", url: "https://pokebeach.com/sample", sources: ["https://pokebeach.com/sample", "https://icv2.com/sample"] }],
      radar: { upcoming: [
        { name: "Future Set", type: "main-set", date: "2026-12-04", confidence: "verified", note: "on schedule", sources: ["https://pokemon.com/a", "https://pokebeach.com/a"] },
        { name: "Sample Set", type: "main-set", date: "2027-01-15", confidence: "verified", note: "new", sources: ["https://pokebeach.com/sample", "https://icv2.com/sample"] },
      ] },
      nothingNew: false,
    });
    const r = await runDailyResearch({ apiKey: "fake-key", root, today, fetchImpl: fakeFetch(body), resolveUrl: alwaysResolve, writePublic });
    const radar = JSON.parse(await readFile(join(root, "data", "release-radar.json"), "utf8"));
    const digest = await readFile(r.digestPath, "utf8");
    t("new set is written", r.ok && radar.upcoming.some((x) => x.name === "Sample Set"));
    t("new set digest starts with the radar line", digest.startsWith("> RADAR: radar updated"));
    t("checkedBy is research-script", radar.checkedBy === "research-script");
  }

  // nothing new
  {
    const quiet = { ...baseRadar, upcoming: baseRadar.upcoming.filter((x) => x.name !== "Past Set") };
    const root = await fixture(quiet);
    const body = JSON.stringify({
      digest: "# Research Digest - 2026-11-17\n\n## Flags\nNo flags.\n\n## New since yesterday\nNothing new today.\n\n## Radar check\n- Future Set: on schedule.\n\n## Notable but not urgent\n- None.",
      claims: [],
      radar: null,
      nothingNew: true,
    });
    const r = await runDailyResearch({ apiKey: "fake-key", root, today, fetchImpl: fakeFetch(body), resolveUrl: alwaysResolve, writePublic });
    const digest = await readFile(r.digestPath, "utf8");
    const radar = JSON.parse(await readFile(join(root, "data", "release-radar.json"), "utf8"));
    t("nothing new still writes a digest", r.ok && /Nothing new today/.test(digest));
    t("nothing new marks the radar checked", digest.startsWith("> RADAR: radar checked, no change"));
    t("nothing new does not move updated", radar.updated === "2026-11-13" && radar.lastCheck === "checked, no change");
  }

  // claim with no URL is dropped
  {
    const root = await fixture(baseRadar);
    const body = JSON.stringify({
      digest: "# Research Digest - 2026-11-17\n\n## Flags\nNo flags.\n\n## New since yesterday\nNothing material.\n\n## Radar check\n- Future Set: on schedule.",
      claims: [
        { text: "A claim with no source", url: "" },
        { text: "A claim with a source", url: "https://pokebeach.com/ok", sources: ["https://pokebeach.com/ok"] },
      ],
      radar: null,
      nothingNew: false,
    });
    const r = await runDailyResearch({ apiKey: "fake-key", root, today, fetchImpl: fakeFetch(body), resolveUrl: alwaysResolve, writePublic });
    t("claim with no URL is dropped", r.ok && r.dropped.some((d) => d.reason === "no URL") && r.keptClaims.length === 1);
  }

  // single-source date
  {
    const root = await fixture(baseRadar);
    const body = JSON.stringify({
      digest: "# Research Digest - 2026-11-17\n\n## Flags\nNo flags.\n\n## New since yesterday\nNothing material.\n\n## Radar check\n- Future Set: on schedule.",
      claims: [],
      radar: { upcoming: [
        { name: "Future Set", type: "main-set", date: "2026-12-04", confidence: "verified", note: "one outlet", sources: ["https://pokebeach.com/only"] },
      ] },
      nothingNew: false,
    });
    const r = await runDailyResearch({ apiKey: "fake-key", root, today, fetchImpl: fakeFetch(body), resolveUrl: alwaysResolve, writePublic });
    const radar = JSON.parse(await readFile(join(root, "data", "release-radar.json"), "utf8"));
    const row = radar.upcoming.find((x) => x.name === "Future Set");
    t("single source forces single-source", r.ok && row && row.confidence === "single-source");
  }

  // passed date removed
  {
    const root = await fixture(baseRadar);
    const body = JSON.stringify({
      digest: "# Research Digest - 2026-11-17\n\n## Flags\nNo flags.\n\n## New since yesterday\nNothing material.\n\n## Radar check\n- Future Set: on schedule.",
      claims: [],
      radar: { upcoming: baseRadar.upcoming },
      nothingNew: false,
    });
    const r = await runDailyResearch({ apiKey: "fake-key", root, today, fetchImpl: fakeFetch(body), resolveUrl: alwaysResolve, writePublic });
    const radar = JSON.parse(await readFile(join(root, "data", "release-radar.json"), "utf8"));
    t("passed date is removed", r.ok && !radar.upcoming.some((x) => x.name === "Past Set") && r.droppedPast.includes("Past Set"));
  }

  // missing secret fails and writes nothing
  {
    const root = await fixture(baseRadar);
    const before = await readFile(join(root, "data", "release-radar.json"), "utf8");
    const r = await runDailyResearch({ apiKey: "", root, today, fetchImpl: fakeFetch("{}"), resolveUrl: alwaysResolve, writePublic });
    const after = await readFile(join(root, "data", "release-radar.json"), "utf8");
    const wrote = await exists(join(root, "research", "digests", today + ".md"));
    t("missing secret fails", r.ok === false && /XAI_API_KEY/.test(r.error));
    t("missing secret writes nothing", !wrote && after === before);
  }

  // malformed model output fails without writing
  {
    const root = await fixture(baseRadar);
    const before = await readFile(join(root, "data", "release-radar.json"), "utf8");
    const r = await runDailyResearch({ apiKey: "fake-key", root, today, fetchImpl: fakeFetch("this is not json"), resolveUrl: alwaysResolve, writePublic });
    const after = await readFile(join(root, "data", "release-radar.json"), "utf8");
    const wrote = await exists(join(root, "research", "digests", today + ".md"));
    t("malformed output fails", r.ok === false && /JSON/.test(r.error));
    t("malformed output writes nothing", !wrote && after === before);
  }

  // rerun the same day overwrites
  {
    const root = await fixture(baseRadar);
    const first = JSON.stringify({
      digest: "# Research Digest - 2026-11-17\n\n## Flags\nNo flags.\n\n## New since yesterday\nFirst run.\n\n## Radar check\n- Future Set: on schedule.",
      claims: [], radar: null, nothingNew: true,
    });
    const second = JSON.stringify({
      digest: "# Research Digest - 2026-11-17\n\n## Flags\nNo flags.\n\n## New since yesterday\nSecond run.\n\n## Radar check\n- Future Set: on schedule.",
      claims: [], radar: null, nothingNew: true,
    });
    await runDailyResearch({ apiKey: "fake-key", root, today, fetchImpl: fakeFetch(first), resolveUrl: alwaysResolve, writePublic });
    await runDailyResearch({ apiKey: "fake-key", root, today, fetchImpl: fakeFetch(second), resolveUrl: alwaysResolve, writePublic });
    const digest = await readFile(join(root, "research", "digests", today + ".md"), "utf8");
    t("same day rerun overwrites", /Second run/.test(digest) && !/First run/.test(digest));
  }

  // 403 is kept and tagged. 404 is dropped. A block is not retried.
  {
    const quiet = { ...baseRadar, upcoming: baseRadar.upcoming.filter((x) => x.name !== "Past Set") };
    const root = await fixture(quiet);
    const hits = {};
    const body = JSON.stringify({
      digest: "# Research Digest - 2026-11-17\n\n## Flags\nNo flags.\n\n## New since yesterday\nTwo claims.\n\n## Radar check\n- Future Set: on schedule.",
      claims: [
        { text: "blocked host", url: "https://blocked.example/page", sources: ["https://blocked.example/page"] },
        { text: "missing page", url: "https://missing.example/gone", sources: ["https://missing.example/gone"] },
      ],
      radar: null,
      nothingNew: false,
    });
    const fetchImpl = async (url, opts) => {
      const u = String(url);
      if (u.includes("api.x.ai")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ output_text: body }),
        };
      }
      hits[u] = (hits[u] || 0) + 1;
      if (opts?.method !== "HEAD") throw new Error("retried " + u);
      if (u.includes("blocked.example")) return { ok: false, status: 403, headers: { get() { return ""; } } };
      if (u.includes("missing.example")) return { ok: false, status: 404, headers: { get() { return ""; } } };
      return { ok: true, status: 200, headers: { get() { return ""; } } };
    };
    const r = await runDailyResearch({ apiKey: "fake-key", root, today, fetchImpl, writePublic });
    const digest = await readFile(r.digestPath, "utf8");
    t("403 is kept", r.ok && r.keptClaims.some((c) => c.url === "https://blocked.example/page" && c.urlStatus === "exists, unverified"));
    t("403 is tagged in the digest", digest.includes("exists, unverified: https://blocked.example/page"));
    t("403 is not retried", hits["https://blocked.example/page"] === 1);
    t("404 is dropped", r.dropped.some((d) => d.url === "https://missing.example/gone" && d.reason === "404"));
    t("404 is not retried", hits["https://missing.example/gone"] === 1);
  }

  {
    const headers = { get(name) { return name.toLowerCase() === "cf-mitigated" ? "challenge" : ""; } };
    const challenge = await defaultResolveUrl("https://challenge.example/a", async (_url, opts) => {
      if (opts?.method !== "HEAD") throw new Error("retried challenge");
      return { ok: true, status: 200, headers };
    });
    t("a bot challenge is kept and tagged", challenge.keep === true && challenge.tag === "exists, unverified");
    const timed = await defaultResolveUrl("https://slow.example/a", async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    t("a timeout is dropped", timed.keep === false && timed.reason === "dns-or-timeout");
  }

  {
    const prev = process.env.XAI_MODEL;
    delete process.env.XAI_MODEL;
    let sent = "";
    const root = await fixture({ ...baseRadar, upcoming: baseRadar.upcoming.filter((x) => x.name !== "Past Set") });
    const body = JSON.stringify({
      digest: "# Research Digest - 2026-11-17\n\n## Flags\nNo flags.\n\n## New since yesterday\nNothing new today.\n\n## Radar check\n- Future Set: on schedule.",
      claims: [],
      radar: null,
      nothingNew: true,
    });
    await runDailyResearch({
      apiKey: "fake-key",
      root,
      today,
      resolveUrl: alwaysResolve,
      writePublic,
      fetchImpl: async (_url, opts) => {
        sent = opts.body;
        return { ok: true, status: 200, text: async () => JSON.stringify({ output_text: body }) };
      },
    });
    if (prev === undefined) delete process.env.XAI_MODEL;
    else process.env.XAI_MODEL = prev;
    t("unset XAI_MODEL sends grok-4.7", MODEL_DEFAULT === "grok-4.7" && sent.includes('"model":"grok-4.7"'));
  }

  {
    const wf = await readFile(new URL("../../.github/workflows/daily-research.yml", import.meta.url), "utf8");
    t("the job starts when sealed prices completes", /workflow_run:/.test(wf) && wf.includes("Update sealed prices") && wf.includes("completed"));
    t("the fallback cron is 18:30 UTC on weekdays", /30 18 \* \* 1-5/.test(wf));
    t("the mid-run 14:46 cron is gone", !/46 14/.test(wf));
    t("there is no wait loop", !/sleep /.test(wf));
    t("a live price run exits without a push", wf.includes("exiting without a push"));
    t("schedule and workflow_run skip an existing digest", wf.includes('!= "workflow_dispatch"') && wf.includes("already exists"));
    t("only workflow_dispatch forces a run", !wf.includes('= "schedule"'));
    const src = await readFile(new URL("../daily-research.mjs", import.meta.url), "utf8");
    t("xAI schedule is allowed", dailyResearchVendorProblem(wf, src) === "");
    t("an old paid-chat key is rejected", dailyResearchVendorProblem(wf.replace("XAI_API_KEY", "ANTHROPIC_API_KEY"), src) === "anthropic-key");
    t("an old paid-chat call is rejected", dailyResearchVendorProblem(wf, src + "\nfetch('https://api.anthropic.com/v1/messages')") === "anthropic-call");
    t("a claude model call is rejected", dailyResearchVendorProblem(wf, src + "\nconst model = 'claude-sonnet'") === "claude-call");
    const freshAt = wf.indexOf("artifact-freshness.mjs");
    const scriptAt = wf.indexOf("scripts/daily-research.mjs");
    const schemaAt = wf.indexOf("schema-guard.mjs");
    const replyAt = wf.indexOf("reply-line-guard.mjs");
    t("freshness runs before the paid script", freshAt > 0 && freshAt < scriptAt && scriptAt < schemaAt && schemaAt < replyAt);
    const scriptStep = wf.slice(wf.indexOf("- name: Run research script"), scriptAt);
    t("a freshness failure skips the paid script", /if: success\(\) && steps\.gate\.outputs\.skip != '1'/.test(scriptStep));
  }

  async function blocked(digest, extra = {}) {
    const root = await fixture({ ...baseRadar, upcoming: baseRadar.upcoming.filter((x) => x.name !== "Past Set") });
    if (extra.accounts) {
      await mkdir(join(root, "data"), { recursive: true });
      await writeFile(join(root, "data", "observed-accounts.json"), JSON.stringify(extra.accounts));
    }
    const before = await readFile(join(root, "data", "release-radar.json"), "utf8");
    const body = JSON.stringify({
      digest,
      claims: extra.claims || [],
      radar: extra.radar || null,
      nothingNew: true,
    });
    const r = await runDailyResearch({
      apiKey: "fake-key",
      root,
      today,
      fetchImpl: fakeFetch(body),
      resolveUrl: extra.resolveUrl || alwaysResolve,
      writePublic,
    });
    const after = await readFile(join(root, "data", "release-radar.json"), "utf8");
    const wrote = await exists(join(root, "research", "digests", today + ".md"));
    return { r, wrote, same: after === before };
  }

  const plain = "# Research Digest - 2026-11-17\n\n## Flags\nNo flags.\n\n## New since yesterday\nNothing new today.\n\n## Radar check\n- Future Set: on schedule.";

  {
    const em = await blocked(plain.replace("No flags.", "No flags. Price moved \u2014 then settled."));
    t("an em dash writes nothing", em.r.ok === false && em.r.blocked === "em or en dash" && !em.wrote && em.same);
    const en = await blocked(plain.replace("No flags.", "No flags. Price moved \u2013 then settled."));
    t("an en dash writes nothing", en.r.ok === false && en.r.blocked === "em or en dash" && !en.wrote && en.same);
    const advice = await blocked(plain.replace("No flags.", "No flags. You should sell this."));
    t("an advice phrase writes nothing", advice.r.ok === false && advice.r.blocked === "advice phrase" && !advice.wrote && advice.same);
    const named = await blocked(plain.replace("No flags.", "No flags. SampleCreator said the date moved."), {
      accounts: { accounts: [{ handle: "SampleCreator" }] },
    });
    t("a creator name writes nothing", named.r.ok === false && named.r.blocked === "creator name" && !named.wrote && named.same);
    const brand = await blocked(plain.replace("No flags.", "No flags. See Collectr for the date."));
    t("Collectr writes nothing", brand.r.ok === false && brand.r.blocked === "Collectr" && !brand.wrote && brand.same);
  }

  {
    const root = await fixture(baseRadar);
    const body = JSON.stringify({
      digest: plain + "\n\n## New since yesterday\n- Dropped line https://gone.example/missing\n- Kept line stays.\n\n## Claims\n- model claim https://gone.example/missing",
      claims: [
        { text: "Dropped claim text that must not ship", url: "https://gone.example/missing" },
        { text: "Kept claim text that must ship", url: "https://pokebeach.com/ok" },
      ],
      radar: { upcoming: [
        { name: "Future Set", type: "main-set", date: "2026-12-04", confidence: "verified", note: "two hosts", sources: ["https://pokemon.com/live", "https://gone.example/missing"] },
      ] },
    });
    const resolveUrl = async (url) => String(url).includes("gone.example") ? { keep: false, reason: "404" } : { keep: true, tag: null };
    const r = await runDailyResearch({ apiKey: "fake-key", root, today, fetchImpl: fakeFetch(body), resolveUrl, writePublic });
    const digest = await readFile(r.digestPath, "utf8");
    const radar = JSON.parse(await readFile(join(root, "data", "release-radar.json"), "utf8"));
    const row = radar.upcoming.find((item) => item.name === "Future Set");
    t("a 404 host leaves the row single-source", r.ok && row && row.confidence === "single-source" && row.sources.length === 1 && row.sources[0] === "https://pokemon.com/live");
    t("claims are built from the kept claim only", digest.includes("## Claims") && digest.includes("Kept claim text that must ship") && digest.includes("https://pokebeach.com/ok") && !digest.includes("gone.example") && !digest.includes("Dropped claim text") && !digest.includes("model claim"));
  }

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("daily-research.suite.mjs")) {
  run().then((n) => process.exit(n ? 1 : 0));
}
