// A verified release and its first two daily prices. A missing day is no read.

import { money } from "../public-bundle.mjs";
import { monthDay, TAKE_CODES, takeCode } from "../takes.mjs";

export function firstWeek(release, prices, dailyFiles) {
  if (!release || release.verified !== true || !release.name || !/^\d{4}-\d{2}-\d{2}$/.test(String(release.date || ""))) return null;
  const days = (Array.isArray(prices) ? prices : [])
    .filter((row) => row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || "")) && row.date >= release.date && Number(row.market) > 0)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (days.length < 2) return null;
  const [first, second] = days;
  if (dailyFiles && (!dailyFiles.has(first.date) || !dailyFiles.has(second.date))) return null;
  const code = takeCode({ from: first.market, to: second.market, start: first.date, end: second.date });
  if (code && !TAKE_CODES.includes(code)) return null;
  return {
    id: `first-week-${release.id || release.name}`,
    signal: "first-week",
    headline: `${money(second.market)} from ${money(first.market)}. ${release.name} first two daily prices, ${monthDay(first.date)} to ${monthDay(second.date)}.`,
    take: code,
    why: "These are the first two TCGplayer market prices on file after the verified release date.",
    whatWouldMakeThisWrong: "Wrong if the release date is not verified, or either daily price is missing.",
    receipt: {
      id: release.id || "",
      name: release.name,
      date: release.date,
      firstDate: first.date,
      firstPrice: first.market,
      secondDate: second.date,
      secondPrice: second.market,
    },
    source: "TCGplayer market",
    sourceLine: `${release.name} ${release.date}`,
  };
}
