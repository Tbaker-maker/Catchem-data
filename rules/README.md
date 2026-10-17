# Copy rules

`advice-phrases.json` is the one shared list of phrases a reader may not see.
Catchem-data builds read it through `scripts/lib/copy-rules.mjs`. catchem-site
and catchem-bot keep a byte-for-byte copy and fail a test when it drifts from
this file on main. Change it here first, then copy it into both repos.

- Blocked: phrases that tell people what to do with money (buy now, you should
  buy or sell, load up, guaranteed, can't lose, to the moon), crypto words, and
  em or en dashes.
- Always allowed: Buy, Shop, Sell your cards, price target, "Buy on TCGplayer",
  "Buy on eBay". Single words like buy, sell, hold or target are never blocked
  on their own.
- A match flags the line with the matched phrase and the reason. Lines are never
  rewritten.
