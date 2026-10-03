import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyDisagreements,
  applyTitleLanguage,
  blockedUrlReason,
  hasSourceUrl,
  isPublicNewsCandidate,
  pickDefault,
  pickNews,
  pickWeekly,
  preciseDays,
  productKey,
  publicNewsRecord,
  releaseCalendar,
  sourceAllowsOlderWeekly,
  fieldTags,
  shiftDay,
  videoGameHeadlines,
  tagsFor,
} from "../lib/tcg-news.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function item(over) {
  return {
    title: "A public TCG note.",
    date: "2026-10-01",
    url: "https://www.pokebeach.com/forums/threads/example.1/",
    sentence: "The source says this is a public TCG note.",
    kind: "news",
    source: "PokeBeach",
    published: "2026-10-01T12:00:00.000Z",
    ...over,
  };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const missing = item({ url: "" });
  t("an item with no source URL fails", hasSourceUrl(missing) === false);
  t("an item with a source URL passes", hasSourceUrl(item({})) === true);

  const today = "2026-10-02";
  const rows = [
    item({ title: "New today.", date: "2026-10-02", published: "2026-10-02T18:00:00.000Z", url: "https://press.pokemon.com/en/a" }),
    item({ title: "Edge of the window.", date: "2026-09-18", published: "2026-09-18T18:00:00.000Z", url: "https://press.pokemon.com/en/b" }),
    item({ title: "Too old for the mix.", date: "2026-09-17", published: "2026-09-17T18:00:00.000Z", url: "https://press.pokemon.com/en/c", sentence: "The source says a product is to launch in November." }),
    item({ title: "Inside ninety days.", date: "2026-08-01", published: "2026-08-01T18:00:00.000Z", url: "https://press.pokemon.com/en/d", sentence: "More English cards were revealed for the set." }),
    item({ title: "Past ninety days.", date: "2026-06-01", published: "2026-06-01T18:00:00.000Z", url: "https://press.pokemon.com/en/e", sentence: "The source says the product is to release in July." }),
    item({ title: "Opinion only.", date: "2026-08-20", published: "2026-08-20T18:00:00.000Z", url: "https://press.pokemon.com/en/f", sentence: "The column looks at how a deck felt at the event." }),
  ];
  for (let i = 0; i < 10; i++) {
    rows.push(item({
      title: `Fill ${i}.`,
      date: "2026-10-01",
      published: `2026-10-01T${String(i).padStart(2, "0")}:00:00.000Z`,
      url: `https://www.pokebeach.com/forums/threads/fill.${i}/`,
    }));
  }
  const def = pickDefault(rows, today, 8);
  t("default mix caps at 8", def.length === 8);
  t("default mix drops anything older than 14 days", def.every((row) => row.date >= "2026-09-18"));
  const news = pickNews(rows, today);
  t("news filter keeps kind news inside 90 days", news.some((row) => row.date === "2026-08-01") && news.every((row) => row.date >= "2026-07-04"));
  t("news filter drops anything older than 90 days", news.every((row) => row.date !== "2026-06-01"));
  const weekly = pickWeekly(rows, today);
  t("weekly letter drops an older release that is not inside the next two weeks", weekly.every((row) => !row.url.endsWith("/c")));
  t("weekly letter can keep an older reveal the source states", weekly.some((row) => row.url.endsWith("/d")));
  const soon = item({
    title: "A box dated by the source.",
    date: "2026-09-01",
    published: "2026-09-01T18:00:00.000Z",
    url: "https://press.pokemon.com/en/g",
    sentence: "The product releases on October 9, 2026.",
  });
  t("weekly letter keeps an older item when the source dates the release inside two weeks", pickWeekly([...rows, soon], today).some((row) => row.url.endsWith("/g")));
  t("weekly letter leaves out an older item the source does not qualify", weekly.every((row) => !row.url.endsWith("/f")));
  t("weekly letter leaves out an item older than 90 days", weekly.every((row) => !row.url.endsWith("/e")));
  t("a release inside the next two weeks is the source date", sourceAllowsOlderWeekly("Pokemon to release a new box on October 10, 2026.", today) === true);
  t("a release outside the next two weeks does not qualify", sourceAllowsOlderWeekly("Pokemon to release a new box on January 27th.", today) === false);
  t("a reveal the source states still qualifies", sourceAllowsOlderWeekly("More English cards were revealed for the set.", today) === true);
  t("a plain older recap is not treated as important", sourceAllowsOlderWeekly("The column looks at how a deck felt at the event.", today) === false);
  t("a merch headline is not tagged as cards", tagsFor("New merch collection starring Dedenne, Joltik, and more").length === 0);
  t("a regional headline is a tournament", tagsFor("Sign-ups for the Stuttgart Regional are open").includes("tournaments"));
  const fetched = ["PokeBeach", "Pokémon GO", "Siliconera"];
  t("TCG comes from a cards tag already on the item", fieldTags({ tags: ["cards"], source: "PokeBeach" }, fetched).includes("TCG"));
  t("a video game tag needs the video-games field and a fetched source", fieldTags({ tags: ["video-games"], source: "Pokémon GO" }, fetched).includes("video game") && !fieldTags({ tags: ["video-games"], source: "Nintendo Life" }, fetched).includes("video game"));
  t("Japan comes from the region field, not an English headline", fieldTags({ region: "jp", tags: [] }, fetched).includes("Japan") && fieldTags({ region: "Japanese Sets", tags: [] }, fetched).includes("Japan") && !fieldTags({ region: "UK", tags: [] }, fetched).includes("Japan") && !fieldTags({ title: "shops in Japan", tags: [], source: "Bulbagarden" }, fetched).includes("Japan"));
  t("product wave and reprint stay off unless the field is present", !fieldTags({ tags: ["cards"], source: "PokeBeach" }, fetched).includes("product wave") && fieldTags({ reprint: "Reprints of Ultra Ball", tags: [] }, fetched).includes("reprint") && !fieldTags({ tags: [] }, fetched).includes("reprint"));
  const calendar = releaseCalendar([
    { title: "A", url: "https://example.com/a", source: "Serebii", product: "Delta Reign", setDate: "November 6th 2026" },
    { title: "B", url: "https://example.com/b", source: "PokeGuardian", product: "Delta Reign", setDate: "December 1, 2026", note: "Sources disagree on the date for Delta Reign." },
    { title: "C", url: "https://example.com/c", source: "Serebii", product: "Vague", setDate: "Early October 2026" },
  ]);
  t("the calendar keeps a specific source day and drops a vague one", calendar.dates.length === 1 && calendar.dates[0].date === "2026-11-06");
  t("a disagreed date stays out and both figures stay recorded", calendar.omitted.length === 1 && calendar.omitted[0].setDate === "December 1, 2026");
  const games = videoGameHeadlines([
    { title: "A GO note.", url: "https://pokemongo.com/news/a", source: "Pokémon GO", date: "2026-10-01", kind: "news", tags: ["video-games"], sentence: "A GO note from the fetched page." },
    { title: "Not fetched.", url: "https://example.com/nl", source: "Nintendo Life", date: "2026-10-01", kind: "news", tags: ["video-games"], sentence: "This source was not fetched." },
  ], fetched);
  t("video game headlines come only from a fetched source", games.length === 1 && games[0].source === "Pokémon GO");
  t("November 6 and November 6th are the same day", preciseDays("November 6, 2026").join() === preciseDays("November 6th 2026").join());
  t("early October is not a specific day", preciseDays("Early October 2026").length === 0);
  t("mega evolution prefix still matches the set name", productKey("Mega Evolution - Delta Reign") === productKey("Delta Reign"));
  const left = { title: "A", url: "https://www.serebii.net/card/deltareign", source: "Serebii", product: "Delta Reign", setDate: "November 6th 2026" };
  const right = { title: "B", url: "https://www.pokeguardian.com/sets/upcoming-sets", source: "PokeGuardian", product: "Mega Evolution - Delta Reign", setDate: "December 1, 2026" };
  applyDisagreements([left, right]);
  t("a date disagreement keeps both items and notes it", Boolean(left.note && right.note && left.note.includes("disagree")));
  const same = { title: "C", url: "https://www.serebii.net/card/example", source: "Serebii", product: "Delta Reign", setDate: "November 6, 2026" };
  const other = { title: "D", url: "https://www.pokeguardian.com/example", source: "PokeGuardian", product: "Delta Reign", setDate: "November 6th 2026" };
  applyDisagreements([same, other]);
  t("the same day is not called a disagreement", !same.note);
  t("pokemon.com is not fetched", Boolean(blockedUrlReason("https://www.pokemon.com/us/pokemon-news")));
  t("pokebeach feed is not fetched", Boolean(blockedUrlReason("https://www.pokebeach.com/feed")));
  t("the front-page RSS is still allowed", blockedUrlReason("https://www.pokebeach.com/forums/forum/front-page-news.18/index.rss") === null);

  const jp = {
    title: "「テスト大会」開催！",
    url: "https://www.pokemon-card.com/info/1.html",
    source: "Pokémon Card (Japan)",
    date: "2026-10-02",
    kind: "news",
  };
  applyTitleLanguage(jp, {});
  t("an untranslated Japan title stays Japanese and notes the gap", jp.title === "「テスト大会」開催！" && jp.region === "jp" && jp.note === "Translation is missing.");
  t("an untranslated Japan title stays out of the public mix", isPublicNewsCandidate(jp) === false);
  const jpKnown = {
    title: "拡張パック「テスト」のカードリスト公開！",
    url: "https://www.pokemon-card.com/info/2.html",
    source: "Pokémon Card (Japan)",
    date: "2026-10-02",
    kind: "news",
  };
  applyTitleLanguage(jpKnown, { [jpKnown.title]: "Japan: The card list for the expansion pack \"Test\" has been published" });
  const jpPublic = publicNewsRecord(jpKnown);
  t("a Japan title is kept and an English title is stored", jpKnown.title.startsWith("拡張") && jpKnown.titleEn.startsWith("Japan:"));
  t("the public Japan title is English and names Japan", jpPublic.title.startsWith("Japan:") && jpPublic.originalTitle === jpKnown.title && !/[぀-ヿ]/.test(jpPublic.title));
  const asia = {
    title: "Pokémon TCG Academia 2026 (Philippines)",
    url: "https://asia.pokemon-card.com/sg/archives/1/",
    source: "Pokémon Card (Asia)",
    date: "2026-10-01",
    kind: "news",
    sentence: "The page says the academia roadshow is in the Philippines.",
  };
  applyTitleLanguage(asia, {});
  t("an Asia English page stays English", !asia.region && !asia.titleEn && asia.title.startsWith("Pokémon"));
  const fan = {
    title: "New merch coming soon to Pokémon Centers in Japan",
    url: "https://bulbagarden.net/threads/example.2/",
    source: "Bulbagarden",
    date: "2026-10-02",
    kind: "news",
    sentence: "The Pokémon Company has announced a merch collection for shops in Japan.",
  };
  applyTitleLanguage(fan, {});
  t("an English fan headline is not tagged as Japan", !fan.region && !fan.titleEn);
  const zh = {
    title: "宝可梦新系列公开",
    url: "https://example.com/news/cn",
    date: "2026-10-02",
    kind: "news",
    sentence: "A Chinese page announced a new series.",
  };
  applyTitleLanguage(zh, {});
  t("an untranslated Chinese title stays out of the public mix", zh.language === "zh" && zh.note === "Translation is missing." && isPublicNewsCandidate(zh) === false);

  for (const rel of ["research/digests/news.json", "research/digests/weekly-news.json"]) {
    let doc;
    try { doc = JSON.parse(await readFile(join(ROOT, rel), "utf8")); }
    catch (err) { t(`${rel} readable`, false); continue; }
    const groups = rel.endsWith("news.json") && !rel.endsWith("weekly-news.json")
      ? [doc.items, doc.filters?.news?.items]
      : [doc.items];
    let bare = 0;
    for (const group of groups) {
      if (!Array.isArray(group)) { bare += 1; continue; }
      for (const row of group) if (!hasSourceUrl(row)) bare += 1;
    }
    t(`${rel} items all have a source URL`, bare === 0);
    if (rel.endsWith("research/digests/news.json")) {
      t("news.json keeps the longer catalog", Array.isArray(doc.catalog) && doc.catalog.length > doc.items.length);
      let bareCatalog = 0;
      for (const row of doc.catalog || []) if (!hasSourceUrl(row)) bareCatalog += 1;
      t("catalog items all have a source URL", bareCatalog === 0);
      const kana = /[぀-ヿ]/;
      const publicUrls = new Set((doc.items || []).map((row) => row.url));
      let japan = 0;
      let english = 0;
      let held = 0;
      let badPublic = 0;
      let asiaTagged = 0;
      for (const row of doc.catalog || []) {
        let host = "";
        try { host = new URL(row.url).hostname.toLowerCase(); } catch { host = ""; }
        if (host === "asia.pokemon-card.com" && (row.region === "jp" || row.language === "ja")) asiaTagged += 1;
        if (row.region !== "jp" && !kana.test(row.title || "")) continue;
        if (kana.test(row.title || "") || row.region === "jp") japan += 1;
        if (row.titleEn) english += 1;
        else held += 1;
        if (!row.titleEn && (!(row.note || "").includes("Translation is missing.") || publicUrls.has(row.url))) badPublic += 1;
        if (row.titleEn && !String(row.titleEn).startsWith("Japan:")) badPublic += 1;
        if (kana.test(row.title || "") && row.titleEn && row.title !== row.originalTitle && kana.test(row.titleEn)) badPublic += 1;
      }
      for (const row of doc.items || []) {
        if (row.region === "jp" && (!String(row.title).startsWith("Japan:") || kana.test(row.title || "") || !kana.test(row.originalTitle || ""))) badPublic += 1;
      }
      t("Japan catalog titles keep Japanese and an English title or a missing note", japan > 0 && held + english === japan && badPublic === 0 && asiaTagged === 0);
      const tagged = (doc.catalog || []).filter((row) => Array.isArray(row.fileTags) && row.fileTags.length);
      const allowed = new Set(["TCG", "video game", "Japan", "product wave", "reprint"]);
      let badTag = 0;
      for (const row of doc.catalog || []) {
        for (const tag of row.fileTags || []) if (!allowed.has(tag)) badTag += 1;
        if ((row.fileTags || []).includes("TCG") && !(row.tags || []).some((tag) => tag === "cards" || tag === "sealed")) badTag += 1;
        if ((row.fileTags || []).includes("video game") && !(row.tags || []).includes("video-games")) badTag += 1;
        if ((row.fileTags || []).includes("Japan") && row.region !== "jp" && row.language !== "ja" && !/^japan/i.test(row.region || "")) badTag += 1;
        if ((row.fileTags || []).includes("product wave") && !row.wave) badTag += 1;
        if ((row.fileTags || []).includes("reprint") && !row.reprint) badTag += 1;
      }
      t("file tags come from fields already on the item", tagged.length > 0 && badTag === 0);
      t("the release calendar keeps only specific source days", Array.isArray(doc.releaseCalendar) && doc.releaseCalendar.length > 0 && doc.releaseCalendar.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.setDate && row.url));
      const phrase = /\b(stored|last print|printed|took a bigger last step)\b/i;
      let phraseFail = 0;
      for (const row of [...(doc.items || []), ...(doc.videoGames || []), ...(doc.releaseCalendar || [])]) {
        for (const field of ["title", "sentence", "setDate", "reprint"]) {
          if (phrase.test(row?.[field] || "")) phraseFail += 1;
        }
      }
      t("the news read has no banned phrase", phraseFail === 0);
    }
    if (rel.endsWith("weekly-news.json")) {
      const older = (doc.items || []).filter((row) => row.date < shiftDay(doc.asOf, -14));
      t("weekly keeps price movers and only qualified older items", Boolean(doc.priceMovers) && older.every((row) => sourceAllowsOlderWeekly([row.title, row.sentence, row.setDate].filter(Boolean).join(" "), doc.asOf)));
    }
  }
  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("news.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
