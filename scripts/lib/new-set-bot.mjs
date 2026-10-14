// When a set or sealed product shows up that the registry has not seen,
// write its entry, queue logos and pull rates, and return a private flag.
// The first run only seeds the registry. It does not flag the whole catalogue.

export function setCodeFromLogo(logo) {
  const m = String(logo || "").match(/\/img\/([^/]+)\//);
  return m ? m[1] : "";
}

function fold(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function productsForSet(set, products) {
  const code = setCodeFromLogo(set.logo);
  const name = fold(set.name);
  return products.filter((p) => (code && p.setId === code) || (name && fold(p.set) === name));
}

export function entryForSet(set, products) {
  const list = productsForSet(set, products);
  return {
    kind: "set",
    setSlug: set.slug,
    setName: set.name,
    setCode: setCodeFromLogo(set.logo) || null,
    era: set.era || null,
    release: set.release || null,
    productList: list.map((p) => ({ id: p.id, name: p.name, subtype: p.subtype || null, setId: p.setId || null })),
  };
}

export function entryForProduct(product) {
  return {
    kind: "sealed-product",
    id: product.id,
    name: product.name,
    set: product.set || null,
    setId: product.setId || null,
    setCode: product.setId || null,
    subtype: product.subtype || null,
    release: product.release || null,
  };
}

export function planNewSets({ sets, products, registry, pullSlugs }) {
  const setList = sets?.sets || [];
  const prodList = Array.isArray(products) ? products : [];
  const knownSets = new Set(registry?.setSlugs || []);
  const knownProducts = new Set(registry?.productIds || []);
  const seeded = registry?.seeded === true && (knownSets.size > 0 || knownProducts.size > 0);
  const next = {
    seeded: true,
    asOf: registry?.asOf || null,
    setSlugs: [...new Set([...knownSets, ...setList.map((s) => s.slug).filter(Boolean)])].sort(),
    productIds: [...new Set([...knownProducts, ...prodList.map((p) => p.id).filter(Boolean)])].sort(),
  };
  if (!seeded) {
    return { seed: true, entries: [], logoQueue: [], pullQueue: [], flags: [], registry: next };
  }
  const havePull = pullSlugs instanceof Set ? pullSlugs : new Set(pullSlugs || []);
  const entries = [];
  const logoQueue = [];
  const pullQueue = [];
  const flags = [];
  const newSets = setList.filter((s) => s.slug && !knownSets.has(s.slug));
  const newSetCodes = new Set();
  for (const set of newSets) {
    const entry = entryForSet(set, prodList);
    entries.push(entry);
    newSetCodes.add(entry.setCode);
    logoQueue.push({
      setSlug: set.slug,
      setCode: entry.setCode,
      setName: set.name,
      reason: "New set. Queued for a logo. This file does not write an image.",
    });
    if (!havePull.has(set.slug)) {
      pullQueue.push({
        setSlug: set.slug,
        setCode: entry.setCode,
        setName: set.name,
        reason: "New set has no row in data/pull-rates.json.",
      });
    }
    flags.push({
      type: "new-set",
      setSlug: set.slug,
      setCode: entry.setCode,
      setName: set.name,
      era: set.era || null,
      release: set.release || null,
      products: entry.productList.length,
    });
  }
  for (const product of prodList) {
    if (!product.id || knownProducts.has(product.id)) continue;
    if (product.setId && newSetCodes.has(product.setId)) continue;
    const entry = entryForProduct(product);
    entries.push(entry);
    flags.push({
      type: "new-sealed-product",
      id: product.id,
      name: product.name,
      setId: product.setId || null,
      subtype: product.subtype || null,
    });
    const set = setList.find((s) => setCodeFromLogo(s.logo) === product.setId);
    if (set && !havePull.has(set.slug) && !pullQueue.some((q) => q.setSlug === set.slug)) {
      pullQueue.push({
        setSlug: set.slug,
        setCode: product.setId || null,
        setName: set.name,
        reason: "New sealed product and the set has no pull-rate row.",
      });
    }
  }
  return { seed: false, entries, logoQueue, pullQueue, flags, registry: next };
}
