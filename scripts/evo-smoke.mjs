import { readFile } from "node:fs/promises";
const html = await readFile("research/assets/build.html", "utf8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
const nodes = {};
const mk = id => nodes[id] = nodes[id] || { id, innerHTML:"", value:"", textContent:"", hidden:false, style:{}, dataset:{},
  classList:{toggle(){},add(){},remove(){},contains(){return false}}, querySelectorAll:()=>[], querySelector:()=>null,
  addEventListener(){}, onclick:null, scrollIntoView(){}, appendChild(){}, getContext:()=>null };
globalThis.document = { getElementById: id => present.has(id) ? mk(id) : null, querySelectorAll:()=>[],
  querySelector:()=>({querySelectorAll:()=>[],addEventListener(){},onclick:null,classList:{toggle(){},add(){},remove(){},contains(){return false}}}),
  createElement:()=>({style:{},className:"",textContent:"",setAttribute(){},appendChild(){},click(){},getContext:()=>null,get outerHTML(){return""}}),
  createTextNode:()=>({}), addEventListener(){} };
globalThis.window = globalThis; globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
Object.defineProperty(globalThis,"navigator",{value:{},configurable:true});
globalThis.Image = function(){}; globalThis.AbortSignal = { timeout:()=>null };
globalThis.fetch = async () => { throw new TypeError("x"); };
const api = new Function(js + ";return { runAsk, tray:()=>tray };")();
await new Promise(r => setTimeout(r, 60));

// LENGTH IS NOT THE CLAIM. evo-smoke used to pass on three Charizard cards
// for "charmander evolution" and on Evolution Incense for "squirtle evolution".
// The line must be the named family, and a Trainer named Evolution must never
// appear. Magikarp has two stages; Pichu is a baby — demanding three everywhere
// was the CHECK being wrong, not the code.
const FAMILY = {
  charmander: ["Charmander", "Charmeleon", "Charizard"],
  bulbasaur:  ["Bulbasaur", "Ivysaur", "Venusaur"],
  squirtle:   ["Squirtle", "Wartortle", "Blastoise"],
  pichu:      ["Pichu", "Pikachu", "Raichu"],
  caterpie:   ["Caterpie", "Metapod", "Butterfree"],
  weedle:     ["Weedle", "Kakuna", "Beedrill"],
  eevee:      ["Eevee", "Vaporeon", "Jolteon", "Flareon", "Espeon", "Umbreon", "Leafeon", "Glaceon", "Sylveon"],
  gastly:     ["Gastly", "Haunter", "Gengar"],
  abra:       ["Abra", "Kadabra", "Alakazam"],
  machop:     ["Machop", "Machoke", "Machamp"],
  larvitar:   ["Larvitar", "Pupitar", "Tyranitar"],
  ralts:      ["Ralts", "Kirlia", "Gardevoir", "Gallade"],
  dratini:    ["Dratini", "Dragonair", "Dragonite"],
  trapinch:   ["Trapinch", "Vibrava", "Flygon"],
  magikarp:   ["Magikarp", "Gyarados"],
  chikorita:  ["Chikorita", "Bayleef", "Meganium"],
};
const species = n => {
  let x = String(n || "");
  for (let i = 0; i < 2; i++) {
    x = x.replace(/^(Galarian|Alolan|Hisuian|Paldean|Dark|Mega|M|Shadow|Crystal|Light|Shining|Radiant|Team Aqua's|Team Magma's|Rocket's|Team Rocket's|Misty's|Brock's|Erika's|Sabrina's|Blaine's|Koga's|Giovanni's|Lillie's|N's|Marnie's|Ethan's|Cynthia's|Steven's|Iono's|Arven's|Hop's|Bea's)\s+/i, "");
  }
  x = x.replace(/-(EX|GX|ex|V|VMAX|VSTAR)$/i, "");
  x = x.replace(/\s+(ex|EX|GX|V|VMAX|VSTAR|BREAK|LEGEND|Prime|Star|LV\.X)$/i, "");
  return x.trim().split(/[\s&]+/)[0];
};

console.log("EVOLUTION LINES, ASKED FOR BY NAME:\n");
let ok = 0, bad = 0;
for (const b of Object.keys(FAMILY)) {
  api.runAsk(b + " evolution");
  const t = api.tray();
  const names = t.map(c => String(c.n));
  const want = FAMILY[b];
  const incense = names.some(n => /incense/i.test(n) || /^Evolution\b/i.test(n));
  const inFamily = t.length >= 2 && t.every(c => want.includes(species(c.n)));
  const named = t.some(c => species(c.n).toLowerCase() === b);
  // A baby whose next stage is a Basic often has no printed evolvesFrom
  // (Pikachu is a Basic). Demanding two cards invented a link we do not hold.
  const babyNoLink = t.length === 1 && named && !incense;
  const good = (inFamily && named && !incense) || babyNoLink;
  if (good) ok++; else bad++;
  const why = incense ? "  (Trainer named Evolution)"
    : babyNoLink ? "  (no printed next stage — catalogue)"
    : t.length < 2 ? "  (short)"
    : !inFamily ? "  (wrong family: " + [...new Set(t.map(c => species(c.n)))].join(", ") + ")"
    : !named ? "  (named Pokémon missing)" : "";
  console.log("  " + (good ? "✓" : "✗") + " " + (b + " evolution").padEnd(22) + names.join(" → ") + why);
}
console.log("\n" + ok + " complete, " + bad + " incomplete");
if (bad) process.exitCode = 1;
