import { mkdtemp, mkdir, writeFile, readFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalogueIndex, extractMentions, topicTags, commentSentiment, extractClaims, scoreClaims, rankClaims, buildLeads, claimStatus, videoWeight, creatorWeights, combinedTones, hypeEvents, scoreHype, disagreements, edenSeed, parseChapters, videoOutline, extractIdeas, attentionLine, isBanned } from "../lib/youtube.mjs";
import { youtubeFlags } from "../lib/flags.mjs";
import { parseFeed, pickTranscript, transcriptText } from "../lib/podcast.mjs";
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
  const tones = { pokeoz: { weight: 0.5, hype: true } };
  t("tone: an emotional channel alone cannot make a 2-channel lead", !buildLeads(vids, { today: "2026-01-10", idx, tones }).some((l) => l.kind === "set_attention"));
  t("tone: hype title halves again", videoWeight({ title: "THIS IS INSANE!!" }, tones.pokeoz) === 0.25 && videoWeight({ title: "Market update" }, tones.pokeoz) === 0.5 && videoWeight({ title: "x" }, {}) === 1);
  const line = attentionLine(leads[0]);
  t("public line shape, no banned words", /getting attention across creators this week/.test(line) && !isBanned(line));
  t("flags: leads become YOUTUBE_LEAD", youtubeFlags({ asOf: "2026-01-10", keyPresent: true, leads }).every((f) => f.type === "YOUTUBE_LEAD"));
  t("flags: missing key raises YOUTUBE_KEY_MISSING", youtubeFlags({ asOf: "2026-01-10", keyPresent: false })[0]?.type === "YOUTUBE_KEY_MISSING");

  // Track-record weights
  const cw = creatorWeights([{ by: "channel", key: "a", scored7: 25, heldPct7: 80, scored30: 3 }, { by: "channel", key: "b", scored7: 19, heldPct7: 100 }, { by: "topic", key: "grading", scored7: 40, heldPct7: 10 }]);
  t("weights: 20+ scored uses held rate, clamped", cw.a.weight === 1.3 && cw.a.basis === "held7");
  t("weights: under 20 scored stays neutral", cw.b.weight === 1 && cw.b.basis === "neutral" && !cw.grading);
  t("weights combine with tone", combinedTones({ a: { weight: 0.5, hype: true } }, cw).a.weight === 0.65 && combinedTones({ a: { weight: 0.5, hype: true } }, cw).a.hype === true);
  // Hype study
  const hv = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-05"].map((d, i) => ({ id: `h${i}`, channel: i % 2 ? "x" : "y", date: d, mentions: { sets: [2], cards: [], sealed: [] } }));
  const evs = hypeEvents(hv);
  t("hype: one event on the day 3 videos on 2 channels land", evs.length === 1 && evs[0].date === "2026-01-03" && evs[0].groupId === 2);
  const hs = scoreHype(evs, { priceOn: (pid, d) => (d === "2026-01-03" ? 100 : d === "2026-01-10" ? 110 : null), marketChange: () => 0.05, pidsBySet: idx.pidsBySet, today: "2026-01-12" });
  t("hype: 7-day change and excess vs market", hs.events[0].h7?.chg === 0.1 && hs.events[0].h7.excess === 0.05 && hs.summary.h7.events === 1 && hs.summary.h7.medianExcessPct === null);
  // Disagreements
  const dz = disagreements([{ id: "1", target: "set", groupId: 2, dir: 1, channel: "x", date: "2026-01-05" }, { id: "2", target: "set", groupId: 2, dir: -1, channel: "y", date: "2026-01-08" }, { id: "3", target: "card", pid: 102, dir: 1, channel: "x", date: "2026-01-01", status: "contradicted", statusSince: "2026-01-10" }], { today: "2026-01-10" });
  t("disagree: opposite creators on one set", dz.creator.length === 1 && dz.creator[0].from === "2026-01-05");
  t("disagree: claims our data contradicted tonight", dz.data.length === 1);
  t("flags: disagreements become YOUTUBE_DISAGREE with no creator names", (() => { const f = youtubeFlags({ asOf: "2026-01-10", keyPresent: true, leads: [], disagreements: { creatorRows: [{ label: "Evolving Skies", channels: 2, from: "2026-01-05", to: "2026-01-08" }], dataContradictedTonight: 1 } }); return f.length === 2 && f.every((x) => x.type === "YOUTUBE_DISAGREE") && !/\bx\b|\by\b/.test(JSON.stringify(f.map((x) => x.line))); })());
  // Eden seed
  const es = edenSeed([{ channel: "x", date: "2026-01-09", mentions: { sets: [2], cards: [], sealed: [] }, topComments: [{ text: "love it", likes: 9 }, { text: "trash", likes: 0 }] }, { channel: "x", date: "2026-01-01", mentions: { sets: [2], cards: [], sealed: [] }, topComments: [{ text: "awful", likes: 0 }] }], { today: "2026-01-10" });
  t("eden: likes weight comments, week vs previous week", es["set:2"].pos === 2 && es["set:2"].neg === 2 && es["set:2"].week.score === 0.33 && es["set:2"].prevWeek.score === -1 && es["set:2"].turn === 1.33);

  // Chapters
  const desc = "Links below\n0:00 Intro\n2:15 - Evolving Skies pack destruction\n1:02:03 | PSA 10 pop report\nthanks";
  const chs = parseChapters(desc);
  t("chapters: 3 rows, seconds, titles", chs.length === 3 && chs[1].t === 135 && chs[2].t === 3723 && chs[1].title === "Evolving Skies pack destruction");
  t("chapters: not starting near 0 or out of order is ignored", parseChapters("5:00 a\n6:00 b\n7:00 c").length === 0 && parseChapters("0:00 a\n6:00 b\n3:00 c").length === 0);
  const ol = videoOutline({ description: desc }, idx);
  t("outline: topics and set per chapter", ol[1].topics.includes("pack_destruction") && ol[1].mentions.sets.includes(2) && ol[2].topics.includes("grading"));

  // Podcast feeds
  const rss = `<rss xmlns:podcast="https://podcastindex.org/namespace/1.0"><channel><item><title>Ep 1</title><guid>g1</guid><pubDate>Fri, 09 Jan 2026 10:00:00 GMT</pubDate><description><![CDATA[Market talk]]></description><enclosure url="https://x/a.mp3" type="audio/mpeg"/><podcast:transcript url="https://x/t.json" type="application/json"/><podcast:transcript url="https://x/t.vtt" type="text/vtt"/></item></channel></rss>`;
  const it = parseFeed(rss);
  t("podcast: item, date, transcripts, audio url noted", it.length === 1 && it[0].date === "2026-01-09" && it[0].transcripts.length === 2 && it[0].audio === "https://x/a.mp3");
  t("podcast: VTT picked before JSON", pickTranscript(it[0].transcripts).type === "text/vtt");
  t("podcast: VTT to text", transcriptText("WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\n<v Host>Evolving Skies will go down.\n", "text/vtt") === "Evolving Skies will go down.");
  t("podcast: JSON segments to text", transcriptText(JSON.stringify({ segments: [{ body: "a" }, { body: "b" }] }), "application/json") === "a b");

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
      : { items: [{ snippet: { topLevelComment: { snippet: { textDisplay: "great video", likeCount: 3 } } } }, { snippet: { topLevelComment: { snippet: { textDisplay: "Pinned: Evolving Skies will go down.", likeCount: 0, authorChannelId: { value: "UCkM148HlzrBtGgSABTfFsOA" } } } } }] };
    return { ok: true, json: async () => body };
  };
  calls = 0;
  const cfgPath = join(root, "config/youtube-channels.json");
  const cfgJ = JSON.parse(await readFile(cfgPath, "utf8"));
  cfgJ.channels.push({ key: "testpod", id: null, enabled: true, podcast: { rss: "https://feed.test/rss" } });
  await writeFile(cfgPath, JSON.stringify(cfgJ));
  const podFetch = async (url) => {
    if (url === "https://feed.test/rss") return { ok: true, text: async () => `<rss><channel><item><title>Ep</title><guid>p1</guid><pubDate>Sat, 10 Jan 2026 10:00:00 GMT</pubDate><podcast:transcript url="https://feed.test/t.srt" type="application/srt"/></item></channel></rss>` };
    if (url === "https://feed.test/t.srt") return { ok: true, text: async () => "1\n00:00:01,000 --> 00:00:02,000\nUmbreon VMAX 215/203 is undervalued.\n" };
    return fake(url);
  };
  const local = { dir: join(root, "data/private"), close: async () => ({ pushed: false }) };
  const ok = await runYoutubeLearn({ root, key: "k", token: "", fetchFn: podFetch, store: local });
  calls = ok.unitsUsed;
  const enabled = cfgJ.channels.filter((c) => c.id && c.enabled !== false).length;
  const ideasSeed = JSON.parse(await readFile(join(root, "data/private/youtube/ideas.json"), "utf8")).ideas;
  t("config seed ideas logged as candidates", ideasSeed.some((i) => i.origin === "config" && i.source === "pokemon wizard" && i.status === "candidate"));
  t("units = 1 channels + 1 per channel + 1 videos + 1 comments", ok.unitsUsed === 1 + enabled + 1 + 1);
  const claims2 = JSON.parse(await readFile(join(root, "data/private/youtube/claims.json"), "utf8")).claims;
  t("podcast transcript claim logged as unverified", ok.podcastNew === 1 && claims2.some((c) => c.source === "podcast" && c.pid === 102 && c.status === "unverified"));
  t("claim stored privately with ship price", claims2.filter((c) => c.source !== "podcast" && c.target === "card").length === 1 && claims2[0].pid === 102 && claims2[0].price === 100 && claims2[0].status === "unverified");
  const pubDoc = await readFile(join(root, "data/derived/youtube-leads.json"), "utf8");
  t("creator comment read into claims, kept out of sentiment", claims2.some((c) => c.target === "set" && c.groupId === 2 && c.dir === -1) && ok.withCreatorComments === 1);
  t("public file has no creator names or text", !/nomics|undervalued|great video|Nostalgia/i.test(pubDoc));
  const again = await runYoutubeLearn({ root, key: "k", token: "", fetchFn: fake, store: local });
  for (const f of ["creator-weights.json", "hype-study.json", "disagreements.json", "eden-seed.json"]) t(`private ${f} written`, Boolean(await readFile(join(root, "data/private/youtube", f), "utf8").catch(() => "")));
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
