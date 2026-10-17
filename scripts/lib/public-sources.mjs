// Every public file the site, the bot, or the newsletter reads.
// live + dateRequired: the nightly date and this file's date must be within 2 days.
// A file nothing rewrites is live:false and is not a nightly number.
// flag: a data/flags.json key. While that flag is false the file is not checked for freshness.

export const READERS = [
  { file: "research/assets/public/price-hold.json", readers: ["site"], writer: "scripts/build-price-hold.mjs", live: false, dateRequired: true, note: "Ids whose price is not a headline. No thresholds." },
  { file: "research/assets/public/condition-prices.json", readers: ["site"], writer: "scripts/build-condition-ladder.mjs", live: false, dateRequired: true, note: "Per printing, per condition. Empty until a TCGplayer row names the condition." },
  { file: "research/assets/public/movers.json", readers: ["site", "bot"], writer: "scripts/build-public-bundle.mjs", live: true, dateRequired: true },
  { file: "research/assets/public/accuracy.json", readers: ["site", "bot"], writer: "scripts/build-public-bundle.mjs", live: true, dateRequired: true },
  { file: "research/assets/public/counts.json", readers: ["site"], writer: "scripts/build-public-bundle.mjs", live: true, dateRequired: true },
  { file: "research/assets/public/sets.json", readers: ["site"], writer: "scripts/build-public-bundle.mjs", live: true, dateRequired: true },
  { file: "research/assets/public/artists.json", readers: ["site"], writer: "scripts/build-public-bundle.mjs", live: true, dateRequired: true },
  { file: "research/assets/public/indexes.json", readers: ["site"], writer: "scripts/build-public-bundle.mjs", live: true, dateRequired: true },
  { file: "research/assets/public/receipts.json", readers: ["site"], writer: "scripts/build-public-bundle.mjs", live: true, dateRequired: true },
  { file: "research/assets/public/track-record.json", readers: ["site"], writer: "scripts/write-track-record.mjs", live: true, dateRequired: true },
  { file: "research/assets/public/today.json", readers: ["site"], writer: "scripts/write-morning-card.mjs", live: true, dateRequired: true },
  { file: "research/assets/public/feed/supply-lead.json", readers: ["site"], writer: "scripts/write-supply-lead.mjs", flag: "supply.leadReads", live: true, dateRequired: true },
  { file: "research/assets/public/feed/set-value.json", readers: ["site"], writer: "scripts/write-set-value.mjs", flag: "set.valueReads", live: true, dateRequired: true },
  { file: "research/assets/public/search-lite.json", readers: ["site", "bot"], writer: "scripts/build-public-bundle.mjs", live: true, dateRequired: false, note: "The file is an array and has no date. The search page loads feed/search shards. This file stays for the editor and the bot." },
  { file: "research/assets/public/feed/facts.json", readers: ["site"], writer: "scripts/build-feed.mjs", live: true, dateRequired: false, note: "Keyed by product id. No top-level date." },
  { file: "research/assets/public/catalogue-images.json", readers: ["site"], writer: "scripts/build-card-images.mjs", live: false, dateRequired: false, note: "Catalogue paths. Not a nightly price file." },
  { file: "research/assets/public/redirects.json", readers: ["site"], writer: "scripts/build-public-bundle.mjs", live: false, dateRequired: false, note: "Rewritten with the bundle. No date field." },
  { file: "research/assets/public/set-logos.json", readers: ["site"], writer: "hand", live: false, dateRequired: false },
  { file: "research/assets/public/search-rank.mjs", readers: ["site"], writer: "scripts/build-public-bundle.mjs", live: false, dateRequired: false },
  { file: "data/sealed-prices.json", readers: ["bot"], writer: "scripts/fetch-sealed-prices.mjs", live: true, dateRequired: true },
  { file: "data/derived/weekly-read.json", readers: ["bot"], writer: "scripts/compute-weekly-read.mjs", live: true, dateRequired: true },
  { file: "research/assets/the-pulse.html", readers: ["site"], writer: "scripts/generate-pulse.mjs", live: false, dateRequired: false, note: "HTML. The date is inside the page, not a JSON field this check reads." },
  { file: "data/ppt/run-report.json", readers: ["site"], writer: "scripts/write-run-report.mjs", live: true, dateRequired: true },
  { file: "research/pulse/pulse-feed.json", readers: ["bot-rehearsal"], writer: "scripts/generate-pulse.mjs", live: true, dateRequired: true, note: "tests/rehearse_raffle_001.py only. Not a live cog." },
  { file: "data/card-attrs.json", readers: ["site"], writer: "scripts/build-card-images.mjs", live: false, dateRequired: false },
  { file: "data/card-catalogue.json", readers: ["site"], writer: "scripts/build-card-images.mjs", live: false, dateRequired: false },
  { file: "data/pocket-catalogue.json", readers: ["site"], writer: "hand", live: false, dateRequired: false },
  { file: "research/pulse/dive/", readers: ["site"], writer: "scripts/build-product-dives.mjs", live: false, dateRequired: false, note: "One file per product. Not one dated document." },
  { file: "newsletter/sample-week.json", readers: ["newsletter"], writer: "hand", live: false, dateRequired: false, note: "Sample week in the site repo. A real send is a week file passed to newsletter/build.mjs. It does not fetch a public price file." },
];

export function readerFiles() {
  return READERS.map((row) => row.file);
}
