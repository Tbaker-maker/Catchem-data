// Nightly YouTube learning loop. Runs from build-feed.mjs before the flagger.
// Official YouTube Data API v3 with process.env.YOUTUBE_API_KEY only. No scraping,
// no video or audio, no captions (the captions download needs owner OAuth), no AI.
// Quota: about 1 unit per channel plus 1 per 50 videos plus 1 per video for comments,
// capped by config limits.dailyUnitBudget (far under the 10,000 a day).
//
// Private (catchem-data-private when PRIVATE_DATA_TOKEN is set, else gitignored data/private/):
//   data/private/youtube/videos.jsonl.gz  every video: stats, mentions (by id), topics, sentiment
//   data/private/youtube/claims.json      dated direction claims, scored at 7, 30 and 90 days
//   data/private/youtube/scores.json      held rates by channel and topic
//   data/private/youtube/eden-seed.json   comment sentiment per set and card id
//   data/private/youtube/state.json       last seen video per channel, topics seen, quota log
// Public-safe (data/derived/youtube-leads.json): counts and dates only, read by the flagger.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { loadPriceBook } from "./self-check.mjs";
import { buildCatalogueIndex, extractMentions, topicTags, commentSentiment, extractClaims, scoreClaims, rankClaims, buildLeads } from "./lib/youtube.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://www.googleapis.com/youtube/v3";
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

export function makeClient({ key, fetchFn = fetch, budget = 400 }) {
  let used = 0;
  const get = async (path, params) => {
    if (used + 1 > budget) throw Object.assign(new Error("daily unit budget reached"), { budget: true });
    used += 1;
    const url = `${API}/${path}?${new URLSearchParams({ ...params, key })}`;
    const res = await fetchFn(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = body?.error?.errors?.[0]?.reason || res.status;
      throw Object.assign(new Error(`YouTube API ${path}: ${reason}`), { reason, status: res.status });
    }
    return body;
  };
  return { get, used: () => used };
}

async function writePublic(root, doc) {
  await mkdir(join(root, "data/derived"), { recursive: true });
  await writeFile(join(root, "data/derived/youtube-leads.json"), JSON.stringify(doc, null, 1) + "\n");
}

