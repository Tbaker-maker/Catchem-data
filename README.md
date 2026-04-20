# catchem-data

Automated daily sealed-product pricing for the Catch'em app. Uses the free eBay Browse API and GitHub Actions. Zero ongoing cost, zero manual work.

## How it works

1. **GitHub Action runs daily** at 4am UTC.
2. **Queries eBay Browse API** for each product in `data/sealed-products.json`.
3. **Aggregates** active listing prices (trimmed median of the cheapest new-condition listings).
4. **Commits** updated `data/sealed-prices.json` back to this repo.
5. **Catch'em app fetches** the JSON via jsDelivr CDN on page load.

Total cost: **$0/month forever.**

## One-time setup (~30 min)

### 1. Create an eBay developer account

Go to https://developer.ebay.com/signin and sign up. It's free, no business verification required.

Once in, go to **My Account → Application Keysets → Production** and you'll see your keys. Copy these two values (you'll need them in step 3):

- **App ID** (also called Client ID)
- **Cert ID** (also called Client Secret)

Default rate limit on Production is **5,000 Browse API calls/day** — enough for 150 products refreshed daily with ~30x headroom. If you ever need more, submit a free [Application Growth Check](https://developer.ebay.com/develop/get-started/application-growth-check) once you have users.

### 2. Create this GitHub repo

Option A — using GitHub CLI:
```bash
cd catchem-data
git init
git add .
git commit -m "Initial commit"
gh repo create catchem-data --public --source=. --remote=origin --push
```

Option B — via GitHub.com:
- Create a new **public** repo named `catchem-data`
- Don't initialize with a README (we have one)
- Follow GitHub's "push an existing repository" instructions

**Why public?** Public repos get unlimited GitHub Actions minutes. Private repos are capped at 2,000 min/month (still plenty, but public is simpler).

### 3. Add eBay credentials as repo secrets

In your new repo on GitHub, go to:

**Settings → Secrets and variables → Actions → New repository secret**

Add two secrets:
- Name: `EBAY_APP_ID` → Value: your eBay App ID
- Name: `EBAY_CERT_ID` → Value: your eBay Cert ID

### 4. Test the action manually

Go to the **Actions** tab in your repo.
- Click **Update sealed prices** in the left sidebar
- Click **Run workflow** → **Run workflow** (green button)
- Wait ~30 seconds, then refresh

If it completed (green checkmark), open `data/sealed-prices.json` in the repo — it should now have real eBay-sourced prices for every product. If it failed, click into the run to see the error (usually a typo in the secret).

### 5. Wire the app

In `catchem.jsx`, the `fetchSealedFromCDN()` function already points to:

```
https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USERNAME/catchem-data@main/data/sealed-prices.json
```

Replace `YOUR_GITHUB_USERNAME` with yours. jsDelivr is a free CDN that serves GitHub repo contents with CORS enabled. Updates propagate within ~10 minutes of a commit.

That's it. Sealed prices will auto-refresh every day forever.

## Adding more products

Edit `data/sealed-products.json` and add entries. The schema:

```json
{
  "id": "unique-slug",                    // stable ID, used for history continuity
  "name": "Human-readable name",
  "set": "Set name",
  "setId": "tcg-api-set-id",              // pokemontcg.io set ID for image lookups
  "subtype": "etb",                        // etb | booster-box | booster-bundle | upc | special-collection
  "searchQuery": "Pokemon Set Name Product sealed",  // eBay search string
  "image": "https://images.pokemontcg.io/setId/logo.png",
  "vintage": false                         // optional: true for 1999-2010 era products
}
```

**Tips for good searchQuery strings:**
- Always start with "Pokemon" to exclude MTG/YGO/other TCG products
- Include the product type ("Booster Box", "Elite Trainer Box")
- Add "sealed" or the era if it helps disambiguate
- Keep under 100 characters
- Test in eBay.com's search bar first — whatever gives clean results there will work in the API

After edits, commit and push. The next daily run picks up the new products.

## Monitoring

- **Actions tab** shows every run with pass/fail status
- **data/sealed-prices.json** has a `lastSeen` field per product showing when it was last successfully priced
- **`dataStatus`** on each product: `live` | `stale` (using previous price) | `unavailable` | `error`

If more than ~15% of products start returning `stale` or `error`, something changed (eBay search syntax, product nomenclature, etc.). Open an issue on yourself to fix.

## Troubleshooting

**"OAuth failed (401)"** — your `EBAY_APP_ID` or `EBAY_CERT_ID` secrets are wrong. Double-check for trailing whitespace.

**"Rate limit exceeded"** — you've hit the default 5,000/day limit. Either cut your product list, or submit an Application Growth Check.

**Some products always return `unavailable`** — the `searchQuery` is too broad or too narrow. Test it manually on eBay.com and refine.

**Action runs but doesn't commit** — check the `permissions:` block in the workflow YAML has `contents: write`.

## Why eBay (not TCGplayer)?

- **TCGplayer API is closed** to new developers since the eBay acquisition (ironic, yes)
- **eBay Marketplace Insights** (real sold prices) is restricted to partner-tier developers only
- **eBay Browse API** (active listings) is free, public, and allows commercial use
- **Active listings approximate market** — you get the lowest asking prices filtered for New condition. For sealed products with lots of liquidity (ETBs, boxes from recent sets), this tracks market well. For thin markets (some vintage), the listing count indicates when prices are less reliable.

Not perfect. But it's real, free, legal, and automated — which is what you asked for.

## License

Catch'em proprietary. Don't redistribute the data.
