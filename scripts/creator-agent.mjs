// creator-agent.mjs — can somebody actually RECORD with this?
//
// The hire brief (Tyler, 2026-08-23): make the creator portal a cheat code.
// If using us makes a video obviously better and obviously easier, creators
// market us for free — and that is the only marketing a solo founder can
// afford.
//
// SO THE QUESTION IS NOT "do we produce creator assets". We produce plenty.
// It is: could a person open this, hit record within two minutes, and sound
// like the most informed voice in the hobby without pausing to look anything
// up? Every pause is a cut. Every cut is friction. Enough friction and they
// go back to reading someone else's tweet on camera.
//
// A creator's four real problems, and whether we solve them:
//   1. WHAT DO I TALK ABOUT TODAY?      — do we hand them a subject?
//   2. WHAT DO I SAY?                   — is there a spine, or just a number?
//   3. WHAT'S ON SCREEN WHILE I TALK?   — can the visual run without clicking?
//   4. AM I ABOUT TO BE WRONG?          — is the claim sourced and hedged?
// We can answer all four. The question this agent asks is whether they are
// answered TOGETHER, in one place, without assembly.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const R = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return null; } };

const bank = await J("research/pulse/post-bank.json");
const queue = await J("research/pulse/social-queue.json");
const artist = await J("research/pulse/artist-angles.json");
const rst = await J("research/pulse/rip-sell-trade.json");
const der = await J("data/derived-insights.json") ?? {};
const app = await R("../catchem-app/src/Ticker.jsx") ?? "";
const cards = (await readdir(join(ROOT, "research/pulse/cards")).catch(() => [])).filter(f => f.endsWith(".png"));

const findings = [];
const F = (need, observation, why, fix, owner) => findings.push({ need, observation, why, fix, owner });

// ── 1 · WHAT DO I TALK ABOUT TODAY? ────────────────────────────────────────
{
  const subjects = (bank?.ideas ?? []).length + (artist?.angles ?? []).length + ((rst?.rows ?? []).length ? 1 : 0);
  if (subjects >= 6)
    F("a subject", `${subjects} distinct angles are ready each morning.`,
      "This one is solved. A creator's worst hour is the one spent deciding what to make.",
      "Hold it. The risk now is the opposite — too many choices is its own paralysis, so lead with three and let the rest be a list.", "cc");
  else
    F("a subject", `Only ${subjects} angles available today.`, "Thin days are when a creator goes elsewhere for material.",
      "Widen the generator, or say plainly that today is quiet — an honest quiet day beats a manufactured story.", "chat");
}

// ── 2 · WHAT DO I SAY? Is there a spine, or just a number? ─────────────────
{
  const withScript = (bank?.ideas ?? []).filter(i => i.platforms?.short_script || i.platforms?.youtube_hook).length;
  const total = (bank?.ideas ?? []).length;
  if (total && withScript < total)
    F("a spine", `${total - withScript} of ${total} angles ship without a spoken script or hook.`,
      "A written post is not a video. Reading a tweet aloud is exactly the content creators already make badly, and it is what we would be replacing.",
      "Every angle needs a 15-second spoken open and a 45-second body. Written for the ear — short sentences, one number at a time.", "chat");
  const hasWhy = (bank?.ideas ?? []).filter(i => i.why || i.coaching).length;
  if (total && hasWhy < total)
    F("a spine", `${total - hasWhy} angles ship without the "why this works" line.`,
      "The coaching is what turns a script into a skill. A creator who understands why an angle lands can write the next one alone — that is what makes it a cheat code rather than a crutch.",
      "Carry the reasoning on every angle, not just some.", "chat");
}

