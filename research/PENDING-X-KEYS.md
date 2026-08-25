# X API keys — exactly what to do

About ten minutes. This is the only step in the whole system that needs a human.

---

## THE ORDERING TRAP — read this first

**Set permissions to Read and Write BEFORE you generate the access tokens.**

If you generate tokens first and change permissions after, **the tokens keep the
old read-only permission** and every post attempt returns a 403. This is the
single most common failure in X API setup, and the error message doesn't tell
you that's what happened.

If you get it in the wrong order: go back, fix the permission, then
**regenerate** the access token and secret.

---

## Step 1 — Sign in

Go to **`console.x.com`** and sign in as **@LongedEth**.

Not developer.x.com. The console replaced it.

---

## Step 2 — Accept the Developer Agreement

You'll be asked for a use case description, **250 characters minimum**. Use
this:

> Scheduling and analytics tool for my own Pokémon trading card account. It
> posts card images that I generate myself from public card data, and reads the
> public engagement metrics on my own posts so I can see which formats perform
> best. Single account, no data collection from other users, no surveillance, no
> off-platform matching, no AI training.

Those last three phrases matter — surveillance, off-platform matching and AI
training are the categories X explicitly rejects, so saying you're not doing
them helps.

**Approval is instant now.** No waiting.

---

## Step 3 — New App

Click **New App**. Name it `Catchem Scheduler` or anything you like.

---

## Step 4 — Permissions, BEFORE tokens

In the app → **User authentication settings** → **Set up**:

| field | value |
|---|---|
| App permissions | **Read and Write** |
| Type of App | **Automated App or Bot** |
| Callback URI | `https://catchemtcg.com/callback` |
| Website URL | `https://catchemtcg.com` |

**Save.**

---

## Step 5 — Keys and tokens

Go to **Keys and tokens**. Generate everything. You need **five values**:

```
X_API_KEY
X_API_KEY_SECRET
X_ACCESS_TOKEN
X_ACCESS_TOKEN_SECRET
X_BEARER_TOKEN
```

**They're shown exactly once.** Copy all five into a note or password manager
before you close the page. If you lose them you have to regenerate, which
**invalidates the old set immediately** and breaks anything using them.

If the access token was generated before you set Read and Write in step 4,
**regenerate it now**.

---

## Step 6 — Credits

**Billing → add $5.**

At $0.015 per post and $0.001 per read of your own posts, that's:

- 2 posts a day = **$0.90/month**
- reading those posts 3× each = **$0.18/month**

**$5 is months of runway.** There's no free tier — with a zero balance the API
just stops.

---

## Step 7 — Where they go

**Paste them to CC, not into this chat and not into any file in the repo.**

Message CC with:

> Store these as GitHub Actions secrets on `Tbaker-maker/Catchem-data`, then
> wire `--send` in `scripts/post-queue.mjs` and the fetch in
> `scripts/read-metrics.mjs`. See `research/PENDING-CLOSE-THE-LOOP.md`.
>
> X_API_KEY=...
> X_API_KEY_SECRET=...
> X_ACCESS_TOKEN=...
> X_ACCESS_TOKEN_SECRET=...
> X_BEARER_TOKEN=...

CC puts them in **Settings → Secrets and variables → Actions** on the repo.

**Never in a file. Never committed.** Anyone with these can post as you and
spend your credits.

---

## Step 8 — What CC does next

1. Store the five secrets.
2. Wire `--send` in `post-queue.mjs`, storing the returned tweet id on the post.
3. Wire the fetch in `read-metrics.mjs` — call `due`, read each id's public
   metrics, call `record`.
4. Cron it hourly. It does nothing when nothing is due.
5. Send one real post through the queue and confirm it round-trips.

---

## How you'll know it worked

```
node scripts/post-queue.mjs list       shows what's waiting and the cost
node scripts/read-metrics.mjs due      shows what needs a reading
node scripts/log-outcome.mjs --report  starts filling by itself
```

**When the outcome log climbs past 20 without you typing anything, the loop is
closed** — and every rule we've written about what works becomes testable
instead of asserted.

---

## If posting returns 403

It's almost always step 4 done after step 5. Fix the permission, regenerate the
access token and secret, update the secrets.
