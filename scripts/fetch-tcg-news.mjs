// Public Pokémon TCG news. No model calls, no API keys, no eBay.
// Sources named in the repo: pokemon.com, official press, PokeBeach, Beckett, PokeGuardian.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  annotate,
  applyDisagreements,
  applyTitleLanguage,
  blockedUrlReason,
  decodeEntities,
  hasSourceUrl,
  htmlToText,
  isPriceText,
  isPublicNewsCandidate,
  pickDefault,
  pickNews,
  pickWeekly,
  ptDay,
  publicNewsRecord,
  sentenceForItem,
  shapeNewsItem,
  titleTranslations,
} from "./lib/tcg-news.mjs";
import {
  parseAsiaPress,
  parseAsiaSg,
  parseGematsu,
  parseJpInfo,
  parseLimitless,
  parsePcPreorders,
  parsePgNews,
  parsePgSets,
  parsePlayNews,
  parsePogoList,
  parseRk9,
  parseRss,
  parseSerebiiMonth,
  parseSerebiiSets,
  pogoArticleDate,
  serebiiMonthLinks,
} from "./lib/news-sources.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "CatchEmNews/1.0 (+https://github.com/Tbaker-maker/Catchem-data)";
const NEWS_PATH = join(ROOT, "research", "digests", "news.json");
const WEEKLY_PATH = join(ROOT, "research", "digests", "weekly-news.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getText(url) {
  const blocked = blockedUrlReason(url);
  if (blocked) throw new Error(blocked);
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8" },
    signal: AbortSignal.timeout(25000),
    redirect: "follow",
  });
  if (blockedUrlReason(res.url)) throw new Error(blockedUrlReason(res.url));
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") || "";
  const charset = (type.match(/charset=([^;]+)/i)?.[1] || "").toLowerCase();
  const text = buf.toString(/iso-8859-1|latin1|windows-1252/.test(charset) ? "latin1" : "utf8");
  return { status: res.status, type, finalUrl: res.url, text };
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
    const item = {
      title: row.title,
      date: row.date,
      url: row.url,
      sentence: sentence || undefined,
      kind: "news",
      source: "PokeBeach",
      listUrl: "https://www.pokebeach.com/forums/forum/front-page-news.18/index.rss",
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
      if ((sentence && isPriceText(sentence)) || isPriceText(link.title)) continue;
      const item = {
        title: link.title,
        date,
        url: link.url,
        sentence: sentence || undefined,
        kind: "news",
        source: "Pokémon press",
        listUrl: "https://press.pokemon.com/en",
        published: new Date(publishedAttr[1]).toISOString(),
      };
      if (hasSourceUrl(item)) items.push(item);
    } catch (err) {
      failures.push({ source: "Pokémon press", url: link.url, error: err.message });
    }
  }
  return items;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = [item.url, item.title, item.product || "", item.region || "", item.setDate || ""].join("\n");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function finalize(raw) {
  const parsed = raw.publishedText ? new Date(raw.publishedText) : null;
  const published = raw.published || (parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : undefined);
  let date = raw.date;
  if (!date && published) {
    const day = ptDay(new Date(published));
    if (day) date = day;
  }
  const sentence = raw.sentence || sentenceForItem(raw.sentenceText || "", raw.title) || undefined;
  const tags = [...(raw.tags || [])];
  if (raw.source === "Victory Road" && (raw.categories || []).some((category) => /events/i.test(category))) {
    tags.push("tournaments");
  }
  return annotate({
    title: raw.title,
    url: raw.url,
    source: raw.source,
    date,
    dateEnd: raw.dateEnd,
    statedDate: raw.statedDate,
    sentence,
    kind: raw.kind || "news",
    tags,
    product: raw.product,
    wave: raw.wave,
    reprint: raw.reprint,
    setDate: raw.setDate,
    region: raw.region,
    published,
    note: raw.note,
    listUrl: raw.listUrl,
  });
}

