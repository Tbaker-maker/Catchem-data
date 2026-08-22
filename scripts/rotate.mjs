// rotate.mjs — one honest way to pick today's item from a list.
//
// Every rotation here used `getUTCDate() % n` — day of month. That looks fine
// until a month ends on the 31st: the sequence jumps 31 → 1, and 31 % 5 equals
// 1 % 5, so the SAME item is chosen two days running. The Daily Three's lens
// rotation repeats itself every Jan 31 → Feb 1 and every other 31-day month,
// which quietly breaks the freshness law we wrote.
//
// Days since epoch is monotonic: it never resets, so a modulo over it never
// repeats consecutively. Found by asking what breaks at a boundary, which is
// a question no test had ever asked here.
export const dayIndex = (d = new Date()) => Math.floor(Date.parse(d.toISOString().slice(0, 10)) / 86400000);
export const rotate = (arr, salt = 0, d = new Date()) => arr.length ? arr[(dayIndex(d) + salt) % arr.length] : null;
export const rotateIndex = (len, salt = 0, d = new Date()) => len ? (dayIndex(d) + salt) % len : 0;
