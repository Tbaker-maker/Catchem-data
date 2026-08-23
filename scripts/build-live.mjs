// build-live.mjs — Going Live. Not a teleprompter.
//
// Tyler, 2026-08-23: "A 'Going live' feature that works like a teleprompter but
// isn't a script unless they want that… give live inspiration… it needs to feel
// seamless: share screen function, what the audience sees and what the creator
// sees."
//
// THE RESEARCH CHANGED WHAT THIS IS. Every teleprompter surveyed — Teleprompter.com,
// PromptSmart, FlowPrompter, Speakflow, StreamYard's built-in, Elgato's Prompter
// — scrolls text the creator already wrote. Every one solves the opposite
// problem to ours. Their user arrives with a script and needs help reading it; a
// card creator going live has plenty to say and needs something to say it ABOUT.
//
// So this is a CONTENT FEED for live, and nobody is building one.
//
// THE ARCHITECTURE CAME FREE FROM OBS. OBS captures specific SOURCES rather than
// the screen, and supports Custom Browser Docks (private to the presenter) and
// Browser Sources (visible to the audience). Both take a plain URL. So: two
// URLs from one session, and OBS enforces the private/public split rather than
// us trying to hide things — which is far safer than any scheme we could invent.
//
// THE THING NO COMPETITOR CAN COPY: every card here carries a CONFIDENCE TIER,
// because we already record one on every fact. On a live stream, saying a rumour
// as fact is how a creator gets destroyed, and nobody else can show confidence
// because nobody else stores it. The presenter sees VERIFIED or SPECULATION in
// letters they cannot miss; the audience never sees the label unless it is safe
// to.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const idx = await J("research/assets/card-index.json") ?? [];
const kb = await J("data/knowledge.json");
const scout = await J("research/pulse/theme-scout.json");
const themes = await J("data/themes.json");

const HERO = /Illustration Rare|Rare Holo|Rare Secret|Rare Ultra/i;
const money = (p) => p == null ? null : "$" + Math.round(p).toLocaleString("en-US");

// ── THE DECK ──────────────────────────────────────────────────────────────
// Every slide is a THING TO TALK ABOUT, not a line to read. The presenter gets
// prompts; the audience gets the card. A slide that tells somebody what to say
// makes them sound like they are reading, which is the exact failure mode of
// every tool in this category.
const slides = [];
const S = (o) => slides.push({ id: "s" + slides.length, ...o });

// 1 · A CARD, with the numbers a creator would want in their peripheral vision
for (const c of idx.filter(c => HERO.test(c.r ?? "") && c.a && c.p != null)
  .sort((a, b) => (b.p ?? 0) - (a.p ?? 0)).slice(0, 40)) {
  S({ kind: "card", card: c.i, confidence: "VERIFIED",
      title: c.n, sub: `${c.s} · ${c.y}`,
      facts: [`${c.a}`, `${c.r}`, money(c.p) ?? "no price"],
      // Prompts, not a script. Questions a presenter answers in their own words.
      prompts: [`Have you pulled one?`, `Is ${money(c.p)} fair for this?`,
                `${c.a} — do you know their other work?`],
      audience: { headline: c.n, sub: `${c.s} · ${c.y} · ${c.a}` } });
}

