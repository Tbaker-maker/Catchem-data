import { mkdtemp, mkdir, writeFile, readFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalogueIndex, extractMentions, topicTags, commentSentiment, extractClaims, scoreClaims, rankClaims, buildLeads, claimStatus, extractIdeas, attentionLine, isBanned } from "../lib/youtube.mjs";
import { youtubeFlags } from "../lib/flags.mjs";
import { runYoutubeLearn, makeClient } from "../youtube-learn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const items = [
  { tcgplayerProductId: 101, groupId: 1, set: "SV: Prismatic Evolutions", name: "Umbreon ex - 161/131", number: "161/131", kind: "single" },
  { tcgplayerProductId: 102, groupId: 2, set: "SWSH07: Evolving Skies", name: "Umbreon VMAX (Alternate Art Secret) - 215/203", number: "215/203", kind: "single" },
  { tcgplayerProductId: 103, groupId: 3, set: "XY: Evolutions", name: "Charizard - 11/108", number: "011/108", kind: "single" },
  { tcgplayerProductId: 104, groupId: 2, set: "SWSH07: Evolving Skies", name: "Rayquaza VMAX (Alternate Art Secret) - 218/203", number: "218/203", kind: "single" },
  { tcgplayerProductId: 201, groupId: 1, set: "SV: Prismatic Evolutions", name: "Prismatic Evolutions Elite Trainer Box", number: null, kind: "sealed" },
  { tcgplayerProductId: 202, groupId: 2, set: "SWSH07: Evolving Skies", name: "Evolving Skies Booster Box", number: null, kind: "sealed" },
  ...Array.from({ length: 6 }, (_, i) => ({ tcgplayerProductId: 300 + i, groupId: 2, set: "SWSH07: Evolving Skies", name: `Filler ${i} - ${i + 1}/203`, number: `${i + 1}/203`, kind: "single" })),
];

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };
  const idx = buildCatalogueIndex(items);

  const m = extractMentions("Umbreon VMAX 215/203 from Evolving Skies, plus a Prismatic Evolutions ETB.", idx);
  t("card matched by number plus its own name", m.cards.includes(102));
  t("longer set name wins (no Evolutions false hit)", m.sets.includes(2) && m.sets.includes(1) && !m.sets.includes(3));
  t("sealed matched inside a named set", m.sealed.includes(201));
  t("name alone never matches a card", extractMentions("Umbreon is so good", idx).cards.length === 0);
  t("number without the card's name never matches", extractMentions("pulled 215/203 today", idx).cards.length === 0);
  t("TCGplayer product link matches by id", extractMentions("https://www.tcgplayer.com/product/202/x", idx).sealed.includes(202));

  t("topic tags", JSON.stringify(topicTags("Pack destruction and a reprint wave, PSA 10 pop report")) === JSON.stringify(["pack_destruction", "print_run", "grading"]));
  const s = commentSentiment(["love this, great video", "overpriced trash"]);
  t("sentiment counts words", s.pos === 2 && s.neg === 2 && s.score === 0);

  const claims = extractClaims({ videoId: "v1", channel: "nomics", date: "2026-01-01", text: "Umbreon VMAX 215/203 is undervalued. Evolving Skies will go down. Nice day." }, idx);
  t("card claim logged with id and direction", claims.some((c) => c.target === "card" && c.pid === 102 && c.dir === 1));
  t("set claim logged when no card in the sentence", claims.some((c) => c.target === "set" && c.groupId === 2 && c.dir === -1));

  const price = (pid, day) => (day === "2026-01-01" ? 100 : day === "2026-01-08" ? (pid === 102 ? 120 : 90) : null);
  scoreClaims(claims, { priceOn: price, marketChange: () => 0, pidsBySet: idx.pidsBySet, today: "2026-01-10" });
  const card = claims.find((c) => c.target === "card"), set = claims.find((c) => c.target === "set");
  t("card claim scored at 7 days, held", card.h7?.held === true && card.h7.chg === 0.2);
  t("set claim scored at 7 days by set median, held", set.h7?.held === true && set.h7.chg === -0.1);
  t("30-day horizon not scored early", !card.h30 && !set.h30);
  t("claim backed by our prices, with evidence", claimStatus(card).status === "backed" && claimStatus(card).evidence.to === "2026-01-08");
  t("unscored claim stays unverified", claimStatus({ date: "2026-01-01" }).status === "unverified");
  t("contradicted when price went the other way", claimStatus({ target: "card", date: "x", h7: { day: "y", chg: -0.2, held: false } }).status === "contradicted");
  const ideas = extractIdeas({ videoId: "v", channel: "c", date: "2026-01-01", text: "I track sold listings and pop on GemRate every week. We can estimate the print run from case counts." });
  t("ideas: signal, print run method, data source", ["signal_watched", "print_run_estimate", "data_source"].every((k) => ideas.some((i) => i.kind === k)) && ideas.every((i) => i.status === "candidate"));
  const rank = rankClaims(claims, new Map([["v1", ["price_move"]]]));
  t("ranking has channel and topic rows, rates null under the minimum", rank.some((r) => r.by === "channel" && r.key === "nomics" && r.scored7 === 2 && r.heldPct7 === null) && rank.some((r) => r.by === "topic"));

  const vids = [
    { id: "a", channel: "nomics", date: "2026-01-09", mentions: { sets: [2], cards: [], sealed: [] }, topics: ["pack_destruction"] },
    { id: "b", channel: "pokeoz", date: "2026-01-10", mentions: { sets: [2], cards: [], sealed: [] }, topics: ["pack_destruction"] },
  ];
  const leads = buildLeads(vids, { today: "2026-01-10", idx, seenTopics: [] });
  t("set across 2 channels is a lead", leads.some((l) => l.kind === "set_attention" && l.ref === 2 && l.channels === 2));
  t("pack destruction is a lead", leads.some((l) => l.kind === "pack_destruction" && l.videos === 2));
  t("unseen topic is a new method lead", leads.some((l) => l.kind === "new_method"));
  const pub = JSON.stringify(leads);
  t("leads carry no creator keys", !/nomics|pokeoz/.test(pub));
  const line = attentionLine(leads[0]);
  t("public line shape, no banned words", /getting attention across creators this week/.test(line) && !isBanned(line));
  t("flags: leads become YOUTUBE_LEAD", youtubeFlags({ asOf: "2026-01-10", keyPresent: true, leads }).every((f) => f.type === "YOUTUBE_LEAD"));
  t("flags: missing key raises YOUTUBE_KEY_MISSING", youtubeFlags({ asOf: "2026-01-10", keyPresent: false })[0]?.type === "YOUTUBE_KEY_MISSING");

  // Runner: missing key exits cleanly, no network.
  const root = await mkdtemp(join(tmpdir(), "yt-"));
  await mkdir(join(root, "config"), { recursive: true });
  await mkdir(join(root, "data/catalog"), { recursive: true });
  await mkdir(join(root, "data/history/tcgcsv-daily"), { recursive: true });
  await cp(join(ROOT, "config/youtube-channels.json"), join(root, "config/youtube-channels.json"));
  await writeFile(join(root, "data/catalog/tcgcsv-latest.json"), JSON.stringify({ asOf: "2026-01-10", items }));
  let calls = 0;
  const noKey = await runYoutubeLearn({ root, key: "", token: "", fetchFn: async () => { calls++; return { ok: true, json: async () => ({}) }; } });
  t("missing key: clean exit, no API calls", noKey.status === "key_missing" && calls === 0);

  // Runner with a fake official API.
  await writeFile(join(root, "data/history/tcgcsv-daily/2026-01-10.json"), JSON.stringify({ prices: [{ id: 102, market: 100 }] }));
  const fake = async (url) => {
    calls++;
    const u = new URL(url); const p = u.pathname.split("/").pop();
    const body = p === "channels" ? { items: u.searchParams.get("id").split(",").map((id) => ({ id, contentDetails: { relatedPlaylists: { uploads: "UU" + id.slice(2) } } })) }
      : p === "playlistItems" ? { items: u.searchParams.get("playlistId") === "UUkM148HlzrBtGgSABTfFsOA" ? [{ contentDetails: { videoId: "vid1", videoPublishedAt: "2026-01-10T12:00:00Z" } }] : [] }
      : p === "videos" ? { items: [{ id: "vid1", snippet: { publishedAt: "2026-01-10T12:00:00Z", title: "Umbreon VMAX 215/203 is undervalued", description: "Evolving Skies pack destruction" }, statistics: { viewCount: "10", likeCount: "2", commentCount: "1" } }] }
      : { items: [{ snippet: { topLevelComment: { snippet: { textDisplay: "great video", likeCount: 3 } } } }] };
    return { ok: true, json: async () => body };
  };
  calls = 0;
  const local = { dir: join(root, "data/private"), close: async () => ({ pushed: false }) };
  const ok = await runYoutubeLearn({ root, key: "k", token: "", fetchFn: fake, store: local });
  const enabled = JSON.parse(await readFile(join(root, "config/youtube-channels.json"), "utf8")).channels.filter((c) => c.id && c.enabled !== false).length;
  t("units = 1 channels + 1 per channel + 1 videos + 1 comments", ok.unitsUsed === 1 + enabled + 1 + 1 && calls === ok.unitsUsed);
  const claims2 = JSON.parse(await readFile(join(root, "data/private/youtube/claims.json"), "utf8")).claims;
  t("claim stored privately with ship price", claims2.length === 1 && claims2[0].pid === 102 && claims2[0].price === 100 && claims2[0].status === "unverified");
  const pubDoc = await readFile(join(root, "data/derived/youtube-leads.json"), "utf8");
  t("public file has no creator names or text", !/nomics|undervalued|great video|Nostalgia/i.test(pubDoc));
  const again = await runYoutubeLearn({ root, key: "k", token: "", fetchFn: fake, store: local });
  t("second night skips known videos", again.videosNew === 0);
  const capped = makeClient({ key: "k", fetchFn: fake, budget: 1 });
  await capped.get("channels", { id: "UCx" });
  let threw = false; try { await capped.get("channels", { id: "UCx" }); } catch (e) { threw = Boolean(e.budget); }
  t("unit budget is enforced", threw);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("youtube-learn.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("youtube learn ok");
}
