// Records one creator post. submitterTier must be premium. approved stays false.
// The link is pasted. This script does not fetch it and does not call X or Stripe.
// Usage: node scripts/submit-creator-post.mjs --id ID --creator NAME --source-url URL --text LINE --created YYYY-MM-DD --submitter-tier premium
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadStore, saveCreatorPosts, submitCreatorPost } from "./lib/creator-posts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0 || !process.argv[i + 1] || process.argv[i + 1].startsWith("--")) return "";
  return process.argv[i + 1];
}

const input = {
  id: arg("--id"),
  creator: arg("--creator"),
  sourceUrl: arg("--source-url"),
  text: arg("--text"),
  created: arg("--created"),
  submitterTier: arg("--submitter-tier"),
};
if (!input.id || !input.creator || !input.sourceUrl || !input.text || !input.created || !input.submitterTier) {
  console.error("Need --id --creator --source-url --text --created --submitter-tier premium");
  process.exit(1);
}

const store = await loadStore(ROOT);
const post = submitCreatorPost(store, input);
const publicDoc = await saveCreatorPosts(ROOT, store);
console.log(`Submitted ${post.id} (approved=${post.approved}, submitterTier=${post.submitterTier}). Public posts: ${publicDoc.posts.length}.`);
