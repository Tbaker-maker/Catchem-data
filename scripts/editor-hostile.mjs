#!/usr/bin/env node
// HOSTILE EDITOR — load the generated page the way a stranger does, then try
// to break it. A guard that only asks the questions we already know pass is
// how "both Fire type" shipped. This file is allowed to be rude.
import { readFile } from "node:fs/promises";

const html = await readFile("research/assets/build.html", "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("✗ no script in build.html"); process.exit(1); }
const js = m[1];

const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(x => x[1]));
const tagFor = {};
for (const x of html.matchAll(/<(input|textarea|button|select|div|img|pre)[^>]*id="([a-zA-Z0-9_-]+)"/gi))
  tagFor[x[2]] = x[1].toUpperCase();
const nodes = {};
const mk = id => nodes[id] = nodes[id] || {
  id, tagName: tagFor[id] || "DIV", innerHTML: "", value: "", textContent: "", hidden: false, style: {},
  dataset: {}, className: "", classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
  querySelectorAll: () => [], querySelector: () => null, addEventListener() {},
  onclick: null, scrollIntoView() {}, appendChild() {}, setAttribute() {},
  getContext: () => ({ fillRect() {}, drawImage() {}, fillText() {}, measureText: () => ({ width: 0 }) }),
  toBlob: (cb) => cb && cb(null),
};
globalThis.document = {
  getElementById: id => present.has(id) ? mk(id) : null,
  querySelectorAll: () => [],
  querySelector: () => ({ querySelectorAll: () => [], addEventListener() {}, onclick: null, classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } } }),
  createElement: () => ({
    style: {}, className: "", textContent: "", width: 0, height: 0,
    setAttribute() {}, appendChild() {}, click() {},
    getContext: () => ({ fillRect() {}, drawImage() {}, fillText() {}, measureText: () => ({ width: 0 }), save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {}, font: "", fillStyle: "", textAlign: "", globalAlpha: 1 }),
    get outerHTML() { return ""; }
  }),
  createTextNode: () => ({}),
  addEventListener() {},
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async () => {} } }, configurable: true });
globalThis.Image = function () { this.onload = null; this.onerror = null; this.width = 1; this.height = 1; };
globalThis.URL = { createObjectURL: () => "blob:hostile", revokeObjectURL() {} };
globalThis.AbortSignal = { timeout: () => null };
globalThis.fetch = async () => { throw new TypeError("offline"); };

const paperRows = JSON.parse(await readFile("research/assets/paper-rows.json", "utf8"));
const pocketRows = JSON.parse(await readFile("research/assets/pocket-rows.json", "utf8"));
globalThis.__PAPER_ROWS = paperRows;
globalThis.__POCKET_ROWS = pocketRows;

let api;
try {
  api = new Function(js + ";return { runAsk, tray:()=>tray, lineOptions, layoutForTray, connectingGroupOf, anotherSet, backSet, parseIntent, evoLineFor, INDEX, POCKET_INDEX, MOVIE_INDEX, CONSOLE_INDEX, CART_INDEX, CONNECTING, LAYOUTS, add, remove, parseCta, pickShowYours, answerCta, officeCount:()=>officeCount, applyCount, fCount:()=>fCount, fillLineFromCards, pickCaption, applyGame, setGame, pocketShowcase, movieShowcase, imgSmall, imgFallback, pocketImgList, hydrateIndexes, visualDetail, visualBits, visualHome, wikiSrc, wikiSrcList, isVisual, kindLabel, currentGame };")();
} catch (e) {
  console.error("✗ page JS does not parse:", e.message);
  process.exit(1);
}

const fail = [];
const ok = [];
function check(name, cond, detail) {
  if (cond) ok.push(name);
  else fail.push(name + (detail ? " — " + detail : ""));
}

await new Promise(r => setTimeout(r, 40));

// 1. Duplicate-binding / merge crash. This is the one that just ate three guards.
try {
  const lines = api.lineOptions(api.INDEX.slice(0, 2), null, 0);
  check("lineOptions on 2 cards", Array.isArray(lines) && lines.length > 0, "empty");
} catch (e) {
  check("lineOptions on 2 cards", false, e.message);
}

for (const n of [1, 3, 4, 6, 8, 9]) {
  try {
    const lines = api.lineOptions(api.INDEX.slice(0, n), null, 0);
    const two = (lines || []).some(o => /\bthese two\b/.test(o.text) && n !== 2);
    check("count-noun at " + n, Array.isArray(lines) && !two, two ? "said these two over " + n : "");
  } catch (e) {
    check("count-noun at " + n, false, e.message);
  }
}

function namesOf() { return (api.tray() || []).map(c => c.n); }
function idsOf() { return (api.tray() || []).map(c => c.i); }

function ask(q) {
  api.runAsk(q);
  return api.tray() || [];
}

