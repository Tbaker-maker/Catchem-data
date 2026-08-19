# Newsletter Issue 001 — Usage Guide

**Headline:** "The rotation nobody panicked about."
**Word count:** ~1,200 words · 4 min read
**Prices used:** Zero (per tonight's rule — verified facts only)

---

## Two files, two purposes

### `newsletter-001-web.html` — standalone article page
**For:** Hosting on catchemtcg.com as a blog/archive article.

Fully-branded editorial piece. Matches the landing page aesthetic exactly — Syne/Sora/Fraunces fonts, dark theme, teal accents, drop cap on lead paragraph, pull quote, fact boxes, calendar grid, rotation table.

**How to use:**
- Upload to your hosting (Cloudflare Pages, Netlify, etc.)
- Suggested URL: `catchemtcg.com/signals/001` or `catchemtcg.com/newsletter/001`
- Linked back to main site via nav
- For future issues: duplicate, swap content, increment issue number

**Note:** Uses Google Fonts (loaded via CDN). Needs an internet connection to render with full branding. Will degrade gracefully without it.

---

### `newsletter-001-email.html` — email-safe version
**For:** Sending via Beehiiv / Substack / Mailchimp / ConvertKit / etc.

Table-based layout, inline styles, system fonts only (Georgia, Trebuchet MS, Courier New). Tested patterns for Gmail, Apple Mail, Outlook compatibility. Responsive mobile design. Dark mode preserved on supported clients.

**How to use by platform:**

**Beehiiv / Substack:**
1. Open HTML editor (usually "Edit HTML" or `</>` button)
2. Paste the entire contents of `newsletter-001-email.html`
3. Preview
4. Send test to yourself to verify rendering
5. Subject line suggestions below

**Mailchimp:**
1. Create new campaign → "Start from scratch" → "Code your own" → "Paste in code"
2. Paste the entire file
3. Mailchimp will auto-inline the remaining styles
4. Preview across desktop + mobile

**ConvertKit:**
1. New broadcast → HTML editor → paste
2. Note: ConvertKit handles `{{unsubscribe_url}}` automatically. For other platforms, may need to replace.

**Merge tags in the email:**
- `{{unsubscribe_url}}` — replace with your platform's unsubscribe token (auto-handled by most platforms)
- `{{update_profile_url}}` — same, for preferences link

---

## Subject line options

Pick based on what feels right for your list:

1. **"The rotation nobody panicked about"** — Mysterious, matches headline, works well
2. **"Issue 001: Signals from a quiet rotation"** — Plainer, clearer what it is
3. **"The market just grew up — here's what collectors missed"** — Clickier, more aggressive
4. **"Catch'em Signals #001 · April 21, 2026"** — Clean, dated, professional
5. **"Six million cards just left Standard. The hobby barely blinked."** — Curiosity-driven, longer

**My pick: #1** — it's the headline of the issue. Simple, memorable.

**Preview text (preheader) is already embedded:**
> "Six million G-mark cards just left Standard and the hobby barely blinked. That's the real signal."

---

## Content sections (for reference)

If you want to edit or swap content, here's the section map:

1. **Masthead** — Issue number, date, read time, headline, dek
2. **TL;DR** — Green callout box with 4-5 sentence summary
3. **The quiet rotation** — Main analysis piece (April 10 rotation)
4. **Rotation table** — G/H/I/J mark breakdown with pending next rotation
5. **The 30th Anniversary revealed its hand** — Sept 18 Celebration set deep-dive
6. **Fact box** — "What's confirmed" green-bordered callout
7. **Ascended Heroes is still writing its story** — 290+ card set, Mega Attack Rare, chase cards
8. **The grading trust problem** — PSA scandal + pull quote + CGC context
9. **What's next: Chaos Rising** — May 22 preview + calendar
10. **Calendar** — 5 upcoming dates
11. **Community pulse** — 3 debate cards
12. **One signal to sit with** — Closing thesis ("the TCG is professionalizing")
13. **Methodology note** — Explains the no-prices decision
14. **Sign-off** — Tyler, catchemtcg.com

---

## For future issues (weekly template)

Both files are structured so you can duplicate and swap:

1. **Change issue number** — Search/replace `001` → `002`
2. **Change date** — Search/replace `April 21, 2026` → new date
3. **Change headline + dek** — In the masthead section
4. **Rewrite TL;DR** — New 4-5 sentence summary
5. **Swap main sections** — Keep the same 7-section structure, new content
6. **Update calendar** — New 5 upcoming dates
7. **New community pulse** — 3 new debates

The styling, branding, and responsive behavior stay locked. You write the content.

---

## What's still missing (add when ready)

- **"Movers" section** — Add once your bot has 4+ weeks of price history (or you add PokemonPriceTracker API)
- **Reader Q&A** — Suggested for Issue #003+, after you get first reader replies
- **Chart/visualization** — Would be nice for issues with data — defer until prices are trustworthy
- **Author photo/credit** — Optional, add to sign-off block if desired

---

## Final honest read

This newsletter is genuinely ready to send. It's accurate, branded, readable, and mobile-responsive. The no-prices approach is a feature, not a limitation — it signals to readers that Catch'em doesn't BS them. That's the brand.

When you open `newsletter-001-web.html` in a browser tomorrow morning, you should feel proud of it. If you don't, tell me exactly what's off and I'll fix it.

— Claude
