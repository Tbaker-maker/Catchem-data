// scripts/send-discord-alerts.mjs — the machine pings Tyler's pocket.
// Posts NEW spread signals + quiet movers + a daily one-liner to a Discord
// webhook. Dedupe via data/alerts-state.json (only new signal ids ping).
// No webhook env set → exits clean ("disarmed"). Trust Standard: numbers
// only from repo instruments; internal channel (licensing gate: this is
// Tyler's own server, not publication).
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = process.env.DISCORD_WEBHOOK_URL;
if (!HOOK) { console.log("alerts disarmed (no DISCORD_WEBHOOK_URL)"); process.exit(0); }
const J = async p => { try { return JSON.parse(await readFile(join(ROOT,p),"utf-8")); } catch { return null; } };

const div = await J("data/divergence-report.json") ?? { rows: [] };
const der = await J("data/derived-insights.json") ?? {};
const heat = await J("data/heat-report.json") ?? {};
const state = await J("data/alerts-state.json") ?? { sentSignals: [] };

const sigs = div.rows.filter(r=>r.signal);
const fresh = sigs.filter(r=>!state.sentSignals.includes(r.id));
const gone = state.sentSignals.filter(id=>!sigs.some(r=>r.id===id));
const heatDay = (heat.mode||"").match(/day (\d+)/)?.[1];

const lines = [];
lines.push(`☀️ **Catch'em daily** — ${div.counts?.compared??0} cross-checked · ${sigs.length} signals · reads day ${heatDay??"?"}/8`);
for (const r of fresh.slice(0,5))
  lines.push(`⚡ **NEW: ${r.name}** — eBay $${r.ebayAskMedian} (${r.ebayListings??"—"} listings) vs TCG $${r.tcgMarket} → **${r.spreadPct>0?"+":""}${r.spreadPct}%**`);
if (gone.length) lines.push(`✅ signals cleared: ${gone.length}`);
for (const q of (der.narrative?.quietMovers??[]).slice(0,2))
  lines.push(`🤫 quiet mover: **${q.flagship}** $${q.price} · ${q.spreadPct>0?"+":""}${q.spreadPct}% — tape moved, news quiet`);
const content = lines.join("\n").slice(0, 1900);

const res = await fetch(HOOK, { method:"POST", headers:{ "content-type":"application/json" },
  body: JSON.stringify({ content, username: "Catch'em Machine" }) });
if (!res.ok) { console.error(`webhook ${res.status}`); process.exit(1); }
await writeFile(join(ROOT,"data/alerts-state.json"),
  JSON.stringify({ sentSignals: sigs.map(r=>r.id), lastSentAt: new Date().toISOString() }, null, 2)+"\n");
console.log(`✓ pinged Discord: ${fresh.length} new signals, ${gone.length} cleared`);
