import { tagRead } from "../lib/read-tags.mjs";
export function runReadTagTests(t) {
  const cards = { "tcgcsv-1": { tags: ["Illustration Rare", "Reverse Holo"] }, "tcgcsv-2": { tags: ["Alternate Art"] }, "tcgcsv-3": { tags: ["Reverse Holo"] } };
  const r = tagRead({ href: "/c/tcgcsv-1", name: "Emolga - 112/086", headline: "Emolga (Black Bolt): $1 to $2.", path: "Emolga (Black Bolt): $1 to $2." }, cards);
  t("read tags: chips stamped from the variant file", r.tags.join() === "Illustration Rare,Reverse Holo");
  t("read tags: the tag is named in the line", r.headline === "Emolga Illustration Rare (Black Bolt): $1 to $2." && r.path === r.headline);
  const a = tagRead({ href: "/c/tcgcsv-2", name: "Unown V (Alternate Full Art)", headline: "Unown V (Alternate Full Art) (Silver Tempest): $1." }, cards);
  t("read tags: no double naming when the name already says it", a.headline === "Unown V (Alternate Full Art) (Silver Tempest): $1.");
  const p = tagRead({ href: "/c/tcgcsv-3", name: "Zubat", headline: "Zubat (X): $1." }, cards);
  t("read tags: printing tags stay chips only", p.headline === "Zubat (X): $1." && p.tags.join() === "Reverse Holo");
  t("read tags: set reads untouched", tagRead({ href: "/sets/x", headline: "h" }, cards).tags === undefined);
}
