// Regression for the Nov 11 reads check: a chase list line that showed one
// printing's price with another printing's number, image and link; a chase
// total called "tonight" with a jumpy card at an older print; a headline and
// chip on different windows (Meganium ex); and a slump read that led with a
// year gain while the card fell (Charizard, Stormfront).
import { readFileSync } from "node:fs";
import { stampRead, baseName } from "../lib/card-face-stamp.mjs";
import { chaseLists } from "../lib/deep-reads-2.mjs";
import { findings, compose, alignToWindow, validSynth, findingDir } from "../lib/read-synthesis.mjs";
import { addDays } from "../lib/history-reads.mjs";

const CFG = validSynth(JSON.parse(readFileSync(new URL("./fixtures/read-synthesis-limits.json", import.meta.url), "utf8")));

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  // 1) Plasma Freeze: Latios EX 113/116 (Full Art) must keep its own number and card.
  t("base name drops the number tag", baseName("Latios EX (113 Full Art)") === "Latios EX" && baseName("Garchomp (120 Secret Rare)") === "Garchomp" && baseName("Deoxys EX (Team Plasma) (Full Art)") === "Deoxys EX (Team Plasma) (Full Art)");
  const mk = (id, name, number, rarity) => {
    const clean = name;
    const card = { id, name, clean, number, set: "Plasma Freeze", setShort: "Plasma Freeze", rarity };
    const base = baseName(clean);
    if (base !== clean) card.base = base;
    return card;
  };
  const pf = [
    mk("tcgcsv-86674", "Latios EX", "86/116", "Ultra Rare"),
    mk("tcgcsv-86676", "Latios EX (113 Full Art)", "113/116", "Ultra Rare"),
    mk("tcgcsv-85626", "Garchomp (120 Secret Rare)", "120/116", "Secret Rare"),
  ];
  const index = { byId: new Map(pf.map((c) => [c.id, c])), bySet: new Map([["plasma freeze", pf]]), bySpecies: new Map(), byArtist: new Map() };
  const latiosLine = "Latios EX (Plasma Freeze) 113/116, Ultra Rare: $327.50 (was $219.57 on Nov 11, 2025).";
  const garchompLine = "Garchomp (Plasma Freeze) 120/116, Secret Rare: $468.00 on Oct 20.";
  const plainLine = "Latios EX (Plasma Freeze), Ultra Rare: $27.98.";
  const read = stampRead({ id: "deep-chase-plasma-freeze", readKind: "deep", deep: "chase", name: "Plasma Freeze", headline: "Plasma Freeze chase list.", lines: [latiosLine, garchompLine, plainLine], asOf: "2026-11-11" }, index, { images: {}, tcgOn: false, sealedPid: new Map() });
  t("a written 113/116 is not given a second number", read.lines[0] === latiosLine && !read.lines[0].includes("86/116"));
  t("the 113/116 line links the Full Art card", read.lineCards?.[0]?.cards?.length === 1 && read.lineCards[0].cards[0].id === "tcgcsv-86676");
  t("Garchomp 120/116 finds its own card by base name and number", read.lineCards?.[1]?.cards?.[0]?.id === "tcgcsv-85626" && read.lines[1] === garchompLine);
  t("a name with no number still means the plain printing", read.lineCards?.[2]?.cards?.[0]?.id === "tcgcsv-86674" && read.lines[2].includes("86/116"));

  // Chase total with a jumpy card is not called "tonight".
  const asOf = "2026-11-11";
  const days = [];
  for (let k = 40; k >= 0; k -= 1) days.push(addDays(asOf, -k));
  const flat = (id, name, num, price) => ({ id, name, number: num, set: "Plasma Freeze", setSlug: "plasma-freeze", rarity: "Secret Rare", pts: days.map((d) => [d, price]) });
  const step = addDays(asOf, -21);
  const garchomp = { ...flat("tcgcsv-85626", "Garchomp (120 Secret Rare)", "120/116", 468), pts: days.map((d) => [d, d >= step ? 900 : 468]) };
  const cards = [flat("tcgcsv-90135", "Ultra Ball", "122/116", 1199.51), flat("tcgcsv-84777", "Deoxys EX (Team Plasma) (Full Art)", "111/116", 836.52), garchomp, flat("tcgcsv-86676", "Latios EX (113 Full Art)", "113/116", 327.5), flat("tcgcsv-1", "Garbodor (119 Secret Rare)", "119/116", 278.79)];
  const jumpy = { windowDays: 30, swingPct: 80, minSwings: 2 };
  const [chase] = chaseLists(cards, () => [], { asOf, jumpy });
  t("chase list quotes the jumpy card at its dated steady print", chase && chase.lines.some((l) => l.startsWith("Garchomp") && l.includes("$468.00 on Oct 20")));
  t("a chase total with a dated price does not say tonight", chase && !/tonight/.test(chase.headline) && /one card at an earlier steady price/.test(chase.headline));
  const [calm] = chaseLists(cards, () => [], { asOf });
  t("a chase total with every price from tonight still says tonight", calm && /together tonight\.$/.test(calm.headline));

  // 2) Meganium ex 106/115: headline window and chip window come from the lead.
  const meg = [["2026-10-05", 275.26], ["2026-10-12", 275.26], ["2026-10-14", 200.52], ["2026-10-21", 200.52], ["2026-10-31", 200.52], ["2026-11-06", 200.52], ["2026-11-07", 200.52], ["2026-11-10", 117.26], ["2026-11-11", 124.77]];
  const megPts = [["2024-02-08", 120], ["2025-06-29", 180], ...meg];
  const megItem = { id: "tcgcsv-87298", pts: megPts, title: "Meganium ex (EX Unseen Forces) 106/115", asOf, set: "EX Unseen Forces", setSlug: "", release: "2005-08-22", sealed: false, kind: "backto", kindLine: "" };
  const megF = findings(megItem, { peers: new Map() }, CFG);
  const megLead = compose(megItem, megF, CFG, null)?.lead;
  const megWin = Number(megLead?.window);
  const aligned = alignToWindow({ id: "backto-tcgcsv-87298", asOf, blurb: "TCGplayer market is down 38% over 21 days, as of Nov 11.", signals: [{ kind: "move", dir: "down", text: "38% 21D", label: "Price down 38 percent over 21 days", strength: 5 }, { kind: "era", tag: "Classic", label: "Classic", strength: 1 }] }, megWin, megLead);
  const move = aligned.signals.find((c) => c.kind === "move");
  t("a 21D chip does not sit under a different headline window", megWin > 0 && !aligned.signals.some((c) => /21D/.test(c.text || "")));
  t("the move chip is rebuilt from the lead window", move && move.text === `${Math.round(Math.abs(megLead.nums.lead.pct))}% ${megWin}D` && move.dir === "down");
  t("the blurb names the lead window", aligned.blurb === `TCGplayer market is down ${move?.text.split(" ")[0]} over ${megWin} days, as of Nov 11.`);
  t("chip percent matches the headline percent", megLead.text.startsWith(`Down ${move?.text.split(" ")[0]}`));
  t("other chips stay", aligned.signals.some((c) => c.kind === "era"));

  // 3) Charizard 103/100 (Stormfront): a slump read never leads with a year gain.
  const zard = [["2025-11-13", 257.77], ["2025-12-04", 257.77], ["2026-01-08", 257.26], ["2026-02-12", 257.26], ["2026-02-19", 700], ["2026-03-12", 600], ["2026-04-22", 658.33], ["2026-08-01", 668.75], ["2026-08-13", 664.17], ["2026-09-04", 737.5], ["2026-09-26", 737.5], ["2026-10-12", 737.5], ["2026-10-19", 737.5], ["2026-10-21", 699.99], ["2026-10-30", 699.99], ["2026-10-31", 552.78], ["2026-11-06", 552.78], ["2026-11-10", 552.78], ["2026-11-11", 537.33]];
  const zardItem = { id: "tcgcsv-84190", pts: [["2024-02-08", 250], ...zard], title: "Charizard (Stormfront) 103/100", asOf, set: "Stormfront", setSlug: "", release: "2008-11-05", sealed: false, kind: "deep:slump", kindLine: "Slump watch: Charizard (Stormfront) 103/100, Rare Holo, is 27% under its Sep 4 high." };
  const zardF = findings(zardItem, { peers: new Map() }, CFG);
  t("the year gain is a real finding", zardF.some((f) => f.type === "trend365up"));
  const zardGot = compose(zardItem, zardF, CFG, null);
  t("a slump read does not lead with a gain", zardGot && findingDir(zardGot.lead) !== 1 && !/^Up /.test(zardGot.text));
  // Same card as a plain read: the year gain cannot lead against a fresh 30 day fall.
  const plain = compose({ ...zardItem, kind: "year", kindLine: "" }, zardF, CFG, null);
  const fell = zardF.some((f) => f.type === "trend30down");
  t("a year gain does not lead over a 30 day fall", plain && (!fell || !/^Up /.test(plain.text)));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("reads-check-nov11.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("reads check nov11 ok");
}
