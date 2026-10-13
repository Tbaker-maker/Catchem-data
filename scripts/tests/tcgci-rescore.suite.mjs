import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TCGCI_SOURCE,
  mapHorizon,
  ourVerdictFromH,
  toClaim,
  rescoreCalls,
  compareMethods,
  buildScorecards,
  applyHoldBands,
  buildCreatorCatalogue,
  BAND,
} from "../lib/tcgci-score.mjs";
import { runTcgciRescore } from "../tcgci-rescore.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };

  t("source tag", TCGCI_SOURCE === "tcgci-derived");
  t("horizon long/short", mapHorizon("long") === "long" && mapHorizon("short") === 7);
  t("horizon from text", mapHorizon("", "great long-term hold") === "long");

  t("buy hit → right", ourVerdictFromH({ chg: 0.1, excess: 0.05, result: "hit", held: true }) === "right");
  t("buy flat → flat", ourVerdictFromH({ chg: 0.01, excess: 0, result: "flat", held: false }) === "flat");
  t("hold fall → wrong", ourVerdictFromH({ chg: -0.05, excess: -0.02 }, { hold: true }) === "wrong");
  t("hold quiet → flat", ourVerdictFromH({ chg: 0.01, excess: 0 }, { hold: true }) === "flat");
  t("hold up → right", ourVerdictFromH({ chg: 0.08, excess: 0.02 }, { hold: true }) === "right");

  const buy = toClaim({
    id: "x", issued: "2026-08-01", channel: "Nostalgia Nomics", channelKey: "nomics",
    rating: "buy", kind: "sealed", productId: 100, item: "Destined Rivals Elite Trainer Box",
    horizon: "long", theirVerdict: "wrong", videoId: "v1",
  });
  t("toClaim maps channel and long horizon", buy.channel === "nomics" && buy.horizon === "long" && buy.source === TCGCI_SOURCE && buy.pid === 100);
  const hold = toClaim({
    id: "y", issued: "2026-08-01", channel: "AnonTCG", rating: "hold", kind: "sealed",
    productId: 200, theirVerdict: "right", videoId: "v2",
  });
  t("toClaim hold flag", hold.hold === true && hold.channel === "pokeanon");
  t("toClaim skips unknown channel", toClaim({ id: "z", issued: "2026-08-01", channel: "Nobody", productId: 1, rating: "buy" }) == null);
  t("toClaim skips no pid", toClaim({ id: "z", issued: "2026-08-01", channel: "Nostalgia Nomics", rating: "buy" }) == null);

  // Synthetic prices: pid 100 up 20% over 30d beating market; pid 200 flat.
  const prices = new Map([
    [100, new Map([["2026-08-01", 100], ["2026-08-08", 110], ["2026-08-31", 120], ["2026-10-01", 130]])],
    [200, new Map([["2026-08-01", 50], ["2026-08-08", 50], ["2026-08-31", 49], ["2026-10-01", 48]])],
    // market fillers
    ...Array.from({ length: 20 }, (_, i) => [1000 + i, new Map([["2026-08-01", 10], ["2026-08-08", 10.2], ["2026-08-31", 10.5], ["2026-10-01", 11]])]),
  ]);
  const priceOn = (pid, day) => prices.get(Number(pid))?.get(day) ?? null;
  const marketChange = (d1, d2) => {
    const ch = [];
    for (const m of prices.values()) { const a = m.get(d1), b = m.get(d2); if (a > 0 && b > 0) ch.push(b / a - 1); }
    ch.sort((a, b) => a - b);
    return ch.length ? ch[ch.length >> 1] : null;
  };

  const calls = [
    { id: "a", issued: "2026-08-01", channel: "Nostalgia Nomics", channelKey: "nomics", rating: "buy", kind: "sealed", productId: 100, videoId: "v1", horizon: "", theirVerdict: "right", item: "Box A" },
    { id: "b", issued: "2026-08-01", channel: "AnonTCG", channelKey: "pokeanon", rating: "hold", kind: "sealed", productId: 200, videoId: "v2", horizon: "long", theirVerdict: "right", item: "ETB B" },
    { id: "c", issued: "2026-08-01", channel: "The Poke Plumber", channelKey: "pokeplumber", rating: "avoid", kind: "sealed", productId: 100, videoId: "v3", horizon: "short", theirVerdict: "wrong", item: "Box A" },
  ];
  const { claims, skipped } = rescoreCalls(calls, { priceOn, marketChange, today: "2026-10-12" });
  t("rescored 3 claims", claims.length === 3 && skipped.noPid === 0);
  t("buy scored hit at 30d", claims[0].ourVerdict30 === "right" && claims[0].h30?.result === "hit");
  t("avoid on rising card is miss", claims[2].ourVerdict30 === "wrong");
  t("short horizon mapped to 7", claims[2].horizon === 7);
  t("band is 3%", BAND === 0.03);

  const cmp = compareMethods(claims);
  t("compare counts agree/disagree", cmp.compared === 3 && cmp.agree + cmp.disagree === 3);
  const cards = buildScorecards(claims, cmp);
  t("scorecards tagged tcgci-derived", cards.source === TCGCI_SOURCE && cards.creators.every((c) => c.source === TCGCI_SOURCE));
  t("weights separate object", cards.weights.nomics && cards.weights.nomics.weight >= 0.5);

  const cat = buildCreatorCatalogue({
    calls: [
      { channel: "Nostalgia Nomics", channelKey: "nomics", issued: "2026-08-01", theirVerdict: "right", videoId: "a" },
      { channel: "Collect Pokemon", channelKey: "collectpokemon", issued: "2026-08-01", theirVerdict: "wrong", videoId: "b" },
    ],
    scorecards: cards,
    configChannels: [
      { key: "nomics", id: "UCnom", handle: "@N", enabled: true },
      { key: "collectpokemon", id: "UCcp", handle: "@C", enabled: false },
    ],
    asOf: "2026-10-12",
  });
  t("catalogue lists both creators", cat.creators.length === 2);
  t("catalogue keeps disabled flag", cat.creators.find((c) => c.key === "collectpokemon")?.enabled === false);
  t("catalogue has firstSeen and youtube id", cat.creators.find((c) => c.key === "nomics")?.firstSeen === "2026-08-01" && cat.creators.find((c) => c.key === "nomics")?.youtubeId === "UCnom");

  // Runner writes private files, never mixes into youtube/claims
  const root = await mkdtemp(join(tmpdir(), "tcgci-rs-"));
  await mkdir(join(root, "data/history/tcgcsv-daily"), { recursive: true });
  await mkdir(join(root, "data/history/tcgplayer-market"), { recursive: true });
  await mkdir(join(root, "data/private/tcgci"), { recursive: true });
  await mkdir(join(root, "data/private/youtube"), { recursive: true });
  // daily prices for the two pids + fillers
  for (const day of ["2026-08-01", "2026-08-08", "2026-08-31", "2026-10-01"]) {
    const rows = [];
    for (const [pid, m] of prices) if (m.has(day)) rows.push({ id: pid, market: m.get(day) });
    await writeFile(join(root, "data/history/tcgcsv-daily", `${day}.json`), JSON.stringify({ prices: rows }));
  }
  await writeFile(join(root, "data/private/tcgci/calls.json"), JSON.stringify({
    updated: "2026-10-10T00:00:00Z",
    counts: { total: 3 },
    calls,
  }));
  await writeFile(join(root, "data/private/youtube/creator-weights.json"), JSON.stringify({
    asOf: "2026-10-12", private: true, weights: { nomics: { weight: 1.2, basis: "held30" } },
  }));
  const store = { dir: join(root, "data/private"), remote: false, close: async () => ({ pushed: false }) };
  const out = await runTcgciRescore({ root, token: "", store, now: new Date("2026-10-12T12:00:00Z") });
  t("runner ok", out.status === "ok" && out.claimsMapped === 3);
  const rescored = JSON.parse(await readFile(join(root, "data/private/tcgci/rescored-claims.json"), "utf8"));
  const weights = JSON.parse(await readFile(join(root, "data/private/tcgci/creator-weights.json"), "utf8"));
  const ytW = JSON.parse(await readFile(join(root, "data/private/youtube/creator-weights.json"), "utf8"));
  t("rescored source tag", rescored.source === TCGCI_SOURCE && rescored.claims.every((c) => c.source === TCGCI_SOURCE));
  t("tcgci weights not blended into youtube numbers", ytW.weights.nomics.weight === 1.2);
  t("youtube file points at tcgci-derived", ytW.otherSources?.[TCGCI_SOURCE]?.path.includes("tcgci/creator-weights"));
  t("tcgci weights file tagged", weights.source === TCGCI_SOURCE);
  t("no claim prose fields", !JSON.stringify(rescored).includes("Buy:"));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("tcgci-rescore.suite.mjs")) {
  process.exit(await run() ? 1 : 0);
}
