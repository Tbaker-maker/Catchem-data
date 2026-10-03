// Public Pokémon TCG news. No model calls, no API keys, no eBay.
// Sources named in the repo: pokemon.com, official press, PokeBeach, Beckett, PokeGuardian.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeEntities,
  hasSourceUrl,
  htmlToText,
  isPriceText,
  pickDefault,
  pickNews,
  pickWeekly,
  ptDay,
  sentenceForItem,
} from "./lib/tcg-news.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "CatchEmNews/1.0 (+https://github.com/Tbaker-maker/Catchem-data)";
const NEWS_PATH = join(ROOT, "research", "digests", "news.json");
const WEEKLY_PATH = join(ROOT, "research", "digests", "weekly-news.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getText(url) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8" },
    signal: AbortSignal.timeout(25000),
    redirect: "follow",
  });
  const text = await res.text();
  return { status: res.status, type: res.headers.get("content-type") || "", finalUrl: res.url, text };
}

function threadId(url) {
  const m = String(url).match(/\.(\d+)\/?(?:$|\?|#)/);
  return m ? m[1] : null;
}

function rssBlocks(xml) {
  if (!xml.includes("<item>")) return [];
  return xml.split("<item>").slice(1).map((block) => block.slice(0, block.indexOf("</item>")));
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  return decodeEntities(m[1].replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")).trim();
}

function ptFromIso(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return ptDay(dt);
}

async function pokebeach(failures) {
  try {
    const wp = await getText("https://www.pokebeach.com/feed");
    if (wp.status >= 400 || /wp_die|No feed available/i.test(wp.text) || !wp.text.includes("<item>")) {
      failures.push({
        source: "PokeBeach",
        url: "https://www.pokebeach.com/feed",
        error: `HTTP ${wp.status}: site feed is not available`,
      });
    }
  } catch (err) {
    failures.push({ source: "PokeBeach", url: "https://www.pokebeach.com/feed", error: err.message });
  }

  let rss = "";
  try {
    const res = await getText("https://www.pokebeach.com/forums/forum/front-page-news.18/index.rss");
    if (res.status >= 400 || !res.text.includes("<item>")) {
      failures.push({
        source: "PokeBeach",
        url: "https://www.pokebeach.com/forums/forum/front-page-news.18/index.rss",
        error: `HTTP ${res.status}: front-page news RSS missing`,
      });
    } else rss = res.text;
  } catch (err) {
    failures.push({
      source: "PokeBeach",
      url: "https://www.pokebeach.com/forums/forum/front-page-news.18/index.rss",
      error: err.message,
    });
  }

  const bodies = new Map();
  for (const block of rssBlocks(rss)) {
    const link = tag(block, "link");
    const id = threadId(link);
    const category = tag(block, "category");
    if (!id || (category && category !== "Front Page News")) continue;
    const encoded = block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/);
    bodies.set(id, htmlToText(encoded ? encoded[1] : tag(block, "description")));
  }

  const listed = [];
  const seen = new Set();
  for (let page = 1; page <= 8; page++) {
    const url = page === 1
      ? "https://www.pokebeach.com/forums/forum/front-page-news.18/"
      : `https://www.pokebeach.com/forums/forum/front-page-news.18/page-${page}`;
    let html = "";
    try {
      const res = await getText(url);
      if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      html = res.text;
    } catch (err) {
      failures.push({ source: "PokeBeach", url, error: err.message });
      break;
    }
    const chunks = html.split('<div class="structItem-title">').slice(1);
    let pageKept = 0;
    for (const chunk of chunks) {
      const href = chunk.match(/href="(\/forums\/threads\/[^"]+)"/);
      const title = chunk.match(/href="\/forums\/threads\/[^"]+"[^>]*>([^<]+)</);
      const time = chunk.match(/structItem-startDate[\s\S]*?datetime="([^"]+)"/);
      if (!href || !title || !time) continue;
      const path = href[1].split("?")[0];
      const id = threadId(path);
      if (!id || seen.has(id)) continue;
      const published = new Date(time[1]).toISOString();
      const date = ptFromIso(time[1]);
      if (!date) continue;
      seen.add(id);
      const today = ptDay();
      const floor = shiftImport(today);
      if (date < floor) continue;
      pageKept++;
      listed.push({
        id,
        title: decodeEntities(title[1]).replace(/\s+/g, " ").trim(),
        url: `https://www.pokebeach.com${path}`,
        date,
        published,
      });
    }
    if (pageKept === 0) break;
    await sleep(200);
  }

  const need = listed.filter((item) => !bodies.has(item.id));
  let cursor = 0;
  async function worker() {
    while (cursor < need.length) {
      const item = need[cursor++];
      try {
        const res = await getText(item.url);
        if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
        const first = res.text.split("bbWrapper")[1] || "";
        bodies.set(item.id, htmlToText(first.slice(0, 8000)));
      } catch (err) {
        failures.push({ source: "PokeBeach", url: item.url, error: err.message });
      }
      await sleep(120);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));

  const items = [];
  for (const row of listed) {
    if (isPriceText(row.title)) continue;
    const sentence = sentenceForItem(bodies.get(row.id) || "", row.title);
    if (!sentence) continue;
    const item = {
      title: row.title,
      date: row.date,
      url: row.url,
      sentence,
      kind: "news",
      source: "PokeBeach",
      published: row.published,
    };
    if (!hasSourceUrl(item)) continue;
    items.push(item);
  }
  return items;
}

