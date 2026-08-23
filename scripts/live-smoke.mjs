import { readFile } from "node:fs/promises";
// Each fake window gets its OWN document, passed in rather than shared through a
// global — the previous harness let the audience handler write into the
// presenter's nodes because `document` resolved at call time.
const pres = await readFile("research/assets/live-presenter.html", "utf8");
const aud = await readFile("research/assets/live-audience.html", "utf8");
const pjs = pres.match(/<script>([\s\S]*?)<\/script>/)[1];
const ajs = aud.match(/<script>([\s\S]*?)<\/script>/)[1];

const listeners = [];
class Chan { constructor(){ this.onmessage = null; listeners.push(this); }
  postMessage(d){ for (const l of listeners) if (l !== this && l.onmessage) l.onmessage({ data: d }); } }

const mkDoc = () => { const n = {};
  return { _n: n, addEventListener(){}, getElementById: id => n[id] ||= { id, textContent: "", innerHTML: "",
    src: "", className: "", style: {}, classList: { add(){}, remove(){}, contains(){ return false; } } } }; };

const run = (js, doc, extra = {}) => {
  const win = { addEventListener(){}, ...extra };
  return new Function("document", "window", "BroadcastChannel", "setTimeout", js + "\n;return typeof next === 'function' ? {next} : {};")
    (doc, win, Chan, (fn, ms) => setTimeout(fn, ms));
};

const aDoc = mkDoc(), pDoc = mkDoc();
run(ajs, aDoc);
const api = run(pjs, pDoc);
await new Promise(r => setTimeout(r, 550));

const fails = [];
if (!pDoc._n.title?.textContent) fails.push("presenter renders no title on load");
if (!pDoc._n.conf?.textContent) fails.push("presenter shows no confidence tier — the one thing keeping a creator safe");
if (!aDoc._n.title?.textContent) fails.push("audience never received a slide — the overlay would be blank on air");

const before = aDoc._n.title?.textContent;
api.next?.(); api.next?.();
if (aDoc._n.title?.textContent === before) fails.push("audience did not update after two advances");

const deck = JSON.parse(pjs.match(/const DECK = (\[[\s\S]*?\]);/)[1]);
const unhedged = deck.filter(s => s.confidence !== "VERIFIED"
  && !(s.prompts ?? []).some(p => /hedge|NOT settled|I've read|skip it|not an explanation|ask chat/i.test(p)));
if (unhedged.length) fails.push(`${unhedged.length} unverified slide(s) give the presenter no hedging instruction`);

const leaked = deck.filter(s => s.confidence !== "VERIFIED" && s.audience?.headline
  && (s.facts ?? []).some(f => f && s.audience.headline.startsWith(f.slice(0, 25))));
if (leaked.length) fails.push(`${leaked.length} unverified claim(s) reach the AUDIENCE overlay as stated fact`);

if (fails.length) { console.error("\n✗ LIVE SMOKE — broken:\n"); for (const f of fails) console.error("   " + f); console.error(""); process.exitCode = 1; }
else console.log(`✓ live smoke: ${deck.length} slides · presenter renders · audience follows · 0 unverified claims on the overlay · every unverified slide hedges`);
