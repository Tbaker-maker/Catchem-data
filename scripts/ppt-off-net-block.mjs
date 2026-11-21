// Loaded with node --import during the PPT_OFF dress rehearsal.
// A Pokemon Price Tracker URL throws before any socket. Other hosts stay open
// so this file can be imported without breaking a later local read.
const orig = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input && input.url) || "";
  if (String(url).includes("pokemonpricetracker.com")) {
    throw new Error("PPT request blocked");
  }
  if (typeof orig !== "function") throw new Error("PPT request blocked");
  return orig(input, init);
};
