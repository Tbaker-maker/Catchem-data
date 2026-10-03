// Sets approved true for one id. Unapproved posts stay out of research/assets/public.
// Usage: node scripts/approve-creator-post.mjs --id <id>
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { approveCreatorPost, loadStore, saveCreatorPosts } from "./lib/creator-posts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0 || !process.argv[i + 1] || process.argv[i + 1].startsWith("--")) return "";
  return process.argv[i + 1];
}

const id = arg("--id");
if (!id) {
  console.error("Pass --id. Example: node scripts/approve-creator-post.mjs --id post-1");
  process.exit(1);
}

const store = await loadStore(ROOT);
approveCreatorPost(store, id);
const publicDoc = await saveCreatorPosts(ROOT, store);
console.log(`Approved ${id}. Public creator posts: ${publicDoc.posts.length}. audience=${publicDoc.audience}`);
