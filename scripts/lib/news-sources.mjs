// Parsers for public Pokémon news pages. No network. No invented headlines.

import { decodeEntities, htmlToText, preciseDays } from "./tcg-news.mjs";

export function stripTags(html) {
  return decodeEntities(String(html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function absUrl(base, href) {
  try {
    return new URL(String(href || "").trim(), base).href;
  } catch {
    return "";
  }
}

function pushItem(out, item) {
  const title = String(item.title || "").replace(/\s+/g, " ").trim();
  const url = String(item.url || "").trim();
  if (!title || !/^https?:\/\//.test(url)) return;
  out.push({ ...item, title, url });
}

function rssBlocks(xml) {
  if (!xml || !xml.includes("<item>")) return [];
  return xml.split("<item>").slice(1).map((block) => block.slice(0, block.indexOf("</item>") === -1 ? undefined : block.indexOf("</item>")));
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!match) return "";
  return decodeEntities(match[1].replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")).trim();
}

export function parseRss(xml, source) {
  const items = [];
  for (const block of rssBlocks(xml)) {
    const title = tag(block, "title");
    const link = tag(block, "link").split("?")[0];
    const pub = tag(block, "pubDate");
    const categories = [...block.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)].map((m) =>
      decodeEntities(m[1].replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")).trim(),
    );
    const encoded = block.match(/<content:encoded(?:\s[^>]*)?>([\s\S]*?)<\/content:encoded>/i);
    const body = htmlToText(encoded ? encoded[1] : tag(block, "description"));
    pushItem(items, {
      title,
      url: link,
      source,
      publishedText: pub,
      sentenceText: body,
      categories,
      kind: "news",
    });
  }
  return items;
}

export function parsePlayNews(html) {
  const items = [];
  const seen = new Set();
  const re = /\{"description":"((?:\\.|[^"\\])*)","cta":\{"hiddenLabel":(?:null|"(?:\\.|[^"\\])*"),"href":"(https:[^"]+)"\}[\s\S]*?"date":"(\d{4}-\d{2}-\d{2})","tags":(\[[^\]]*\])\}/g;
  for (const match of String(html || "").matchAll(re)) {
    let title = match[1];
    try { title = JSON.parse(`"${match[1]}"`); } catch { /* keep raw */ }
    title = stripTags(title);
    const url = match[2];
    if (seen.has(url)) continue;
    seen.add(url);
    let pageTags = [];
    try { pageTags = JSON.parse(match[4]); } catch { pageTags = []; }
    const tags = [];
    if (pageTags.includes("championship-series") || pageTags.includes("league")) tags.push("tournaments");
    pushItem(items, {
      title,
      url,
      date: match[3],
      statedDate: match[3],
      source: "Play! Pokémon",
      kind: "news",
      tags,
      listUrl: "https://play.pokemon.com/en-us/news/",
    });
  }
  return items;
}

export function parseJpInfo(html) {
  const items = [];
  const re = /<a class="List_item_inner"[^>]*href="([^"]+)"[\s\S]*?<div class="List_body">([\s\S]*?)<\/div>\s*<\/a>/g;
  for (const match of String(html || "").matchAll(re)) {
    const body = match[2];
    const label = stripTags((body.match(/Calendar_Label[^>]*>([^<]+)/) || [])[1] || "");
    const dateText = stripTags((body.match(/<span class="Date[^"]*">([^<]+)<\/span>/) || [])[1] || "");
    const title = stripTags(body.replace(/<span class="Date[\s\S]*<\/span>/, "").replace(/<div class="Calendar_Label[\s\S]*?<\/div>/, ""));
    const dateMatch = dateText.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
    const date = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
      : undefined;
    const tags = [];
    if (label === "商品" || /カード|拡張パック|プロモ/.test(title)) tags.push("cards");
    if (/パック|ボックス|カートン|デッキセット/.test(title)) tags.push("sealed");
    if (/大会|リーグ|チャンピオン|エントリー/.test(title)) tags.push("tournaments");
    pushItem(items, {
      title,
      url: absUrl("https://www.pokemon-card.com/info/", match[1]),
      date,
      statedDate: dateText || undefined,
      source: "Pokémon Card (Japan)",
      kind: "news",
      tags,
      listUrl: "https://www.pokemon-card.com/info/",
    });
  }
  return items;
}

export function parsePgNews(html) {
  const items = [];
  const re = /<h2 class="jw-news-post__title">\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span class="jw-news-date">([^<]+)<\/span>/g;
  for (const match of String(html || "").matchAll(re)) {
    const stated = stripTags(match[3]);
    const days = preciseDays(stated);
    pushItem(items, {
      title: stripTags(match[2]),
      url: absUrl("https://www.pokeguardian.com/", match[1]),
      date: days[0],
      statedDate: stated,
      source: "PokeGuardian",
      kind: "news",
      listUrl: "https://www.pokeguardian.com/articles/news-archive",
    });
  }
  return items;
}

export function parsePgSets(html) {
  const items = [];
  let region = "";
  const blocks = String(html || "").split(/<h2 class="jw-heading-100">/);
  for (const block of blocks) {
    const heading = stripTags(block.slice(0, block.indexOf("</h2>") === -1 ? 0 : block.indexOf("</h2>")));
    if (/Japanese Sets|International Sets/.test(heading)) region = heading;
    const chunk = /Japanese Sets|International Sets/.test(heading) ? block : "";
    if (!chunk) continue;
    const parts = [...chunk.matchAll(/<h3 class="jw-heading-70">([\s\S]*?)<\/h3>\s*<h3 class="jw-heading-70">([\s\S]*?)<\/h3>\s*<h3 class="jw-heading-70">([\s\S]*?)<\/h3>/g)];
    for (const part of parts) {
      const name = stripTags(part[1]);
      const when = stripTags(part[2]);
      const href = (part[3].match(/href="([^"]+)"/) || [])[1] || "";
      if (!name || !when || name === "Info") continue;
      const days = preciseDays(when);
      pushItem(items, {
        title: name,
        product: name,
        url: absUrl("https://www.pokeguardian.com/sets/upcoming-sets", href || "https://www.pokeguardian.com/sets/upcoming-sets"),
        date: days[0],
        dateEnd: days.length > 1 ? days[days.length - 1] : undefined,
        statedDate: when,
        setDate: when,
        region,
        source: "PokeGuardian",
        kind: "release",
        tags: ["cards", "release"],
        listUrl: "https://www.pokeguardian.com/sets/upcoming-sets",
        note: "PokeGuardian says some sets on this page might not be confirmed or officially revealed yet, and that the dates can change.",
      });
    }
  }
  return items;
}

export function parseLimitless(html) {
  const items = [];
  const re = /<tr([^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*)>([\s\S]*?)<\/tr>/g;
  for (const match of String(html || "").matchAll(re)) {
    const attrs = match[1];
    const row = match[3];
    const name = decodeEntities((attrs.match(/data-name="([^"]*)"/) || [])[1] || "");
    const format = (attrs.match(/data-format="([^"]*)"/) || [])[1] || "";
    const href = (row.match(/href="([^"]+)"/) || [])[1] || "";
    const tags = ["tournaments"];
    if (/standard|expanded/i.test(format)) tags.push("cards");
    pushItem(items, {
      title: name,
      url: absUrl("https://limitlesstcg.com/tournaments", href),
      date: match[2],
      statedDate: match[2],
      source: "Limitless",
      kind: "tournament",
      tags,
      listUrl: "https://limitlesstcg.com/tournaments",
    });
  }
  return items;
}

export function parseRk9(html) {
  const items = [];
  const re = /<tr>\s*<td>([^<]+)<\/td>\s*<td>[\s\S]*?<\/td>\s*<td>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/g;
  for (const match of String(html || "").matchAll(re)) {
    const stated = stripTags(match[1]);
    const days = preciseDays(stated);
    const games = stripTags(match[6]);
    const tags = ["tournaments"];
    if (/\bTCG\b/.test(games)) tags.push("cards");
    if (/\b(VG|GO|UNITE)\b/.test(games)) tags.push("video-games");
    pushItem(items, {
      title: stripTags(match[3]),
      url: absUrl("https://rk9.gg/events/pokemon", match[2]),
      date: days[0],
      dateEnd: days.length > 1 ? days[days.length - 1] : undefined,
      statedDate: stated,
      source: "RK9",
      kind: "tournament",
      tags,
      listUrl: "https://rk9.gg/events/pokemon",
    });
  }
  return items;
}

function cellText(inner) {
  const lis = [...String(inner || "").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => stripTags(m[1])).filter(Boolean);
  if (lis.length) return lis;
  const text = stripTags(inner);
  return text ? [text] : [];
}

export function parsePcPreorders(html) {
  const items = [];
  const updated = stripTags(String(html || "").match(/October \d{1,2}, \d{4}/)?.[0] || "");
  const updatedDays = preciseDays(updated);
  const body = String(html || "");
  const table = (body.match(/<tbody>([\s\S]*?)<\/tbody>/) || [])[1] || "";
  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]);
  const spans = new Map();
  const grid = [];
  rows.forEach((row, r) => {
    const cells = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].map((m) => ({
      rowspan: Number((m[1].match(/rowspan="(\d+)"/) || [])[1] || 1),
      values: cellText(m[2]),
    }));
    grid[r] = [];
    let col = 0;
    let ci = 0;
    while (ci < cells.length || spans.has(col)) {
      const pending = spans.get(col);
      if (pending && pending.left > 0) {
        grid[r][col] = pending.values;
        pending.left -= 1;
        if (pending.left <= 0) spans.delete(col);
        col += 1;
        continue;
      }
      if (ci >= cells.length) break;
      const cell = cells[ci++];
      grid[r][col] = cell.values;
      if (cell.rowspan > 1) spans.set(col, { values: cell.values, left: cell.rowspan - 1 });
      col += 1;
    }
  });
  for (const row of grid.slice(1)) {
    const names = row[0] || [];
    const region = (row[1] || []).join(", ");
    const when = (row[2] || []).join(", ");
    if (!when || /estimated ship date/i.test(when)) continue;
    for (const name of names) {
      if (!name || /item name/i.test(name)) continue;
      const tags = ["release"];
      if (/tcg|booster|elite trainer|tin|bundle|display box/i.test(name)) tags.push("sealed", "cards");
      pushItem(items, {
        title: name,
        product: name,
        url: "https://support.pokemoncenter.com/hc/en-us/articles/4407702295572-Estimated-Preorder-Release-Dates",
        date: updatedDays[0],
        statedDate: updated || undefined,
        setDate: when,
        region: region || undefined,
        source: "Pokémon Center Support",
        kind: "release",
        tags,
        listUrl: "https://support.pokemoncenter.com/hc/en-us/articles/4407702295572-Estimated-Preorder-Release-Dates",
      });
    }
  }
  return items;
}

