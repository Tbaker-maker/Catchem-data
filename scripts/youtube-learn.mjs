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
import { parseFeed, pickTranscript, transcriptText } from "./lib/podcast.mjs";
import { loadPriceBook } from "./self-check.mjs";
import { buildCatalogueIndex, extractMentions, topicTags, commentSentiment, extractClaims, scoreClaims, rankClaims, buildLeads, claimStatus, extractIdeas, videoWeight, videoOutline, creatorWeights, combinedTones, hypeEvents, scoreHype, disagreements, edenSeed } from "./lib/youtube.mjs";

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
  const tones = Object.fromEntries((cfg.channels || []).map((c) => [c.key, c.tone || {}]));
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
  const ideasDoc = await J(join(dir, "ideas.json"), { ideas: [] });
  const ideaIds = new Set(ideasDoc.ideas.map((i) => i.id));
  // Seed leads named in config (methods and sources a channel is known to use). Leads only.
  for (const c of cfg.channels || []) for (const [n, s] of (c.seedIdeas || []).entries()) {
    const id = `seed:${c.key}:${s.kind}:${s.source || n}`;
    if (!ideaIds.has(id)) { ideaIds.add(id); ideasDoc.ideas.push({ id, ...s, channel: c.key, date: cfg.checked || today, status: "candidate", origin: "config" }); }
  }
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
      for (const id of ids) fresh.push({ id, channel: c.key, channelId: c.id });
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
        f.comments = (ct.items || []).map((x) => { const sn = x.snippet?.topLevelComment?.snippet || {}; return { text: String(sn.textDisplay || "").slice(0, sn.authorChannelId?.value === f.channelId ? 5000 : 500), likes: Number(sn.likeCount || 0), byCreator: sn.authorChannelId?.value === f.channelId }; });
      } catch (err) { if (err.budget) throw err; f.comments = []; errors.push(`comments ${f.id}: ${err.reason || err.message}`); }
    }
  } catch (err) { errors.push(err.budget ? "daily unit budget reached" : `${err.reason || err.message}`); }

  const added = [];
  for (const f of fresh) {
    if (!f.snippet) continue;
    const date = String(f.snippet.publishedAt || "").slice(0, 10);
    // Creator's own comments (often the pinned one) are read like the description.
    const creatorText = f.comments.filter((c) => c.byCreator).map((c) => c.text).join("\n");
    const text = `${f.snippet.title || ""}\n${f.snippet.description || ""}\n${creatorText}`;
    const v = {
      id: f.id, channel: f.channel, date, publishedAt: f.snippet.publishedAt, title: f.snippet.title || "", description: String(f.snippet.description || "").slice(0, 5000),
      views: Number(f.stats?.viewCount || 0), likes: Number(f.stats?.likeCount || 0), commentCount: Number(f.stats?.commentCount || 0),
      topComments: f.comments.filter((c) => !c.byCreator), creatorComments: f.comments.filter((c) => c.byCreator).map((c) => c.text), mentions: extractMentions(text, idx), topics: topicTags(text), sentiment: commentSentiment(f.comments.filter((c) => !c.byCreator).map((c) => c.text)), fetchedOn: today,
    };
    added.push(v);
    claimsDoc.claims.push(...extractClaims({ videoId: v.id, channel: v.channel, date, text }, idx).map((c) => ({ ...c, toneWeight: videoWeight(v, tones[v.channel]), needsBacking: true })).filter((c) => !claimsDoc.claims.some((o) => o.id === c.id)));
    for (const i of extractIdeas({ videoId: v.id, channel: v.channel, date, text })) if (!ideaIds.has(i.id)) { ideaIds.add(i.id); ideasDoc.ideas.push(i); }
    if (!state.lastSeen[f.channel] || f.snippet.publishedAt > state.lastSeen[f.channel]) state.lastSeen[f.channel] = f.snippet.publishedAt;
  }
  videos.push(...added);

  // Podcast feeds (config channels[].podcast.rss): transcripts from the publisher's
  // own RSS only. No audio download. Same claims, ideas and topics pipeline, same
  // unverified-until-backed rule. Stored with the videos as source "podcast".
  let podcastNew = 0;
  for (const c of (cfg.channels || []).filter((x) => x.podcast?.rss && x.enabled !== false)) {
    try {
      const res = await fetchFn(c.podcast.rss);
      if (!res.ok) { errors.push(`podcast ${c.key}: ${res.status}`); continue; }
      const items = parseFeed(await res.text()).filter((i) => i.date && i.date >= since.slice(0, 10) && !known.has(`pod:${c.key}:${i.guid}`)).slice(0, limits.maxNewVideosPerChannel);
      for (const i of items) {
        const t = pickTranscript(i.transcripts);
        let body = "";
        if (t) { const tr = await fetchFn(t.url); if (tr.ok) body = transcriptText(await tr.text(), t.type); }
        const text = `${i.title}\n${i.description}\n${body}`;
        const id = `pod:${c.key}:${i.guid}`;
        const v = { id, source: "podcast", channel: c.key, date: i.date, title: i.title, description: i.description, transcript: body ? body.slice(0, 200000) : null, transcriptSource: t ? t.url : null, views: 0, likes: 0, commentCount: 0, topComments: [], mentions: extractMentions(text, idx), topics: topicTags(text), sentiment: commentSentiment([]), fetchedOn: today };
        videos.push(v); known.add(id); podcastNew++;
        claimsDoc.claims.push(...extractClaims({ videoId: id, channel: c.key, date: i.date, text }, idx).map((x) => ({ ...x, source: "podcast", toneWeight: videoWeight(v, tones[c.key]), needsBacking: true })).filter((x) => !claimsDoc.claims.some((o) => o.id === x.id)));
        for (const idea of extractIdeas({ videoId: id, channel: c.key, date: i.date, text })) if (!ideaIds.has(idea.id)) { ideaIds.add(idea.id); ideasDoc.ideas.push({ ...idea, source: idea.source || "podcast" }); }
      }
    } catch (err) { errors.push(`podcast ${c.key}: ${err.message}`); }
  }

  // Chapter outlines from descriptions (backfills older rows; no API call).
  for (const v of videos) if (!v.outline && v.source !== "podcast") v.outline = videoOutline(v, idx);
  const { priceOn, marketChange } = await loadPriceBook(root);
  scoreClaims(claimsDoc.claims, { priceOn, marketChange, pidsBySet: idx.pidsBySet, today });
  for (const c of claimsDoc.claims) { const st = claimStatus(c); if (c.status !== st.status) c.statusSince = today; c.status = st.status; c.evidence = st.evidence; }
  const topicsByVideo = new Map(videos.map((v) => [v.id, v.topics]));
  const ranking = rankClaims(claimsDoc.claims, topicsByVideo);
  // Track-record weights (neutral until 20 scored claims) times the tone setting.
  const weights = creatorWeights(ranking);
  const wTones = combinedTones(tones, weights);
  const leads = buildLeads(videos, { today, idx, seenTopics: state.topicsSeen, firstRun: !(state.topicsSeen || []).length, tones: wTones });
  const prevHype = await J(join(dir, "hype-study.json"), { events: [] });
  const evs = hypeEvents(videos).map((e) => ({ ...e, ...(prevHype.events.find((p) => p.groupId === e.groupId && p.date === e.date) || {}) }));
  const hype = scoreHype(evs, { priceOn, marketChange, pidsBySet: idx.pidsBySet, today });
  const dis = disagreements(claimsDoc.claims, { today });
  state.topicsSeen = [...new Set([...state.topicsSeen, ...videos.flatMap((v) => v.topics)])].sort();
  const eden = edenSeed(videos, { today, weightOf: (v) => videoWeight(v, wTones[v.channel]) });
  const unitsUsed = yt.used();
  state.quota = [...(state.quota || []).filter((q) => q.date !== today), { date: today, units: unitsUsed, videos: added.length }].slice(-60);

  await writeFile(join(dir, "videos.jsonl.gz"), gzipSync(videos.map((v) => JSON.stringify(v)).join("\n") + "\n"));
  await writeFile(join(dir, "claims.json"), JSON.stringify({ asOf: today, private: true, rule: "A creator claim is never fact. unverified until our own data (TCGplayer prices, pull-rate file, PSA pops, catalogue) or a second independent source backs or contradicts it. Only backed claims may influence reads, ratings or flags.", counts: { unverified: claimsDoc.claims.filter((c) => c.status === "unverified").length, backed: claimsDoc.claims.filter((c) => c.status === "backed").length, contradicted: claimsDoc.claims.filter((c) => c.status === "contradicted").length }, claims: claimsDoc.claims }, null, 1) + "\n");
  await writeFile(join(dir, "scores.json"), JSON.stringify({ asOf: today, private: true, note: "Private. Held = TCGplayer market on the claimed side after h days (card), or the set's median single (set). Same horizons and slack as self-check.", rows: ranking }, null, 1) + "\n");
  await writeFile(join(dir, "eden-seed.json"), JSON.stringify({ asOf: today, private: true, method: "Word-list sentiment over top public comments, last 30 days, by catalogue id. Each comment counts 1 + log10(1 + likes); each video is scaled by its channel tone weight times its track-record weight. week vs prevWeek shows a turn in mood.", rows: eden }, null, 1) + "\n");
  await writeFile(join(dir, "ideas.json"), JSON.stringify({ asOf: today, private: true, note: "Candidate read paths from creator videos: methods, signals watched, data sources named. Unverified. The weekly audit tests them before any read uses one.", ideas: ideasDoc.ideas }, null, 1) + "\n");
  await writeFile(join(dir, "creator-weights.json"), JSON.stringify({ asOf: today, private: true, rule: "Neutral (1) until 20 scored claims; then 0.5 + held rate, clamped 0.5..1.5. Used only in attention and trend counts.", weights }, null, 1) + "\n");
  await writeFile(join(dir, "hype-study.json"), JSON.stringify({ asOf: today, private: true, method: "Event = first day a set reaches 3+ videos on 2+ channels inside 7 days (one per set per 30 days). Change = median TCGplayer single in the set; excess = vs every priced product.", summary: hype.summary, events: hype.events }, null, 1) + "\n");
  await writeFile(join(dir, "disagreements.json"), JSON.stringify({ asOf: today, private: true, creator: dis.creator, data: dis.data }, null, 1) + "\n");
  await writeFile(join(dir, "state.json"), JSON.stringify(state, null, 1) + "\n");
  const pushed = await store.close(["youtube/videos.jsonl.gz", "youtube/claims.json", "youtube/scores.json", "youtube/eden-seed.json", "youtube/ideas.json", "youtube/creator-weights.json", "youtube/hype-study.json", "youtube/disagreements.json", "youtube/state.json"], `YouTube learn ${today}`);

  const doc = { ...base, keyPresent: true, status: errors.length ? "partial" : "ok", unitsUsed, videosNew: added.length, podcastNew, withChapters: videos.filter((v) => v.outline?.length).length, withCreatorComments: videos.filter((v) => v.creatorComments?.length).length, videosTotal: videos.length, claims: claimsDoc.claims.length, ideas: ideasDoc.ideas.length, errors: errors.map((e) => e.replace(key, "[key]")), privatePushed: Boolean(pushed?.pushed), leads,
    disagreements: { creatorTargets: dis.creator.length, dataContradictedTonight: dis.data.length, creatorRows: dis.creator.map((d) => ({ label: d.target.startsWith("set:") ? (idx.setList.find((x) => `set:${x.groupId}` === d.target)?.set || d.target) : (idx.byPid.get(Number(d.target.slice(5)))?.name || d.target), channels: d.up + d.down, from: d.from, to: d.to })) },
    hypeEvents: hype.events.length, weightedCreators: Object.values(weights).filter((w) => w.basis !== "neutral").length };
  await writePublic(root, doc);
  return doc;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const d = await runYoutubeLearn();
  console.log(JSON.stringify({ status: d.status, unitsUsed: d.unitsUsed, videosNew: d.videosNew, leads: d.leads.length, errors: d.errors || [] }));
}
