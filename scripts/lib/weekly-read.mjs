// Fixed weekly outline. Sections stay in this order even when a source is missing.
const BANNED = /\b(buy|hold|plays|targets|bullish|calls|picks|floor|support line|crash)\b/i;

export function weeklyRead({ asOf, heat = [], repeat = null, receipts = null, sets = [] }) {
  const movers = (heat || []).slice(0, 6).map((p) => ({
    id: p.id,
    name: p.name,
    heat: p.label || "Steady",
  }));
  const keeps = {
    sealed: (repeat?.sealed?.rows || []).slice(0, 5).map(brief),
    singles: (repeat?.singles?.rows || []).slice(0, 5).map(brief),
    status: repeat?.status || "building history",
  };
  const lines = (sets || []).slice(0, 4).map((s) => ({
    set: s.set,
    sealed: s.sealed?.status === "live" ? s.sealed.level : null,
    sealedStatus: s.sealed?.status || "building history",
    chase: s.chase?.status === "live" ? s.chase.level : null,
    chaseStatus: s.chase?.status || "building history",
    chaseNames: s.chase?.names || [],
  }));
  const doc = {
    asOf,
    title: `Weekly Read — ${asOf}`,
    sections: ["heat", "keepsShowingUp", "readsWeTracked", "sealedAndChase"],
    heat: movers,
    keepsShowingUp: keeps,
    readsWeTracked: receipts || { tracked: 0, graded: 0, hits: 0, misses: 0, hitRate: null, biggestHits: [], biggestMisses: [], open: 0 },
    sealedAndChase: lines,
  };
  return doc;
}

function brief(r) {
  return { id: r.id, name: r.name, days7: r.days7, days30: r.days30, days90: r.days90, streak: r.streak, lastSeen: r.lastSeen };
}

export function weeklyMarkdown(doc) {
  const heat = doc.heat.length
    ? doc.heat.map((p) => `- ${p.name} — ${p.heat}`).join("\n")
    : "- No heat list in this run.";
  const side = (rows, label) => rows.length
    ? rows.map((r) => `- ${r.name} — ${r.days7} in 7 days, ${r.days30} in 30, streak ${r.streak}`).join("\n")
    : `- ${label}: building history.`;
  const rec = doc.readsWeTracked;
  const both = [
    ...(rec.biggestHits || []).map((r) => `- Hit — ${r.name} (${r.kind}) ${r.movePct == null ? "" : r.movePct + "%"}`.trim()),
    ...(rec.biggestMisses || []).map((r) => `- Miss — ${r.name} (${r.kind}) ${r.movePct == null ? "" : r.movePct + "%"}`.trim()),
  ];
  const lines = doc.sealedAndChase.length
    ? doc.sealedAndChase.map((s) => `- ${s.set}: sealed ${s.sealedStatus === "live" ? s.sealed : "building history"}; chase ${s.chaseStatus === "live" ? s.chase : "building history"}${s.chaseNames?.length ? ` (${s.chaseNames.join(", ")})` : ""}`).join("\n")
    : "- Set lines are not in this run.";
  const md = `# ${doc.title}

Video outline. Same four parts every week. Say "reads we tracked". Do not say a name is a play or a target.

## 1. Heat
${heat}

## 2. Keeps showing up
Status: ${doc.keepsShowingUp.status}

Sealed
${side(doc.keepsShowingUp.sealed, "Sealed")}

Singles
${side(doc.keepsShowingUp.singles, "Singles")}

## 3. Reads we tracked
Tracked ${rec.tracked}. Graded ${rec.graded}. Hits ${rec.hits}. Misses ${rec.misses}. Hit rate ${rec.hitRate == null ? "not enough yet" : rec.hitRate + "%"}.

${both.length ? both.join("\n") : "- Nothing graded yet. The misses will sit in this list with the hits."}

## 4. Sealed line and chase line
These are two lines. They are not one number.
${lines}
`;
  if (BANNED.test(md)) throw new Error("weekly outline used a banned word");
  return md;
}
