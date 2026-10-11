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
  if (BANNED.test(md)) throw new Error("weekly outline used a banned word");
  if (md.includes("\u2014") || md.includes("\u2013")) throw new Error("weekly outline used a dash");
  const capped = capPost(md, POST_CAP);
  if (capped.length > POST_CAP) throw new Error("weekly post is over 1800 characters");
  return capped;
}