// 2. Evolution is a family, never Evolution Incense, never three of the last stage.
for (const [q, family] of [
  ["squirtle evolution", ["Squirtle", "Wartortle", "Blastoise"]],
  ["charmander evolution", ["Charmander", "Charmeleon", "Charizard"]],
  ["blastoise evolution", ["Squirtle", "Wartortle", "Blastoise"]],
  ["pichu evolution", ["Pichu", "Pikachu", "Raichu"]],
]) {
  const t = ask(q);
  const mons = [...new Set(t.map(c => (c.n || "").replace(/[- ].*$/, "").replace(/ex$/i, "")))];
  // loose: each stage name appears as a prefix of some card
  const hit = family.filter(st => t.some(c => (c.n === st) || c.n.startsWith(st)));
  const incense = t.some(c => /incense/i.test(c.n));
  check(q, t.length >= 2 && hit.length >= 2 && !incense,
    "got " + t.map(c => c.n).join(", ") + " (stages " + hit.length + "/" + family.length + ")");
}

// 3. Connecting art: a complete group, not letter-matches on "art".
const beasts = ask("entei raikou suicune");
check("named beasts pin Entei | Raikou | Suicune",
  (beasts || []).map(c => c.i).join(",") === "neo3-6,neo3-13,neo3-14",
  "got " + (beasts || []).map(c => (c.n || "") + " " + c.i).join(", "));
const birds = ask("the birds");
check("the birds pin Moltres | Zapdos | Articuno",
  (birds || []).map(c => c.i).join(",") === "basep-21,basep-23,basep-22",
  "got " + (birds || []).map(c => (c.n || "") + " " + c.i).join(", "));
check("Aoki birds are 2000, not the Wizards promo set-start 1999",
  (birds || []).every(c => c.y === "2000"),
  (birds || []).map(c => c.i + " " + c.y).join(", "));
check("the birds cards print Aoki",
  (birds || []).every(c => /Aoki/i.test(c.a || "")),
  (birds || []).map(c => c.n + " " + c.a).join(", "));
try { api.fillLineFromCards(true); } catch (e) { check("birds fillLine", false, e.message); }
const birdLab = (document.getElementById("label") || {}).value || "";
check("3-card caption names all three birds",
  /Moltres/.test(birdLab) && /Zapdos/.test(birdLab) && /Articuno/.test(birdLab),
  JSON.stringify(birdLab));
check("3-card caption keeps line breaks", /\n/.test(birdLab), JSON.stringify(birdLab));
check("3-card caption is not first-or-last", !/Moltres or Articuno/i.test(birdLab), JSON.stringify(birdLab));
check("label is a textarea so line breaks survive",
  document.getElementById("label") && document.getElementById("label").tagName === "TEXTAREA",
  document.getElementById("label") && document.getElementById("label").tagName);
const three = ask("three cards one painting");
check("three cards one painting is 3 cards", (three || []).length === 3, "got " + (three || []).length);
check("three cards is not always the beasts", (three || []).map(c => c.i).join(",") !== "neo3-6,neo3-13,neo3-14");
const evoe = ask("eeveelutions");
check("eeveelutions is 9", (evoe || []).length === 9, "got " + (evoe || []).length + " " + (evoe || []).map(c => c.n).join(", "));
const evoSets = [...new Set((evoe || []).map(c => c.s))];
const evoR = [...new Set((evoe || []).map(c => c.r))];
check("eeveelutions stay in one visual family",
  evoSets.length === 1 || (evoR.length === 1 && /Rainbow|Illustration/i.test(evoR[0] || "")),
  "sets=" + evoSets.join(" | ") + " rarities=" + evoR.join(" | "));
const evoNames = (evoe || []).map(c => (c.n || "").split(" ")[0].split("-")[0]);
check("eeveelutions keep line order",
  evoNames[0] === "Eevee" && evoNames[1] === "Vaporeon" && evoNames[8] === "Sylveon",
  evoNames.join(", "));
const conn = ask("connecting art");
check("connecting art returns 2+", conn.length >= 2, "got " + conn.length);
let g = null;
try { g = api.connectingGroupOf(api.tray()); } catch (e) { check("connectingGroupOf()", false, e.message); }
check("connecting art is a real group", !!(g && g.c && g.c.length >= 2), g ? JSON.stringify(g.arr || g.shape) : "no group");
try {
  api.applyCount(3, true);
  check("how-many 3 loads a 3-card picture", api.tray().length === 3, "got " + api.tray().length);
  api.applyCount(4, true);
  check("how-many 4 loads a 4-card picture", api.tray().length === 4, "got " + api.tray().length);
  api.applyCount(6, true);
  check("how-many 6 loads a 6-card picture", api.tray().length === 6, "got " + api.tray().length);
  api.applyCount(9, true);
  check("how-many 9 loads a 9-card picture", api.tray().length === 9, "got " + api.tray().length);
  const nine = api.tray();
  check("9-card picture includes Palossand", nine.some(c => /Palossand/i.test(c.n)), nine.map(c => c.n).join(", "));
  const opts = api.lineOptions(nine, null, 0);
  check("9-card notice names the artist or a card",
    (opts || []).some(o => /HYOGONOSUKE|Palossand|Mime Jr/i.test(o.text)),
    (opts || []).map(o => o.text).slice(0,3).join(" | "));
  try { api.fillLineFromCards(true); } catch (e) { check("fillLineFromCards", false, e.message); }
  const lab = (typeof document !== "undefined" && document.getElementById("label")) ? document.getElementById("label").value : "";
  check("9-card caption names a card or artist",
    nine.some(c => lab.indexOf(c.n) >= 0) || /HYOGONOSUKE/i.test(lab),
    JSON.stringify(lab));
  check("9-card caption is not the count skeleton",
    !/^(two|three|nine) cards/i.test(lab.trim()) && !/^these are three cards/i.test(lab.trim()),
    JSON.stringify(lab));
  api.applyCount(2, true);
} catch (e) { check("how-many cards", false, e.message); }

