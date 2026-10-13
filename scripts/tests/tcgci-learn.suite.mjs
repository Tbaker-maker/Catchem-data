import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mapChannel,
  directionOf,
  theirVerdict,
  normalizeCall,
  parseLedger,
  crossCheck,
  publicSafeStatus,
  TCGCI_USER_AGENT,
  TCGCI_CALLS_URL,
} from "../lib/tcgci.mjs";
import { runTcgciLearn } from "../tcgci-learn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function sampleLedger() {
  return {
    updated: "2026-10-10T12:11:40Z",
    scoring: { eval_days: 30, flat_band_pct: 5.0 },
    calls: [
      {
        id: "a", week: "2026-W36", issued: "2026-09-05", channel: "Nostalgia Nomics",
        video_id: "vid1", ts: "01:00", url: "https://www.youtube.com/watch?v=vid1&t=60s",
        text: "Buy: Destined Rivals ETBs", rating: "buy", item: "Destined Rivals Elite Trainer Box",
        kind: "sealed", target_price: 100, horizon: "",
        price: { product_id: 624676, product: "Destined Rivals Elite Trainer Box", set: "SV10", confidence: 1, at_call: 100, at_30d: 120, now: 120, now_date: "2026-10-05", priced_at: "2026-10-05" },
      },
      {
        id: "b", week: "2026-W36", issued: "2026-09-05", channel: "The Poke Plumber",
        video_id: "vid2", ts: "02:00", url: "https://www.youtube.com/watch?v=vid2",
        text: "Avoid: Prismatic ETBs", rating: "avoid", item: "Prismatic Evolutions Elite Trainer Box",
        kind: "sealed", target_price: null, horizon: "",
        price: { product_id: 201, product: "Prismatic Evolutions Elite Trainer Box", set: "SV", confidence: 1, at_call: 140, at_30d: 120, now: 120, now_date: "2026-10-05", priced_at: "2026-10-05" },
      },
      {
        id: "c", week: "2026-W36", issued: "2026-09-05", channel: "AnonTCG",
        video_id: "vid3", ts: "03:00", url: "https://www.youtube.com/watch?v=vid3",
        text: "Hold: Surging Sparks boxes", rating: "hold", item: "Surging Sparks Booster Box",
        kind: "sealed", target_price: null, horizon: "",
        price: { product_id: 301, product: "Surging Sparks Booster Box", set: "SV08", confidence: 1, at_call: 300, at_30d: 290, now: 290, now_date: "2026-10-05", priced_at: "2026-10-05" },
      },
      {
        id: "d", week: "2026-W41", issued: "2026-10-10", channel: "Danny Phantump",
        video_id: "vid4", ts: "04:00", url: "https://www.youtube.com/watch?v=vid4",
        text: "Buy: pending call", rating: "buy", item: "Some Box",
        kind: "sealed", target_price: null, horizon: "",
        price: { product_id: 401, product: "Some Box", set: "X", confidence: 1, at_call: 50, at_30d: null, now: 50, now_date: "2026-10-10", priced_at: "2026-10-10" },
      },
    ],
  };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };

  t("user agent names Catch'em", /CatchEmBot/.test(TCGCI_USER_AGENT) && /catchemtcg\.com/.test(TCGCI_USER_AGENT));
  t("calls URL is the public ledger, not /api/", TCGCI_CALLS_URL.endsWith("/track-record/calls.json") && !TCGCI_CALLS_URL.includes("/api/"));
  t("channel map: Nomics", mapChannel("Nostalgia Nomics") === "nomics");
  t("channel map: Plumber", mapChannel("The Poke Plumber") === "pokeplumber");
  t("channel map: unknown stays null", mapChannel("Someone Else") === null);
  t("direction buy/sell/hold", directionOf("buy") === 1 && directionOf("avoid") === -1 && directionOf("hold") === 0);

  const buyUp = theirVerdict({ rating: "buy", price: { product_id: 1, at_call: 100, at_30d: 110 } });
  const buyFlat = theirVerdict({ rating: "buy", price: { product_id: 1, at_call: 100, at_30d: 103 } });
  const buyDown = theirVerdict({ rating: "buy", price: { product_id: 1, at_call: 100, at_30d: 90 } });
  const avoidDown = theirVerdict({ rating: "avoid", price: { product_id: 1, at_call: 100, at_30d: 90 } });
  const holdOk = theirVerdict({ rating: "hold", price: { product_id: 1, at_call: 100, at_30d: 97 } });
  const holdBad = theirVerdict({ rating: "hold", price: { product_id: 1, at_call: 100, at_30d: 90 } });
  const pending = theirVerdict({ rating: "buy", price: { product_id: 1, at_call: 100, at_30d: null } });
  t("their verdict: buy up >5% is right", buyUp === "right");
  t("their verdict: buy inside ±5% is flat", buyFlat === "flat");
  t("their verdict: buy down >5% is wrong", buyDown === "wrong");
  t("their verdict: avoid down >5% is right", avoidDown === "right");
  t("their verdict: hold small drop is right", holdOk === "right");
  t("their verdict: hold drop >5% is wrong", holdBad === "wrong");
  t("their verdict: missing +30d with product is pending", pending === "pending");
  t("their verdict: no product is unscored", theirVerdict({ rating: "buy", price: { at_call: null, at_30d: null } }) === "unscored");

  const parsed = parseLedger(sampleLedger());
  t("parse: 4 calls", parsed.calls.length === 4);
  t("parse: Nomics mapped", parsed.calls[0].channelKey === "nomics" && parsed.calls[0].theirVerdict === "right");
  t("parse: avoid right", parsed.calls[1].theirVerdict === "right");
  t("parse: hold small drop right", parsed.calls[2].theirVerdict === "right");
  t("parse: pending counted", parsed.counts.byVerdict.pending === 1);
  t("normalize omits claim prose", parsed.calls[0].text == null && parsed.calls[0].item === "Destined Rivals Elite Trainer Box");

  const ourClaims = [
    { videoId: "vid1", pid: 624676, h30: { day: "2026-10-05", chg: 0.2, excess: 0.1, result: "hit", held: true } },
    { videoId: "vid2", pid: 201, h30: { day: "2026-10-05", chg: -0.14, excess: -0.05, result: "hit", held: true } },
    { videoId: "vid3", pid: 301, h30: { day: "2026-10-05", chg: -0.03, excess: 0, result: "flat", held: false } },
  ];
  const cross = crossCheck(parsed.calls, ourClaims);
  t("cross: matched scored overlap", cross.matched === 3);
  t("cross: agree on buy and avoid", cross.agree === 2);
  t("cross: disagree when our flat vs their right on hold", cross.disagree === 1);
  t("cross: byChannel has nomics", cross.byChannel.some((r) => r.key === "nomics" && r.agree === 1));

  const pub = publicSafeStatus({ asOf: "2026-10-12", fetchedAt: "2026-10-12T00:00:00Z", status: "ok", counts: parsed.counts, cross });
  const pubS = JSON.stringify(pub);
  t("public status has counts only", pub.calls === 4 && pub.scored === 3 && pub.pending === 1);
  t("public status carries no claim text or creator names", !/Buy:|Nostalgia|Plumber|Destined|Prismatic/.test(pubS));
  t("private normalize has no Buy: prose either", !parsed.calls.some((c) => c.text));

  // Runner: one polite fetch, private files, no block past 403.
  const root = await mkdtemp(join(tmpdir(), "tcgci-"));
  await mkdir(join(root, "data/derived"), { recursive: true });
  await mkdir(join(root, "data/private/youtube"), { recursive: true });
  await writeFile(join(root, "data/private/youtube/claims.json"), JSON.stringify({ claims: ourClaims }) + "\n");
  let fetches = 0, lastHeaders = null;
  const okFetch = async (url, opts) => {
    fetches++;
    lastHeaders = opts?.headers || {};
    t("fetch hits the public ledger URL", url === TCGCI_CALLS_URL);
    return {
      ok: true, status: 200,
      headers: { get: (k) => (String(k).toLowerCase() === "content-type" ? "application/json" : null) },
      json: async () => sampleLedger(),
    };
  };
  const local = { dir: join(root, "data/private"), remote: false, close: async () => ({ pushed: false, reason: "local" }) };
  const ok = await runTcgciLearn({ root, token: "", fetchFn: okFetch, store: local, now: new Date("2026-10-12T12:00:00Z") });
  t("runner: one request", fetches === 1);
  t("runner: clear user agent", lastHeaders["User-Agent"] === TCGCI_USER_AGENT);
  t("runner: ok status and counts", ok.status === "ok" && ok.calls === 4 && ok.crossMatched === 3);
  const privCalls = JSON.parse(await readFile(join(root, "data/private/tcgci/calls.json"), "utf8"));
  const privCross = JSON.parse(await readFile(join(root, "data/private/tcgci/crosscheck.json"), "utf8"));
  const pubDoc = JSON.parse(await readFile(join(root, "data/derived/tcgci-status.json"), "utf8"));
  t("private calls have fields, no prose", privCalls.calls[0].item && !privCalls.calls[0].text && privCalls.calls[0].theirVerdict === "right");
  t("private crosscheck has rows", privCross.rows.length === 3);
  t("derived status has no text", !/Buy:|Nostalgia|Destined/.test(JSON.stringify(pubDoc)));
  const log = (await readFile(join(root, "data/private/tcgci/fetch-log.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  t("fetch log has date and URL", log.length >= 1 && log[0].url === TCGCI_CALLS_URL && log[0].fetchedAt);

  fetches = 0;
  const blocked = await runTcgciLearn({
    root, token: "", store: local, now: new Date("2026-10-12T13:00:00Z"),
    fetchFn: async () => { fetches++; return { ok: false, status: 403, headers: { get: () => null }, json: async () => ({}) }; },
  });
  t("blocked: one request, no retry storm", fetches === 1 && blocked.status === "blocked");

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("tcgci-learn.suite.mjs")) {
  process.exit(await run() ? 1 : 0);
}
