import { readFileSync } from "node:fs";
import { buildOutbox, dueOn, fetchFollows, memberMatch, poolFromData, previewLines, putOutbox } from "../lib/custom-reads-pipe.mjs";
import { isClean } from "../lib/copy-rules.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const catalogue = { asOf: "2026-10-18", sets: [{ slug: "me-30th-celebration", name: "ME: 30th Celebration", released: true, prices: [{ id: "tcgcsv-1", number: "001/100", price: 12.5 }, { id: "tcgcsv-2", number: "002/100", price: 3 }] }] };
  const sealed = { updatedAt: "2026-10-18T13:00:00Z", products: [{ id: "x-etb", name: "30th Celebration Elite Trainer Box", set: "30th Celebration", tcgPlayerId: "77", dataStatus: "live", askMedian: 80, listingCount: 40 }] };
  const pool = poolFromData({ catalogue, sealed });
  t("pool has a set line, card lines and a sealed line", pool.reads.some((r) => r.kind === "single") && pool.reads.filter((r) => r.kind === "card").length === 2 && pool.reads.some((r) => r.kind === "sealed" && r.set === "me-30th-celebration"));
  t("sealed lines say listings counted and never NM", pool.reads.filter((r) => r.kind === "sealed").every((r) => r.line.includes("listings counted") && !/\bNM\b/.test(r.line) && !/\bsold\b|\bsales\b/i.test(r.line)));
  t("every pool line is clean and has no dashes", pool.reads.every((r) => isClean(r.line) && !/[\u2013\u2014]/.test(r.line)));
  const follow = { id: "123456789012345678", discordId: "123456789012345678", sets: ["me-30th-celebration"], cards: [], sealed: [], kinds: ["single"], frequency: "weekly" };
  t("a set follow gets its set line, not every card", pool.reads.filter((r) => memberMatch(follow, r)).length === 1);
  t("a kind alone does not match the whole catalogue", pool.reads.filter((r) => memberMatch({ kinds: ["single"] }, r)).length === 0);
  t("a watched card matches", pool.reads.some((r) => memberMatch({ cards: ["tcgcsv-1"] }, r) && r.cardId === "tcgcsv-1"));
  t("a watched sealed product matches", pool.reads.some((r) => memberMatch({ sealed: ["tcgcsv-77"] }, r) && r.kind === "sealed"));
  const sunday = "2026-10-18";
  const now = Date.parse("2026-10-18T04:00:00Z");
  t("weekly lands on Sunday", dueOn(follow, sunday, now) && !dueOn(follow, "2026-10-19", now));
  t("a fresh Save gets a first read the next night", dueOn({ ...follow, savedAt: "2026-10-19T17:00:00Z" }, "2026-10-20", Date.parse("2026-10-20T04:00:00Z")));
  t("monthly and quarterly land on day one", dueOn({ frequency: "monthly" }, "2026-11-01", now) && !dueOn({ frequency: "quarterly" }, "2026-11-01", now) && dueOn({ frequency: "quarterly" }, "2026-10-01", now));
  const out = buildOutbox({ follows: [follow, { id: "bad" }, { ...follow, id: "222222222222", discordId: "222222222222", sets: ["nope"] }], pool, now });
  t("outbox holds one DM per due member with reads", out.members.length === 1 && out.members[0].discordId === "123456789012345678" && out.members[0].reads.length === 1 && out.counts.quiet === 1);
  t("outbox lead is clean", isClean(out.members[0].lead) && !/[\u2013\u2014]/.test(out.members[0].lead));
  let seen = null;
  const fake = async (url, init = {}) => { seen = { url: String(url), init }; return new Response(JSON.stringify(init.method === "PUT" ? { ok: true, members: 1 } : { ok: true, follows: [follow] }), { status: 200 }); };
  const got = await fetchFollows({ base: "https://catchemtcg.com", token: "secret-token", fetchImpl: fake });
  t("follows come from the export endpoint with a bearer", got.length === 1 && seen.url.endsWith("/api/reads/export") && seen.init.headers.authorization === "Bearer secret-token");
  await putOutbox({ base: "https://catchemtcg.com", token: "secret-token", outbox: out, fetchImpl: fake });
  t("the outbox goes back with PUT and no counts", seen.init.method === "PUT" && !JSON.parse(seen.init.body).counts);
  const script = readFileSync(new URL("../build-custom-reads-members.mjs", import.meta.url), "utf8");
  t("the member script never logs the token or writes member files", !/console\.log\([^)]*token/.test(script) && !script.includes("writeFile"));
  const wf = readFileSync(new URL("../../.github/workflows/update-sealed-prices.yml", import.meta.url), "utf8");
  t("the nightly runs the member step with the secret", wf.includes("node scripts/build-custom-reads-members.mjs") && wf.includes("secrets.CUSTOM_READS_TOKEN"));

  const named = poolFromData({
    catalogue: {
      asOf: "2026-10-18",
      sets: [
        {
          slug: "sv-prismatic-evolutions",
          name: "SV: Prismatic Evolutions",
          era: "Scarlet & Violet",
          released: true,
          prices: [
            { id: "tcgcsv-9001", number: "161/131", price: 1250.07, name: "Umbreon ex - 161/131", rarity: "Special Illustration Rare", printing: "Holofoil" },
            { id: "tcgcsv-9002", number: "004/131", price: 2, name: "Pikachu", rarity: "Common", printing: "Normal" },
            { id: "tcgcsv-9003", number: "170/131", price: 40, name: "Amarys - 170/131", rarity: "Ultra Rare", printing: "Holofoil" },
          ],
        },
        {
          slug: "swsh07-evolving-skies",
          name: "SWSH07: Evolving Skies",
          era: "Sword & Shield",
          released: true,
          prices: [
            { id: "tcgcsv-9004", number: "215/203", price: 80, name: "Umbreon VMAX - 215/203", rarity: "Rare Holo", printing: "Holofoil" },
          ],
        },
      ],
    },
    sealed: {
      updatedAt: "2026-10-18T13:00:00Z",
      products: [
        { id: "fake-etb", name: "Prismatic Evolutions Elite Trainer Box", set: "Prismatic Evolutions", tcgPlayerId: "90077", dataStatus: "live", askMedian: 90, listingCount: 12 },
      ],
    },
  });
  const umbreon = named.reads.find((row) => row.cardId === "tcgcsv-9001");
  t("a card line names the card, the number, and the set", umbreon && umbreon.line.startsWith("Umbreon ex 161/131, Prismatic Evolutions is ") && umbreon.art === "Special Illustration Rare");
  t("pokemon matches that card and not a different one", memberMatch({ pokemon: ["Umbreon"], kinds: ["single"] }, umbreon) === true && memberMatch({ pokemon: ["Eevee"], kinds: ["single"] }, umbreon) === false);
  t("a rarity pick uses the art type", named.reads.filter((row) => memberMatch({ rarities: ["Special Illustration Rare"], kinds: ["single"] }, row)).every((row) => row.art === "Special Illustration Rare") && named.reads.some((row) => memberMatch({ rarities: ["Special Illustration Rare"], kinds: ["single"] }, row)));
  t("ultra rare matches the printed rarity when the art type is full art", named.reads.some((row) => row.cardId === "tcgcsv-9003" && row.art === "Full Art" && memberMatch({ rarities: ["Ultra Rare"], kinds: ["single"] }, row)));
  t("an era pick matches the set line and not another era", named.reads.some((row) => row.kind === "single" && row.set === "sv-prismatic-evolutions" && memberMatch({ eras: ["Scarlet and Violet"], kinds: ["single"] }, row)) && !named.reads.some((row) => row.set === "swsh07-evolving-skies" && memberMatch({ eras: ["Scarlet and Violet"], kinds: ["single"] }, row)));
  t("a set follow still skips the card lines", named.reads.filter((row) => memberMatch({ sets: ["sv-prismatic-evolutions"], kinds: ["single"] }, row)).length === 1);
  const fakeId = "900000000000000101";
  const picks = [
    { discordId: fakeId, pokemon: ["Umbreon"], kinds: ["single"], frequency: "daily" },
    { discordId: "900000000000000102", rarities: ["Special Illustration Rare"], kinds: ["single"], frequency: "daily" },
    { discordId: "900000000000000103", eras: ["Scarlet and Violet"], kinds: ["single"], frequency: "daily" },
    { discordId: "900000000000000104", sets: ["sv-prismatic-evolutions"], kinds: ["single"], frequency: "daily" },
    { discordId: "900000000000000105", cards: ["tcgcsv-9002"], kinds: ["single"], frequency: "daily" },
    { discordId: "900000000000000106", sealed: ["tcgcsv-90077"], kinds: ["sealed"], frequency: "daily" },
    { discordId: "900000000000000107", news: true, frequency: "daily" },
    { discordId: "900000000000000108", frequency: "daily" },
  ];
  const news = [{ headline: "Set page dated", line: "The set page names the day.", url: "https://press.pokemon.com/en/example", source: "Pokemon press", date: "2026-10-15" }];
  const boxed = buildOutbox({ follows: picks, pool: named, news, now });
  t("each pick type gets a line and an empty follow stays quiet", boxed.members.length === 7 && boxed.counts.quiet === 1 && boxed.members.every((row) => row.reads.length || row.news));
  const byId = new Map(boxed.members.map((row) => [row.discordId, row]));
  t("pokemon, rarity, era, set, card, and sealed each produce a line", ["900000000000000102", "900000000000000103", "900000000000000104", "900000000000000105", "900000000000000106"].every((id) => byId.get(id)?.reads?.length === 1) && byId.get(fakeId)?.reads?.length === 2);
  t("the pokemon line is the named card", byId.get(fakeId).reads[0].line.includes("Umbreon ex 161/131, Prismatic Evolutions"));
  const dmLines = boxed.members.flatMap((row) => [row.lead, ...row.reads.map((item) => item.line), ...(row.news || []).flatMap((item) => [item.headline, item.line])]);
  t("every generated line passes the advice checker", dmLines.length > 0 && dmLines.every((line) => isClean(line) && !/[\u2013\u2014]/.test(line) && !/\bsold\b|\bsales\b/i.test(line)));
  const umbRow = byId.get(fakeId).reads.find((item) => item.cardId === "tcgcsv-9001");
  t("outbox reads carry the product id and kind for the email, and no member field", umbRow && umbRow.kind === "card" && umbRow.set === "sv-prismatic-evolutions" && !("discordId" in umbRow) && !("email" in umbRow));
  t("the set line row has a set slug and no product id", byId.get("900000000000000104").reads[0].set === "sv-prismatic-evolutions" && !byId.get("900000000000000104").reads[0].cardId);
  const preview = previewLines(named);
  t("preview lines have no member id", !JSON.stringify(preview).includes("discord") && preview.lines["pokemon:Umbreon"].includes("Umbreon ex 161/131, Prismatic Evolutions") && preview.lines["rarity:Special Illustration Rare"].includes("Umbreon ex 161/131"));
  t("the sealed preview is listings counted", preview.lines["product:sealed"].includes("listings counted") && !/\bNM\b/.test(preview.lines["product:sealed"]));
  const shipped = JSON.parse(readFileSync(new URL("../../research/assets/public/reads-preview.json", import.meta.url), "utf8"));
  const shippedLines = Object.values(shipped.lines || {});
  t("the shipped preview is clean, dated, and has no member id", shipped.asOf && shippedLines.length >= 8 && shippedLines.every((line) => isClean(line) && /as of /.test(line) && !/[\u2013\u2014]/.test(line)) && !JSON.stringify(shipped).includes("discord") && String(shipped.lines["rarity:Special Illustration Rare"] || "").includes("Umbreon ex 161/131, Prismatic Evolutions"));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("custom-reads-pipe.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