ask("the fishes");
check("the fishes is Carvanha then Sharpedo",
  api.tray().map(c => c.n).join("|") === "Carvanha|Sharpedo",
  api.tray().map(c => c.n).join("|"));
try { api.fillLineFromCards(true); } catch (e) { check("fishes fillLine", false, e.message); }
const fishLab = (document.getElementById("label") || {}).value || "";
check("fishes caption names Carvanha or Sharpedo", /Carvanha|Sharpedo|Kusajima/i.test(fishLab), fishLab);
check("fishes caption is not two-cards skeleton", !/^two cards/i.test(fishLab.trim()), fishLab);
try {
  const gFish = api.connectingGroupOf(api.tray());
  check("fishes layout is across", !!(gFish && gFish.arr === "across"), JSON.stringify(gFish && gFish.arr));
} catch (e) { check("fishes layout is across", false, e.message); }
ask("the beach");
try { api.applyCount(0, false); } catch (e) {}
ask("ninetales");
check("ninetales is not a 9-card connecting dump",
  api.tray().length === 1 && /ninetales/i.test(api.tray()[0].n),
  api.tray().map(c => c.n + " " + c.i).join(", "));
const nineLab = (document.getElementById("label") || {}).value || "";
check("ninetales caption follows the tray without a second fill",
  /Ninetales/i.test(nineLab) && !/HYOGONOSUKE|Palossand|Mime Jr/i.test(nineLab),
  JSON.stringify(nineLab));
try { api.applyCount(0, false); } catch (e) { check("applyCount Fit", false, e.message); }
const birdsFit = ask("the birds");
check("Fit birds is 3", (birdsFit || []).length === 3, "got " + (birdsFit || []).length);
const nineFit = ask("ninetales");
check("Fit does not keep the previous count",
  (nineFit || []).length === 1 && /ninetales/i.test((nineFit[0] || {}).n || ""),
  (nineFit || []).map(c => c.n).join(", "));
const sup = ask("surprise me");
check("surprise me returns 2 to 9 cards", (sup || []).length >= 2 && (sup || []).length <= 9,
  "got " + (sup || []).length + " " + (sup || []).map(c => c.n).join(", "));
try {
  const gSup = api.connectingGroupOf(api.tray());
  check("surprise me is a connecting picture",
    !!(gSup && gSup.c && gSup.c.length === api.tray().length),
    gSup ? JSON.stringify({ n: gSup.c && gSup.c.length, arr: gSup.arr }) : "no group");
} catch (e) { check("surprise me is a connecting picture", false, e.message); }
ask("asdfqwerzxcv");
check("garbage clears the tray",
  api.tray().length === 0,
  api.tray().map(c => c.n).join(", "));
ask("ninetales");
ask("");
check("empty ask clears the tray",
  api.tray().length === 0,
  api.tray().map(c => c.n).join(", "));
ask("connecting art");

// 4. Fishes must go across; spiders down. Drive by id if the walker lands elsewhere.
function loadIds(ids) {
  // runAsk won't take ids. Filter INDEX onto tray via a connecting query loop.
  // We expose anotherSet; rotate connecting art until we see the ids, cap 40.
  ask("connecting art");
  const want = ids.slice().sort().join(",");
  for (let i = 0; i < 40; i++) {
    const have = idsOf().slice().sort().join(",");
    if (have === want) return api.tray();
    try { api.anotherSet(); } catch { break; }
  }
  return null;
}

const fish = loadIds(["ex1-51", "ex1-22"]);
if (fish) {
  const L = api.layoutForTray();
  const across = L && (L.cols === 2 && L.rows === 1);
  check("Carvanha/Sharpedo layout is across", across, L ? L.name + " " + L.cols + "x" + L.rows : "no layout");
} else {
  // walker may not include them in Another — still a defect, but not silent.
  check("Carvanha/Sharpedo reachable via Another", false, "not in first 40 connecting walks");
}