export function parseAsiaSg(html) {
  const items = [];
  const seen = new Set();
  const re = /<a class="info-column-item[^"]*" href="(https:\/\/asia\.pokemon-card\.com\/sg\/archives\/\d+\/)"[\s\S]*?<div class="info-column-item-title text">([\s\S]*?)<\/div>[\s\S]*?<span class="category[^"]*">([\s\S]*?)<\/span>/g;
  for (const match of String(html || "").matchAll(re)) {
    const title = stripTags(match[2]);
    const key = match[1] + "|" + title;
    if (seen.has(key)) continue;
    seen.add(key);
    const category = stripTags(match[3]);
    const tags = [];
    if (/competition|championship|tournament/i.test(title)) tags.push("tournaments");
    if (/\bTCG\b|card/i.test(title)) tags.push("cards");
    pushItem(items, {
      title,
      url: match[1],
      source: "Pokémon Card (Asia)",
      kind: "news",
      tags,
      listUrl: "https://asia.pokemon-card.com/sg/",
    });
  }
  return items;
}

export function parseSerebiiSets(html) {
  const items = [];
  const rows = [...String(html || "").matchAll(/<tr>\s*<td class="cen">([\s\S]*?)<\/td>\s*<td class="cen">([\s\S]*?)<\/td>\s*<td class="cen">([\s\S]*?)<\/td>\s*<td class="cen">([\s\S]*?)<\/td>\s*<td class="cen">([\s\S]*?)<\/td>\s*<\/tr>/g)];
  for (const row of rows) {
    const name = stripTags(row[3]);
    const when = stripTags(row[5]);
    const href = (row[3].match(/href="([^"]+)"/) || [])[1] || "";
    if (!name || !when || /set name|release date/i.test(name)) continue;
    const days = preciseDays(when);
    pushItem(items, {
      title: name,
      product: name,
      url: absUrl("https://www.serebii.net/card/english.shtml", href),
      date: days[0],
      dateEnd: days.length > 1 ? days[days.length - 1] : undefined,
      statedDate: when,
      setDate: when,
      source: "Serebii",
      kind: "release",
      tags: ["cards", "release"],
      listUrl: "https://www.serebii.net/card/english.shtml",
    });
  }
  return items;
}