function blockedPage(text) {
  return /Pardon Our Interruption|Request Rejected|cf-browser-verification|Just a moment/i.test(String(text || "").slice(0, 2500));
}

async function readSource(source, url, failures) {
  try {
    const res = await getText(url);
    if (res.status >= 400 || blockedPage(res.text)) {
      const error = blockedPage(res.text) ? `HTTP ${res.status}: page blocked the fetch` : `HTTP ${res.status}`;
      failures.push({ source, url, error });
      return { source, url, skipped: error };
    }
    return { source, url, res };
  } catch (err) {
    failures.push({ source, url, error: err.message });
    return { source, url, skipped: err.message };
  }
}

async function fetchAdded(failures) {
  const reports = [];
  const items = [];
  async function one(source, url, parse) {
    const loaded = await readSource(source, url, failures);
    if (loaded.skipped) {
      reports.push({ source, url, items: 0, skipped: loaded.skipped });
      return;
    }
    let parsed = [];
    try {
      parsed = parse(loaded.res.text) || [];
    } catch (err) {
      failures.push({ source, url, error: err.message });
      reports.push({ source, url, items: 0, skipped: err.message });
      return;
    }
    items.push(...parsed);
    reports.push({
      source,
      url,
      items: parsed.length,
      skipped: parsed.length ? undefined : "page had no titled items",
    });
  }

  await Promise.all([
    one("Bulbagarden", "https://bulbagarden.net/home/index.rss", (html) => parseRss(html, "Bulbagarden")),
    one("Victory Road", "https://victoryroad.pro/feed/", (html) => parseRss(html, "Victory Road")),
    one("Siliconera", "https://www.siliconera.com/tag/pokemon/feed/", (html) => parseRss(html, "Siliconera")),
    one("Play! Pokémon", "https://play.pokemon.com/en-us/news/", parsePlayNews),
    one("Pokémon Card (Japan)", "https://www.pokemon-card.com/info/", parseJpInfo),
    one("PokeGuardian", "https://www.pokeguardian.com/articles/news-archive", parsePgNews),
    one("PokeGuardian", "https://www.pokeguardian.com/sets/upcoming-sets", parsePgSets),
    one("Limitless", "https://limitlesstcg.com/tournaments", parseLimitless),
    one("RK9", "https://rk9.gg/events/pokemon", parseRk9),
    one("Pokémon Center Support", "https://support.pokemoncenter.com/hc/en-us/articles/4407702295572-Estimated-Preorder-Release-Dates", parsePcPreorders),
    one("Pokémon Card (Asia)", "https://asia.pokemon-card.com/sg/", parseAsiaSg),
    one("Serebii", "https://www.serebii.net/card/english.shtml", parseSerebiiSets),
    one("Pokémon Asia press", "https://asia-press.portal-pokemon.com/", parseAsiaPress),
    one("Gematsu", "https://www.gematsu.com/companies/the-pokemon-company", parseGematsu),
  ]);

  for (const report of reports) {
    if (report.url === "https://asia.pokemon-card.com/sg/" && report.items) {
      report.note = "The list stated titles and links. It did not state a publication date.";
    }
  }

  const newsUrl = "https://www.serebii.net/news/";
  const index = await readSource("Serebii", newsUrl, failures);
  if (index.skipped) {
    reports.push({ source: "Serebii", url: newsUrl, items: 0, skipped: index.skipped });
  } else {
    const months = serebiiMonthLinks(index.res.text);
    let count = 0;
    if (!months.length) {
      reports.push({ source: "Serebii", url: newsUrl, items: 0, skipped: "index did not link a month archive" });
    } else {
      for (const month of months) {
        const loaded = await readSource("Serebii", month.url, failures);
        if (loaded.skipped) continue;
        const parsed = parseSerebiiMonth(loaded.res.text);
        items.push(...parsed);
        count += parsed.length;
        await sleep(120);
      }
      reports.push({
        source: "Serebii",
        url: newsUrl,
        items: count,
        skipped: count ? undefined : "month pages had no dated posts",
      });
    }
  }

  const goUrl = "https://pokemongo.com/en/news";
  const go = await readSource("Pokémon GO", goUrl, failures);
  if (go.skipped) {
    reports.push({ source: "Pokémon GO", url: goUrl, items: 0, skipped: go.skipped });
  } else {
    const list = parsePogoList(go.res.text);
    let cursor = 0;
    async function worker() {
      while (cursor < list.length) {
        const item = list[cursor++];
        try {
          const res = await getText(item.url);
          if (res.status >= 400 || blockedPage(res.text)) throw new Error(`HTTP ${res.status}: article page blocked the fetch`);
          const publishedText = pogoArticleDate(res.text);
          if (!publishedText) {
            failures.push({ source: "Pokémon GO", url: item.url, error: "article did not state a publication date" });
          } else item.publishedText = publishedText;
        } catch (err) {
          failures.push({ source: "Pokémon GO", url: item.url, error: err.message });
        }
        await sleep(80);
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker));
    items.push(...list);
    reports.push({ source: "Pokémon GO", url: goUrl, items: list.length, skipped: list.length ? undefined : "page had no titled items" });
  }

  return { items, reports };
}

