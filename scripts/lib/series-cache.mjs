// One history map per run. The second call returns the map already built.

const built = new Map();

export function loadSeriesOnce(key, load) {
  if (built.has(key)) return { series: built.get(key), cached: true, ms: 0 };
  const started = Date.now();
  const series = load();
  built.set(key, series);
  return { series, cached: false, ms: Date.now() - started };
}

export function clearSeriesCache() {
  built.clear();
}
