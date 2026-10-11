  const md = weeklyMarkdown(doc);
  t("weekly outline has the kept sections", md.includes("## Keeps showing up") && md.includes("## Sealed line and chase line"));
  t("weekly outline drops the track record", !md.includes("Hit rate") && !md.includes("Hits") && !md.includes("Misses") && !doc.readsWeTracked);
  t("weekly outline drops a short heat list and a zero-day single", !md.includes("## Heat") && !md.includes("Zero"));
  t("weekly outline dedupes chase names", doc.sealedAndChase[0].chaseNames.length === 1);
  t("weekly title has no em dash", doc.title === "Weekly Read, 2026-09-26" && !md.includes("\u2014"));
  let threw = false;