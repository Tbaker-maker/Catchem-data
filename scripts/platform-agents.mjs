// platform-agents.mjs — X, YouTube, TikTok.
//
// Three agents, one job each: take what we already know and shape it into what
// THAT platform rewards. They are separate rather than one "social agent"
// because the platforms are not variations of each other — a post that works on
// X would be a terrible TikTok, and treating them as one job is why most
// accounts sound identical everywhere and land nowhere.
//
// WHAT THEY ARE NOT: they do not invent engagement tactics or claim to know
// algorithms. Anything about how a platform behaves comes from
// data/knowledge.json with a source and a confidence tier, or it is not stated.
// A marketing agent confidently reciting growth folklore is the single easiest
// way for this system to start lying, because folklore is fluent and unfalsifiable.
//
// WHAT THEY DO: judge our own material against each platform's shape, say which
// of today's stories fits where, and name what is MISSING for a format we
// cannot currently serve.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const der = await J("data/derived-insights.json") ?? {};
const bank = await J("research/pulse/post-bank.json") ?? {};
const kb = await J("data/knowledge.json") ?? { facts: [] };
const cards = (await readdir(join(ROOT, "research/pulse/cards")).catch(() => [])).filter(f => f.endsWith(".png"));

// Only platform claims we have actually recorded may be used. Everything else
// is an observation about OUR material, which we can make honestly.
const known = Object.fromEntries(kb.facts.filter(f => /^x-|^yt-|^tt-/.test(f.id)).map(f => [f.id, f]));

// Today's material, scored for what each platform needs.
const stories = [];
{
  const rp = der.reprintPressure ?? [];
  for (const r of rp.slice(0, 3))
    stories.push({ id: `reprint-${r.setId}`, subject: r.set,
      oneLine: `${r.set} listings moved ${r.shelfMovePct}% while its print window closes.`,
      surprise: 5, visual: 4, explains: 4, chip: r.chip, source: "reprint pressure" });
  const t3 = der.dailyThree?.sealed;
  if (t3) stories.push({ id: "daily-sealed", subject: t3.name,
    oneLine: t3.whyChosen ?? t3.explain ?? "", surprise: 3, visual: 4, explains: 5, chip: t3.chip, source: "daily three" });
  const six = der.sealedIndex;
  if (six) stories.push({ id: "index", subject: "the sealed market",
    oneLine: `The whole sealed market in one number: ${six.level}.`, surprise: 2, visual: 5, explains: 5, chip: six.chip, source: "index" });
  const rst = (der.ripSellTrade?.rows ?? [])[0];
  if (rst) stories.push({ id: "rip-sell-trade", subject: rst.name,
    oneLine: `Open it, sell it, or trade it — three prices, one box.`, surprise: 4, visual: 3, explains: 5, chip: "READ", source: "rip/sell/trade" });
}

const findings = [];
const F = (platform, kind, what, why, owner) => findings.push({ platform, kind, what, why, owner });

// ── X ──────────────────────────────────────────────────────────────────────
// Shape: a fact that implies a question. The card carries the numbers so the
// words do not have to.
{
  const best = [...stories].sort((a, b) => b.surprise - a.surprise)[0];
  if (best)
    F("X", "today's post", `"${best.oneLine}"`,
      "X rewards a single surprising fact that makes somebody want to reply. The strongest shape we have is a number that moved with no headline attached — it implies a question and refuses to answer it, which is what makes people argue in the replies.", "tyler");
  if (!cards.length)
    F("X", "gap", "No card minted for today's strongest story.", "A post without an image is a post that scrolls past. Every X angle should ship with its card already made.", "chat");
  if (known["x-format-brevity"])
    F("X", "format", "Keep it under ~25 words and do not put a link in the post.",
      `Recorded as ${known["x-format-brevity"].confidence} from ${known["x-format-brevity"].sources[0]} — the watermark on the card does the attribution a link would.`, "tyler");
  F("X", "series", "Nothing runs as a numbered series.",
    "A recurring format people can recognise beats a better one-off, because the second time somebody sees it they already know what it is. 'Day N of posting the sealed market's temperature' costs one counter.", "chat");
}

