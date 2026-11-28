import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { boardImage, loadBuiltImageInputs, logoUrl } from "../lib/read-library.mjs";
import { mapReadImage, settleReadImages, allowedImageHost, isCuratedLogoUrl, headReachable, leadDeadSet } from "../lib/read-images.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  const prevFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => {
    fetches += 1;
    throw new Error("network");
  };
  try {

  const deadUrl = "https://tcgplayer-cdn.tcgplayer.com/product/999001_in_400x400.jpg";
  const knownUrl = "https://images.pokemontcg.io/fixset/19_hires.png";
  const reachable = (url) => url !== deadUrl;
  const images = {
    "fixture-sneasel": "/img/fixsetb/7",
    "fixture-known": "/img/fixset/19",
  };
  const reads = [
    { id: "fixture-id-mismatch", name: "Sneasel label", sku: "fixture-sneasel", setId: "fixseta", number: "25", image: "" },
    { id: "fixture-missing-sealed", name: "Power Partnership label", sku: "fixture-tin", kind: "sealed", readKind: "sealed", image: "" },
    { id: "fixture-dead-host", name: "Celebi label", sku: "fixture-dead", image: deadUrl },
    { id: "fixture-not-copied", name: "151 UPC label", sku: "fixture-known", image: "" },
    { id: "fixture-kept", name: "Kept label", sku: "tcgcsv-424242", image: "" },
  ];
  const settled = settleReadImages(reads, {
    images,
    tcgOn: true,
    sealedPid: new Map(),
    sealedImageIds: new Set(),
    boardMax: 2,
    reachable,
    logLines: false,
  });
  const top = settled.reads.slice(0, 2);
  const reason = (id) => settled.log.find((line) => line.id === id)?.reason || "";
  const row = (id) => settled.reads.find((item) => item.id === id);

  t("top slots have an allowed reachable picture", top.length === 2 && top.every((item) => allowedImageHost(item.image) && reachable(item.image) && !item.image.endsWith("/og.png")));
  t("a known catalogue path is copied onto the read", row("fixture-not-copied").image === knownUrl && reason("fixture-not-copied") === "");
  t("the kept product id stays in a top slot", top.some((item) => item.id === "fixture-kept") && row("fixture-kept").image === "https://tcgplayer-cdn.tcgplayer.com/product/424242_in_400x400.jpg");
  t("id mismatch moves down", reason("fixture-id-mismatch") === "id-mismatch" && !String(row("fixture-id-mismatch").image).includes("fixsetb"));
  t("missing sealed map moves down", reason("fixture-missing-sealed") === "missing-sealed-map" && row("fixture-missing-sealed").image === "");
  t("dead host moves down", reason("fixture-dead-host") === "dead-host" && row("fixture-dead-host").image === "");
  t("a disallowed host is not written", settled.reads.every((item) => !String(item.image).includes("catchemtcg.com") && !String(item.image).includes("not-a-card-host.example")));
  t("demoted reads sit under the top slots", settled.reads.slice(2).every((item) => !top.includes(item)) && ["fixture-id-mismatch", "fixture-missing-sealed", "fixture-dead-host"].every((id) => settled.reads.findIndex((item) => item.id === id) >= 2));

  const repaired = mapReadImage({
    id: "fixture-mismatch-repair",
    sku: "tcgcsv-515151",
    setId: "fixseta",
    number: "25",
  }, {
    images: { "tcgcsv-515151": "/img/fixsetb/7" },
    tcgOn: true,
    reachable,
  });
  t("a product id repairs a mismatched catalogue id", repaired.url === "https://tcgplayer-cdn.tcgplayer.com/product/515151_in_400x400.jpg" && repaired.reason === "");

  const blocked = mapReadImage({ id: "fixture-blocked-host", sku: "fixture-blocked", image: "https://not-a-card-host.example/pic.jpg" }, { images: {}, tcgOn: true, reachable });
  t("a disallowed host is a dead host", blocked.url === "" && blocked.reason === "dead-host");

  t("catalogue picture by id uses the allowed host", boardImage({ sku: "tcgcsv-1" }, { "tcgcsv-1": "/img/sv1/12" }, true) === "https://images.pokemontcg.io/sv1/12_hires.png");

  const logos = { "fixture-set": { logo: "/img/fixset/logo.png", setId: "fixset" } };
  const curated = logoUrl(logos, "fixture-set");
  t("a curated set logo stays on our host", curated === "https://catchemtcg.com/img/fixset/logo.png" && isCuratedLogoUrl(curated));
  t("a curated logo is not probed", await headReachable(curated) === true && fetches === 0);
  const deep = { id: "deep-set-fixture-set", readKind: "deep", deep: "set", href: "/sets/fixture-set", image: "" };
  const deepSettled = settleReadImages([deep, { id: "filler", sku: "tcgcsv-424242", image: "" }], {
    images: {},
    tcgOn: true,
    logos,
    boardMax: 1,
    reachable: () => true,
    logLines: false,
    picture: (row) => (row.id === deep.id ? curated : "https://tcgplayer-cdn.tcgplayer.com/product/424242_in_400x400.jpg"),
  });
  t("a curated logo can lead", deepSettled.reads[0].id === deep.id && deepSettled.reads[0].image === curated);

  const root = await mkdtemp(join(tmpdir(), "read-images-"));
  try {
    await mkdir(join(root, "research/assets/public"), { recursive: true });
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(join(root, "research/assets/public/catalogue-images.json"), JSON.stringify({ images: { "fixture-only": "/img/fixset/3" } }));
    await writeFile(join(root, "data/sealed-products.json"), JSON.stringify({ products: [{ id: "fixture-tin", tcgPlayerId: "424242", image: "/img/fixset/tin.png" }] }));
    const fromRoot = loadBuiltImageInputs(root);
    const fromNone = loadBuiltImageInputs(null);
    t("image files are read from the root argument", fromRoot.images["fixture-only"] === "/img/fixset/3" && fromRoot.sealedPid.get("fixture-tin") === "424242");
    t("a missing root does not invent a picture map", Object.keys(fromNone.images).length === 0 && fromNone.sealedPid.size === 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  const dead = await leadDeadSet([
    "https://tcgplayer-cdn.tcgplayer.com/product/424242_in_400x400.jpg",
    deadUrl,
  ], async (url) => url !== deadUrl);
  t("a lead probe uses the stub and does not open the network", dead.size === 1 && dead.has(deadUrl) && fetches === 0);
  t("the suite makes no network request", fetches === 0);
  return fail;
  } finally {
    globalThis.fetch = prevFetch;
  }
}