// ── 3 · WHAT IS ON SCREEN WHILE I TALK? ────────────────────────────────────
{
  const overlay = /overlay/i.test(app);
  const autoAdvance = /setInterval|autoplay|advance/i.test(app);
  if (overlay && !autoAdvance)
    F("a visual that runs itself", "The overlay exists but appears to need clicking to change what it shows.",
      "A creator holding a camera cannot also drive a browser. Every click is a cut, and cuts are where enthusiasm dies in the edit.",
      "Give the overlay a hands-free mode: a timed sequence through the day's numbers, and a keyboard shortcut for advance so it can be driven from a clicker.", "cc");
  if (!cards.length)
    F("a visual that runs itself", "No cards minted today.", "A creator with no image has to build one, and most will not.", "chat");
  else
    F("a visual that runs itself", `${cards.length} card images minted today.`,
      "Enough for a thumbnail, an insert and a closing frame.",
      "The gap is that they are files in a repo. A creator needs them one tap from the angle they picked, not from a folder.", "cc");
}

// ── 4 · AM I ABOUT TO BE WRONG? ────────────────────────────────────────────
{
  const chipped = (bank?.ideas ?? []).filter(i => i.chip).length;
  const total = (bank?.ideas ?? []).length;
  if (total && chipped < total)
    F("not being wrong", `${total - chipped} angles carry no provenance chip.`,
      "A creator repeating our number inherits our credibility and our risk. If they cannot see whether a figure is measured or interpreted, they will state a read as a fact on camera and it will be our fault.",
      "Every angle carries VERIFIED or READ, and the script says the hedge out loud rather than relying on a chip nobody hears in audio.", "chat");
  const sourced = (artist?.angles ?? []).filter(a => (a.sources ?? []).length).length;
  if ((artist?.angles ?? []).length && sourced === (artist?.angles ?? []).length)
    F("not being wrong", "Artist angles all carry their sources.",
      "This is the part that makes a creator trust us twice — the second time is what matters.",
      "Extend the same to every angle in the post bank, and put the source in the script so it can be said aloud.", "chat");
}

// ── 5 · THE CHEAT CODE TEST ────────────────────────────────────────────────
{
  // Could one screen carry everything a recording needs? Right now the pieces
  // live in four files and a folder.
  const piecesInOnePlace = /post-bank|studio\/posts/.test(app) && /overlay/.test(app) && cards.length;
  F("the cheat code", piecesInOnePlace
      ? "The pieces exist and are reachable, but a creator still assembles them: pick an angle here, find the card there, open the overlay separately."
      : "The pieces are not assembled anywhere a creator can reach in one go.",
    "The cheat code is not having good assets. It is not having to think. The moment somebody has to hunt for a matching image, they are editing instead of recording.",
    "ONE screen per angle: the subject, the spoken open, the numbers as a lower-third, the card ready to download, the source line, and a record checklist. Pick an angle, hit record.", "cc");

  F("the cheat code", "Nothing tells a creator how a piece performed after they made it.",
    "Creators repeat what works. If we never close that loop they learn nothing from us and we learn nothing from them, which is the difference between a tool and a partner.",
    "Ask one question after publication — did this land — and keep the answers. Even a yes/no on twenty videos would tell us which angles are worth generating.", "tyler");
}

const out = { generatedAt: new Date().toISOString(),
  brief: "Make the creator portal a cheat code: if using us makes a video obviously better and obviously easier, creators market us for free.",
  test: "Could somebody open this, hit record within two minutes, and sound like the most informed voice in the hobby without pausing to look anything up? Every pause is a cut.",
  findings,
  byOwner: { chat: findings.filter(f => f.owner === "chat").length, cc: findings.filter(f => f.owner === "cc").length, tyler: findings.filter(f => f.owner === "tyler").length } };
await writeFile(join(ROOT, "research/pulse/creator-report.json"), JSON.stringify(out, null, 1));
console.log(`✓ creator agent: ${findings.length} finding(s) — ${out.byOwner.chat} for chat, ${out.byOwner.cc} for CC, ${out.byOwner.tyler} for Tyler`);
for (const f of findings) console.log(`  [${String(f.owner).padEnd(5)}] ${f.need.padEnd(24)} ${f.observation}`);
