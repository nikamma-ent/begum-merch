# Begum: We Are Okay! Tour merch pre-orders

A small pre-order site. Fans pick a show, pick tees and sizes, pay with Razorpay, and get a pickup code to show at the merch table.

The site runs on GitHub Pages and the backend on Cloudflare Workers, both free (commercial use allowed, no card needed). The only cost is Razorpay's per-transaction fee.

## What's in here

```
public/            The site (GitHub Pages): index.html, app.js, styles.css, policy pages
  img/             Hero art, rose ornament and floral frame, cut from the tour poster
src/worker.js      The backend (Cloudflare Worker): routes + CORS
src/api/           Its endpoints
  config.js        GET  /api/config        catalogue + stock left
  order.js         POST /api/order         creates order, holds stock, opens Razorpay order
  verify.js        POST /api/verify        confirms payment after checkout
  webhook.js       POST /api/webhook       Razorpay webhook (backup if a buyer closes the tab)
  admin/orders.js  GET  /api/admin/orders  pickup lists and print counts as CSV
src/catalog.js     ← EDIT THIS: prices, designs, dates, cutoffs, stock caps, size chart
schema.sql         Database tables (Cloudflare D1)
apps-script/       Optional Google Sheet sync for pickup lists
```

## Before launch: fill these in

1. **`src/catalog.js`**
   - Design names, one-line descriptions, prices
   - Tee photos: put them in `public/img/` and set `image: "/img/tee-a.jpg"`. Square images look best.
   - Pre-order cutoffs (`ordersCloseAt`). Cities, venues and dates are already set from the tour poster.
   - Size chart from your printer
   - Stock caps, if you want them (leave `null` for unlimited print-to-order)
2. **Policy pages** (`public/terms.html`, `refunds.html`, `privacy.html`, `contact.html`): replace `[SELLER LEGAL NAME]`, `[CONTACT EMAIL]`, `[CONTACT PHONE]`, `[REGISTERED ADDRESS]`. Use the entity that owns the Razorpay account. Read the refund policy and adjust it to what you actually want to offer.

## Deploy (about 30 minutes)

Two parts: the **site** on GitHub Pages, and the **backend** (payments, orders, stock) as a free Cloudflare Worker.

You need: a GitHub account, a free Cloudflare account, Node.js installed.

### 1. Backend: Cloudflare Worker
```bash
npm install
npx wrangler login
npx wrangler d1 create begum-merch
```
Copy the `database_id` it prints into `wrangler.toml`, then:
```bash
npm run db:init
npx wrangler secret put RAZORPAY_KEY_ID
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
npx wrangler secret put ADMIN_TOKEN
npm run deploy
```
Each `secret put` asks you to paste the value:

| Name | Value |
|---|---|
| `RAZORPAY_KEY_ID` | From Razorpay → Account & Settings → API Keys. Start with the **test** key (`rzp_test_…`). |
| `RAZORPAY_KEY_SECRET` | Shown once when you generate the key. |
| `RAZORPAY_WEBHOOK_SECRET` | Any long random string. You'll paste the same value in Razorpay (step 3). |
| `ADMIN_TOKEN` | Any long random string. Used for the CSV download links. |
| `SHEET_WEBHOOK_URL`, `SHEET_TOKEN` | Optional, see "Google Sheet pickup lists" below. |

Generate random strings with: `openssl rand -hex 24`

`npm run deploy` prints the backend address, e.g. `https://begum-merch.yourname.workers.dev`. Call it `API` below.

### 2. Site: GitHub Pages
1. In `public/index.html`, set `<meta name="api-base" content="…">` to your `API` address.
2. Create a GitHub repo and push this folder to it (branch `main`).
3. Repo → Settings → Pages → Source: **GitHub Actions**. The included workflow publishes `public/` on every push. The site appears at `https://yourname.github.io/REPO/`.
4. In `wrangler.toml`, add your Pages origin to `ALLOWED_ORIGINS` (just `https://yourname.github.io`, no path), then `npm run deploy` again. Without this, the site can't talk to the backend.

**Custom domain (optional):** repo → Settings → Pages → Custom domain, e.g. `merch.begum.in`. Add that origin to `ALLOWED_ORIGINS` too.

### 3. Razorpay settings
- **Webhook:** Account & Settings → Webhooks → Add. URL: `API/api/webhook`. Secret: your `RAZORPAY_WEBHOOK_SECRET`. Events: `payment.captured` and `order.paid`.
- **Auto-capture:** Account & Settings → Payment capture → make sure payments are captured automatically. Otherwise money stays "authorized" and gets refunded after a few days.
- **Website:** add your site's address to the account if Razorpay asks. It needs the Terms, Refunds, Privacy and Contact pages live, which this site has.

### 4. Test, then go live
With test keys, place a few orders using Razorpay's test cards/UPI (see Razorpay docs → Test card details). Check:
- You see the pickup code screen
- The order shows up in the CSV and the Sheet
- Closing the payment window leaves nothing charged

Then replace `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` with your **live** keys (`npx wrangler secret put …` again), set up the webhook again in live mode, and `npm run deploy`. Test orders stay in the database. To clear them before launch:
```bash
npx wrangler d1 execute begum-merch --remote --command "DELETE FROM order_items; DELETE FROM orders; DELETE FROM stock;"
```

## Running the shows

**Print counts for the printer:**
`API/api/admin/orders?token=ADMIN_TOKEN&view=summary`

**Pickup list for one city** (`delhi`, `goa`, `mumbai`, `bangalore`):
`API/api/admin/orders?token=ADMIN_TOKEN&city=goa`

Both download as CSV. Print the city list sorted by name, or use the Google Sheet on a phone at the merch table and tick "Picked up".

Don't share links with the token in them publicly.

## Google Sheet pickup lists (optional)

Every paid order gets added to a Google Sheet: one "All orders" tab plus one tab per city, each with a "Picked up" checkbox.

1. Create a new Google Sheet.
2. Extensions → Apps Script. Replace the code with `apps-script/Code.gs`.
3. Change `TOKEN` at the top to a long random string.
4. Deploy → New deployment → type **Web app**. Execute as: **Me**. Who has access: **Anyone**. Authorize when asked.
5. Copy the web app URL.
6. Run `npx wrangler secret put SHEET_WEBHOOK_URL` (paste that URL) and `npx wrangler secret put SHEET_TOKEN` (same token).

If you edit the script later, use Deploy → Manage deployments → edit → New version, so the URL stays the same.

The database stays the source of truth. If the Sheet ever misses an order, the CSV link still has everything.

## How it behaves

- **Stock holds:** when someone starts paying, their tees are held for 20 minutes. Razorpay's checkout times out at 15, so abandoned checkouts free up stock automatically.
- **Late payments:** if a payment somehow lands after the hold expired, the order is still marked paid and the stock is taken back (this can go over a cap by a little).
- **Double reporting:** the browser and the webhook can both confirm the same payment. That's expected and only counts once.
- **Closing pre-orders:** set `ordersCloseAt` for a city and `npm run deploy`. After that time, that city shows "Pre-orders closed".
- **Limits:** up to 5 of any one design and size, 10 tees per order. Change in `LIMITS`.
- **Refunds:** do these from the Razorpay dashboard. The site doesn't un-mark refunded orders, so strike them off the pickup list by hand.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in test keys
npm run db:init:local
npm run dev                       # backend on http://localhost:8787
npm run site                      # site on http://localhost:8788 (second terminal)
```
On localhost the site talks to the local backend automatically.
