import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  approveCreatorPost,
  loadStore,
  saveCreatorPosts,
  submitCreatorPost,
  toPublicFeed,
  unapprovedIdsInPublic,
} from "../lib/creator-posts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
  };

  const store = { posts: [] };
  const hidden = submitCreatorPost(store, {
    id: "hidden-post",
    creator: "Hidden Creator",
    sourceUrl: "https://example.com/hidden",
    text: "secret unapproved line",
    created: "2026-10-02",
    submitterTier: "premium",
  });
  t("a submit stays unapproved", hidden.approved === false && hidden.submitterTier === "premium");
  let rejected = false;
  try {
    submitCreatorPost(store, {
      id: "free-post",
      creator: "Free Creator",
      sourceUrl: "https://example.com/free",
      text: "not premium",
      created: "2026-10-02",
      submitterTier: "free",
    });
  } catch { rejected = true; }
  t("a non-premium submit is refused", rejected && store.posts.length === 1);

  const before = toPublicFeed(store);
  t("an unapproved post is not public", before.audience === "public" && before.posts.length === 0 && unapprovedIdsInPublic(store, before).length === 0);

  approveCreatorPost(store, "hidden-post");
  submitCreatorPost(store, {
    id: "still-hidden",
    creator: "Other Creator",
    sourceUrl: "https://example.com/other",
    text: "still waiting",
    created: "2026-10-02",
    submitterTier: "premium",
  });
  const dir = await mkdtemp(join(tmpdir(), "creator-posts-"));
  await mkdir(join(dir, "data"), { recursive: true });
  await mkdir(join(dir, "research/assets/public"), { recursive: true });
  await saveCreatorPosts(dir, store);
  const raw = await readFile(join(dir, "research/assets/public/creator-posts.json"), "utf8");
  const pub = JSON.parse(raw);
  t("the public file audience is public", pub.audience === "public");
  t("an unapproved post does not appear in the public file",
    pub.posts.length === 1 && pub.posts[0].id === "hidden-post" && !raw.includes("still-hidden") && !raw.includes("still waiting") && unapprovedIdsInPublic(store, pub).length === 0,
    raw);

  const committedStore = await loadStore(ROOT);
  const committedRaw = await readFile(join(ROOT, "research/assets/public/creator-posts.json"), "utf8");
  const committedPub = JSON.parse(committedRaw);
  const leaked = unapprovedIdsInPublic(committedStore, committedPub);
  t("committed public file has no unapproved post", leaked.length === 0 && committedPub.audience === "public", leaked.join(","));
  for (const post of committedStore.posts) {
    if (post.approved === true) continue;
    t(`committed unapproved ${post.id} is absent`, !committedRaw.includes(post.id));
  }

  const planted = structuredClone(committedStore);
  planted.posts.push({
    id: "planted-unapproved",
    creator: "Plant",
    sourceUrl: "https://example.com/plant",
    text: "must not ship",
    approved: false,
    created: "2026-10-02",
    submitterTier: "premium",
  });
  const plantedPub = {
    audience: "premium",
    posts: [{ id: "planted-unapproved", creator: "Plant", sourceUrl: "https://example.com/plant", text: "must not ship", created: "2026-10-02" }],
  };
  const plantedLeak = unapprovedIdsInPublic(planted, plantedPub);
  t("a planted unapproved public post fails the check", plantedLeak.includes("planted-unapproved"));

  return fail;
}
