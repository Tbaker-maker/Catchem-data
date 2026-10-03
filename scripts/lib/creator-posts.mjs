// Creator posts are pasted by hand. No X/Twitter API, no paid API, no fetch.
// A Premium member submits. Tyler (or a later admin) approves.
// Nothing is public until approved. The site must reject a non-Premium submitter.
// This repo does not call Stripe.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export const DATA_REL = "data/creator-posts.json";
export const PUBLIC_REL = "research/assets/public/creator-posts.json";

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyStore() {
  return { posts: [] };
}

export function toPublicFeed(store) {
  const posts = [];
  for (const post of store?.posts || []) {
    if (post?.approved !== true) continue;
    if (post.submitterTier !== "premium") continue;
    posts.push({
      id: post.id,
      creator: post.creator,
      sourceUrl: post.sourceUrl,
      text: post.text,
      created: post.created,
    });
  }
  return { audience: "public", posts };
}

export function unapprovedIdsInPublic(store, publicDoc) {
  const approved = new Set(
    (store?.posts || [])
      .filter((post) => post?.approved === true && post.submitterTier === "premium")
      .map((post) => post.id),
  );
  const leaked = [];
  for (const post of publicDoc?.posts || []) {
    if (!approved.has(post?.id)) leaked.push(post?.id ?? "");
  }
  for (const post of store?.posts || []) {
    if (post?.approved === true) continue;
    const blob = JSON.stringify(publicDoc ?? {});
    if (post?.id && blob.includes(post.id)) leaked.push(post.id);
  }
  return [...new Set(leaked)];
}

function requireLine(value, label) {
  const text = String(value ?? "").trim();
  if (!text || /[\r\n]/.test(text)) throw new Error(`${label} must be one line`);
  return text;
}

function requireSourceUrl(value) {
  const sourceUrl = requireLine(value, "sourceUrl");
  let url;
  try { url = new URL(sourceUrl); }
  catch { throw new Error("sourceUrl must be the creator's own pasted link"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("sourceUrl must be an http(s) link");
  }
  return sourceUrl;
}

export function submitCreatorPost(store, input) {
  if (!store || !Array.isArray(store.posts)) throw new Error("creator post store is missing posts");
  if (input?.submitterTier !== "premium") {
    throw new Error("Only a Premium member can submit. Refusing submitterTier " + JSON.stringify(input?.submitterTier ?? null));
  }
  const post = {
    id: requireLine(input.id, "id"),
    creator: requireLine(input.creator, "creator"),
    sourceUrl: requireSourceUrl(input.sourceUrl),
    text: requireLine(input.text, "text"),
    approved: false,
    created: requireLine(input.created, "created"),
    submitterTier: "premium",
  };
  if (!ID_RE.test(post.id)) throw new Error("id must be a short token");
  if (!DATE_RE.test(post.created)) throw new Error("created must be YYYY-MM-DD");
  if (store.posts.some((row) => row.id === post.id)) throw new Error(`creator post ${post.id} already exists`);
  store.posts.push(post);
  return post;
}

export function approveCreatorPost(store, id) {
  if (!store || !Array.isArray(store.posts)) throw new Error("creator post store is missing posts");
  const token = requireLine(id, "id");
  const post = store.posts.find((row) => row.id === token);
  if (!post) throw new Error(`No creator post ${token}`);
  if (post.submitterTier !== "premium") {
    throw new Error(`Refusing to approve ${token}: submitter is not Premium`);
  }
  post.approved = true;
  return post;
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (err) {
    if (err?.code === "ENOENT") return fallback();
    throw err;
  }
}

export async function loadStore(root) {
  const store = await readJson(join(root, DATA_REL), emptyStore);
  if (!store || !Array.isArray(store.posts)) throw new Error("data/creator-posts.json needs a posts array");
  return store;
}

export async function saveCreatorPosts(root, store) {
  const publicDoc = toPublicFeed(store);
  const leaked = unapprovedIdsInPublic(store, publicDoc);
  if (leaked.length) throw new Error("Refusing to write public creator posts; unapproved id: " + leaked.join(","));
  const dataPath = join(root, DATA_REL);
  const publicPath = join(root, PUBLIC_REL);
  await mkdir(dirname(dataPath), { recursive: true });
  await mkdir(dirname(publicPath), { recursive: true });
  await writeFile(dataPath, JSON.stringify(store, null, 2) + "\n");
  await writeFile(publicPath, JSON.stringify(publicDoc, null, 2) + "\n");
  const written = await readFile(publicPath, "utf8");
  for (const post of store.posts) {
    if (post.approved === true) continue;
    if (post.id && written.includes(post.id)) {
      throw new Error(`Unapproved post ${post.id} was copied into the public file`);
    }
  }
  return publicDoc;
}
