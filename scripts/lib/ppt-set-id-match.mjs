// Match our set slugs that have no PPT set id to provider set names already on file.
// No network. A weak name stays out of bySlug.

const STOP = new Set(["the", "and", "of", "a", "collection", "promo", "promos", "pokemon"]);

export function normSet(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/pok[eé]mon/g, "pokemon")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(name) {
  return normSet(name).split(" ").filter((word) => word && !STOP.has(word) && word.length > 2);
}

function yearOf(name) {
  const hit = String(name || "").match(/\b(?:19|20)\d{2}\b/);
  return hit ? hit[0] : null;
}

export function matchMissingSets(unmatched, providerSets, cardCounts = {}) {
  const unused = providerSets.filter((row) => row?.id && row?.name);
  const mapped = [];
  const review = [];
  const still = [];
  const taken = new Set();

  for (const our of unmatched) {
    if (/mcdonald/.test(normSet(our.name))) {
      const year = yearOf(our.name);
      const hits = year
        ? unused.filter((row) => /mcdonald/.test(normSet(row.name)) && normSet(row.name).includes(year) && !taken.has(row.id))
        : [];
      if (hits.length === 1) {
        taken.add(hits[0].id);
        mapped.push(entry(our, hits[0], "mcdonald year"));
        continue;
      }
      const want = cardCounts[our.slug];
      const candidates = unused
        .filter((row) => /mcdonald/.test(normSet(row.name)) && !taken.has(row.id))
        .filter((row) => want == null || row.cardCount === want)
        .map(publicProvider);
      if (!candidates.length) {
        still.push({ slug: our.slug, name: our.name });
        continue;
      }
      review.push({
        slug: our.slug,
        name: our.name,
        reason: hits.length > 1 ? "more than one McDonald's set for that year" : "no McDonald's provider set names this year",
        candidates,
      });
      continue;
    }

    const need = tokens(our.name);
    const hits = [];
    for (const row of unused) {
      if (taken.has(row.id)) continue;
      const have = new Set(normSet(row.name).split(" "));
      if (!need.length || !need.every((word) => have.has(word))) continue;
      const combined = unmatched
        .filter((other) => other.slug !== our.slug)
        .filter((other) => tokens(other.name).some((word) => have.has(word) && !need.includes(word)))
        .map((other) => other.slug);
      hits.push({ row, combined });
    }
    if (hits.length === 1 && hits[0].combined.length === 0) {
      taken.add(hits[0].row.id);
      mapped.push(entry(our, hits[0].row, "provider name"));
      continue;
    }
    if (hits.length) {
      review.push({
        slug: our.slug,
        name: our.name,
        reason: hits.some((hit) => hit.combined.length) ? "one provider set covers more than one of our slugs" : "more than one provider set",
        candidates: hits.map((hit) => ({ ...publicProvider(hit.row), alsoCovers: hit.combined })),
      });
      continue;
    }
    still.push({ slug: our.slug, name: our.name });
  }

  return { mapped, review, unmatched: still };
}

function entry(our, provider, matchedBy) {
  return {
    slug: our.slug,
    ourName: our.name,
    pptSetId: provider.id,
    pptName: provider.name,
    cardCount: provider.cardCount,
    matchedBy,
  };
}

function publicProvider(row) {
  return { pptSetId: row.id, name: row.name, cardCount: row.cardCount };
}

export function applySetMap(setMap, mapped) {
  const bySlug = { ...setMap.bySlug };
  const used = new Set(Object.values(bySlug).map((row) => row.pptSetId));
  const added = [];
  for (const row of mapped) {
    if (bySlug[row.slug] || used.has(row.pptSetId)) continue;
    bySlug[row.slug] = {
      pptSetId: row.pptSetId,
      pptName: row.pptName,
      ourName: row.ourName,
      cardCount: row.cardCount,
      matchedBy: row.matchedBy,
    };
    used.add(row.pptSetId);
    added.push(row.slug);
  }
  const unmatched = (setMap.unmatched || []).filter((row) => !bySlug[row.slug]);
  const providerOnly = (setMap.providerOnly || []).filter((row) => !used.has(row.pptSetId));
  return {
    ...setMap,
    matched: Object.keys(bySlug).length,
    unmatchedCount: unmatched.length,
    providerOnlyCount: providerOnly.length,
    bySlug,
    unmatched,
    providerOnly,
    lastIdMatch: {
      asOf: "2026-09-26",
      slugs: [...new Set([...(setMap.lastIdMatch?.slugs || []), ...added])],
      note: "Provider set ids already on file. No request was sent. A slug is added only when the provider name matches.",
    },
  };
}
