// Fixed weekly outline. Public file only. Track record lives in catchem-data-private.
import { banGuard } from "./copy-rules.mjs";
import { BOARD_MAX, POST_CAP, capPost } from "./second-library.mjs";

const BANNED = banGuard("weekly outline");
// Track-record wording stays out of the outline. Style rule, not a money rule.
const TRACK_WORDS = /(calls|picks|hit rate|hits|misses)/i;

export function dedupeNames(names) {
  const seen = new Set();
  const out = [];
  for (const name of names || []) {
    const key = String(name || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function weeklyRead({ asOf, heat = [], repeat = null, sets = [] }) {
  const movers = (heat || []).slice(0, Math.min(6, BOARD_MAX)).map((p) => ({
    id: p.id,
    name: p.name,
    heat: p.label || "Steady",
  }));
  const keeps = {
    sealed: (repeat?.sealed?.rows || []).slice(0, 5).map(brief).filter((r) => r.days7 > 0),
    singles: (repeat?.singles?.rows || []).slice(0, 5).map(brief).filter((r) => r.days7 > 0),
    status: repeat?.status || "building history",
  };
  const lines = (sets || []).slice(0, 4).map((s) => ({
    set: s.set,
    sealed: s.sealed?.status === "live" ? s.sealed.level : null,
    sealedStatus: s.sealed?.status || "building history",
    chase: s.chase?.status === "live" ? s.chase.level : null,
    chaseStatus: s.chase?.status || "building history",
    chaseNames: dedupeNames(s.chase?.names || []),
  }));
  const sections = [];
  if (movers.length >= 3) sections.push("heat");
  if (keeps.sealed.length >= 3 || keeps.singles.length >= 3) sections.push("keepsShowingUp");
  if (lines.length >= 3) sections.push("sealedAndChase");
  return {
    asOf,
    title: `Weekly Read, ${asOf}`,
    sections,
    heat: movers,
    keepsShowingUp: keeps,
    sealedAndChase: lines,
  };
}

function brief(r) {
  return { id: r.id, name: r.name, days7: r.days7, days30: r.days30, days90: r.days90, streak: r.streak, lastSeen: r.lastSeen };
}

export function weeklyMarkdown(doc) {
  const parts = [`# ${doc.title}`, "", "Video outline. Same parts every week. Do not say a name is a move to make."];
  if (doc.heat.length >= 3) {
    parts.push("", "## Heat", doc.heat.map((p) => `- ${p.name}: ${p.heat}`).join("\n"));
  }
  const sealed = (doc.keepsShowingUp.sealed || []).filter((r) => r.days7 > 0);
  const singles = (doc.keepsShowingUp.singles || []).filter((r) => r.days7 > 0);
  if (sealed.length >= 3 || singles.length >= 3) {
    parts.push("", "## Keeps showing up", `Status: ${doc.keepsShowingUp.status}`);
    if (sealed.length >= 3) parts.push("", "Sealed", sealed.map((r) => `- ${r.name}: ${r.days7} in 7 days, ${r.days30} in 30, streak ${r.streak}`).join("\n"));
    if (singles.length >= 3) parts.push("", "Singles", singles.map((r) => `- ${r.name}: ${r.days7} in 7 days, ${r.days30} in 30, streak ${r.streak}`).join("\n"));
  }
  if (doc.sealedAndChase.length >= 3) {
    const lines = doc.sealedAndChase.map((s) => {
      const names = dedupeNames(s.chaseNames);
      return `- ${s.set}: sealed ${s.sealedStatus === "live" ? s.sealed : "building history"}; chase ${s.chaseStatus === "live" ? s.chase : "building history"}${names.length ? ` (${names.join(", ")})` : ""}`;
    }).join("\n");
    parts.push("", "## Sealed line and chase line", "These are two lines. They are not one number.", lines);
  }
  const md = parts.join("\n") + "\n";
  if (BANNED.test(md) || TRACK_WORDS.test(md)) throw new Error("weekly outline broke a copy rule (see the [copy-rules] line above)");
  if (md.includes("\u2014") || md.includes("\u2013")) throw new Error("weekly outline used a dash");
  const capped = capPost(md, POST_CAP);
  if (capped.length > POST_CAP) throw new Error("weekly post is over 1800 characters");
  return capped;
}