function shiftImport(today) {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 90);
  return dt.toISOString().slice(0, 10);
}

async function officialPress(failures) {
  let html = "";
  try {
    const res = await getText("https://press.pokemon.com/en");
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    html = res.text;
  } catch (err) {
    failures.push({ source: "Pokémon press", url: "https://press.pokemon.com/en", error: err.message });
    return [];
  }
  const links = [];
  const seen = new Set();
  for (const block of html.split('<div class="newsItem').slice(1)) {
    if (!block.startsWith(" media")) continue;
    const href = block.match(/<div class="headline"><a href="([^"#]+)"/);
    const titleRaw = block.match(/<div class="headline"><a href="[^"]+">([\s\S]*?)<\/a>/);
    if (!href || !titleRaw) continue;
    if (!href[1].startsWith("/en/releases/")) continue;
    const url = `https://press.pokemon.com${href[1]}`;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({
      url,
      title: decodeEntities(titleRaw[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(),
    });
  }
  const items = [];
  for (const link of links) {
    try {
      const res = await getText(link.url);
      if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      if (/log in|sign in to continue/i.test(res.text.slice(0, 500))) throw new Error("page is behind a login");
      if (!/trading card game|\bTCG\b/i.test(link.title)) continue;
      const publishedAttr = res.text.match(/itemprop="datePublished"[^>]*content="([^"]+)"/)
        || res.text.match(/content="([^"]+)"[^>]*itemprop="datePublished"/);
      const body = res.text.match(/itemprop="articleBody"[^>]*>([\s\S]*?)<\/section>/);
      const text = htmlToText(body ? body[1] : "").split(/About The Pokémon Company/i)[0];
      if (!publishedAttr) continue;
      const date = ptFromIso(publishedAttr[1]);
      if (!date) continue;
      const sentence = sentenceForItem(text, link.title);
      if (!sentence) continue;
      if (isPriceText(link.title) || isPriceText(sentence)) continue;
      const item = {
        title: link.title,
        date,
        url: link.url,
        sentence,
        kind: "news",
        source: "Pokémon press",
        published: new Date(publishedAttr[1]).toISOString(),
      };
      if (hasSourceUrl(item)) items.push(item);
    } catch (err) {
      failures.push({ source: "Pokémon press", url: link.url, error: err.message });
    }
  }
  return items;
}

async function recordClosedSources(failures) {
  const checks = [
    ["pokemon.com", "https://www.pokemon.com/us/pokemon-news"],
    ["Beckett", "https://www.beckett.com/news/feed/"],
    ["PokeGuardian", "https://www.pokeguardian.com/feed/"],
  ];
  for (const [source, url] of checks) {
    try {
      const res = await getText(url);
      const blocked = /Pardon Our Interruption|maintenance\.beckett|Request Rejected/i.test(res.text);
      const rss = res.text.includes("<item>") || res.text.includes("<entry>");
      if (res.status >= 400 || blocked || !rss) {
        failures.push({
          source,
          url,
          error: blocked
            ? `HTTP ${res.status}: page is blocked or not a public feed`
            : `HTTP ${res.status}: not a public RSS feed`,
        });
      }
    } catch (err) {
      failures.push({ source, url, error: err.message });
    }
  }
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

async function main() {
  const today = ptDay();
  const failures = [];
  const [beach, press] = await Promise.all([
    pokebeach(failures),
    officialPress(failures),
    recordClosedSources(failures),
  ]);
  const all = dedupe([...press, ...beach]).filter((item) => item.kind === "news" && hasSourceUrl(item));
  const items = pickDefault(all, today, 8);
  const news = pickNews(all, today);
  const weekly = pickWeekly(all, today);
  const updated = new Date().toISOString();
  const newsDoc = {
    updated,
    timezone: "America/Vancouver",
    asOf: today,
    defaultWindowDays: 14,
    defaultCap: 8,
    items,
    filters: {
      news: {
        kind: "news",
        windowDays: 90,
        items: news,
      },
    },
    failures,
  };
  const weeklyDoc = {
    updated,
    timezone: "America/Vancouver",
    asOf: today,
    items: weekly,
  };
  await mkdir(dirname(NEWS_PATH), { recursive: true });
  await writeFile(NEWS_PATH, JSON.stringify(newsDoc, null, 2) + "\n");
  await writeFile(WEEKLY_PATH, JSON.stringify(weeklyDoc, null, 2) + "\n");
  console.log(`news default ${items.length} · filter ${news.length} · weekly ${weekly.length} · failures ${failures.length}`);
  for (const item of items) console.log(`  ${item.date}  ${item.title}`);
  if (weekly.length > items.length) {
    console.log("weekly older:");
    for (const item of weekly.slice(items.length)) console.log(`  ${item.date}  ${item.title}`);
  }
  for (const fail of failures) console.log(`  fail ${fail.source} ${fail.url} ${fail.error}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
