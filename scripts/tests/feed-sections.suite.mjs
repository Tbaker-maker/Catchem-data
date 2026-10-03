import { applyImageGaps, applyShelf, assignSections, selectLead, sentenceShape } from "../lib/feed-catalogue.mjs";
import { BAD_DATE, BANNED, FILLER_BAN, directionAgrees, leadFrameLines, pathSentence, phrasePeak, separateHalfCopies, statesBothMoves } from "../lib/public-bundle.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };
  const card = (id, days, pct, sku = "tcgcsv-1") => ({
    id, sku, windowDays: days, changePct: pct, direction: pct < 0 ? "down" : "up", name: id, thin: false, score: Math.abs(pct),
  });
  const cards = {
    a: card("a", 90, 40, "tcgcsv-9"),
    b: card("b", 7, 12, "tcgcsv-7"),
    c: card("c", 7, 3, "tcgcsv-3"),
    d: card("d", 30, 9, "tcgcsv-30"),
  };
  const lists = assignSections(cards);
  const home = ["today", "watch", "cook", "up", "down"].flatMap((key) => lists[key]);
  t("a 90-day read is a cook and not a mover", lists.cook.includes("a") && !lists.up.includes("a") && !lists.down.includes("a"));
  t("a big 7-day move is a mover and not in today", lists.up.includes("b") && !lists.today.includes("b") && !lists.cook.includes("b"));
  t("a small 7-day move stays in today", lists.today.includes("c") && !lists.up.includes("c") && !lists.down.includes("c"));
  t("a 30-day read is a watch", lists.watch.includes("d") && !lists.up.includes("d"));
  t("no read is in two home sections", new Set(home).size === home.length);
  applyShelf(cards, [
    { date: "2026-09-27", sku_id: "tcgcsv-9", listing_count: 19 },
    { date: "2026-09-26", sku_id: "tcgcsv-7", listing_count: 40 },
    { date: "2026-09-27", sku_id: "tcgcsv-7", listing_count: 50 },
  ]);
  t("listings under 20 are left off", cards.a.listings == null);
  t("the newest shelf count of at least 20 is kept", cards.b.listings === 50 && cards.b.listingsAsOf === "2026-09-27");
  const gaps = {
    v: { id: "v", sku: "tcgcsv-642634", set: "SV: Black Bolt", image: "https://tcgplayer-cdn.tcgplayer.com/product/642634_in_400x400.jpg", name: "Victini (Master Ball Pattern)" },
    ok: { id: "ok", sku: "tcgcsv-42346", set: "Base Set", image: "https://tcgplayer-cdn.tcgplayer.com/product/42346_in_400x400.jpg", name: "Charizard" },
  };
  applyImageGaps(gaps, [642634], new Map([["SV: Black Bolt", "https://images.pokemontcg.io/zsv10pt5/logo.png"]]));
  t("a missing product photo is cleared and the set logo is kept", gaps.v.image === "" && gaps.v.logo === "https://images.pokemontcg.io/zsv10pt5/logo.png");
  t("a real product photo is left alone", gaps.ok.image.includes("42346") && !gaps.ok.logo);
  const down = [];
  for (let i = 0; i < 28; i += 1) {
    const day = new Date(Date.parse("2026-09-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    down.push([day, Math.round((10 - i * 0.2) * 100) / 100]);
  }
  const dug = pathSentence(down, { direction: "down", fromDate: "2026-09-01", toDate: "2026-09-28", fromPrice: 10, windowDays: 30 });
  const flat = down.map((p, i) => [p[0], i < 21 ? 8 : p[1]]);
  const first = pathSentence(flat, { direction: "down", fromDate: "2026-09-01", toDate: "2026-09-28", fromPrice: 8, windowDays: 30 });
  const shape = (text) => String(text).replace(/\$[0-9,.]+/g, "$").replace(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/g, "DATE").replace(/\b\d+(?:\.\d+)?\b/g, "n");
  const repeats = (text) => {
    const prices = text.match(/\$[0-9,.]+/g) || [];
    const dates = text.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/g) || [];
    return new Set(prices).size !== prices.length || new Set(dates).size !== dates.length;
  };
  t("a falling series is one sentence and does not restate a percent", !/not the first/.test(dug) && (dug.match(/%/g) || []).length === 1 && !/\. [A-Z]/.test(dug) && dug.endsWith(".") && !/check on /.test(dug) && !/\bstored\b|last print|\bprinted\b/i.test(dug) && /latest price/.test(dug) && !repeats(dug) && !BANNED.test(dug));
  const moved = down.map((p, i) => i === down.length - 1 ? [p[0], Math.round((p[1] - 1) * 100) / 100] : p);
  const again = pathSentence(moved, { direction: "down", fromDate: "2026-09-01", toDate: "2026-09-28", fromPrice: 10, windowDays: 30 });
  t("a real point change changes the sentence", again !== dug && /latest price/.test(again));
  t("a new drop does not use the old week line", !/not the first down week/.test(first) && !/first down week/.test(first) && !/week of lower lows/.test(first) && first.endsWith(".") && !repeats(first));
  t("two paths do not share a sentence shape", shape(dug) !== shape(first));
  t("a missing series says so", pathSentence([], {}) === "A price path is missing." && pathSentence([["2026-09-27", 4]], {}) === "A price path is missing.");
  const leadCards = [
    { id: "s7", sku: "tcgcsv-1", kind: "single", name: "Small", set: "A", thin: false, score: 3, windowDays: 7, changePct: 3, path: "The latest price is $3 on Sep 27, and this 7-day window opened at $2 on Sep 20." },
    { id: "b90", sku: "tcgcsv-1", kind: "single", name: "Big", set: "A", thin: false, score: 40, windowDays: 90, changePct: -40, path: "Lower lows are still printing, and the latest price is $4 on Sep 27." },
    { id: "seal", sku: "tcgcsv-2", kind: "sealed", name: "Box", set: "B", thin: false, score: 12, windowDays: 30, changePct: 12, path: "Box lane started, and the latest price is $90 on Sep 27." },
    { id: "same", sku: "tcgcsv-3", kind: "single", name: "Twin", set: "C", thin: false, score: 11, windowDays: 30, changePct: 11, path: "An up week started, and the latest price is $10 on Sep 20.", _raw: [["2026-09-26", 9], ["2026-09-27", 10]], _pathOpts: { fromPrice: 8, fromDate: "2026-08-28", toDate: "2026-09-27", windowDays: 30 } },
  ];
  const picked = selectLead(leadCards, 24);
  t("the lead keeps the larger window for a product", picked.lead.some((row) => row.id === "b90") && !picked.lead.some((row) => row.id === "s7"));
  t("sealed can sit in the lead", picked.lead.some((row) => row.kind === "sealed"));
  t("a shared shape is rewritten or left out", new Set(picked.lead.map((row) => sentenceShape(row.path))).size === picked.lead.length);
  t("a failed shape is logged with the new line", picked.rewrites.some((row) => row.failed && Object.prototype.hasOwnProperty.call(row, "next")));

  const named = pathSentence(down, { name: "Trubbish", direction: "down", fromDate: "2026-09-01", toDate: "2026-09-28", fromPrice: 10, windowDays: 30 });
  t("the product name is on the line", named.includes("Trubbish") && /latest price/.test(named) && !/stored|last print/i.test(named));
  t("a full series does not mention a missing day", !/missing|no print|gap on/i.test(dug) && !/missing|no print/i.test(named));
  const soldLine = pathSentence(down, { name: "Perfect Order Booster Box", direction: "down", fromDate: "2026-09-01", toDate: "2026-09-28", fromPrice: 10, windowDays: 30, sold: { count: 2717, asOf: "2026-10-02" } });
  t("a sold line is a 3-month TCGplayer product-page count", /3 months/.test(soldLine) && /TCGplayer/.test(soldLine) && /not eBay/.test(soldLine) && /2717/.test(soldLine) && !/listings/.test(soldLine));
  const closer = (text) => String(text).split(",").at(-1).replace(/\$[0-9,.]+/g, "$").replace(/\b\d+(?:\.\d+)?\b/g, "n").trim();
  t("two paths do not share a closer", closer(dug) !== closer(first));
  const half = [];
  for (let i = 0; i < 24; i += 1) {
    const day = new Date(Date.parse("2026-08-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    half.push([day, i === 4 ? 4 : 12]);
  }
  const split = separateHalfCopies(half);
  t("a price 50% under the cluster is dropped", split.dropped.some((pt) => pt[1] === 4) && split.keep.every((pt) => pt[1] !== 4) && split.keep.at(-1)[1] === 12 && !split.ambiguous);
  const ambPts = [];
  for (let i = 0; i < 16; i += 1) {
    const day = new Date(Date.parse("2026-08-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    ambPts.push([day, i < 8 ? 5 : 12]);
  }
  const amb = separateHalfCopies(ambPts);
  t("an even split is not given a cleaned price", amb.ambiguous === true && amb.dropped.length === 0 && amb.keep.length === ambPts.length);
  const syl = ["ba","be","bi","bo","bu","ca","ce","ci","co","cu","da","de","di","do","du","fa","fe","fi","fo","fu","ga","ge","gi","go","gu","ha","he","hi","ho","hu","ka","ke","ki","ko","ku","la","le","li","lo","lu","ma","me","mi","mo","mu","na","ne","ni","no","nu"];
  const token = (n) => {
    let s = "";
    let x = n + 1;
    while (x > 0) { s = syl[(x - 1) % syl.length] + s; x = Math.floor((x - 1) / syl.length); }
    return s;
  };
  const lineFor = (i, name) => `${name} ${token(i * 4)} ${token(i * 4 + 1)} ${token(i * 4 + 2)} ${token(i * 4 + 3)}.`;
  const mix = [];
  let seq = 0;
  const add = (kind, window, pct, set, subtype, name) => {
    mix.push({
      id: `m${seq}`, sku: `tcgcsv-${2000 + seq}`, kind, name, set, subtype, sealedKind: subtype,
      thin: false, score: Math.abs(pct), windowDays: window, changePct: pct, path: lineFor(seq, name),
    });
    seq += 1;
  };
  for (let i = 0; i < 30; i += 1) add("single", 90, 80 - i, `Set${i % 12}`, "", `Single${i}`);
  for (let i = 0; i < 16; i += 1) add("single", 30, 30 - i, `Month${i % 8}`, "", `Month${i}`);
  for (let i = 0; i < 16; i += 1) add("single", 7, 12 - i * 0.1, `Week${i % 8}`, "", `Week${i}`);
  for (const kind of ["box", "etb", "bundle", "pack"]) {
    for (let i = 0; i < 3; i += 1) add("sealed", 30, 4 - i * 0.1, `Seal${kind}${i}`, kind, `${kind}Item${i}`);
  }
  const mixed = selectLead(mix, 24);
  const lead = mixed.lead;
  const windows = {};
  for (const row of lead) windows[row.windowDays] = (windows[row.windowDays] || 0) + 1;
  let run = 1;
  let maxRun = 1;
  for (let i = 1; i < lead.length; i += 1) {
    run = lead[i].kind === lead[i - 1].kind ? run + 1 : 1;
    if (run > maxRun) maxRun = run;
  }
  const sealedKinds = new Set(lead.filter((row) => row.kind === "sealed").map((row) => row.sealedKind || row.subtype));
  t("a fixture with sealed qualifiers does not ship zero sealed", lead.filter((row) => row.kind === "sealed").length >= 6);
  t("one window cannot take every seat when others qualify", Object.values(windows).every((n) => n <= 12) && Object.keys(windows).length > 1);
  t("each qualifying sealed kind is in the lead", ["box", "etb", "bundle", "pack"].every((kind) => sealedKinds.has(kind)));
  t("the lead is not six of one kind in a row", maxRun < 6 && lead.some((row) => row.kind === "single"));
  t("stripped shapes in the mix do not collide", new Set(lead.map((row) => sentenceShape(row.path, row))).size === lead.length);
  t("no 4-word phrase is on more than 2 lines", phrasePeak(lead.map((row) => sentenceShape(row.path, row))).peak <= 2);
  t("7-day products keep reserved seats", (windows[7] || 0) >= 4 && (windows[7] || 0) <= 12);
  const loose = (text, name) => text.split(name).join(" ").replace(/\b\d+(?:\.\d+)?\s*%/g, "PCT").replace(/\s+/g, " ").trim();
  t("a name and percent swap is the same line", loose("Alpha is up 10% today", "Alpha") === loose("Beta is up 12% today", "Beta"));
  const desk = lead.map((row) => row.path);
  const mode = new Map();
  for (const row of lead) {
    const key = loose(row.path, row.name);
    mode.set(key, (mode.get(key) || 0) + 1);
  }
  t("half the lines do not match after name and percent are stripped", [...mode.values()].every((n) => n <= lead.length / 2));
  const ambiguous = { id: "bad", sku: "tcgcsv-9", kind: "single", name: "Bad", set: "Zed", thin: false, score: 400, windowDays: 90, changePct: 400, path: lineFor(90, "Bad"), ambiguousCopy: true };
  const plain = { id: "ok", sku: "tcgcsv-8", kind: "single", name: "Ok", set: "Yew", thin: false, score: 9, windowDays: 7, changePct: 9, path: lineFor(91, "Ok") };
  t("an ambiguous half-price product stays out of the lead", !selectLead([ambiguous, plain], 24).lead.some((row) => row.id === "bad") && selectLead([ambiguous, plain], 24).lead.some((row) => row.id === "ok"));


  t("rose cannot claim a lower latest price", directionAgrees("Oshawott (Master Ball Pattern) rose by a smaller up step, latest price $10.09 dated Sep 29 against $10.46 on Sep 27.") === false);
  t("eased down cannot claim a higher latest price", directionAgrees("Pitch Black Booster Box eased by a smaller down step, latest price $187.75 dated Sep 29 versus $186.21 on Sep 27.") === false);
  t("a smaller down step cannot claim a higher latest price", directionAgrees("Night Stretcher eased by a smaller down step, latest price $1.77 dated Sep 29 versus $1.71 on Sep 27.") === false);
  t("above cannot claim a lower latest price", directionAgrees("Noibat (Master Ball Pattern) rose by a smaller up step, latest price $1.74 dated Sep 29 above $1.83 on Sep 27.") === false);
  t("fell cannot claim a higher latest price", directionAgrees("Destined Rivals Elite Trainer Box fell by a larger down step, latest price $118.37 on Sep 29 off $116.85 from Sep 27.") === false);
  t("a generated line agrees with its two prices", [dug, first, again, named, soldLine].every((line) => directionAgrees(line)));
  const pool = leadFrameLines(down, { name: "Trubbish", direction: "down", fromDate: "2026-09-01", toDate: "2026-09-28", fromPrice: 10, windowDays: 30 });
  t("the frame pool stays under the phrase cap", pool.length >= 1 && pool.length < 24 && phrasePeak(pool.map((line) => sentenceShape(line, { name: "Trubbish", set: "" }))).peak <= 2);
  t("the frame pool does not reuse a stripped shape", new Set(pool.map((line) => sentenceShape(line, { name: "Trubbish", set: "" }))).size === pool.length);
  t("a filler closer is banned", ["in context", "for reference", "as written", "on record", "in view", "at hand", "for now", "on paper", "as shown", "as listed", "in short", "beside", "beyond", "posted", "stamped", "as of", "following", "within", "during"].every((phrase) => FILLER_BAN.test(`The latest price is $1 on Sep 1 ${phrase}.`)));
  const fold = (line, name) => sentenceShape(line, { name }).replace(/\b(rose|fell|eased|above)\b/gi, "DIR");
  const widened = (name, rel) => `The newest move widened against its previous move on ${name}, latest price $1.56 posted Sep 29 ${rel} beyond $1.76 posted Sep 27.`;
  const shrunk = (name, rel) => `Last step shrank versus the earlier step for ${name}, where latest price $1.96 stamped Sep 29 ${rel} beside $1.84 stamped Sep 27.`;
  const soldCopy = (name, rel) => `Over 3 months the TCGplayer product page counts 5754 copies sold as of Oct 2 on ${name}, not eBay and not a 7-day count, with latest price $118.37 as of Sep 29 which ${rel} versus $116.85 on Sep 27.`;
  const flatCopy = (name, rel) => `${name} printed one unchanged price across 8 prints through Sep 13, and latest price $12.28 dated Sep 29 ${rel} versus that flat $11.26.`;
  t("rose and fell copies are one shape", fold(widened("Duraludon", "fell"), "Duraludon") === fold(widened("Kieran", "rose"), "Kieran") && fold(shrunk("Snorlax ex", "rose"), "Snorlax ex") === fold(shrunk("Magnezone ex", "fell"), "Magnezone ex") && fold(soldCopy("Destined Rivals Elite Trainer Box", "rose"), "Destined Rivals Elite Trainer Box") === fold(soldCopy("Destined Rivals Booster Box", "fell"), "Destined Rivals Booster Box") && fold(flatCopy("Rebel Clash Booster Pack", "rose"), "Rebel Clash Booster Pack") === fold(flatCopy("Scarlet and Violet Booster Bundle", "fell"), "Scarlet and Violet Booster Bundle"));
  t("the paired frames are rejected", [widened("Duraludon", "fell"), shrunk("Snorlax ex", "rose"), soldCopy("Destined Rivals Elite Trainer Box", "rose")].every((line) => FILLER_BAN.test(line)) && /unchanged price across/.test(flatCopy("Rebel Clash Booster Pack", "rose")));
  const etb = [["2026-07-01", 184.65], ["2026-09-27", 116.85], ["2026-09-29", 118.37]];
  const etbLine = pathSentence(etb, { name: "Destined Rivals Elite Trainer Box", fromDate: "2026-07-01", toDate: "2026-09-29", fromPrice: 184.65, windowDays: 90 });
  const uptick = "The latest price is $118.37 on Sep 29, rose from $116.85 on Sep 27.";
  t("a sign split states both moves", statesBothMoves(etbLine) && etbLine.includes("$118.37") && etbLine.includes("$116.85") && etbLine.includes("$184.65") && /minus 35\.9%/.test(etbLine) && /\brose\b/.test(etbLine) && /\bfell\b/.test(etbLine) && /Sep 27/.test(etbLine) && /Sep 29/.test(etbLine) && /Jul 1/.test(etbLine));
  t("an uptick alone is not both moves", statesBothMoves(uptick) === false);
  t("generated sentences do not use a filler closer", [dug, first, again, named, soldLine, etbLine, ...pool].every((line) => !FILLER_BAN.test(line) && !/newest move widened|step shrank versus|unchanged price across|\bas of\b/i.test(line)));
  const prose = [];
  const addProse = (kind, window, pct, subtype) => {
    const raw = [];
    const start = 30 + prose.length;
    const step = pct >= 0 ? 0.17 : -0.13;
    for (let i = 0; i < 40; i += 1) {
      const day = new Date(Date.parse("2026-08-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
      raw.push([day, Math.round((start + i * step) * 100) / 100]);
    }
    const from = raw[Math.max(0, raw.length - Math.min(window, raw.length - 1) - 1)];
    prose.push({
      id: `p${prose.length}`, sku: `tcgcsv-${8000 + prose.length}`, kind, subtype, sealedKind: subtype,
      name: `Samplecard${prose.length}`, set: `Lane${prose.length}`, thin: false, score: Math.abs(pct),
      windowDays: window, changePct: pct, path: "", _raw: raw,
      _pathOpts: { fromPrice: from[1], fromDate: from[0], toDate: raw.at(-1)[0], windowDays: window, direction: pct < 0 ? "down" : "up" },
    });
  };
  for (let i = 0; i < 20; i += 1) addProse("single", 90, 40 - i, "");
  for (let i = 0; i < 16; i += 1) addProse("single", 30, 22 - i, "");
  for (let i = 0; i < 10; i += 1) addProse("single", 7, 9 - i * 0.2, "");
  for (const kind of ["box", "etb", "bundle", "pack"]) {
    for (let i = 0; i < 3; i += 1) addProse("sealed", 30, 7 - i, kind);
  }
  const proseLead = selectLead(prose, 24).lead;
  t("generated lines match their two prices", proseLead.length >= 1 && proseLead.length <= 24 && proseLead.every((row) => directionAgrees(row.path) && /latest price/.test(row.path) && !/\bstored\b|last print/i.test(row.path) && !FILLER_BAN.test(row.path) && row.secondFact));
  t("generated lines keep the phrase cap", phrasePeak(proseLead.map((row) => sentenceShape(row.path, row))).peak <= 2);
  t("generated lines do not share a stripped shape", new Set(proseLead.map((row) => sentenceShape(row.path, row).replace(/,?\s*while the n-day window\b.*/i, "").replace(/\b(rose|fell|eased|above|higher|lower|highs|lows|high|low)\b/gi, " "))).size === proseLead.length);
  t("a plain climb is not padded out to 24", proseLead.length < 24);
  t("a date is not at Sep or dated Sep on Sep", [dug, first, again, named, soldLine, etbLine, ...pool, ...proseLead.map((row) => row.path)].every((line) => !BAD_DATE.test(line)));
  t("a lead does not say bigger last step or printed on", [dug, first, again, named, soldLine, etbLine, ...pool, ...proseLead.map((row) => row.path)].every((line) => !/bigger last step|printed on/i.test(line)));

  const leadBan = /bigger last step|moved less on the latest step|printed on|\bprinted\b|\bstored\b|last print|model price|\bexpected\b/i;
  const shipped = [dug, first, again, named, soldLine, etbLine, ...pool, ...proseLead.map((row) => row.path)];
  t("a lead does not use a banned step phrase", shipped.every((line) => !leadBan.test(line)));
  t("a read names two prices and one percent", [named, soldLine].every((line) => (line.match(/\$[0-9,.]+/g) || []).length === 2 && (line.match(/%/g) || []).length === 1 && /latest price/.test(line)));

  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("feed-sections.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("feed sections ok");
}
