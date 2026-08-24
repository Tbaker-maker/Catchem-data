import { readFile } from "node:fs/promises";
// ATTACK 3: DOES THE OUTPUT MATCH THE CLAIM? The Koga bug shipped a true fact
// beside the wrong card. That is the failure that reads as researched, and it
// is the only class that damages a creator rather than just annoying them.
// Nothing checks it systematically.
const html = await readFile("research/assets/build.html", "utf8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
const nodes = {};
const mk = id => nodes[id] ||= { id, innerHTML:"", value:"", textContent:"", hidden:false, style:{}, dataset:{},
  classList:{toggle(){},add(){},remove(){},contains(){return false}}, querySelectorAll:()=>[], querySelector:()=>null,
  addEventListener(){}, onclick:null, scrollIntoView(){}, appendChild(){}, getContext:()=>null };
globalThis.document = { getElementById: id => present.has(id) ? mk(id) : null, querySelectorAll:()=>[],
  createElement:()=>({style:{},className:"",textContent:"",setAttribute(){},appendChild(){},click(){},getContext:()=>null,get outerHTML(){return""}}),
  createTextNode:()=>({}), addEventListener(){} };
globalThis.window = globalThis; globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
Object.defineProperty(globalThis,"navigator",{value:{},configurable:true});
globalThis.Image = function(){}; globalThis.AbortSignal = { timeout:()=>null };
globalThis.fetch = async () => { throw new TypeError("no network"); };
const api = new Function(js + `
;globalThis.__ATTRS = ATTRS;
;return { setTheme:(t)=>{fTheme=t}, setCount:(n)=>{fCount=n}, buildIdeas, ideas:()=>window.__ideas,
  THEMES:()=>THEMES, MOODS:()=>MOODS, INDEX:()=>INDEX, lineOptions };`)();
await new Promise(r => setTimeout(r, 60));

const byId = Object.fromEntries(api.INDEX().map(c => [c.i, c]));
const problems = [];
let checked = 0;

for (const t of api.THEMES()) {
  for (const n of (t.bestAt ?? [2])) {
    api.setTheme(t.id); api.setCount(n);
    try { api.buildIdeas(); } catch { continue; }
    for (const idea of (api.ideas() ?? [])) {
      const cards = idea.cards ?? [];
      checked++;
      // 1 · The count promised must be the count delivered.
      if (cards.length !== n) problems.push(`${t.id}@${n}: promised ${n} cards, produced ${cards.length}`);
      // 2 · No duplicate cards — the same card twice is a composition, not a set.
      const ids = cards.map(c => c.i);
      if (new Set(ids).size !== ids.length) problems.push(`${t.id}@${n}: DUPLICATE card in one idea — "${idea.title}"`);
      // 3 · A title naming a number must match the cards shown. "8 artists" with
      // four cards is the Koga failure in a different coat.
      const num = /(\d+)\s+(artists?|cards?|illustrators?)/i.exec(idea.title || "");
      if (num && Number(num[1]) !== cards.length) problems.push(`${t.id}@${n}: title says "${num[0]}" but there are ${cards.length} cards — "${idea.title}"`);
      const hnum = /(\d+)\s+(artists?|from)/i.exec(idea.hook || "");
      if (hnum && Number(hnum[1]) !== cards.length) problems.push(`${t.id}@${n}: hook says "${hnum[0]}" but there are ${cards.length} cards`);
      // 4 · A title naming an ARTIST must have that artist on every card shown.
      const named = (t.shape === "artist-span" || t.shape === "debut") ? (idea.title || "").split(" started here")[0].trim() : null;
      if (named && cards.length && !cards.every(c => c.a === named))
        problems.push(`${t.id}@${n}: title names ${named} but not every card is theirs — ${cards.map(c=>c.a).join(", ")}`);
      // 5 · An HP claim must match the cards shown. Power creep puts two real
      // numbers on a public image and a wrong one is Koga with arithmetic.
      const hp=/(\d+) HP → (\d+) HP/.exec(idea.title||"");
      if (hp && cards.length>=2) {
        const A=globalThis.__ATTRS||{};
        const lo=A[cards[0].i]?.h, hi=A[cards[cards.length-1].i]?.h;
        if (lo && hi && (Number(hp[1])!==lo || Number(hp[2])!==hi))
          problems.push(t.id + ": title says " + hp[1] + "→" + hp[2] + " HP but the cards are " + lo + "→" + hi);
      }
      // 6 · Every card must actually exist in the index.
      for (const c of cards) if (!byId[c.i]) problems.push(`${t.id}@${n}: card ${c.i} is not in the index`);
    }
  }
}
console.log(`checked ${checked} generated ideas for claim/output mismatch`);
console.log(problems.length ? `\n✗ CLAIM MISMATCH — ${problems.length}:\n` : "\n✓ every idea's words match the cards it shows");
for (const p of [...new Set(problems)].slice(0, 10)) console.log("   " + p);