export async function runYoutubeLearn({ root = ROOT, key = process.env.YOUTUBE_API_KEY || "", token = process.env.PRIVATE_DATA_TOKEN || "", fetchFn = fetch, now = new Date(), store: givenStore = null } = {}) {
  const cfg = await J(join(root, "config/youtube-channels.json"), { channels: [], limits: {} });
  const limits = { dailyUnitBudget: 400, maxNewVideosPerChannel: 15, commentsPerVideo: 20, firstRunDays: 30, ...cfg.limits };
  const catalog = await J(join(root, "data/catalog/tcgcsv-latest.json"), {});
  const today = String(catalog.asOf || "").slice(0, 10) || now.toISOString().slice(0, 10);
  const channels = (cfg.channels || []).filter((c) => c.id && c.enabled !== false);
  const base = { asOf: today, generatedAt: now.toISOString(), note: "Counts and dates only. Creator names, text and scores stay private.", channels: channels.length };
  if (!key) {
    const doc = { ...base, keyPresent: false, status: "key_missing", unitsUsed: 0, videosNew: 0, leads: [] };
    await writePublic(root, doc);
    return doc;
  }

  let store = givenStore;
  if (!store) {
    try { store = await openPrivate({ root, token }); }
    catch (err) { console.error(`youtube: ${err.message}; using local data/private`); store = await openPrivate({ root, token: "" }); }
  }
  const dir = join(store.dir, "youtube");
  await mkdir(dir, { recursive: true });
  const state = await J(join(dir, "state.json"), { lastSeen: {}, topicsSeen: [], quota: [] });
  let videos = [];
  try { videos = gunzipSync(await readFile(join(dir, "videos.jsonl.gz"))).toString("utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch {}
  const known = new Set(videos.map((v) => v.id));
  const claimsDoc = await J(join(dir, "claims.json"), { claims: [] });
  const idx = buildCatalogueIndex(catalog.items || []);
  const yt = makeClient({ key, fetchFn, budget: limits.dailyUnitBudget });
  const errors = [];
  const fresh = [];
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - limits.firstRunDays * 86400000).toISOString();

  try {
    // 1 unit: every channel's uploads playlist and stats in one call.
    const ch = await yt.get("channels", { part: "contentDetails,statistics", id: channels.map((c) => c.id).join(","), maxResults: 50 });
    const uploads = new Map((ch.items || []).map((i) => [i.id, i.contentDetails?.relatedPlaylists?.uploads]));
    for (const c of channels) {
      if (!uploads.get(c.id)) { errors.push(`${c.key}: channel not returned`); continue; }
      const pl = await yt.get("playlistItems", { part: "contentDetails", playlistId: uploads.get(c.id), maxResults: 50 });
      const ids = (pl.items || []).filter((i) => (i.contentDetails?.videoPublishedAt || "") >= (state.lastSeen[c.key] || since)).map((i) => i.contentDetails.videoId).filter((id) => !known.has(id)).slice(0, limits.maxNewVideosPerChannel);
      for (const id of ids) fresh.push({ id, channel: c.key });
    }
    for (let i = 0; i < fresh.length; i += 50) {
      const batch = fresh.slice(i, i + 50);
      const vs = await yt.get("videos", { part: "snippet,statistics", id: batch.map((b) => b.id).join(","), maxResults: 50 });
      for (const v of vs.items || []) Object.assign(batch.find((b) => b.id === v.id), { snippet: v.snippet, stats: v.statistics });
    }
    for (const f of fresh) {
      if (!f.snippet || Number(f.stats?.commentCount || 0) === 0) { f.comments = []; continue; }
      try {
        const ct = await yt.get("commentThreads", { part: "snippet", videoId: f.id, order: "relevance", maxResults: limits.commentsPerVideo, textFormat: "plainText" });
        f.comments = (ct.items || []).map((x) => ({ text: String(x.snippet?.topLevelComment?.snippet?.textDisplay || "").slice(0, 500), likes: Number(x.snippet?.topLevelComment?.snippet?.likeCount || 0) }));
      } catch (err) { if (err.budget) throw err; f.comments = []; errors.push(`comments ${f.id}: ${err.reason || err.message}`); }
    }
  } catch (err) { errors.push(err.budget ? "daily unit budget reached" : `${err.reason || err.message}`); }

  const added = [];
  for (const f of fresh) {
    if (!f.snippet) continue;
    const date = String(f.snippet.publishedAt || "").slice(0, 10);
    const text = `${f.snippet.title || ""}\n${f.snippet.description || ""}`;
    const v = {
      id: f.id, channel: f.channel, date, publishedAt: f.snippet.publishedAt, title: f.snippet.title || "", description: String(f.snippet.description || "").slice(0, 5000),
      views: Number(f.stats?.viewCount || 0), likes: Number(f.stats?.likeCount || 0), commentCount: Number(f.stats?.commentCount || 0),
      topComments: f.comments, mentions: extractMentions(text, idx), topics: topicTags(text), sentiment: commentSentiment(f.comments.map((c) => c.text)), fetchedOn: today,
    };
    added.push(v);
    claimsDoc.claims.push(...extractClaims({ videoId: v.id, channel: v.channel, date, text }, idx).filter((c) => !claimsDoc.claims.some((o) => o.id === c.id)));
    if (!state.lastSeen[f.channel] || f.snippet.publishedAt > state.lastSeen[f.channel]) state.lastSeen[f.channel] = f.snippet.publishedAt;
  }
  videos.push(...added);

  const { priceOn, marketChange } = await loadPriceBook(root);
  scoreClaims(claimsDoc.claims, { priceOn, marketChange, pidsBySet: idx.pidsBySet, today });
  const topicsByVideo = new Map(videos.map((v) => [v.id, v.topics]));
  const ranking = rankClaims(claimsDoc.claims, topicsByVideo);
  const leads = buildLeads(videos, { today, idx, seenTopics: state.topicsSeen, firstRun: !(state.topicsSeen || []).length });
  state.topicsSeen = [...new Set([...state.topicsSeen, ...videos.flatMap((v) => v.topics)])].sort();
  const eden = {};
  for (const v of videos.filter((x) => x.date >= new Date(Date.parse(`${today}T00:00:00Z`) - 30 * 86400000).toISOString().slice(0, 10))) {
    for (const k of [...v.mentions.sets.map((g) => `set:${g}`), ...v.mentions.cards.map((p) => `card:${p}`), ...v.mentions.sealed.map((p) => `sealed:${p}`)]) {
      const e = (eden[k] ||= { videos: 0, comments: 0, pos: 0, neg: 0 });
      e.videos++; e.comments += v.sentiment.comments; e.pos += v.sentiment.pos; e.neg += v.sentiment.neg;
    }
  }
  for (const e of Object.values(eden)) e.score = e.pos + e.neg ? Math.round(((e.pos - e.neg) / (e.pos + e.neg)) * 100) / 100 : 0;
  const unitsUsed = yt.used();
  state.quota = [...(state.quota || []).filter((q) => q.date !== today), { date: today, units: unitsUsed, videos: added.length }].slice(-60);

  await writeFile(join(dir, "videos.jsonl.gz"), gzipSync(videos.map((v) => JSON.stringify(v)).join("\n") + "\n"));
  await writeFile(join(dir, "claims.json"), JSON.stringify({ asOf: today, private: true, claims: claimsDoc.claims }, null, 1) + "\n");
  await writeFile(join(dir, "scores.json"), JSON.stringify({ asOf: today, private: true, note: "Private. Held = TCGplayer market on the claimed side after h days (card), or the set's median single (set). Same horizons and slack as self-check.", rows: ranking }, null, 1) + "\n");
  await writeFile(join(dir, "eden-seed.json"), JSON.stringify({ asOf: today, private: true, method: "Word-list sentiment over top public comments, last 30 days, by catalogue id.", rows: eden }, null, 1) + "\n");
  await writeFile(join(dir, "state.json"), JSON.stringify(state, null, 1) + "\n");
  const pushed = await store.close(["youtube/videos.jsonl.gz", "youtube/claims.json", "youtube/scores.json", "youtube/eden-seed.json", "youtube/state.json"], `YouTube learn ${today}`);

  const doc = { ...base, keyPresent: true, status: errors.length ? "partial" : "ok", unitsUsed, videosNew: added.length, videosTotal: videos.length, claims: claimsDoc.claims.length, errors: errors.map((e) => e.replace(key, "[key]")), privatePushed: Boolean(pushed?.pushed), leads };
  await writePublic(root, doc);
  return doc;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const d = await runYoutubeLearn();
  console.log(JSON.stringify({ status: d.status, unitsUsed: d.unitsUsed, videosNew: d.videosNew, leads: d.leads.length, errors: d.errors || [] }));
}
