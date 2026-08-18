// scripts/generate-post-ideas.mjs — daily X-post idea ammo from live instruments.
// NOT drafts. Angles + the number + a hook direction; Tyler supplies voice.
// [FACT] = verified repo data · [READ] = our interpretation, hedge it.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT,p),"utf-8")); } catch { return null; } };
const sp = await J("data/sealed-prices.json"), dv = await J("data/divergence-report.json"),
      der = await J("data/derived-insights.json"), sg = await J("data/singles-prices.json"),
      rad = await J("data/release-radar.json");
const today = new Date().toISOString().slice(0,10);
const live = sp.products.filter(p=>p.dataStatus==="live");
const sigs = (dv?.rows||[]).filter(r=>r.signal).sort((a,b)=>Math.abs(b.spreadPct)-Math.abs(a.spreadPct));
const thin = [...live].filter(p=>p.listingCount && p.listingCount<8).sort((a,b)=>a.listingCount-b.listingCount);
const deep = [...live].sort((a,b)=>(b.listingCount||0)-(a.listingCount||0));
const chases = (sg?.cards||[]).filter(c=>!c.needsReview&&c.priceMarket).sort((a,b)=>b.priceMarket-a.priceMarket);
const upcoming = (rad?.items||rad?.releases||[]).filter(r=>(r.date||r.releaseDate||"")>=today).slice(0,3);
let md = `# 🎯 Post Ideas — ${today}\n*Angles + live numbers. Voice = yours. [FACT] verified · [READ] hedge it.*\n\n`;
md += `## ⚡ Two-market gaps (who's right?)\n`;
for (const r of sigs.slice(0,4)) md += `- [FACT] **${r.name}**: eBay $${r.ebayAskMedian} vs TCG $${r.tcgMarket} (${r.spreadPct>0?"+":""}${r.spreadPct}%, ${r.ebayListings??"—"} listings). Hook: "two markets, ${Math.abs(r.spreadPct)}% apart — somebody's wrong."\n`;
md += `\n## 🏜 Supply stories\n`;
for (const p of thin.slice(0,3)) md += `- [FACT] **${p.name}** — only ${p.listingCount} active listings at $${p.priceMedian}. Hook: scarcity-on-tape / "try to buy one."\n`;
if (deep[0]) md += `- [FACT] Deepest market: **${deep[0].name}** ($${deep[0].priceMedian}, ${deep[0].listingCount} listings). Hook: liquidity king / easiest entry-exit.\n`;
md += `- [READ] Aug 28: six $21.99 tins = TPC injecting supply into the tightest set of the year. Absorb or stall — the watch.\n`;
md += `\n## 🧮 Value angles (Pack Math)\n`;
if (der?.packMath){ const hi=der.packMath.priciest[0], lo=der.packMath.cheapest[0];
md += `- [FACT] Sealed pack spectrum: **$${hi.perPack}/pack** (${hi.name}) → **$${lo.perPack}/pack** (${lo.name}). Hook: "what a pack actually costs, ranked."\n- [READ] ${lo.name} at $${lo.perPack}/pack = cheapest real wax on the board. Sleeper or trap? (invite the fight)\n`; }
md += `\n## 👀 Monitor list (never "calls" — watching out loud)\n`;
for (const c of chases.slice(0,4)) md += `- [FACT] **${c.name}** $${c.priceMarket} (TCGplayer mkt). Hook: post the level, ask the room where it goes.\n`;
if (chases.length>=2) md += `- [READ] Gap play: ${chases[0].name} $${chases[0].priceMarket} vs ${chases[2]?.name} $${chases[2]?.priceMarket} — era-icon ratio talk.\n`;
md += `\n## 🤫 Nobody's talking about\n`;
for (const q of (der?.narrative?.quietMovers||[]).slice(0,3)) md += `- [READ] **${q.flagship}** moving (${q.spreadPct>0?"+":""}${q.spreadPct}%) with zero coverage. Hook: "the tape noticed before the timeline did."\n`;
md += `\n## 📅 Seasonal thesis (evergreen this month)\n- [READ] Summer lull → catalyst stack: Aug 28 tins → Sept 16 worldwide 30th launch → Q4 holidays. "The quiet window is closing" — falsifier: if listings balloon post-tins, thesis wrong.\n- [READ] Back-to-school = historical soft patch for wax; Q4 = strongest. Position language: "lock-in window," never guarantees.\n`;
if (upcoming.length){ md += `\n## 🗓 Calendar hooks\n`; for (const u of upcoming) md += `- [FACT] ${u.date||u.releaseDate} — ${u.name||u.title}. Countdown / checklist / "who's buying" post.\n`; }
md += `\n*Regenerates daily with the run. Mix 1 FACT + 1 READ per day; questions out-engage statements.*\n`;
await mkdir(join(ROOT,"research/post-ideas"),{recursive:true});
await writeFile(join(ROOT,`research/post-ideas/${today}.md`), md);
console.log(`✓ post ideas: research/post-ideas/${today}.md`);
