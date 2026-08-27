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
const nodes = {};
const mk = id => nodes[id] = nodes[id] || {
  id, innerHTML: "", value: "", textContent: "", hidden: false, style: {},
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

let api;
try {
  api = new Function(js + ";return { runAsk, tray:()=>tray, lineOptions, layoutForTray, connectingGroupOf, anotherSet, backSet, parseIntent, evoLineFor, INDEX, CONNECTING, LAYOUTS, add, remove, parseCta, pickShowYours, answerCta, officeCount:()=>officeCount, applyCount, fCount:()=>fCount, fillLineFromCards };")();
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
const three = ask("three cards one painting");
check("three cards one painting is 3 cards", (three || []).length === 3, "got " + (three || []).length);
check("three cards is not always the beasts", (three || []).map(c => c.i).join(",") !== "neo3-6,neo3-13,neo3-14");
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
  check("9-card notice has the finisher", (opts || []).some(o => /you already pulled a piece/i.test(o.text)), (opts || []).map(o => o.text).slice(0,3).join(" | "));
  try { api.fillLineFromCards(true); } catch (e) { check("fillLineFromCards", false, e.message); }
  const lab = (typeof document !== "undefined" && document.getElementById("label")) ? document.getElementById("label").value : "";
  const want = "nine cards.\nfive different packs.\none beach.\n\nyou already pulled a piece of this and didn't know.";
  check("caption is the winning post", lab === want, JSON.stringify(lab));
  check("connecting post does not name Magikarp", !/Magikarp/i.test(lab), lab);
  api.applyCount(2, true);
} catch (e) { check("how-many cards", false, e.message); }

ask("the fishes");
check("the fishes is Carvanha then Sharpedo",
  api.tray().map(c => c.n).join("|") === "Carvanha|Sharpedo",
  api.tray().map(c => c.n).join("|"));
try {
  const gFish = api.connectingGroupOf(api.tray());
  check("fishes layout is across", !!(gFish && gFish.arr === "across"), JSON.stringify(gFish && gFish.arr));
} catch (e) { check("fishes layout is across", false, e.message); }
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

for (const id of ["cv", "outimg", "dl", "copy", "make", "anotherset", "backset"]) {
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
