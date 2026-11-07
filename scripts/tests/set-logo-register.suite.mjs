// New catalog sets get one logo tile, or a flagged text tile. No network in this file.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import {
  allowedLogoUrl,
  officialFromApi,
  pickOfficial,
  registerMissingSets,
  registrationFor,
  tileIdFor,
} from "../lib/set-logo-register.mjs";
import { isRejectedLogoSha, REJECT_SHA256 } from "../lib/set-quarantine.mjs";

const ROOT = join(new URL("../../", import.meta.url).pathname);

async function tinyPng() {
  return sharp({
    create: { width: 12, height: 8, channels: 4, background: { r: 20, g: 40, b: 80, alpha: 1 } },
  }).png().toBuffer();
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  t("only the allowed logo host is accepted", allowedLogoUrl("https://images.pokemontcg.io/base1/logo.png") !== "" && allowedLogoUrl("https://pokemon.com/logo.png") === "" && allowedLogoUrl("http://images.pokemontcg.io/base1/logo.png") === "");
  t("a tile id is the slug with hyphens removed", tileIdFor("mcdonald-s-promos-2026") === "mcdonaldspromos2026");
  t("an official match needs the same name and one id", pickOfficial("Example Promos", {
    examp: { name: "Example Promos", logo: "https://images.pokemontcg.io/examp/logo.png" },
    other: { name: "Other Promos", logo: "https://images.pokemontcg.io/other/logo.png" },
  })?.id === "examp");
  t("two ids for one name are not guessed", pickOfficial("Example Promos", {
    a: { name: "Example Promos", logo: "https://images.pokemontcg.io/a/logo.png" },
    b: { name: "Example Promos", logo: "https://images.pokemontcg.io/b/logo.png" },
  }) === null);
  t("the api result must match the catalog name", officialFromApi("Example Promos", {
    data: [{ id: "examp", name: "Example Promos", images: { logo: "https://images.pokemontcg.io/examp/logo.png" } }],
  })?.id === "examp" && officialFromApi("Example Promos", {
    data: [{ id: "nope", name: "Something Else", images: { logo: "https://images.pokemontcg.io/nope/logo.png" } }],
  }) === null);

  const dir = await mkdtemp(join(tmpdir(), "set-logo-"));
  const png = await tinyPng();
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes("images.pokemontcg.io/examp/logo.png")) {
      return new Response(png, { status: 200 });
    }
    if (String(url).includes("blocked.example")) return new Response("no", { status: 403 });
    return new Response("no", { status: 404 });
  };
  const pace = async () => {};
  const named = await registerMissingSets({
    root: dir,
    sets: [{ slug: "example-promos", name: "Example Promos" }],
    fetchImpl,
    pace,
  });
  const textTile = JSON.parse(await readFile(join(dir, "research/assets/img/set-logo-tiles.json"), "utf8")).tiles[0];
  const textLogo = JSON.parse(await readFile(join(dir, "research/assets/public/set-logos.json"), "utf8")).logos["example-promos"];
  const flags = JSON.parse(await readFile(join(dir, "research/assets/img/set-logo-flags.json"), "utf8")).flagged;
  t("a set with no allowed logo gets one text tile", named.registered[0] === "example-promos" && textTile.kind === "text" && textTile.text === true && textTile.name === "Example Promos" && textTile.id === "examplepromos");
  t("the text tile records size and sha256", textTile.width === 640 && textTile.height === 220 && textTile.bytes > 0 && textTile.sha256.length === 64 && textLogo.sha256 === textTile.sha256 && textLogo.name === "Example Promos");
  t("the missing logo is flagged and the call does not fail", flags[0].slug === "example-promos" && flags[0].reason === "no allowed logo" && named.flagged.length === 1);
  t("a disallowed host is never requested", calls.every((url) => !/pokemon\.com|blocked\.example/i.test(url)));

  const again = await registerMissingSets({
    root: dir,
    sets: [{ slug: "example-promos", name: "Example Promos" }],
    fetchImpl,
    pace,
  });
  const tilesAfter = JSON.parse(await readFile(join(dir, "research/assets/img/set-logo-tiles.json"), "utf8")).tiles;
  t("registering the same set again does not stack a tile", again.skipped[0] === "example-promos" && tilesAfter.length === 1);

  const dir2 = await mkdtemp(join(tmpdir(), "set-logo-ok-"));
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(join(dir2, "data"), { recursive: true });
  await writeFile(join(dir2, "data/set-logos.json"), JSON.stringify({
    sets: { examp: { name: "Example Promos", logo: "https://images.pokemontcg.io/examp/logo.png" } },
  }));
  const official = await registerMissingSets({
    root: dir2,
    sets: [{ slug: "example-promos", name: "Example Promos" }],
    fetchImpl,
    pace,
  });
  const cropped = JSON.parse(await readFile(join(dir2, "research/assets/img/set-logo-tiles.json"), "utf8")).tiles[0];
  const croppedLogo = JSON.parse(await readFile(join(dir2, "research/assets/public/set-logos.json"), "utf8")).logos["example-promos"];
  t("an allowed logo is cropped and stored with its sha256", official.registered[0] === "example-promos" && cropped.kind === "official" && cropped.id === "examp" && cropped.name === "Example Promos" && cropped.sha256.length === 64 && cropped.width > 0 && cropped.height > 0 && croppedLogo.sha256 === cropped.sha256 && croppedLogo.text !== true && croppedLogo.kind !== "tile" && cropped.source === "https://images.pokemontcg.io/examp/logo.png" && !JSON.stringify(croppedLogo).includes("images.pokemontcg.io"));
  t("the allowed fetch stays on images.pokemontcg.io", calls.some((url) => url.startsWith("https://images.pokemontcg.io/examp/logo.png")) && calls.every((url) => url.startsWith("https://images.pokemontcg.io/") || url.startsWith("https://api.pokemontcg.io/")));

  const croppedPng = await sharp(png).ensureAlpha().trim({ threshold: 1 }).png({ compressionLevel: 9 }).toBuffer();
  const croppedSha = createHash("sha256").update(croppedPng).digest("hex");
  const dirReject = await mkdtemp(join(tmpdir(), "set-logo-reject-"));
  await mkdir(join(dirReject, "data"), { recursive: true });
  await mkdir(join(dirReject, "research/assets/public"), { recursive: true });
  await writeFile(join(dirReject, "data/set-logos.json"), JSON.stringify({
    sets: { examp: { name: "Example Promos", logo: "https://images.pokemontcg.io/examp/logo.png" } },
  }));
  await writeFile(join(dirReject, "research/assets/public/set-logos.json"), JSON.stringify({
    rejectSha256: { genericSet: croppedSha, genericPromo: REJECT_SHA256.genericPromo },
    logos: {},
  }));
  const rejected = await registerMissingSets({
    root: dirReject,
    sets: [{ slug: "example-promos", name: "Example Promos" }],
    fetchImpl,
    pace,
  });
  const rejectedTile = JSON.parse(await readFile(join(dirReject, "research/assets/img/set-logo-tiles.json"), "utf8")).tiles[0];
  const rejectedLogo = JSON.parse(await readFile(join(dirReject, "research/assets/public/set-logos.json"), "utf8")).logos["example-promos"];
  t("a rejectSha256 image becomes a branded tile, not the generic file", rejected.registered[0] === "example-promos" && rejectedTile.kind === "text" && rejectedTile.sha256 !== croppedSha && rejectedLogo.sha256 !== croppedSha && rejectedLogo.logo === "/img/examplepromos/logo.png" && !JSON.stringify(rejectedLogo).includes("images.pokemontcg.io") && !JSON.stringify(rejectedLogo).includes("images.scrydex.com"));
  t("rejectSha256 genericSet and genericPromo are rejected", isRejectedLogoSha(REJECT_SHA256.genericSet) && isRejectedLogoSha(REJECT_SHA256.genericPromo) && isRejectedLogoSha(croppedSha, { genericSet: croppedSha }));

  const dir3 = await mkdtemp(join(tmpdir(), "set-logo-block-"));
  await mkdir(join(dir3, "data"), { recursive: true });
  await writeFile(join(dir3, "data/set-logos.json"), JSON.stringify({
    sets: { block: { name: "Blocked Promos", logo: "https://images.pokemontcg.io/block/logo.png" } },
  }));
  const blockedCalls = [];
  const blocked = await registerMissingSets({
    root: dir3,
    sets: [{ slug: "blocked-promos", name: "Blocked Promos" }],
    fetchImpl: async (url) => {
      blockedCalls.push(String(url));
      return new Response("no", { status: 403 });
    },
    pace,
  });
  const blockedTile = JSON.parse(await readFile(join(dir3, "research/assets/img/set-logo-tiles.json"), "utf8")).tiles[0];
  t("a 403 becomes one text tile and is not fetched again", blocked.registered[0] === "blocked-promos" && blockedTile.kind === "text" && blockedTile.name === "Blocked Promos" && blockedCalls.length === 1 && blockedCalls[0] === "https://images.pokemontcg.io/block/logo.png");

  const sets = JSON.parse(await readFile(join(ROOT, "research/assets/public/sets.json"), "utf8"));
  const logos = JSON.parse(await readFile(join(ROOT, "research/assets/public/set-logos.json"), "utf8")).logos;
  const liveTiles = JSON.parse(await readFile(join(ROOT, "research/assets/img/set-logo-tiles.json"), "utf8")).tiles;
  const missing = (sets.sets || []).filter((row) => !registrationFor(row.slug, { logos, tiles: liveTiles })).map((row) => row.slug);
  t("every published set has a logo tile or an approved text tile", missing.length === 0);

  await rm(dir, { recursive: true, force: true });
  await rm(dir2, { recursive: true, force: true });
  await rm(dir3, { recursive: true, force: true });
  await rm(dirReject, { recursive: true, force: true });
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("set-logo-register.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