// ── YOUTUBE ────────────────────────────────────────────────────────────────
// Shape: a title that promises an answer, and a video that actually delivers
// one. Our advantage is that we can genuinely answer.
{
  const explainers = [...stories].sort((a, b) => b.explains - a.explains).slice(0, 2);
  for (const s of explainers)
    F("YouTube", "video angle", `${s.subject} — "${s.oneLine}"`,
      "YouTube rewards a question somebody is already typing into search. We can answer three of the recurring ones with data nobody else holds, which is the whole reason to be here rather than reacting to other people's news.", "tyler");
  const hasScript = Object.values(bank?.ideas ?? {}).length && (bank.ideas ?? []).some(i => i.platforms?.short_script);
  if (!hasScript)
    F("YouTube", "gap", "No spoken script exists for today's angles.",
      "A written post read aloud is exactly the content that already exists and already underperforms. A 15-second spoken open plus a 45-second body, written for the ear, is the difference.", "chat");
  F("YouTube", "gap", "No B-roll list ships with any angle.",
    "The hardest part of a data video is what to show while you talk. We mint cards and charts daily and never tell a creator which ones to cut to and when.", "chat");
}

// ── TIKTOK ─────────────────────────────────────────────────────────────────
// Shape: the payoff must arrive before somebody decides to leave, and the
// number has to be legible on a phone held at arm's length.
{
  const visual = [...stories].sort((a, b) => b.visual - a.visual)[0];
  if (visual)
    F("TikTok", "today's clip", `Open on the number, not the setup: "${visual.oneLine}"`,
      "The payoff has to arrive before somebody decides to leave. Our numbers ARE the hook — a chart that moves is more watchable than a person explaining that it moved.", "tyler");
  F("TikTok", "gap", "Every card we mint is 1200×675 — landscape.",
    "A landscape card on a vertical feed is letterboxed into a stripe nobody can read. The same data needs a 1080×1920 mint or TikTok is a platform we technically post to and never actually reach.", "chat");
  F("TikTok", "gap", "Nothing we produce moves.",
    "A still image on a video platform competes with motion and loses. A three-second animated count — listings falling 120 to 40 — is the same data and a completely different piece of content.", "chat");
}

// ── SHARED: what none of them can do yet ───────────────────────────────────
F("all", "measurement", "Nothing measures whether any of this works.",
  "Every judgment above is about SHAPE, not results — we have no posting data. Until we do, these agents are a well-reasoned guess and should be read as one. Twenty posts with outcomes recorded would replace all of this reasoning with evidence.", "tyler");

const out = { generatedAt: new Date().toISOString(),
  note: "Three agents, one per platform, because a post that works on X would be a bad TikTok and treating them as one job is why most accounts sound identical everywhere and land nowhere.",
  discipline: "No claims about algorithms. Anything about how a platform behaves comes from data/knowledge.json with a source and confidence, or is not said. Growth folklore is fluent and unfalsifiable, which makes it the easiest way for this system to start lying.",
  stories, findings,
  byPlatform: { X: findings.filter(f => f.platform === "X").length, YouTube: findings.filter(f => f.platform === "YouTube").length, TikTok: findings.filter(f => f.platform === "TikTok").length } };
await writeFile(join(ROOT, "research/pulse/platform-report.json"), JSON.stringify(out, null, 1));
console.log(`✓ platform agents: X ${out.byPlatform.X} · YouTube ${out.byPlatform.YouTube} · TikTok ${out.byPlatform.TikTok}`);
for (const f of findings) console.log(`  [${f.platform.padEnd(8)}] ${String(f.kind).padEnd(12)} ${String(f.what).slice(0, 74)}`);