// 2 · A FACT, carrying the confidence tier that makes this safe to say out loud
for (const f of (kb?.facts ?? []).filter(f => /card|set|print|artist|ban|absence|rarity/i.test(f.claim))) {
  const named = idx.find(c => c.n.length >= 4 && f.claim.split(/[^A-Za-z0-9'-]+/).includes(c.n.split(" ")[0]));
  S({ kind: "fact", card: named?.i ?? null, confidence: f.confidence,
      title: f.id.replace(/-/g, " "),
      sub: named ? `${named.n} · ${named.s}` : "",
      facts: [f.claim.split(".")[0] + "."],
      sources: f.sources ?? [],
      falsifier: f.falsifier ?? null,
      prompts: [`Say it in your own words — the claim is above`,
                f.confidence === "VERIFIED" ? `Sourced. You can state this plainly.`
                  : `NOT settled — say "I've read that…" or skip it`],
      // The audience only ever sees a fact we can defend.
      audience: f.confidence === "VERIFIED"
        ? { headline: f.claim.split(".")[0] + ".", sub: (f.sources ?? [])[0] ?? "" }
        : { headline: named?.n ?? "", sub: named ? `${named.s} · ${named.y}` : "" } });
}

// 3 · A FINDING from the scout — unusual, and honestly labelled as unexplained
for (const f of (scout?.finds ?? []).filter(f => !f.needsHuman).slice(0, 24)) {
  S({ kind: "finding", card: (f.cards ?? [])[0] ?? null, confidence: "REASONED",
      title: f.headline, sub: f.kind,
      facts: [f.hook ?? f.why ?? ""],
      prompts: [`This is a pattern in the data, not an explanation`,
                `Ask chat if anyone knows WHY`],
      audience: { headline: f.headline, sub: "" } });
}

// 4 · A THEME — a segment rather than a single card
for (const t of (themes?.themes ?? []).filter(t => t.kind === "named list").slice(0, 10)) {
  const members = idx.filter(c => (t.members ?? []).some(m => c.n.startsWith(m)) && HERO.test(c.r ?? "")).slice(0, 9);
  if (members.length < 3) continue;
  S({ kind: "segment", cards: members.map(c => c.i), confidence: "VERIFIED",
      title: t.name, sub: `${members.length} cards`,
      facts: [t.why ?? ""],
      prompts: [t.hook ?? "Which one?", `Take chat's answers before you give yours`],
      audience: { headline: t.name, sub: t.hook ?? "" } });
}

const deck = { generatedAt: new Date().toISOString(), slides,
  counts: slides.reduce((a, s) => (a[s.kind] = (a[s.kind] ?? 0) + 1, a), {}) };
await writeFile(join(ROOT, "research/pulse/live-deck.json"), JSON.stringify(deck, null, 1));

const CSS = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Sora:wght@300;400;600&family=JetBrains+Mono:wght@500&display=swap');
:root{--ink:#0a0c12;--panel:#11141c;--line:#20252f;--text:#e8ebf2;--soft:#8a93a6;
  --faint:#5a6273;--live:#36d399;--warn:#d9a441;--bad:#e0705a}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--text);
  font:300 17px/1.55 'Sora',system-ui,sans-serif;-webkit-font-smoothing:antialiased}`;

// ── PRESENTER ─────────────────────────────────────────────────────────────
// Glanceable. Somebody talking to a camera reads in half-second snatches, so
// nothing here is a paragraph and the confidence tier is the largest thing after
// the title.
const presenter = `<!doctype html><meta charset="utf-8"><title>Going Live — presenter</title>
<meta name="robots" content="noindex,nofollow,noarchive">
<style>${CSS}
body{padding:18px;display:flex;flex-direction:column;height:100vh}
.bar{display:flex;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
.pill{font:500 11px 'JetBrains Mono',monospace;letter-spacing:.14em;padding:6px 11px;
  border-radius:7px;border:1px solid var(--line);color:var(--faint)}
.pill.on{color:var(--live);border-color:rgba(54,211,153,.4)}
.conf{font:500 13px 'JetBrains Mono',monospace;letter-spacing:.16em;padding:8px 14px;border-radius:8px}
.conf.VERIFIED{background:rgba(54,211,153,.14);color:var(--live)}
.conf.COMMUNITY,.conf.REASONED,.conf['SINGLE-SOURCE']{background:rgba(217,164,65,.14);color:var(--warn)}
.conf.other{background:rgba(224,112,90,.14);color:var(--bad)}
main{flex:1;display:flex;gap:20px;min-height:0}
.left{flex:1;min-width:0;display:flex;flex-direction:column}
h1{font:800 clamp(26px,3.4vw,44px)/1.06 'Syne',system-ui,sans-serif;margin:0 0 6px;letter-spacing:-.02em}
.sub{color:var(--soft);font:400 16px 'JetBrains Mono',monospace;margin-bottom:18px}
.facts{display:flex;flex-direction:column;gap:9px;margin-bottom:20px}
.fact{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--live);
  border-radius:9px;padding:12px 15px;font-size:19px}
.prompts{margin-top:auto}
.prompts b{display:block;font:500 10.5px 'JetBrains Mono',monospace;color:var(--faint);
  letter-spacing:.16em;margin-bottom:9px}
.prompt{color:var(--text);font-size:21px;padding:9px 0 9px 18px;border-left:2px solid var(--line)}
.art{width:230px;flex:none}
.art img{width:100%;border-radius:9px;background:var(--panel)}
.src{font:400 11px 'JetBrains Mono',monospace;color:var(--faint);margin-top:10px;line-height:1.5}
.nav{display:flex;gap:9px;margin-top:16px;align-items:center}
button{background:var(--panel);border:1px solid var(--line);color:var(--soft);border-radius:9px;
  padding:11px 17px;font:400 15px 'Sora',sans-serif;cursor:pointer}
button.go{background:var(--live);color:var(--ink);border:0;font-weight:600}
.count{font:500 12px 'JetBrains Mono',monospace;color:var(--faint);margin-left:auto}
@media(max-width:760px){.art{display:none}}
</style>
<div class="bar">
  <span class="pill on">PRESENTER — only you see this</span>
  <span class="pill" id="kind">—</span>
  <span class="conf" id="conf">—</span>
  <span class="count" id="count"></span>
</div>
<main>
  <div class="left">
    <h1 id="title">—</h1>
    <div class="sub" id="sub"></div>
    <div class="facts" id="facts"></div>
    <div class="prompts"><b>SAY IT YOUR WAY</b><div id="prompts"></div></div>
  </div>
  <div class="art"><img id="img" alt=""><div class="src" id="src"></div></div>
</main>
<div class="nav">
  <button onclick="prev()">← Back</button>
  <button class="go" onclick="next()">Next →</button>
  <button onclick="shuffle()">Shuffle</button>
  <button onclick="filt('card')">Cards</button>
  <button onclick="filt('fact')">Facts</button>
  <button onclick="filt('segment')">Segments</button>
  <button onclick="filt(null)">All</button>
</div>
<script>
const DECK = ${JSON.stringify(slides)};
// SYNC WITH NO BACKEND. BroadcastChannel pairs two same-origin tabs, so the
// audience view follows the presenter with no server, no account and no latency
// worth measuring.
const chan = new BroadcastChannel("catchem-live");
let pool = DECK.slice(), i = 0;
const imgUrl = id => "https://images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + "_hires.png";
const el = id => document.getElementById(id);

function show(){
  const s = pool[i]; if (!s) return;
  el("kind").textContent = s.kind.toUpperCase();
  const c = el("conf");
  c.textContent = s.confidence === "VERIFIED" ? "VERIFIED — say it plainly" : s.confidence + " — hedge it";
  c.className = "conf " + (s.confidence === "VERIFIED" ? "VERIFIED" : /COMMUNITY|REASONED|SINGLE/.test(s.confidence) ? "COMMUNITY" : "other");
  el("title").textContent = s.title;
  el("sub").textContent = s.sub || "";
  el("facts").innerHTML = (s.facts || []).filter(Boolean).map(f => "<div class='fact'>" + f + "</div>").join("");
  el("prompts").innerHTML = (s.prompts || []).filter(Boolean).map(p => "<div class='prompt'>" + p + "</div>").join("");
  const card = s.card || (s.cards || [])[0];
  el("img").src = card ? imgUrl(card) : "";
  el("img").style.visibility = card ? "visible" : "hidden";
  el("src").innerHTML = (s.sources || []).slice(0, 2).join("<br>") + (s.falsifier ? "<br><br>WRONG IF: " + s.falsifier : "");
  el("count").textContent = (i + 1) + " / " + pool.length;
  chan.postMessage({ type: "slide", slide: s });
}
// Answer the audience's hello with whatever is currently on screen, so a
// reloaded Browser Source recovers instead of going blank.
chan.onmessage = (e) => { if (e.data?.type === "hello") chan.postMessage({ type: "slide", slide: pool[i] }); };
function next(){ i = (i + 1) % pool.length; show(); }
function prev(){ i = (i - 1 + pool.length) % pool.length; show(); }
function shuffle(){ pool.sort(() => Math.random() - 0.5); i = 0; show(); }
function filt(k){ pool = k ? DECK.filter(s => s.kind === k) : DECK.slice(); i = 0; show(); }
// Space and arrows, because a presenter's hand is not on a mouse.
document.addEventListener("keydown", e => {
  if (e.key === " " || e.key === "ArrowRight") { e.preventDefault(); next(); }
  if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
});
window.next = next; window.prev = prev; window.shuffle = shuffle; window.filt = filt;
show();
// Re-send shortly after load: whichever window opened first, the other is
// listening by now. A blank overlay mid-show has no recovery and an extra
// message costs nothing.
setTimeout(() => chan.postMessage({ type: "slide", slide: pool[i] }), 400);
</script>`;
await writeFile(join(ROOT, "research/assets/live-presenter.html"), presenter);

// ── AUDIENCE ──────────────────────────────────────────────────────────────
// Big, clean, transparent-friendly. It shows the card and the headline and
// NOTHING ELSE — no prompts, no confidence label unless the claim is one we can
// defend, no sources. What the presenter needs and what the audience needs are
// different documents, and the commonest way to ruin a stream overlay is to
// show one document to both.
const audience = `<!doctype html><meta charset="utf-8"><title>Going Live — audience</title>
<meta name="robots" content="noindex,nofollow,noarchive">
<style>${CSS}
body{background:transparent;height:100vh;display:flex;align-items:flex-end;padding:0}
.lower{width:100%;background:linear-gradient(180deg,transparent,rgba(10,12,18,.92) 34%);
  padding:70px 56px 46px;display:flex;gap:30px;align-items:flex-end}
.lower img{width:186px;border-radius:11px;flex:none;box-shadow:0 18px 44px rgba(0,0,0,.6)}
.txt{min-width:0;padding-bottom:8px}
h1{font:800 clamp(30px,4vw,54px)/1.04 'Syne',system-ui,sans-serif;margin:0 0 10px;letter-spacing:-.025em}
.sub{color:var(--soft);font:400 21px 'JetBrains Mono',monospace}
.mark{position:fixed;top:34px;right:44px;font:600 22px 'Sora',sans-serif;color:var(--live);opacity:.9}
.hide{display:none}
</style>
<div class="mark">Catch'em</div>
<div class="lower" id="lower">
  <img id="img" alt="" class="hide">
  <div class="txt"><h1 id="title"></h1><div class="sub" id="sub"></div></div>
</div>
<script>
// Follows the presenter. No controls at all — a stray click on an overlay
// during a live show is a mistake nobody can undo.
const chan = new BroadcastChannel("catchem-live");
const imgUrl = id => "https://images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + "_hires.png";
// BROADCASTCHANNEL DOES NOT REPLAY, and the audience window normally opens
// AFTER the presenter — you set up OBS, then open the dock. Without this the
// overlay stays blank until the first advance, which is a blank lower-third at
// the moment somebody starts talking. So: ask on load, and again on focus in
// case OBS reloaded the source mid-show.
chan.onmessage = (e) => {
  if (e.data?.type !== "slide") return;
  const s = e.data.slide, a = s.audience || {};
  document.getElementById("title").textContent = a.headline || "";
  document.getElementById("sub").textContent = a.sub || "";
  const card = s.card || (s.cards || [])[0];
  const img = document.getElementById("img");
  if (card) { img.src = imgUrl(card); img.classList.remove("hide"); }
  else img.classList.add("hide");
};
// LISTEN FIRST, THEN ASK. This used to post hello before assigning onmessage,
// so it could not hear the answer — invisible until something drove both
// windows at once.
chan.postMessage({ type: "hello" });
window.addEventListener("focus", () => chan.postMessage({ type: "hello" }));
</script>`;
await writeFile(join(ROOT, "research/assets/live-audience.html"), audience);

console.log(`✓ going live: ${slides.length} slides — ${Object.entries(deck.counts).map(([k, v]) => `${v} ${k}`).join(", ")}`);
console.log(`  presenter and audience views, synced by BroadcastChannel, no backend`);
