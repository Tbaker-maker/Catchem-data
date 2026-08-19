# Catch'em Launch Checklist

Everything you need to turn `catchem.jsx` and `catchem-landing.html` into a real product live on the internet. Ordered by what to do first.

---

## Phase 1 — Get the landing page live (est. 30-60 min)

### 1a. Host the landing page (15 min)

**Recommendation: Cloudflare Pages** — free tier, fast global CDN, no credit card, unlimited bandwidth.

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) and sign up (use your GitHub if you have one).
2. Click **Create a project → Upload assets**.
3. Drag `catchem-landing.html` into the uploader. Rename it to `index.html` if the UI asks.
4. Name the project `catchem` or similar. Hit deploy.
5. You get a URL like `catchem.pages.dev`. Test it. Share it. Done.

**Alternative: Vercel.** Same deal, same speed. Use if you prefer their dashboard. Both have free tiers generous enough that you will not pay anything for a long time.

**Don't use**: GoDaddy Website Builder, Wix, Squarespace, or anything that wants to wrap your HTML in their template. You already have the full page — you just need a CDN in front of it.

### 1b. Wire up the waitlist endpoint (10-20 min)

The landing page has a working form — you just need to tell it where to send submissions. Open `catchem-landing.html`, find these lines near the bottom:

```js
const WAITLIST_ENDPOINT = ""; // ← paste your endpoint URL here
const FALLBACK_EMAIL = "hello@catchem.app"; // ← your real email
```

Pick one of these services:

| Service | Free tier | Setup time | Best for |
|---------|-----------|------------|----------|
| **Formspree** | 50 submissions/mo | 5 min | Fastest to stand up |
| **Tally** | Unlimited forms, 500 submissions/mo | 10 min | Prettier dashboard, form analytics |
| **Mailchimp** | 500 contacts, 1k emails/mo | 20 min | If you want to send campaigns too |
| **Supabase** | 50k rows free | 30 min | If you're going to use it for auth anyway |

