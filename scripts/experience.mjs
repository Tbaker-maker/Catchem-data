// experience.mjs — is this pleasant to use, and is there a reason to come back?
//
// Every other check asks whether the app is CORRECT. None asks whether it is
// good to use. This one does — for the half that can be measured.
//
// WHAT IT WILL NOT DO: judge whether something looks good. Chat cannot see the
// app, and an agent guessing at aesthetics would be the exact failure the
// No-Guessing Law exists to stop. So this measures STRUCTURE — density, depth,
// what changes daily, where a first-time visitor meets a wall — and hands the
// looking to whoever has eyes, with specific questions instead of "review the
// design", which is a request nobody can act on.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const R = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return null; } };

const app = await R("../catchem-app/src/Ticker.jsx") ?? await R("src/Ticker.jsx") ?? "";
const feed = await J("research/pulse/pulse-feed.json") ?? {};
const der = await J("data/derived-insights.json") ?? {};

const findings = [];
const F = (lane, observation, why, fix) => findings.push({ lane, observation, why, fix, confidence: "MEASURED" });   // counted from source and feed; the LOOKING is routed to human eyes separately

// ── 1 · DENSITY: how much is asked of the eye before anything is understood ──
{
  const sections = [...app.matchAll(/tk-sec">([^<{]{2,40})/g)].map(m => m[1].trim());
  if (sections.length > 8)
    F("simplicity", `The Today screen carries ${sections.length} sections: ${sections.slice(0, 6).join(", ")}…`,
      "Every section is a decision the reader has to make about whether to keep reading. Past about six, a page stops being scanned and starts being skipped.",
      "Rank them by how often somebody would act on each, and move the bottom third behind a tap. Nothing is deleted — it stops competing.");
  const words = (feed.disclosure ?? "").split(/\s+/).length + (feed.shippingNote ?? "").split(/\s+/).length;
  if (words > 60)
    F("simplicity", `${words} words of disclosure and method sit in the feed's top-level copy.`,
      "Honesty text earns trust on the page it explains, and costs attention everywhere else.",
      "Keep one line on the surface and put the rest behind the methodology link that already exists.");
}

// ── 2 · RETENTION: is there a reason to open this tomorrow? ─────────────────
{
  const changesDaily = [];
  if (der.dailyThree) changesDaily.push("the Daily Three");
  if (feed.didYouKnow) changesDaily.push("a fact");
  if ((der.supplyShifts ?? []).length) changesDaily.push("shelf moves");
  if (der.watchOutcomes) changesDaily.push("yesterday's picks revisited");
  if (der.ripOrHold) changesDaily.push("Rip or Hold");
  F("retention", `${changesDaily.length} things visibly change day to day: ${changesDaily.join(", ")}.`,
    "A page that looks the same twice is a page nobody opens twice. This is the single strongest lever on daily return, and it costs nothing because the data already changes.",
    changesDaily.length >= 4
      ? "Good coverage — the gap is that a returning reader cannot TELL at a glance what is new since yesterday."
      : "Surface more of what already changes overnight; the data moves whether or not the page shows it.");

  const marksNew = /new since|since yesterday|NEW\b/i.test(app);
  if (!marksNew)
    F("retention", "Nothing marks what changed since the reader's last visit.",
      "Returning readers re-scan the whole page to find the new part, and most will not. The single cheapest retention feature is a mark that says 'this is new'.",
      "Store the last-visit date in localStorage and put a quiet dot on anything that changed since. No backend, no account.");

  const hasStreak = /streak|day \d+ of/i.test(app + JSON.stringify(feed));
  if (!hasStreak)
    F("retention", "Neither side's streak is visible — how long we have published, or how long they have shown up.",
      "A visible run turns a page into a habit for both parties, and it is the one number that grows without any market moving.",
      "Show 'day N of publishing this' and, once it exists, a quiet personal streak. Costs one counter.");
}

// ── 3 · EASE: how far is a first-time visitor from something useful? ────────
{
  const firstNumber = app.indexOf("SEALED INDEX") >= 0 || app.includes("sealedIndex");
  F("ease of use", firstNumber ? "A number appears above the fold on Today." : "No number appears before the reader scrolls.",
    "The bar is that a stranger sees something useful without acting. Every tap before value is a place they leave.",
    firstNumber ? "Holds — check on a 390px screen that it is still above the fold with the banner and nav present." : "Move a real figure to the top.");

  const gates = (app.match(/Sign in|Log in|Create account|Subscribe to (see|view)/gi) ?? []).length;
  F("ease of use", gates ? `${gates} place(s) ask for something before showing something.` : "Nothing is gated — every instrument is readable immediately.",
    "Free-core is the doctrine and it is also the retention strategy: the app has to be useful before anyone owes us anything.",
    gates ? "Remove the gate or move it after the value." : "Holds. Keep it that way as the Discord unlock arrives — unlock depth, never truth.");

  const tools = (app.match(/openTool\(/g) ?? []).length;
  if (tools > 6)
    F("ease of use", `${tools} tool entry points exist.`,
      "A toolbox with everything visible at once is harder to use than one with the three things you need today.",
      "Lead with the three most-used and let the rest live one tap deeper in the Tools hub.");
}

// ── 4 · EASY ON THE EYES: the parts that are countable ─────────────────────
{
  const accents = new Set((app.match(/var\(--(green|blue|purple|gold|red)\)/g) ?? []).map(s => s));
  if (accents.size > 3)
    F("visual calm", `${accents.size} accent colours appear on the same surface.`,
      "Our own rule is one accent per surface. Colour is supposed to carry information; past two or three it becomes decoration and the eye stops trusting it.",
      "Reserve green for positive, red for negative, and let mode accent everything else. Gold stays a highlight, never a third voice.");

  const emoji = (app.match(/[\u{1F300}-\u{1FAFF}]/gu) ?? []).length;
  if (emoji > 12)
    F("visual calm", `${emoji} emoji in the interface.`,
      "A few give warmth. Many make a data product read as a chat window, and they are the first thing that looks dated in a year.",
      "Keep them for section headers and the ELI5 lollipop; drop them from anything carrying a number.");

  const hardcodedHex = new Set((app.match(/#[0-9a-fA-F]{6}/g) ?? []));
  if (hardcodedHex.size > 6)
    F("visual calm", `${hardcodedHex.size} hard-coded colours bypass the token system.`,
      "Every one is a place the app can drift away from the site, which is the seam a visitor feels without being able to name.",
      "Route them through tokens.css so a change on the site reaches the app automatically.");
}

// ── 4b · ADJACENCY: things that touch are read as related ─────────────────
// A grading-premium strip sat flush under the Sealed Index and read as a
// caption on it, because that is what proximity means to a reader. Every
// number on the page was correct and the page still looked sloppy. This is
// the cheapest class of design bug to create and the hardest to notice from
// inside, because whoever placed it already knows they are different things.
{
  // Instruments that measure DIFFERENT markets must not sit adjacent without a
  // label saying so. Sealed products and graded singles are the clearest pair.
  const MARKETS = { sealed: /sealedIndex|eraIndexes|Board/, singles: /Grading|graded|rawIndex|slab/i };
  const seq = [...app.matchAll(/key="(idx|lead[A-Za-z]+)"/g)].map(m => m[1]);
  const marketOf = (k) => /Graded|Raw/.test(k) ? "singles" : "sealed";
  for (let i = 1; i < seq.length; i++) {
    if (marketOf(seq[i]) !== marketOf(seq[i - 1])) {
      const labelled = new RegExp(`key="${seq[i]}"[\\s\\S]{0,400}?(different market|SINGLE CARDS|not the same)`, "i").test(app);
      if (!labelled)
        F("adjacency", `${seq[i]} sits directly after ${seq[i - 1]}, and they measure different markets.`,
          "Proximity IS a claim. Two instruments touching are read as one, and a reader who thinks the sealed index measures graded singles has been misled by layout rather than by a number.",
          "Label the boundary, or separate them. One line naming the market costs nothing and removes the ambiguity entirely.", "cc");
    }
  }
}

// ── 5 · WHAT ONLY EYES CAN ANSWER — handed over, specifically ──────────────
const forHumanEyes = [
  "On a 390px phone, how many times must you scroll before the first number you would act on?",
  "Cold cache, mobile data: how long until anything readable appears? Anything over three seconds reads as broken.",
  "Do the three Daily Three cards look like siblings, or like three different designs sharing a row?",
  "Is the index the first thing the eye lands on, or does something louder win?",
  "Squint at Today. Which three things stand out? Are they the three that matter?",
  "Does anything look like an advertisement, a warning, or an error when it is none of those?",
  "Is there anywhere a first-time visitor would not know what to do next?",
  "Does the app feel like the same company as the site, or a cousin of it?",
];

const out = { generatedAt: new Date().toISOString(),
  scope: "Measures structure, density, retention hooks and countable visual choices. It does NOT judge how anything looks — chat cannot see the app, and guessing at aesthetics is the failure the No-Guessing Law exists to stop.",
  findings, forHumanEyes,
  note: "The questions above are for whoever has eyes. They are deliberately specific: 'review the design' is a request nobody can act on." };
await writeFile(join(ROOT, "research/pulse/experience-report.json"), JSON.stringify(out, null, 1));
console.log(`✓ experience: ${findings.length} measurable finding(s) · ${forHumanEyes.length} questions routed to human eyes`);
for (const f of findings) console.log(`  ${f.lane.padEnd(14)} ${f.observation}`);
