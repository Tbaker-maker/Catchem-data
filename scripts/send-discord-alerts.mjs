// send-discord-alerts.mjs v2 — THE DISCORD ENGINE
// One embed, three audiences: our server (DISCORD_WEBHOOK_URL), the
// creator network (CREATOR_WEBHOOKS_JSON secret: {"hooks":[{"id","url"}]}),
// and a dry-run preview file every run so the embed is always inspectable.
// Disarmed-safe: no secrets → preview only, exit 0. Webhook URLs NEVER
// touch the repo; registry (data/creator-registry.json) holds ids/prefs only.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const der = await J("data/derived-insights.json") ?? {};
const div = await J("data/divergence-report.json") ?? { rows: [] };
const state = await J("data/alerts-state.json") ?? { sentSignals: [], mutedHooks: {} };
const six = der.sealedIndex, t3 = der.dailyThree ?? {}, wo = der.watchOutcomes, roh = der.ripOrHold;
const today = new Date().toISOString().slice(0, 10);

// publish-guard: derived picks predate qa-gate's flags; a held product must
// not reach a Discord embed (or its committed preview) either.
const { loadBlocked } = await import("./lib/publish-guard.mjs");
const __blk = await loadBlocked();
const clean = (v) => (v && !__blk.mentions(JSON.stringify(v)) ? v : null);

const lines = [];
const t3s = clean(t3.sealed), t3g = clean(t3.graded), t3r = clean(t3.raw);
if (t3s) lines.push(`**SEALED** · ${t3s.name} — $${t3s.ebay} · asking ${Math.abs(t3s.spreadPct)}% ${t3s.spreadPct > 0 ? "more" : "less"} than TCGplayer`);
if (t3g) lines.push(`**GRADED** · ${t3g.name} — raw $${Math.round(t3g.raw)} → PSA 10 $${Math.round(t3g.psa10)} (+$${Math.round(t3g.premium)})`);
if (t3r) lines.push(`**RAW** · ${t3r.name} — $${Math.round(t3r.price)} (${t3r.set})`);
const woS = clean(wo?.sealed);
const outcomeLine = woS && woS.dPct != null
  ? `Yesterday's sealed watch (${woS.name}): ${woS.dPct > 0 ? "▲" : woS.dPct < 0 ? "▼" : "·"} ${Math.abs(woS.dPct)}% since. We keep our own score.`
  : null;
const newSignals = (div.rows || []).filter(r => r.signal && !__blk.blocked(r.id) && !(state.sentSignals || []).includes(r.id));

const embed = {
  username: "Catch'em Morning Pulse",
  embeds: [{
    title: six ? `⚡ Catch'em Sealed Index: ${six.level}${six.ddPct != null ? ` (${six.ddPct > 0 ? "▲" : "▼"} ${Math.abs(six.ddPct)}%)` : ""}` : "⚡ Morning Pulse",
    description: [
      six ? `${six.constituents} sealed products · breadth ▲${six.breadth.up} ▼${six.breadth.down}` : null,
      "", "**🎯 The Daily Three**", ...lines,
      outcomeLine ? `\n**📊 Track record**\n${outcomeLine}` : null,
      roh ? `\n**🗳 Rip or Hold?**\n${roh.question}` : null,
      newSignals.length ? `\n**⚡ New gaps flagged:** ${newSignals.slice(0, 3).map(r => `${r.name} (${r.spreadPct > 0 ? "+" : ""}${r.spreadPct}%)`).join(" · ")}` : null,
    ].filter(x => x !== null).join("\n"),
    color: 0x36d399,
    footer: { text: `catchemtcg.com · ${today} · VERIFIED = measured, READ = our take` },
  }],
};
await writeFile(join(ROOT, "research/pulse/discord-embed-preview.json"), JSON.stringify(embed, null, 1));
console.log("✓ embed preview written (research/pulse/discord-embed-preview.json)");

async function post(url, tag) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(embed) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    console.log(`✓ posted → ${tag}`);
    return true;
  } catch (e) { console.log(`✗ ${tag}: ${e.message}`); return false; }
}

let posted = 0;
if (process.env.DISCORD_WEBHOOK_URL) { if (await post(process.env.DISCORD_WEBHOOK_URL, "house #alerts")) posted++; }
else console.log("house webhook: disarmed — no DISCORD_WEBHOOK_URL");

let creatorHooks = [];
try { creatorHooks = JSON.parse(process.env.CREATOR_WEBHOOKS_JSON || "{}").hooks || []; } catch {}
if (creatorHooks.length) {
  state.mutedHooks = state.mutedHooks || {};
  for (const h of creatorHooks.slice(0, 50)) { // cap
    if ((state.mutedHooks[h.id] || 0) >= 3) { console.log(`· ${h.id}: muted (3 failures)`); continue; }
    const ok = await post(h.url, `creator:${h.id}`);
    state.mutedHooks[h.id] = ok ? 0 : (state.mutedHooks[h.id] || 0) + 1;
    if (ok) posted++;
  }
} else console.log("creator network: disarmed — no CREATOR_WEBHOOKS_JSON");

state.sentSignals = [...new Set([...(state.sentSignals || []), ...newSignals.map(r => r.id)])].slice(-500);
await writeFile(join(ROOT, "data/alerts-state.json"), JSON.stringify(state, null, 1));
await (await import("./heartbeat.mjs")).beat("discord");
console.log(`done · destinations posted: ${posted}`);
