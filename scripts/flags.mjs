// flags.mjs — THE ONE PLACE A GATE IS DECLARED.
//
// 2026-08-23: chat and CC independently added a PPT licensing gate to
// pack-basis.mjs. Chat's ran first, CC's ran second and silently overrode it,
// so Tyler's ruling appeared not to take effect and neither author knew the
// other's gate existed. Two guards for one decision, and the second won.
//
// Detection would have caught it afterwards. This prevents it: a gate that
// changes behaviour is DECLARED here and only here. Adding one means opening
// this file, which means seeing the gate that already exists. Duplicates stop
// being a coordination problem and become impossible.
//
// SCOPE — what belongs here:
//   yes: anything that changes what the product DOES or PUBLISHES
//   no:  secrets and credentials (they live in the environment, never here)
//   no:  developer conveniences that only change logging (VERBOSE, DEBUG_DUMP)
//
// RULE: no file outside this one may read a CATCHEM_* environment variable.
// guard-audit enforces it.

const bool = (name, deflt) => {
  const v = process.env[name];
  if (v === undefined || v === "") return deflt;
  return !(v === "0" || v.toLowerCase() === "false" || v.toLowerCase() === "off");
};

export const FLAGS = {
  // ── PRICING ────────────────────────────────────────────────────────────
  pptLicensed: {
    env: "CATCHEM_PPT_LICENSED",
    value: bool("CATCHEM_PPT_LICENSED", true),
    owner: "Tyler",
    decidedOn: "2026-08-23",
    why: "Free tool, no revenue, development phase — proceed on the current PPT tier. Pack prices display TCGplayer values.",
    trigger: "Set to 0 and resolve licensing BEFORE the first dollar: a Pro tier, ads, sponsorship, or any paid feature. Never after.",
    affects: ["scripts/pack-basis.mjs"],
  },
  tcgDelivered: {
    env: "CATCHEM_TCG_DELIVERED",
    value: bool("CATCHEM_TCG_DELIVERED", false),
    owner: "chat",
    decidedOn: "2026-08-23",
    why: "TCGplayer figures arrive item-only; no shipping field exists on any retrievable tier. Off until a shipping-inclusive source is found.",
    trigger: "Turn on only when TCG prices genuinely include shipping. Never to make a comparison look tidy — that would be guessing a shipping cost, which is forbidden.",
    affects: ["scripts/compute-divergence.mjs"],
  },
  // ── PUBLISHING ─────────────────────────────────────────────────────────
  site: {
    env: "CATCHEM_SITE",
    value: process.env.CATCHEM_SITE || "catchemtcg.com",
    owner: "CC",
    decidedOn: "2026-08-22",
    why: "Public host for every link we publish. Changed when the public/gated split moved static pages to the root domain.",
    trigger: "Change only alongside a verified DNS and deployment change.",
    affects: ["scripts/mint-cards.mjs", "scripts/social-posts.mjs", "scripts/post-bank.mjs"],
  },
};

// Convenience accessors — call these, never process.env, outside this file.
export const flag = (k) => FLAGS[k]?.value;
export const flagReason = (k) => FLAGS[k]?.why ?? "";

// A gate that exists but is read nowhere is dead weight; a gate read in two
// places is the 2026-08-23 bug. Both are reported by guard-audit.
export const declaredEnvNames = Object.values(FLAGS).map(f => f.env);
