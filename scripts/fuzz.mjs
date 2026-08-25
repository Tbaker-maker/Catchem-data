// fuzz.mjs — find what nobody imagined, and remember it.
//
// Tyler, 2026-08-25: "Make sure we're constantly scanning for bugs we've never
// seen. Always try and break it in a constructive way and always record and
// learn and implement."
//
// THE PROBLEM WITH EVERY TEST I HAVE WRITTEN: journey-smoke runs ten prompts I
// chose. ask-smoke runs eleven I chose. editor-hostile runs fourteen abuses I
// thought of. **Every one tests something I already imagined**, which is why
// Tyler has found six things none of them caught — the angle column, the
// download, four-across, the UI overwhelm, the tier asymmetry, the Charizard
// prompt.
//
// A fuzzer needs no imagination. It builds sentences and click-sequences nobody
// chose, and the value is not the crash — it is the SHAPE of the crash, recorded
// so the same shape is never new twice.
//
// AND IT LEARNS. Every distinct failure signature goes into
// data/fuzz-findings.json with the exact input that produced it, so a fix can be
// verified and the case becomes permanent. A fuzzer that forgets is a random
// number generator.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const RUNS = Number(process.argv.find(a => /^\d+$/.test(a)) ?? 400);
const html = await readFile(join(ROOT, "research/assets/build.html"), "utf-8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));

// ── THE HARNESS ───────────────────────────────────────────────────────────
const drawn = [];
const ctx = { fillStyle:"", font:"", textAlign:"", globalAlpha:1, lineWidth:1, strokeStyle:"",
  fillRect(){}, fillText(){ drawn.push("text"); }, drawImage(){ drawn.push("image"); },
  measureText(t){ return { width: String(t).length * 22 }; },
  save(){}, restore(){}, translate(){}, rotate(){}, beginPath(){}, rect(){}, roundRect(){},
  // setTransform ARRIVED WITH THE MEMORY SCALE-DOWN (6518243) and this stub was
  // never told. Every fuzz run since has died with "g.setTransform is not a
  // function" — and fuzz runs inside generate-pulse, which sits 29 lines above
  // "Commit updated prices" in the daily workflow. A stub that does not keep up
  // with the code it imitates fails the real thing.
  //
  // The general fix is not this line. It is the check below it: the stub is now
  // compared against every g.<method>() the artifact actually calls, so the next
  // canvas call to arrive is named rather than thrown.
  setTransform(){}, resetTransform(){}, scale(){},
  fill(){}, stroke(){}, clip(){}, createLinearGradient(){ return { addColorStop(){} }; } };

// ── THE STUB MUST KEEP UP WITH THE ARTIFACT ────────────────────────────────
// Checked before the fuzz runs, so a missing method is REPORTED BY NAME rather
// than surfacing as a TypeError 3,000 lines into an evaluated page.
export function stubGaps(html) {
  const used = new Set([...html.matchAll(/\bg\.([a-zA-Z]+)\s*\(/g)].map(m => m[1]));
  return [...used].filter(m => typeof ctx[m] !== "function");
}
// Named before it is thrown. A stub that has fallen behind the artifact
// produces a TypeError deep inside an evaluated page, which reads as a bug in
// the page rather than a gap in the test harness - and that misreading is what
// let this sit unfixed while it took the daily commit down with it.
{
  const gaps = stubGaps(html);
  if (gaps.length) {
    console.error("✗ FUZZ STUB IS BEHIND THE ARTIFACT - the page calls canvas methods this harness does not implement:");
    for (const g of gaps) console.error("   g." + g + "() is called by build.html and missing from the stub");
    console.error("  Add them to ctx in scripts/fuzz.mjs. The fuzz cannot prove anything until it can run.");
    process.exit(1);
  }
}

const nodes = {};
const mk = id => nodes[id] = nodes[id] || { id, innerHTML:"", value:"", textContent:"", hidden:false,
  style:{}, dataset:{}, width:0, height:0, disabled:false,
  classList:{toggle(){},add(){},remove(){},contains(){return false}},
  querySelectorAll:()=>[], querySelector:()=>null, addEventListener(){}, onclick:null,
  scrollIntoView(){}, appendChild(){}, getContext:()=>ctx,
  toDataURL(){ return "data:image/png;base64,AA"; }, toBlob(cb){ cb({ size:1, type:"image/png" }); } };
globalThis.document = { getElementById: id => present.has(id) ? mk(id) : null,
  querySelectorAll: () => [],
  querySelector: () => ({ querySelectorAll:()=>[], addEventListener(){}, onclick:null,
    classList:{toggle(){},add(){},remove(){},contains(){return false}} }),
  createElement: () => ({ style:{}, className:"", textContent:"", setAttribute(){}, appendChild(){},
    click(){}, getContext:()=>ctx, get outerHTML(){ return ""; } }),
  createTextNode: () => ({}), addEventListener(){} };
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
const store = {};
globalThis.localStorage = { getItem:k=>store[k]??null, setItem(k,v){store[k]=String(v)}, removeItem(k){delete store[k]} };
Object.defineProperty(globalThis, "navigator", { value:{}, configurable:true });
globalThis.AbortSignal = { timeout: () => null };
let FAIL_IMAGES = false;
globalThis.Image = function(){ const o = { crossOrigin:"" };
  Object.defineProperty(o, "src", { set(){ setTimeout(() => {
    if (FAIL_IMAGES) o.onerror && o.onerror(new Error("blocked")); else o.onload && o.onload();
  }, 0); } }); return o; };
globalThis.fetch = async () => { throw new TypeError("no network"); };
globalThis.confirm = () => Math.random() < 0.5;

const api = new Function(js + `
;return { runAsk, tray:()=>tray, make:()=>document.getElementById("make").onclick(),
  add:(i)=>add(i), remove:(i)=>remove(i), setCount:(n)=>{fCount=n}, setTheme:(t)=>{fTheme=t},
  setSet:(s)=>{fSet=s}, buildIdeas, search, renderThemes, loadMood, todaysCard,
  confirmPosted, startStreak, toggleStreakFilter, THEMES:()=>THEMES, MOODS:()=>MOODS,
  INDEX:()=>INDEX, status:()=>nodesStatus(), label:(v)=>{ document.getElementById("label").value = v; } };
function nodesStatus(){ const e = document.getElementById("st"); return e ? e.textContent : ""; }`)();
await new Promise(r => setTimeout(r, 80));

// ── THE VOCABULARY ────────────────────────────────────────────────────────
// Real words from real data, plus the noise a person actually produces —
// trailing spaces, double words, punctuation, a stray emoji, a paste.
const idx = api.INDEX();
const pick = a => a[Math.floor(Math.random() * a.length)];
const MONS = [...new Set(idx.map(c => String(c.n).split(" ")[0]))];
const ARTISTS = [...new Set(idx.map(c => c.a).filter(Boolean))];
const SETS = [...new Set(idx.map(c => c.s))];
const WORDS = ["evolution","line","cute","funny","dark","cheap","expensive","rare","beautiful",
  "years apart","same artist","nobody talks about","obscure","fears","battle","versus","story",
  "lore","power creep","two","three","four","six","nine","psychic","fire","water","dragon",
  "from","the","of","a","show me","give me","i want","please","best","top"];
const NOISE = ["", "  ", "!!!", "???", "🔥", "...", "'", '"', "\\", "()", "[]", "{}", "<>", "&", "%", "$",
  "\n", "\t", "0", "-1", "999999", "null", "undefined", "NaN", "<script>", "../../etc", "%00"];

function sentence() {
  const n = 1 + Math.floor(Math.random() * 6);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    parts.push(r < 0.30 ? pick(MONS) : r < 0.40 ? pick(ARTISTS) : r < 0.48 ? pick(SETS)
      : r < 0.88 ? pick(WORDS) : pick(NOISE));
  }
  return parts.join(" ");
}

// ── WHAT COUNTS AS A FAILURE ──────────────────────────────────────────────
// Not just a throw. A silent success is worse: the tool says nothing and does
// nothing, and the user cannot tell it from broken.
function signature(err) {
  return String(err).replace(/["'].*?["']/g, "X").replace(/\d+/g, "N").slice(0, 110);
}

const found = new Map();
const record = (sig, input, kind) => {
  if (!found.has(sig)) found.set(sig, { sig, kind, firstInput: input, count: 0 });
  found.get(sig).count++;
};

for (let run = 0; run < RUNS; run++) {
  FAIL_IMAGES = Math.random() < 0.25;   // a quarter of runs on a blocked host
  const input = sentence();
  drawn.length = 0;
  try {
    api.runAsk(input);
  } catch (e) { record(signature(e.message), input, "runAsk threw"); continue; }

  // Random extra actions, in an order nobody designed.
  const acts = 1 + Math.floor(Math.random() * 4);
  for (let a = 0; a < acts; a++) {
    try {
      const r = Math.random();
      if (r < 0.15) api.setCount(pick([1,2,3,4,5,6,7,8,9,0,-1,99]));
      else if (r < 0.30) api.setTheme(pick(api.THEMES()).id);
      else if (r < 0.40) api.setSet(pick([...SETS, "", "Not A Set"]));
      else if (r < 0.50) api.buildIdeas();
      else if (r < 0.58) api.search();
      else if (r < 0.66) api.renderThemes();
      else if (r < 0.74) api.loadMood(pick(api.MOODS()).id);
      else if (r < 0.80) api.remove(Math.floor(Math.random() * 6));
      else if (r < 0.86) api.startStreak(pick(["ir-any","ir-cheap","sir-only","not-a-filter"]));
      else if (r < 0.92) api.confirmPosted();
      else if (r < 0.96) api.toggleStreakFilter();
      else api.todaysCard();
    } catch (e) { record(signature(e.message), input, "action threw"); }
  }

  if (api.tray().length) {
    try {
      await api.make();
      await new Promise(r => setTimeout(r, 20));
      // A COMPOSE THAT DRAWS NOTHING AND SAYS NOTHING is the failure that looks
      // like success — the one that has bitten us most often.
      if (!drawn.length && !api.status()) record("compose drew nothing and said nothing", input, "silent failure");
    } catch (e) { record(signature(e.message), input, "make threw"); }
  }
}

// ── LEARN ─────────────────────────────────────────────────────────────────
// A fuzzer that forgets is a random number generator. Every new signature is
// written down with the input that produced it, so a fix can be verified and
// the case becomes permanent.
const PATH = join(ROOT, "data/fuzz-findings.json");
let known;
try { known = JSON.parse(await readFile(PATH, "utf-8")); }
catch { known = { note: "Failure signatures found by fuzzing, with the exact input that produced each. A fuzzer that forgets is a random number generator — every entry here is a case that must become a permanent test.", findings: [] }; }

const knownSigs = new Set(known.findings.map(f => f.sig));
const fresh = [...found.values()].filter(f => !knownSigs.has(f.sig));
for (const f of fresh) known.findings.push({ ...f, firstSeen: new Date().toISOString(), fixed: false });
known.lastRun = new Date().toISOString();
known.runs = (known.runs ?? 0) + RUNS;
await writeFile(PATH, JSON.stringify(known, null, 1));

console.log(`fuzz: ${RUNS} random journeys · ${found.size} distinct failure shape(s) · ${fresh.length} NEVER SEEN BEFORE\n`);
for (const f of [...found.values()].sort((a, b) => b.count - a.count).slice(0, 8)) {
  const isNew = fresh.some(x => x.sig === f.sig);
  console.log(`  ${isNew ? "NEW  " : "known"} ${String(f.count).padStart(3)}×  [${f.kind}] ${f.sig}`);
  if (isNew) console.log(`              input: ${JSON.stringify(f.firstInput.slice(0, 70))}`);
}
if (fresh.length) {
  console.log(`\n  ${fresh.length} new shape(s) written to data/fuzz-findings.json.`);
  console.log(`  Each one is a case that should become a permanent test.`);
  process.exitCode = 1;
} else if (found.size) {
  console.log(`\n  All ${found.size} shape(s) already recorded — nothing new this run.`);
} else {
  console.log(`  Nothing broke.`);
}
