// One plain sentence per item, only from fields on the item's facts.
// No hype, no advice words, no em dashes. Empty when nothing is backed.
import { banGuard } from "./copy-rules.mjs";
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? `${months[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}` : "");
const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const BANNED = banGuard("what we see", { house: true });

export function whatWeSee(f) {
  if (!f || typeof f !== "object") return "";
  const bits = [];
  const r = f.range;
  const spanDays = r?.from && r?.now?.date ? (Date.parse(r.now.date) - Date.parse(r.from)) / 86400000 : 0;
  if (r && spanDays >= 90) {
    if (r.daysSinceHigh === 0 && r.high.date !== r.low.date) bits.push(`At its highest price in our history, which starts ${day(r.from)}.`);
    else if (Number.isFinite(r.fromHighPct) && r.fromHighPct <= -20 && r.daysSinceHigh > 0) bits.push(`${Math.abs(Math.round(r.fromHighPct))}% under its high of ${money(r.high.price)} on ${day(r.high.date)}, ${r.daysSinceHigh} days ago.`);
  }
  const c = f.change?.d30;
  if (c && Math.abs(c.pct) >= 10) bits.push(`${c.pct > 0 ? "Up" : "Down"} ${Math.abs(Math.round(c.pct))}% over 30 days, ${day(c.from)} to ${day(c.to)}.`);
  const l = f.listings;
  if (bits.length < 2 && l && Number.isFinite(l.pct) && Math.abs(l.pct) >= 15 && l.prev > 0) bits.push(`Listings counted went from ${l.prev} on ${day(l.prevDate)} to ${l.n} on ${day(l.date)}.`);
  const out = bits.slice(0, 2).join(" ");
  return BANNED.test(out) || /[\u2014\u2013]/.test(out) ? "" : out;
}
