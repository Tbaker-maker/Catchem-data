// build-editor.mjs — Catch'em Creators, the editor.
//
// Tyler, 2026-08-23: "Make it so creators can edit and make their own card
// combos. This is a great way of getting people back every day."
//
// He is right about the mechanism. The current page is a MENU - ten pairings we
// chose - and a menu is something you read once. An editor is something you come
// back to, because the next idea is theirs rather than ours.
//
// WHAT IS DELIBERATELY NOT EDITABLE:
//   the watermark      - three points, footer plus two faint marks set into the
//                        artwork. Tyler's model: the watermark IS the free tier,
//                        and removing it becomes the gated feature later. Which
//                        also means the free tier markets us on every post it
//                        makes, so the more it is used the more it is worth.
//   the artist credit  - renders from card data and cannot be cleared.
//
// Ships a 1.55MB slim index rather than the 6.1MB catalogue: id, name, artist,
// set, year, rarity. Everything else is a lookup nobody needs in a browser.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { artistRevisits } from "./card-relations.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

// THE FORM ID COMES FROM .env AND NEVER FROM THE REPO. Same treatment as the X
// keys: read at build time, baked into the artifact, absent from source and
// from git. This repo is public - a hardcoded endpoint invites spam and names
// the destination inbox.
//
// ABSENT IS A VALID STATE, NOT AN ERROR. Tyler creates the form; until he pastes
// the id into .env the editor builds fine and the feedback controls say plainly
// that sending is not wired yet. A build that fails because a form is missing
// would block every other thing this file makes.
const { loadEnv: loadEnvForForm } = await import("./lib/load-env.mjs");
loadEnvForForm();
const FORM_ID = (process.env.FORMSPREE_FEEDBACK_ID || "").trim();
const FORM_ENDPOINT = FORM_ID ? "https://formspree.io/f/" + FORM_ID : "";

const cat = await J("data/card-catalogue.json");
if (!cat) { console.log("· editor: no catalogue"); process.exitCode = 0; }
else {
  const { LAYOUTS } = await import("./layouts.mjs");
  // Slim index. Cards with no illustrator are KEPT but flagged - Tyler asked to
  // be able to pick them, and the missing credit is a dataset backfill lag
  // rather than a Pokemon decision, so hiding them would hide 43% of 2024.

  const themes = await J("data/themes.json");
  const sets = [...new Set(Object.values(cat.cards).map(c => c.setName).filter(Boolean))].sort();
  const index = Object.entries(cat.cards).map(([id, c]) => ({
    i: id, n: c.name, a: c.artist ?? null, s: c.setName,
    y: (c.releaseDate ?? "").slice(0, 4), r: c.rarity ?? "", k: c.attackNames ?? undefined, p: typeof c.price === "number" ? Math.round(c.price * 100) / 100 : null,
  }));
  // WHEN THESE PRICES WERE READ, computed once. Hoisted to this scope because
  // two places need it: the row builder, which stores a date only where it
  // DIFFERS, and the page constant PRICES_AS_OF that the tally prints.
  const priceDateOf = (id) => (cat.cards[id] && cat.cards[id].priceUpdatedAt) || "";
  const pdCount = {};
  for (const c of index) { const d = priceDateOf(c.i); if (d) pdCount[d] = (pdCount[d] ?? 0) + 1; }
  const COMMON_PRICE_DATE = Object.entries(pdCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  // ── THE TUTORIAL'S OPENING SENTENCE, DERIVED ─────────────────────────────
  // It used to be typed, and it was wrong: "the widest gap by one illustrator
  // in the whole catalogue" over a pair separated by 25 years, while six
  // illustrators span 27 between their earliest and latest cards. The relation
  // never measured career span - it measures the longest anyone has gone
  // between drawing the SAME POKEMON twice, which is the narrower and better
  // claim. Computing the sentence from the relation means the two cannot
  // disagree again, and if the catalogue ever yields a wider pair the tutorial
  // follows it without anybody remembering to.
  const TUT = await (async () => {
    const FALLBACK = { cards: ["neo1-40", "sv9-20"],
      line: "Two cards are already in your tray. Press the button — that's a post.",
      caption: "Naoyo Kimura drew both of these, 25 years apart." };
    try {
      const top = (await artistRevisits({ minGap: 18, limit: 1 }))[0];
      if (!top) return FALLBACK;
      const e = top.evidence;
      const who = (e.artist || "").split(" ").pop() || e.artist;
      return { cards: top.cards,
        line: who + " drew this " + e.name + " in " + e.firstYear +
              ", then again in " + e.latestYear + ". " + e.gap +
              " years. Press the button — that's a post.",
        caption: e.artist + " drew both of these, " + e.gap + " years apart." };
    } catch { return FALLBACK; }
  })();

  // Attrs are loaded before the template so the build-time exemplar can walk
  // evolvesFrom against the same data the page ships.
  const attrsAtBuild = (await J('data/card-attrs.json'))?.cards ?? {};

  // Soft launch: CATCHEM_TODAY=1 bakes a Save-this-picture banner.
  const TODAY_COPY = "Carvanha or Sharpedo?\n\nKusajima, 2003.";
  const TODAY_REPLY = "Carvanha — left — Ruby & Sapphire 2003\nSharpedo — right — Ruby & Sapphire 2003\n\nHajime Kusajima.\n\nwhich one did you pull first";
  let TODAY_IMG = "";
  if (process.env.CATCHEM_TODAY === "1") {
    for (const p of [
      "/workspace/artifacts/post.jpg",
      join(ROOT, "research/assets/post.jpg"),
    ]) {
      if (existsSync(p)) {
        TODAY_IMG = "data:image/jpeg;base64," + readFileSync(p).toString("base64");
        break;
      }
    }
  }

  await mkdir(join(ROOT, "research/assets"), { recursive: true }).catch(() => {});
  await writeFile(join(ROOT, "research/assets/card-index.json"), JSON.stringify(index));

  const html = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><title>Catch'em Creators — build a post</title>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Sora:wght@300;400;600&family=JetBrains+Mono:wght@400;500&display=swap');
:root{
  --ink:#0a0c12; --panel:#11141c; --raise:#171b25; --line:#20252f;
  --text:#e8ebf2; --soft:#8a93a6; --faint:#5a6273;
  /* --dim was read by .broke, .fb and .fbnote and DEFINED NOWHERE, so those
     borders and that note rendered with an invalid colour — which in CSS
     means the declaration is dropped and the element inherits whatever was
     there. Same value as --faint, which is what the usages assumed. */
  --dim:#5a6273;
  --live:#36d399; --warn:#d9a441;
  --display:'Syne',-apple-system,system-ui,sans-serif; --body:-apple-system,BlinkMacSystemFont,'Sora',system-ui,sans-serif; --mono:ui-monospace,'SF Mono','JetBrains Mono',monospace;
  --ease:cubic-bezier(.22,.61,.36,1);
  --shadow-border:0 0 0 1px rgba(255,255,255,.06);
}
*{box-sizing:border-box}
html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--ink);color:var(--text);font:300 16px/1.6 var(--body);padding:0 0 160px;overflow-x:hidden}
.wrap{max-width:1000px;margin:0 auto;padding:0 24px;padding-left:max(24px, env(safe-area-inset-left));padding-right:max(24px, env(safe-area-inset-right));overflow-x:hidden}
button{-webkit-appearance:none;appearance:none}
button:not(:disabled),[role="button"]:not(:disabled){cursor:pointer}

/* Masthead — type does the work, no hero graphic, no gradient. */
.top{padding:32px 0 22px;border-bottom:1px solid var(--line);margin-bottom:22px}
h1{font:800 clamp(28px,5.4vw,44px)/1 var(--display);letter-spacing:-.028em;margin:0 0 10px}
h1 em{font-style:normal;color:var(--live)}
.lede{color:var(--soft);font-size:16px;max-width:52ch;margin:0}

/* Steps — a real sequence, so numbering earns its place. */
.promptbar{margin-bottom:20px}
.askrow{display:flex;gap:8px;align-items:stretch;min-width:0}
#ask,#label{flex:1;min-width:0;width:100%;background:var(--panel);border:1px solid var(--line);border-radius:14px;
  color:var(--text);padding:18px 20px;font:400 17px var(--body)}
#ask{width:auto}
#label{display:block;min-height:96px;resize:vertical;line-height:1.45;margin-bottom:18px}
#askgo{flex:0 0 auto;min-width:72px}
#ask:focus,#label:focus{outline:none;border-color:var(--live)}
.suggest{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
.sg{background:var(--panel);border:1px solid var(--live);color:var(--live);border-radius:8px;
  padding:7px 13px;font:500 13.5px var(--body);cursor:pointer}
.egs{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:stretch}
.eg{background:transparent;border:1px solid var(--line);color:var(--soft);border-radius:16px;
  padding:9px 16px;font:400 14px var(--body);cursor:pointer;text-align:left;line-height:1.35}
.eg:hover{border-color:var(--live);color:var(--live)}
.eg.demo{border-color:var(--live);color:var(--text);padding:12px 18px;flex:1 1 220px}
.eg.demo:hover{background:rgba(54,211,153,.07)}
.egkicker{display:block;font:500 9.5px var(--mono);letter-spacing:.16em;text-transform:uppercase;
  color:var(--live);margin:0 0 4px}
.hooklabel{font:500 9.5px var(--mono);color:var(--faint);letter-spacing:.15em;margin:16px 0 8px}
.hooks{display:flex;flex-direction:column;gap:7px}
.hookchip{background:transparent;border:1px solid var(--line);color:var(--soft);border-radius:10px;
  padding:11px 14px;font:400 14.5px var(--body);cursor:pointer;text-align:left;line-height:1.4}
.hookchip:hover{border-color:var(--live);color:var(--live)}
.askreply{color:var(--live);font:400 14px var(--body);margin-top:12px;min-height:20px}
.askreply.bad{color:var(--warn)}
.modes{display:flex;padding:3px;background:var(--raise);border-radius:12px;margin:0 0 22px;gap:3px}
.mode{flex:1;border:0;background:transparent;color:var(--soft);border-radius:9px;padding:10px 12px;
  font:600 15px var(--body);min-height:44px}
.mode.on{background:var(--panel);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.35)}
body[data-mode="reply"] #postmode,body[data-mode="reply"] .tut{display:none}
body[data-mode="post"] #office{display:none}
body[data-mode="reply"] .advanced,body[data-mode="reply"] .ideas,body[data-mode="reply"] .streakwrap{display:none}
.morefacts{margin-top:14px;border:0;padding:0}
.morefacts > summary{cursor:pointer}
.replylede{margin:0 0 14px;color:var(--soft);font:400 16px/1.45 var(--body)}
.howmany{display:flex;align-items:center;justify-content:space-between;gap:12px;
  background:var(--panel);border-radius:14px;padding:2px 6px 2px 16px;min-height:52px;margin:0 0 18px}
.howmany span{font:400 16px var(--body);color:var(--text)}
.howmany select{width:auto;max-width:62%;flex:1;background:transparent;border:0;color:var(--soft);
  font:400 16px var(--body);text-align:right;padding:14px 28px 14px 8px;appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath fill='%238a93a6' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 8px center}
.howmany select:focus{outline:none;color:var(--text)}
.office{margin:0;padding:0;background:transparent;border:0}
.office textarea{min-height:120px;border-radius:14px;padding:16px;background:var(--panel);margin-bottom:12px}
.office .go{width:100%}
.textlink{display:block;width:100%;margin:10px 0 0;background:none;border:0;color:var(--faint);
  font:400 15px var(--body);padding:10px;min-height:44px;text-align:center}
.textlink:hover{color:var(--live)}
#copyreply{width:100%;margin-top:10px}
.officehint{margin:12px 0 0}
.advanced{margin-bottom:20px}
.advanced summary{color:var(--faint);font:400 14px var(--body);cursor:pointer;padding:8px 0;list-style:none}
.advanced summary::-webkit-details-marker{display:none}
.advanced summary:before{content:"▸ ";color:var(--faint)}
.advanced[open] summary:before{content:"▾ "}
.advanced summary:hover{color:var(--live)}
.ratingrow{background:var(--panel);border:1px solid var(--line);border-radius:13px;
  padding:16px 18px;margin-bottom:14px}
.ratingrow .chip.on{border-color:var(--live);color:var(--live);background:rgba(54,211,153,.08)}
.ratingwhy{font:400 12.5px var(--body);color:var(--faint);margin-top:10px;line-height:1.55}
.moodrow{background:linear-gradient(180deg,rgba(54,211,153,.05),transparent),var(--panel);
  border:1px solid var(--line);border-radius:13px;padding:16px 18px;margin-bottom:22px}
.moodlabel{display:block;font:500 10.5px var(--mono);color:var(--faint);letter-spacing:.16em;margin-bottom:11px}
.moodrow .chip{font-size:14.5px}
.moodrow .chip.on{border-color:var(--live);color:var(--live);background:rgba(54,211,153,.08)}
.steps{display:grid;grid-template-columns:1.1fr .6fr 1fr .9fr 1.2fr;gap:18px;margin-bottom:44px}
.refuse{background:#1a1410;border:1px solid #3d2f1a;border-radius:13px;padding:14px 17px;margin-bottom:18px;color:#d9a441;font-size:14px;line-height:1.55}
.step{min-width:0}
.step .n{font:500 11px/1 var(--mono);color:var(--faint);letter-spacing:.14em;display:block;margin-bottom:10px}
.step .t{font:600 14.5px/1.3 var(--body);margin-bottom:12px;display:block}
select,input,textarea{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:9px;
  color:var(--text);padding:13px 14px;font:400 16px var(--body);transition:border-color .18s var(--ease)}
select:focus,input:focus{outline:none;border-color:var(--soft)}
.chips{display:flex;flex-wrap:wrap;gap:7px}
.chip{background:var(--panel);border:1px solid var(--line);color:var(--soft);border-radius:9px;
  padding:10px 14px;font:400 13.5px var(--body);cursor:pointer;transition:all .18s var(--ease)}
.chip:hover{border-color:var(--faint);color:var(--text)}
.chip.on{border-color:var(--live);color:var(--live);background:rgba(54,211,153,.07)}
.chip[data-n]{font-family:var(--mono);font-weight:500;min-width:44px;text-align:center}

/* Ideas — a filmstrip, not a list. */
.ideas{display:grid;gap:9px;margin-bottom:40px}
.idea{background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:17px 20px;
  cursor:pointer;transition:all .2s var(--ease)}
.idea:hover{border-color:var(--faint);transform:translateY(-1px)}
.idea b{display:block;font:600 16.5px/1.35 var(--body);margin-bottom:4px}
.idea i{font-style:normal;color:var(--faint);font:400 12.5px var(--mono);display:block}
.moodcard{padding:12px 0;border-top:1px solid var(--line)}
.moodcard:first-of-type{border-top:0;padding-top:6px}
.mc-name{display:block;font:600 16px var(--body);color:var(--text)}
.mc-meta{display:block;font:400 11.5px var(--mono);color:var(--faint);margin-top:2px;letter-spacing:.02em}
.mc-why{display:block;font:300 15px var(--body);color:var(--soft);margin-top:7px;line-height:1.5}
.idea .hook{color:var(--soft);font-size:14px;margin-top:9px}

/* THE SIGNATURE: the binder page. Empty pockets show what still fits. */
/* SPEND THE ACCENT HERE. The designer flagged 16 uses across the page — an
   accent used everywhere accents nothing. It now appears on the active state,
   the primary action, and the streak day, because the streak is the one number
   we actually want somebody to feel. */
.streak{background:linear-gradient(180deg,rgba(54,211,153,.05),transparent),var(--panel);border:1px solid var(--line);border-radius:13px;
  padding:15px 18px;margin-bottom:16px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.streak .day{font:800 38px var(--display);color:var(--live);line-height:.95;letter-spacing:-.02em}
.streak .desc{font:400 14px var(--body);color:var(--soft);flex:1;min-width:180px}
.streak .desc b{color:var(--text);font-weight:600}
.streak .left{font:500 11px var(--mono);color:var(--faint);letter-spacing:.1em}
.streak button{background:transparent;border:1px solid var(--line);color:var(--soft);
  border-radius:9px;padding:9px 14px;font:400 13px var(--body);cursor:pointer}
.streak button.go{background:var(--live);color:var(--ink);border:0;font-weight:600}
/* THE PRIMARY ACTION WAS UNSTYLED. .go only existed inside .streak and
   .streakactions, so #make — the button the whole page exists to get pressed —
   rendered as a plain grey browser button, indistinguishable from Copy, Share
   and Download sitting beside it. */
button.go{background:var(--live);color:var(--ink);border:0;font-weight:700;
  border-radius:12px;padding:14px 22px;font-size:15px;cursor:pointer;min-height:48px}
button.go:hover{filter:brightness(1.08)}
button.go:disabled{opacity:.45;cursor:default;filter:none}
.broke{background:none;border:1px solid var(--dim);color:var(--dim);border-radius:999px;padding:8px 14px;font-size:13px;cursor:pointer;margin:0 0 14px}
.broke:hover{color:var(--live);border-color:var(--live)}
.fb{border:1px solid var(--dim);border-radius:14px;padding:16px;margin:0 0 18px}
.fbtitle{margin:0 0 10px;font-size:15px;font-weight:600}
.fb textarea,.fb input{width:100%;box-sizing:border-box;margin:0 0 10px}
.fb textarea{min-height:90px}
.fbnote{margin:0 0 12px;font-size:12px;color:var(--dim);line-height:1.4}
.fbstat{margin:10px 0 0;font-size:13px}
.lrow{display:flex;align-items:flex-start;gap:8px;margin:0 0 8px}
.lrow .lineopt{flex:1;margin:0}
/* 44px MINIMUM TAP TARGET even though it reads small. A control that looks
   secondary still has to be hittable with a thumb on a moving train. */
.another{flex:0 0 auto;min-height:44px;min-width:44px;padding:0 12px;background:none;
  border:1px solid var(--line);border-radius:10px;color:var(--dim);font-size:12px;cursor:pointer}
.another:hover{color:var(--live);border-color:var(--live)}
.another:disabled{opacity:.32;cursor:default;border-color:var(--line);color:var(--faint)}
.another:disabled:hover{color:var(--faint);border-color:var(--line)}
.tut{border:1px solid var(--live);border-radius:14px;padding:14px 16px;margin:0 0 18px}
.tutline{margin:0 0 12px;font-size:15px;line-height:1.45}
.tutacts{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.tutskip{background:none;border:none;color:var(--dim);text-decoration:underline;cursor:pointer;font-size:13px;padding:6px}
.page-label{font:500 11px/1 var(--mono);color:var(--faint);letter-spacing:.14em;margin:0}
.pagerow{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.pageacts{display:flex;gap:8px;align-items:center}
#anotherset,#backset{min-height:44px;min-width:44px;padding:10px 16px;font:500 14px var(--body);
  color:var(--live);border:1px solid var(--live);border-radius:10px;background:transparent}
#anotherset:hover,#backset:hover{background:rgba(54,211,153,.08)}
#anotherset:disabled,#backset:disabled{opacity:.32;cursor:not-allowed}
#backset{color:var(--soft);border-color:var(--line)}
#backset:hover{color:var(--live);border-color:var(--live)}
.binder{background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:28px;
  display:grid;gap:14px;justify-content:center;margin-bottom:16px;
  box-shadow:var(--shadow-border), 0 24px 64px rgba(0,0,0,.35)}
.pocket{aspect-ratio:745/1040;border-radius:12px;background:var(--raise);
  border:1px dashed var(--line);position:relative;overflow:hidden;
  animation:settle .34s var(--ease) both}
.pocket.filled{border-style:solid;border-color:transparent;background:transparent;
  box-shadow:0 10px 28px rgba(0,0,0,.45)}
.pocket img{width:100%;height:100%;object-fit:contain;display:block;
  outline:1px solid rgba(255,255,255,.08);outline-offset:-1px}
.pocket .x{position:absolute;top:5px;right:5px;width:22px;height:22px;border-radius:50%;border:0;
  background:rgba(10,12,18,.82);color:#fff;font-size:14px;line-height:1;cursor:pointer;opacity:0;
  transition:opacity .16s var(--ease)}
.pocket:hover .x{opacity:1}
@keyframes settle{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.pocket{animation:none}.idea:hover{transform:none}}

.status{font:400 13px var(--mono);color:var(--faint);margin-bottom:10px;min-height:18px}
.tally{display:flex;gap:22px;flex-wrap:wrap;background:var(--panel);border:1px solid var(--line);
  border-radius:13px;padding:14px 18px;margin-bottom:20px}
.tally div{min-width:0}
.tally .k{font:500 10.5px var(--mono);color:var(--faint);letter-spacing:.13em;display:block;margin-bottom:3px}
.tally .v{font:500 19px var(--mono);color:var(--text)}
.tally .v.have{color:var(--live)}
.pocket .own{position:absolute;bottom:5px;left:5px;border:0;border-radius:9px;padding:3px 7px;
  font:500 9.5px var(--mono);cursor:pointer;background:rgba(10,12,18,.86);color:var(--faint);opacity:0;
  transition:opacity .16s var(--ease)}
.pocket:hover .own{opacity:1}
.pocket .own.yes{opacity:1;background:var(--soft);color:var(--ink)}
.status.bad{color:var(--warn)}
.reachrow{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.reachrow label{font:500 10.5px var(--mono);color:var(--faint);letter-spacing:.14em}
#followers{width:110px;background:var(--ink);border:1px solid var(--line);border-radius:9px;color:var(--text);padding:9px 11px;font:400 14px var(--mono)}
.reachnote{font:400 12.5px var(--body);color:var(--faint)}
.lines{margin-bottom:14px}
.selfreply{background:var(--panel);border:1px solid var(--line);border-radius:12px;
  padding:14px 16px;margin-bottom:14px}
.selfreply .srhead{font:500 10.5px var(--mono);color:var(--faint);letter-spacing:.16em;margin-bottom:9px}
.selfreply pre{margin:0 0 11px;font:400 13.5px var(--mono);color:var(--soft);white-space:pre-wrap}
.selfreply input{width:100%;box-sizing:border-box;margin:0 0 11px;background:var(--raise);
  border:1px solid var(--line);color:var(--text);border-radius:8px;padding:10px 12px;font:400 14px var(--body)}
  white-space:pre-wrap;line-height:1.65}
.selfreply button{background:transparent;border:1px solid var(--line);color:var(--soft);
  border-radius:8px;padding:8px 14px;font:400 13px var(--body);cursor:pointer}
.selfreply button:hover{border-color:var(--live);color:var(--live)}
.lines .lhead{font:500 10.5px var(--mono);color:var(--faint);letter-spacing:.16em;margin-bottom:9px}
.lineopt{display:block;width:100%;text-align:left;background:var(--panel);border:1px solid var(--line);
  border-radius:11px;padding:12px 15px;margin-bottom:7px;cursor:pointer;transition:border-color .16s var(--ease)}
.lineopt:hover{border-color:var(--live)}
.lineopt .tag2{display:inline-block;font:500 9px var(--mono);color:var(--faint);letter-spacing:.14em;
  border:1px solid var(--line);border-radius:5px;padding:2px 6px;margin-right:9px;vertical-align:1px}
.lineopt .txt{font:300 16px var(--body);color:var(--text)}
.acts{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
button.go,#make{background:var(--live);color:var(--ink);border:0;border-radius:13px;padding:14px 26px;
  font:600 15px var(--body);min-height:48px;transition:opacity .18s var(--ease)}
button.go:hover,#make:hover{opacity:.9}
button.pri{background:var(--live);color:var(--ink);border:0;border-radius:13px;padding:14px 26px;
  font:600 15px var(--body);cursor:pointer;transition:opacity .18s var(--ease)}
button.pri:hover{opacity:.9}
button.sec{background:transparent;color:var(--soft);border:1px solid var(--line);border-radius:13px;
  padding:14px 20px;font:400 14.5px var(--body);cursor:pointer;transition:all .18s var(--ease)}
button.sec:hover{border-color:var(--faint);color:var(--text)}
button:disabled{opacity:.32;cursor:not-allowed}
#todaypost{margin:0 0 22px}
#todaypost img{width:100%;height:auto;border-radius:14px;display:block;border:1px solid var(--line);background:var(--panel)}
#todaypost .go{width:100%;margin-top:12px}
#todaycopy{white-space:pre-wrap;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0 0;font:400 17px/1.5 var(--body);color:var(--text)}
#outimg,#todaypost img,#savesheet img{-webkit-touch-callout:default!important;-webkit-user-select:auto;user-select:auto;pointer-events:auto}
#savesheet{display:none;position:fixed;inset:0;z-index:80;background:#0a0c12;padding:16px 16px calc(20px + env(safe-area-inset-bottom));overflow:auto}
#savesheet.on{display:block}
#savesheet img{width:100%;height:auto;border-radius:12px;margin:12px 0}
#savesheet .go{width:100%;margin-top:8px}
#savesheet .textlink{margin-top:4px}
.savehint{font:400 13.5px var(--body);color:var(--live);margin:10px 0 0;text-align:center}
canvas{max-width:100%;border-radius:13px;margin-top:24px;display:none;border:1px solid var(--line)}

/* Search — the escape hatch, deliberately quiet. */
details{margin-bottom:36px;border-top:1px solid var(--line);padding-top:18px}
summary{color:var(--faint);font:400 13.5px var(--body);cursor:pointer;list-style:none}
summary::-webkit-details-marker{display:none}
summary:before{content:"→ ";color:var(--faint)}
.controls{display:grid;grid-template-columns:2fr 1fr .8fr;gap:9px;margin:16px 0 12px}
.pager{display:flex;gap:10px;align-items:center;justify-content:center;margin-top:14px;
  font:500 12.5px var(--mono);color:var(--faint);flex-wrap:wrap}
.pager button{background:var(--panel);border:1px solid var(--line);color:var(--soft);
  border-radius:9px;padding:9px 15px;font:400 13.5px var(--body);cursor:pointer}
.pager button:disabled{opacity:.3;cursor:not-allowed}
.pager input{width:70px;text-align:center;padding:8px;font:500 12.5px var(--mono)}
.imgstatus{background:rgba(217,164,65,.1);border:1px solid rgba(217,164,65,.3);
  border-radius:9px;padding:11px 14px;margin-bottom:12px;color:var(--warn);font:400 13px var(--body)}
.hit.failed img{display:none}
.hit.failed{background:rgba(217,164,65,.08);border:1px dashed rgba(217,164,65,.35)}
.hit .failmsg{display:none;font:500 9.5px var(--mono);color:var(--warn);padding:16px 4px;line-height:1.5}
.hit.failed .failmsg{display:block}
.monbar{margin-bottom:14px}
#monq{width:100%;background:var(--ink);border:1px solid var(--line);border-radius:11px;
  color:var(--text);padding:13px 15px;font:400 15px var(--body);margin-bottom:9px}
#monq:focus{outline:none;border-color:var(--live)}
#monchips{max-height:104px;overflow-y:auto;margin-bottom:9px}
#monchips .chip.on{border-color:var(--live);color:var(--live);background:rgba(54,211,153,.08)}
.streakstate{display:inline-block;font:500 10px var(--mono);letter-spacing:.14em;
  padding:4px 9px;border-radius:6px;margin-left:9px}
.streakstate.on{background:rgba(54,211,153,.15);color:var(--live)}
.streakstate.off{background:rgba(138,147,166,.12);color:var(--faint)}
.streakwrap summary{color:var(--soft);font:400 15px var(--body);cursor:pointer;
  padding:10px 0;list-style:none}
.streakwrap summary::-webkit-details-marker{display:none}
.streakwrap summary:before{content:"▸ ";color:var(--faint)}
.streakwrap[open] summary:before{content:"▾ "}
.streakwrap summary:hover{color:var(--live)}
.streakexplain{font:300 14px var(--body);color:var(--soft);margin:9px 0;line-height:1.55;max-width:62ch}
.streakactions button:disabled{opacity:.45;cursor:default}
.streakactions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}
.streakactions button{background:transparent;border:1px solid var(--line);color:var(--soft);
  border-radius:8px;padding:8px 13px;font:400 13px var(--body);cursor:pointer}
.streakactions button.go{background:var(--live);color:var(--ink);border:0;font-weight:600}
.viberow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:0 0 12px}
.viberow .moodlabel{margin:0 6px 0 0}
.when{font:400 13px var(--body);color:var(--faint);margin:10px 0 0;line-height:1.55;max-width:62ch}
.sortlabel{font:500 9.5px var(--mono);color:var(--faint);letter-spacing:.16em;margin-right:4px}
.sortrow .chip.on{border-color:var(--live);color:var(--live)}
.results{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:9px;
  max-height:290px;overflow-y:auto;padding:3px}
.hit{cursor:pointer;text-align:center;border-radius:9px;padding:6px;transition:background .16s var(--ease)}
.hit:hover{background:var(--raise)}
.hit img{width:100%;aspect-ratio:745/1040;object-fit:contain;border-radius:9px;background:var(--raise)}
.hit b{display:block;font:600 11px/1.3 var(--body);margin-top:6px}
.hit i{display:block;font-style:normal;font:400 9.5px var(--mono);color:var(--faint);margin-top:2px}
.hit .nocred{color:var(--warn)}
.empty{color:var(--faint);font-size:14px;grid-column:1/-1;padding:22px 0;text-align:center}
.foot{color:var(--faint);font-size:13px;margin-top:46px;border-top:1px solid var(--line);padding-top:20px;line-height:1.7}
:focus-visible{outline:2px solid var(--live);outline-offset:2px}
@media(max-width:760px){
  .wrap{padding:0 14px;padding-left:max(14px, env(safe-area-inset-left));padding-right:max(14px, env(safe-area-inset-right))}
  body{padding-bottom:24px}
  .steps{grid-template-columns:1fr;gap:22px}
  .controls{grid-template-columns:1fr}
  .pager{gap:6px}
  .pager button{padding:8px 10px}
  .binder{padding:12px;gap:8px;border-radius:14px;width:100%;max-width:100%}
  .office .officerow{display:none}
  .seg{position:relative;z-index:2}
  .egs{flex-direction:column}
  .eg,.eg.demo{flex:1 1 auto;width:100%}
  .pageacts{width:100%}
  .pageacts .another,#anotherset,#backset{flex:1;min-height:44px}
  .acts{position:sticky;bottom:0;z-index:8;
    display:grid;grid-template-columns:1fr 1fr;gap:8px;
    background:linear-gradient(180deg,transparent,var(--ink) 22%);
    padding:14px 0 calc(12px + env(safe-area-inset-bottom));margin:0 -14px;padding-left:14px;padding-right:14px}
  .acts button{width:auto;min-height:48px}
  .acts #make,.acts .go{grid-column:1 / -1}
  .pocket .x,.pocket .own{opacity:1}
  #outimg{scroll-margin-bottom:160px}
  .selfreply pre,.lineopt .txt,.officehint,.askreply{overflow-wrap:anywhere}
}
</style>
<body data-mode="post">
<div class="wrap">
${TODAY_IMG ? `<div id="todaypost">
<p class="hooklabel">TODAY'S POST — tap Save picture</p>
<img src="${TODAY_IMG}" alt="two cards one painting" width="1600" height="980">
<button type="button" class="go" id="savetoday" onclick="saveToday()">Save picture</button>
<pre id="todaycopy">${TODAY_COPY}</pre>
<button type="button" class="textlink" onclick="copyToday('todaycopy')">Copy the post</button>
<p class="hooklabel">REPLY TO YOURSELF — after the image is up</p>
<pre id="todayreply">${TODAY_REPLY}</pre>
<button type="button" class="textlink" onclick="copyToday('todayreply')">Copy the reply</button>
</div>` : ""}
<div id="savesheet">
  <p class="hooklabel">PRESS AND HOLD THE PICTURE, OR TAP SAVE TO PHOTOS</p>
  <img id="savepreview" alt="your post">
  <button type="button" class="go" id="savephotos">Save to Photos</button>
  <button type="button" class="textlink" id="saveclose">Close</button>
</div>
<div class="top">
  <h1 id="pagetitle">Make a post<em>.</em></h1>
  <p class="lede" id="pagelede">Say what you want to post. We'll find the cards.</p>
</div>

<div class="modes" id="modes" role="tablist">
  <button type="button" class="mode on" data-mode="post">Post</button>
  <button type="button" class="mode" data-mode="reply">Reply</button>
</div>
<label class="howmany">How many cards
  <select id="cardcount" aria-label="How many cards">
    <option value="1">1 — one card</option>
    <option value="2">2 — a pair</option>
    <option value="3">3 — a row</option>
    <option value="4">4 — a square</option>
    <option value="6">6 — two rows</option>
    <option value="8">8 — a tall page</option>
    <option value="9">9 — a binder page</option>
  </select>
</label>

<div id="boot" style="background:#1a1410;border:1px solid #3d2f1a;border-radius:10px;padding:12px 14px;margin-bottom:16px;color:#d9a441;font:400 13.5px system-ui,sans-serif;line-height:1.5">Starting…</div>
<div class="promptbar" id="postmode">
  <div class="askrow">
    <input id="ask" placeholder="the fishes, the birds, a Charizard line, what Kimura drew twice…" autocomplete="off" enterkeyhint="go">
    <button type="button" class="go" id="askgo">Find</button>
  </div>
  <div class="suggest" id="suggest" hidden></div>
  <div class="egs" id="egs"></div>
  <details class="morefacts">
    <summary class="hooklabel">From the catalogue</summary>
    <div class="hooks" id="hooks"></div>
  </details>
  <div class="askreply" id="askreply"></div>
</div>
<div class="office" id="office">
  <p class="replylede">Paste their post. We'll pick a card and a line you can put under it.</p>
  <textarea id="cta" rows="4" enterkeyhint="go" placeholder="Show me a better Charizard below…"></textarea>
  <button type="button" class="go" id="ctago">Answer</button>
  <button type="button" class="textlink" id="ctademo">Try an example</button>
  <button type="button" class="sec" id="copyreply" hidden>Copy reply</button>
  <p class="officehint" id="officehint" hidden></p>
</div>
<!-- ORDER IS THE INSTRUCTION. Compose used to sit BELOW "Browse, filter and
     fine-tune" and below the full card search, so a first-time visitor met two
     collapsed filter panels before they met the thing that makes a post. The
     tray, the caption and the button now follow the ask box directly; filters
     stay available in the details block underneath, where somebody who wants
     them will look. -->
<div class="tut" id="tut" hidden>
  <p class="tutline" id="tutline"></p>
  <div class="tutacts">
    <button class="go" id="tutgo"></button>
    <button class="tutskip" id="tutskip">Skip this</button>
  </div>
</div>
<div class="pagerow">
  <div class="page-label" id="plabel">YOUR PAGE</div>
  <div class="pageacts">
    <button type="button" class="another" id="backset" hidden>Back</button>
    <button type="button" class="another" id="anotherset" hidden>Another</button>
  </div>
</div>
<div class="binder" id="tray"></div>
<div class="status" id="st"></div>
<div class="tally" id="tally" hidden></div>
<textarea id="label" rows="3" placeholder="Your line — or leave it blank and let the cards talk"></textarea>
<div class="viberow" id="viberow" hidden>
  <span class="moodlabel">VIBE</span>
  <button type="button" class="chip on" data-v="">All</button>
  <button type="button" class="chip" data-v="observation">Observed</button>
  <button type="button" class="chip" data-v="question">Asked</button>
  <button type="button" class="chip" data-v="divide">Split</button>
  <button type="button" class="chip" data-v="confession">Soft</button>
</div>
<div class="lines" id="lines" hidden></div>
<div class="selfreply" id="selfreply" hidden></div>
<p class="savehint" id="savehint"></p>
<img id="outimg" alt="your image — press and hold to save" hidden>
<div class="acts">
<button class="go" id="make">Make the image</button>
<button id="share" onclick="shareImage()">Save to Photos</button>
<button id="dl" onclick="dlImage()">Download</button>
<button id="copy" onclick="copyImage()">Copy image</button>
<button onclick="openImage()">Open picture</button>
<button id="retryscale" hidden onclick="retryAtHalf()">Try again at half size</button>
</div>
<div class="status bad" id="blankwarn" hidden></div>
<canvas id="cv"></canvas>

<details class="advanced"><summary>Browse, filter and fine-tune</summary>
<div class="ratingrow">
  <span class="moodlabel">NARROW BY RATING — every one derives from a printed field</span>
  <div class="chips" id="frating"></div>
</div>

<div class="moodrow">
  <span class="moodlabel">HOW ARE YOU FEELING?</span>
  <div class="chips" id="fmood"></div>
</div>

<div class="steps">
  <div class="step"><span class="n">01 / SET</span><span class="t">Narrow it down, or don't</span>
    <select id="fset"><option value="">Every set</option>${sets.map(x => `<option>${x.replace(/&/g, "&amp;")}</option>`).join("")}</select></div>
  <div class="step"><span class="n">02 / COUNT</span><span class="t">How many cards</span>
    <div class="chips" id="fcount">${[1,2,3,4,6,8,9].map(n => `<button class="chip" data-n="${n}">${n}</button>`).join("")}</div></div>
  <div class="step"><span class="n">03 / SLAB</span><span class="t">Show them slabbed</span>
    <div class="chips" id="fslab">
      <button class="chip on" data-s="">Raw</button>
      <button class="chip" data-s="green">Green</button>
      <button class="chip" data-s="gold">Gold</button>
      <button class="chip" data-s="black">Black</button>
      <button class="chip" data-s="ice">Ice</button>
    </div></div>
  <div class="step"><span class="n">04 / WHY</span><span class="t">What is this for</span>
    <div class="chips" id="fintent">
      <button class="chip on" data-i="post">A post</button>
      <button class="chip" data-i="want">Want list</button>
      <button class="chip" data-i="trade">Trade list</button>
      <button class="chip" data-i="sell">Selling</button>
    </div></div>
  <div class="step"><span class="n">05 / ANGLE</span><span class="t">What kind of post</span>
    <div class="chips" id="ftheme"></div></div>
</div>

<div id="refuse" class="refuse" hidden></div>
<div id="ideas" class="ideas"></div>

<details open><summary>Search all ${index.length.toLocaleString("en-US")} cards instead</summary>
<div class="controls">
  <input id="q" placeholder="Pokémon, artist, or set" autocomplete="off">
  <select id="rar"><option value="">Any rarity</option>
    <option>Special Illustration Rare</option><option>Illustration Rare</option>
    <option>Rare Holo</option><option>Rare Secret</option><option>Rare Ultra</option></select>
  <input id="yr" placeholder="Year" inputmode="numeric">
</div>
<div class="reachrow"><label for="views">Typical views per post</label><input id="views" type="number" inputmode="numeric" placeholder="e.g. 900"><span class="reachnote" id="reachnote"></span></div>
<div class="monbar">
  <input id="monq" placeholder="Filter by Pokémon — type a name" autocomplete="off">
  <div class="chips" id="monchips"></div>
  <div class="sortrow">
    <span class="sortlabel">SORT</span>
    <button class="chip on" data-sort="mon">By Pokémon</button>
    <button class="chip" data-sort="price">Most valuable</button>
    <button class="chip" data-sort="new">Newest</button>
    <button class="chip" data-sort="old">Oldest</button>
  </div>
</div>
</details>
<div class="imgstatus" id="imgstatus" hidden></div>
<div class="results" id="res"></div>
<div class="pager" id="pager"></div>
</details>

<!-- The old streak block lived here: a paragraph, two dropdowns and a Begin
     button, rendering above the collapsed one that replaced it. I built the
     replacement and never removed what it replaced, so the page shouted about
     streaks to everyone regardless. -->
<div class="streak" id="streakbar"></div>
<button class="broke" id="brokebtn">Tell me what's broken</button>
<div class="fb" id="fb" hidden>
  <p class="fbtitle" id="fbtitle"></p>
  <div id="fbqs"></div>
  <input id="fbname" placeholder="Your name — optional">
  <p class="fbnote">Leave the name blank to stay anonymous. Blank means we send nothing that identifies you: no id, no fingerprint, nothing derived from your address.</p>
  <div class="tutacts">
    <button class="go" id="fbsend">Send</button>
    <button class="tutskip" id="fbclose">Close</button>
  </div>
  <p class="fbstat" id="fbstat"></p>
</div>

<div class="foot">Every image carries the Catch'em mark and the artist's name — the credit isn't ours to remove.
Cards marked in amber have no artist recorded in the public dataset. That's a backfill gap on recent sets,
not a Pokémon decision, and you can still use them.</div>
</div>
<script>
// ── THE 269 GROUPS WERE NEVER IN THE PAGE ─────────────────────────────────
// Tyler typed "connecting art" and got six Pokemon whose names share letters
// with "art". The parser was part of it, but the deeper cause is that this file
// shipped ZERO bytes of connecting-art data: grep the artifact and the word does
// not appear. No parser could have answered, because the answer was not there.
//
// 129 COMPLETE groups carry resolved card ids and 368 cards between them. That
// is ~15KB, which is nothing against a 3.2MB page, and it converts our
// best-evidenced dataset from invisible into searchable.
//
// PARTIAL groups are excluded: all 140 hold zero resolved ids, so shipping them
// would add names with no cards behind them.
// A THREE-STAGE LINE THAT ACTUALLY EXISTS IN THIS INDEX, picked once here so
// the page never searches for one. Verified against attrs + the shipped index:
// every stage resolves to at least one card.
const EVO_EXEMPLAR = ${JSON.stringify((() => {
  const attrs = attrsAtBuild;
  const nameOf = (id) => (cat.cards[id] || {}).name || "";
  // parent -> child, from the printed evolvesFrom field
  // NORMALISE THE MECHANIC SUFFIX. Without this, "Ninetales BREAK" counts as a
  // stage after Ninetales and every Pokemon with a BREAK or LV.X card looks
  // like a three-stage line. The first pick was Machoke -> Machamp ->
  // "Machamp BREAK", which is two real stages and a card variant.
  const MECH = / (BREAK|LV[.]X|ex|EX|GX|V|VMAX|VSTAR|Prime|Star|LEGEND)$/;
  const norm = (n) => String(n || "").replace(MECH, "").trim();
  const childOf = new Map();
  const isChild = new Set();
  for (const [id, a] of Object.entries(attrs)) {
    if (!a || !a.ev) continue;
    const child = norm(nameOf(id));
    const parent = norm(a.ev);
    if (!child || !parent || child === parent) continue;
    if (!childOf.has(parent)) childOf.set(parent, child);
    isChild.add(child);
  }
  const inIndex = new Set(index.map(c => norm(c.n)));
  // A ROOT IS A POKEMON NOTHING EVOLVES INTO. Machoke was picked as a "root"
  // and it is a middle stage; starting there gives half a line.
  for (const root of [...childOf.keys()].filter(k => !isChild.has(k))) {
    const line = [root];
    let cur = root;
    for (let i = 0; i < 3; i++) {
      const next = childOf.get(cur);
      if (!next || line.includes(next)) break;
      line.push(next); cur = next;
    }
    if (line.length >= 3 && line.every(n => inIndex.has(n))) return line[0];
  }
  return null;
})())};

const CONNECTING = ${JSON.stringify((await (async () => {
  try {
    const art = await J('data/connecting-art.json');
    // THE WIKI TABLE IS NOT THE PICTURE. Carvanha sits above Sharpedo on
    // Bulbapedia because the page is a column. On the cards, Carvanha's right
    // edge is Sharpedo's left. Spidops' web does run down onto Tarountula.
    // Direction is taken from the printed edges, with one recorded override.
    const ART_ACROSS = new Set(["ex1-51|ex1-22"]);
    // PRINTED LEFT-TO-RIGHT, not the wiki table's column order.
    // Neo Revelation beasts: Entei's claws enter Raikou from the left,
    // Raikou's lightning enters Suicune from the left. Wiki listed Raikou first.
    const ART_ORDER = {
      "neo3-13|neo3-6|neo3-14": ["neo3-6", "neo3-13", "neo3-14"],
      "pl3-148|pl3-150|pl3-149": ["pl3-148", "pl3-150", "pl3-149"],
    };
    const ART_SCENE = {
      "sv4pt5-31|sv3-8|sv4-152|sv2-42|sv2-96|sv4-91|sv3-180|sv1-151|sv4-30": "beach",
      "basep-21|basep-23|basep-22": "bird",
      "pl3-148|pl3-150|pl3-149": "bird",
      "me1-133|me1-134|me1-177": "stage",
    };
    return (art?.groups ?? [])
      .filter(g => g.resolution === "COMPLETE" && g.relation === "COMBINED_ILLUSTRATION")
      .map(g => {
        const c0 = (g.cards ?? []).map(x => (typeof x === "string" ? x : x?.id)).filter(Boolean);
        const key = c0.join("|");
        const c = ART_ORDER[key] || c0;
        const shape = g.rowShape ?? [];
        const arr0 = String(g.arrangement ?? "");
        let dir, cols, rows, sh;
        if (ART_ACROSS.has(key)) { dir = "across"; cols = c.length; rows = 1; sh = [c.length]; }
        else if (arr0.startsWith("grid")) { dir = "grid"; cols = Math.max(1, ...shape); rows = shape.length; sh = shape; }
        else if (arr0 === "vertical" || (shape.length > 1 && shape[0] === 1)) {
          dir = "down"; cols = 1; rows = c.length; sh = Array(c.length).fill(1);
        } else { dir = "across"; cols = c.length; rows = 1; sh = shape.length ? shape : [c.length]; }
        return { n: g.name ?? null, a: g.artist ?? null, r: g.relation ?? null, arr: dir, cols, rows, shape: sh, c, scene: ART_SCENE[c.join("|")] || ART_SCENE[key] || null };
      })
      .filter(g => g.c.length > 1);
  } catch (e) {
    // SILENT EMPTY IS HOW CONNECTING ART VANISHED. This catch used to `return []`
    // with no log, so a ReferenceError after an edit shipped a page whose
    // "connecting art" chip did nothing and every guard that reads CONNECTING
    // still passed on the generator.
    console.error("CONNECTING build failed:", e && e.message);
    throw e;
  }
})()))};

const THEMES = ${JSON.stringify(themes?.themes ?? [])};
const SETS = ${JSON.stringify(sets)};
${await (async () => { const { readFile: rf } = await import('node:fs/promises'); const t = JSON.parse(await rf(join(ROOT,'data/card-text.json'),'utf-8')).cards; const slim = {}; for (const [k,v] of Object.entries(t)) if (v.a && v.a.length) slim[k] = { a: v.a.slice(0,1) }; const eng = await rf(join(ROOT,'scripts/line-engine.js'),'utf-8'); return eng.replace('__CARD_TEXT__', JSON.stringify(slim)); })()}
// ONE TABLE, POST-WORTHY ONLY. Five tables keyed by the same ids repeated the
// ids ~200KB each, and a Common nobody would ever post is dead weight on a
// phone. 4.6MB became 1.6MB, which is the difference between the script running
// and the script dying — and when it dies the moods, angles and images all
// vanish together, because JS renders all three.
const MOODS = ${JSON.stringify(Object.values((await J('data/moods.json'))?.moods ?? {}).map(m => ({ id: m.id, label: m.label, emoji: m.emoji, say: m.say, cards: (m.cards ?? []).slice(0, 18).map(c => ({ id: c.id, matched: c.matched, why: c.why })) })))};
// ROWS AS ARRAYS. Each object row repeated its key names 6,658 times; positional
// arrays plus a rehydrate loop drop a quarter of the payload and, more
// importantly, parse faster — mobile is failing on the work of parsing a huge
// literal, not on memory.
const CARD_ROWS = ${await (async () => {
  const attrs = (await J('data/card-attrs.json'))?.cards ?? {};
  const bios = (await J('data/card-bios.json'))?.bios ?? {};
  const lore = (await J('data/lore.json'))?.lore ?? {};
  const ctext = (await J('data/card-text.json'))?.cards ?? {};
  const HERO_R = /Illustration Rare|Rare Holo|Rare Secret|Rare Ultra|Rare Rainbow|Rare Shiny|Special Illustration/i;
    // COMPLETE THE LINES. Sixty-eight Pokémon were needed to finish an evolution
  // line and were excluded — Metapod, Kakuna, Roselia, the stages nobody
  // chases. The post-worthy filter was right in general and wrong here: a cocoon
  // is not post-worthy alone and is essential to the line that is. Five KB.
  const FORM_P = new RegExp("^(Galarian|Alolan|Hisuian|Paldean|Dark|Mega|M|Shadow|Crystal|Light|Shining|Radiant)\\s+", "i");
  const MECH_P = new RegExp("\\s+(ex|EX|GX|V|VMAX|VSTAR|BREAK|LEGEND|Prime|Star|LV.X)$");
  const monP = (n) => { let x = String(n); for (let i = 0; i < 2; i++) x = x.replace(FORM_P, ""); return x.replace(MECH_P, "").trim().split(" ")[0]; };
  // EVERY CARD IS FINDABLE. This filter used to BE the index: hero rarity or
  // price >= $8, which shipped 6,725 of 16,468 rows. Tyler could not find the
  // card he wanted because it was never in the page - neo1-40 is an Uncommon at
  // $4.60 and sv9-20 a Common at $0.25, and the Magmar pairing that shipped on
  // 2026-08-25 could not have been built in this editor.
  //
  // A perfect matcher over an index that lacks the card still returns nothing,
  // which is why this had to change before the query parser was worth touching.
  //
  // THE TAIL IS LEAN, NOT ABSENT. Flavour text, ratings and attack names stay on
  // the cards that already carried them; the other 9,743 ship the fields search
  // and relations need. Measured: +201KB gzip against +474KB for full richness.
  // `hero` is kept as a FLAG so the no-query showcase still opens on the good
  // cards rather than alphabetically on commons.
  const isHero = (c) => HERO_R.test(c.r ?? '') || (c.p ?? 0) >= 8;
  const base = index.filter(isHero);
  const have = new Set(base.map(c => monP(c.n)));
  const evoOf = {};
  for (const c of index) if (attrs[c.i]?.ev) evoOf[monP(c.n)] = monP(attrs[c.i].ev);
  const need = new Set();
  for (const [child, parent] of Object.entries(evoOf)) {
    if (have.has(child) && !have.has(parent)) need.add(parent);
    if (have.has(parent) && !have.has(child)) need.add(child);
  }
  const extra = [];
  for (const m of need) {
    const best = index.filter(c => monP(c.n) === m && c.a).sort((x, y) => (y.p ?? 0) - (x.p ?? 0))[0];
    if (best) extra.push(best);
  }
  const richIds = new Set(base.concat(extra).map(c => c.i));
  // THE DATE MOST PRICES CARRY, computed once from the catalogue - the index
  // does not carry it.
  const priceDateOf = (id) => (cat.cards[id] && cat.cards[id].priceUpdatedAt) || "";
  const pdCount = {};
  for (const c of index) { const d = priceDateOf(c.i); if (d) pdCount[d] = (pdCount[d] ?? 0) + 1; }
  const COMMON_PRICE_DATE = Object.entries(pdCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const rows = index.map(c => {
    const A = attrs[c.i] ?? {}, B = bios[c.i] ?? {}, T = ctext[c.i] ?? {};
    const rich = richIds.has(c.i);
    const st = (A.st ?? []).filter(x => /^(Basic|Stage 1|Stage 2|Baby|ex|EX|V|VMAX|VSTAR|GX|MEGA)$/.test(x));
    return [c.i, c.n, c.s, c.y, c.a ?? 0, c.r ?? 0, c.p ?? 0,
      // THE TAIL CARRIES WHAT SEARCH AND DISPLAY NEED, AND NOTHING ELSE.
      // dex, evolvesFrom, HP, stage and weakness are only read by the relation
      // layer, which runs in Node against the full catalogue and never reads
      // this array. Shipping them to the browser for 9,743 cards cost 350KB of
      // inline script for data the page cannot use - and inline script size is
      // exactly what killed mobile Safari at 4.49MB (c6ed73e, 2026-08-24).
      A.t ?? 0, rich ? (A.dex ?? 0) : 0, rich ? (A.ev ?? 0) : 0,
      rich ? (A.hp ?? 0) : 0, rich && st.length ? st : 0,
      rich && Object.keys(B.ratings ?? {}).length ? B.ratings : 0,
      rich ? (lore[c.i] ?? 0) : 0, rich && T.a?.length ? T.a.slice(0, 2) : 0,
      // WEAKNESS. Captured weeks ago and never shipped, so every matchup lookup
      // read undefined. It is one short string per card.
      rich ? (A.w ?? 0) : 0, rich ? 1 : 0,
      // SUPERTYPE, AS ONE CHARACTER. Without it the browser cannot tell a
      // Trainer from a Pokemon, so monName("Evolution Incense") produced
      // "Evolution" — nine characters, sorted ahead of "Magikarp" — and
      // "magikarp evolution" resolved to a Trainer card. 13,862 Pokemon,
      // 2,342 Trainers, 327 Energy; "P" or nothing is the whole cost.
      A.sc === "Pokémon" ? "P" : 0,
      // PRICE DATE, AS AN EXCEPTION. 15,705 of 16,468 cards share one repricing
      // date, so a per-row string would be sixteen thousand copies of the same
      // eight characters. The common date ships once as PRICES_AS_OF; this
      // column carries a date only where it differs - the handful whose price
      // has not moved in years, which is exactly what a reader needs warning
      // about.
      priceDateOf(c.i) === COMMON_PRICE_DATE ? 0 : (priceDateOf(c.i) || 0),
      rich ? (B.era || 0) : 0,
      rich ? (B.region || 0) : 0,
      rich && (Array.isArray(B.mechanic) ? B.mechanic[0] : B.mechanic) ? (Array.isArray(B.mechanic) ? B.mechanic[0] : B.mechanic) : 0];
  });
  return JSON.stringify(rows);
})()};
// Rehydrate once. Positional decode is trivial and keeps every reader unchanged.
// WHEN THESE PRICES WERE READ. A figure with no window is not publishable -
// that is a logged incident in this repo, and the tally was showing PAGE COST
// $8,667 as a bare number. The most confident text in the tool was the least
// sourced.
const PRICES_AS_OF = "${COMMON_PRICE_DATE}";

const CARD_INDEX = CARD_ROWS.map(function(r){
  var o = { i: r[0], n: r[1], s: r[2], y: r[3] };
  if (r[4]) o.a = r[4];
  if (r[5]) o.r = r[5];
  if (r[6]) o.p = r[6];
  if (r[7]) o.T = r[7];
  if (r[8]) o.D = r[8];
  if (r[9]) o.E = r[9];
  if (r[10]) o.H = r[10];
  if (r[11]) o.S = r[11];
  if (r[12]) o.R = r[12];
  if (r[13]) o.L = r[13];
  if (r[14]) o.A = r[14];
  if (r[15]) o.W = r[15];
  if (r[16]) o.hero = 1;
  if (r[17]) o.sup = r[17];       // "P" for Pokémon, absent otherwise
  if (r[18]) o.pd = r[18];   // price date, only when it differs from PRICES_AS_OF
  if (r[19]) o.era = r[19];
  if (r[20]) o.regn = r[20];
  if (r[21]) o.mech = r[21];
  return o;
});
// Sourced facts, so the 'story' shape has something true to build on. Only
// VERIFIED ones ship — an unsourced claim on a card image is the one mistake
// this whole project exists to avoid.
const FACTS = ${JSON.stringify((await (async () => { try { return (JSON.parse(await readFile(join(ROOT, 'data/knowledge.json'), 'utf-8')).facts ?? []).filter(f => f.confidence === 'VERIFIED' && (f.usedBy ?? []).includes('build-editor')).map(f => ({ id: f.id, claim: f.claim })); } catch { return []; } })()))};
const LAYOUTS = ${JSON.stringify(LAYOUTS)};
const SUPPORTED = Object.keys(LAYOUTS).map(Number);
function connectingGroupOf(cards){
  cards = cards || tray;
  if (typeof CONNECTING === "undefined" || !cards || cards.length < 2) return null;
  const ids = cards.map(function(c){ return c.i; });
  for (var i = 0; i < CONNECTING.length; i++) {
    const g = CONNECTING[i];
    if (!g.c || g.c.length !== ids.length) continue;
    var ok = true;
    for (var j = 0; j < ids.length; j++) if (g.c.indexOf(ids[j]) < 0) { ok = false; break; }
    if (ok) return g;
  }
  return null;
}
function orderByConnecting(cards){
  const g = connectingGroupOf(cards);
  if (!g) return cards;
  const by = {};
  for (var i = 0; i < cards.length; i++) by[cards[i].i] = cards[i];
  const ordered = [];
  for (var k = 0; k < g.c.length; k++) if (by[g.c[k]]) ordered.push(by[g.c[k]]);
  return ordered.length === cards.length ? ordered : cards;
}
function frameFromConnecting(g){
  const CW = 745, CH = 1040, PAD = 90, GAP = 60;
  const cols = g.cols || 1, rows = g.rows || 1;
  const cap = (cols * rows <= 4) ? 70 : 0;
  const W = PAD * 2 + cols * CW + (cols - 1) * GAP;
  const H = PAD * 2 + rows * (CH + cap) + (rows - 1) * GAP;
  return { name: "the picture", cols: cols, rows: rows, shape: g.shape, cardW: CW, cardCaption: cap,
    W: W, H: H, connecting: true, dir: g.arr };
}
function slotPos(i, L){
  if (L && L.shape && L.shape.length) {
    var n = 0;
    for (var r = 0; r < L.shape.length; r++) {
      if (i < n + L.shape[r]) return { r: r, c: i - n };
      n += L.shape[r];
    }
  }
  const cols = (L && L.cols) || 1;
  return { r: Math.floor(i / cols), c: i % cols };
}
function layoutForTray(){
  const g = connectingGroupOf(tray);
  if (g) return frameFromConnecting(g);
  return LAYOUTS[tray.length] || null;
}
// BOOT REPORT. Three wrong guesses at why this dies on a phone, all made from
// a sandbox that cannot run mobile Safari. A blank screen tells nobody
// anything, so the page now reports its own failure on the page itself.
function bootSay(msg, bad){
  var el2 = document.getElementById("boot");
  if (!el2) return;
  // A HEALTHY LOAD SHOULD NOT LEAVE A BANNER. The box exists so a blank
  // screen has something to say. Once the catalogue is in, it is noise.
  if (!bad && /Loaded |reachable/.test(String(msg))) { el2.hidden = true; return; }
  el2.hidden = false;
  el2.textContent = msg;
  if (bad) { el2.style.color = "#e0705a"; el2.style.borderColor = "#5a2a20"; }
}
window.onerror = function(m, src, line, col){
  bootSay("Script error: " + m + "  (line " + line + ")", true);
  return false;
};
bootSay("Script parsed. Loading catalogue…");

// THE POKEMON, NOT THE PREFIX. Splitting on the first space produced "Galarian"
// with 72 cards and "Dark" with 69 — those are form and owner prefixes, not
// creatures, and every grouping built on them was wrong. Strip the known
// prefixes and the trailing mechanic suffix to get the actual name.
const FORM_PREFIX = new RegExp("^(" + "Galarian|Alolan|Hisuian|Paldean|Dark|Light|Shining|Radiant|Team Aqua's|Team Magma's|Rocket's|Team Rocket's|Misty's|Brock's|Erika's|Sabrina's|Blaine's|Koga's|Giovanni's|Lillie's|N's|Marnie's|Ethan's|Cynthia's|Steven's|Iono's|Arven's|Hop's|Bea's|Crystal|Shadow|Mega|M" + ")" + String.fromCharCode(92) + "s+", "i");
const MECH_SUFFIX = new RegExp(String.fromCharCode(92) + "s+(" + "ex|EX|GX|V|VMAX|VSTAR|BREAK|LEGEND|Prime|Star|LV.X|-EX|-GX" + ")$");
function monName(full){
  // "M Charizard-EX" is Mega shorthand, not a distinct creature. Left in, it
  // became an extra stage in an evolution line and a separate entry in every
  // name list. Stripped before the form prefixes, because "M " sits outside
  // them.
  let n = String(full || "").replace(/^M[ ]+(?=[A-Z])/, "");
  for (let i = 0; i < 2; i++) n = n.replace(FORM_PREFIX, "");
  // HYPHENATED MECHANICS TOO. "Charizard-GX" is the same creature as Charizard,
  // and MECH_SUFFIX only strips a SPACE-separated suffix — so autocomplete
  // offered the same Pokémon four times and wasted every slot.
  n = n.replace(new RegExp("-(EX|GX|ex|V|VMAX|VSTAR)$"), "");
  n = n.replace(MECH_SUFFIX, "").trim();
  return n.split(" ")[0] || String(full);
}
// intent.js — one box instead of six panels.
//
// Tyler, 2026-08-24: "Our UI is way too sloppy and confusing… maybe do prompts
// just like Claude does so it doesn't feel overwhelming. At the moment it does."
//
// He is right, and my own research said so before I built it: **"one clear
// primary action, never more than one CTA"** — and the editor opens with six
// panels competing. I read that finding, wrote it into house-theses, and then
// shipped the opposite.
//
// BUT A BARE TEXT BOX FAILS TOO, for a reason the research also names:
// **"capability ambiguity is the last failure point — users cannot see what the
// system understands, so without visible examples it starts with guesswork."**
// So: one box, example chips that fill it in a tap, and a recovery path that
// SUGGESTS rather than erroring, because redirecting unclear queries to
// structured suggestions "reduced abandonment significantly".
//
// AND IT IS NOT AN LLM. This is a static file with no key and no network. Every
// match here is against data already in the page — Pokémon names, artists, sets,
// types, ratings, moods — which means it can only find things that genuinely
// exist. That is a feature: it cannot hallucinate a card.
//
// WHEN IT DOES NOT UNDERSTAND, it says what it DID find and offers the nearest
// real thing. "I don't know that one" is the sentence that loses a user.

function parseIntent(text, ctx) {
  const q = String(text || "").toLowerCase().trim();
  if (!q) return null;
  const found = { count: null, mon: null, artist: null, set: null, type: null,
    rating: null, mood: null, shape: null, weakness: null, stage: null, era: null, region: null, matched: [], missed: [] };

  // NO WORD BOUNDARIES AT ALL. Every \b in this parser emitted as a BACKSPACE
  // character, so every shape and rating match silently failed — thirteenth
  // escaping casualty, same root cause each time. These phrases are distinctive
  // enough that a substring match is correct, and it removes the one construct
  // that keeps breaking.
  // COUNT. People say "four cards" and "a pair" and "9" — all the same thing.
  const words = { one: 1, two: 2, three: 3, four: 4, six: 6, nine: 9, pair: 2, single: 1 };
  const B = String.fromCharCode(92) + "b";
  const D = String.fromCharCode(92) + "d";
  const S = String.fromCharCode(92) + "s";
  const num = q.match(new RegExp(B + "(" + D + "+)" + S + "*(cards?|of them)?" + B));
  if (num && [1, 2, 3, 4, 6, 8, 9].includes(Number(num[1]))) { found.count = Number(num[1]); found.matched.push(found.count + " cards"); }
  else for (const [w, n] of Object.entries(words)) {
    if (w === "one" && /one painting|one picture|one beach/.test(q)) continue;
    const padded = " " + q.replace(/[^a-z0-9]+/g, " ") + " ";
    if (padded.indexOf(" " + w + " ") >= 0) { found.count = n; found.matched.push(n + " cards"); break; }
  }

  // POKÉMON. Longest name first, so "mr. mime" beats "mime".
  // NOT CREATURE NAMES. "Dark", "Light", "Team" and "Mega" are form prefixes,
  // and "dark" in a sentence means the mood, not Dark Charizard. Fifth time the
  // prefix problem has surfaced.
  // A TYPE IS NOT A POKEMON. "psychic types" parsed mon=Psychic and type=Psychic,
  // then narrowed to cards literally NAMED Psychic — Sabrina's Psychic Control,
  // a Trainer. Type words and form prefixes can never be creature names.
  // SHAPE WORDS ARE NEVER CREATURE NAMES. "evolution", "family" and "incense"
  // describe the FORMAT being asked for. Filtering monNames to Pokemon rows
  // already removes the Trainer nouns; this is the second lock, because the
  // same word could arrive as a Pokemon name in a future set and the shape
  // reading is the one a person means.
  const NOT_MON = /^(evolution|evolutions|evolve|evolves|evolving|incense|family|line|lines|dark|light|team|mega|shadow|crystal|shining|radiant|energy|great|iron|roaring|walking|raging|scream|brute|flutter|sandy|gouging|slither|fire|water|grass|lightning|psychic|fighting|darkness|metal|dragon|fairy|colorless|type|types|pokemon|pokémon|trainer|professor|supporter|stadium|evolutionary)$/i;
  const mons = (ctx.monNames || []).filter(m => !NOT_MON.test(m)).slice().sort((a, b) => b.length - a.length);
  for (const m of mons) {
    if (m.length < 4) continue;
    // "Type: Null" reduces to "Type:", whose punctuation became a dot wildcard
    // and matched "types". Strip punctuation before the blocklist test.
    if (NOT_MON.test(m.replace(/[^A-Za-z]/g, ""))) continue;
    if (new RegExp(String.fromCharCode(92) + "b" + m.toLowerCase().replace(/[^a-z0-9']/g, ".") + String.fromCharCode(92) + "b").test(q)) { found.mon = m; found.matched.push(m); break; }
  }

  // ARTIST. Surname alone is how people actually refer to them.
  // ENGLISH NOUNS ARE NOT SURNAMES. "beach" is Toyste Beach in the catalogue
  // and also the thing HYOGONOSUKE painted. Matching the surname on the noun
  // sent "nine cards one beach" to a Lugia-EX.
  const ARTIST_TRAP = /^(beach|young|white|black|brown|green|king|wood|stone|gold|park|hall|west|north|south|long|short)$/;
  for (const a of (ctx.artists || [])) {
    const last = a.split(" ").pop().toLowerCase();
    if (last.length < 5) continue;
    if (ARTIST_TRAP.test(last) && q.indexOf(a.toLowerCase()) < 0) continue;
    if (q.includes(last)) { found.artist = a; found.matched.push(a); break; }
  }

  // SET.
  for (const s of (ctx.sets || []).slice().sort((a, b) => b.length - a.length)) {
    // "151" is a set name and three characters long. The old five-character
    // floor excluded it entirely, so "from 151" matched nothing. Short names
    // must match as whole words; long ones can match loosely.
    const sl = s.toLowerCase();
    const hit = sl.length >= 5 ? q.indexOf(sl) >= 0
      : (" " + q + " ").indexOf(" " + sl + " ") >= 0;
    if (hit) { found.set = s; found.matched.push(s); break; }
  }

  // WEAKNESS BEFORE TYPE. "weak to fire" names the printed weakness, not the
  // Fire type. Running type first narrowed to Fire cards, then weakness
  // skipped because almost no Fire card is weak to Fire, and the box handed
  // back Flareon.
  for (const t of ["fire", "water", "grass", "lightning", "psychic", "fighting", "darkness", "metal", "dragon", "fairy"]) {
    if (q.indexOf("weak to " + t) >= 0 || q.indexOf("weakness " + t) >= 0) {
      found.weakness = t.charAt(0).toUpperCase() + t.slice(1);
      found.matched.push("weak to " + found.weakness);
      break;
    }
  }

  // TYPE — the printed card type, which differs from the game type.
  for (const t of ["fire", "water", "grass", "lightning", "psychic", "fighting", "darkness", "metal", "dragon", "fairy", "colorless"]) {
    if (found.weakness && found.weakness.toLowerCase() === t) continue;
    if (new RegExp(String.fromCharCode(92) + "b" + t + String.fromCharCode(92) + "b").test(q)) { found.type = t[0].toUpperCase() + t.slice(1); found.matched.push(found.type + " type"); break; }
  }
  if (q.indexOf("stage 2") >= 0) { found.stage = "Stage 2"; found.matched.push("Stage 2"); }
  else if (q.indexOf("stage 1") >= 0) { found.stage = "Stage 1"; found.matched.push("Stage 1"); }
  else if (q.indexOf("baby pokemon") >= 0 || q.indexOf("baby card") >= 0) { found.stage = "Baby"; found.matched.push("Baby"); }
  else if (q.indexOf("basic pokemon") >= 0 || q.indexOf("basics") >= 0) { found.stage = "Basic"; found.matched.push("Basic"); }
  if (q.indexOf("vintage") >= 0) { found.era = "vintage"; found.matched.push("vintage"); }
  else if (q.indexOf("sun and moon") >= 0 || q.indexOf("sun & moon") >= 0) { found.era = "Sun & Moon"; found.matched.push("Sun & Moon"); }
  else if (q.indexOf("modern") >= 0) { found.era = "modern"; found.matched.push("modern"); }
  const REGIONS = ["kanto","johto","hoenn","sinnoh","unova","kalos","alola","galar","paldea","hisui"];
  for (const r of REGIONS) if (q.indexOf(r) >= 0) {
    found.region = r.charAt(0).toUpperCase() + r.slice(1); found.matched.push(found.region); break;
  }

  // RATINGS, in the words people use rather than our field names.
  const RATING = [
    [/(cute|adorable|sweet|wholesome)/, "cute", "cute"],
    [/(funny|silly|joke|stupid|ridiculous)/, "comedy", "funny"],
    // "dark" belongs to the villain SHAPE, not to a tonal score. Leaving it in
    // both meant whichever table ran first won, and this one runs first.
    [/(grim|creepy|scary|unsettling|sinister|haunting|macabre)/, "serious", "grim tone"],
    [/(cheap|budget|under a|affordable|low.cost)/, "cheap", "cheap"],
    [/(expensive|dear|grail|pricey|chase)/, "dear", "expensive"],
    [/(rare|scarce|hard to find)/, "scarce", "scarce"],
    [/(beautiful|gorgeous|artwork|stunning|pretty)/, "artprem", "art people pay for"],
  ];
  for (const [rx, id, label] of RATING) if (rx.test(q)) { found.rating = id; found.matched.push(label); break; }

  // MOOD.
  for (const m of (ctx.moods || []))
    if (q.includes(m.label.toLowerCase()) || (m.id === "tired" && /(tired|wiped|exhausted|late night|sleepy)/.test(q))
      || (m.id === "bright" && (/(good morning|morning|sunrise)/.test(q) || q === "gm" || (" " + q + " ").indexOf(" gm ") >= 0))) { found.mood = m.id; found.matched.push(m.label); break; }

  // SHAPE — the phrasing that names a format.
  const SHAPE = [
    // DARK, IN THE COLLECTOR SENSE: the Dark-prefixed Team Rocket cards, the
    // villain organisations, the Darkness type. Mapping this to a tonal
    // "serious" score returned Feraligatr and Pinsir — serious in tone, and
    // nothing anybody in this hobby means by the word.
    [/(dark|villain|team rocket|rocket|evil|bad guy)/, "villain", "dark — Rocket and villains"],
    [/(nobody talks about|obscure|underrated|forgotten|no one mentions|unknown)/, "obscure", "cards nobody talks about"],
    [/(evolution|whole line|evolves|line)/, "evo-line", "the evolution line"],
    [/(years apart|over time|through the years|across eras|decades)/, "eras", "across the years"],
    [/(same artist|one artist|by the same)/, "artist-span", "one artist, years apart"],
    [/(power creep|hp over time|stronger)/, "power-creep", "power creep"],
    [/(story|lore|says about itself|flavou?r text)/, "lore-self", "what the card says"],
    [/(versus|battle|which is better)/, "battle", "a battle"],
  ];
  for (const [rx, id, label] of SHAPE) if (rx.test(q)) { found.shape = id; found.matched.push(label); break; }

  found.understood = found.matched.length > 0;
  return found;
}

// WHAT IT DID NOT UNDERSTAND, said usefully. The research is explicit that
// redirecting an unclear query to structured suggestions rather than a generic
// failure "reduced abandonment significantly" — so this never says "I don't
// know that one", which is the sentence that loses a user.
function intentReply(found, ctx) {
  if (!found || !found.understood) {
    // SIX WRONG ANSWERS ARE WORSE THAN ONE HONEST "I DO NOT KNOW". "connecting
    // art" returned Articuno, Artazon, Wartortle, Dartrix, Beartic and Kartana.
    // Every one was a letter match and none was an answer, and a list of six
    // confident wrong things reads as a tool that does not understand its own
    // catalogue. Say what KINDS of thing it understands, and show two.
    return { ok: false,
      say: "I did not understand that. I can find: a Pokémon by name, an illustrator, " +
           "a set, an evolution line, cards that connect into one picture, one " +
           "Pokémon across the years, a type, a weakness, a region, or an era. Try \u201cconnecting art\u201d or \u201cweak to fire\u201d.",
      suggest: ["connecting art", "weak to fire"] };
  }
  const bits = found.matched.join(" · ");
  return { ok: true, say: "Showing " + bits + ".", found };
}


// VIEWS, NOT FOLLOWERS. Followers are an accumulated number and views are a live
// signal — bought, bot, dormant and lapsed followers count toward the first and
// none toward the second. Crambo has 17.6k followers and took 37.1k views on one
// post; a 50k account with dormant followers might see 3k. The tiers answer one
// question — is there a crowd big enough to answer a question — and that is a
// views question.
const REACH_TIERS = [
  { id: "quiet", upTo: 800, label: "under 800 views a post",
    prefer: ["observation", "confession"],
    avoid: ["question", "permission", "divide"],
    why: "A question with three replies looks worse than a post with none, because an unanswered request is visibly unanswered. Lead with something that stands alone and let the reply be optional",
    hypothesis: true },
  { id: "building", upTo: 4000, label: "800 to 4k views a post",
    prefer: ["observation", "confession", "invite"],
    avoid: ["divide"],
    why: "Enough eyes that a low-effort ask lands. INVITE beats ASK here: 'add the one I missed' costs a reader nothing, where 'which is best' asks them to defend a choice",
    hypothesis: true },
  { id: "crowd", upTo: 20000, label: "4k to 20k views a post",
    prefer: ["question", "permission", "invite", "observation"],
    avoid: [],
    why: "The band where the permission mechanic is documented working — tall_alan took roughly 900 replies from an account this size. There is a crowd and a question finds it",
    hypothesis: true },
  { id: "loud", upTo: Infinity, label: "20k+ views a post",
    prefer: ["divide", "permission", "question"],
    avoid: [],
    why: "A divisive question is safe when there are enough answers to make a thread rather than a silence",
    hypothesis: true },
];

// FOLLOWERS ONLY AS A LAST RESORT, and openly derated. A rough rule of thumb is
// that a healthy account sees views in the region of its follower count; a
// neglected one sees a fraction. Using it means guessing at the very thing the
// tier is trying to measure.
function tierFor(typicalViews, followersFallback){
  let n = Number(typicalViews) || 0;
  if (!n && followersFallback) n = Number(followersFallback) * 0.5;
  if (!n) return null;
  return REACH_TIERS.find(t => n <= t.upTo) || REACH_TIERS[REACH_TIERS.length - 1];
}

// THE BEST INPUT IS THE ONE WE ALREADY HOLD. Once read-metrics fills the
// outcome log, nobody needs to type anything — the median of the last several
// settled posts IS the answer, and it is measured rather than remembered.
function typicalViewsFrom(posts){
  const settled = (posts || []).filter(p => p.measured && p.measured.views);
  if (settled.length < 3) return null;
  const v = settled.slice(-8).map(p => p.measured.views).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}
// THE TCG DOES NOT PRINT THE BABY LINK. A Pikachu card is a Basic and never
// says "evolves from Pichu" — the game rule and the card rule differ, exactly
// like the type field. Babies are a small closed list and a documented
// relationship, so filling it in completes a real fact rather than inventing
// one. All eighteen have both sides in our catalogue.
const BABY_OF = { "Pikachu": "Pichu", "Clefairy": "Cleffa", "Jigglypuff": "Igglybuff",
  "Togetic": "Togepi", "Jynx": "Smoochum", "Electabuzz": "Elekid", "Magmar": "Magby",
  "Marill": "Azurill", "Wobbuffet": "Wynaut", "Roselia": "Budew", "Chimecho": "Chingling",
  "Sudowoodo": "Bonsly", "Chansey": "Happiny", "Snorlax": "Munchlax", "Lucario": "Riolu",
  "Mantine": "Mantyke", "Mr. Mime": "Mime Jr.", "Hitmonlee": "Tyrogue" };
// resolve.js — the prompt picks the cards. Nothing else gets to override it.
//
// Tyler, 2026-08-24: "It's still showing the wrong cards. How do we keep coming
// into this problem?"
//
// THE ANSWER TO THAT QUESTION IS UNCOMFORTABLE AND WORTH WRITING DOWN. I put
// this in ask-smoke's own blind-spot file and never closed it:
//
//   "Whether the cards it returns are the RIGHT ones. It proves every prompt
//    fills the tray; it has no view on whether 'something dark' returned
//    anything actually dark."
//
// So the test went green on every build while the output was wrong. **I
// documented the exact gap and then trusted the test that declared it.**
//
// THE BUG ITSELF: a parsed prompt set filters AND selected a theme, then handed
// off to the theme builder — which picks from its own pool and never consults
// those filters. "charizard through the years" parsed Charizard correctly and
// returned Alakazam. "fire types" returned Gyarados, which is Water.
//
// THE FIX: the prompt resolves its own cards. Every constraint is applied as a
// filter, in order, and each one can only ever REMOVE cards. A theme may
// suggest an ordering; it may never widen the pool past what was asked for.

function resolvePrompt(found, INDEX, helpers) {
  const { monName, attrs, ratingOf, HERO_RX } = helpers;
  const why = [];

  // START WIDE, NARROW ONLY. Every clause below removes cards and none adds
  // any. That property is what makes the result explainable — and it is exactly
  // what the theme handoff broke.
  let pool = INDEX.slice();
  const narrow = (fn, label) => {
    const next = pool.filter(fn);
    // NEVER NARROW TO NOTHING SILENTLY. Dropping a constraint is sometimes
    // right, but doing it without saying so is how you get confident wrong
    // output — which is the whole complaint.
    if (!next.length) { why.push(label + " (skipped — nothing matched)"); return; }
    pool = next; why.push(label);
  };

  // THE POKEMON IS THE HARDEST CONSTRAINT. If somebody names one, every card
  // returned must be it. This is the clause the theme handoff ignored.
  // AN EVO LINE IS THE CHAIN, NOT THREE PRINTINGS OF ONE CARD. Pinning to the
  // named Pokémon and taking three of them returned Charmander, Charmander,
  // Charmander.
  if (found.mon && found.shape === "evo-line") {
    const line = (helpers.evoLineFor && helpers.evoLineFor(found.mon)) || [found.mon];
    found.evoLine = line;
    narrow(c => line.indexOf(monName(c.n)) >= 0, line.join(" → "));
    // THE LINE IS THE ANSWER, SO THE LINE PICKS THE CARDS. Everything below
    // this used to run: a hero-rarity collapse, then a spread across the years
    // because found.mon was set. On "chikorita evolution" that returned
    // Meganium, Meganium ex and Mega Meganium ex — three printings of the LAST
    // stage, which is a price ranking wearing an evolution line's name.
    //
    // One CREDITED card per stage, in stage order, cheapest-first inside a
    // stage so the picture is of the creature rather than of the chase card.
    found.evoOrder = line;
  } else if (found.mon) narrow(c => monName(c.n) === found.mon, found.mon);

  // POKEMON ONLY, unless a Trainer was explicitly asked for. "Cards nobody
  // talks about" returned Erika's Invitation and Giovanni's Charisma — both
  // Trainers, neither a card anybody means by that phrase.
  if (!found.trainerOk) narrow(c => { const a = attrs[c.i]; return a && a.dex; }, "Pokémon only");

  if (found.artist) narrow(c => c.a === found.artist, found.artist);
  if (found.set) narrow(c => c.s === found.set, found.set);

  // THE PRINTED TYPE, from the type field — not from the name, and not from
  // what the video game says. "Fire types" returned Gyarados because the type
  // was parsed and then never applied.
  if (found.type) narrow(c => { const a = attrs[c.i]; return a && (a.t || []).indexOf(found.type) >= 0; }, found.type + " type");
  if (found.weakness) narrow(c => String(c.W || "").toLowerCase() === String(found.weakness).toLowerCase(), "weak to " + found.weakness);
  if (found.stage) narrow(c => {
    const s = c.S;
    if (!s) return false;
    if (Array.isArray(s)) return s.indexOf(found.stage) >= 0;
    return String(s).indexOf(found.stage) >= 0;
  }, found.stage);
  if (found.era) narrow(c => c.era === found.era, found.era);
  if (found.region) narrow(c => c.regn === found.region, found.region);
  if (found.shape === "lore-self") narrow(c => !!c.L, "has flavour text");

  // RANK BY THE RATING, DO NOT FILTER ON IT. A threshold of 6 matched almost
  // nothing — most cards carry no score on a given axis — so the clause was
  // skipped and "cute" and "dark" returned identical cards. Ranking always
  // orders, even when few clear a bar.
  let rankBy = null;
  if (found.rating) {
    const scored = pool.filter(c => (ratingOf(c.i, found.rating) || 0) > 0);
    if (scored.length >= 4) { pool = scored; rankBy = found.rating; why.push(found.rating); }
    else why.push(found.rating + " (few cards scored)");
  }

  // DARK, RESOLVED. Dark-prefixed Team Rocket cards first because those ARE the
  // thing collectors mean, then villain organisations, then the Darkness type as
  // the wide net. Mapping this to a "serious" score returned Feraligatr and
  // Pinsir — tonally serious, and nothing anybody in this hobby means by "dark".
  if (found.shape === "villain") {
    const literal = pool.filter(function(c){ return /^Dark /.test(c.n); });
    const villains = pool.filter(function(c){ return /Rocket|Team Aqua|Team Magma|Giovanni|Archie|Maxie|Cyrus|Ghetsis|Lysandre|Guzma/i.test(c.n) || /Rocket/i.test(c.s); });
    const typed = pool.filter(function(c){ const a = attrs[c.i]; return a && (a.t || []).indexOf("Darkness") >= 0; });
    const best = literal.length >= 2 ? literal : villains.length >= 2 ? villains : typed;
    if (best.length) {
      pool = best;
      why.push(literal.length >= 2 ? "Dark-prefixed Team Rocket cards" : villains.length >= 2 ? "villain cards" : "Darkness type");
    }
  }

  // OBSCURE IS A REAL QUERY, not a vibe: a Pokémon with few printings, an
  // illustrated card, and not one of the names everybody already says.
  if (found.shape === "obscure") {
    const counts = {};
    for (const c of INDEX) { const m = monName(c.n); if (m) counts[m] = (counts[m] || 0) + 1; }
    const FAMOUS = /Charizard|Pikachu|Eevee|Umbreon|Mewtwo|Rayquaza|Lugia|Gengar|Blastoise|Venusaur|Sylveon|Espeon|Snorlax/i;
    narrow(c => counts[monName(c.n)] <= 8 && !FAMOUS.test(c.n) && HERO_RX.test(c.r || ""), "rarely printed");
  }

  // Everything shown must be worth showing, and must credit its artist.
  // AN EVO LINE MUST NOT DROP STAGES FOR BEING COMMON. The hero-rarity filter
  // used to run on the whole pool: Charmander and Charmeleon (mostly commons)
  // vanished, three Charizard SIRs remained, and "charmander evolution" showed
  // Charizard → Charizard & Braixen-GX → Mega Charizard X ex. evo-smoke still
  // passed because it only counted cards. Prefer a hero AT EACH STAGE; never
  // delete a stage that only has a common.
  narrow(c => c.a, "credited");
  const withHero = pool.filter(c => HERO_RX.test(c.r || ""));
  // A HERO-RARITY COLLAPSE IS WRONG FOR A LINE. It drops the ordinary printings
  // that are the only cards some stages have, and an evolution line missing its
  // first stage is not an evolution line.
  if (!found.evoOrder && withHero.length >= (found.count || 2)) { pool = withHero; why.push("hero rarities"); }

  const n = found.count || (found.shape === "evo-line" ? 3 : 2);
  const skip = (helpers.exclude instanceof Set) ? helpers.exclude : new Set();
  const rot = Number(helpers.rot) || 0;

  // ONE CARD PER POKEMON, unless the shape is about one Pokémon over time.
  // Nine Charizards is a composition; nine different Pokémon is a set.
  const acrossTime = !found.evoOrder &&
    (found.shape === "eras" || found.shape === "power-creep" || found.mon);
  let picked;
  if (found.evoOrder) {
    // Stage order, one card each, and a CREDITED card wherever the stage has
    // one — an uncredited card in a line makes the credit strip lie by omission.
    picked = [];
    for (const stage of found.evoOrder) {
      const forStage = pool.filter(c => monName(c.n) === stage);
      if (!forStage.length) continue;
      const credited = forStage.filter(c => c.a);
      const from = credited.length ? credited : forStage;
      // THE PLAINEST PRINTING OF THE STAGE. Sorting by price alone returned
      // "Mega Meganium ex" as the Meganium stage and "Flygon V" as the Flygon
      // stage — cheapest, yes, and a mechanic variant standing in for the
      // creature. A card whose printed name IS the stage name is the one a
      // reader recognises as that stage.
      const plain = from.filter(c => c.n === stage);
      const src = plain.length ? plain : from;
      picked.push(src.slice().sort((a, b) => (a.p || 0) - (b.p || 0))[0]);
    }
    why.push("one card per stage, in order");
  } else if (acrossTime && found.mon) {
    // Oldest to newest, spread across the years rather than clustered.
    const byYear = pool.slice().filter(c => !skip.has(c.i)).sort((a, b) => String(a.y).localeCompare(String(b.y)));
    const years = byYear.length ? byYear : pool.slice().sort((a, b) => String(a.y).localeCompare(String(b.y)));
    if (years.length <= n) picked = years;
    else {
      picked = [];
      const step = (years.length - 1) / (n - 1);
      const shift = rot % years.length;
      for (let i = 0; i < n; i++) picked.push(years[(Math.round(i * step) + shift) % years.length]);
    }
    why.push("spread across the years");
  } else {
    const best = {};
    for (const c of pool) { const k = monName(c.n);
      if (skip.has(c.i)) continue;
      if (!best[k] || (c.p || 0) > (best[k].p || 0)) best[k] = c; }
    let ranked = Object.values(best).sort(function(a, b){
      if (rankBy) { const d = (ratingOf(b.i, rankBy) || 0) - (ratingOf(a.i, rankBy) || 0); if (d) return d; }
      return (b.p || 0) - (a.p || 0);
    });
    if (ranked.length < n) {
      const fallback = {};
      for (const c of pool) { const k = monName(c.n);
        if (!fallback[k] || (c.p || 0) > (fallback[k].p || 0)) fallback[k] = c; }
      ranked = Object.values(fallback).sort(function(a, b){ return (b.p || 0) - (a.p || 0); });
    }
    if (rot && ranked.length > n) {
      const start = (rot * n) % ranked.length;
      picked = [];
      for (let i = 0; i < n; i++) picked.push(ranked[(start + i) % ranked.length]);
    } else {
      picked = ranked.slice(0, n);
    }
  }

  return { cards: picked, why, poolSize: pool.length };
}


const byIdRow = {};
// ── A PROXY WITH ONLY A GET TRAP IS NOT ENUMERABLE ────────────────────────
// This answers ATTRS[id] correctly and reports NOTHING to for...in, because a
// Proxy over an empty target has no own keys unless ownKeys says otherwise.
// Two loops in this file iterate it, and both silently did zero work:
//
//   for (var id in ATTRS) { ... }        // ran zero times, always
//
// That is why evoLineFor never walked past the name it was given, and why
// "evolution line" answered with one card even after the exemplar and the row
// access were both fixed. Three defects stacked in one path, each hiding the
// next: unreachable (ReferenceError), wrong when reached (row[1]), and given
// nothing to read (this).
//
// A silent zero-iteration loop is the worst shape available: no error, no
// warning, and a result that looks like a small answer rather than no answer.
const ATTRS = new Proxy({}, {
  get: (_, k) => { const r = byIdRow[k]; return r ? { t: r.T, dex: r.D, d: r.D, e: r.E, ev: r.E, h: r.H, hp: r.H, s: r.S, st: r.S, w: r.W } : undefined; },
  has: (_, k) => k in byIdRow,
  ownKeys: () => Reflect.ownKeys(byIdRow),
  getOwnPropertyDescriptor: (_, k) => (k in byIdRow)
    ? { enumerable: true, configurable: true, value: undefined }
    : undefined,
});
const BIOS = new Proxy({}, { get: (_, k) => byIdRow[k]?.R });
const LORE = new Proxy({}, { get: (_, k) => byIdRow[k]?.L });
let INDEX = [], tray = [], blob = null;
var lastPref = { kind: "revisit", ask: "" };
var anotherCursor = 0;
var trail = [];

// CONSTRUCTED URLS 404 TO A CARD BACK. Newer sets serve from a different host
// entirely, and a 404 here returns a valid 200 PNG of the wrong side of a card.
// card-composite was fixed for this yesterday; the editor still had the old
// code. The index carries no URL, so: try one host, fall back to the other on
// error, and show a visible failure rather than a plausible wrong image.
// SMALL FOR BROWSING, LARGE FOR THE COMPOSITE. We requested _hires.png for
// every thumbnail — 1-2MB each, and thirty-six of them is ~54MB of transfer to
// draw images 96 pixels wide. On a phone that never finishes, which is a grid of
// blank squares.
const imgSmall = (id) => "https://images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + ".png";
const imgUrl = (id) => "https://images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + "_hires.png";
const imgAlt = (id) => "https://images.scrydex.com/pokemon/" + id + "/large";
function imgTag(c, cls){
  const alt = imgAlt(c.i).replace(/'/g, "");
  return "<img src='" + imgUrl(c.i) + "' alt='" + String(c.n).replace(/'/g, "") +
    "' onerror='this.onerror=null;this.src=&quot;" + alt + "&quot;'>";
}

// EMBEDDED, NOT FETCHED. fetch() of a sibling file from a file:// page is
// blocked by Chrome as cross-origin, so INDEX stayed empty — and every symptom
// followed from that one cause: no images, no themes, no search. A fetch also
// means two files that must travel together, and a single file cannot arrive
// half-configured.
INDEX = CARD_INDEX;
  for (const r of INDEX) byIdRow[r.i] = r;
// Deferred one tick. The fetch used to provide this gap by accident, so
// removing it exposed an ordering bug that had always been there — el() and
// the render functions are declared further down the file.
setTimeout(() => {
    // Show the default as chosen, so the state on screen matches the state in
    // memory — an invisible default is the same trap one level down.
    const cc = el("fcount");
    if (cc) cc.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", Number(x.dataset.n) === fCount));
    renderThemes(); search();
    try {
      var nCards = (document.getElementById("res") || {}).innerHTML || "";
      var nThemes = (document.getElementById("ftheme") || {}).innerHTML || "";
      var imgs = (nCards.match(/<img/g) || []).length;
      var chips = (nThemes.match(/data-t=/g) || []).length;
      // ── SAY WHAT HAPPENED, NOT WHAT MIGHT HAVE ──────────────────────────
      // This line used to END with "If the pictures are blank, the card art
      // host is unreachable from this browser" — printed on EVERY boot,
      // unconditionally, whether or not anything had failed.
      //
      // The thumbnails are loading="lazy", so for the first moments after boot
      // they are legitimately unpainted. A user who looks then sees empty
      // panels AND a sentence telling them the host is unreachable, and
      // concludes the tool is broken. Tyler saw exactly that in one session and
      // not in another, which is what made it look intermittent: it was a race
      // between the images painting and him reading the message.
      //
      // Verified from the published origin on 2026-08-26: all three hosts
      // return 200 with real bytes and decode — pokemontcg 240x330,
      // scrydex 245x336, weserv 400x550. No CORS problem, no CDN failure.
      // The message was the defect.
      //
      // It now reports a MEASURED state, filled in by probeHosts() when the
      // probe finishes, and says nothing about reachability until it knows.
      // A PERMANENT ORANGE BANNER READS AS A WARNING. It sat at the top of the
      // page on every successful load saying how many cards had loaded — which
      // nobody needs once they can see the cards, and which looks like
      // something went wrong. It is an error channel now: hidden on success,
      // shown only when something actually failed.
      var bootEl = document.getElementById("boot");
      if (bootEl) bootEl.hidden = true;
      if (!imgs || !chips) bootSay("Loaded " + INDEX.length + " cards but rendered " + imgs + " thumbnails and " + chips + " angles — the data arrived and the drawing failed.", true);
    } catch (e) { bootSay("Render failed: " + e.message, true); }
  }, 0);

const el = id => document.getElementById(id);

// NO TOP-LEVEL LINE MAY HALT THE FILE. One throw during initial execution
// stops everything below it: every let never initializes, the boot timer then
// hits a dead binding, and the page is blank with "script error" — which is
// exactly what a phone showed while every dev machine showed green.
function safeWire(fn, what){
  try { fn(); }
  catch (e) {
    try { const b = el("bootpanel") || el("status"); if (b) { b.hidden = false; b.textContent = "setup skipped (" + (what || "block") + "): " + e.message; } } catch (x) {}
  }
}
// STORAGE THAT CANNOT THROW. iOS private browsing throws on setItem — the
// classic works-on-every-dev-machine killer. Losing a preference is fine;
// dying over one is not.
// EVERY METHOD HERE CALLED ITSELF. get() returned store.get(k), set() called
// store.set - infinite recursion, RangeError, swallowed by the very try/catch
// that was meant to survive a blocked localStorage. So it never threw and it
// never stored: owned cards, the streak and the typical-views preference have
// all been silently doing nothing on every device since this was written.
//
// The comment above is still right about WHY the try/catch is there. The body
// just never reached localStorage.
const store = {
  get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} },
  del(k){ try { localStorage.removeItem(k); } catch (e) {} },
};
// PAGING STATE. Page size is deliberately modest: 36 images is a fast paint on
// a phone, and the point of paging is that the page never gets slower no matter
// how big the catalogue grows.
const PAGE_SIZE = 36;
let page = 0;

function renderPager(total, pages){
  const box = el("pager");
  if (!box) return;
  if (total <= PAGE_SIZE) { box.innerHTML = total ? total + " cards" : ""; return; }
  const from = page * PAGE_SIZE + 1, to = Math.min((page + 1) * PAGE_SIZE, total);
  box.innerHTML =
    "<button onclick='goPage(0)' " + (page === 0 ? "disabled" : "") + ">First</button>" +
    "<button onclick='goPage(" + (page - 1) + ")' " + (page === 0 ? "disabled" : "") + ">Prev</button>" +
    "<span>" + from.toLocaleString() + "–" + to.toLocaleString() + " of " + total.toLocaleString() + "</span>" +
    "<input id='pgo' type='number' min='1' max='" + pages + "' value='" + (page + 1) + "'>" +
    "<span>of " + pages.toLocaleString() + "</span>" +
    "<button onclick='goPage(" + (page + 1) + ")' " + (page + 1 >= pages ? "disabled" : "") + ">Next</button>" +
    "<button onclick='goPage(" + (pages - 1) + ")' " + (page + 1 >= pages ? "disabled" : "") + ">Last</button>";
  const jump = el("pgo");
  if (jump) jump.onchange = () => goPage(Math.max(0, Math.min(pages - 1, Number(jump.value) - 1)));
}

window.goPage = goPage;
window.add = add;
window.remove = remove;
window.toggleOwn = toggleOwn;
window.loadIdea = loadIdea;
window.nextStreakDay = nextStreakDay;
window.endStreak = endStreak;
window.beginStreak = beginStreak;
// BUILT WITH DOM CALLS, NOT A STRING. Three attempts at quoting this one line
// failed, each in a different way. A string with quotes inside quotes inside a
// template is a losing game; createElement has nothing to escape.
function suggestHtml(q){
  const guess = didYouMean(q);
  const d = document.createElement("div");
  d.className = "empty";
  if (!guess) { d.textContent = "nothing matched"; return d.outerHTML; }
  d.appendChild(document.createTextNode("Nothing for " + q + ". Did you mean "));
  const b = document.createElement("b");
  b.textContent = guess;
  b.style.color = "var(--live)";
  b.style.cursor = "pointer";
  b.setAttribute("onclick", "tryName(" + JSON.stringify(guess) + ")");
  d.appendChild(b);
  d.appendChild(document.createTextNode("?"));
  return d.outerHTML;
}
function tryName(n){ el("q").value = n; resetPage(); search(); }
window.tryName = tryName;
function goPage(n){ page = Math.max(0, n); search(); el("res").scrollTop = 0; }

// Any change to the filters resets to page one — staying on page 400 of a new
// search is a way of showing somebody nothing and calling it a result.
function resetPage(){ page = 0; }

// FORGIVING SEARCH. Pokemon names are hard to spell — Chandelure, Aegislash,
// Volcarona, Gholdengo — and an exact match punishes a typo with an empty
// screen, which reads as a broken tool rather than a misspelling. This runs
// ONLY when the exact match finds nothing, so it costs nothing normally.
let NAMES = null;
function editDistance(a, b){
  if (Math.abs(a.length - b.length) > 3) return 99;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function didYouMean(q){
  if (q.length < 3) return null;
  NAMES = NAMES ?? [...new Set(INDEX.map(c => monName(c.n)))];
  let best = null, bestD = 99;
  for (const nm of NAMES) {
    const d = editDistance(q, nm.toLowerCase());
    if (d < bestD) { bestD = d; best = nm; }
  }
  // Allow more slack on longer words: one slip in "chandalure" is the same
  // mistake as one slip in "mew", and only one of them is ambiguous.
  return bestD <= Math.max(1, Math.floor(q.length / 4)) ? best : null;
}

// ── THE HAYSTACK ──────────────────────────────────────────────────────────
// Every fact about a card that a person might type, in one lowercase string.
// Built once per card, on demand, and cached on the row.
// ── ONE NORMALISER, BOTH SIDES ─────────────────────────────────────────────
// The haystack was lowercased and nothing more, so a query had to reproduce
// punctuation the card carries but a keyboard does not offer:
//
//   "Farfetch'd" -> 19 hits      "Farfetchd" -> 0
//   "Pokemon"    -> 0            "Pokemon" with the accent -> 238
//   "Flabebe"    -> 0            with both accents -> 12
//
// The tolerant-looking cases were tolerant BY ACCIDENT. "Mr Mime" worked only
// because splitting produced two short tokens that each substring-match inside
// "mr. mime"; "Pokemon" is one token and had to appear as a contiguous run
// inside "pokemon" spelled with an accent, which it never does. So the tool
// rewarded typing the hard spelling and returned zero for the easy one - the
// same failure mode as the substring bug this file already documents, one layer
// down. Nobody reaches for the accent key to look up a card.
//
// Both sides now pass through fold(): decompose, drop the combining marks, drop
// apostrophes entirely. "pokemon" and the accented spelling collapse to the same
// string, as do "farfetchd" and "farfetch'd".
//
// NO BACKSLASHES IN HERE, DELIBERATELY - this is emitted from inside a template
// literal and an escape written here is eaten before it reaches the browser. The
// combining-mark range is built with String.fromCharCode for exactly that
// reason. That is the house law, and it is why this reads oddly.
// -- SPLIT ON WHITESPACE, WITHOUT WRITING AN ESCAPE -------------------------
// Built from character codes: space, tab, newline, carriage return. This exists
// because /\s+/ written inside the generator template literal is eaten before
// it reaches the browser and ships as /s+/ - a split on the LETTER "s". That has
// now happened THREE times in this file, and both earlier fixes worked by
// remembering to double the backslash, which is a fix that depends on
// remembering. This constant cannot be written wrongly, and escape-audit.mjs
// fails the build if the eaten form reaches the artifact again.
var WS = new RegExp("[" + String.fromCharCode(32) + String.fromCharCode(9) +
                    String.fromCharCode(10) + String.fromCharCode(13) + "]+");

var COMBINING = new RegExp("[" + String.fromCharCode(768) + "-" + String.fromCharCode(879) + "]", "g");
var RSQUO = String.fromCharCode(8217);
function fold(s){
  s = String(s == null ? "" : s).toLowerCase();
  if (s.normalize) s = s.normalize("NFD").replace(COMBINING, "");
  return s.split("'").join("").split(RSQUO).join("");
}

function hay(c){
  if (c._h) return c._h;
  var parts = [c.n, c.a || "", c.s, c.y, c.r || ""];
  if (c.T) parts = parts.concat(c.T);
  if (c.S) parts = parts.concat(c.S);
  if (c.W) parts.push(c.W);
  if (c.E) parts.push(c.E);
  c._h = fold(parts.join(" "));
  return c._h;
}

// ══ WHY SO MUCH OF THIS FILE INTERPOLATES INSTEAD OF WRITING THE SENTENCE ══
// 1,247 strings over 45 characters reach a reader from this page. 1,177 come
// from the emitted data constants and 53 were typed by a person. Both of the
// false claims found in the audit came from the 53, and neither was a typo.
//
// A DERIVED STRING CANNOT CLAIM MORE THAN THE DATA HOLDS. It is assembled from
// values, so its scope is exactly the scope of the query behind it. If the
// query changes, the sentence changes with it or stops compiling.
//
// A TYPED SENTENCE CAN WIDEN A NARROW FACT AND NOTHING NOTICES. That is not a
// hypothetical:
//
//   artistRevisits() measures the longest gap between drawing the SAME POKEMON
//   twice. The tutorial said "the widest gap by one illustrator in the whole
//   catalogue" — career span — and six illustrators beat it. The pair was
//   right, the years were right, the SCOPE was invented by the English.
//
//   build-bios scores cute >= 7 for Baby cards and small unevolved forms with a
//   market premium. The filter note said "an unevolved Basic at 60 HP or less".
//   The threshold is 70, and that tier scores 5, so no card had ever qualified
//   the way the note described.
//
// Both sentences were written by someone looking straight at the correct value.
// Natural English generalises; that is what it is for. The defence is not
// proofreading, it is not writing the sentence by hand — and where it must be
// written by hand, a guard that reads the artifact and the data and refuses to
// let them disagree (search-gauntlet sections 11 and 12).
//
// house-theses.md: "A SENTENCE BUILT ON A RELATION MUST NOT CLAIM MORE THAN THE
// RELATION MEASURES."

// ── TOKENISE AND AND ──────────────────────────────────────────────────────
// The old test was one contiguous substring across name + artist + set:
//
//   (c.n + " " + c.a + " " + c.s).toLowerCase().includes(q)
//
// So "magmar kimura" matched nothing, because the haystack reads
// "Magmar Naoyo Kimura Neo Genesis" and the query is not a run of characters
// inside it. A user who types TWO TRUE FACTS about one card got zero results and
// concluded the tool was broken. Tyler did exactly that.
//
// Year was not in the haystack at all - it lived only as an exact match on a
// separate field - so "magmar 2000" could not work either.
//
// Now: split on whitespace, require EVERY term to appear somewhere in the card's
// facts. Order stops mattering, and the fields a person actually knows - name,
// artist, set, year, rarity, type, stage, weakness, what it evolves from - are
// all searchable in the one box.
function termsOf(q){
  // NO BACKSLASH IN THIS REGEX, DELIBERATELY. This line is emitted from inside
  // a template literal, so an escape written here is consumed before it reaches
  // the browser: /\s+/ shipped as /s+/ and split the query on the LETTER "s".
  // "arita squirtle" appeared to work because it contains one, "magmar kimura"
  // returned zero because it does not, and the two failures looked unrelated.
  // That is the house law about escaping through a template arriving again.
  //
  // A negated character class needs no escape and is better anyway: it splits on
  // punctuation too, so "magmar, kimura" behaves like "magmar kimura".
  // fold() has already removed apostrophes, so the class no longer needs to
  // keep one. Splitting on everything that is not a letter or a digit also
  // handles the gender symbols in the Nidoran names and the colon in Type: Null.
  return fold(q).split(/[^a-z0-9]+/).filter(function(t){ return t.length > 0; });
}
function hits(c, terms){
  var h = hay(c);
  for (var i = 0; i < terms.length; i++) if (h.indexOf(terms[i]) < 0) return false;
  return true;
}

function search(){
  const q = el("q").value.trim().toLowerCase(), rar = el("rar").value, yr = el("yr").value.trim();
  const terms = termsOf(q);
  // SHOW SOMETHING IMMEDIATELY. This used to read "start typing to search" over
  // an empty panel, which is indistinguishable from broken. With no query we
  // show the best-looking cards we have, so the tool proves itself on load
  // rather than asking the user to prove it first.
  if (!q && !rar && !yr) {
    // The full catalogue, best first, paged. Not a curated 24 — Tyler asked for
    // everything to be available, and a showcase that stops at two dozen is the
    // same hard slice wearing a nicer name.
    // The no-query showcase opens on the cards worth looking at. Every card is
    // now in INDEX, so without this the tool would load on alphabetical commons.
    const pool = INDEX.filter(c => c.hero && monPass(c) && ratingPass(c) && streakPass(c));
    const ranked = sortCards(pool.length ? pool : INDEX.filter(c => monPass(c) && ratingPass(c) && streakPass(c)));
    const pages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
    if (page >= pages) page = 0;
    const showcase = ranked.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    renderPager(ranked.length, pages);
    el("res").innerHTML = showcase.map(c =>
      \`<div class="hit" onclick="add('\${c.i}')"><img src="\${imgSmall(c.i)}" alt="" loading=\"lazy\" data-cid=\"\${c.i}\" onerror=\"imgFallback(this,&#39;\${c.i}&#39;)\">
        <span class=\"failmsg\"></span><b>\${c.n}</b><i>\${c.s} · \${c.y}</i><i>\${c.a}</i></div>\`).join("");
    return;
  }
  // PAGING. The whole index stays in memory — 1.7MB is nothing — and only the
  // current PAGE renders. Holding data is cheap; painting sixteen thousand
  // images is not, and that distinction is the entire performance story.
  // The picker and the sort apply in BOTH paths. A filter that works only
  // after you have typed something is worse than no filter.
  const all = sortCards(INDEX.filter(c => monPass(c) && streakPass(c) &&
    (!terms.length || hits(c, terms)) &&
    (!rar || c.r === rar) && (!yr || c.y === yr)));
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  if (page >= pages) page = 0;
  // NOT "hits". A const named hits inside this function shadows the hits()
  // predicate declared above it, and const is hoisted into a temporal dead
  // zone covering the WHOLE function — so the filter three lines up, which
  // calls hits(c, terms), threw "Cannot access 'hits' before initialization"
  // on every query. The search box has been dead since 2026-08-23 (b7d0a6e).
  //
  // The no-query showcase returns BEFORE this line, so the page looked
  // perfectly healthy on load and only broke when somebody typed. And the
  // gauntlet lifts hits() out of the page and calls it directly, so 6,365
  // checks passed over a search box that could not run at all. A test that
  // calls the helper is not a test of the function that uses it.
  const pageCards = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  renderPager(all.length, pages);
  el("res").innerHTML = pageCards.length ? pageCards.map(c =>
    \`<div class="hit" onclick="add('\${c.i}')"><img src="\${imgSmall(c.i)}" alt="" loading=\"lazy\" data-cid=\"\${c.i}\" onerror=\"imgFallback(this,&#39;\${c.i}&#39;)\">
      <span class=\"failmsg\"></span><b>\${c.n}</b><i>\${c.s} · \${c.y}</i><i class="\${c.a ? "" : "nocred"}">\${c.a || "no credit recorded"}</i></div>\`).join("")
    : suggestHtml(q);
}
safeWire(function(){ ["q","rar","yr"].forEach(id => el(id).addEventListener("input", () => { resetPage(); search(); })); }, "wiring");

function add(id){
  if (tray.some(function(c){ return c.i === id; })) { setStatus("That card is already on the page.", true); return; }
  if (tray.length >= 9) { setStatus("Nine is the most a frame holds.", true); return; }
  const c = INDEX.find(x => x.i === id); if (!c) return;
  tray.push(c); blob = null; render();
}
function remove(k){ tray.splice(k,1); blob = null; render(); }

function setStatus(t, bad){ const s = el("st"); s.textContent = t; s.className = "status" + (bad ? " bad" : ""); }

// OWN / WANT is browser-only, on purpose. The moment we store what somebody owns
// we are holding collection data, which trips user-data-handling in the
// compliance register. In the browser it is a planning tool; on a server it is a
// liability we have not prepared for.
let owned = {};
try { owned = JSON.parse(store.get("catchem-owned") || "{}"); } catch {}
function toggleOwn(id){
  owned[id] = !owned[id];
  try { store.set("catchem-owned", JSON.stringify(owned)); } catch {}
  render();
}

function renderTally(){
  const box = el("tally");
  if (!tray.length) { box.hidden = true; return; }
  box.hidden = false;
  const priced = tray.filter(c => c.p != null);
  const total = priced.reduce((s, c) => s + c.p, 0);
  const have = tray.filter(c => owned[c.i]);
  const haveVal = have.filter(c => c.p != null).reduce((s, c) => s + c.p, 0);
  const missing = tray.length - priced.length;
  const money = n => "$" + Math.round(n).toLocaleString();
  // A total built from partial data must say so. Nine cards where two have no
  // price is not a page total, it is seven cards plus a guess.
  var html = "";
  // SINGLE-QUOTED ATTRIBUTES, DELIBERATELY. These lines are emitted INTO an
  // inline script, and the generator writes them from a template literal, where
  // a backslash-quote is an escape that resolves to a bare quote. So the
  // escaped class attribute here arrived in the output as a plain quoted
  // attribute, sitting inside a double-quoted JS string — which terminated that
  // string and left a stray identifier behind. The whole editor script failed
  // to parse: INDEX, add() and search() were all undefined and the page did
  // nothing at all. Single quotes need no escaping and cannot repeat it.
  // (This comment avoids backticks for the same reason: it lives inside the
  // template literal it describes.)
  // ── A PRICE WITH NO WINDOW IS NOT PUBLISHABLE ───────────────────────────
  // That is a logged incident in this repo - a historical average shipped as a
  // current price - and this panel was showing PAGE COST $8,667 and DEAREST
  // $4,500 as bare numbers with no date anywhere near them. The most confident
  // text in the tool was the least sourced, and the whole product thesis is
  // that our numbers can be trusted.
  //
  // Two things are said now. WHEN the prices were read, always. And whether
  // they are old enough that the number should not be leaned on: a card whose
  // own price date differs from the common one is carried on the row, and a
  // common date more than 14 days behind is called out rather than presented
  // with confidence.
  // esc() DOES NOT EXIST ON THIS PAGE. I reached for it out of habit; there is
  // no such helper here, so calling it would have thrown inside renderTally and
  // taken the whole tally down. These values are a date string and a list of
  // date strings read from our own catalogue, but they are still interpolated
  // into innerHTML, so they get escaped rather than trusted.
  const esc = function(v){
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  };
  const ageDays = (function(){
    if (!PRICES_AS_OF) return null;
    // NO REGEX AND NO BACKSLASH. This was .replace(/'+BS+BS+'//g, "-") and the template
    // literal ate the escape, emitting ///g - which JavaScript reads as a comment
    // that swallowed the rest of the line and broke the whole editor script.
    // split/join needs no escaping and cannot repeat it.
    const t = Date.parse(PRICES_AS_OF.split("/").join("-"));
    return isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000);
  })();
  const olderCards = tray.filter(function(c){ return c.pd; });
  var dateNote = "";
  if (PRICES_AS_OF) {
    dateNote = "priced " + PRICES_AS_OF;
    if (ageDays !== null && ageDays > 14) dateNote += ", " + ageDays + " days ago";
  } else {
    dateNote = "price date unknown";
  }

  html += "<div><span class='k'>PAGE COST</span><span class='v'>" + money(total);
  if (missing) html += " <span style='font-size:12px;color:var(--warn)'>+ " + missing + " unpriced</span>";
  html += "</span></div>";
  html += "<div><span class='k'>YOU HAVE</span><span class='v have'>" + have.length + " / " + tray.length + "</span></div>";
  html += "<div><span class='k'>STILL TO FIND</span><span class='v'>" + money(total - haveVal) + "</span></div>";
  if (priced.length) html += "<div><span class='k'>DEAREST</span><span class='v'>" + money(Math.max.apply(null, priced.map(c => c.p))) + "</span></div>";

  // The window, beside the figures rather than buried in a methodology page.
  html += "<div style='flex-basis:100%;margin-top:2px'><span class='k'>" +
    (ageDays !== null && ageDays > 14 ? "PRICES MAY BE OUT OF DATE" : "WHEN") + "</span>" +
    "<span style='font-size:12px;color:var(--dim)'>" + esc(dateNote);
  if (olderCards.length) {
    html += " · " + olderCards.length + " card" + (olderCards.length > 1 ? "s" : "") +
      " last repriced earlier (" + esc(olderCards.map(function(c){ return c.pd; }).join(", ")) + ")";
  }
  html += "</span></div>";
  box.innerHTML = html;
}

// INTENT drives the copy, the frame, and one refusal.
let fIntent = "post";
safeWire(function(){ el("fintent").querySelectorAll(".chip").forEach(b => b.onclick = () => {
  fIntent = b.dataset.i;
  el("fintent").querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.i === fIntent));
  render();
}); }, "fintent");

// SEALED stock imagery is standard - every sealed box looks identical and a
// buyer is purchasing a SKU. SINGLES stock imagery is misrepresentation, because
// the whole question on a single is condition and the buyer needs to see THAT
// card. The refusal is the feature.
function checkIntent(){
  const box = el("refuse");
  // EVERY CARD IN THE TRAY IS A SINGLE. card-index.json is generated from
  // card-catalogue.json, which is the singles catalogue — 16,468 singles and
  // not one sealed product. So classifying by NAME was both unnecessary and
  // wrong, and wrong in the way substring matching always is: /tin/ matched
  // inside Dra-tin-i, Figh-tin-g Energy, Man-tin-e and Vic-tin-i. 174 real
  // singles read as sealed, and a tray of three of them defeated the refusal
  // completely — sell intent, no warning, a finished sell image of stock art.
  //
  // If sealed products ever enter the tray they must arrive with an explicit
  // kind. Absence of a flag means single, which fails toward refusing.
  const singles = tray.filter(c => c.kind !== "sealed");
  if (fIntent === "sell" && singles.length) {
    box.hidden = false;
    box.innerHTML = "<b>We will not make a sell image for singles.</b><br>" +
      "The whole question on a single is condition, and a buyer needs to see the card you are actually sending. " +
      "Stock art of a pristine copy is misrepresentation and marketplaces treat it that way. " +
      "<br><br>Photograph the card and we will format your photo instead — or switch to <b>want</b>, <b>trade</b> or <b>a post</b>, where stock art is exactly right.";
    return false;
  }
  box.hidden = true;
  return true;
}

// THE STREAK. A creator picks a filter once; the tool serves cards that fit it
// and have not been used. The filter is what keeps two creators from posting
// the same series out of the same pool.
let streak = null;
try { streak = JSON.parse(store.get("catchem-streak") || "null"); } catch {}

function saveStreak(){ try { store.set("catchem-streak", JSON.stringify(streak)); } catch {} }

const STREAK_FILTERS = {
  "ir-any":    { series: "posting one Illustration Rare a day", label: "Illustration Rares", test: c => /Illustration Rare/i.test(c.r || "") },
  "ir-cheap":  { series: "posting one Illustration Rare under $3", label: "IRs under $10",      test: c => /Illustration Rare/i.test(c.r || "") && c.p != null && c.p < 10 },
  "ir-mid":    { series: "posting one mid-priced Illustration Rare a day", label: "IRs under $25",      test: c => /Illustration Rare/i.test(c.r || "") && c.p != null && c.p < 25 },
  "sir-only":  { series: "posting one Special Illustration Rare a day", label: "Special Illustration Rares", test: c => /Special Illustration Rare/i.test(c.r || "") },
  "ir-modern": { series: "posting one modern Illustration Rare a day", label: "IRs from 2024 on",   test: c => /Illustration Rare/i.test(c.r || "") && c.y >= "2024" },
  // PRICE BANDS. Restricted to Illustration Rares these pools are 18 and 32
  // cards — nine and sixteen days, which is not a streak, it is a fortnight.
  // Open to every hero rarity they run 141 and 119 days, and nothing is lost:
  // a Rare Holo at $2.50 is exactly as postable as an IR at $2.50, and the
  // PRICE BAND is the theme. Restricting rarity too was my assumption, not the ask.
  "two-dollar":  { series: "posting one card I love that costs under $3", label: "The $2–3 shelf", test: c => HERO_RX.test(c.r || "") && c.p != null && c.p >= 2 && c.p <= 3 },
  "five-dollar": { series: "posting one card I love that costs under $6", label: "The $5 pickup",  test: c => HERO_RX.test(c.r || "") && c.p != null && c.p >= 4.50 && c.p <= 5.95 },
  // THE SCOUT'S ANGLES — found by searching the data rather than my memory,
  // which was thinking in categories while the data thinks in structure.
  // Chronological is the strongest: a streak with a DIRECTION beats one with a
  // filter, because "Day 40, we've reached Neo Destiny" is a story and "Day 40,
  // another card" is a counter.
  "chronological": { series: "walking the whole history of this game, one set a day", label: "The whole history, in order", ordered: "date",
    test: c => HERO_RX.test(c.r || "") && c.a && c.y },
  "one-artist":    { series: "posting one card by a single artist", label: "One artist at a time", ordered: "artist",
    test: c => HERO_RX.test(c.r || "") && c.a },
  "cheapest-up":   { series: "posting the cheapest card I have not shown yet", label: "Cheapest first, working up", ordered: "price",
    test: c => HERO_RX.test(c.r || "") && c.p != null },
  // WHAT THE CARD SAYS. Tyler posted Slakoth at 2am after seventeen hours of
  // coding and its attack is called Take It Easy — neither of us knew, because
  // nothing we held could search it. attackNames now rides in the index, so a
  // filter can find the joke by READING the cards rather than by anybody
  // listing Pokemon they think look tired. The word list is here in the open
  // where it can be argued with, which is the same standard a named list is
  // held to; the difference is that membership is derived, not asserted.
  "says-rest": { label: "Cards that tell you to rest",
    words: ["take it easy","sleep","nap","rest","yawn","dream","slack","snooze","doze","drowsy","lazy"],
    test: c => Array.isArray(c.k) && c.k.some(a => ["take it easy","sleep","nap","rest","yawn","dream","slack","snooze","doze","drowsy","lazy"].some(w => String(a).toLowerCase().includes(w))) },
  "says-hit": { label: "Cards that just hit things",
    words: ["punch","kick","slam","smash","tackle","headbutt","bite","slash","crush","pound"],
    test: c => Array.isArray(c.k) && c.k.some(a => ["punch","kick","slam","smash","tackle","headbutt","bite","slash","crush","pound"].some(w => String(a).toLowerCase().includes(w))) },
};

function startStreak(filterId, perDay){
  // REFUSE AN UNKNOWN FILTER rather than storing it and crashing later. Writing
  // a bad name to localStorage turns one bad click into a permanently broken
  // page.
  if (!STREAK_FILTERS[filterId]) { setStatus("Unknown streak filter: " + filterId, true); return; }
  // A SALT PER STREAK, not just the start date. The seed used to be
  // started + day, and the comment beside it claimed two creators on the same
  // filter would 'diverge immediately'. They did not diverge at all: same
  // filter and same start date meant the same seed, and two creators got
  // byte-identical series. Verified by running two fresh streaks on the same
  // day — five days, same three cards each day, both times.
  //
  // The salt is drawn once and stored, so the series stays stable across
  // reloads for its owner while differing from everybody else's.
  const salt = Math.floor(Math.random() * 1e9).toString(36);
  streak = { filter: filterId, perDay: perDay, day: 0, used: [], salt: salt, started: new Date().toISOString().slice(0,10) };
  saveStreak(); nextStreakDay();
}

// NO REPEATS, EVER. A streak that serves the same card twice is a streak
// somebody stops trusting on the day they notice.
function nextStreakDay(){
  if (!streak) return;
  const f = STREAK_FILTERS[streak.filter];
  const used = new Set(streak.used);
  const pool = INDEX.filter(c => f.test(c) && !used.has(c.i) && c.a);
  if (pool.length < streak.perDay) { renderStreak(0); return; }
  // Deterministic per day so reloading does not reshuffle the pick, and seeded
  // by the start date so two creators on the same filter diverge immediately.
  // An ORDERED streak walks the pool in sequence — that is the whole point of
  // it. A seeded shuffle would turn a journey back into a lottery.
  if (f.ordered) {
    const key = f.ordered === "date" ? (c => (c.y || "") + c.s + c.n)
              : f.ordered === "artist" ? (c => (c.a || "") + (c.y || ""))
              : (c => String(Math.round((c.p || 0) * 100)).padStart(9, "0"));
    pool.sort((a, b) => key(a) < key(b) ? -1 : 1);
    const picked = pool.slice(0, streak.perDay);
    streak.day += 1;
    streak.used.push(...picked.map(c => c.i));
    saveStreak();
    tray = picked; blob = null;
    el("label").value = "Day " + streak.day + " — " + f.label;
    render();
    return;
  }
  const seed = (streak.started + (streak.salt || "") + streak.day).split("").reduce((a,ch)=>((a<<5)-a+ch.charCodeAt(0))|0, 0);
  const picked = [];
  for (let k = 0; k < streak.perDay; k++) {
    const i = Math.abs(seed + k * 7919) % pool.length;
    const c = pool.splice(i, 1)[0];
    if (c) picked.push(c);
  }
  streak.day += 1;
  streak.used.push(...picked.map(c => c.i));
  saveStreak();
  tray = picked; blob = null;
  el("label").value = "Day " + streak.day + " — " + f.label;
  render();
}

function renderStreak(remaining){
  const box = el("streakbar");
  if (!box) return;
  box.hidden = false;
  box.innerHTML = "";

  // COLLAPSED UNLESS IT MATTERS. A wall of explanation shown to everybody,
  // including the majority not starting a streak today, is the same mistake the
  // prompt bar fixed. But an ACTIVE streak with a day due is exactly what
  // somebody needs to see, and hiding that is how they miss a day.
  const st = streak ? streakState() : { day: 0, status: "not started" };
  const wrap = document.createElement("details");
  wrap.className = "streakwrap";
  if (streak && st.status !== "done today") wrap.open = true;

  const sum = document.createElement("summary");
  sum.textContent = !streak ? "Start a daily series"
    : st.status === "done today" ? "Day " + st.day + " — done today"
    : st.status === "due" ? "Day " + (st.day + 1) + " is due"
    : st.status === "broken" ? "Day " + st.day + " — gap of " + st.missed + " day" + (st.missed > 1 ? "s" : "")
    : "Daily series";
  wrap.appendChild(sum);

  if (!streak) {
    const p = document.createElement("div");
    p.className = "streakexplain";
    p.textContent = "Pick a rule — one Illustration Rare a day, one card under $3, the whole history in order. The rule is what makes it a series rather than a man posting cards, and the day number is what brings people back. We never repeat a card you have used.";
    wrap.appendChild(p);
    const row = document.createElement("div");
    row.className = "streakactions";
    for (const k of Object.keys(STREAK_FILTERS)) {
      const f = STREAK_FILTERS[k];
      const b = document.createElement("button");
      b.textContent = f.label;
      b.onclick = function(){ startStreak(k); };
      row.appendChild(b);
    }
    wrap.appendChild(row);
    box.appendChild(wrap);
    return;
  }

  const f = STREAK_FILTERS[streak.filter];
  const used = new Set(streak.used || []);
  const left = INDEX.filter(function(c){ return f.test(c) && !used.has(c.i) && c.a; }).length;

  const note = document.createElement("div");
  note.className = "streakexplain";
  note.textContent = st.status === "broken"
    ? "You last counted a day on " + st.last + ". Nothing has been changed — you decide whether this continues the run or starts a new one."
    : left + " card" + (left === 1 ? "" : "s") + " left that you have not used. The count only moves when you tell us you posted.";
  wrap.appendChild(note);

  const row = document.createElement("div");
  row.className = "streakactions";
  const load = document.createElement("button");
  load.className = "go";
  load.textContent = "Load today's card";
  load.onclick = function(){ todaysCard(); };
  const conf = document.createElement("button");
  conf.textContent = st.status === "done today" ? "Already counted today" : "I posted it — count day " + (st.day + 1);
  conf.disabled = st.status === "done today";
  conf.onclick = function(){ confirmPosted(); };
  const filt = document.createElement("button");
  filt.textContent = streakFilterOn ? "Show all cards" : "Show only my streak pool";
  filt.onclick = function(){ toggleStreakFilter(); };
  row.appendChild(load); row.appendChild(conf); row.appendChild(filt);
  wrap.appendChild(row);
  box.appendChild(wrap);
}

function endStreak(){ streak = null; try { store.del("catchem-streak"); } catch {} el("streakbar").hidden = true; }

// Populate the filter list from the same object the picker uses, so a filter
// added in one place cannot go missing in the other.
{
  const sel = el("sfilter");
  if (sel) sel.innerHTML = Object.entries(STREAK_FILTERS)
    .map(([k, v]) => "<option value=" + JSON.stringify(k) + ">" + v.label + "</option>").join("");
}
function beginStreak(){
  startStreak(el("sfilter").value, Number(el("sper").value));
  el("streakstart").hidden = true;
}
if (streak) { const st = el("streakstart"); if (st) st.hidden = true; renderStreak(); }

// roundRect is Chrome 99+, Safari 16+, Firefox 112+. A card-show phone on
// anything older throws mid-draw and the compose dies with no useful message,
// which is the worst possible place to find out. Plain rect is an acceptable
// slab; a broken image is not.
function roundRectSafe(g, x, y, w, h, r){
  if (typeof g.roundRect === "function") { g.beginPath(); g.roundRect(x, y, w, h, r); return; }
  g.beginPath(); g.rect(x, y, w, h);
}
// SLAB COLOURS. Ours, not a replica of anybody's. The label carries the card,
// the set, the year and the illustrator - which is more information than a real
// slab label and is the thing we actually care about.
const SLABS = {
  green: { case: "#0d1512", edge: "#1c3a2c", label: "#132a20", ink: "#e9ecf3", accent: "#36d399", name: "Green" },
  gold:  { case: "#161206", edge: "#3d3112", label: "#221b09", ink: "#f4efe2", accent: "#d9a441", name: "Gold" },
  black: { case: "#0a0a0c", edge: "#232329", label: "#131316", ink: "#e9ecf3", accent: "#8a93a8", name: "Black" },
  ice:   { case: "#0a1016", edge: "#1d3242", label: "#0f1d28", ink: "#e6f0f7", accent: "#6fb8e0", name: "Ice" },
};
let fSlab = "";
safeWire(function(){ el("fslab").querySelectorAll(".chip").forEach(b => b.onclick = () => {
  fSlab = b.dataset.s;
  el("fslab").querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.s === fSlab));
  blob = null; render();
}); }, "fslab");

// Draw a card inside a slab. Proportions are a real slab roughly: the case is
// about 1.3x the card width and 1.5x its height, with the label across the top.
function drawSlab(g, img, x, y, cw, ch, card){
  const sk = SLABS[fSlab]; if (!sk) { g.drawImage(img, x, y, cw, ch); return; }
  const pad = cw * 0.09, labelH = ch * 0.17;
  const SW = cw + pad * 2, SH = ch + labelH + pad * 2;
  const sx = x - pad, sy = y - labelH - pad;
  // case
  g.fillStyle = sk.case; g.strokeStyle = sk.edge; g.lineWidth = Math.max(2, cw * 0.008);
  roundRectSafe(g, sx, sy, SW, SH, cw * 0.035); g.fill(); g.stroke();
  // label band
  g.fillStyle = sk.label;
  roundRectSafe(g, sx + pad * 0.5, sy + pad * 0.5, SW - pad, labelH, cw * 0.02); g.fill();
  // label text - more useful than a real slab label, which is the point
  const lx = sx + pad * 1.1, ly = sy + pad * 0.5;
  g.textAlign = "left";
  g.fillStyle = sk.accent; g.font = "600 " + Math.round(labelH * 0.19) + "px ui-monospace,monospace";
  g.fillText("CATCH'EM", lx, ly + labelH * 0.27);
  g.fillStyle = sk.ink; g.font = "700 " + Math.round(labelH * 0.30) + "px system-ui,sans-serif";
  g.fillText(String(card.n).slice(0, 26), lx, ly + labelH * 0.60);
  // GRADE BADGE. The shelf feeling — "that is what mine would look like" —
  // without borrowing anybody's trade dress. It reads GEM 10, not PSA 10:
  // nobody mistakes it for a grading company's opinion and it still reads
  // instantly as the good one.
  {
    const bw = labelH * 0.62, bx = sx + SW - pad * 1.1 - bw, by = ly + labelH * 0.19;
    g.fillStyle = sk.accent; g.globalAlpha = 0.14;
    roundRectSafe(g, bx, by, bw, bw, bw * 0.18); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = sk.accent; g.lineWidth = Math.max(1.5, bw * 0.035);
    roundRectSafe(g, bx, by, bw, bw, bw * 0.18); g.stroke();
    g.fillStyle = sk.accent; g.textAlign = "center";
    g.font = "700 " + Math.round(bw * 0.20) + "px ui-monospace,monospace";
    g.fillText("GEM", bx + bw / 2, by + bw * 0.36);
    g.font = "800 " + Math.round(bw * 0.46) + "px system-ui,sans-serif";
    g.fillText("10", bx + bw / 2, by + bw * 0.82);
    g.textAlign = "left";
  }
  g.fillStyle = sk.accent; g.font = Math.round(labelH * 0.17) + "px ui-monospace,monospace";
  g.fillText(String(card.s).slice(0, 22).toUpperCase() + "  ·  " + card.y + (card.a ? "  ·  " + String(card.a).slice(0, 18) : ""), lx, ly + labelH * 0.85);
  g.drawImage(img, x, y, cw, ch);
  g.textAlign = "center";
}

// MOOD. The only feature built directly on evidence: all three posts that
// worked started from how Tyler felt, and none used the 84 formulas we
// generate. It matches the WORDS PRINTED ON THE CARD rather than an opinion
// of how a card feels — Psyduck's attack is literally called Overthink — so
// every match is checkable by looking at the card.
let fMood = null;
{
  const box = el("fmood");
  if (box) {
    box.innerHTML = MOODS.map(m => "<button class='chip' data-m='" + m.id + "'>" + m.emoji + " " + m.label + "</button>").join("");
    box.querySelectorAll(".chip").forEach(b => b.onclick = () => {
      fMood = fMood === b.dataset.m ? null : b.dataset.m;
      box.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.m === fMood));
      if (fMood) loadMood(fMood);
      else { renderThemes(); buildIdeas(); }
    });
  }
}

function loadMood(id){
  const m = MOODS.find(x => x.id === id);
  if (!m) return;
  const need = fCount || 2;
  // Take from the top of the ranked list, but not the same cards every time —
  // a mood you can only post once is a mood you use once.
  const top = m.cards.slice(0, Math.min(24, m.cards.length));
  const picked = [];
  const used = new Set();
  while (picked.length < need && used.size < top.length) {
    const i = Math.floor(Math.random() * top.length);
    if (used.has(i)) continue;
    used.add(i);
    const c = INDEX.find(x => x.i === top[i].id);
    if (c) picked.push(c);
  }
  if (picked.length < need) return;
  tray = picked; blob = null;
  lastPref = { kind: "mood", ask: "" };
  anotherCursor = 0;
  el("label").value = m.say;
  // Show WHY each card matched, so nobody has to take our word for it.
  const box = el("ideas");
  // BUILT WITH DOM CALLS. Seven escaped-quote collapses in this file and every
  // string attempt has failed; the DOM approach has held every time. Nothing to
  // escape at any level.
  const ideaBox = el("ideas");
  if (ideaBox) {
    ideaBox.innerHTML = "";
    const d = document.createElement("div");
    d.className = "idea";
    d.onclick = () => loadMood(id);
    const b = document.createElement("b");
    b.textContent = m.emoji + " " + m.label;
    // ONE LINE PER CARD, each with its own reason. A run-on separated by dots
    // is a field dump; a line per card with the reason under it is something
    // somebody actually reads.
    for (const c of picked) {
      const h = m.cards.find(x => x.id === c.i);
      const row = document.createElement("div");
      row.className = "moodcard";
      const nm = document.createElement("span");
      nm.className = "mc-name";
      nm.textContent = c.n;
      const meta = document.createElement("span");
      meta.className = "mc-meta";
      meta.textContent = c.s + " · " + c.y + " · " + (c.a || "artist not recorded");
      const rz = document.createElement("span");
      rz.className = "mc-why";
      rz.textContent = h && h.why ? h.why : "";
      row.appendChild(nm); row.appendChild(meta); row.appendChild(rz);
      d.appendChild(row);
    }
    const hk = document.createElement("div");
    hk.className = "hook";
    hk.textContent = "Matched on the words printed on the card. Click again for a different set.";
    d.appendChild(b); d.appendChild(hk);
    ideaBox.appendChild(d);
  }
  render();
}
window.loadMood = loadMood;

// IMAGE FAILURES, COUNTED AND NAMED. A broken-image icon tells nobody anything,
// and I have now guessed twice at why images fail on Tyler's machine from a
// sandbox that cannot reach the image host. This turns "images aren't working"
// into "34 of 36 failed, first was ecard2-149" — a thing somebody can act on.
let imgFail = 0, imgTotal = 0, firstFail = null;
function imgOk(){ imgTotal++; reportImages(); }
function imgBad(node, id){
  imgFail++; imgTotal++;
  firstFail = firstFail || id;
  const hit = node.closest ? node.closest(".hit") : null;
  if (hit) { hit.classList.add("failed"); const m = hit.querySelector(".failmsg"); if (m) m.textContent = id; }
  reportImages();
}
function reportImages(){
  const box = el("imgstatus");
  if (!box) return;
  if (!imgFail) { box.hidden = true; return; }
  box.hidden = false;
  box.textContent = imgFail + " of " + imgTotal + " card images failed to load. First: " + firstFail +
    ". Card art is hosted by pokemontcg.io — if everything failed, the host is unreachable from your browser.";
}
window.imgOk = imgOk; window.imgBad = imgBad;

// LINE SUGGESTIONS. Options, never a finished post — fifty creators posting an
// identical generated sentence is a bot farm, and the whole point is that each
// register sounds like a different person.
// ── ONE ROW PER CATEGORY, EACH WITH ITS OWN "ANOTHER" ─────────────────────
// A single global re-roll would take away the line somebody just decided they
// liked in order to change a different one. So the cursor is per category:
// change the DIVIDE, keep the ASK.
//
// "Another" and not "Refresh" (which promises the page will reload), not
// "Shuffle" (which promises everything changes), not "New idea" (two words
// doing one word's job). It is the word a person says out loud, and it still
// reads correctly on the sixth tap.
//
// THE BUTTON HIDES WHEN THERE IS NOTHING TO CYCLE TO. A control that does
// nothing when tapped is worse than no control, because the user concludes the
// tool is broken rather than that the pool is one deep. And a category with no
// valid line for these cards has no row at all - Part 2's rule is that a line
// which cannot say something true about THESE cards does not appear, and an
// empty row would smuggle the category back in.
var lineCursor = {};       // register -> index into that register's options
var lineCursorKey = "";    // the tray these cursors belong to
var fVibe = "";

function renderLines(){
  const box = el("lines");
  if (!box) return;
  if (!tray.length) { box.hidden = true; return; }
  const themeName = fTheme ? (THEMES.find(x => x.id === fTheme) || {}).name : null;
  const optsAll = lineOptions(tray, themeName, Number(store.get("typicalViews")) || 0);
  const opts = fVibe ? optsAll.filter(function(o){ return o.reg === fVibe; }) : optsAll;
  if (!opts.length) { box.hidden = true; return; }

  // NEW CARDS, NEW POOLS. Keeping a cursor across a tray change would point at
  // a line that belonged to cards no longer on screen.
  const key = tray.map(function(c){ return c.i; }).join(",");
  if (key !== lineCursorKey) { lineCursor = {}; lineCursorKey = key; }

  // Group in the order the engine offered them, so the strongest shape stays
  // at the top rather than being reordered by category name.
  const order = [], byReg = {};
  for (const o of opts) {
    if (!byReg[o.reg]) { byReg[o.reg] = []; order.push(o.reg); }
    byReg[o.reg].push(o);
  }

  box.hidden = false;
  box.innerHTML = "";
  const h = document.createElement("div");
  h.className = "lhead";
  h.textContent = "SOMETHING TO SAY — TAP ONE, THEN MAKE IT YOURS";
  box.appendChild(h);

  for (const reg of order) {
    const pool = byReg[reg];
    const idx = ((lineCursor[reg] || 0) % pool.length + pool.length) % pool.length;
    const o = pool[idx];

    const row = document.createElement("div");
    row.className = "lrow";

    const b = document.createElement("button");
    b.className = "lineopt";
    const tg = document.createElement("span");
    tg.className = "tag2";
    tg.textContent = o.label.toUpperCase();
    const tx = document.createElement("span");
    tx.className = "txt";
    tx.textContent = o.text;
    b.appendChild(tg); b.appendChild(tx);
    b.onclick = function(){ el("label").value = o.text; rememberLine(o.text); blob = null; };
    row.appendChild(b);

    const a = document.createElement("button");
    a.className = "another";
    a.textContent = "Another";
    if (pool.length > 1) {
      a.setAttribute("aria-label", "Another " + o.label.toLowerCase() + " suggestion");
      a.onclick = function(){
        lineCursor[reg] = idx + 1;
        renderLines();
      };
    } else {
      a.disabled = true;
      a.setAttribute("aria-label", "No other " + o.label.toLowerCase() + " yet");
    }
    row.appendChild(a);
    box.appendChild(row);
  }
}

{
  const vb = el("viberow");
  if (vb) {
    vb.querySelectorAll(".chip").forEach(function(b){
      b.onclick = function(){
        fVibe = b.dataset.v || "";
        vb.querySelectorAll(".chip").forEach(function(x){ x.classList.toggle("on", x === b); });
        const opts = lineOptions(tray, fTheme ? (THEMES.find(function(t){ return t.id === fTheme; }) || {}).name : null, Number(store.get("typicalViews")) || 0);
        const hit = fVibe ? opts.find(function(o){ return o.reg === fVibe; }) : opts[0];
        const lab = el("label");
        if (hit && lab && !lab.value.trim()) lab.value = hit.text;
        if (fVibe === "observation") replyFmt = 0;
        else if (fVibe === "question") replyFmt = 2;
        else if (fVibe === "divide") replyFmt = 3;
        else if (fVibe === "confession") replyFmt = 4;
        renderLines();
        renderSelfReply();
      };
    });
  }
}

// THE SELF-REPLY. @shotguncaio posts the card list as a reply to his own post,
// every time, and those replies pull 1.7K-2K views on their own. It answers the
// question every card post gets before anyone asks it — and the editor already
// knows the answer, so nobody should type it by hand.
// THE DAY NUMBER IS THE HOOK. shotguncaio is on Day 90 of "one Pokemon card I
// love that costs under $10" at 43k followers, and the NUMBER is what makes it a
// series — without it, it is a man posting cards. We built the streak and never
// wrote the sentence.
function streakLine(){
  if (!streak) return null;
  const f = STREAK_FILTERS[streak.filter];
  if (!f) return null;
  const day = (streak.used || []).length + 1;
  const what = f.series || f.label.toLowerCase();
  return "Day " + day + " of " + what + ".";
}
function renderStreakLine(){
  if (!streak || !tray.length) return;
  const line = streakLine();
  const lab = el("label");
  // Only fills an EMPTY label. Overwriting something Tyler wrote would be the
  // tool competing with him, which is the one thing it must never do.
  if (line && lab && !lab.value.trim()) lab.value = line;
}

// ── THIS IS THE STANDARD THE WHOLE PANEL IS HELD TO ────────────────────────
// The credit list was the only part of the suggestion panel that was never
// wrong, and it is worth saying why, because the fix for everything above it
// was to make it work the same way.
//
// It states FACTS ABOUT WHAT IS LOADED AND NOTHING ELSE. Every character comes
// from the tray - the name, the card number, the set, the illustrator - so it
// CANNOT come out generic. There is no sentence here that would survive having
// the cards swapped, because there is no sentence here that was not read from
// the cards.
//
// The suggestion lines above used to fail exactly that test: "Does chasing
// value make you less of a collector?" was offered over every pairing in the
// catalogue. They are now derived the same way this is, and search-gauntlet
// asserts that no line appears for two different pairings.
var replyFmt = 0, replyFmtKey = "";
function renderSelfReply(){
  const box = el("selfreply");
  if (!box) return;
  if (!tray.length) { box.hidden = true; return; }
  box.hidden = false;
  const NL = String.fromCharCode(10);
  const key = tray.map(function(c){ return c.i; }).join(",");
  if (key !== replyFmtKey) { replyFmt = 0; replyFmtKey = key; }
  const notice = (typeof lineOptions === "function")
    ? (lineOptions(tray, null, 0).find(function(o){ return /one picture/.test(o.text); })
      || lineOptions(tray, null, 0).find(function(o){ return o.reg === "observation"; }) || {}).text
    : "";
  const gConn = connectingGroupOf(tray);
  const stacked = !!(gConn && gConn.arr === "down" && tray.length === 2);
  const across = !!(gConn && gConn.arr === "across" && tray.length === 2);
  function credit(c, i){
    const num = c.i.slice(c.i.lastIndexOf("-") + 1);
    const place = stacked ? (i === 0 ? " (top)" : " (underneath)")
      : across ? (i === 0 ? " (left)" : " (right)") : "";
    return c.n + place + " — " + c.s + " " + c.y + " — " + (c.a || "uncredited") + " #" + num;
  }
  const credits = tray.map(credit).join(NL);
  const numbered = tray.map(function(c, i){
    return (i + 1) + ". " + c.n + " · " + c.s + " " + c.y + (c.a ? " · " + c.a : "") + (c.p ? " · $" + Math.round(c.p) : "");
  }).join(NL);
  const where = stacked
    ? tray[0].n + " on top of " + tray[1].n + "."
    : across
      ? tray[0].n + " left, " + tray[1].n + " right."
      : tray.map(function(c){ return c.n; }).join(", ") + ".";
  const caption = (el("label") && el("label").value.trim()) || notice || "";
  var liveShill = "";
  try { if (typeof box.querySelector === "function") liveShill = (box.querySelector("#shill") || {}).value || ""; } catch (e) {}
  const shillKeep = (liveShill && String(liveShill).trim()) || (store.get("catchem-shill") || "");
  const shillLine = shillKeep ? NL + NL + shillKeep : "";
  const pricesAsOf = (typeof PRICES_AS_OF !== "undefined") ? String(PRICES_AS_OF).slice(0, 10) : "";
  const withPrices = tray.map(function(c){
    const num = c.i.slice(c.i.lastIndexOf("-") + 1);
    return c.n + " — " + c.s + " #" + num + (c.p ? " — $" + Math.round(c.p) : " — unpriced");
  }).join(NL) + (pricesAsOf ? NL + NL + "Prices as of " + pricesAsOf + "." : "");
  var map = "";
  if (gConn && gConn.shape && gConn.shape.length) {
    var mi = 0, rows = [];
    for (var ri = 0; ri < gConn.shape.length; ri++) {
      var n = gConn.shape[ri];
      rows.push(tray.slice(mi, mi + n).map(function(c){ return c.n; }).join(" · "));
      mi += n;
    }
    map = rows.join(NL);
  }
  const nSets = [...new Set(tray.map(function(c){ return c.s; }).filter(Boolean))].length;
  const formats = [];
  if (map) formats.push({
    label: "Map",
    text: map + NL + NL +
      (gConn.a ? gConn.a + ". " : "") +
      nSets + " set" + (nSets === 1 ? "" : "s") + ". one picture." + NL + NL +
      "which piece did you already have" + shillLine
  });
  formats.push(
    { label: "Credits", text: (notice ? notice + NL + NL : "") + credits + shillLine },
    { label: "Caption", text: (caption ? caption + NL + NL : "") + credits + shillLine },
    { label: "Inventory", text: numbered + shillLine },
    { label: "Prices", text: withPrices + shillLine },
    { label: "Short", text: where + (gConn && gConn.a ? " " + gConn.a + "." : "") + shillLine },
    { label: "Thread", text: tray.map(function(c, i){
        return (i + 1) + "/ " + c.n + " · " + c.s + (c.a ? " · " + c.a : "");
      }).join(NL) + shillLine },
    { label: "Names", text: tray.map(function(c){ return c.n; }).join(NL) + shillLine },
    { label: "Link first", text: (shillKeep ? shillKeep + NL + NL : "") + (notice ? notice + NL + NL : "") + credits }
  );
  const pick = formats[((replyFmt % formats.length) + formats.length) % formats.length];
  box.innerHTML = "";
  const h = document.createElement("div");
  h.className = "srhead";
  h.textContent = "REPLY TO YOUR OWN POST · " + pick.label.toUpperCase();
  const sh = document.createElement("input");
  sh.id = "shill";
  sh.placeholder = "Your @ or shop link — added to every format";
  sh.value = shillKeep;
  if (typeof sh.addEventListener === "function") {
    sh.addEventListener("change", function(){ store.set("catchem-shill", sh.value.trim()); renderSelfReply(); });
    sh.addEventListener("keydown", function(e){ if (e.key === "Enter") { store.set("catchem-shill", sh.value.trim()); renderSelfReply(); } });
  }
  const pre = document.createElement("pre");
  pre.textContent = pick.text;
  const row = document.createElement("div");
  row.className = "tutacts";
  const b = document.createElement("button");
  b.textContent = "Copy the reply";
  b.onclick = async function(){
    try { await navigator.clipboard.writeText(pick.text); b.textContent = "Copied"; }
    catch { b.textContent = "Select and copy above"; }
  };
  const a = document.createElement("button");
  a.className = "another";
  a.textContent = "Another format";
  a.setAttribute("aria-label", "Another reply format");
  a.onclick = function(){ replyFmt += 1; renderSelfReply(); };
  row.appendChild(b); row.appendChild(a);
  const when = document.createElement("p");
  when.className = "when";
  when.textContent = "Post this reply as soon as the image is up. Add your @ or shop above if you want it on the copy. A day-2 bump is unproven.";
  box.appendChild(h); box.appendChild(sh); box.appendChild(pre); box.appendChild(row); box.appendChild(when);
}

// RATING FILTERS. Each one is a real threshold on a derived number, and the
// panel says which printed field the number came from — because a filter you
// cannot explain is a filter nobody should trust.
//
// AND THE EXPLANATION HAS TO STAY TRUE. This note read "the Baby subtype, or an
// unevolved Basic at 60 HP or less" and was wrong twice over: the rule in
// build-bios.mjs is hp <= 70, and a plain small Basic scores 5 — below this
// filter's own >= 7 threshold — so NO card has ever qualified on the HP shape
// alone. Of the 39 cards that pass, 15 are Baby and 24 are small unevolved
// forms trading at 2.5x their set's median IR. The sentence described a rule
// nobody wrote, sitting directly under a comment promising it could be trusted.
//
// Typed prose about a computed rule drifts the moment the rule moves, and
// nothing fails when it does. search-gauntlet section 12 now checks that a
// number cited in one of these notes is a number the passing cards actually
// exhibit.
const RATING_FILTERS = [
  { id: "cute", label: "Cute", test: (r) => (r.cute ?? 0) >= 7, note: "the Baby subtype, or a small unevolved form the market pays a premium for" },
  { id: "comedy", label: "Funny", test: (r) => (r.comedy ?? 0) >= 8, note: "the attack name is a genuinely absurd one" },
  { id: "serious", label: "Dark", test: (r) => (r.serious ?? 0) >= 9, note: "the printed flavour text uses grim language" },
  { id: "cheap", label: "Under a fiver", test: (r) => (r.price ?? 99) <= 4, note: "the bottom 40% of every priced card" },
  { id: "dear", label: "Expensive", test: (r) => (r.price ?? 0) >= 9, note: "the top 10% of every priced card" },
  { id: "strong", label: "High HP", test: (r) => (r.power ?? 0) >= 8, note: "300 HP or more, printed" },
  { id: "artprem", label: "Art people pay for", test: (r) => (r.artPremium ?? 0) >= 3, note: "it trades at 2.5x or more the median Illustration Rare of its own set — the community paying extra for the artwork specifically" },
  { id: "scarce", label: "Scarce", test: (r) => (r.scarcity ?? 0) >= 8, note: "an Illustration Rare or better, printed" },
];
let fRating = null;
{
  const box = el("frating");
  if (box) {
    box.innerHTML = RATING_FILTERS.map(f => "<button class='chip' data-i='" + f.id + "'>" + f.label + "</button>").join("")
      + "<div class='ratingwhy' id='ratingwhy'></div>";
    box.querySelectorAll(".chip").forEach(b => b.onclick = () => {
      fRating = fRating === b.dataset.i ? null : b.dataset.i;
      lastPref = { kind: "filters", ask: lastPref.ask || "" };
      anotherCursor = 0;
      box.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.i === fRating));
      const f = RATING_FILTERS.find(x => x.id === fRating);
      const w = el("ratingwhy");
      if (w) w.textContent = f ? "Showing cards where " + f.note + "." : "";
      resetPage(); search(); renderThemes(); buildIdeas();
    });
  }
}
function ratingPass(c){
  if (!fRating) return true;
  const f = RATING_FILTERS.find(x => x.id === fRating);
  const b = BIOS[c.i];
  return f && b ? f.test(b) : false;
}

// POKEMON PICKER. 1,547 distinct Pokemon in the shipped set, and 510 of them
// have exactly one card — a flat list would be useless, so the picker shows the
// ones with the most cards and narrows as you type.
let fMon = null, fSort = "mon";
function renderMonChips(q){
  const box = el("monchips");
  if (!box) return;
  const counts = {};
  for (const c of INDEX) { const m = monName(c.n); if (m) counts[m] = (counts[m] || 0) + 1; }
  let names = Object.keys(counts);
  if (q) { const lq = q.toLowerCase(); names = names.filter(n => n.toLowerCase().indexOf(lq) === 0); }
  names.sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  box.innerHTML = names.slice(0, 40).map(n =>
    "<button class='chip" + (fMon === n ? " on" : "") + "' data-m='" + n + "'>" + n + " " + counts[n] + "</button>").join("");
  box.querySelectorAll(".chip").forEach(b => b.onclick = () => {
    fMon = fMon === b.dataset.m ? null : b.dataset.m;
    renderMonChips(el("monq") ? el("monq").value.trim() : "");
    resetPage(); search();
  });
}
function monPass(c){ return !fMon || monName(c.n) === fMon; }
{
  const q = el("monq");
  if (q) q.addEventListener("input", () => renderMonChips(q.value.trim()));
  const sr = document.querySelector(".sortrow");
  if (sr) sr.querySelectorAll(".chip").forEach(b => b.onclick = () => {
    fSort = b.dataset.sort;
    sr.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.sort === fSort));
    resetPage(); search();
  });
}
// SORTING. "Organised" means different things depending on the job — grouping
// by Pokemon keeps every Charizard together, which is what browsing wants, and
// price ordering is what shopping wants.
function sortCards(list){
  const a = list.slice();
  if (fSort === "price") return a.sort(function(x, y){ return (y.p || 0) - (x.p || 0); });
  if (fSort === "new") return a.sort(function(x, y){ return String(y.y).localeCompare(String(x.y)); });
  if (fSort === "old") return a.sort(function(x, y){ return String(x.y).localeCompare(String(y.y)); });
  return a.sort(function(x, y){
    var mx = monName(x.n), my = monName(y.n);
    if (mx !== my) return mx.localeCompare(my);
    return (y.p || 0) - (x.p || 0);
  });
}

// THE STREAK MUST SHOW ITS STATE AND CHANGE THE CARDS. It used to render a bar
// and never touch the browse grid, so turning it on had no visible effect —
// which is indistinguishable from broken, and Tyler read it exactly that way.
let streakFilterOn = false;
function streakPass(c){
  if (!streakFilterOn || !streak) return true;
  const f = STREAK_FILTERS[streak.filter];
  if (!f) return true;
  const used = new Set(streak.used || []);
  return f.test(c) && !used.has(c.i);
}
function toggleStreakFilter(){
  streakFilterOn = !streakFilterOn;
  resetPage(); search(); renderStreak();
}
function todaysCard(){
  // A MISSING FILTER MUST NOT CRASH. A stale localStorage entry from an older
  // build, or a filter renamed between versions, lands here with a name that no
  // longer exists — and reading .test on undefined took the whole page down.
  if (!streak) return;
  const f = STREAK_FILTERS[streak.filter];
  if (!f) { setStatus("That streak used a filter this version no longer has. Start a new one.", true); return; }
  const used = new Set(streak.used || []);
  const pool = INDEX.filter(c => f.test(c) && !used.has(c.i) && c.a);
  if (!pool.length) return;
  // Ordered streaks walk the pool in sequence; the rest pick at random so two
  // creators on the same filter do not get the same card.
  const pick = f.ordered ? pool[0] : pool[Math.floor(Math.random() * pool.length)];
  tray = [pick]; blob = null;
  render();
}
window.toggleStreakFilter = toggleStreakFilter;
window.todaysCard = todaysCard;

// SHOW A REAL IMAGE, NOT A CANVAS. The first thing anybody does with an image
// on a phone is hold it and pick Save Image, and a <canvas> never offers that
// menu — so the most natural action on the device silently did nothing and the
// tool read as broken. Swapping in a real <img> after composing makes the
// obvious gesture work.
var previewUrl = null;
function readBlobUrl(b){
  return new Promise(function(ok, bad){
    var r = new FileReader();
    r.onload = function(){ ok(r.result); };
    r.onerror = function(){ bad(new Error("read")); };
    r.readAsDataURL(b);
  });
}
function openSaveSheet(src){
  var prev = el("savepreview");
  if (prev && src) prev.src = src;
  var sheet = el("savesheet");
  if (sheet) sheet.classList.add("on");
}
function closeSaveSheet(){
  var sheet = el("savesheet");
  if (sheet) sheet.classList.remove("on");
}
window.closeSaveSheet = closeSaveSheet;
function showSaveable(dataUrl){
  const img = el("outimg"), cv = el("cv");
  if (!img || !dataUrl) return;
  previewUrl = dataUrl;
  img.src = dataUrl;
  img.hidden = false;
  img.removeAttribute("hidden");
  img.style.display = "block";
  if (cv) cv.style.display = "none";
  ["copy","share","dl"].forEach(function(i){ if (el(i)) el(i).hidden = false; });
  const hint = el("savehint");
  if (hint) hint.textContent = "Tap Save to Photos. If that is blocked, press and hold the picture.";
  var prev = el("savepreview");
  if (prev) prev.src = dataUrl;
}
async function showSaveableBlob(b){
  if (!b) return;
  blob = b;
  var url = null;
  try { url = await readBlobUrl(b); } catch (e) { url = null; }
  if (!url) {
    try { previewUrl = URL.createObjectURL(b); url = previewUrl; } catch (e2) { return; }
  } else {
    previewUrl = url;
  }
  showSaveable(url);
}
window.showSaveable = showSaveable;

async function copyImage(){
  const b = blob;
  if (!b) { setStatus("Make the image first.", true); return; }
  const png = b.type === "image/png" ? b : new Blob([await b.arrayBuffer()], { type: "image/png" });
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
        setStatus("Copied — paste it straight into your post.");
        return;
      } catch (e1) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": Promise.resolve(png) })]);
          setStatus("Copied — paste it straight into your post.");
          return;
        } catch (e2) { /* fall through */ }
      }
    }
  } catch (e) { /* fall through */ }
  await shareImage();
}
async function shareImage(){
  const src = previewUrl || (el("outimg") && el("outimg").src) || (document.querySelector("#todaypost img") && document.querySelector("#todaypost img").src);
  if (src) openSaveSheet(src);
  try {
    var b = blob;
    if (!b && src && src.indexOf("data:") === 0) {
      var res = await fetch(src);
      b = await res.blob();
    }
    if (!b) { setStatus("Press and hold the picture to save it.", true); return; }
    blob = b;
    var name = (typeof fname === "function" ? fname() : "catchem") + (b.type.indexOf("jpeg") >= 0 ? ".jpg" : ".png");
    const f = new File([b], name, { type: b.type || "image/jpeg" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [f] }))) {
      await navigator.share({ files: [f], title: "Catch'em" });
      setStatus("Pick Save Image / Save to Photos in that menu.");
      return;
    }
    setStatus("Press and hold the picture to save it.");
  } catch (e) {
    if (e && e.name === "AbortError") return;
    setStatus("Press and hold the picture to save it.", true);
  }
}
function openImage(){
  const src = previewUrl || (el("outimg") && el("outimg").src);
  if (!src) { setStatus("Make the image first.", true); return; }
  openSaveSheet(src);
  const w = window.open();
  if (w) {
    try {
      w.document.write('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><img src="' + src + '" style="width:100%;height:auto">');
      w.document.close();
    } catch (e) {}
  }
}
function dlImage(){
  shareImage();
}
window.dlImage = dlImage;
window.copyImage = copyImage; window.shareImage = shareImage; window.openImage = openImage;
window.copyToday = async function(id){
  var node = el(id);
  var t = node && (node.textContent || "");
  if (!t) { setStatus("Nothing to copy.", true); return; }
  try { await navigator.clipboard.writeText(t); setStatus("Copied."); }
  catch (e) { setStatus("Select the text above and copy it.", true); }
};
window.saveToday = async function(){
  var img = document.querySelector("#todaypost img");
  if (!img || !img.src) { setStatus("Picture is missing.", true); return; }
  previewUrl = img.src;
  var out = el("outimg");
  if (out) { out.src = img.src; out.hidden = false; out.style.display = "block"; }
  try {
    var res = await fetch(img.src);
    blob = await res.blob();
  } catch (e) { blob = null; }
  await shareImage();
};

// A FAILED IMAGE MUST SAY SO. A broken icon explains nothing, and the user
// cannot tell a slow connection from a dead host from a broken tool. This tries
// the second host once, then reports — and counts the failures so the boot
// panel can say how many.
let imgFails = 0;
function imgFallback(node, id){
  if (node.dataset.tried) {
    imgFails++;
    node.style.display = "none";
    // SAY IT WHERE THEY ARE LOOKING. This used to write only into #imgstatus,
    // which sits up by the browse grid — somebody looking at the tray halfway
    // down the page saw NOTHING, which is exactly what happened.
    const msg = imgFails + " card image" + (imgFails > 1 ? "s" : "") + " could not load. "
      + "The art is hosted by pokemontcg.io. If none of them load, that host is blocked or unreachable "
      + "from this browser — an in-app browser inside another app is the usual cause. Opening the file in "
      + "Safari or Chrome directly normally fixes it.";
    for (const where of ["imgstatus", "st", "askreply"]) {
      const box = el(where);
      if (box) { box.hidden = false; box.textContent = msg; box.className = (box.className || "").replace(/ bad$/, "") + " bad"; }
    }
    // And mark the slot itself, so the failure is visible AT the empty card
    // rather than only in a status line.
    const slot = node.parentElement;
    if (slot) { slot.style.opacity = "0.5"; slot.setAttribute("title", "image failed to load"); }
    return;
  }
  node.dataset.tried = "1";
  node.src = "https://images.scrydex.com/pokemon/" + id + "/small";
}
window.imgFallback = imgFallback;

// APPLY WHAT WAS UNDERSTOOD. The box sets the same filters the panels do, so
// there is one system underneath and the advanced controls stay honest — they
// show what the sentence actually did.
// EVERY ONE OF THESE IS VERIFIED TO RETURN CARDS. An example chip that returns
// nothing is worse than no chip: it teaches a first-time user that the box does
// not work, on their first attempt, using our own suggestion.
const EXAMPLES = [
  { q: "the fishes", label: "Carvanha · Sharpedo", demo: true },
  { q: "the birds", label: "3 birds · one painting" },
  { q: "connecting art", label: "connecting art" },
  { q: "what kimura drew twice", label: "Same Pokémon, 25 years later" },
];
function intentCtx(){
  return {
    // POKEMON ONLY. Built from every card, this list contained "Evolution"
    // (from the Trainer card Evolution Incense), "Incense", "Candy" and every
    // other Trainer noun — and the matcher takes the LONGEST match, so a
    // Trainer noun beat the creature the person actually named.
    monNames: [...new Set(INDEX.filter(c => c.sup === "P").map(c => monName(c.n)))],
    artists: [...new Set(INDEX.map(c => c.a).filter(Boolean))],
    sets: [...new Set(INDEX.map(c => c.s))],
    moods: MOODS,
    examples: EXAMPLES.map(function(e){ return e.q; }),
  };
}

// ── ASK: PLAIN LANGUAGE TO A RELATION ──────────────────────────────────────
// The box says "What do you want to post?" and until now it resolved to
// FILTERS - a Pokemon, a set, a rating. Filters cannot express the shapes that
// actually work, which are all relationships: the same creature across years,
// one illustrator returning, a whole evolution line. So a person could ask for
// the thing the tool is best at and get a flat list back.
//
// DETERMINISTIC, AND EXPLAINABLE ON PURPOSE. No model, no scoring, no ranking
// that cannot be read back. Every resolution states WHICH relation it chose and
// WHY, so a wrong interpretation is visible in one line instead of looking like
// the tool simply not working. That is the whole difference between "it is
// broken" and "it heard me wrong".
//
// NOT ONE BACKSLASH IN THIS BLOCK. Every pattern is a plain indexOf on a
// lowercased string. Regex escapes written here are emitted through a template
// literal and eaten before they reach the browser, which is how the tokeniser
// shipped as split on the letter "s". Phrase matching needs no escapes, so it
// gets none.
var ASK_NAMES = null, ASK_ARTISTS = null;
function askVocab(){
  if (ASK_NAMES) return;
  ASK_NAMES = {}; ASK_ARTISTS = {};
  for (var i = 0; i < INDEX.length; i++) {
    var c = INDEX[i];
    ASK_NAMES[String(c.n).toLowerCase()] = c.n;
    if (c.a) ASK_ARTISTS[String(c.a).toLowerCase()] = c.a;
  }
}

// WHOLE TOKENS, NEVER A SUBSTRING OF A NAME. There is a card called "N" - the
// Team Plasma character - so a raw indexOf found a Pokemon named N inside the
// word "everything", and "everything kimura drew" resolved as a revisit of N.
// This is the /tin/i class that once matched Dratini and Mantine across 174
// singles, arriving in a new place. The text is pre-padded and space-normalised
// so a token test is just an indexOf on " token ".
// Longest match still wins, so "mr mime" is not resolved as "mime".
function askFind(text, table){
  var best = null;
  for (var k in table) {
    // "magmars over the years" is how a person says it. A whole-token test
    // alone rejected the plural, which is worse than the substring bug it
    // replaced because it fails on the phrasing people actually use.
    if (text.indexOf(" " + k + " ") < 0 && text.indexOf(" " + k + "s ") < 0) continue;
    if (!best || k.length > best.length) best = k;
  }
  return best ? table[best] : null;
}
// An artist can also be named by surname alone - "everything kimura drew".
// A SURNAME THAT IS ALSO A POKEMON IS NOT A SURNAME HERE. One credit reads
// "2017 Pikachu Project", so matching on its parts made "pikachu through the
// years" resolve as that studio's body of work rather than the creature's. When
// a token names a Pokemon, the Pokemon wins - it is what the person typed.
function askArtistLoose(text, monName){
  var hit = askFind(text, ASK_ARTISTS);
  if (hit) return hit;
  var best = null;
  for (var k in ASK_ARTISTS) {
    var parts = k.split(" ");
    for (var j = 0; j < parts.length; j++) {
      var p = parts[j];
      if (p.length < 4) continue;
      if (ASK_NAMES[p]) continue;                                  // it is a Pokemon
      if (monName && p === String(monName).toLowerCase()) continue;
      if (text.indexOf(" " + p + " ") < 0) continue;
      if (!best || ASK_ARTISTS[k].length > best.length) best = ASK_ARTISTS[k];
    }
  }
  return best;
}

function askResolve(text){
  askVocab();
  var t = " " + String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
  var has = function(list){ for (var i = 0; i < list.length; i++) if (t.indexOf(" " + list[i] + " ") >= 0 || t.indexOf(list[i]) >= 0) return true; return false; };
  var mon = askFind(t, ASK_NAMES);
  var artist = askArtistLoose(t, mon);

  // THE MORNING POST. Naming the three beasts pins Sugimori's Neo Revelation
  // painting. "One painting" by itself must NOT, or every 3-card connecting
  // query becomes Entei and Another never reaches the birds.
  if ((has(["entei"]) && has(["raikou"]) && has(["suicune"])) || has(["the beasts"]))
    return { relation: "CONNECTING_ART", subject: null, need: 3,
      pin: "neo3-6|neo3-13|neo3-14",
      why: "the Neo Revelation beasts are one picture" };
  if ((has(["moltres"]) && has(["zapdos"]) && has(["articuno"])) ||
      has(["legendary birds", "the birds", "three birds"]))
    return { relation: "CONNECTING_ART", subject: null, need: 3,
      pin: "basep-21|basep-23|basep-22",
      why: "the Wizards promo birds are one picture" };
  if (has(["mega venusaur"]) || has(["mashu venusaur"]) ||
      (has(["bulbasaur"]) && has(["ivysaur"]) && has(["venusaur"])))
    return { relation: "CONNECTING_ART", subject: null, need: 3,
      pin: "me1-133|me1-134|me1-177",
      why: "mashu drew the Venusaur line as one picture" };
  if ((has(["carvanha"]) && has(["sharpedo"])) || has(["the fishes", "fishes", "the shark"]))
    return { relation: "CONNECTING_ART", subject: null, need: 2,
      pin: "ex1-51|ex1-22",
      why: "Carvanha and Sharpedo are one picture, left to right" };
  if (has(["hyogonosuke"]) || has(["the beach"]) || has(["nine cards one beach"]))
    return { relation: "CONNECTING_ART", subject: null, need: 9,
      pin: "sv4pt5-31|sv3-8|sv4-152|sv2-42|sv2-96|sv4-91|sv3-180|sv1-151|sv4-30",
      why: "HYOGONOSUKE's nine-card beach" };

  var need = 0;
  if (has(["nine cards", "9 cards"])) need = 9;
  else if (has(["eight cards", "8 cards"])) need = 8;
  else if (has(["six cards", "6 cards"])) need = 6;
  else if (has(["four cards", "4 cards"])) need = 4;
  else if (has(["three cards", "3 cards", "three card"])) need = 3;
  else if (has(["two cards", "2 cards", "a pair"])) need = 2;
  else {
    var trail = t.match(/ ([0-9]+) $/);
    if (trail && [1, 2, 3, 4, 6, 8, 9].includes(Number(trail[1]))) need = Number(trail[1]);
  }

  var TYPES = ["fire", "water", "grass", "lightning", "psychic", "fighting",
    "darkness", "metal", "dragon", "fairy", "colorless"];
  var type = null;
  for (var ti = 0; ti < TYPES.length; ti++) if (t.indexOf(" " + TYPES[ti] + " ") >= 0) type = TYPES[ti];
  var setHit = null;
  for (var si = 0; si < INDEX.length; si++) {
    var sn = String(INDEX[si].s).toLowerCase();
    if (t.indexOf(" " + sn + " ") >= 0 && (!setHit || sn.length > setHit.length)) setHit = sn;
  }
  var setName = null;
  if (setHit) for (var sj = 0; sj < INDEX.length; sj++) if (String(INDEX[sj].s).toLowerCase() === setHit) { setName = INDEX[sj].s; break; }

  // ── A CONCEPT WITH NO SUBJECT IS STILL A REQUEST ────────────────────────
  // Tyler typed "connecting art" and got Articuno, Artazon, Wartortle, Dartrix,
  // Beartic and Kartana — fuzzy matches on letters, over a catalogue holding 269
  // connecting-art groups. Every trigger below this point requires a named
  // Pokemon, artist or set, so a bare concept matched nothing, fell through to
  // name-fuzz, and came back with six Pokemon that share letters with "art".
  //
  // The chips already prove the tool HAS concepts. The free-text box just could
  // not reach them, which makes typing the thing strictly worse than tapping it.
  //
  // THESE RUN FIRST, AND ONLY THESE. The comment below about relations running
  // second is still right for NAMED queries - it protects prompts ask-smoke
  // covers. But a query naming no card and no artist has nothing for the name
  // path to answer well, so there is no tested behaviour to regress.
  var bare = !mon && !artist && !setName;
  if (bare) {
    if (has(["connecting art", "connected art", "cards that connect",
             "connecting", "one picture", "one painting", "join up", "joins up", "art that connects", "puzzle"]))
      return { relation: "CONNECTING_ART", subject: null, need: need || 0,
        why: "you asked about art that connects across cards" };
    if (has(["same artist", "one artist", "same illustrator", "one illustrator",
             "by the same", "single artist"]))
      return { relation: "SAME_ARTIST", subject: null,
        why: "you asked for cards sharing an illustrator" };
    if (has(["evolution line", "evolution", "evolves", "whole line", "the line",
             "family", "evolutionary"]))
      return { relation: "EVOLUTION_LINE", subject: null,
        why: "you asked about an evolution line" };
    if (has(["came back", "come back", "returned", "revisit", "years apart",
             "years later", "drew it again", "same pokemon twice", "drew twice"]))
      return { relation: "ARTIST_REVISITS", subject: null,
        why: "you asked about an illustrator returning to a subject" };
    if (has(["across time", "over the years", "through the years", "then and now",
             "old and new", "history", "eras"]))
      return { relation: "SAME_POKEMON_ACROSS_TIME", subject: null,
        why: "you asked to see one Pokemon across time" };
  }

  // ORDER IS THE POLICY. The most specific shape is tested first, so
  // "everything kimura drew for magmar" resolves as a revisit rather than as
  // that artist's whole catalogue.
  if (has(["came back", "come back", "returned", "revisit", "went back", "again years", "drew twice", "twice"])) {
    return { relation: "ARTIST_REVISITS", subject: artist || null,
      why: artist
        ? "you named " + artist + ", and asked about coming back to a subject"
        : "you asked about illustrators returning to a subject, and named no one in particular" };
  }
  // A BODY-OF-WORK ASK BEATS A REVISIT ASK. "everything kimura drew" names one
  // illustrator and wants all of it; testing the revisit rule first turned that
  // into a two-card pairing, which is not what was asked for.
  if (artist && has(["everything", "every card", "all of", "all the", "drew", "drawn", "illustrated", "body of work"])) {
    return { relation: "SAME_ARTIST", subject: artist,
      why: "you asked for a body of work and named " + artist };
  }
  if (setName && type) {
    return { relation: "SAME_SET_AND_TYPE", subject: setName, type: type,
      why: "you named a set (" + setName + ") and a type (" + type + ")" };
  }
  if (mon && artist) {
    return { relation: "ARTIST_REVISITS", subject: mon, artist: artist,
      why: "you named both an illustrator (" + artist + ") and a Pokemon (" + mon + ")" };
  }
  if (has(["line", "evolution", "evolves", "evolve", "family"]) && mon) {
    return { relation: "EVOLUTION_LINE", subject: mon,
      why: "you said line or evolution, and named " + mon };
  }
  if (mon && has(["over the years", "through the years", "across time", "through time", "history", "years", "era", "eras", "old and new", "then and now"])) {
    return { relation: "SAME_POKEMON_ACROSS_TIME", subject: mon,
      why: "you named " + mon + " and asked about time" };
  }
  if (artist) return { relation: "SAME_ARTIST", subject: artist, why: "you named " + artist + " and nothing narrower" };
  if (mon) return { relation: "SAME_POKEMON_ACROSS_TIME", subject: mon, why: "you named " + mon + " and nothing narrower" };
  return null;
}

// POST OFFICE. Someone on X asked the room to show a card. The editor makes
// posts; this reads THEIR post and answers it. The trap is taking the bait of
// "better". Tyler did not: "some that i personally love. they feel different
// than most." Taste, not a scoreboard. The Chrome tool is this plus a paste.
const CTA_SHOW_LINES = [
  "some that i personally love. they feel different than most",
  "not better. just the ones i keep looking at",
  "these two never get old for me",
  "mine aren't a flex. they're just the ones i actually like looking at"
];
const CTA_SHOW_ONE = "one i personally love. it feels different than most";
const CTA_DEMO = "This is my best Charizard so far. Bought it at @Beezie\\n\\nShow me a better one below (Blaine's Charizard is not allowed)";
const FORMAT_N = [1, 2, 3, 4, 6, 8, 9];
var officeCount = 1;

function parseCta(text){
  askVocab();
  var raw = String(text || "");
  var t = " " + raw.toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
  var mon = askFind(t, ASK_NAMES);
  var kind = null;
  var keys = ["show me", "show yours", "drop yours", "better one", "better than",
    "yours below", "post yours", "pull one up", "your favorite", "your favourite",
    "drop your", "let me see"];
  for (var ki = 0; ki < keys.length; ki++) if (t.indexOf(keys[ki]) >= 0) { kind = "show-yours"; break; }
  var exclude = [];
  var trainers = ["blaine", "brock", "misty", "erika", "sabrina", "koga", "giovanni"];
  var banned = /not allowed|isnt allowed|isn't allowed|no |except |without |banned/.test(t);
  for (var ti = 0; ti < trainers.length; ti++) {
    if (t.indexOf(" " + trainers[ti] + " ") >= 0 && banned) exclude.push(trainers[ti]);
  }
  var yearHit = raw.match(/\\b((?:19|20)\\d{2})\\b/);
  var year = yearHit ? Number(yearHit[1]) : null;
  return { mon: mon, kind: kind, exclude: exclude, year: year, raw: raw };
}

function ctaRequired(r){
  var t = " " + String((r && r.raw) || "").toLowerCase() + " ";
  if (!r || !r.mon) return 0;
  if (/evol/.test(t)) {
    var line = evoLineFor(r.mon);
    if (line && line.length > 1) return Math.min(9, line.length);
  }
  if (/connect|one picture|one painting|joins up/.test(t)) {
    for (var i = 0; i < CONNECTING.length; i++) {
      var ids = CONNECTING[i].c || [];
      var cards = ids.map(function(id){ return byIdRow[id]; }).filter(Boolean);
      if (cards.length > 1 && cards.some(function(c){ return monName(c.n) === r.mon; }))
        return cards.length;
    }
  }
  if (/(pair|both of|these two|two of them)/.test(t)) return 2;
  return 0;
}

function snapFormat(n){
  n = Number(n) || 1;
  if (LAYOUTS[n]) return n;
  for (var i = 0; i < FORMAT_N.length; i++) if (FORMAT_N[i] >= n) return FORMAT_N[i];
  return 9;
}

function expandIfRequired(cards){
  if (!cards || !cards.length) return cards || [];
  var g = connectingGroupOf(cards);
  if (!g && cards.length === 1) {
    var id = cards[0].i;
    for (var i = 0; i < CONNECTING.length; i++) {
      if ((CONNECTING[i].c || []).indexOf(id) >= 0 && CONNECTING[i].c.length > 1) {
        g = CONNECTING[i]; break;
      }
    }
  }
  if (g && g.c && g.c.length > cards.length) {
    var full = g.c.map(function(id){ return byIdRow[id]; }).filter(Boolean);
    if (full.length > cards.length) return orderByConnecting(full);
  }
  return cards;
}

function pickShowYours(r, opts){
  opts = opts || {};
  var skip = opts.exclude instanceof Set ? opts.exclude : new Set();
  var rot = Number(opts.rot) || 0;
  var need = Math.max(1, Number(opts.need) || officeCount || 1);
  var ex = (r.exclude || []).map(function(x){ return String(x).toLowerCase(); });
  var pool = INDEX.filter(function(c){
    if (skip.has(c.i)) return false;
    if (monName(c.n) !== r.mon) return false;
    var nm = String(c.n).toLowerCase();
    for (var i = 0; i < ex.length; i++) if (nm.indexOf(ex[i]) === 0 || nm.indexOf(ex[i] + "'s") >= 0 || nm.indexOf(ex[i] + "s ") >= 0) return false;
    return true;
  });
  if (r.year) {
    var split = r.year < 2014
      ? pool.filter(function(c){ return (parseInt(c.y, 10) || 0) >= 2020; })
      : pool.filter(function(c){ return (parseInt(c.y, 10) || 0) <= 2007; });
    if (split.length >= need) pool = split;
  }
  pool.sort(function(a, b){ return (parseInt(b.y, 10) || 0) - (parseInt(a.y, 10) || 0); });
  if (rot) pool = pool.slice(rot).concat(pool.slice(0, rot));
  var picked = [], seenA = {};
  for (var i = 0; i < pool.length && picked.length < need; i++) {
    var a = pool[i].a || ("#" + i);
    if (need > 1 && seenA[a] && picked.length) continue;
    seenA[a] = 1;
    picked.push(pool[i]);
  }
  if (picked.length < need) picked = pool.slice(0, need);
  return expandIfRequired(picked);
}

function markCount(n){
  n = Number(n) || 0;
  if (FORMAT_N.indexOf(n) < 0) return;
  fCount = n;
  officeCount = n;
  var sel = el("cardcount");
  if (sel && String(sel.value) !== String(n)) sel.value = String(n);
  ["postcount", "fcount", "ctacount"].forEach(function(id){
    var box = el(id);
    if (box) box.querySelectorAll(".chip").forEach(function(x){ x.classList.toggle("on", Number(x.dataset.n) === n); });
  });
}
function applyCount(n, rerun){
  markCount(n);
  if (!rerun) return;
  anotherCursor = 0;
  if (lastPref.kind === "cta" && lastPref.ask) answerCta(lastPref.ask);
  else if (lastPref.ask) runAsk(lastPref.ask);
}
function syncOfficeCount(n){
  officeCount = snapFormat(n);
  fCount = officeCount;
  var box = el("ctacount");
  if (box) box.querySelectorAll(".chip").forEach(function(x){ x.classList.toggle("on", Number(x.dataset.n) === officeCount); });
  var fc = el("fcount");
  if (fc) fc.querySelectorAll(".chip").forEach(function(x){ x.classList.toggle("on", Number(x.dataset.n) === fCount); });
  markCount(officeCount);
}

function answerCta(text){
  var r = parseCta(text);
  var box = el("askreply");
  var hint = el("officehint");
  if (!r.kind) {
    if (box) { box.textContent = "I don't see a call to action. Need 'show me yours', 'drop a better one', something like that."; box.className = "askreply bad"; }
    return r;
  }
  if (!r.mon) {
    if (box) { box.textContent = "I see the ask, but not which Pokemon."; box.className = "askreply bad"; }
    return r;
  }
  var req = ctaRequired(r);
  var n = req || officeCount || 1;
  n = req ? n : snapFormat(n);
  var cards = pickShowYours(r, { need: n });
  if (!cards.length) {
    if (box) { box.textContent = "Nothing in the catalogue for " + r.mon + " after skipping what they banned."; box.className = "askreply bad"; }
    return r;
  }
  if (cards.length !== n) { n = cards.length; syncOfficeCount(LAYOUTS[n] ? n : officeCount); }
  else syncOfficeCount(n);
  tray = cards.slice(0, LAYOUTS[cards.length] ? cards.length : 9); blob = null;
  lastPref = { kind: "cta", ask: text, need: tray.length };
  anotherCursor = 0;
  trail = [];
  var lab = el("label");
  if (lab) lab.value = tray.length <= 1 ? CTA_SHOW_ONE : CTA_SHOW_LINES[0];
  var skip = r.exclude.length ? ", skipped " + r.exclude.join("/") : "";
  var why = req ? "these cards need " + tray.length : tray.length + " card" + (tray.length === 1 ? "" : "s");
  var msg = "Answering " + r.mon + skip + " — " + why + ".";
  if (box) { box.textContent = msg; box.className = "askreply"; }
  var hint = el("officehint");
  if (hint) { hint.hidden = false; hint.textContent = msg; }
  var cr = el("copyreply");
  if (cr) cr.hidden = false;
  var field = el("cta");
  if (field && typeof field.blur === "function") field.blur();
  render(); resetPage(); search();
  if ((document.body && document.body.getAttribute && document.body.getAttribute("data-mode") === "reply") && typeof composeImage === "function") {
    try { composeImage(); } catch (e) {}
  }
  return r;
}

window.parseCta = parseCta;
window.answerCta = answerCta;
window.pickShowYours = pickShowYours;

async function copyReply(){
  var t = (el("label") && el("label").value.trim()) || "";
  if (!t) { setStatus("No reply to copy.", true); return; }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(t);
      setStatus("Reply copied — paste it under their post.");
      return;
    }
  } catch (e) {}
  var lab = el("label");
  if (lab) { lab.focus(); lab.select(); }
  setStatus("Select the line and copy it (Ctrl+C).", true);
}
window.copyReply = copyReply;

// Turn a resolution into cards, plus the one-line REASON that a human edits
// into a caption. The reason is a statement of fact and never a caption.
// ── ONE DEFINITION, TWO CALLERS ───────────────────────────────────────────
// This lived ONLY as a property of the object literal handed to
// resolvePrompt(), so resolvePrompt could reach it via helpers.evoLineFor and
// askCards could not. askCards called it bare anyway:
//
//     var line = evoLineFor(root);      // ReferenceError, every time
//
// That branch has been broken since it was written and no test ever drove it,
// because relations run SECOND and the older parser answered every evolution
// prompt first. It surfaced the moment a bare "evolution line" query — which
// has no named Pokemon for the older parser to catch — reached the relation
// path. Same shape as the const-shadowed search box: a live path nothing called.
// BOTH DIRECTIONS. This only ever walked FORWARD, so asking about a middle or
// final stage returned a truncated line: "blastoise evolution" gave Blastoise
// alone, because nothing evolves FROM Blastoise. A person naming any member of
// a family means the family.
function evoRootOf(name){
  var cur = name;
  for (var i = 0; i < 3; i++) {
    var parent = null;
    for (var id in ATTRS) {
      var a = ATTRS[id];
      if (!a || !a.ev) continue;
      var row = byIdRow[id];
      if (!row) continue;
      if (monName(row.n !== undefined ? row.n : row[1]) === cur) { parent = monName(a.ev); break; }
    }
    // THE BABY LINK IS NOT PRINTED ON THE CARD. A Pikachu is a Basic and never
    // says "evolves from Pichu", so ATTRS alone stops at Pikachu and
    // "pichu evolution" returned Pichu on its own. BABY_OF is the documented
    // closed list this file already carries — it just was not consulted here.
    if (!parent && BABY_OF[cur]) parent = BABY_OF[cur];
    if (!parent || parent === cur) break;
    cur = parent;
  }
  return cur;
}

function evoLineFor(name){
  name = evoRootOf(name);
  const line = [name]; let cur = name;
  for (var i = 0; i < 3; i++) {
    var next = null;
    // ROW IS AN OBJECT, NOT AN ARRAY. byIdRow holds the index records — {i,n,s,
    // y,a,r} — so row[1] is undefined, monName(undefined) is empty, and the
    // chain broke on its first step. evoLineFor has therefore NEVER returned
    // more than the name it was given, which is why "evolution line" answered
    // with one card even once the exemplar was right. The sibling walker eight
    // lines up already guards this with row0.n !== undefined ? row0.n : row0[1];
    // this one did not.
    for (var id in ATTRS) { var a = ATTRS[id]; if (a && a.ev === cur) { var row = byIdRow[id]; if (row) { next = monName(row.n !== undefined ? row.n : row[1]); break; } } }
    // Forward across the same unprinted link: Pichu -> Pikachu.
    if (!next) {
      for (var bk in BABY_OF) if (BABY_OF[bk] === cur) { next = bk; break; }
    }
    if (!next || line.indexOf(next) >= 0) break;
    line.push(next); cur = next;
  }
  return line;
}

function askCards(r, opts){
  var out = [], reason = "";
  var byYear = function(a, b){ return String(a.y).localeCompare(String(b.y)); };
  var byId = function(id){ return byIdRow[id] || null; };
  opts = opts || {};
  var skipIds = opts.exclude instanceof Set ? opts.exclude : new Set();
  var rot = Number(opts.rot) || 0;

  // ── CONNECTING ART, WHICH THIS FUNCTION COULD NOT ANSWER AT ALL ─────────
  // Not a missing branch so much as a missing dataset - see CONNECTING above.
  if (r.relation === "CONNECTING_ART") {
    var pool = CONNECTING.filter(function(g){
      if (r.subject) return (g.a && g.a === r.subject) || (g.n && g.n === r.subject);
      return true;
    });
    // Prefer a group we can show whole: every card present in the index.
    var whole = [];
    for (var gi = 0; gi < pool.length; gi++) {
      var cs = pool[gi].c.map(byId).filter(Boolean);
      if (cs.length === pool[gi].c.length && cs.length > 1) whole.push({ g: pool[gi], cards: cs });
    }
    if (whole.length) {
      // THE PINNED TRIO FIRST. Ken Sugimori's Neo Revelation beasts are the
      // post: three cards, one painting, Entei left of Raikou left of Suicune.
      // Smallest-first used to bury them behind every 2-card pair, so the
      // connecting-art chip never opened on the thing worth posting.
      var want = Number(typeof fCount === "number" ? fCount : 0);
      var sized = whole;
      if (!r.pin && want >= 2) {
        var exact = whole.filter(function(w){ return w.cards.length === want; });
        if (exact.length) sized = exact;
        else {
          var bigger = whole.filter(function(w){ return w.cards.length > want; })
            .sort(function(a, b){ return a.cards.length - b.cards.length; });
          sized = bigger.length ? bigger : whole.slice().sort(function(a, b){ return b.cards.length - a.cards.length; });
        }
      } else if (!r.pin) {
        var pairs = whole.filter(function(w){ return w.cards.length === 2; });
        sized = pairs.length ? pairs : whole.slice().sort(function(a, b){ return a.cards.length - b.cards.length; });
      }
      var unusedG = sized.filter(function(w){
        return w.cards.every(function(c){ return !skipIds.has(c.i); });
      });
      var listG = unusedG.length ? unusedG : sized;
      var pick = null;
      if (r.pin && !rot) {
        for (var pi = 0; pi < whole.length; pi++)
          if (whole[pi].g.c.join("|") === r.pin) { pick = whole[pi]; break; }
      }
      if (!pick) pick = listG[rot % listG.length];
      out = orderByConnecting(pick.cards);
      reason = (pick.g.a ? pick.g.a + " drew " : "") + out.length +
        " cards that form one picture" +
        (pick.g.arr === "down" ? ", top to bottom" : pick.g.arr === "across" ? ", left to right" : "") +
        ". We hold " + CONNECTING.length + " such groups.";
    }
    return { cards: out, reason: reason };
  }

  // ── A BARE CONCEPT NEEDS AN EXEMPLAR ───────────────────────────────────
  // "same artist" and "evolution line" name no subject. Rather than returning
  // nothing, pick a real one from the data and SAY that it is an example, so
  // the reader knows it was chosen rather than asked for.
  if (!r.subject) {
    if (r.relation === "SAME_ARTIST" || r.relation === "ARTIST_REVISITS") {
      var counts = {};
      for (var ai = 0; ai < INDEX.length; ai++) if (INDEX[ai].a) counts[INDEX[ai].a] = (counts[INDEX[ai].a] || 0) + 1;
      var best = null, bestN = 0;
      for (var k in counts) if (counts[k] > bestN && counts[k] <= 40) { best = k; bestN = counts[k]; }
      if (best) { r = Object.assign({}, r, { subject: best });
        reason = "No illustrator named, so here is one: "; }
    } else if (r.relation === "EVOLUTION_LINE") {
      // COMPUTED AT BUILD TIME, NOT HERE. My first attempt searched at request
      // time: for every card, walk its line, then for every stage scan the whole
      // index for a card. That is 16,468 x 16,468 in the worst case, and it
      // found NOTHING — evoLineFor only yields three stages from a true basic,
      // and evolvesFrom covers 5,929 of 16,468 cards. So a query that used to
      // return one wrong card started returning zero, which is worse.
      //
      // EVO_EXEMPLAR is verified at build time against the same index the page
      // ships, so it is correct by construction and costs one property read.
      if (EVO_EXEMPLAR) { r = Object.assign({}, r, { subject: EVO_EXEMPLAR });
        reason = "No Pokémon named, so here is a full line: "; }
    } else if (r.relation === "SAME_POKEMON_ACROSS_TIME") {
      var seen = {};
      for (var mj = 0; mj < INDEX.length; mj++) { var nm = INDEX[mj].n; seen[nm] = (seen[nm] || 0) + 1; }
      var pickAcross = null;
      for (var mk in seen) if (seen[mk] >= 4 && seen[mk] <= 12) { pickAcross = mk; break; }
      if (pickAcross) { r = Object.assign({}, r, { subject: pickAcross });
        reason = "No Pokémon named, so here is one: "; }
    }
  }
  var prefix = reason;
  if (r.relation === "SAME_POKEMON_ACROSS_TIME") {
    out = INDEX.filter(function(c){ return c.n === r.subject; }).sort(byYear);
    if (out.length > 1) reason = prefix + r.subject + " has " + out.length + " cards, " + out[0].y + " to " + out[out.length - 1].y + ".";
  } else if (r.relation === "SAME_ARTIST") {
    out = INDEX.filter(function(c){ return c.a === r.subject; }).sort(byYear);
    if (out.length > 1) reason = prefix + r.subject + " has " + out.length + " cards, " + out[0].y + " to " + out[out.length - 1].y + ".";
  } else if (r.relation === "ARTIST_REVISITS") {
    if (r.artist && r.subject) {
      out = INDEX.filter(function(c){ return c.a === r.artist && c.n === r.subject; }).sort(byYear);
    } else if (r.subject) {
      out = INDEX.filter(function(c){ return c.a === r.subject; }).sort(byYear);
    }
    // widest gap available for that artist, across any one Pokemon
    if (r.subject && !r.artist) {
      var groups = {};
      for (var i = 0; i < out.length; i++) { var g = out[i].n; (groups[g] = groups[g] || []).push(out[i]); }
      var bestG = null, bestGap = -1, allG = [];
      for (var k in groups) {
        var g2 = groups[k].sort(byYear);
        if (g2.length < 2) continue;
        var gap = Number(g2[g2.length - 1].y) - Number(g2[0].y);
        if (gap < 8) continue;
        allG.push({ gap: gap, cards: [g2[0], g2[g2.length - 1]] });
        if (g2.some(function(c){ return skipIds.has(c.i); })) continue;
        if (gap > bestGap) { bestGap = gap; bestG = g2; }
      }
      if (!bestG && allG.length) {
        allG.sort(function(a, b){ return b.gap - a.gap; });
        bestG = allG[rot % allG.length].cards;
      }
      if (bestG) out = [bestG[0], bestG[bestG.length - 1]];
    }
    if (out.length > 1) {
      var gap2 = Number(out[out.length - 1].y) - Number(out[0].y);
      out = [out[0], out[out.length - 1]];
      reason = out[0].a + " illustrated both, " + gap2 + " years apart.";
    }
  } else if (r.relation === "SAME_SET_AND_TYPE") {
    out = INDEX.filter(function(c){
      return c.s === r.subject && c.T && c.T.some(function(x){ return String(x).toLowerCase() === r.type; });
    }).sort(function(a, b){ return (b.p || 0) - (a.p || 0); });
    if (out.length > 1) reason = out.length + " " + r.type + "-type cards in " + r.subject + ".";
  } else if (r.relation === "EVOLUTION_LINE") {
    // BOTH DIRECTIONS live in evoLineFor. This used to walk back here AND
    // forward there; the two copies drifted, and resolvePrompt's copy never
    // walked back at all.
    var line = evoLineFor(r.subject);
    for (var j = 0; j < line.length; j++) {
      var candsE = INDEX.filter(function(c){ return monName(c.n) === line[j]; })
        .sort(function(a, b){ return (b.p || 0) - (a.p || 0); });
      var unusedE = candsE.filter(function(c){ return !skipIds.has(c.i); });
      var pick = (unusedE.length ? unusedE : candsE)[0];
      if (pick) out.push(pick);
    }
    if (out.length > 1) reason = prefix + out.map(function(c){ return c.n; }).join(" evolves into ") + ".";
  }
  return { cards: out, reason: reason };
}


// ── THE GUIDED FIRST POST ──────────────────────────────────────────────────
// A stranger arriving from a link has less context than Tyler had, and Tyler
// built this and still could not find the card he wanted. So the tool does not
// explain itself - it hands over something already half-made and asks for one
// action. Four steps, each one thing, and a finished image before anyone has
// read a paragraph.
//
// IT USES A REAL RELATION, NOT A DEMO, AND NOW SAYS SO IN THE CATALOGUE'S OWN
// WORDS. The pair, the years, the gap and the sentence are all computed from
// artistRevisits() at build time, so the tutorial cannot drift away from the
// data the way hardcoded copy does.
//
// THE OLD SENTENCE WAS FALSE. It read "the widest gap by one illustrator in the
// whole catalogue", and six illustrators - Arita, Himeno, Aoki, Kizuki,
// Nishida, Tanaka - span twenty-seven years between their earliest and latest
// cards, against Kimura's twenty-five. What is actually true is narrower and
// more interesting: the longest anyone has gone between drawing the SAME
// POKEMON twice. The relation only ever measured that; the sentence claimed the
// broader thing, and the broader thing is not ours to claim.
var TUT_KEY = "catchem-tutorial";
var TUT_CARDS = ${JSON.stringify(TUT.cards)};
var tutStep = 0;

function tutDone(how){
  store.set(TUT_KEY, how);
  var t = el("tut"); if (t) t.hidden = true;
}
function tutShow(line, go){
  var t = el("tut"), l = el("tutline"), b = el("tutgo");
  if (!t || !l || !b) return;
  l.textContent = line;
  b.textContent = go;
  t.hidden = false;
}
// ── A SPENT TUTORIAL LEFT A BLANK SLATE FOREVER ───────────────────────────
// Tyler opened the live page and got no tutorial, no cards, no orientation:
// "I was in the blind." Reproduced exactly on the published URL — set
// catchem-tutorial to anything and tutStart() returns on its first line, so the
// page renders an empty tray and a search box and nothing else.
//
// The tutorial being ONE-SHOT is right; nobody wants it every visit. What was
// wrong is that it was the ONLY orientation, so spending it once — a single
// skip, weeks ago — bought a permanently blank first screen. And the person
// most likely to have spent it is the person who has used the tool most.
//
// So the tray is never empty on arrival. A returning visitor gets the same
// pairing loaded and one quiet line explaining it, plus a way to see the walk
// through again. A first-time visitor gets the full tutorial unchanged.
function usedLines(){
  try { return JSON.parse(store.get("catchem-used-lines") || "[]"); } catch (e) { return []; }
}
function rememberLine(t){
  if (!t) return;
  var u = usedLines().filter(function(x){ return x !== t; });
  u.unshift(t);
  store.set("catchem-used-lines", JSON.stringify(u.slice(0, 60)));
}
function skeletonLine(text){
  var t = String(text || "");
  var flat = t.split(String.fromCharCode(10)).join(" ");
  if (/^left or right\?/i.test(t.trim())) return true;
  if (/^the top or the bottom\?/i.test(t.trim())) return true;
  if (/one painting|one picture/.test(flat) && /cards\./i.test(flat) &&
      !(tray || []).some(function(c){ return t.indexOf(c.n) >= 0; }))
    return true;
  return false;
}
function skipsMiddle(text){
  if (!tray || tray.length < 3 || tray.length > 4) return false;
  var t = String(text || "");
  if (t.indexOf(tray[0].n) < 0 || t.indexOf(tray[tray.length - 1].n) < 0) return false;
  return tray.slice(1, -1).some(function(c){ return t.indexOf(c.n) < 0; });
}
function pickCaption(){
  const NL = String.fromCharCode(10);
  const themeName = fTheme ? ((THEMES.find(function(x){ return x.id === fTheme; }) || {}).name) : null;
  const views = Number(store.get("typicalViews")) || 0;
  const opts = (typeof lineOptions === "function") ? (lineOptions(tray, themeName, views) || []) : [];
  const used = usedLines();
  const g = (typeof connectingGroupOf === "function") ? connectingGroupOf(tray) : null;
  function namedCount(t){
    return (tray || []).filter(function(c){ return t.indexOf(c.n) >= 0; }).length;
  }
  function ok(o){
    if (!o || !o.text || skeletonLine(o.text)) return false;
    if (skipsMiddle(o.text)) return false;
    if (g && tray.length >= 3 && /which one is the post/i.test(o.text)) return false;
    return namedCount(o.text) >= 1 || (tray || []).some(function(c){ return c.a && o.text.indexOf(c.a) >= 0; });
  }
  const pool = [];
  const seen = {};
  opts.forEach(function(o){
    if (!ok(o) || seen[o.text]) return;
    seen[o.text] = 1;
    pool.push(o);
  });
  function score(o){
    var t = o.text;
    var named = namedCount(t);
    var s = named * 8;
    if (g && named === tray.length && tray.length <= 4) s += 40;
    if (g && /one picture|one painting|as one picture/.test(t)) s += 25;
    if (o.reg === "divide" && named === tray.length) s += 12;
    if (o.reg === "divide" && named < Math.min(3, tray.length)) s -= 10;
    if (used.indexOf(t) >= 0) s -= 12;
    return s;
  }
  pool.sort(function(a, b){ return score(b) - score(a); });
  if (pool[0]) return pool[0].text;
  if (g && tray.length >= 2 && tray.length <= 4)
    return tray.map(function(c){ return c.n; }).join(tray.length === 2 ? " or " : ", ").replace(/, ([^,]*)$/, " or $1") +
      "?" + NL + NL + "Keep one.";
  if (tray.length >= 2) return tray[0].n + " or " + tray[tray.length - 1].n + "?" + NL + NL + "Keep one.";
  return tray[0] ? tray[0].n : "";
}
function fillLineFromCards(preset){
  const lab = el("label");
  if (!lab) return;
  if (typeof preset === "string" && preset) { lab.value = preset; return; }
  if (preset !== true && lab.value.trim()) return;
  lab.value = pickCaption();
}

function tutStart(){
  var missing = TUT_CARDS.filter(function(id){ return !byIdRow[id]; });
  if (missing.length) return;                  // catalogue changed; say nothing

  if (store.get(TUT_KEY)) {
    // RETURNING. Load the cards anyway — an empty tray is the blank slate the
    // tutorial existed to prevent, and it should not come back the moment the
    // tutorial is done.
    tray = TUT_CARDS.map(function(id){ return byIdRow[id]; });
    blob = null;
    lastPref = { kind: "revisit", ask: "" };
    anotherCursor = 0;
    render();
    var t = el("tut"), l = el("tutline"), go = el("tutgo"), sk = el("tutskip");
    if (!t || !l || !go || !sk) return;
    l.textContent = "Two cards are in your tray to start you off. Change them, or press the button.";
    go.textContent = "Make the picture";
    go.onclick = function(){ composeImage(); };
    // The way back in. A one-shot that cannot be replayed is a one-shot that
    // punishes anybody who skipped it while busy.
    sk.textContent = "Show me how again";
    sk.onclick = function(){ store.del(TUT_KEY); tutStep = 0; tutStart(); };
    t.hidden = false;
    fillLineFromCards(${JSON.stringify(TUT.caption)});
    return;
  }
  tray = TUT_CARDS.map(function(id){ return byIdRow[id]; });
  blob = null;
  lastPref = { kind: "revisit", ask: "" };
  anotherCursor = 0;
  render();
  tutStep = 1;
  tutShow(
    ${JSON.stringify(TUT.line)},
    "Make the picture");
  el("tutgo").onclick = function(){ composeImage(); };
  // SKIPPING IS NOT A REASON TO TAKE THE CARDS AWAY. This emptied the tray, so
  // "Skip this" handed back the blank slate the tutorial exists to prevent —
  // the exact screen Tyler described as being in the blind.
  el("tutskip").onclick = function(){ tutDone("skipped"); };
}

// Called by composeImage when an image actually exists. Advancing on the BLOB
// rather than on the click means a failed compose does not congratulate anyone.
function tutComposed(ok, why){
  if (tutStep !== 1) return;
  if (!ok) {
    // A DEAD NETWORK MUST SAY SO. Sitting on a blank frame is how a first-time
    // user decides the tool is broken and never comes back.
    tutShow("The card images did not load" + (why ? " — " + why : "") +
      ". That is the network or the image host, not your cards. Try again, or skip and browse.",
      "Try again");
    el("tutgo").onclick = function(){ composeImage(); };
    return;
  }
  tutStep = 2;
  tutShow("Press and hold the image to save it. That is the whole thing.", "Now try your own");
  el("tutgo").onclick = function(){
    // FINISHING KEEPS THE CARDS TOO. Clearing the tray on the last step meant
    // completing the tutorial was punished exactly like skipping it: the
    // Magmars vanished and the page went back to empty.
    if (el("q")) el("q").value = "";
    resetPage(); search();
    tutDone("done");
  };
}


// ── ONE PIPE, TWO KINDS ────────────────────────────────────────────────────
// The honesty box and the questionnaire are different things and they share a
// single submission path with a "kind" field, so there is one inbox to read and
// it sorts. At fifty submissions a month on the free tier there is no room for
// two forms competing for the same quota anyway.
//
// THE ENDPOINT IS BAKED IN AT BUILD TIME FROM .env. If it is absent the controls
// still render and say plainly that sending is not wired, because a missing form
// should not remove the button that tells you the tool is broken.
var FB_ENDPOINT = "${FORM_ENDPOINT}";
var FB_KIND = null;

// CONTEXT TYLER CANNOT GET BY ASKING. Attached to every submission, and none of
// it identifies anybody: what they were using, whether the tutorial helped, and
// whether the last thing they tried actually worked.
function fbContext(){
  var lastCompose = "none attempted";
  try { lastCompose = window.__lastComposeOk === true ? "succeeded"
      : window.__lastComposeOk === false ? "FAILED" : "none attempted"; } catch (e) {}
  var layout = "";
  try { var L = layoutForTray(); layout = L ? (tray.length + " cards, " + L.name) : (tray.length + " cards"); } catch (e) {}
  var relation = "";
  try { relation = (typeof lastRelation === "string" && lastRelation) ? lastRelation : "none"; } catch (e) { relation = "none"; }
  return {
    layout: layout || "empty tray",
    relation: relation,
    tutorial: store.get(TUT_KEY) || "not finished",
    lastCompose: lastCompose,
    // NO SCREEN SIZE. It was here as useful context, and screen dimensions are
    // a fingerprinting signal - weak alone, strong combined with anything else.
    // The note beside the name field promises we send nothing identifying when
    // it is blank, and shipping a viewport alongside that promise makes it a lie.
    // If a layout bug needs a screen size, ask for it in words.
  };
}

var FB_QS = {
  broken: [["what", "What is broken, or annoying, or missing?"]],
  questionnaire: [
    ["made", "What did you make?"],
    ["wanted", "What did you want to make that you could not?"],
    ["wouldpost", "Would you post something made with this? Why or why not?"],
    ["else", "Anything else"],
  ],
};

function fbOpen(kind){
  FB_KIND = kind;
  el("fbtitle").textContent = kind === "broken"
    ? "Tell me what's broken."
    : "Four questions, all skippable.";
  var box = el("fbqs");
  box.innerHTML = "";
  FB_QS[kind].forEach(function(q){
    var lab = document.createElement("p");
    lab.className = "fbnote";
    lab.style.margin = "0 0 6px";
    lab.textContent = q[1];
    var ta = document.createElement("textarea");
    ta.id = "fbq_" + q[0];
    box.appendChild(lab); box.appendChild(ta);
  });
  el("fbstat").textContent = FB_ENDPOINT ? "" : "Sending is not wired up yet — no form is configured. Nothing will be sent.";
  el("fb").hidden = false;
  el("fbsend").disabled = !FB_ENDPOINT;
}

async function fbSend(){
  var name = (el("fbname").value || "").trim();
  var payload = { kind: FB_KIND, context: fbContext() };
  var any = false;
  FB_QS[FB_KIND].forEach(function(q){
    var v = (el("fbq_" + q[0]).value || "").trim();
    if (v) { payload[q[0]] = v; any = true; }
  });
  if (!any) { el("fbstat").textContent = "Nothing typed yet."; return; }
  // ANONYMOUS MEANS ANONYMOUS. If the name is blank we attach nothing that could
  // identify them - no generated id, no fingerprint, nothing derived from an
  // address. Saying "anonymous" and shipping a tracking id would be a lie told
  // to the first fifteen people who trusted us.
  if (name) payload.name = name;
  el("fbsend").disabled = true;
  el("fbstat").textContent = "Sending…";
  try {
    // A FETCH WITH NO TIMEOUT NEVER GIVES UP, and guard-audit caught this on the
    // commit that introduced it. Without the signal a hung request leaves someone
    // watching "Sending..." forever with their typed complaint still in the box.
    // The signal sits FIRST because the guard reads the few lines after the call,
    // and a comment between the two hid it from a check that was working fine.
    var r = await fetch(FB_ENDPOINT, {
      signal: AbortSignal.timeout(15000),
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      el("fbstat").textContent = "Sent. Thank you — that is genuinely useful.";
      if (FB_KIND === "questionnaire") store.set("catchem-questionnaire", "done");
      setTimeout(function(){ el("fb").hidden = true; }, 1800);
    } else {
      el("fbstat").textContent = "Did not send (HTTP " + r.status + "). Nothing was lost — copy your text somewhere if you want to keep it.";
      el("fbsend").disabled = false;
    }
  } catch (e) {
    el("fbstat").textContent = "Did not send: " + (e.message || "no connection") + ". Nothing was lost.";
    el("fbsend").disabled = false;
  }
}

// OFFERED ONCE, AFTER SOMETHING WORKED - never on arrival. A questionnaire on
// the doorstep asks people to describe a thing they have not used yet.
function fbMaybeAskQuestionnaire(){
  if (store.get("catchem-questionnaire")) return;
  if (!el("fb").hidden) return;
  store.set("catchem-questionnaire", "offered");
  fbOpen("questionnaire");
}

safeWire(function(){ el("brokebtn").onclick = function(){ fbOpen("broken"); }; }, "brokebtn");
safeWire(function(){ el("fbsend").onclick = function(){ fbSend(); }; }, "fbsend");
safeWire(function(){ el("fbclose").onclick = function(){ el("fb").hidden = true; }; }, "fbclose");

function runAsk(text){
  const askRel = askResolve(text);
  if (askRel && askRel.need) markCount(askRel.need);
  const tryRelation = function(){
    if (!askRel) return false;
    const got = askCards(askRel);
    const box0 = el("askreply");
    if (got.cards.length > 1) {
      if (box0) {
        box0.textContent = askRel.relation.replace(/_/g, " ").toLowerCase() +
          " — " + askRel.why + ". " + got.reason;
        box0.className = "askreply";
      }
      tray = (askRel.relation === "CONNECTING_ART") ? got.cards.slice() : got.cards.slice(0, 9); blob = null;
      lastPref = { kind: "ask", ask: text };
      anotherCursor = 0;
      if (askRel.relation === "CONNECTING_ART") markCount(tray.length);
      render(); resetPage(); search();
      fillLineFromCards(true);
      return true;
    }
    if (box0) {
      box0.textContent = "I read that as " + askRel.relation.replace(/_/g, " ").toLowerCase() +
        " (" + askRel.why + ") but there are not enough cards for it. Showing the closest match instead.";
      box0.className = "askreply bad";
    }
    if (askRel.subject) { el("q").value = askRel.subject; resetPage(); search(); return true; }
    return false;
  };
  // Connecting art is a picture, not a search. The old parser always returned
  // a 2-card pair and ignored How many cards. This path has to go first.
  if (askRel && (askRel.relation === "CONNECTING_ART" || askRel.relation === "ARTIST_REVISITS" || askRel.relation === "EVOLUTION_LINE")) {
    if (tryRelation()) return;
  }
  const ctx = intentCtx();
  const found = parseIntent(text, ctx);
  const reply = intentReply(found, ctx);
  const box = el("askreply");
  // The old parser could not read it. A relationship still might.
  if (!reply.ok && tryRelation()) return;
  if (box) { box.textContent = reply.say; box.className = "askreply" + (reply.ok ? "" : " bad"); }
  if (!reply.ok) return;
  // THE PROMPT RESOLVES ITS OWN CARDS. The old path set filters and then handed
  // off to the theme builder, which picks from its own pool and never consults
  // them — so "charizard through the years" parsed Charizard correctly and
  // returned Alakazam, and "fire types" returned Gyarados. A theme may suggest
  // an ordering; it may never widen the pool past what was asked for.
  fMon = null; fRating = null; fSet = ""; fTheme = null;
  if (found.count) fCount = found.count;
  if (found.mon) fMon = found.mon;
  if (found.set) fSet = found.set;
  if (found.rating) fRating = found.rating;
  if (found.mood) { lastPref = { kind: "mood", ask: "" }; loadMood(found.mood); return; }

  const res = resolvePrompt(found, INDEX, {
    monName: monName,
    attrs: ATTRS,
    // THE RATING LOOKUP WAS WRONG, so "cute" and "dark" returned identical cards —
    // the clause matched nothing and was silently skipped. Ratings live on the
    // row, not in a separate BIOS map.
    ratingOf: function(id, k){
      // Ratings are card.R — column 12 of the row becomes R on the object, and
      // byIdRow holds OBJECTS not rows, so [12] was always undefined and every
      // card silently scored zero.
      const c = byIdRow[id];
      return c && c.R && typeof c.R[k] === "number" ? c.R[k] : 0;
    },
    HERO_RX: HERO_RX,
    // The chain, walked from evolvesFrom which is a printed field.
    evoLineFor: evoLineFor,
  });

  // It read the sentence but the filters found nothing. Before reporting an
  // empty result - the failure this whole job is about - see whether the ask
  // describes a relationship instead.
  if (!res.cards.length && tryRelation()) return;
  if (res.cards.length) {
    var take = res.cards.length;
    if (found.shape !== "evo-line" && fCount > 0) take = Math.min(take, fCount);
    tray = res.cards.slice(0, take); blob = null;
    lastPref = { kind: "ask", ask: text };
    anotherCursor = 0;
    trail = [];
    // SAY WHICH CONSTRAINTS WERE APPLIED. When the answer looks wrong, the user
    // can see whether the tool misread the sentence or the catalogue simply has
    // nothing — and those need different responses from them.
    if (box) { box.textContent = "Showing " + res.why.join(" · ") + "."; box.className = "askreply"; }
    render(); resetPage(); search();
    return;
  }
  if (box) { box.textContent = "Nothing in the catalogue fits all of that. Try dropping one part of it."; box.className = "askreply bad"; }
}
{
  const eg = el("egs");
  if (eg) {
    eg.innerHTML = EXAMPLES.map(function(e){
      const kicker = e.demo ? "<span class='egkicker'>Try this</span>" : "";
      return "<button type='button' class='eg" + (e.demo ? " demo" : "") + "' data-q='" + e.q + "'>" +
        kicker + e.label + "</button>";
    }).join("");
    eg.querySelectorAll(".eg").forEach(function(b){
      b.onclick = function(){
        const q = b.getAttribute("data-q") || b.textContent;
        el("ask").value = q;
        runAsk(q);
        fillLineFromCards(true);
        if (b.classList.contains("demo")) composeImage();
      };
    });
  }
  const ask = el("ask");
  const askgo = el("askgo");
  if (askgo && ask) askgo.onclick = function(){ el("suggest").hidden = true; runAsk(ask.value); };
  if (ask) {
    ask.addEventListener("keydown", function(e){ if (e.key === "Enter") { el("suggest").hidden = true; runAsk(ask.value); } });
    ask.addEventListener("input", function(){ renderSuggest(ask.value); });
  }
}
window.runAsk = runAsk;
function setMode(m){
  m = m === "reply" ? "reply" : "post";
  if (document.body && document.body.setAttribute) document.body.setAttribute("data-mode", m);
  const tabs = el("modes");
  if (tabs) tabs.querySelectorAll(".mode").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-mode") === m); });
  const t = el("pagetitle"), l = el("pagelede");
  if (t) t.innerHTML = m === "reply" ? "Reply<em>.</em>" : "Make a post<em>.</em>";
  if (l) l.textContent = m === "reply"
    ? "Paste what they wrote. One card, unless the art needs more."
    : "Say what you want to post. We'll find the cards.";
  if (m === "reply") {
    const box = el("cta");
    if (box) setTimeout(function(){ try { box.focus(); } catch (e) {} }, 50);
  }
}
window.setMode = setMode;
{
  const tabs = el("modes");
  if (tabs) tabs.querySelectorAll(".mode").forEach(function(b){
    b.onclick = function(){ setMode(b.getAttribute("data-mode")); };
  });
  const go = el("ctago"), demo = el("ctademo"), copyB = el("copyreply"), box = el("cta");
  if (go && box) go.onclick = function(){ answerCta(box.value); };
  if (demo && box) demo.onclick = function(){
    box.value = CTA_DEMO.replace(/\\n/g, String.fromCharCode(10));
    setMode("reply");
    answerCta(box.value);
  };
  if (copyB) copyB.onclick = function(){ copyReply(); };
  const countSel = el("cardcount");
  if (countSel) countSel.onchange = function(){ applyCount(Number(countSel.value), true); };
  const st = el("savetoday");
  if (st) st.onclick = function(){ window.saveToday(); };
  const sp = el("savephotos");
  if (sp) sp.onclick = function(){ shareImage(); };
  const sc = el("saveclose");
  if (sc) sc.onclick = function(){ closeSaveSheet(); };
  if (box) box.addEventListener("keydown", function(e){
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); answerCta(box.value); }
  });
  try {
    const q = new URLSearchParams(location.search).get("reply");
    if (q && box) { setMode("reply"); box.value = q; answerCta(q); }
  } catch (e) {}
}

// ANOTHER SET, SAME PREFERENCE. The line panel already walks its pool one at
// a time. The tray did not: changing the Magmars meant retyping the ask, or
// picking a different idea, or accepting that the first answer was the only
// answer. The button is "Another" because that is the word a person says, and
// it walks the matching pool rather than shuffling — every set is seen before
// any is seen twice.
function promptHelpers(exclude, rot){
  return {
    monName: monName,
    attrs: ATTRS,
    ratingOf: function(id, k){
      const c = byIdRow[id];
      return c && c.R && typeof c.R[k] === "number" ? c.R[k] : 0;
    },
    HERO_RX: HERO_RX,
    evoLineFor: evoLineFor,
    exclude: exclude || new Set(),
    rot: rot || 0,
  };
}
function sameTray(cards){
  if (!cards || cards.length !== tray.length) return false;
  for (var i = 0; i < cards.length; i++) if (cards[i].i !== tray[i].i) return false;
  return true;
}
function artistRevisitPairs(){
  const groups = {};
  for (var i = 0; i < INDEX.length; i++) {
    const c = INDEX[i];
    if (!c.a || !c.y) continue;
    const k = c.a + "\0" + monName(c.n);
    (groups[k] = groups[k] || []).push(c);
  }
  const pairs = [];
  for (const k in groups) {
    const g = groups[k].slice().sort(function(a, b){ return String(a.y).localeCompare(String(b.y)); });
    if (g.length < 2) continue;
    const gap = Number(g[g.length - 1].y) - Number(g[0].y);
    if (gap < 8) continue;
    pairs.push({ gap: gap, artist: g[0].a, cards: [g[0], g[g.length - 1]] });
  }
  pairs.sort(function(a, b){ return b.gap - a.gap; });
  return pairs;
}
function rerunAsk(text, exclude, rot){
  const ctx = intentCtx();
  const found = parseIntent(text, ctx);
  const reply = intentReply(found, ctx);
  if (reply.ok) {
    const res = resolvePrompt(found, INDEX, promptHelpers(exclude, rot));
    if (res.cards && res.cards.length) return { cards: res.cards, why: res.why };
  }
  const rel = askResolve(text);
  if (rel) {
    const got = askCards(rel, { exclude: exclude, rot: rot });
    if (got.cards && got.cards.length > 1) return { cards: got.cards.slice(0, 9), why: [got.reason] };
  }
  return null;
}
function rerollMood(id, exclude){
  const m = MOODS.find(function(x){ return x.id === id; });
  if (!m) return null;
  const need = fCount || 2;
  const ranked = m.cards.map(function(x){ return x.id; });
  const unused = ranked.filter(function(id){ return !exclude.has(id); });
  const source = unused.length >= need ? unused : ranked;
  const picked = [];
  const used = new Set();
  for (var i = 0; i < source.length && picked.length < need; i++) {
    if (used.has(source[i])) continue;
    used.add(source[i]);
    const c = byIdRow[source[i]];
    if (c) picked.push(c);
  }
  return picked.length ? { cards: picked, why: ["mood · " + m.label] } : null;
}
function rerollTheme(exclude, rot){
  if (typeof buildIdeas === "function") buildIdeas();
  const ideas = window.__ideas || [];
  if (!ideas.length) return null;
  const unused = ideas.filter(function(idea){
    return idea.cards.every(function(c){ return !exclude.has(c.i); });
  });
  const pool = unused.length ? unused : ideas;
  const idea = pool[rot % pool.length];
  return { cards: idea.cards, why: [idea.title] };
}
function rerollFilters(exclude, rot){
  const need = fCount || 2;
  let pool = INDEX.filter(function(c){
    return c.a && ratingPass(c) && monPass(c) && (!fSet || c.s === fSet);
  });
  const hero = pool.filter(function(c){ return HERO_RX.test(c.r || ""); });
  if (hero.length >= need) pool = hero;
  const best = {};
  for (var i = 0; i < pool.length; i++) {
    const c = pool[i];
    if (exclude.has(c.i)) continue;
    const k = monName(c.n);
    if (!best[k] || (c.p || 0) > (best[k].p || 0)) best[k] = c;
  }
  let list = Object.values(best).sort(function(a, b){ return (b.p || 0) - (a.p || 0); });
  if (list.length < need) {
    const fb = {};
    for (var j = 0; j < pool.length; j++) {
      const c2 = pool[j];
      const k2 = monName(c2.n);
      if (!fb[k2] || (c2.p || 0) > (fb[k2].p || 0)) fb[k2] = c2;
    }
    list = Object.values(fb).sort(function(a, b){ return (b.p || 0) - (a.p || 0); });
  }
  if (list.length < need) return null;
  const start = (rot * need) % list.length;
  const picked = [];
  for (var n = 0; n < list.length && picked.length < need; n++) picked.push(list[(start + n) % list.length]);
  return { cards: picked, why: ["same filters"] };
}
function rerollRevisit(exclude, rot){
  const pairs = artistRevisitPairs();
  if (!pairs.length) return null;
  const unused = pairs.filter(function(p){
    return p.cards.every(function(c){ return !exclude.has(c.i); });
  });
  const pool = unused.length ? unused : pairs;
  const p = pool[rot % pool.length];
  return { cards: p.cards, why: [p.artist + " · " + p.gap + " years apart"] };
}
function anotherSet(){
  const exclude = new Set(tray.map(function(c){ return c.i; }));
  const rot = ++anotherCursor;
  let got = null;
  if (lastPref.kind === "ask" && lastPref.ask) got = rerunAsk(lastPref.ask, exclude, rot);
  else if (lastPref.kind === "cta" && lastPref.ask) {
    const r = parseCta(lastPref.ask);
    const cards = pickShowYours(r, { exclude: exclude, rot: rot, need: lastPref.need || officeCount || 1 });
    got = { cards: cards, why: ["same ask, different cards"] };
  }
  else if (fMood || lastPref.kind === "mood") got = rerollMood(fMood || lastPref.mood, exclude);
  else if (fTheme || lastPref.kind === "theme") got = rerollTheme(exclude, rot);
  else if (fMon || fSet || fRating) got = rerollFilters(exclude, rot);
  else got = rerollRevisit(exclude, rot);
  if ((!got || !got.cards || !got.cards.length) && lastPref.kind === "ask" && lastPref.ask) {
    got = rerunAsk(lastPref.ask, new Set(), rot);
  }
  if (!got || !got.cards || !got.cards.length) {
    const box = el("askreply");
    if (box) { box.textContent = "Nothing else matches this preference."; box.className = "askreply bad"; }
    return;
  }
  if (sameTray(got.cards)) {
    const box = el("askreply");
    if (box) { box.textContent = "That is the only set that matches."; box.className = "askreply"; }
    return;
  }
  pushTrail();
  tray = orderByConnecting(got.cards); blob = null;
  const box = el("askreply");
  if (box) {
    const why = (got.why && got.why.length ? got.why.filter(Boolean).join(" · ") : "").replace(/[.]+$/, "");
    box.textContent = "Another set" + (why ? " — " + why : "") + ".";
    box.className = "askreply";
  }
  fillLineFromCards(true);
  if (lastPref.kind === "cta") {
    const lab = el("label");
    if (lab) lab.value = tray.length <= 1 ? CTA_SHOW_ONE : CTA_SHOW_LINES[rot % CTA_SHOW_LINES.length];
  }
  render();
  composeImage();
}
function snapTray(){
  return {
    cards: tray.map(function(c){ return c.i; }),
    label: (el("label") && el("label").value) || "",
    pref: lastPref ? { kind: lastPref.kind, ask: lastPref.ask, mood: lastPref.mood } : { kind: "", ask: "" },
    cursor: anotherCursor,
    why: (el("askreply") && el("askreply").textContent) || ""
  };
}
function pushTrail(){
  trail.push(snapTray());
  if (trail.length > 30) trail.shift();
}
function backSet(){
  if (!trail.length) return;
  const s = trail.pop();
  tray = (s.cards || []).map(function(id){ return byIdRow[id]; }).filter(Boolean);
  lastPref = s.pref || lastPref;
  anotherCursor = s.cursor || 0;
  blob = null;
  if (el("label")) el("label").value = s.label || "";
  const box = el("askreply");
  if (box) { box.textContent = s.why || ""; box.className = "askreply"; }
  render();
  if (tray.length) composeImage();
}
window.anotherSet = anotherSet;
window.backSet = backSet;
{
  const b = el("anotherset");
  if (b) b.onclick = function(){ anotherSet(); };
  const back = el("backset");
  if (back) back.onclick = function(){ backSet(); };
}

// THE ONE INPUT THE TIERS NEED, asked once and remembered. And the note says
// plainly that it is unproven — we hold five logged posts, so presenting a
// threshold as a finding would be the slop law on a new surface.
// VIEWS, NOT FOLLOWERS. Tyler: "follower count can be misleading sometimes."
// Right — followers are an accumulated number and views are a live signal, and
// the tier is only trying to answer whether there is a crowd big enough to
// answer a question. That is a views question.
function setReach(){
  const f = el("views"), note = el("reachnote");
  if (!f) return;
  const saved = store.get("typicalViews");
  if (saved) f.value = saved;
  const show = function(){
    const n = Number(f.value) || 0;
    if (!n) { if (note) note.textContent = "Optional — it orders the line suggestions. Views beat followers here."; return; }
    store.set("typicalViews", String(n));
    const t = tierFor(n);
    if (note && t) note.textContent = t.label + " — " + t.why + ". (Unproven: five logged posts.)";
    renderLines();
  };
  f.addEventListener("input", show);
  show();
}
setReach();

// THE COUNT NEVER ADVANCES ON ITS OWN (Tyler, 2026-08-24: "we can't be the
// reason they miss a day or say the wrong day").
//
// A wrong day number is a PUBLIC credibility hit for the creator, not for us —
// they are the one who typed "Day 47" under a picture. So every rule here is
// about never letting the tool make a claim it cannot back.
//
// FIVE WAYS A STREAK COUNTER LIES, and what each costs:
//   1. Advances on open — Day 47 becomes a number we invented
//   2. Double counts — two visits on a Tuesday jump two days
//   3. Misses a break — they skip Thursday and somebody in the replies notices
//   4. Timezone — 11pm Monday and 1am Wednesday, is that a miss?
//   5. Repeats a card — Day 60 shows Day 12's card and the premise collapses
//
// The rule that solves most of it: **it advances only when they confirm they
// posted.** Everything else is a claim we cannot stand behind.
const DAY_MS = 86400000;
// A DAY IS A LOCAL CALENDAR DAY. Anything else is arbitrary, and "posted at
// 11pm then 1am" has to be two days or the count argues with the timeline.
function dayKey(d){
  const x = d ? new Date(d) : new Date();
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}
function daysBetween(a, b){
  const A = new Date(a + "T12:00:00"), B = new Date(b + "T12:00:00");
  return Math.round((B - A) / DAY_MS);
}
function streakState(){
  if (!streak || !streak.days || !streak.days.length) return { day: 0, status: "not started" };
  const days = streak.days.slice().sort();
  const last = days[days.length - 1];
  const gap = daysBetween(last, dayKey());
  // BROKEN IS A STATE, NOT A RESET. Silently starting again at Day 1 hides
  // something they would want to know, and quietly continuing the count is a
  // lie somebody in their replies can check.
  // MISSED DAYS = the gap minus today. Last posted four days ago means three
  // days went by unposted. Getting this wrong by one puts a wrong number in
  // front of an audience, which is the whole thing we are guarding against.
  if (gap > 1) return { day: days.length, status: "broken", missed: gap - 1, last };
  if (gap === 1) return { day: days.length, status: "due", last };
  return { day: days.length, status: "done today", last };
}
function confirmPosted(){
  // Same guard. The fuzzer reached this with no streak and with an unknown
  // filter, 173 times across 300 random journeys.
  if (!streak) { setStatus("No streak running — start one first.", false); return; }
  if (!STREAK_FILTERS[streak.filter]) { setStatus("That streak used a filter this version no longer has. Start a new one.", true); return; }
  const k = dayKey();
  streak.days = streak.days || [];
  // DOUBLE-COUNT GUARD. Two confirmations on one calendar day is one day.
  if (streak.days.indexOf(k) >= 0) { setStatus("Already counted today — the streak stays at day " + streak.days.length + ".", false); renderStreak(); return; }
  const st = streakState();
  if (st.status === "broken") {
    // NEVER DECIDE THIS FOR THEM. Continuing or restarting is a claim about
    // their own history, and only they know whether they posted elsewhere.
    var NL2 = String.fromCharCode(10);
    const keep = confirm("You last posted " + st.missed + " day" + (st.missed > 1 ? "s" : "") + " ago, so the run has a gap." + NL2 + NL2 + "OK = count this as day " + (st.day + 1) + " and keep the total." + NL2 + "Cancel = start again at day 1.");
    if (!keep) streak.days = [];
  }
  streak.days.push(k);
  // NEVER REPEAT A CARD. Day 60 showing Day 12's card ends the series.
  if (tray.length) {
    streak.used = streak.used || [];
    for (const c of tray) if (streak.used.indexOf(c.i) < 0) streak.used.push(c.i);
  }
  saveStreak();
  setStatus("Day " + streak.days.length + " counted. See you tomorrow.", false);
  renderStreak();
}
window.confirmPosted = confirmPosted;

// AUTOCOMPLETE. Chandelure, Volcarona, Gholdengo, Poltchageist — an exact-match
// box punishes a typo with an empty screen, which reads as broken rather than
// misspelled. Three passes in order of confidence: prefix, contains, then edit
// distance so "chandalure" still finds Chandelure.
let SUGGEST_NAMES = null;
function suggestNames(q){
  if (!q || q.length < 2) return [];
  if (!SUGGEST_NAMES) {
    const counts = {};
    for (const c of INDEX) { const m = monName(c.n); if (m) counts[m] = (counts[m] || 0) + 1; }
    // Ranked by how many cards exist, so the Pokémon somebody is likelier to
    // mean comes first.
    SUGGEST_NAMES = Object.keys(counts).sort(function(a, b){ return counts[b] - counts[a]; });
  }
  const lq = q.toLowerCase();
  const pre = [], mid = [];
  for (const n of SUGGEST_NAMES) {
    const ln = n.toLowerCase();
    if (ln.indexOf(lq) === 0) pre.push(n);
    else if (ln.indexOf(lq) > 0) mid.push(n);
    if (pre.length >= 6) break;
  }
  let out = pre.concat(mid).slice(0, 6);
  // ONLY IF NOTHING MATCHED. Edit distance is expensive and imprecise, so it is
  // the last resort rather than the first.
  if (!out.length && lq.length >= 4) {
    const scored = [];
    for (const n of SUGGEST_NAMES) {
      const d = editDistance(lq, n.toLowerCase());
      // A LONGER WORD TOLERATES A BIGGER GAP. "chandal" to "chandelure" is three
      // edits and unmistakably the same word; the old third-of-length rule
      // rejected it at seven characters.
      if (d <= Math.max(2, Math.ceil(lq.length / 2))) scored.push([d, n]);
    }
    out = scored.sort(function(a, b){ return a[0] - b[0]; }).slice(0, 4).map(function(x){ return x[1]; });
  }
  return out;
}
function renderSuggest(q){
  const box = el("suggest");
  if (!box) return;
  // Only suggest on the LAST word — "charizard evo" should still suggest for
  // "evo" being typed, not re-suggest Charizard.
  const word = String(q).split(WS).pop();
  const names = suggestNames(word);
  if (!names.length) { box.innerHTML = ""; box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = names.map(function(n){ return "<button class='sg'>" + n + "</button>"; }).join("");
  box.querySelectorAll(".sg").forEach(function(b){
    b.onclick = function(){
      const ask = el("ask");
      const parts = String(ask.value).split(WS);
      parts[parts.length - 1] = b.textContent;
      ask.value = parts.join(" ");
      box.innerHTML = ""; box.hidden = true;
      runAsk(ask.value);
    };
  });
}

// PROBE THE HOSTS ON BOOT. "74 images failed" is true and still leaves the user
// running the experiment. This asks the question the message raises: which hosts
// can this browser reach? If one works, every image switches to it — reporting a
// problem we could have solved is worse than not reporting.
const HOSTS = [
  { id: "pokemontcg", url: function(id){ return "https://images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + ".png"; } },
  { id: "scrydex",    url: function(id){ return "https://images.scrydex.com/pokemon/" + id + "/small"; } },
  { id: "weserv",     url: function(id){ return "https://images.weserv.nl/?url=" + encodeURIComponent("images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + ".png") + "&w=400"; } },
];
let liveHost = null;
function probeHosts(){
  const sample = (INDEX[0] && INDEX[0].i) || "base1-1";
  let settled = 0, found = false;
  const reachable = [];
  HOSTS.forEach(function(h){
    const im = new Image();
    const done = function(ok){
      settled++;
      if (ok) reachable.push(h.id);
      if (ok && !found) {
        found = true;
        // SWITCH EVERYTHING TO WHAT WORKS. A host that answers is worth more
        // than an accurate description of three that do not.
        if (h.id !== "pokemontcg") { liveHost = h; retryAllImages(); }
        // The probe knows the answer, so the boot line should carry it rather
        // than leaving the reader to guess from blank panels.
        try { bootSay("Card art: " + h.id + " is reachable."); } catch (e) {}
      }
      if (settled === HOSTS.length) reportHosts(reachable);
    };
    im.onload = function(){ done(true); };
    im.onerror = function(){ done(false); };
    setTimeout(function(){ if (!im.complete) done(false); }, 6000);
    im.src = h.url(sample);
  });
}
function retryAllImages(){
  if (!liveHost) return;
  const imgs = document.querySelectorAll ? document.querySelectorAll("img[data-cid]") : [];
  for (let i = 0; i < imgs.length; i++) {
    const cid = imgs[i].getAttribute("data-cid");
    if (cid) { imgs[i].dataset.tried = ""; imgs[i].style.display = ""; imgs[i].src = liveHost.url(cid); }
  }
  imgFails = 0;
}
function reportHosts(reachable){
  if (reachable.length) return;   // something works; nothing to say
  // NOTHING REACHED. That is a browser-level block, and saying so precisely is
  // the difference between a bug report and a fix.
  const msg = "No image host is reachable from this browser — pokemontcg.io, scrydex.com and weserv.nl were all tried and none answered. "
    + "That is a browser-level block rather than a problem with any one host. In-app browsers (inside another app) commonly do this. "
    + "Open this file in Safari or Chrome directly and the images will load.";
  for (const w of ["imgstatus", "st", "askreply"]) {
    const b = el(w);
    if (b) { b.hidden = false; b.textContent = msg; b.className = (b.className || "").replace(/ bad$/, "") + " bad"; }
  }
}
safeWire(function(){ renderHooks(); }, "hooks");
safeWire(function(){ setTimeout(probeHosts, 900); }, "host probe");

// A HOOK IS A FACT ABOUT THESE CARDS, not a shape to fill in. That is the whole
// difference from the 84 formulas nobody used: a formula is a template, while a
// hook was COMPUTED from the two cards it ships with. "Same Pokémon. $3 and
// $2,000" is only true of those two Jolteons.
const HOOKS = [{"hook":"Same Pokémon. $2 and $166.","shots":["swsh9-152","bw4-94"],"check":"Shaymin: 11 priced cards, lowest $2 (Brilliant Stars), highest $166 (Next Destinies)"},{"hook":"Same Pokémon. $4 and $180.","shots":["g1-5","ecard1-5"],"check":"Butterfree: 11 priced cards, lowest $4 (Generations), highest $180 (Expedition Base Set)"},{"hook":"Same Pokémon. $2 and $472.","shots":["xy11-67","neo4-112"],"check":"Steelix: 21 priced cards, lowest $2 (Steam Siege), highest $472 (Neo Destiny)"},{"hook":"GOSSAN drew 14 cards. One of them is $272.","shots":["swsh12pt5gg-GG44","swsh11-184"],"check":"GOSSAN: 14 priced cards, top $272 (Mewtwo VSTAR), second $22"},{"hook":"Same Pokémon. $3 and $275.","shots":["xy9-3","ex10-106"],"check":"Meganium: 12 priced cards, lowest $3 (BREAKpoint), highest $275 (Unseen Forces)"},{"hook":"Scrafty had 90 HP in 2012. Now it has 330.","shots":["bw4-74","me2pt5-285"],"check":"Scrafty: 14 cards with printed HP, 90 (Next Destinies, 2012) → 330 (Ascended Heroes, 2026)"},{"hook":"Same Pokémon. $3 and $317.","shots":["sm1-89","sm12-216"],"check":"Solgaleo: 10 priced cards, lowest $3 (Sun & Moon), highest $317 (Cosmic Eclipse)"},{"hook":"Same Pokémon. $2 and $128.","shots":["swsh45sv-SV020","base2-6"],"check":"Mr. Mime: 19 priced cards, lowest $2 (Shining Fates Shiny Vault), highest $128 (Jungle)"},{"hook":"Same Pokémon. $2 and $233.","shots":["sm2-102","neo3-2"],"check":"Blissey: 11 priced cards, lowest $2 (Guardians Rising), highest $233 (Neo Revelation)"},{"hook":"Same Pokémon. $3 and $445.","shots":["g1-27","neo4-111"],"check":"Raichu: 49 priced cards, lowest $3 (Generations), highest $445 (Neo Destiny)"},{"hook":"Same Pokémon. $4 and $374.","shots":["sm9-32","pl3-148"],"check":"Articuno: 28 priced cards, lowest $4 (Team Up), highest $374 (Supreme Victors)"},{"hook":"Same Pokémon. $7 and $1,010.","shots":["sm7-81","ex11-111"],"check":"Groudon: 12 priced cards, lowest $7 (Celestial Storm), highest $1,010 (Delta Species)"},{"hook":"Same Pokémon. $3 and $1,801.","shots":["sm11-4","neo4-106"],"check":"Celebi: 15 priced cards, lowest $3 (Unified Minds), highest $1,801 (Neo Destiny)"},{"hook":"Same Pokémon. $4 and $800.","shots":["pgo-50","ecard1-9"],"check":"Dragonite: 34 priced cards, lowest $4 (Pokémon GO), highest $800 (Expedition Base Set)"},{"hook":"Pikachu had 40 HP in 1999. Now it has 200.","shots":["base1-58","me2pt5-277"],"check":"Pikachu: 143 cards with printed HP, 40 (Base, 1999) → 200 (Ascended Heroes, 2026)"},{"hook":"Same Pokémon. $2 and $250.","shots":["sm10-149","gym2-8"],"check":"Persian: 20 priced cards, lowest $2 (Unbroken Bonds), highest $250 (Gym Challenge)"},{"hook":"Arceus had 90 HP in 2007. Now it has 280.","shots":["dpp-DP50","swsh12pt5gg-GG70"],"check":"Arceus: 15 cards with printed HP, 90 (DP Black Star Promos, 2007) → 280 (Crown Zenith Galarian Gallery, 2023)"},{"hook":"Same Pokémon. $3 and $220.","shots":["swsh3-144","ex16-96"],"check":"Salamence: 15 priced cards, lowest $3 (Darkness Ablaze), highest $220 (Power Keepers)"},{"hook":"Same Pokémon. $4 and $566.","shots":["swsh4-131","pl2-111"],"check":"Snorlax: 36 priced cards, lowest $4 (Vivid Voltage), highest $566 (Rising Rivals)"},{"hook":"Venusaur had 100 HP in 1999. Now it has 380.","shots":["base1-15","me1-177"],"check":"Venusaur: 40 cards with printed HP, 100 (Base, 1999) → 380 (Mega Evolution, 2025)"},{"hook":"Clefairy had 40 HP in 1999. Now it has 190.","shots":["base1-5","me2pt5-280"],"check":"Clefairy: 36 cards with printed HP, 40 (Base, 1999) → 190 (Ascended Heroes, 2026)"},{"hook":"Same Pokémon. $8 and $517.","shots":["swshp-SWSH134","sv8pt5-156"],"check":"Sylveon: 22 priced cards, lowest $8 (SWSH Black Star Promos), highest $517 (Prismatic Evolutions)"},{"hook":"Espeon had 60 HP in 2002. Now it has 270.","shots":["neo4-4","sv8pt5-155"],"check":"Espeon: 33 cards with printed HP, 60 (Neo Destiny, 2002) → 270 (Prismatic Evolutions, 2025)"},{"hook":"Same Pokémon. $2 and $417.","shots":["swsh12pt5-13","swsh7-205"],"check":"Leafeon: 26 priced cards, lowest $2 (Crown Zenith), highest $417 (Evolving Skies)"},{"hook":"Flareon had 70 HP in 1999. Now it has 270.","shots":["base2-3","sv8pt5-146"],"check":"Flareon: 33 cards with printed HP, 70 (Jungle, 1999) → 270 (Prismatic Evolutions, 2025)"},{"hook":"Same Pokémon. $3 and $160.","shots":["bw6-84","bw7-152"],"check":"Altaria: 18 priced cards, lowest $3 (Dragons Exalted), highest $160 (Boundaries Crossed)"},{"hook":"Same Pokémon. $4 and $332.","shots":["sm10-126","bwp-BW85"],"check":"Lucario: 35 priced cards, lowest $4 (Unbroken Bonds), highest $332 (BW Black Star Promos)"},{"hook":"Same Pokémon. $4 and $225.","shots":["xy12-26","ecard2-33"],"check":"Slowbro: 18 priced cards, lowest $4 (Evolutions), highest $225 (Aquapolis)"},{"hook":"NC Empire drew 7 cards. One of them is $581.","shots":["swshp-SWSH066","rsv10pt5-98"],"check":"NC Empire: 7 priced cards, top $581 (Charizard), second $46"},{"hook":"Same Pokémon. $9 and $2,411.","shots":["sv8pt5-60","swsh7-215"],"check":"Umbreon: 33 priced cards, lowest $9 (Prismatic Evolutions), highest $2,411 (Evolving Skies)"},{"hook":"Lopunny had 80 HP in 2007. Now it has 330.","shots":["dp1-30","me2-128"],"check":"Lopunny: 13 cards with printed HP, 80 (Diamond & Pearl, 2007) → 330 (Phantasmal Flames, 2025)"},{"hook":"Same Pokémon. $2 and $234.","shots":["swsh10-72","sm10-199"],"check":"Machamp: 31 priced cards, lowest $2 (Astral Radiance), highest $234 (Unbroken Bonds)"},{"hook":"Same Pokémon. $9 and $987.","shots":["sm6-82","xy4-122"],"check":"Dialga: 26 priced cards, lowest $9 (Forbidden Light), highest $987 (Phantom Forces)"},{"hook":"Same Pokémon. $3 and $360.","shots":["swsh12pt5-107","ex11-36"],"check":"Ditto: 24 priced cards, lowest $3 (Crown Zenith), highest $360 (Delta Species)"},{"hook":"Same Pokémon. $3 and $234.","shots":["sm9-19","swsh6-177"],"check":"Moltres: 19 priced cards, lowest $3 (Team Up), highest $234 (Chilling Reign)"},{"hook":"Same Pokémon. $3 and $610.","shots":["swsh5-22","zsv10pt5-171"],"check":"Victini: 15 priced cards, lowest $3 (Battle Styles), highest $610 (Black Bolt)"},{"hook":"Same Pokémon. $5 and $220.","shots":["sm8-78","neo3-1"],"check":"Ampharos: 19 priced cards, lowest $5 (Lost Thunder), highest $220 (Neo Revelation)"},{"hook":"Same Pokémon. $4 and $400.","shots":["sm35-53","bw4-102"],"check":"Zoroark: 20 priced cards, lowest $4 (Shining Legends), highest $400 (Next Destinies)"},{"hook":"Same Pokémon. $2 and $120.","shots":["xy12-38","ecard2-H16"],"check":"Magneton: 21 priced cards, lowest $2 (Evolutions), highest $120 (Aquapolis)"},{"hook":"Same Pokémon. $6 and $408.","shots":["dv1-3","gym1-4"],"check":"Dragonair: 15 priced cards, lowest $6 (Dragon Vault), highest $408 (Gym Heroes)"},{"hook":"Same Pokémon. $3 and $237.","shots":["sm11-114","sv10-232"],"check":"Garchomp: 24 priced cards, lowest $3 (Unified Minds), highest $237 (Destined Rivals)"},{"hook":"kodama drew 18 cards. One of them is $343.","shots":["sm10-201","swshp-SWSH069"],"check":"kodama: 18 priced cards, top $343 (Greninja & Zoroark-GX), second $48"},{"hook":"Same Pokémon. $4 and $217.","shots":["swsh9-122","swsh12pt5gg-GG70"],"check":"Arceus: 15 priced cards, lowest $4 (Brilliant Stars), highest $217 (Crown Zenith Galarian Gallery)"},{"hook":"Megumi Higuchi drew 4 cards. One of them is $83.","shots":["swshp-SWSH023","swsh9tg-TG06"],"check":"Megumi Higuchi: 4 priced cards, top $83 (Luxray), second $3"},{"hook":"Same Pokémon. $2 and $149.","shots":["swsh12-170","bw6-125"],"check":"Serperior: 8 priced cards, lowest $2 (Silver Tempest), highest $149 (Dragons Exalted)"},{"hook":"Same Pokémon. $6 and $4,250.","shots":["sm9-85","neo4-113"],"check":"Tyranitar: 24 priced cards, lowest $6 (Team Up), highest $4,250 (Neo Destiny)"},{"hook":"Same Pokémon. $2 and $201.","shots":["pgo-71","ecard2-H10"],"check":"Exeggutor: 24 priced cards, lowest $2 (Pokémon GO), highest $201 (Aquapolis)"},{"hook":"Same Pokémon. $4 and $264.","shots":["sm3-84","ecard2-H17"],"check":"Muk: 17 priced cards, lowest $4 (Burning Shadows), highest $264 (Aquapolis)"},{"hook":"Gengar had 80 HP in 1999. Now it has 350.","shots":["base3-5","me2pt5-284"],"check":"Gengar: 38 cards with printed HP, 80 (Fossil, 1999) → 350 (Ascended Heroes, 2026)"},{"hook":"Same Pokémon. $4 and $250.","shots":["me2-102","ecard2-66"],"check":"Wooper: 11 priced cards, lowest $4 (Phantasmal Flames), highest $250 (Aquapolis)"},{"hook":"Pikachu has 143 cards. 2 Pokémon have one.","shots":["ex13-104","swshp-SWSH074"],"check":"counted across 16468 cards with a dex number; Charizard 88"},{"hook":"Same Pokémon. $8 and $533.","shots":["swsh12pt5gg-GG29","swshp-SWSH177"],"check":"Bidoof: 7 priced cards, lowest $8 (Crown Zenith Galarian Gallery), highest $533 (SWSH Black Star Promos)"},{"hook":"Same Pokémon. $2 and $822.","shots":["swsh11-131","swsh11-186"],"check":"Giratina: 17 priced cards, lowest $2 (Lost Origin), highest $822 (Lost Origin)"},{"hook":"Same Pokémon. $3 and $489.","shots":["swsh12-140","neo3-7"],"check":"Ho-oh: 27 priced cards, lowest $3 (Silver Tempest), highest $489 (Neo Revelation)"},{"hook":"Anesaki Dynamic drew 15 cards. One of them is $1,246.","shots":["swsh7-218","smp-SM193"],"check":"Anesaki Dynamic: 15 priced cards, top $1,246 (Rayquaza VMAX), second $107"},{"hook":"Same Pokémon. $4 and $600.","shots":["sm75-18","ecard2-148"],"check":"Kingdra: 15 priced cards, lowest $4 (Dragon Majesty), highest $600 (Aquapolis)"},{"hook":"Same Pokémon. $3 and $215.","shots":["swsh11-179","swsh11-180"],"check":"Aerodactyl: 13 priced cards, lowest $3 (Lost Origin), highest $215 (Lost Origin)"},{"hook":"Same Pokémon. $11 and $1,500.","shots":["sm7-108","ex8-106"],"check":"Latios: 14 priced cards, lowest $11 (Celestial Storm), highest $1,500 (Deoxys)"},{"hook":"Yanmega had 90 HP in 2008. Now it has 280.","shots":["dp6-17","sv10-228"],"check":"Yanmega: 16 cards with printed HP, 90 (Legends Awakened, 2008) → 280 (Destined Rivals, 2025)"},{"hook":"Same Pokémon. $2 and $609.","shots":["sm75-46","zsv10pt5-172"],"check":"Zekrom: 12 priced cards, lowest $2 (Dragon Majesty), highest $609 (Black Bolt)"},{"hook":"Eevee had 50 HP in 1999. Now it has 200.","shots":["base2-51","sv8pt5-167"],"check":"Eevee: 69 cards with printed HP, 50 (Jungle, 1999) → 200 (Prismatic Evolutions, 2025)"},{"hook":"Diancie had 90 HP in 2014. Now it has 270.","shots":["xy4-71","me2pt5-282"],"check":"Diancie: 12 cards with printed HP, 90 (Phantom Forces, 2014) → 270 (Ascended Heroes, 2026)"},{"hook":"Same Pokémon. $3 and $1,900.","shots":["swsh7-64","pop5-16"],"check":"Espeon: 30 priced cards, lowest $3 (Evolving Skies), highest $1,900 (POP Series 5)"},{"hook":"Same Pokémon. $4 and $319.","shots":["sm7-46","bw5-104"],"check":"Kyogre: 13 priced cards, lowest $4 (Celestial Storm), highest $319 (Dark Explorers)"},{"hook":"Same Pokémon. $2 and $594.","shots":["swsh3-118","neo4-9"],"check":"Scizor: 27 priced cards, lowest $2 (Darkness Ablaze), highest $594 (Neo Destiny)"},{"hook":"Same Pokémon. $4 and $1,676.","shots":["swsh6-57","sm9-165"],"check":"Gengar: 34 priced cards, lowest $4 (Chilling Reign), highest $1,676 (Team Up)"},{"hook":"Same Pokémon. $2 and $1,067.","shots":["swsh9-22","ex10-113"],"check":"Entei: 18 priced cards, lowest $2 (Brilliant Stars), highest $1,067 (Unseen Forces)"},{"hook":"Same Pokémon. $5 and $694.","shots":["xy11-78","bw5-109"],"check":"Gardevoir: 37 priced cards, lowest $5 (Steam Siege), highest $694 (Dark Explorers)"},{"hook":"KEIICHIRO ITO drew 9 cards. One of them is $2,411.","shots":["swsh7-215","swsh12pt5gg-GG07"],"check":"KEIICHIRO ITO: 9 priced cards, top $2,411 (Umbreon VMAX), second $18"},{"hook":"Leafeon had 90 HP in 2009. Now it has 270.","shots":["pl2-45","sv8pt5-144"],"check":"Leafeon: 29 cards with printed HP, 90 (Rising Rivals, 2009) → 270 (Prismatic Evolutions, 2025)"},{"hook":"Same Pokémon. $3 and $145.","shots":["swsh9tg-TG06","bw10-104"],"check":"Dusknoir: 11 priced cards, lowest $3 (Brilliant Stars Trainer Gallery), highest $145 (Plasma Blast)"},{"hook":"Ryota Saito drew 5 cards. One of them is $67.","shots":["dpp-DP41","dpp-DP43"],"check":"Ryota Saito: 5 priced cards, top $67 (Toxicroak G), second $9"},{"hook":"Same Pokémon. $7 and $4,500.","shots":["swsh12-139","ecard2-149"],"check":"Lugia: 26 priced cards, lowest $7 (Silver Tempest), highest $4,500 (Aquapolis)"},{"hook":"Same Pokémon. $5 and $750.","shots":["xy12-45","ecard2-150"],"check":"Nidoking: 14 priced cards, lowest $5 (Evolutions), highest $750 (Aquapolis)"},{"hook":"Sharpedo had 70 HP in 2003. Now it has 330.","shots":["ex1-22","me2-127"],"check":"Sharpedo: 18 cards with printed HP, 70 (Ruby & Sapphire, 2003) → 330 (Phantasmal Flames, 2025)"},{"hook":"Same Pokémon. $3 and $220.","shots":["xy12-62","bp-9"],"check":"Hitmonchan: 14 priced cards, lowest $3 (Evolutions), highest $220 (Best of Game)"},{"hook":"Umbreon had 80 HP in 2003. Now it has 280.","shots":["ecard2-H29","sv8pt5-161"],"check":"Umbreon: 34 cards with printed HP, 80 (Aquapolis, 2003) → 280 (Prismatic Evolutions, 2025)"},{"hook":"Glaceon had 80 HP in 2009. Now it has 270.","shots":["pl2-41","sv8pt5-150"],"check":"Glaceon: 25 cards with printed HP, 80 (Rising Rivals, 2009) → 270 (Prismatic Evolutions, 2025)"},{"hook":"Same Pokémon. $4 and $150.","shots":["xy12-25","ex10-11"],"check":"Poliwrath: 10 priced cards, lowest $4 (Evolutions), highest $150 (Unseen Forces)"},{"hook":"Noriko Hotta drew 9 cards. One of them is $681.","shots":["col1-SL10","hgss3-84"],"check":"Noriko Hotta: 9 priced cards, top $681 (Rayquaza), second $82"},{"hook":"Same Pokémon. $4 and $150.","shots":["xy5-91","ex8-104"],"check":"Sharpedo: 12 priced cards, lowest $4 (Primal Clash), highest $150 (Deoxys)"},{"hook":"Same Pokémon. $2 and $1,600.","shots":["swsh9-48","ex10-114"],"check":"Raikou: 17 priced cards, lowest $2 (Brilliant Stars), highest $1,600 (Unseen Forces)"},{"hook":"Mew had 50 HP in 1999. Now it has 180.","shots":["basep-8","sv4pt5-216"],"check":"Mew: 29 cards with printed HP, 50 (Wizards Black Star Promos, 1999) → 180 (Paldean Fates, 2024)"},{"hook":"Same Pokémon. $6 and $541.","shots":["sm6-20","bw10-100"],"check":"Palkia: 20 priced cards, lowest $6 (Forbidden Light), highest $541 (Plasma Blast)"},{"hook":"Jolteon had 70 HP in 1999. Now it has 260.","shots":["base2-4","sv8pt5-153"],"check":"Jolteon: 33 cards with printed HP, 70 (Jungle, 1999) → 260 (Prismatic Evolutions, 2025)"},{"hook":"Same Pokémon. $5 and $301.","shots":["xy12-1","gym2-4"],"check":"Venusaur: 36 priced cards, lowest $5 (Evolutions), highest $301 (Gym Challenge)"},{"hook":"Same Pokémon. $2 and $275.","shots":["swsh6-100","ecard2-H22"],"check":"Slowking: 17 priced cards, lowest $2 (Chilling Reign), highest $275 (Aquapolis)"},{"hook":"GIDORA drew 9 cards. One of them is $292.","shots":["sv8-238","rsv10pt5-109"],"check":"GIDORA: 9 priced cards, top $292 (Pikachu ex), second $34"},{"hook":"Same Pokémon. $5 and $230.","shots":["sm9-88","ex16-92"],"check":"Absol: 11 priced cards, lowest $5 (Team Up), highest $230 (Power Keepers)"},{"hook":"Same Pokémon. $23 and $1,400.","shots":["base3-24","neo4-108"],"check":"Kabutops: 8 priced cards, lowest $23 (Fossil), highest $1,400 (Neo Destiny)"},{"hook":"Same Pokémon. $2 and $140.","shots":["xy5-110","ex13-7"],"check":"Flygon: 14 priced cards, lowest $2 (Primal Clash), highest $140 (Holon Phantoms)"},{"hook":"Same Pokémon. $3 and $147.","shots":["bw7-47","bw7-142"],"check":"Keldeo: 9 priced cards, lowest $3 (Boundaries Crossed), highest $147 (Boundaries Crossed)"},{"hook":"Same Pokémon. $2 and $440.","shots":["swsh3-21","neo3-8"],"check":"Houndoom: 25 priced cards, lowest $2 (Darkness Ablaze), highest $440 (Neo Revelation)"},{"hook":"Same Pokémon. $2 and $790.","shots":["swsh10-99","bw5-107"],"check":"Darkrai: 20 priced cards, lowest $2 (Astral Radiance), highest $790 (Dark Explorers)"},{"hook":"Same Pokémon. $5 and $385.","shots":["swsh6-21","swsh6-201"],"check":"Blaziken: 21 priced cards, lowest $5 (Chilling Reign), highest $385 (Chilling Reign)"},{"hook":"Same Pokémon. $3 and $380.","shots":["sm1-22","neo4-12"],"check":"Arcanine: 22 priced cards, lowest $3 (Sun & Moon), highest $380 (Neo Destiny)"},{"hook":"Same Pokémon. $5 and $1,501.","shots":["pgo-10","xy2-108"],"check":"Charizard: 85 priced cards, lowest $5 (Pokémon GO), highest $1,501 (Flashfire)"},{"hook":"Same Pokémon. $3 and $311.","shots":["swsh12pt5-38","swsh7-209"],"check":"Glaceon: 22 priced cards, lowest $3 (Crown Zenith), highest $311 (Evolving Skies)"},{"hook":"Same Pokémon. $3 and $291.","shots":["sm8-130","bw10-97"],"check":"Genesect: 11 priced cards, lowest $3 (Lost Thunder), highest $291 (Plasma Blast)"},{"hook":"Same Pokémon. $2 and $350.","shots":["sm6-59","pl2-108"],"check":"Infernape: 10 priced cards, lowest $2 (Forbidden Light), highest $350 (Rising Rivals)"},{"hook":"Same Pokémon. $3 and $105.","shots":["xy8-107","xy1-146"],"check":"Xerneas: 9 priced cards, lowest $3 (BREAKthrough), highest $105 (XY)"},{"hook":"Ryuta Fuse drew 15 cards. One of them is $485.","shots":["swsh7-194","smp-SM219"],"check":"Ryuta Fuse: 15 priced cards, top $485 (Rayquaza V), second $20"},{"hook":"Same Pokémon. $3 and $250.","shots":["xy2-23","pl3-SH7"],"check":"Milotic: 12 priced cards, lowest $3 (Flashfire), highest $250 (Supreme Victors)"},{"hook":"Same Pokémon. $2 and $196.","shots":["xy11-50","bw4-101"],"check":"Chandelure: 8 priced cards, lowest $2 (Steam Siege), highest $196 (Next Destinies)"},{"hook":"Same Pokémon. $3 and $256.","shots":["swsh5-62","sm8-226"],"check":"Mimikyu: 19 priced cards, lowest $3 (Battle Styles), highest $256 (Lost Thunder)"},{"hook":"Same Pokémon. $10 and $2,000.","shots":["smp-SM173","ex16-101"],"check":"Jolteon: 29 priced cards, lowest $10 (SM Black Star Promos), highest $2,000 (Power Keepers)"},{"hook":"Same Pokémon. $3 and $116.","shots":["swsh9-97","ex2-95"],"check":"Aggron: 11 priced cards, lowest $3 (Brilliant Stars), highest $116 (Sandstorm)"},{"hook":"Same Pokémon. $3 and $148.","shots":["sm75-33","bw4-103"],"check":"Hydreigon: 11 priced cards, lowest $3 (Dragon Majesty), highest $148 (Next Destinies)"},{"hook":"Eelektross had 140 HP in 2011. Now it has 350.","shots":["bw3-41","me2pt5-278"],"check":"Eelektross: 14 cards with printed HP, 140 (Noble Victories, 2011) → 350 (Ascended Heroes, 2026)"},{"hook":"Same Pokémon. $3 and $952.","shots":["swsh6-113","ex11-113"],"check":"Metagross: 18 priced cards, lowest $3 (Chilling Reign), highest $952 (Delta Species)"},{"hook":"Same Pokémon. $6 and $400.","shots":["g1-13","ecard2-H19"],"check":"Ninetales: 36 priced cards, lowest $6 (Generations), highest $400 (Aquapolis)"},{"hook":"Same Pokémon. $3 and $148.","shots":["bw3-73","bw7-151"],"check":"Terrakion: 8 priced cards, lowest $3 (Noble Victories), highest $148 (Boundaries Crossed)"},{"hook":"Teeziro drew 17 cards. One of them is $392.","shots":["swsh7-189","sv5-208"],"check":"Teeziro: 17 priced cards, top $392 (Umbreon V), second $64"},{"hook":"Same Pokémon. $3 and $116.","shots":["swsh11-181","pl2-106"],"check":"Gallade: 8 priced cards, lowest $3 (Lost Origin), highest $116 (Rising Rivals)"},{"hook":"Same Pokémon. $2 and $2,501.","shots":["swsh7-110","ex8-107"],"check":"Rayquaza: 39 priced cards, lowest $2 (Evolving Skies), highest $2,501 (Deoxys)"},{"hook":"Same Pokémon. $8 and $4,167.","shots":["sv8-220","sm9-170"],"check":"Latias: 21 priced cards, lowest $8 (Surging Sparks), highest $4,167 (Team Up)"},{"hook":"Cinccino had 90 HP in 2012. Now it has 240.","shots":["bw4-85","me4-119"],"check":"Cinccino: 14 cards with printed HP, 90 (Next Destinies, 2012) → 240 (Chaos Rising, 2026)"},{"hook":"Same Pokémon. $3 and $125.","shots":["swsh10-50","pl2-109"],"check":"Luxray: 12 priced cards, lowest $3 (Astral Radiance), highest $125 (Rising Rivals)"},{"hook":"Same Pokémon. $2 and $749.","shots":["swsh11-49","bw7-145"],"check":"Kyurem: 30 priced cards, lowest $2 (Lost Origin), highest $749 (Boundaries Crossed)"},{"hook":"Same Pokémon. $3 and $375.","shots":["xy4-17","neo4-5"],"check":"Feraligatr: 13 priced cards, lowest $3 (Phantom Forces), highest $375 (Neo Destiny)"},{"hook":"Same Pokémon. $8 and $2,000.","shots":["swshp-SWSH041","ex16-100"],"check":"Flareon: 30 priced cards, lowest $8 (SWSH Black Star Promos), highest $2,000 (Power Keepers)"},{"hook":"Same Pokémon. $4 and $1,100.","shots":["sm8-59","ex10-115"],"check":"Suicune: 18 priced cards, lowest $4 (Lost Thunder), highest $1,100 (Unseen Forces)"},{"hook":"Same Pokémon. $8 and $371.","shots":["swshp-SWSH158","sv6-214"],"check":"Greninja: 19 priced cards, lowest $8 (SWSH Black Star Promos), highest $371 (Twilight Masquerade)"},{"hook":"Same Pokémon. $5 and $350.","shots":["sm115-48","bwp-BW97"],"check":"Eevee: 54 priced cards, lowest $5 (Hidden Fates), highest $350 (BW Black Star Promos)"},{"hook":"Takumi Wada drew 5 cards. One of them is $81.","shots":["rsv10pt5-169","sv4-210"],"check":"Takumi Wada: 5 priced cards, top $81 (Hydreigon ex), second $12"},{"hook":"Metagross had 100 HP in 2004. Now it has 340.","shots":["pop1-2","me2pt5-289"],"check":"Metagross: 27 cards with printed HP, 100 (POP Series 1, 2004) → 340 (Ascended Heroes, 2026)"},{"hook":"Same Pokémon. $3 and $158.","shots":["swsh11-188","ecard1-23"],"check":"Pidgeot: 17 priced cards, lowest $3 (Lost Origin), highest $158 (Expedition Base Set)"},{"hook":"Unown had 40 HP in 1999. Now it has 250.","shots":["basep-38","swsh12-199"],"check":"Unown: 77 cards with printed HP, 40 (Wizards Black Star Promos, 1999) → 250 (Silver Tempest, 2022)"},{"hook":"Froslass had 90 HP in 2008. Now it has 310.","shots":["dp6-3","me2pt5-275"],"check":"Froslass: 15 cards with printed HP, 90 (Legends Awakened, 2008) → 310 (Ascended Heroes, 2026)"},{"hook":"Same Pokémon. $3 and $1,450.","shots":["swsh12pt5-59","bp-8"],"check":"Mewtwo: 62 priced cards, lowest $3 (Crown Zenith), highest $1,450 (Best of Game)"},{"hook":"Same Pokémon. $4 and $999.","shots":["cel25-11","sv4pt5-232"],"check":"Mew: 29 priced cards, lowest $4 (Celebrations), highest $999 (Paldean Fates)"},{"hook":"Same Pokémon. $3 and $575.","shots":["pgo-17","ex6-104"],"check":"Blastoise: 37 priced cards, lowest $3 (Pokémon GO), highest $575 (FireRed & LeafGreen)"},{"hook":"Vaporeon had 80 HP in 1999. Now it has 280.","shots":["base2-12","sv8pt5-149"],"check":"Vaporeon: 31 cards with printed HP, 80 (Jungle, 1999) → 280 (Prismatic Evolutions, 2025)"},{"hook":"Same Pokémon. $3 and $3,200.","shots":["pgo-28","ex13-104"],"check":"Pikachu: 120 priced cards, lowest $3 (Pokémon GO), highest $3,200 (Holon Phantoms)"},{"hook":"Same Pokémon. $2 and $1,200.","shots":["swsh7-28","ex13-102"],"check":"Gyarados: 37 priced cards, lowest $2 (Evolving Skies), highest $1,200 (Holon Phantoms)"},{"hook":"Same Pokémon. $2 and $132.","shots":["swsh10-164","bw10-103"],"check":"Virizion: 11 priced cards, lowest $2 (Astral Radiance), highest $132 (Plasma Blast)"},{"hook":"Same Pokémon. $2 and $101.","shots":["swsh12-33","ecard2-116"],"check":"Vulpix: 23 priced cards, lowest $2 (Silver Tempest), highest $101 (Aquapolis)"},{"hook":"Feraligatr had 100 HP in 2000. Now it has 370.","shots":["neo1-4","me2pt5-274"],"check":"Feraligatr: 17 cards with printed HP, 100 (Neo Genesis, 2000) → 370 (Ascended Heroes, 2026)"},{"hook":"Same Pokémon. $5 and $269.","shots":["sm9-40","ex6-116"],"check":"Zapdos: 26 priced cards, lowest $5 (Team Up), highest $269 (FireRed & LeafGreen)"},{"hook":"Meganium had 100 HP in 2000. Now it has 360.","shots":["neo1-10","me2pt5-272"],"check":"Meganium: 15 cards with printed HP, 100 (Neo Genesis, 2000) → 360 (Ascended Heroes, 2026)"},{"hook":"Same Pokémon. $2 and $1,400.","shots":["sm115-18","ex16-102"],"check":"Vaporeon: 28 priced cards, lowest $2 (Hidden Fates), highest $1,400 (Power Keepers)"},{"hook":"Same Pokémon. $8 and $700.","shots":["base5-65","ecard2-104"],"check":"Psyduck: 25 priced cards, lowest $8 (Team Rocket), highest $700 (Aquapolis)"},{"hook":"Same Pokémon. $10 and $843.","shots":["base5-47","sm9-161"],"check":"Magikarp: 24 priced cards, lowest $10 (Team Rocket), highest $843 (Team Up)"},{"hook":"Same Pokémon. $2 and $129.","shots":["swsh11-172","ex6-107"],"check":"Electrode: 20 priced cards, lowest $2 (Lost Origin), highest $129 (FireRed & LeafGreen)"},{"hook":"Same Pokémon. $5 and $313.","shots":["swsh4-172","pl2-103"],"check":"Alakazam: 14 priced cards, lowest $5 (Vivid Voltage), highest $313 (Rising Rivals)"},{"hook":"Same Pokémon. $3 and $200.","shots":["swsh3-182","neo4-2"],"check":"Crobat: 11 priced cards, lowest $3 (Darkness Ablaze), highest $200 (Neo Destiny)"},{"hook":"Same Pokémon. $2 and $700.","shots":["swsh10-54","neo1-18"],"check":"Typhlosion: 19 priced cards, lowest $2 (Astral Radiance), highest $700 (Neo Genesis)"},{"hook":"Same Pokémon. $7 and $486.","shots":["swsh12-172","rsv10pt5-173"],"check":"Reshiram: 18 priced cards, lowest $7 (Silver Tempest), highest $486 (White Flare)"}];
// FILTER AGAINST WHAT ACTUALLY SHIPS. A hook naming two cards and producing an
// empty tray looks broken at the exact moment somebody trusted it, so only
// hooks whose cards are all present survive.
const LIVE_HOOKS = HOOKS.filter(function(h){
  return h.shots.length && h.shots.every(function(i){ return !!byIdRow[i]; });
});
function renderHooks(){
  const box = el("hooks");
  if (!box || !LIVE_HOOKS.length) return;
  // A different handful each time, or it becomes wallpaper.
  const pick = LIVE_HOOKS.slice().sort(function(){ return Math.random() - 0.5; }).slice(0, 5);
  box.innerHTML = pick.map(function(h, n){
    return "<button class='hookchip' data-n='" + n + "'>" + h.hook + "</button>";
  }).join("");
  box.querySelectorAll(".hookchip").forEach(function(b){
    b.onclick = function(){
      const h = pick[Number(b.dataset.n)];
      const cards = h.shots.map(function(i){ return byIdRow[i]; }).filter(Boolean);
      if (!cards.length) return;
      tray = cards; blob = null;
      const lab = el("label");
      if (lab) lab.value = h.hook;
      // THE BASIS TRAVELS WITH IT. Somebody about to post a number should be
      // able to see where it came from without leaving the page — that is the
      // difference between a claim they can defend and one they cannot.
      const r = el("askreply");
      if (r) { r.textContent = h.check; r.className = "askreply"; }
      render();
    };
  });
}

function render(){
  const L = layoutForTray();
  const box = el("tray");
  const cols = L ? L.cols : Math.min(Math.max(tray.length, 3), 3);
  const phone = window.innerWidth < 760;
  const cell = phone || cols > 3 ? "1fr" : "148px";
  box.style.gridTemplateColumns = \`repeat(\${cols}, minmax(0, \${cell}))\`;
  const pocket = (c, k) => c
    ? \`<div class="pocket filled"><img src="\${imgSmall(c.i)}" alt="\${c.n}" loading="lazy" data-cid="\${c.i}" onerror="imgFallback(this,&#39;\${c.i}&#39;)"><button class="x" onclick="remove(\${k})" aria-label="Remove \${c.n}">×</button><button class="own \${owned[c.i] ? "yes" : ""}" onclick="toggleOwn('\${c.i}')">\${owned[c.i] ? "OWNED" : "want"}</button></div>\`
    : "<div class='pocket'></div>";
  let html = "";
  if (L && L.shape && L.shape.length) {
    var pi = 0;
    for (var rr = 0; rr < L.shape.length; rr++) {
      for (var cc = 0; cc < L.cols; cc++) {
        if (cc < L.shape[rr] && pi < tray.length) { html += pocket(tray[pi], pi); pi++; }
        else html += "<div class='pocket'></div>";
      }
    }
  } else {
    const slots = L ? L.cols * Math.ceil(tray.length / L.cols) : Math.max(tray.length, 3);
    html = tray.map(function(c, k){ return pocket(c, k); }).join("");
    for (let i = tray.length; i < slots; i++) html += "<div class='pocket'></div>";
  }
  box.innerHTML = html || "<div class='pocket'></div><div class='pocket'></div><div class='pocket'></div>";
  const allowed = checkIntent();
  renderLines();
  renderStreakLine();
  renderSelfReply();
  renderStreak();
  renderTally();
  el("plabel").textContent = L ? ("YOUR PAGE — " + L.name.toUpperCase()) : "YOUR PAGE";
  const anotherBtn = el("anotherset");
  if (anotherBtn) {
    anotherBtn.hidden = !tray.length;
    if (typeof anotherBtn.setAttribute === "function")
      anotherBtn.setAttribute("aria-label", "Another set with the same filters");
  }
  const backBtn = el("backset");
  if (backBtn) {
    backBtn.hidden = !trail.length;
    backBtn.disabled = !trail.length;
    if (typeof backBtn.setAttribute === "function")
      backBtn.setAttribute("aria-label", "Previous set");
  }
  const vb = el("viberow");
  if (vb) vb.hidden = !tray.length;

  el("make").disabled = !L || !allowed;
  el("cv").style.display = "none";
  const out = el("outimg");
  if (out && !blob) out.hidden = true;
  ["copy","share","dl"].forEach(i => { if (el(i)) el(i).hidden = !blob; });
  if (!tray.length) { setStatus("Type what you want above, or open browse below."); return; }
  if (L) {
    // WARN AT COMPOSE TIME. 216 cards are addable with no recorded artist, and
    // nothing said so before the image was made — card-composite refuses an
    // uncredited art post and the editor let one through silently.
    const missing = tray.filter(c => !c.a).length;
    setStatus(\`\${tray.length} cards · \${L.cols} across\` + (missing ? \` · \${missing} will publish with NO artist credit\` : ""), missing > 0);
  } else {
    const below = SUPPORTED.filter(n => n < tray.length).pop(), above = SUPPORTED.find(n => n > tray.length);
    setStatus(\`\${tray.length} cards has no frame. \${below ? "Remove " + (tray.length - below) : ""}\${below && above ? " or add " + (above - tray.length) : ""}.\`, true);
  }
}

// THE FUNNEL. Three small questions, then real combinations - not a list of
// themes but a list of POSTS, each already loadable into the tray. A creator
// who arrives without an idea should leave with three.
// NOTHING GATES, EVERY CONTROL REFINES. fCount used to start at 0, so clicking
// an angle before a count returned silently and the whole column read as broken.
// One is the default. Two is a tap. Connecting art and legend halves
// raise the count themselves — those cards are not a single picture.
let fSet = "", fCount = 1, fTheme = null;

function renderThemes(){
  const box = el("ftheme");
  // FLOW LIKE WATER. A theme only appears if it can actually FILL the chosen
  // count from the chosen set. Pick 151 and ten of fifteen themes produce
  // nothing — offering one of those is worse than offering fewer, because the
  // creator picks it, gets nothing, and learns the tool does not know its own
  // catalogue.
  const pool = INDEX.filter(c => (!fSet || c.s === fSet) && /Illustration Rare|Rare Holo|Rare Secret|Rare Ultra/i.test(c.r || ""));
  const canFill = (t) => {
    const need = fCount || 1;
    if (t.kind === "named list") {
      const distinct = new Set(pool.filter(c => (t.members || []).some(m => c.n.startsWith(m)))
        .map(c => (t.members || []).find(m => c.n.startsWith(m))));
      return distinct.size >= need;
    }
    if (t.id === "many-hands" || t.id === "battle") {
      const byMon = {};
      for (const c of pool) if (c.a) (byMon[monName(c.n)] = byMon[monName(c.n)] || new Set()).add(c.a);
      return Object.values(byMon).some(set => set.size >= need);
    }
    if (t.id === "artist-career" || t.id === "first-and-last") {
      const byArtist = {};
      for (const c of pool) if (c.a) (byArtist[c.a] = byArtist[c.a] || []).push(c);
      return Object.values(byArtist).some(l => l.length >= need);
    }
    return pool.length >= need;
  };
  const fits = THEMES.filter(t => (!fCount || (t.bestAt || []).includes(fCount)) && canFill(t));
  // GROUPED, NOT HIDDEN. 35 chips in one row is a wall, and putting them
  // behind "more options" would be worse — hiding a core control is friction
  // dressed as minimalism. Structure beats disclosure at this size.
  if (!fits.length) { box.innerHTML = "<span class='empty'>Nothing fits that count. Try another.</span>"; return; }
  const groups = {};
  for (const t of fits) (groups[t.group || "OTHER"] = groups[t.group || "OTHER"] || []).push(t);
  const order = ["BY SUBJECT", "BY ARTIST", "BY STORY", "BY ERA", "BY SET", "BY ARGUMENT", "OTHER"];
  box.innerHTML = order.filter(g => groups[g]).map(g =>
    "<div class='tgroup'><span class='tglabel'>" + g + "</span>" +
    groups[g].map(t => "<button class='chip" + (fTheme === t.id ? " on" : "") + "' data-t='" + t.id + "'>" + t.name + "</button>").join("") +
    "</div>").join("");
  box.querySelectorAll(".chip").forEach(b => b.onclick = () => { fTheme = b.dataset.t; lastPref = { kind: "theme", ask: "" }; anotherCursor = 0; renderThemes(); buildIdeas(); });
}
safeWire(function(){ el("fcount").querySelectorAll(".chip").forEach(b => b.onclick = () => {
  applyCount(+b.dataset.n, true);
  if (fTheme && !THEMES.find(t => t.id === fTheme && (t.bestAt||[]).includes(fCount))) fTheme = null;
  renderThemes(); buildIdeas();
}); }, "fcount");
el("fset").onchange = () => { fSet = el("fset").value; lastPref = { kind: "filters", ask: lastPref.ask || "" }; anotherCursor = 0; renderThemes(); buildIdeas(); };

const HERO_RX = /(Special Illustration|Illustration Rare|Rare Holo|Rare Secret|Rare Ultra|Rare Rainbow|Ultra Rare)/i;

// ── A HOOK WITH A HOLE IN IT MUST NEVER REACH THE CAPTION BOX ─────────────
// Four themes carry a hook template - "Six from {set}. Which page are you
// filling first?" - and every shape that uses one substitutes its own values,
// so nothing leaks today: 579 idea cards across 61 themes and five counts,
// zero placeholders. But three branches still push t.hook VERBATIM, and an
// idea's hook is written straight into the caption the user posts. The gap
// between "safe because of how it happens to be routed" and "safe" is one
// refactor wide, and the failure lands in public.
function safeHook(t){
  const h = t && t.hook;
  if (!h || h.indexOf("{") < 0) return h || "";
  return "";                  // no hook is better than a hook with a hole in it
}

function buildIdeas(){
  const box = el("ideas");
  if (!fCount || !fTheme) { box.innerHTML = ""; return; }
  const t = THEMES.find(x => x.id === fTheme);
  // A STALE SELECTION IS THE REALISTIC PATH HERE, not a hostile user: pick a
  // theme, then pick a set that excludes it, and fTheme points at something no
  // longer in the list. It threw on .shape.
  if (!t) { fTheme = null; box.innerHTML = ""; return; }
  const pool = INDEX.filter(c => (!fSet || c.s === fSet) && HERO_RX.test(c.r || "") && ratingPass(c));
  const need = fCount;
  const ideas = [];

  // BUILDERS BY SHAPE, not by id. buildIdeas used to switch on t.id, so four
  // themes produced silently nothing and two shared a branch and returned
  // identical results. Each theme now declares a SHAPE and dispatch is on that
  // — a theme without a builder fails visibly instead of quietly.
  const shape = t.shape || (t.kind === "named list" ? "list" : "unbuilt");

  if (shape === "list") {
    const byMon = {};
    for (const c of pool) {
      const m = (t.members || []).find(x => c.n.startsWith(x));
      if (!m) continue;
      if (!byMon[m] || (c.p || 0) > (byMon[m].p || 0)) byMon[m] = c;
    }
    const picked = Object.values(byMon).sort((a, b) => (b.p || 0) - (a.p || 0)).slice(0, need);
    if (picked.length === need) ideas.push({ title: t.name, sub: picked.map(c => c.n).join(" · "), hook: safeHook(t), cards: picked });
  }

  else if (shape === "many-hands") {
    const byName = {};
    for (const c of pool) if (c.a) (byName[monName(c.n)] = byName[monName(c.n)] || []).push(c);
    for (const [mon, list] of Object.entries(byName)) {
      const seen = new Map();
      for (const c of list) if (!seen.has(c.a)) seen.set(c.a, c);
      if (seen.size >= need) ideas.push({ title: mon + " by " + need + " artists",
        sub: [...seen.keys()].slice(0, need).join(" · "),
        hook: need + " artists. One " + mon + ". Which is definitive?", cards: [...seen.values()].slice(0, need) });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "artist-span") {
    // The FIRST and LAST card by one hand — the gap is the story.
    const byArtist = {};
    for (const c of pool) if (c.a && c.y) (byArtist[c.a] = byArtist[c.a] || []).push(c);
    for (const [artist, list] of Object.entries(byArtist)) {
      const sorted = list.sort((a, b) => (a.y || "") < (b.y || "") ? -1 : 1);
      const span = Number(sorted[sorted.length - 1].y) - Number(sorted[0].y);
      if (span < 8 || sorted.length < need) continue;
      const picked = need === 2 ? [sorted[0], sorted[sorted.length - 1]]
        : sorted.filter((_, i, a) => i % Math.max(1, Math.floor(a.length / need)) === 0).slice(0, need);
      if (picked.length !== need) continue;
      ideas.push({ title: artist, sub: picked.map(c => c.n + " " + c.y).join("  →  "),
        hook: span + " years apart. Same artist.", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "debut") {
    // Their EARLIEST card beside their best-known — a different claim entirely
    // from the span, which is why sharing a branch was wrong.
    const byArtist = {};
    for (const c of pool) if (c.a && c.y) (byArtist[c.a] = byArtist[c.a] || []).push(c);
    for (const [artist, list] of Object.entries(byArtist)) {
      if (list.length < need) continue;
      const first = list.slice().sort((a, b) => (a.y || "") < (b.y || "") ? -1 : 1)[0];
      const best = list.slice().sort((a, b) => (b.p || 0) - (a.p || 0))[0];
      if (first.i === best.i) continue;
      const picked = [first, best].slice(0, need);
      if (picked.length !== need) continue;
      ideas.push({ title: artist + " started here", sub: first.n + " " + first.y + "  →  " + best.n + " " + best.y,
        hook: "Everybody starts somewhere.", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "battle") {
    // Two versions of one Pokemon, close on value — a battle nobody can settle
    // by pointing at a price.
    const byMon = {};
    for (const c of pool) if (c.p && c.a) (byMon[monName(c.n)] = byMon[monName(c.n)] || []).push(c);
    for (const [mon, list] of Object.entries(byMon)) {
      const ranked = list.sort((a, b) => (b.p || 0) - (a.p || 0));
      if (ranked.length < 2) continue;
      const [a, b] = ranked;
      if ((b.p / a.p) < 0.55) continue;
      if (a.a === b.a && a.y === b.y) continue;
      ideas.push({ title: mon + ": " + a.a + " or " + b.a, sub: a.s + "  vs  " + b.s,
        hook: mon + ". " + a.s + " or " + b.s + "? No wrong answer, but you have one.", cards: [a, b].slice(0, need) });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "one-set") {
    const bySet = {};
    for (const c of pool) (bySet[c.s] = bySet[c.s] || []).push(c);
    for (const [set, list] of Object.entries(bySet)) {
      if (list.length < need) continue;
      const picked = list.sort((a, b) => (b.p || 0) - (a.p || 0)).slice(0, need);
      ideas.push({ title: set + ", by value", sub: picked.map(c => c.n).join(" · "),
        hook: need + " from " + set + ". Which page are you filling first?", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "eras") {
    // The same Pokemon across widely separated years.
    const byMon = {};
    for (const c of pool) if (c.y) (byMon[monName(c.n)] = byMon[monName(c.n)] || []).push(c);
    for (const [mon, list] of Object.entries(byMon)) {
      const years = [...new Set(list.map(c => c.y))].sort();
      if (years.length < need) continue;
      const step = Math.max(1, Math.floor(years.length / need));
      const picked = years.filter((_, i) => i % step === 0).slice(0, need)
        .map(y => list.filter(c => c.y === y).sort((a, b) => (b.p || 0) - (a.p || 0))[0]);
      if (picked.length !== need || picked.some(c => !c)) continue;
      const span = Number(picked[picked.length - 1].y) - Number(picked[0].y);
      if (span < 8) continue;
      ideas.push({ title: mon + " across " + span + " years", sub: picked.map(c => c.y).join(" → "),
        hook: "Which era got " + mon + " right?", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "matchup") {
    // THE MATCHUP IS PRINTED ON THE CARD. Every Pokémon card prints a WEAKNESS —
    // a type it takes double damage from — which is a rivalry the game itself
    // declared, not one we invented. 605 cards have both sides available in the
    // catalogue, and "Charmander fears Water → Magikarp" is a joke the data told.
    // A MATCHUP IS ABOUT ITS CARDS, WHATEVER THE RARITY — third time this
    // lesson has appeared. Weakness is printed on every card, and restricting to
    // hero rarity threw away most of both sides.
    const mPool = INDEX.filter(function(c){ return (!fSet || c.s === fSet) && c.a && ATTRS[c.i] && ATTRS[c.i].t; });
    const byType = {};
    for (const c of mPool) for (const t of (ATTRS[c.i]?.t || [])) { byType[t] = byType[t] || []; byType[t].push(c); }
    for (const c of mPool) {
      const w = ATTRS[c.i]?.w;
      if (!w || !byType[w]) continue;
      const enemy = byType[w].filter(function(x){ return monName(x.n) !== monName(c.n); })
        .sort(function(a, b){ return (b.p || 0) - (a.p || 0); })[0];
      if (!enemy) continue;
      ideas.push({ title: monName(c.n) + " fears " + w,
        sub: monName(c.n) + "  ×2 from  " + monName(enemy.n),
        hook: "It says so on the card. Would it actually go that way?",
        cards: [c, enemy].slice(0, need) });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "same-attack") {
    // SAME ATTACK, DIFFERENT CREATURES. Thirty-seven attack names are shared by
    // three or more unrelated Pokémon — a connection nobody would notice by
    // browsing, and one only a full catalogue can surface.
    const byAtk = {};
    for (const c of pool) for (const at of (CARD_TEXT[c.i]?.a || [])) {
      if (String(at).length < 7) continue;
      byAtk[at] = byAtk[at] || []; byAtk[at].push(c);
    }
    for (const [name, list] of Object.entries(byAtk)) {
      const distinct = [];
      const seen = {};
      for (const c of list) { const k = monName(c.n); if (!seen[k]) { seen[k] = 1; distinct.push(c); } }
      if (distinct.length < need) continue;
      ideas.push({ title: "All called " + String.fromCharCode(8220) + name + String.fromCharCode(8221),
        sub: distinct.slice(0, need).map(function(c){ return monName(c.n); }).join(" · "),
        hook: "Same attack, different creatures. Which one earned the name?",
        cards: distinct.slice(0, need) });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "twenty-years") {
    // TWENTY YEARS APART. 374 Pokémon have cards two decades apart, and the gap
    // itself is the story — the Arita pairing at 127,200 views was exactly this
    // shape found by hand.
    const byMon = {};
    for (const c of pool) { if (!c.y) continue; const k = monName(c.n); byMon[k] = byMon[k] || []; byMon[k].push(c); }
    for (const [mon, list] of Object.entries(byMon)) {
      const sorted = list.slice().sort(function(a, b){ return String(a.y).localeCompare(String(b.y)); });
      const span = Number(sorted[sorted.length - 1].y) - Number(sorted[0].y);
      if (span < 20) continue;
      const picked = need === 2 ? [sorted[0], sorted[sorted.length - 1]]
        : [sorted[0]].concat(sorted.slice(1, -1).filter(function(_, i){ return i % Math.max(1, Math.floor((sorted.length - 2) / (need - 2))) === 0; }).slice(0, need - 2)).concat([sorted[sorted.length - 1]]);
      if (picked.length !== need) continue;
      ideas.push({ title: mon + ", " + span + " years apart",
        sub: picked.map(function(c){ return c.y; }).join("  →  "),
        hook: span + " years. Which one is still the best?", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "evo") {
    // A LINE IS ABOUT ITS CARDS, WHATEVER THE RARITY. Only 34 three-stage lines
    // resolved from hero rarity because the MIDDLE stage breaks them — Metapod
    // has zero Illustration Rares, Kakuna none, Pichu two. Nobody makes a chase
    // card of a cocoon. Same lesson as Koga: filtering by rarity excluded the
    // only card that could complete the request.
    const evoPool = INDEX.filter(function(c){ return (!fSet || c.s === fSet) && c.a && ratingPass(c); });
    // THE EVOLUTION LINE. A real relationship in the data, walked from the
    // evolvesFrom field — Charmander to Charmeleon to Charizard, in order. No
    // name list could produce this, because the relationship IS the content and
    // a list only knows membership.
    const byMon = {};
    for (const c of evoPool) { const k = monName(c.n);
      // Prefer the best card at each stage — hero rarity first, then price —
      // without REQUIRING it, or the cocoon stage kills the line.
      const rank = function(x){ return (HERO_RX.test(x.r || "") ? 1000000 : 0) + (x.p || 0); };
      if (!byMon[k] || rank(c) > rank(byMon[k])) byMon[k] = c; }
    // THE EVO SHAPE IGNORED THE POKEMON. It walked every entry and returned the
    // first complete line, so asking for Charizard announced Charizard and handed
    // back Chansey — saying one thing while showing another, which is the failure
    // that reads as researched.
    const wanted = fMon ? String(fMon).toLowerCase() : null;
    for (const [base, card] of Object.entries(byMon)) {
      if (ATTRS[card.i]?.e) continue;
      // START FROM THE PLAIN CARD. The walk begins at the highest-ranked card for
      // that Pokemon, and for Magikarp that is a Tag Team — "Magikarp & Wailord-GX"
      // — which evolves from nothing and stops the chain on its first step.
      // Choose a PLAIN card for the base rather than dropping the creature.
      // Skipping meant Magikarp never entered the walk at all, when the fix was
      // simply to start from a different Magikarp.
      let startCard = card;
      if (/[&]/.test(startCard.n)) {
        const plain = evoPool.filter(function(x){ return monName(x.n) === base && !/[&]/.test(x.n) && !ATTRS[x.i]?.e; });
        if (!plain.length) continue;
        startCard = plain.sort(function(a,b){ return (HERO_RX.test(b.r||"")?1e6:0)+(b.p||0) - ((HERO_RX.test(a.r||"")?1e6:0)+(a.p||0)); })[0];
      }                 // start at the bottom only
      const line = [startCard];
      let cur = base;
      for (let i = 0; i < 3 && line.length < need; i++) {
        // PICK THE CARD THAT LINKS. The best Gengar is a VMAX, and a Gengar
        // VMAX evolves from Gengar V rather than Haunter — so choosing by value
        // broke the chain on the card being accurate. Look through EVERY card of
        // the next stage for one that names this stage.
        let next = Object.values(byMon).find(x => ATTRS[x.i]?.e === cur);
        // A CARD CANNOT EVOLVE INTO ITSELF. A Machamp VMAX evolves from
        // "Machamp", so searching for a card naming the current stage found
        // Machamp again — and again. The next stage must be a DIFFERENT creature.
        if (next && monName(next.n) === cur) next = null;
        // FALL BACK TO THE BABY LINK. The card will not name it, so the walk
        // stops at Pichu unless we supply the relationship the game defines.
        if (!next) {
          const child = Object.keys(BABY_OF).find(function(k){ return BABY_OF[k] === cur; });
          if (child && byMon[child]) next = byMon[child];
        }
        if (!next) {
          const linking = evoPool.filter(function(x){ return ATTRS[x.i] && ATTRS[x.i].e === cur; });
          const linkingReal = linking.filter(function(x){ return monName(x.n) !== cur; });
          if (linkingReal.length) next = linkingReal.sort(function(a, b){
            return (HERO_RX.test(b.r || "") ? 1000000 : 0) + (b.p || 0) - ((HERO_RX.test(a.r || "") ? 1000000 : 0) + (a.p || 0));
          })[0];
        }
        if (!next) break;
        line.push(next); cur = next.n.split(" ")[0];
      }
      // A LINE OF ONE IS NOT A LINE. Returning a single card whose name merely
      // contains the word is worse than returning nothing, because it looks like
      // an answer. Eevee has eight branches and no single line; it belongs in the
      // Eeveelutions theme, not here.
      // THE LINE IS AS LONG AS IT IS. Magikarp → Gyarados is two stages, and
      // demanding three rejected the whole line and returned a Tag Team card
      // instead. Requiring a count the creature does not have is asking the data
      // to be wrong.
      if (line.length < 2) continue;
      if (line.length > need) line.length = need;
      // NEVER PROMISE A COUNT THE LINE CANNOT FILL. Padding a two-stage line to
      // three said three and produced two.
      // A SHORT LINE IS FINE IF IT IS THE WHOLE LINE. Magikarp → Gyarados is
      // two stages, and blocking it confused "only two long" with "the walk
      // stopped early". The idea now promises what it HAS rather than what was
      // asked for.
      if (line.length < 2) continue;
      // Any stage of the line satisfies the request — asking for Charizard, or
      // Charmander, should both find Charmander → Charmeleon → Charizard.
      if (wanted && !line.some(c => monName(c.n).toLowerCase() === wanted)) continue;
      ideas.push({ count: line.length, title: line.map(c => monName(c.n)).join(" → "),
        sub: line.map(c => c.y).join("  ·  "),
        hook: "The whole line. Which stage is the best card?", cards: line });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "mechanic") {
    // A MECHANIC ERA. V, GX, EX, VMAX — each is a period the game actually had,
    // and collectors date their own history by them. Only possible now the
    // subtype field exists.
    const q = t.query || {};
    const hits = pool.filter(c => (ATTRS[c.i]?.s || []).includes(q.value));
    const byMon = {};
    for (const c of hits) { const k = monName(c.n);
      if (!byMon[k] || (c.p || 0) > (byMon[k].p || 0)) byMon[k] = c; }
    const picked = Object.values(byMon).sort((a, b) => (b.p || 0) - (a.p || 0)).slice(0, need);
    if (picked.length === need)
      ideas.push({ title: t.name, sub: picked.map(c => c.n).join(" · "), hook: safeHook(t), cards: picked });
  }

  else if (shape === "power-creep") {
    // POWER CREEP, as a real number over real years. HP runs 30 to 380 and the
    // climb is a story the cards tell on themselves — a fact with no source
    // needed because both numbers are printed.
    const withHp = pool.filter(c => ATTRS[c.i]?.h && c.y);
    const byMon = {};
    for (const c of withHp) (byMon[monName(c.n)] = byMon[monName(c.n)] || []).push(c);
    for (const [mon, list] of Object.entries(byMon)) {
      const sorted = list.sort((a, b) => (a.y || "") < (b.y || "") ? -1 : 1);
      const oldest = sorted[0], newest = sorted[sorted.length - 1];
      const gap = ATTRS[newest.i].h - ATTRS[oldest.i].h;
      if (gap < 100 || Number(newest.y) - Number(oldest.y) < 8) continue;
      // THE ENDS ARE THE CLAIM. Sampling by step never included the LAST card, so
      // the title said "120 → 330 HP" while the final card shown had 280. Always
      // anchor on oldest and newest and fill the middle between them.
      let picked;
      if (need === 2) picked = [oldest, newest];
      else {
        const middle = sorted.slice(1, -1);
        const step = Math.max(1, Math.floor(middle.length / (need - 2)));
        picked = [oldest, ...middle.filter((_, i) => i % step === 0).slice(0, need - 2), newest];
      }
      if (picked.length !== need) continue;
      ideas.push({ title: mon + ": " + ATTRS[oldest.i].h + " HP → " + ATTRS[newest.i].h + " HP",
        sub: oldest.y + "  →  " + newest.y,
        hook: "Same Pokémon. " + gap + " more HP. Was the power creep worth it?", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "type" || shape === "dex") {
    // A QUERY, NOT A LIST. This is the whole difference: a theme built on a real
    // field is never out of date, and a list I maintain is wrong the day a set
    // lands.
    const q = t.query || {};
    const match = shape === "type"
      ? (c) => (ATTRS[c.i]?.t || []).includes(q.value)
      : (c) => { const d = ATTRS[c.i]?.d; return d && d >= q.from && d <= q.to; };
    const hits = pool.filter(match);
    // One card per Pokemon, best first — nine Charizards is a composition, not
    // a set of nine.
    const byMon = {};
    for (const c of hits) { const k = monName(c.n);
      if (!byMon[k] || (c.p || 0) > (byMon[k].p || 0)) byMon[k] = c; }
    const picked = Object.values(byMon).sort((a, b) => (b.p || 0) - (a.p || 0)).slice(0, need);
    if (picked.length === need)
      ideas.push({ title: t.name, sub: picked.map(c => c.n).join(" · "), hook: safeHook(t), cards: picked });
  }

  else if (shape === "lore") {
    // THE CARD TELLS ITS OWN STORY. 4,464 cards carry printed flavour text, and
    // it needs no research and no sourcing — it is on the object. This is the
    // difference between a story shape that reaches 0.89% of the catalogue and
    // one that reaches 27%.
    const withLore = pool.filter(c => LORE[c.i]);
    const seen = new Set();
    for (const c of withLore) {
      const key = monName(c.n);
      if (seen.has(key)) continue;
      seen.add(key);
      const group = withLore.filter(x => monName(x.n) === key).slice(0, need);
      if (group.length !== need) continue;
      ideas.push({ title: c.n, sub: LORE[c.i].slice(0, 96) + (LORE[c.i].length > 96 ? "…" : ""),
        hook: "The card says this about itself.", cards: group });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "story" || shape === "story-controversial") {
    // Two questions, two slices. These shared one shape and walked the same
    // list from the top, which is why two themes returned identical results.
    const CONTROVERSIAL = /banned|censor|lawsuit|sued|withdrawn|absence|stopped|removed|pulled/i;
    const source = shape === "story-controversial"
      ? FACTS.filter(f => CONTROVERSIAL.test(f.claim))
      : FACTS.filter(f => !CONTROVERSIAL.test(f.claim));
    // Cards our knowledge base has something sourced to say about.
    for (const f of source) {
      // FULL NAME OR NOTHING. This used to match the FIRST WORD of a card name
      // against the claim, so "The Rocket's Trap" appeared beside a fact about
      // Koga's Ninja Trick — because the sentence contains "The". A wrong card
      // beside a true claim is worse than no card: it reads as researched.
      const norm = (x) => x.replace(/[\u2018\u2019]/g, "'").toLowerCase();
      const claim = norm(f.claim);
      // A story is about its CARD, whatever the rarity. Koga's Ninja Trick is an
      // Uncommon, and filtering stories by hero rarity excluded the only card
      // that could illustrate the fact.
      const storyPool = INDEX.filter(c => !fSet || c.s === fSet);
      const named = storyPool.filter(c => c.n.length >= 5 && claim.includes(norm(c.n)));
      if (named.length < need) continue;
      const picked = named.sort((a, b) => (a.y || "") < (b.y || "") ? -1 : 1).slice(0, need);
      ideas.push({ title: f.id.replace(/-/g, " "), sub: picked.map(c => c.n + " " + c.y).join("  →  "),
        hook: f.claim.split(".")[0] + ".", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else {
    // A theme with no builder says so, rather than showing an empty box that
    // looks like the tool is broken.
    box.innerHTML = "<div class='empty'>" + t.name + " has no builder yet — pick another angle.</div>";
    window.__ideas = [];
    return;
  }

  box.innerHTML = ideas.length ? ideas.slice(0, 6).map((idea, k) =>
    "<div class='idea' onclick='loadIdea(" + k + ")'><b>" + idea.title + "</b><i>" + idea.sub + "</i><div class='hook'>" + (idea.hook || "") + "</div></div>").join("")
    : "<div class='empty'>Nothing fits " + (fSet || "that") + " at " + fCount + " cards. Widen the set or change the count.</div>";
  window.__ideas = ideas;
}

function loadIdea(k){
  const idea = window.__ideas[k]; if (!idea) return;
  tray = idea.cards.slice(); blob = null;
  lastPref = { kind: "theme", ask: "" };
  anotherCursor = 0;
  el("label").value = idea.hook;
  render();
  el("make").scrollIntoView({ behavior: "smooth", block: "center" });
}
renderThemes();
function bootReady(){
  var q = "the birds";
  try {
    var sp = new URLSearchParams(location.search);
    if (sp.get("ready") === "venusaur" || /venusaur/i.test(sp.get("q") || "")) q = "mega venusaur";
    else if (sp.get("q")) q = sp.get("q");
  } catch (e) {}
  try { var t = el("tut"); if (t) t.hidden = true; } catch (e) {}
  try { if (el("ask")) el("ask").value = q; } catch (e) {}
  try { runAsk(q); } catch (e) {}
  setTimeout(function(){
    try { composeImage(); } catch (e) {}
  }, 400);
}
window.bootReady = bootReady;

// LAST, so a failure here cannot take the editor down with it. The tutorial is
// the nicest thing on the page and the least important: if it throws, a
// stranger should still get a working tool rather than a blank one.
safeWire(function(){ tutStart(); bootReady(); }, "tutorial");

// THE COMPOSE IS A NAMED FUNCTION so the retry control can call it again with
// a smaller scale. It used to be an anonymous click handler, which meant the
// only way to recompose was for the user to press Make — and if the failure
// they were recovering from was a blank canvas, pressing Make just reproduced it.
let composeScale = null;   // forced by the retry control; null means decide automatically
let lastScale = 1;         // the linear scale actually used on the last attempt
var composeGen = 0;
async function composeImage(){
  const gen = ++composeGen;
  const L = layoutForTray(); if (!L) return;
  // ENFORCE AT THE POINT OF ACTION, not only in the UI. The refusal used to
  // live entirely in el("make").disabled, and a disabled attribute is an
  // affordance rather than a guard — re-enabling it in the console, or calling
  // this handler directly, produced the sell image the refusal exists to
  // prevent. Re-checking here means the rule holds wherever the call comes from.
  if (!checkIntent()) { setStatus("that combination is refused — see the note above", true); return; }
  setStatus("composing…");
  const missingArt = [];
  const CW = 745, CH = 1040, GAP = 60, PAD = 90, CAP = tray.length <= 4 ? 70 : 0;
  const LABEL = el("label").value.trim();
  // Reserve height for the WRAPPED label, not one line of it. measureText needs
  // a context we do not have yet, so estimate from character count at 52px bold
  // (~28px per glyph across the usable width) and cap at the three lines the
  // renderer will draw. Over-reserving costs blank pixels; under-reserving costs
  // a caption printed through the footer.
  // MEASURE, DO NOT ESTIMATE. The height used to be guessed from character
  // count at a hardcoded width while the wrapping was measured at the real one,
  // so on a narrower frame the estimate said two lines and the draw produced
  // four — and the last fell off the canvas. Both now come from the same
  // measurement, taken once.
  const LABLINES = LABEL ? (() => {
    const probe = document.createElement("canvas").getContext("2d");
    probe.font = "800 52px system-ui,sans-serif";
    const maxW = L.W - 160;
    let lines = 1, cur = "";
    for (const w of LABEL.split(WS)) {
      const t = cur ? cur + " " + w : w;
      if (probe.measureText(t).width > maxW && cur) { lines++; cur = w; } else cur = t;
    }
    // THE RENDERER DRAWS AT MOST THREE LINES and ellipsises the rest. Reserving
    // for the untruncated count adds hundreds of blank pixels under a long
    // caption - the comment above already said "cap at the three lines the
    // renderer will draw", and the code never did it.
    return Math.min(3, lines);
  })() : 0;
  const LABH = LABEL ? 110 + (LABLINES - 1) * 62 : 0;
  const ROWS = L.rows || Math.ceil(tray.length / L.cols);
  // THE TABLE OWNS THE FRAME. This used to recompute the width from the column
  // count, which threw away the WIDENING that keeps a 2x2 from cropping on X —
  // the table said 2056 and the renderer drew 1730. A table is only a source of
  // truth if the thing downstream reads it.
  const W = L.W;
  const SLAB_EXTRA = fSlab ? CH * 0.17 + CW * 0.18 : 0;
  const H = L.H + SLAB_EXTRA * ROWS + (LABEL ? LABH : 0);

  // ── THE CANVAS MEMORY CEILING ────────────────────────────────────────────
  // iOS Safari abandons a canvas above roughly 16.7M pixels, and starts failing
  // well below that under memory pressure. It does not throw. toBlob returns
  // null, or the canvas comes back blank, and every line after this point
  // behaves as though the image was made — which is how a waitlist user gets a
  // blank PNG and no error at all.
  //
  // THE REAL WORST CASE IS BIGGER THAN IT LOOKS. The frame table lists the
  // binder page at 3070x3530, but H grows with the slab (310.9px per row) and
  // the wrapped label (up to 234px), so nine slabbed cards under a three-line
  // label composes 3070x4697 = 14.4M pixels, about 55MB of canvas. The spread
  // reaches 11.0M the same way. Both are inside the range where a phone quietly
  // gives up.
  //
  // SO SCALE, DO NOT FAIL. Above the cap the whole image is composed at a
  // reduced linear scale through a single context transform, which means every
  // drawing call below still works in the frame's own coordinates and none of
  // them had to change. The user is told the real output size rather than
  // being handed a smaller image without comment.
  const MAX_PX = 8000000;
  const REQ_PX = W * H;
  const autoScale = REQ_PX > MAX_PX ? Math.sqrt(MAX_PX / REQ_PX) : 1;
  const scale = composeScale != null ? composeScale : autoScale;
  lastScale = scale;

  const cv = el("cv");
  cv.width = Math.max(1, Math.round(W * scale));
  cv.height = Math.max(1, Math.round(H * scale));
  const g = cv.getContext("2d");
  // A null context is the other way a phone refuses, and it IS detectable.
  if (!g) {
    reportBlank(L, W, H, cv, null, "the browser would not give this page a 2D canvas context at " + cv.width + "x" + cv.height + ".");
    return;
  }
  if (scale !== 1) g.setTransform(scale, 0, 0, scale, 0, 0);
  g.fillStyle = "#070910"; g.fillRect(0,0,W,H);
  try{
    for (let i=0;i<tray.length;i++){
      const u = imgUrl(tray[i].i);
      const routes = [u, "https://images.weserv.nl/?url=" + encodeURIComponent(u.replace(/^https?:\\/\\//,"")) + "&w=745&output=png"];
      let img = null;
      for (const r of routes){
        try{ img = await new Promise((res,rej)=>{ const im=new Image(); im.crossOrigin="anonymous";
          im.onload=()=>res(im); im.onerror=()=>rej(); im.src=r; }); break; }catch{}
      }
      // ONE FAILED IMAGE MUST NOT KILL THE WHOLE IMAGE. This threw on the first
      // card that would not load, so a single blocked request produced NOTHING —
      // which is what Tyler saw, and what my harness hid by making every image
      // succeed. A missing card leaves a labelled gap instead: three cards and
      // one hole is a usable post, three cards and an error is not.
      if (!img) { missingArt.push(tray[i].n); continue; }
      if (gen !== composeGen) return;
      // Centre the grid inside the widened frame, or a padded layout sits hard left.
      const gridW = CW*L.cols + GAP*(L.cols-1);
      const originX = Math.round((W - gridW) / 2);
      const pos = slotPos(i, L);
      const x = originX + pos.c*(CW+GAP), y = PAD + pos.r*(CH+CAP+GAP);
      drawSlab(g, img, x, y, CW, CH, tray[i]);
      if (CAP){ g.fillStyle="#8a93a8"; g.font="28px system-ui,sans-serif"; g.textAlign="center";
        g.fillText(tray[i].n + " · " + tray[i].y, x+CW/2, y+CH+46); }
    }
    if (LABEL){ g.fillStyle="#f4f5f8"; g.font="800 52px system-ui,sans-serif"; g.textAlign="center";
      // WRAP, DO NOT OVERFLOW. A 182-character label was drawn as one line and
      // ran off BOTH edges — it started mid-word and ended mid-word, because
      // fillText neither wraps nor clips, it just draws past the canvas. The
      // label is the one field a creator controls, so it is the one most
      // certain to be longer than anyone designing the layout expected.
      // DOUBLE BACKSLASH. This string is written from a template literal, where
      // \\s is not a recognised escape and collapses to a bare s — so a regex
      // written here as one backslash arrived in the browser as /s+/ and split
      // the label on the LETTER s. Every s vanished: "absolutely" rendered as
      // "ab olutely". Same root cause as the quote bug above, one line later.
      var maxW = W - 160, words = LABEL.split(WS), lines = [], cur = "";
      for (var wi = 0; wi < words.length; wi++){
        var trial = cur ? cur + " " + words[wi] : words[wi];
        if (g.measureText(trial).width > maxW && cur){ lines.push(cur); cur = words[wi]; }
        else cur = trial;
      }
      if (cur) lines.push(cur);
      // Three lines is already a paragraph on a card; past that the label is
      // doing the job the post's own text should do.
      if (lines.length > 3){ lines = lines.slice(0,3); lines[2] = lines[2].replace(/\\s+\\S*$/, "") + "…"; }
        const bandH = fIntent === "post" ? 110 : 190;
      for (var li = 0; li < lines.length; li++)
        // CLEAR THE FOOTER BAND, WHICH IS NOT ALWAYS THE SAME HEIGHT. A post
        // reserves 110px at the bottom; want, trade and sell reserve 190 for the
        // intent label and the total. The caption was drawn at H-150 regardless,
        // so on a want list it landed INSIDE that band and a two-line label printed
        // straight through 'Looking for'. Found by attacking it: nine cards, three
        // unpriced, and a 178-character label.
        g.fillText(lines[li], W/2, H - bandH - 40 - (lines.length - 1 - li) * 62);
    }
    // WANT LIST FRAME. A post wants a clean image; a want list is a WORKING
    // document. It gets held up at a table or pasted into a trade thread, so
    // it needs the price under each card and a total at the bottom - the two
    // things somebody deciding whether to help you actually needs.
    if (fIntent === "want" || fIntent === "trade" || fIntent === "sell") {
      const priced = tray.filter(c => c.p != null);
      const total = priced.reduce((a, c) => a + c.p, 0);
      // THUMBNAIL LEGIBILITY. A want list is seen first as a 400px preview and
      // decided on there. Text sized for the full canvas vanishes: 26px on a
      // 2535px canvas is 4.1px in that preview. Scale to the canvas so the
      // price survives the shrink, because the price IS the message.
      const thumbScale = 400 / W;
      const priceSize = Math.max(26, Math.round(11 / thumbScale));
      g.fillStyle = "#8a93a8"; g.font = priceSize + "px system-ui,sans-serif"; g.textAlign = "center";
      tray.forEach((c, i) => {
        if (c.p == null) return;
        const pos = slotPos(i, L);
        const x = PAD + pos.c * (CW + GAP), y = PAD + pos.r * (CH + CAP + GAP);
        g.fillStyle = owned[c.i] ? "#36d399" : "#8a93a8";
        g.fillText((owned[c.i] ? "HAVE  " : "") + "$" + Math.round(c.p).toLocaleString(), x + CW / 2, y + CH + (CAP ? 62 + priceSize : 14 + priceSize));
      });
      const label = fIntent === "want" ? "Looking for" : fIntent === "trade" ? "Trade list" : "For sale";
      g.fillStyle = "#f4f5f8"; g.font = "800 44px system-ui,sans-serif"; g.textAlign = "left";
      g.fillText(label, PAD, H - 118);
      g.font = "34px ui-monospace,monospace"; g.fillStyle = "#8a93a8"; g.textAlign = "right";
      // A total built from partial data says so, here as everywhere.
      const missing = tray.length - priced.length;
      g.fillText("$" + Math.round(total).toLocaleString() + (missing ? "  +" + missing + " unpriced" : ""), W - PAD, H - 118);
    }
    // THE WATERMARK IS NOT OPTIONAL. Three points so cropping one corner does not
    // remove it; faint, because a mark that ruins the image protects nothing.
    g.save(); g.globalAlpha=0.16; g.fillStyle="#fff"; g.font="800 40px system-ui,sans-serif"; g.textAlign="center";
    for (const [wx,wy] of [[W*0.27, PAD+CH*0.40],[W*0.73, PAD+CH*0.80]]){
      g.save(); g.translate(wx,wy); g.rotate(-Math.PI/9); g.fillText("catchemtcg.com",0,0); g.restore(); }
    g.restore();
    g.fillStyle="#36d399"; g.font="800 40px system-ui,sans-serif"; g.textAlign="left";
    g.fillText("Catch'em", PAD, H-40);
    const artists = [...new Set(tray.map(c=>c.a).filter(Boolean))].slice(0,3).join(" · ");
    g.fillStyle="#5c637a"; g.font="26px ui-monospace,monospace"; g.textAlign="right";
    g.fillText(artists || "artist not recorded", W-PAD, H-40);

    blob = await new Promise(r => cv.toBlob(r,"image/png"));
    if (gen !== composeGen) return;

    // ── NEVER LET A BLANK EXPORT REACH A USER ──────────────────────────────
    // Two failures look identical from here and both are silent: toBlob hands
    // back null, or it hands back a valid PNG of nothing. The second is the
    // dangerous one, because every check that only asks "did I get a blob?"
    // passes. A blank canvas is one flat colour, and PNG compresses one flat
    // colour to almost nothing, so SIZE is the tell: a real composite at these
    // dimensions carries card art, a watermark and two lines of text and runs
    // to hundreds of kilobytes. Anything under 10KB did not draw.
    const FLOOR_BYTES = 10240;
    if (!blob) {
      reportBlank(L, W, H, cv, null, "the browser returned nothing from toBlob, which is how iOS Safari reports running out of memory for a canvas this size.");
      return;
    }
    if (blob.size < FLOOR_BYTES) {
      reportBlank(L, W, H, cv, blob, "the image encoded to only " + Math.round(blob.size / 1024) + "KB. A composite this size cannot be that small unless the canvas came back blank.");
      return;
    }

    cv.style.display="none";
    // ── NONE OF THEM LOADED IS NOT A PARTIAL SUCCESS ──────────────────────
    // With the art host unreachable, every card failed and the tool still said
    // "Made it, but 4 card images would not load" over a 50KB frame holding a
    // watermark, a credit strip and nothing else. It offered the download. The
    // blank-canvas floor did not catch it either, because 50KB of furniture
    // clears a 10KB floor comfortably.
    //
    // "Made it, but" is the right sentence when SOME art is missing - the post
    // is still postable and the gap is explained. When NONE of it arrived there
    // is no post, and saying otherwise sends somebody to X with an empty frame.
    const allArtMissing = missingArt.length > 0 && missingArt.length === tray.length;
    if (allArtMissing) {
      setStatus("None of the " + tray.length + " card images loaded, so there is nothing to post — the frame came out empty. The art host is unreachable from this connection. Your cards are still in the tray; try again when you have signal.", true);
      el("dl").hidden = true; el("copy").hidden = true; el("share").hidden = true;
      el("blankwarn").hidden = true; el("retryscale").hidden = true;
      try { window.__lastComposeOk = false; } catch (e) {}
      try { tutComposed(false, "no card art loaded"); } catch (e) {}
      return;
    }
    el("dl").hidden=false;
    el("copy").hidden=false;
    if (navigator.canShare && navigator.canShare({files:[new File([""],"t.png",{type:"image/png"})]})) el("share").hidden=false;
    // SAY WHICH ONES ARE MISSING. A silent gap looks like a bug; a named one
    // looks like a card that would not load, which is the truth.
    if (missingArt.length) setStatus("Made it, but " + missingArt.length + " card image" + (missingArt.length > 1 ? "s" : "") + " would not load: " + missingArt.join(", ") + ". The art host may be blocked on this connection.", true);
    else if (scale !== 1) setStatus("ready — " + cv.width + "×" + cv.height + ", reduced from " + W + "×" + H + " so this device could hold the canvas");
    else setStatus("ready — " + cv.width + "×" + cv.height);
    el("blankwarn").hidden = true;
    el("retryscale").hidden = true;
    // ── THERE WAS A FLOOR AND NO CEILING ──────────────────────────────────
    // The guard above catches the canvas coming back BLANK, which is the
    // failure that produces nothing. It never caught the opposite: an eight
    // card spread on a 2x device encodes to about 12.5MB, and the tool
    // reported "ready" for a file the destination will not take. Both ends of
    // the range are failures; only one of them was watched.
    //
    // ASSUMED CEILING, NOT A VERIFIED ONE. 5MB is the figure commonly cited
    // for a PNG posted to X from the web, and this repo has never recorded it
    // from source - so it is an assumption stated in the open, queued to
    // ask-eyes for Tyler to confirm from his own posting, and deliberately
    // written as a WARNING over a finished image rather than a refusal. The
    // image is good. It may simply be too big for one destination, and the
    // half-size control that already exists is the fix.
    const CEIL_BYTES = 5 * 1024 * 1024;
    if (blob.size > CEIL_BYTES) {
      const mb = (blob.size / 1048576).toFixed(1);
      setStatus("Made it — " + cv.width + "×" + cv.height + ", but it is " + mb +
        "MB. X will likely refuse a PNG over 5MB. Try again at half size and it will still look right.", true);
      el("retryscale").hidden = false;
    }
    // A CANVAS CANNOT BE LONG-PRESSED. Swap in a real <img> so the first
    // gesture anybody tries on a phone actually works.
    // THE IMAGE IS DRAWN BEFORE THE SWAP. If toDataURL throws — a tainted
    // canvas, an old browser — the compose must NOT report failure, because the
    // drawing succeeded and the canvas is right there. Reporting a failure over
    // a finished image is the worst of both.
    try { await showSaveableBlob(blob); }
    catch (e) {
      try { showSaveable(cv.toDataURL("image/png")); } catch (e2) {}
    }
    try {
      openSaveSheet(previewUrl || (el("outimg") && el("outimg").src));
    } catch (e) {}
    try { window.__lastComposeOk = true; } catch (e) {}
    try { tutComposed(true); } catch (e) {}
    // Offered only after something actually worked, and only once.
    try { setTimeout(fbMaybeAskQuestionnaire, 2500); } catch (e) {}
  }catch(e){
    setStatus("could not compose: " + (e.message||"unknown"), true);
    try { window.__lastComposeOk = false; } catch (e2) {}
    try { tutComposed(false, e.message); } catch (e2) {}
  }
}
window.composeImage = composeImage;

// SAY IT ON THE PAGE, WITH THE NUMBERS. A user who gets a blank image needs to
// know it was blank, which frame did it, how big that frame was, and what to
// press next. "Something went wrong" would leave them exactly where the silent
// failure did.
function reportBlank(L, W, H, cv, blob, why){
  const box = el("blankwarn");
  const req = W + "×" + H + " (" + (W * H / 1000000).toFixed(1) + "M pixels)";
  const got = cv.width + "×" + cv.height;
  box.textContent =
    "The image came back blank, so nothing was saved. " + why +
    "  Frame: " + L.name + ", " + L.cols + "×" + L.rows + " at " + req +
    (got !== (W + "×" + H) ? ", composed at " + got : "") +
    ".  This is a memory limit on the device, not a problem with your cards.";
  box.hidden = false;
  // Only offer a retry that would actually be smaller than what just failed.
  const next = lastScale / 2;
  const btn = el("retryscale");
  if (Math.round(W * next) >= 400) {
    btn.textContent = "Try again at " + Math.round(W * next) + "×" + Math.round(H * next);
    btn.hidden = false;
  } else {
    btn.hidden = true;
    box.textContent += "  Already at the smallest useful size — use fewer cards.";
  }
  cv.style.display = "none";
  setStatus("blank image — see the note below", true);
}
window.reportBlank = reportBlank;

function retryAtHalf(){
  composeScale = lastScale / 2;
  el("retryscale").hidden = true;
  composeImage();
}
window.retryAtHalf = retryAtHalf;

// A fresh press of Make always starts from the automatic scale again — the
// forced one belongs to the failure it was recovering from, not to the next
// image, which may be a different frame entirely.
safeWire(function(){ el("make").onclick = () => { composeScale = null; composeImage(); }; }, "make");

const fname = () => "catchem-" + (el("label").value.trim() || tray.map(c=>c.n).join("-") || "cards")
  .replace(/[^a-z0-9]+/gi,"-").toLowerCase().slice(0,48) + ".png";
safeWire(function(){ el("dl").onclick = function(){ dlImage(); }; }, "dl");
safeWire(function(){ el("copy").onclick = function(){ copyImage(); }; }, "copy");
safeWire(function(){ el("share").onclick = function(){ shareImage(); }; }, "share");
</script>`;

  await writeFile(join(ROOT, "research/assets/build.html"), html);
  // REPORT THE ARTIFACT, NOT THE SOURCE. This printed index.length - the
  // catalogue size - while the page shipped a filtered subset, so the log
  // claimed 16,468 searchable cards over an index of 6,725 for as long as the
  // filter existed. Count the rows that actually went into the file.
  const shipped = JSON.parse(html.match(/const CARD_ROWS = (\[.*?\]);\n/s)?.[1] ?? "[]").length;
  console.log(`✓ editor: ${shipped.toLocaleString("en-US")} cards searchable · ${Object.keys(LAYOUTS).length} frames · watermark and credit locked`);
}