export function serebiiMonthLinks(html) {
  const links = [];
  const seen = new Set();
  for (const match of String(html || "").matchAll(/href="(\/news\/(\d{4})\/([A-Za-z]+)\.shtml)"/g)) {
    const url = absUrl("https://www.serebii.net/news/", match[1]);
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ url, year: Number(match[2]), month: match[3] });
  }
  if (!links.length) return [];
  const year = Math.max(...links.map((link) => link.year));
  return links.filter((link) => link.year === year);
}

export function parseSerebiiMonth(html) {
  const items = [];
  const re = /<h2><a href="(\/news\/[^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>\s*<p class="info"><span class="date">([^<]+)<\/span>/g;
  for (const match of String(html || "").matchAll(re)) {
    const href = match[1];
    const stated = stripTags(match[3]);
    const parts = stated.match(/^(\d{2})-(\d{2})-(\d{4})/);
    const monthName = (href.match(/\/\d{2}-([A-Za-z]+)-\d{4}/) || [])[1] || "";
    const fromName = parts && monthName ? preciseDays(`${parts[1]} ${monthName} ${parts[3]}`) : [];
    const fromNumbers = parts ? preciseDays(`${parts[3]}-${parts[2]}-${parts[1]}`) : [];
    const date = fromName[0] || fromNumbers[0];
    pushItem(items, {
      title: stripTags(match[2]),
      url: absUrl("https://www.serebii.net/news/", href),
      date,
      statedDate: stated,
      source: "Serebii",
      kind: "news",
      listUrl: "https://www.serebii.net/news/",
    });
  }
  return items;
}

