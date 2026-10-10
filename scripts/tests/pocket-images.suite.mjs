// Pocket pictures in the Post Office come from one checked URL per id.
import { readFile } from "node:fs/promises";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log("  ok  ", name); else { fail++; console.error("  FAIL", name); } };
  const root = new URL("../../", import.meta.url);
  const rows = JSON.parse(await readFile(new URL("research/assets/pocket-rows.json", root), "utf8"));
  const map = JSON.parse(await readFile(new URL("data/pocket-images.json", root), "utf8"));
  const cat = JSON.parse(await readFile(new URL("data/pocket-catalogue.json", root), "utf8"));
  const play = await readFile(new URL("research/assets/play.html", root), "utf8");
  const HOSTS = /^https:\/\/(assets\.tcgdex\.net\/en\/tcgp\/|limitlesstcg\.nyc3\.cdn\.digitaloceanspaces\.com\/pocket\/|www\.serebii\.net\/tcgpocket\/)/;
  const imgs = map.images || {};
  t("every picture is for a catalogue id", Object.keys(imgs).every((id) => cat.cards[id]));
  t("every picture is on a known card host", Object.values(imgs).every((u) => HOSTS.test(u)));
  t("a row picture is the checked picture for that same id", rows.every((r) => (r[14] || 0) === (imgs[r[0]] || 0)));
  t("an id with no checked picture has none", rows.every((r) => imgs[r[0]] || !r[14]));
  t("the url carries the id's set and number", Object.entries(imgs).every(([id, u]) => {
    const m = /^tcgp-(.+)-(\d{3})$/.exec(id);
    if (!m) return false;
    if (u.includes("serebii.net")) return u.endsWith("/" + Number(m[2]) + ".jpg");
    return u.includes("/" + m[1] + "/") && (u.includes("/" + m[2] + "/") || u.includes(m[1] + "_" + m[2] + "_EN"));
  }));
  t("play.html uses the row picture, not a made-up path", !play.includes('"/pocket-img/" + (c.setCode') && play.includes('src: r[14] ? String(r[14]) : ""'));
  return fail;
}
