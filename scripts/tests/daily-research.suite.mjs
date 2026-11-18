// Mocked xAI responses for the weekday research script.
// Never calls the real API. A fake key is used.
import { mkdtemp, mkdir, writeFile, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDailyResearch } from "../daily-research.mjs";

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

  return fail;
}
