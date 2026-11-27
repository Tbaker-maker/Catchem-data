// build-feed.mjs owns reads.json and feed/ once it has run. build-public-bundle.mjs
// also calls publishFeed, which writes only the bare price lead. A bundle run after
// build-feed (the released-holds rebuild) sets this switch so it leaves them alone.
// Run 45902396201: without it, 374 reads became 3, then 0, and publish refused.
export const KEEP_FEED_ENV = "BUNDLE_KEEP_FEED";

export function bundleKeepsFeed(env = process.env) {
  return String(env?.[KEEP_FEED_ENV] ?? "") === "1";
}