const spider = loadIds(["sv1-243", "sv1-18"]) || loadIds(["sv1-243", "sv1-204"]);
// don't fail the whole run on id drift; connecting-art-audit owns the ids.

// 5. Layouts: 4 is square, 8 is 4 rows of 2, 5 and 7 have no frame.
check("layout 4 is 2x2", api.LAYOUTS[4] && api.LAYOUTS[4].cols === 2 && api.LAYOUTS[4].rows === 2,
  JSON.stringify(api.LAYOUTS[4]));
check("layout 8 is 2x4", api.LAYOUTS[8] && api.LAYOUTS[8].cols === 2 && api.LAYOUTS[8].rows === 4,
  JSON.stringify(api.LAYOUTS[8]));
check("no layout 5", !api.LAYOUTS[5], "5 exists");
check("no layout 7", !api.LAYOUTS[7], "7 exists");

// 6. Empty / garbage asks must not throw and must not invent a card.
try {
  const empty = ask("");
  check("empty ask does not throw", true);
  check("empty ask does not invent", (empty || []).every(c => c && c.i && api.INDEX.some(x => x.i === c.i)));
} catch (e) {
  check("empty ask does not throw", false, e.message);
}
try {
  const junk = ask("asdfqwerzxcv 99999 notapokemon");
  check("garbage ask does not throw", true);
} catch (e) {
  check("garbage ask does not throw", false, e.message);
}

// 7. Cute / kimura / weak to fire — must return credited cards, not crash.
for (const q of ["cute cards", "what kimura drew twice", "weak to fire", "the whole charmander line"]) {
  try {
    const t = ask(q);
    const uncredited = t.filter(c => !c.a);
    check(q + " returns cards", t.length >= 1, "0 cards");
    check(q + " all credited", uncredited.length === 0, uncredited.map(c => c.n).join(", "));
  } catch (e) {
    check(q + " returns cards", false, e.message);
  }
}

// 8. Another / Back: another must change the set; back must restore.
ask("connecting art");
const first = idsOf().join(",");
try { api.anotherSet(); } catch (e) { check("anotherSet", false, e.message); }
const second = idsOf().join(",");
check("Another changes the set", first !== second && second.length > 0, "still " + first);
try { api.backSet(); } catch (e) { check("backSet", false, e.message); }
const restored = idsOf().join(",");
check("Back restores the previous set", restored === first, "got " + restored + " want " + first);

// 9. Glance test: two Magmars must not produce "both Fire".
try {
  const mag = api.INDEX.filter(c => c.n === "Magmar" && c.a).slice(0, 2);
  if (mag.length === 2) {
    const lines = api.lineOptions(mag, null, 0);
    const dumb = (lines || []).filter(o => o.reg === "observation" && /both .*fire type/i.test(o.text));
    check("NOTICE does not say both Fire type", dumb.length === 0, dumb.map(o => o.text).join(" | "));
  } else {
    check("NOTICE does not say both Fire type", true, "no Magmar pair in index");
  }
} catch (e) {
  check("NOTICE does not say both Fire type", false, e.message);
}

// 9b. Compare both is six cards, not a three-name "pick one".
try {
  const paperBirds = ["basep-21", "basep-23", "basep-22"].map(id => api.INDEX.find(c => c.i === id)).filter(Boolean);
  const pocketBirds = ["tcgp-B4a-088", "tcgp-B4a-090", "tcgp-B4a-089"].map(id =>
    (api.POCKET_INDEX || []).find(c => c.i === id)).filter(Boolean);
  const mixed = paperBirds.concat(pocketBirds);
  check("compare-both birds fixture is 6", mixed.length === 6, "got " + mixed.map(c => c && c.i).join(","));
  const lines = api.lineOptions(mixed, null, 0);
  const pick = (lines || []).filter(o => /pick one/i.test(o.text) && !/Pocket|paper/i.test(o.text));
  check("mixed tray does not get a 3-name pick one", pick.length === 0, pick.map(o => o.text).join(" | "));
  const era = (lines || []).filter(o => /Pocket/i.test(o.text) && /paper/i.test(o.text));
  check("mixed tray names paper and Pocket", era.length >= 1, (lines || []).slice(0, 6).map(o => o.text).join(" || "));
  const yrs = (lines || []).filter(o => /1999/.test(o.text));
  check("mixed birds caption is not 1999", yrs.length === 0, yrs.map(o => o.text).join(" | "));
} catch (e) {
  check("compare-both caption", false, e.message);
}

check("pocket catalogue is the full set",
  (api.POCKET_INDEX || []).length >= 3800,
  "got " + ((api.POCKET_INDEX || []).length));