**Quickest path — Formspree:**
1. Sign up at [formspree.io](https://formspree.io). Free plan.
2. Click **+ New form**. Name it "Catchem waitlist".
3. Copy the form endpoint (looks like `https://formspree.io/f/abcd1234`).
4. Paste it into `WAITLIST_ENDPOINT` in the HTML. Save.
5. Re-deploy to Cloudflare Pages (drag new file onto the existing project).
6. Submit a test email. Check the Formspree dashboard. You'll see it.

If you skip this step, the form falls back to opening the user's mail client with a pre-composed email to `hello@catchem.app` (update that fallback address to yours too). Worse UX but still captures signups.

### 1c. Get a custom domain (10 min + DNS propagation)

1. Buy `catchem.app` or similar at [Namecheap](https://namecheap.com) or [Porkbun](https://porkbun.com) — `.app` domains are around $14/year. Don't use GoDaddy (overpriced, upsells hard).
2. In Cloudflare Pages → your project → **Custom domains** → **Set up a custom domain** → enter your domain.
3. Cloudflare gives you DNS records to add at your registrar. Add them. Wait 5-60 min for DNS to propagate.
4. SSL is automatic and free.

---

## Phase 2 — Real user accounts & cloud sync (est. 4-8 hours, when ready)

**Before you start:** the app works great right now using local `window.storage`. Users can use it anonymously. Accounts are for: sync across devices, preventing data loss, and paywalling Pro. Don't ship this until you have a real reason (users asking for it, or ready to charge for Pro).

### 2a. Create the Supabase project (30 min)

1. Sign up at [supabase.com](https://supabase.com). Free tier is generous (50k monthly active users, 500MB database).
2. Create a new project. Pick a region close to your target users — `us-east-1` is a safe default for the US market.
3. Set a database password (save it in a password manager).
4. Wait ~2 min for the project to provision.
5. Go to **Project Settings → API**. Copy two things:
   - `Project URL` (looks like `https://abcdef.supabase.co`)
   - `anon public` key (long JWT string — this one is safe to put in client-side code)

### 2b. Design the tables (15 min)

In Supabase SQL Editor, run:

```sql
-- Users get a row per user, extending the built-in auth.users
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  plan text default 'free' check (plan in ('free', 'pro')),
  plan_expires_at timestamptz,
  created_at timestamptz default now()
);

-- User's collection — one row per card
create table public.collection (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  card_id text not null,
  name text not null,
  set_name text,
  price_paid numeric,
  condition text,
  quantity int default 1,
  created_at timestamptz default now()
);

-- User's goal list
create table public.goals (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  card_id text not null,
  name text not null,
  target_price numeric,
  alert_config jsonb,
  created_at timestamptz default now()
);

-- Row-level security: users can only see their own data
alter table public.profiles enable row level security;
alter table public.collection enable row level security;
alter table public.goals enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id);
create policy "own collection" on public.collection for all using (auth.uid() = user_id);
create policy "own goals" on public.goals for all using (auth.uid() = user_id);
```

### 2c. Wire the client into the React app (2-4 hours)

This needs a dedicated Claude session with the updated `catchem.jsx`. Tell Claude: **"Wire up Supabase auth and cloud sync. My URL is `X`, my anon key is `Y`. Keep `window.storage` as fallback for anonymous users."**

Broad shape of what needs to change:
- Add `@supabase/supabase-js` via CDN (`<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm">`).
- Add an `AuthModal` component (sign up / sign in forms).
- Add a `session` state at the root. If logged in, read/write to Supabase; if not, use `window.storage` as today.
- On first login after anonymous use, offer to migrate local data to the cloud.
- Header gets a login button / avatar dropdown.

Stripe auth integrations (Google, Apple) add complexity — skip for v1, support email/password only.

---

## Phase 3 — Stripe Checkout for Pro (est. 2-3 hours, after accounts)

Your current code already has the exact seam for this. In `catchem.jsx`, find `PlanModal` — there's a spot where it calls `setPlan("pro")`. That's where Stripe Checkout goes.

### 3a. Stripe setup (30 min)

1. Sign up at [stripe.com](https://stripe.com). Tax forms + bank account required.
2. **Products → Add product**: "Catch'em Pro". Add two prices:
   - **$9/month recurring** → save the price ID (`price_xxxx`)
   - **$89/year recurring** → save the price ID (15% discount vs monthly, nudges annual)
3. Create a [Stripe Payment Link](https://dashboard.stripe.com/payment-links) for each — these are dead simple, no backend code needed.
4. In checkout settings, enable a **14-day free trial**.

### 3b. Wire it in (1-2 hours)

Dedicated Claude session. Say: **"Wire Stripe Payment Links into `setPlan('pro')`. On checkout success, Stripe redirects back to the app with `?checkout=success`; read that, flip the user's `plan` column in Supabase to `pro`, flip `plan_expires_at` to 14 days out."**

For real webhook-based activation (recommended long-term), you'll need a small backend — a single Supabase Edge Function that receives Stripe webhook events and updates the `profiles.plan` column. ~50 lines of code total.

---

## Phase 4 — Pricing & offers strategy

**Recommended launch pricing:**
- **Monthly: $9/mo** — matches your landing page
- **Annual: $89/yr** — saves users $19 vs monthly, nudges to annual (better LTV for you)
- **Launch offer: first 100 waitlist users get 50% off year 1** — reason to sign up the waitlist NOW, not later. Use a Stripe coupon code.

**What to NOT do:**
- Don't offer a free trial AND 50% off. Pick one. Trials convert better.
- Don't price Pro below $5/mo — the perceived value tanks. $9 sounds right, $12 would also work.
- Don't do lifetime deals. They're a trap for software businesses — you pay for serving the user forever against a one-time payment.

---

## Phase 5 — What's NOT in the app yet (honest roadmap)

Things your landing page lists as "Coming soon" that don't exist yet:
- **Real card scanner (ML model)** — needs Ximilar or a custom CV model. $20-100/mo depending on volume.
- **Grade predictor from photo** — needs a trained model. This is a real ML project, not a weekend thing. Realistic delivery: 3-6 months out or a partnership with existing grading services.
- **Card intelligence feed** — the "what to buy this week" daily picks. Needs real eBay sold-listing data (paid API) + editorial content.
- **Real-time supply/demand signals** — needs TCGplayer or eBay sold-listing API access. Against TOS to scrape — either pay for API access or partner.

Don't let Pro users think these are live on day one. The "Coming soon" tags on the pricing section help — keep them honest.

---

## Phase 6 — Post-launch priorities (in order)

1. **Talk to the first 20 users.** Email every waitlist signup personally. Ask what they do with Pokémon cards. Biggest learning you'll ever do.
2. **Fix the scanner.** It's the one thing that will wow people in the first 30 seconds. Everything else is numbers on a screen.
3. **Multi-currency is live** (USD, CAD, GBP, EUR, AUD, JPY, MXN, BRL). Live rates from frankfurter.app, cached 24h. Expand the currency list in `CURRENCIES` if you want more (KRW, CNY, INR, CHF, SEK, etc.).
4. **Whatnot integration.** Biggest live-auction marketplace for Pokémon, supports sellers in the US and Canada natively. No API, but saved-search URLs work the same way as eBay/FB.
5. **Subtype filter inside Sealed** (ETB, Booster Box, UPC). Already noted in code as "coming soon".

---

## Phase 7 — Things to measure

From day one, track:
- **Waitlist → signup conversion rate.** How many of the waitlist actually come back and sign up when you launch? Industry average: 20-40%.
- **Free → Pro conversion rate.** If it's under 2% after a month, your Pro features aren't compelling enough. If it's over 8%, you're probably underpriced.
- **Day-7 retention.** How many users who sign up are still opening the app a week later? This is the leading indicator for product-market fit. Aim for 30%+.

Don't obsess over downloads or signups. Obsess over retention.

---

*Built alongside Catch'em v1.8 · Tyler Baker · 2026*