function byCatalog(a, b) {
  const ad = a.published || a.date || "";
  const bd = b.published || b.date || "";
  if (ad !== bd) return ad < bd ? 1 : -1;
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}

async function main() {
  const today = ptDay();
  const failures = [];
  const [beach, press, added] = await Promise.all([
    pokebeach(failures),
    officialPress(failures),
    fetchAdded(failures),
  ]);
  const raw = [...press, ...beach, ...added.items];
  const catalog = dedupe(raw.map(finalize).filter(hasSourceUrl)).sort(byCatalog);
  applyDisagreements(catalog);
  const translations = titleTranslations();
  for (const item of catalog) applyTitleLanguage(item, translations);
  const stored = catalog.map(shapeNewsItem);
  const newsPool = stored.filter(isPublicNewsCandidate).map(publicNewsRecord);
  const items = pickDefault(newsPool, today, 8);
  const news = pickNews(newsPool, today);
  const weekly = pickWeekly(newsPool, today);
  const updated = new Date().toISOString();
  const sources = [
    {
      source: "PokeBeach",
      url: "https://www.pokebeach.com/forums/forum/front-page-news.18/index.rss",
      items: beach.length,
      skipped: beach.length ? undefined : "front-page news returned no items",
    },
    {
      source: "Pokémon press",
      url: "https://press.pokemon.com/en",
      items: press.length,
      skipped: press.length ? undefined : "press page returned no TCG items",
    },
    ...added.reports,
  ];
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
    catalog: stored,
    sources,
    failures,
  };
  const weeklyItems = weekly;
  let priorWeekly = {};
  try { priorWeekly = JSON.parse(await readFile(WEEKLY_PATH, "utf8")); } catch { priorWeekly = {}; }
  const weeklyDoc = {
    updated,
    timezone: "America/Vancouver",
    asOf: today,
    items: weeklyItems,
  };
  if (priorWeekly.priceMovers) weeklyDoc.priceMovers = priorWeekly.priceMovers;
  await mkdir(dirname(NEWS_PATH), { recursive: true });
  await writeFile(NEWS_PATH, JSON.stringify(newsDoc, null, 2) + "\n");
  await writeFile(WEEKLY_PATH, JSON.stringify(weeklyDoc, null, 2) + "\n");
  console.log(`catalog ${stored.length} · public ${items.length} · news ${news.length} · weekly ${weeklyItems.length} · failures ${failures.length}`);
  for (const source of sources) {
    console.log(`  source ${source.items}\t${source.skipped ? "SKIP " + source.skipped : "ok"}\t${source.source}\t${source.url}`);
  }
  const notes = stored.filter((item) => item.note && item.note.includes("disagree"));
  console.log(`disagreements ${notes.length}`);
  for (const item of notes) console.log(`  note ${item.source} ${item.product} ${item.setDate}`);
  if (failures.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