try {
  api.applyGame("pocket", false);
  const pk = ask("pikachu");
  check("pocket pikachu is pikachu",
    pk.length >= 1 && /pikachu/i.test(pk[0].n) && String(pk[0].i).indexOf("tcgp-") === 0,
    pk.map(c => c.n + " " + c.i).join(", "));
  const pke = ask("eeveelutions");
  check("pocket eeveelutions is 9", pke.length === 9, "got " + pke.length + " " + pke.map(c => c.n).join(", "));
  check("pocket eeveelutions is not the birds",
    !pke.some(c => /Moltres|Zapdos|Articuno/i.test(c.n)),
    pke.map(c => c.n).join(", "));
  const ga = ask("genetic apex");
  check("genetic apex returns pocket cards",
    ga.length >= 1 && ga.every(c => /Genetic Apex/i.test(c.s || "")),
    ga.slice(0, 3).map(c => c.n + " " + c.s).join(", "));
  const vine = ask("vine whip");
  check("vine whip finds a printed attack",
    vine.length >= 3 && vine.some(c => (c.A || []).some(a => /vine whip/i.test(a)) || /bulba|tangela|carnivine/i.test(c.n)),
    vine.map(c => c.n + " " + (c.A || []).join("/")).join(", "));
  const rocket = ask("team rocket");
  check("pocket team rocket is B4a",
    rocket.length >= 2 && rocket.every(c => String(c.i).indexOf("tcgp-B4a-") === 0),
    rocket.slice(0, 4).map(c => c.n + " " + c.i).join(", "));
  api.applyCount(6, false);
  const sixP = ask("pikachu");
  check("locked 6 pikachu is 6",
    sixP.length === 6 && sixP.every(c => /pikachu/i.test(c.n)),
    sixP.map(c => c.n).join(", "));
  api.applyCount(0, false);
  const bulb = ask("bulbasaur");
  const optsP = api.lineOptions(api.tray(), null, 0) || [];
  check("pocket notice names HP or set or type",
    optsP.some(o => /HP|Genetic Apex|Grass|Vine Whip/i.test(o.text)),
    optsP.map(o => o.text).slice(0, 4).join(" | "));
  check("download is a file, not a share",
    /a\.download/.test(js),
    "dlImage has no <a download>");
  const pokeNames = [...new Set((api.POCKET_INDEX || [])
    .filter(c => c.sup === "P" && c.n && c.n.indexOf("&") < 0)
    .map(c => (c.n.split(" ")[0] || "").replace(/[^A-Za-z]/g, ""))
    .filter(n => n.length > 3))].slice(0, 40);
  var miss = [];
  for (const n of pokeNames) {
    const got = ask(n);
    if (!got.some(c => (c.n || "").indexOf(n) === 0)) miss.push(n + "→" + got.map(c => c.n).slice(0, 2).join("/"));
  }
  check("pocket name sample pulls the Pokémon", miss.length === 0, miss.slice(0, 8).join("; "));
  api.applyGame("paper", false);
  const paperNames = ["Charizard", "Pikachu", "Umbreon", "Gengar", "Mewtwo", "Snorlax", "Lucario", "Gardevoir"];
  var missP = [];
  for (const n of paperNames) {
    const got = ask(n);
    if (!got.some(c => (c.n || "").indexOf(n) === 0)) missP.push(n + "→" + got.map(c => c.n).slice(0, 2).join("/"));
  }
  check("paper name sample pulls the Pokémon", missP.length === 0, missP.join("; "));
} catch (e) {
  check("pocket catalogue search", false, e.message);
  try { api.applyGame("paper", false); } catch (e2) {}
}