export function parsePogoList(html) {
  const items = [];
  for (const block of String(html || "").match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || []) {
    const json = block.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
    let data;
    try { data = JSON.parse(json); } catch { continue; }
    if (data?.["@type"] !== "ItemList" || !Array.isArray(data.itemListElement)) continue;
    for (const entry of data.itemListElement) {
      pushItem(items, {
        title: entry.name,
        url: entry.url,
        source: "Pokémon GO",
        kind: "news",
        tags: ["video-games"],
        listUrl: "https://pokemongo.com/en/news",
      });
    }
  }
  return items;
}

export function pogoArticleDate(html) {
  const match = String(html || "").match(/"datePublished":"([^"]+)"/);
  return match ? match[1] : "";
}

export function parseAsiaPress(html) {
  const items = [];
  const seen = new Set();
  const re = /<a class="[^"]*cardLink" href="([^"]+)"[\s\S]*?<p class="[^"]*__title">([\s\S]*?)<\/p>[\s\S]*?<time[^>]*dateTime="([^"]+)"/g;
  for (const match of String(html || "").matchAll(re)) {
    const url = absUrl("https://asia-press.portal-pokemon.com/", match[1]);
    if (seen.has(url)) continue;
    seen.add(url);
    const stated = match[3];
    const dotted = stated.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    const days = dotted ? preciseDays(`${dotted[1]}-${dotted[2]}-${dotted[3]}`) : preciseDays(stated);
    pushItem(items, {
      title: stripTags(match[2]),
      url,
      date: days[0],
      statedDate: stated,
      source: "Pokémon Asia press",
      kind: "news",
      listUrl: "https://asia-press.portal-pokemon.com/",
    });
  }
  return items;
}

export function parseGematsu(html) {
  const items = [];
  const re = /<article class="gematsu-post[\s\S]*?<\/article>/g;
  for (const match of String(html || "").matchAll(re)) {
    const block = match[0];
    const href = (block.match(/<h2><a href="(https:\/\/www\.gematsu\.com\/[^"]+)"/) || [])[1];
    const title = stripTags((block.match(/<h2><a href="[^"]+">([\s\S]*?)<\/a><\/h2>/) || [])[1] || "");
    const when = (block.match(/<time datetime="([^"]+)"/) || [])[1] || "";
    const strap = stripTags((block.match(/<div class="strapline">([\s\S]*?)<\/div>/) || [])[1] || "");
    if (!href || !title) continue;
    const days = preciseDays(when.slice(0, 10));
    pushItem(items, {
      title,
      url: href,
      date: days[0],
      statedDate: when,
      sentenceText: strap,
      source: "Gematsu",
      kind: "news",
      tags: ["video-games"],
      listUrl: "https://www.gematsu.com/companies/the-pokemon-company",
    });
  }
  return items;
}
