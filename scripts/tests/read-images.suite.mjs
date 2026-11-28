import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { boardImage } from "../lib/read-library.mjs";
import { mapReadImage, settleReadImages, allowedImageHost } from "../lib/read-images.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

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

  const cat = JSON.parse(await readFile(join(ROOT, "research/assets/public/catalogue-images.json"), "utf8")).images;
  const joined = JSON.parse(await readFile(join(ROOT, "data/tcgcsv-to-catalogue.json"), "utf8"));
  const productsDoc = JSON.parse(await readFile(join(ROOT, "data/sealed-products.json"), "utf8"));
  const products = Array.isArray(productsDoc) ? productsDoc : productsDoc.products || [];
  const skip = (joined.skipped || []).find((item) => item.id === "tcgcsv-716161");
  const sneasel = mapReadImage({ id: "move-tcgcsv-716161-7", sku: "tcgcsv-716161" }, { images: cat, tcgOn: true, reachable: () => true });
  t("Sneasel has no catalogue id and uses the product photo", skip?.reason === "no-unique-set-code" && !cat["tcgcsv-716161"] && sneasel.url === "https://tcgplayer-cdn.tcgplayer.com/product/716161_in_400x400.jpg");

  const celebi = mapReadImage({ id: "turned-tcgcsv-178818", sku: "tcgcsv-178818" }, { images: cat, tcgOn: true, reachable: () => true });
  t("Celebi catalogue path is copied from images.pokemontcg.io", cat["tcgcsv-178818"] === "/img/sm8/19" && celebi.url === "https://images.pokemontcg.io/sm8/19_hires.png");

  const upc = products.find((item) => item.id === "sv3pt5-upc");
  const upcPick = mapReadImage({ id: "mktmove-sv3pt5-upc", sku: "sv3pt5-upc" }, {
    images: cat,
    tcgOn: true,
    sealedPid: new Map([["sv3pt5-upc", String(upc?.tcgPlayerId || "")]]),
    reachable: () => true,
  });
  t("151 UPC logo is not the picture and the product id is", /\/sv3pt5\/logo\.png$/.test(String(upc?.image || "")) && upcPick.url === `https://tcgplayer-cdn.tcgplayer.com/product/${upc.tcgPlayerId}_in_400x400.jpg`);

  const tin = products.find((item) => item.id === "tcgcsv-194735");
  const tinPick = mapReadImage({ id: "sealed-week-tcgcsv-194735", sku: "tcgcsv-194735", kind: "sealed" }, {
    images: cat,
    tcgOn: true,
    sealedImageIds: new Set(),
    reachable: () => true,
  });
  t("Power Partnership has no image row and uses its product id", tin && !tin.image && tinPick.url === `https://tcgplayer-cdn.tcgplayer.com/product/${tin.tcgPlayerId}_in_400x400.jpg`);

  return fail;
}