try {
  api.applyGame("paper", false);
  const paperEg = (document.getElementById("egs") || {}).innerHTML || "";
  check("paper chips mention the fishes", /Carvanha|fishes|Sharpedo/i.test(paperEg), paperEg.slice(0, 180));
  check("paper chips do not lead with Three Star", !/Three Star/i.test(paperEg), paperEg.slice(0, 180));
  api.applyGame("pocket", false);
  const pocketEg = (document.getElementById("egs") || {}).innerHTML || "";
  check("pocket chips mention Team Rocket", /Team Rocket/i.test(pocketEg), pocketEg.slice(0, 180));
  check("pocket chips do not mention the fishes", !/Carvanha|Sharpedo/i.test(pocketEg), pocketEg.slice(0, 180));
  const stars = ask("three star");
  check("three star is Pocket rarity, not a count of 3 randoms",
    stars.length >= 3 && stars.every(c => /Star|Immersive|Crown/i.test(c.r || "")),
    stars.map(c => c.n + " " + c.r).join(", "));
  api.applyGame("both", false);
  const bothEg = (document.getElementById("egs") || {}).innerHTML || "";
  check("both chips mention paper × Pocket", /paper|both|×/i.test(bothEg), bothEg.slice(0, 180));
  api.applyGame("paper", false);
  ask("the fishes");
  api.setGame("pocket");
  const afterSwitch = api.tray() || [];
  check("switching to Pocket after fishes is not Carvanha",
    afterSwitch.length >= 2 && afterSwitch.every(c => String(c.i).indexOf("tcgp-") === 0) && !afterSwitch.some(c => /carvanha|sharpedo/i.test(c.n)),
    afterSwitch.map(c => c.n + " " + c.i).join(", "));
  const pocketOpen = ask("pokemon pocket");
  const pocketSets = new Set(pocketOpen.map(c => c.sid || c.s));
  const eeveeN = pocketOpen.filter(c => /eevee|vaporeon|jolteon|flareon|espeon|umbreon|leafeon|glaceon|sylveon/i.test(c.n)).length;
  const birdN = pocketOpen.filter(c => /moltres|zapdos|articuno/i.test(c.n)).length;
  check("pokemon pocket is a Pocket pull, not the Eevee line",
    pocketOpen.length >= 4 && pocketOpen.every(c => String(c.i).indexOf("tcgp-") === 0) && eeveeN < pocketOpen.length,
    pocketOpen.map(c => c.n).join(", "));
  check("pokemon pocket is not only the birds",
    birdN < 3 || pocketOpen.length > 3,
    pocketOpen.map(c => c.n).join(", "));
  check("pokemon pocket spans more than one set",
    pocketSets.size >= 2,
    [...pocketSets].join(", "));
  const zap = ask("team rocket's zapdos");
  check("team rocket zapdos is Zapdos",
    zap.length >= 1 && zap.length <= 3 && zap.every(c => /zapdos/i.test(c.n)) && zap.every(c => String(c.i).indexOf("tcgp-") === 0),
    zap.map(c => c.n + " " + c.i).join(", "));
  const conn = ask("connecting art");
  check("pocket connecting art returns Pocket cards",
    conn.length >= 2 && conn.every(c => String(c.i).indexOf("tcgp-") === 0),
    conn.map(c => c.n + " " + c.i).join(", "));
  api.anotherSet();
  const conn2 = api.tray() || [];
  check("Another after Pocket connecting is a different Pocket set",
    conn2.length >= 2 && conn2.some(c => conn.every(x => x.i !== c.i)),
    conn2.map(c => c.n + " " + c.i).join(", "));
  const src0 = api.imgSmall("tcgp-B4a-088");
  check("B4a primary is not raw Serebii",
    src0.indexOf("weserv") >= 0 || src0.indexOf("serebii") < 0,
    src0);
  const fake = { src: "https://www.serebii.net/tcgpocket/teamrocket%27sambition/88.jpg", dataset: {}, style: {}, parentElement: null };
  api.imgFallback(fake, "tcgp-B4a-088");
  check("imgFallback after Serebii is not Serebii again",
    /images\.weserv\.nl/.test(fake.src) && fake.src.indexOf("scrydex") < 0 && !/^https:\/\/www\.serebii\.net\//.test(fake.src),
    fake.src);
  const birdsP = ask("the birds");
  check("pocket birds are B4a 088/090/089",
    birdsP.map(c => c.i).join("|") === "tcgp-B4a-088|tcgp-B4a-090|tcgp-B4a-089",
    birdsP.map(c => c.i).join("|"));
  api.applyGame("paper", false);
} catch (e) {
  check("game chips", false, e.message);
  try { api.applyGame("paper", false); } catch (e2) {}
}

try {
  check("movie catalogue shipped", (api.MOVIE_INDEX || []).length >= 20,
    "MOVIE_INDEX=" + ((api.MOVIE_INDEX || []).length));
  api.applyGame("movies", false);
  const first = ask("the first movie");
  check("the first movie is Mewtwo Strikes Back",
    first.length >= 1 && first.every(c => String(c.i).indexOf("mov-") === 0) && /mewtwo/i.test(first[0].n),
    first.map(c => c.n + " " + c.i).join(", "));
  const born = ask("mewtwo is born");
  check("mewtwo is born is a movie poster",
    born.length >= 1 && born.every(c => String(c.i).indexOf("mov-") === 0) && born.some(c => /mewtwo/i.test(c.n)),
    born.map(c => c.n + " " + c.i).join(", "));
  const choose = ask("i choose you");
  check("i choose you is the 2017 film",
    choose.length >= 1 && choose.every(c => String(c.i).indexOf("mov-") === 0) && /choose/i.test(choose[0].n),
    choose.map(c => c.n + " " + c.i).join(", "));
  const det = ask("detective pikachu");
  check("detective pikachu is the live-action poster",
    det.length >= 1 && /detective/i.test(det[0].n) && String(det[0].i).indexOf("mov-") === 0,
    det.map(c => c.n + " " + c.i).join(", "));
  const src = api.imgSmall(first[0].i);
  check("movie poster is wikimedia, not pokemontcg.io",
    /upload\.wikimedia\.org/.test(src) && src.indexOf("pokemontcg.io") < 0,
    src);
  api.applyGame("paper", false);
} catch (e) {
  check("movies", false, e.message);
  try { api.applyGame("paper", false); } catch (e2) {}
}

