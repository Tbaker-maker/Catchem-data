// Rerun the singles hype-effect and crowded-call studies after card matching.
// Writes data/private only. No creator names and no raw text.
import { createReadStream } from "node:fs";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalogueIndex, extractClaims, extractMentions } from "./lib/youtube.mjs";
import { subjectsOf, weeklyAttention, weeklyCrowded, buildHypeEffect, buildCrowdedCalls } from "./lib/hype-crowd.mjs";
import { loadLongHistoryPriceBook } from "./lib/tcgci-score.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJsonlGz(path) {
  const rows = [];
  const rl = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) rows.push(JSON.parse(line));
  }
  return rows;
}

export function mentionTotals(videos, idx) {
  let videosWithCard = 0;
  let rows = 0;
  const pids = new Set();
  for (const video of videos) {
    const hit = extractMentions(video.description || "", idx);
    if (!hit.cards.length) continue;
    videosWithCard += 1;
    rows += hit.cards.length;
    for (const pid of hit.cards) pids.add(pid);
  }
  return { videosWithCard, rows, distinctCards: pids.size };
}

export function singleClaimsFromVideos(videos, idx) {
  const claims = [];
  for (const video of videos) {
    const text = video.description || "";
    if (!text || !video.date) continue;
    claims.push(...extractClaims({
      videoId: video.id || video.videoId || "video",
      channel: video.channel || "channel",
      date: String(video.date).slice(0, 10),
      text,
    }, idx));
  }
  return claims.filter((claim) => claim.target === "card" && claim.pid);
}

export function privateStudy(claims, metaByPid, priceOn, today) {
  const subjects = [];
  for (const claim of claims) subjects.push(...subjectsOf(claim, metaByPid).filter((row) => row.level === "single"));
  const windows = weeklyAttention(subjects);
  const clusters = weeklyCrowded(subjects);
  const hype = buildHypeEffect({ windows, priceOn, today });
  const crowded = buildCrowdedCalls({ clusters, priceOn, today });
  const strip = (gate) => ({
    n: gate.n,
    trainN: gate.trainN,
    testN: gate.testN,
    trainMedianPct: gate.trainMedianPct,
    testMedianPct: gate.testMedianPct,
    medianPct: gate.medianPct,
    from: gate.from,
    to: gate.to,
    passedHoldout: gate.passedHoldout,
    status: gate.status,
    minN: 20,
  });
  return {
    private: true,
    cardClaims: claims.length,
    cards: new Set(claims.map((claim) => claim.pid)).size,
    hypeEvents: windows.length,
    crowdedEvents: clusters.length,
    hype: strip(hype.gates.single),
    crowded: strip(crowded.gates.single),
    publicItems: 0,
  };
}

export async function rerunSingleStudies({ root = ROOT, videos = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  const catalogue = JSON.parse(await readFile(join(root, "data/catalog/tcgcsv-latest.json"), "utf8"));
  const idx = buildCatalogueIndex(catalogue.items || []);
  const metaByPid = new Map();
  for (const it of catalogue.items || []) {
    const pid = Number(it.tcgplayerProductId);
    if (!pid) continue;
    metaByPid.set(pid, { kind: it.kind === "sealed" ? "sealed" : "single", name: it.name, set: it.set, groupId: it.groupId || null });
  }
  let source = "argument";
  if (!videos) {
    const gz = join(root, "data/private/youtube/videos.jsonl.gz");
    videos = await readJsonlGz(gz);
    source = "data/private/youtube/videos.jsonl.gz";
  }
  const claims = singleClaimsFromVideos(videos, idx);
  const mentions = mentionTotals(videos, idx);
  const { priceOn } = await loadLongHistoryPriceBook(root);
  const study = privateStudy(claims, metaByPid, priceOn, today);
  const dates = videos.map((video) => String(video.date || "").slice(0, 10)).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort();
  let priceDays = [];
  try {
    priceDays = (await readdir(join(root, "data/history/tcgcsv-daily"))).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
  } catch { priceDays = []; }
  const doc = {
    asOf: today,
    private: true,
    note: "Singles study after the card matcher. No creator names. Not a public read. n is scored 30-day windows with an exact price on the start day and 30 days later. The gate is n>=20.",
    source,
    videos: videos.length,
    videoFrom: dates[0] || null,
    videoTo: dates.at(-1) || null,
    mentions,
    claimReasons: claims.reduce((acc, claim) => { acc[claim.reason] = (acc[claim.reason] || 0) + 1; return acc; }, {}),
    priceFiles: priceDays.length,
    priceFrom: priceDays[0] ? priceDays[0].slice(0, 10) : null,
    priceTo: priceDays.length ? priceDays.at(-1).slice(0, 10) : null,
    ...study,
  };
  const dir = join(root, "data/private/card-match");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "singles-study.json"), JSON.stringify(doc, null, 1) + "\n");
  return doc;
}

if (process.argv[1] && process.argv[1].endsWith("rerun-single-studies.mjs")) {
  const doc = await rerunSingleStudies();
  console.log(JSON.stringify({
    videos: doc.videos,
    cardClaims: doc.cardClaims,
    cards: doc.cards,
    hypeN: doc.hype.n,
    hypeEvents: doc.hypeEvents,
    hypeStatus: doc.hype.status,
    crowdedN: doc.crowded.n,
    crowdedEvents: doc.crowdedEvents,
    crowdedStatus: doc.crowded.status,
    from: doc.videoFrom,
    to: doc.videoTo,
  }));
}
