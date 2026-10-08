import { pathToFileURL } from "node:url";
import { ATTACH_SEALED, FOLD_GROUPS, KEEP_OWN_TILE, assertWritable, cardPrintings, completionCounts } from "../lib/set-master.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

export function run() {
  fail = 0;
  const section = (id) => FOLD_GROUPS.get(id)?.section;
  const parent = (id) => FOLD_GROUPS.get(id)?.parent;

  t("30th classic collection stays folded", parent(24837) === 24722 && section(24837) === "Classic Collection");
  t("the other subset groups fold into their parent", [
    [2931, 2867, "Classic Collection"],
    [17689, 17688, "Galarian Gallery"],
    [3020, 2948, "Trainer Gallery"],
    [3068, 3040, "Trainer Gallery"],
    [3172, 3118, "Trainer Gallery"],
    [17674, 3170, "Trainer Gallery"],
    [2594, 2480, "Shiny Vault"],
    [2781, 2754, "Shiny Vault"],
    [1729, 1728, "Radiant Collection"],
    [1465, 1409, "Radiant Collection"],
    [1663, 604, "Shadowless"],
  ].every(([id, to, name]) => parent(id) === to && section(id) === name));
  t("energy sets stay their own tiles", !FOLD_GROUPS.has(24461) && !FOLD_GROUPS.has(24382) && KEEP_OWN_TILE.has(24461) && KEEP_OWN_TILE.has(24382));
  t("prize pack is not folded away", !FOLD_GROUPS.has(22880));
  t("a retail attach is a product id", ATTACH_SEALED.get(644852) === 23821 && ATTACH_SEALED.get(690199) === 2906 && ATTACH_SEALED.size === 11);
  t("a multi-set bundle is not attached", !ATTACH_SEALED.has(636312) && !ATTACH_SEALED.has(587750) && !ATTACH_SEALED.has(685924));

  const prints = cardPrintings(
    { printing: "Normal", price: 1.2, asOf: "2026-10-08", printings: [{ name: "Normal", price: 1.2, asOf: "2026-10-08" }, { name: "Reverse Holofoil", price: 3, asOf: "2026-10-08" }] },
    [{ id: "tcgcsv-9", price: 4.5, pid: 9 }],
    "2026-10-08",
  );
  t("a base card keeps both printings and the prize pack", prints.map((p) => p.name).join(",") === "Normal,Reverse Holofoil,Prize Pack" && prints[2].id === "tcgcsv-9" && prints[2].price === 4.5);
  t("a prize pack with no price is not given one", cardPrintings({ printing: "Holofoil", price: 2 }, [{ id: "tcgcsv-8", price: null, pid: 8 }], "2026-10-08")[1].price === null);

  const counts = completionCounts([
    { kind: "single", printings: [{ name: "Normal" }, { name: "Reverse Holofoil" }] },
    { kind: "single" },
    { kind: "sealed" },
  ]);
  t("completion counts cards, printings, and sealed apart", counts.cards === 2 && counts.printings === 3 && counts.sealed === 1);

  let empty = "";
  try { assertWritable({ itemCount: 0, setCount: 3 }); } catch (err) { empty = err.message; }
  let noSets = "";
  try { assertWritable({ itemCount: 4, setCount: 0 }); } catch (err) { noSets = err.message; }
  t("an empty catalog is refused before a write", empty.includes("no items") && noSets.includes("no sets"));
  try { assertWritable({ itemCount: 4, setCount: 2 }); t("a real catalog is allowed", true); }
  catch (err) { t("a real catalog is allowed", false, err.message); }

  console.log(fail ? `${fail} failed` : "set master ok");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = run();
  if (n) process.exit(1);
}