try {
  check("console catalogue shipped", (api.CONSOLE_INDEX || []).length >= 18,
    "CONSOLE_INDEX=" + ((api.CONSOLE_INDEX || []).length));
  check("cartridge catalogue shipped", (api.CART_INDEX || []).length >= 15,
    "CART_INDEX=" + ((api.CART_INDEX || []).length));
  api.applyGame("consoles", false);
  const gb = ask("game boy");
  check("game boy is the handheld",
    gb.length >= 1 && gb.every(c => String(c.i).indexOf("hw-") === 0) && /game boy/i.test(gb[0].n),
    gb.map(c => c.n + " " + c.i).join(", "));
  const sw = ask("switch");
  check("switch is a Nintendo Switch",
    sw.length >= 1 && sw.every(c => String(c.i).indexOf("hw-") === 0) && /switch/i.test(sw.map(c => c.n).join(" ")),
    sw.map(c => c.n).join(", "));
  api.applyGame("cartridges", false);
  const yel = ask("yellow");
  check("yellow cartridge is Yellow",
    yel.length >= 1 && yel.every(c => String(c.i).indexOf("cart-") === 0) && /yellow/i.test(yel[0].n),
    yel.map(c => c.n + " " + c.i).join(", "));
  const stad = ask("stadium");
  check("stadium is the N64 disc",
    stad.length >= 1 && /stadium/i.test(stad[0].n) && String(stad[0].i).indexOf("cart-") === 0,
    stad.map(c => c.n).join(", "));
  const gbSrc = api.imgSmall(gb[0].i);
  check("game boy image is weserv jpg, not raw Wikimedia",
    /images\.weserv\.nl/.test(gbSrc) && gbSrc.indexOf("upload.wikimedia.org") >= 0 && gbSrc.indexOf("output=jpg") >= 0 && gbSrc.indexOf("%2F") < 0 && gbSrc.indexOf("/thumb/") >= 0,
    gbSrc);
  check("visual categories is the picker name",
    html.indexOf("Visual Categories") >= 0 && !/<label class="howmany">Game/.test(html),
    "label missing");
  const goldRow = (api.CART_INDEX || []).find(c => /Gold/.test(c.n));
  const goldSrc = goldRow ? api.imgSmall(goldRow.i) : "";
  check("gold box uses weserv, not a Commons thumb",
    /images\.weserv\.nl/.test(goldSrc) && goldSrc.indexOf("/thumb/") < 0,
    goldSrc);
  const oledRow = (api.CONSOLE_INDEX || []).find(c => c.i === "hw-nswoled");
  check("oled photo is not the dead docked png",
    oledRow && String(oledRow.img).indexOf("Nintendo-Switch-OLED-Docked.png") < 0,
    oledRow && oledRow.img);
  const listN = typeof api.wikiSrcList === "function" && goldRow ? api.wikiSrcList(goldRow.img, 500) : [];
  check("en-wiki images have more than one host to try",
    listN.length >= 2,
    JSON.stringify(listN).slice(0, 180));
  const fakeHw = { src: gbSrc, dataset: {}, style: {}, parentElement: null };
  api.imgFallback(fakeHw, gb[0].i);
  api.imgFallback(fakeHw, gb[0].i);
  api.imgFallback(fakeHw, gb[0].i);
  check("hw fallback never goes to scrydex",
    String(fakeHw.src).indexOf("scrydex") < 0,
    fakeHw.src);
  const gbRow = (api.CONSOLE_INDEX || []).find(c => c.i === "hw-gb") || gb[0];
  check("game boy spark is not a species",
    !(gbRow.species || []).some(s => /^(red|blue|yellow)$/i.test(s)),
    JSON.stringify(gbRow.species));
  check("game boy fact names the year and console",
    /1989/.test(api.visualDetail(gbRow)) && /console/.test(api.visualDetail(gbRow)),
    api.visualDetail(gbRow));
  api.applyGame("consoles", false);
  const stadFromHw = ask("stadium");
  check("stadium on consoles homes to the disc",
    stadFromHw.length >= 1 && /stadium/i.test(stadFromHw[0].n) && String(stadFromHw[0].i).indexOf("cart-") === 0 && stadFromHw[0].kind === "disc",
    stadFromHw.map(c => c.n + " " + c.i + " " + c.kind).join(", "));
  check("stadium fact says disc, not theatrical poster",
    /disc/i.test(api.visualDetail(stadFromHw[0])) && !/theatrical poster/i.test(api.visualDetail(stadFromHw[0])),
    api.visualDetail(stadFromHw[0]));
  api.applyGame("movies", false);
  const gbFromMov = ask("game boy");
  check("game boy on movies homes to the handheld",
    gbFromMov.length >= 1 && gbFromMov.every(c => String(c.i).indexOf("hw-") === 0) && /game boy/i.test(gbFromMov[0].n),
    gbFromMov.map(c => c.n + " " + c.i).join(", "));
  api.applyGame("movies", false);
  const junk = ask("asdfghjkl");
  check("garbage movie search is empty",
    junk.length === 0,
    junk.map(c => c.n).join(", "));
  api.applyGame("consoles", false);
  const hands = ask("the handhelds");
  check("handhelds are not the N64",
    hands.length >= 3 && hands.length <= 9 && hands.every(c => !/^Nintendo 64$/.test(c.n)),
    hands.map(c => c.n).join(", "));
  check("handhelds include Game Boy and Switch Lite",
    hands.some(c => c.i === "hw-gb") && hands.some(c => c.i === "hw-nswlite"),
    hands.map(c => c.i).join(", "));
  api.applyGame("movies", false);
  const surpriseM = ask("surprise me");
  check("surprise on movies stays a movie poster",
    surpriseM.length >= 1 && surpriseM.every(c => String(c.i).indexOf("mov-") === 0),
    surpriseM.map(c => c.n + " " + c.i).join(", "));
  const factsBox = typeof document !== "undefined" && document.getElementById("itemfacts");
  check("dom #itemfacts", !!(factsBox || (typeof present !== "undefined" && present.has("itemfacts"))));
  api.applyGame("paper", false);
} catch (e) {
  check("hardware", false, e.message);
  try { api.applyGame("paper", false); } catch (e2) {}
}

// 10. Same physical card twice is a broken page, not a pairing.
try {
  while ((api.tray() || []).length) api.remove(0);
  const id = api.INDEX[0].i;
  api.add(id); api.add(id); api.add(id);
  const n = api.tray().filter(c => c.i === id).length;
  check("add refuses a card already on the page", n === 1, "same id x" + n);
} catch (e) {
  check("add refuses a card already on the page", false, e.message);
}

// 11. Save controls exist in the DOM the page shipped.

for (const id of ["cv", "outimg", "dl", "copy", "make", "anotherset", "backset", "itemfacts"]) {
  check("dom #" + id, present.has(id));
}

// 12. COLUMN SHIFT. A merge duplicated weakness+hero, so r[17] was a type
// name instead of "P". intentCtx then built zero Pokemon names and every
// "X evolution" had no subject.
const poke = api.INDEX.filter(c => c.sup === "P").length;
check("Pokemon supertype shipped", poke > 10000, "sup=P on " + poke + " of " + api.INDEX.length);
check("connecting payload is not empty", (api.CONNECTING || []).length > 40, "CONNECTING=" + (api.CONNECTING || []).length);
const sample = api.INDEX[0];
check("sup is not a printed type", !sample.sup || sample.sup === "P", "sup=" + sample.sup + " T=" + JSON.stringify(sample.T));

console.log("");
for (const s of ok) console.log("  ✓ " + s);
console.log("");
// POST OFFICE. The Charizard show-yours must not return Blaine's, must not
// say "better", and must land two Charizard cards.
const tweet = "This is my best Charizard so far. Show me a better one below (Blaine's Charizard is not allowed)";
let cta;
try { cta = api.parseCta(tweet); } catch (e) { check("parseCta", false, e.message); cta = {}; }
check("cta reads show-yours", cta && cta.kind === "show-yours", JSON.stringify(cta));
check("cta names Charizard", cta && cta.mon === "Charizard", cta && cta.mon);
check("cta bans Blaine", cta && (cta.exclude || []).indexOf("blaine") >= 0, JSON.stringify(cta && cta.exclude));
try { api.applyCount(1, false); api.answerCta(tweet); } catch (e) { check("answerCta", false, e.message); }
const ctaTray = api.tray();
check("cta tray is one card by default", ctaTray.length === 1, "got " + ctaTray.length + " " + ctaTray.map(c => c.n).join(", "));
check("cta cards are Charizard", ctaTray.every(c => String(c.n).indexOf("Charizard") >= 0), ctaTray.map(c => c.n).join(", "));
check("cta skipped Blaine", ctaTray.every(c => !/^Blaine/i.test(c.n)), ctaTray.map(c => c.n).join(", "));
const lab = (typeof document !== "undefined" && document.getElementById("label")) ? document.getElementById("label").value : "";
check("cta reply does not compete", !/\bbetter\b/i.test(lab) || /not better/i.test(lab), lab);
try {
  const two = api.pickShowYours(cta, { need: 2 });
  check("cta format 2 returns two", two.length === 2, "got " + two.length);
  check("cta format 4 returns four", api.pickShowYours(cta, { need: 4 }).length === 4, "got " + api.pickShowYours(cta, { need: 4 }).length);
} catch (e) { check("cta formats", false, e.message); }

if (fail.length) {
  console.log("✗ HOSTILE EDITOR — " + fail.length + " failure(s):\n");
  for (const f of fail) console.log("  ✗ " + f);
  process.exit(1);
}
console.log("✓ hostile editor: " + ok.length + " attacks, none landed");
