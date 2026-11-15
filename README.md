# Laptop Shop

A full-stack e-commerce and back-office system for a laptop & PC-components retailer. Customers browse and buy online; sales staff, warehouse staff and administrators run the business from role-specific dashboards.

Built with **Node.js (Express + EJS, MVC)** and **SQL Server**. Business-critical logic (placing, approving and cancelling orders, recording payments, posting goods receipts) lives in **stored procedures** so stock and payment state stay consistent even under concurrent requests.

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Sample data](#sample-data)
- [Payments](#payments)
  - [Bank transfer (VietQR) with SePay](#bank-transfer-vietqr-with-sepay)
  - [Card payments with Stripe (test mode)](#card-payments-with-stripe-test-mode)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Architecture notes](#architecture-notes)
- [Security](#security)
- [Testing](#testing)
- [Documentation](#documentation)

## Features

The app is split into four areas, each with its own layout and permission set.

| Area | URL | Who | What they can do |
| --- | --- | --- | --- |
| **Storefront** | `/` | Customers and guests | Browse, search, filter and sort products; shopping cart; checkout with promo codes; order history and tracking; profile and address book; live chat |
| **Sales** | `/staff` | Sales staff | Review and approve/cancel orders; confirm payments and refunds; issue and print invoices; warranty lookup; revenue and best-seller reports; manage products, categories, brands and attributes; answer customer chat |
| **Warehouse** | `/warehouse` | Warehouse staff | Manage suppliers; create, post, cancel and print goods receipts; stock levels, serial-number lookup and stock movements |
| **Admin** | `/admin` | Administrators | Manage user accounts; roles and permissions (RBAC); audit log |

Highlights:

- **Inventory that stays correct.** Stock is reserved when an order is placed, deducted on approval and released on cancellation. Serial numbers are assigned to sold units and warranties are created automatically.
- **Four payment methods.** Cash on delivery, bank transfer with a **VietQR code confirmed automatically by SePay**, instalments, and card payment through **Stripe Checkout**.
- **Pay first, then approve.** Bank-transfer and Stripe orders cannot be approved until the money has arrived; a paid single-item order is then approved automatically.
- **One clear order status for customers.** The order page, progress bar, confirmation page and email all combine the processing state and the payment state for the chosen payment method (for example "Waiting for payment", "Paid, being checked").
- **Guest checkout.** Guests can order without an account and look an order up later with the order number plus phone number.
- **Customer chat with an AI assistant.** If no staff member replies in time, an assistant powered by Google Gemini answers; it stops as soon as a human takes over. A keyword-based fallback works without any API key.
- **Membership tiers and promotions.** Loyalty points and tier upgrades on completed orders; percent and fixed-amount promo codes with usage limits and validity dates.
- **Auditability.** Every state change and sensitive action (including each payment) is written to an audit log.
- **Vietnamese UI.** The interface is in Vietnamese; money is in VND.

## Tech stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 18+ |
| Web framework | Express 4, EJS templates, express-ejs-layouts |
| UI | Bootstrap 5 (served locally from `public/vendor`) and a custom SVG icon sprite |
| Database | Microsoft SQL Server 2017+ via `mssql`, T-SQL stored procedures, triggers and views |
| Auth | `express-session` (stored in SQL Server), `bcryptjs`, optional Google OAuth |
| Payments | SePay (VietQR bank transfer), Stripe Checkout |
| Email | Nodemailer (falls back to HTML files in `outbox/`) |
| AI chat | Google Gemini API |
| Hardening | Helmet (CSP), gzip compression, CSRF origin check, rate limiting |
| Tests | Node's built-in test runner (`node --test`) |

## Getting started

### Prerequisites

- **Node.js 18 or newer**
- **SQL Server 2017 or newer** with SQL authentication enabled (Mixed Mode)
- SSMS or Azure Data Studio to run the SQL scripts

### 1. Create the database

Run these scripts from `database/` **once each, in this order**:

```text
01_schema.sql  ->  02_programmability.sql  ->  03_seed.sql
```

- `01_schema.sql` drops and recreates `LaptopShopDB`.
- `02_programmability.sql` creates the stored procedures the seed and the app depend on.
- `03_seed.sql` loads sample data and (re)creates the `laptopshop_app` login permissions.

`03_seed.sql` can only be run once on an empty database. To start over, run all three again from `01_schema.sql`.

### 2. Configure the app

```bash
cp .env.example .env     # on Windows: copy .env.example .env
```

Set at least `DB_SERVER`, `DB_USER`, `DB_PASSWORD` and `SESSION_SECRET`. Everything else is optional (see [Configuration](#configuration)).

### 3. Install and run

```bash
npm install
npm run db:check    # verifies the database connection
npm run dev         # starts with auto-reload
```

Open <http://localhost:3000>. Use `npm start` for a plain run.

## Configuration

All settings are environment variables, documented inline in [`.env.example`](.env.example).

| Variable | Purpose |
| --- | --- |
| `PORT`, `APP_URL` | Port and public base URL (used in email links, Stripe return URLs and the CSRF origin check, so it must match the address users open) |
| `SESSION_SECRET` | Session signing secret. **Required** in production |
| `DB_SERVER`, `DB_PORT`, `DB_INSTANCE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`, `DB_TRUST_CERT` | SQL Server connection |
| `SEPAY_API_KEY` | SePay API token. Authenticates the webhook (`Authorization: Apikey ...`) and the polling worker. Leave empty to turn SePay off |
| `SEPAY_POLL`, `SEPAY_POLL_SECONDS`, `SEPAY_API_BASE` | Polling mode: the server asks the SePay API for new transfers (no public URL needed). `SEPAY_API_BASE` selects live or sandbox, see [SePay](#bank-transfer-vietqr-with-sepay) |
| `SEPAY_ACCOUNT`, `SEPAY_BANK_CODE`, `SEPAY_BANK_NAME`, `SEPAY_ACCOUNT_HOLDER` | Receiving bank account shown in the QR code. When `SEPAY_ACCOUNT` is set, only transfers to that account are accepted |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe card payments. The Stripe option is hidden at checkout until `STRIPE_SECRET_KEY` is set |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | "Sign in with Google" (optional) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Order confirmation, password reset and order-code emails. Without `SMTP_HOST`, emails are written to `outbox/` as HTML files |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `CHAT_AI_*` | AI chat assistant (a free Gemini key is enough) |
| `NODE_ENV`, `TRUST_PROXY`, `SESSION_STORE`, `PENDING_HOLD_HOURS` | Operations and hardening, see [Security](#security) |

## Sample data

`database/03_seed.sql` creates a realistic data set so every screen has something to show:

- Accounts for every role (administrator, sales, warehouse, customers). The account names and the shared password are listed at the top of the seed file.
- About 100 products across laptops, RAM, SSDs, mice, keyboards, headsets, bags and chargers, from several brands and price ranges.
- **Varied stock on purpose**: some products are sold out, many are low, others medium or high, so filters, stock badges and low-stock alerts look different.
- A dozen customers across several provinces (one with a company tax code), spread over the loyalty tiers.
- Several suppliers and goods receipts in every state (posted, draft, cancelled; paid, partly paid, unpaid, due soon).
- Promo codes that are active, expired and not yet started.
- About 40 orders over three months using all four payment methods and every state: completed, approved, waiting for payment, paid and waiting for review, cancelled, refund pending and refunded.

## Payments

Every order is created first with payment status *Pending*. Payment status (`Pending`, `Paid`, `RefundPending`, `Refunded`) is tracked separately from the order status (`Pending`, `Approved`, `Completed`, `Cancelled`).

| Method | How it is paid | Who marks it paid |
| --- | --- | --- |
| Cash on delivery | Cash on delivery | Automatically when staff complete the delivery |
| Bank transfer | Customer scans the VietQR code on the order page | SePay (webhook or polling); staff can also confirm by hand |
| Instalments | Staff contact the customer about the plan | Staff confirm the payment |
| Card (Stripe) | Stripe's hosted checkout page | Stripe only; staff cannot mark it paid by hand |

### Bank transfer (VietQR) with SePay

The order page shows a VietQR code with the amount and the order number (for example `DH2611-00001`) as the transfer note. The page checks every few seconds and refreshes itself as soon as the payment is recorded.

**How a transfer is matched.** SePay reports each incoming transfer. The server finds the order number in the transfer note (banks often drop the dash or add text, so `DH261100001` also matches) and records the transfer in `SepayTransactions` through `sp_MarkPaidBySepay`:

| Situation | Result |
| --- | --- |
| Order number found, amount equal to or above the total | Order becomes *Paid* |
| Amount below the total | Recorded as *Underpaid*; the order stays unpaid |
| Order already cancelled | Order becomes *RefundPending* |
| Order already paid, or not a bank-transfer order | Recorded, order unchanged |
| No order number in the note | Recorded as *NoOrder* |
| Same SePay transaction reported again | Ignored (idempotent) |

Once an order is *Paid*, a single-item order with serials in stock is approved automatically. Orders with several items wait for staff to check stock.

**Two ways to receive transfers** (use either or both; the database makes it safe):

1. **Polling (no public URL needed).** Set `SEPAY_POLL=true` and the server asks the SePay API every `SEPAY_POLL_SECONDS` seconds (default 5) while at least one bank-transfer order is waiting. It works on any machine that has the same token in `.env`.
2. **Webhook.** In SePay, create a webhook pointing to `https://<your public domain>/sepay/webhook`, authentication type **API Key**, with the same value as `SEPAY_API_KEY`. Running locally needs a tunnel such as ngrok.

**Trying it without real money (SePay Test mode).**

1. In [my.sepay.vn](https://my.sepay.vn) switch on **Test mode**, add a test bank account, and create a token under **API Access**.
2. Put it in `.env` and point the server at the sandbox API:

   ```env
   SEPAY_API_KEY=<test mode token>
   SEPAY_POLL=true
   SEPAY_API_BASE=https://userapi-sandbox.sepay.vn/v2
   ```

3. Place a bank-transfer order, open **Simulate transaction** in SePay, choose the test account and enter the exact amount and the order number as the note. The order page switches to *Paid* within a few seconds.

For live transfers remove `SEPAY_API_BASE` (the default is `https://userapi.sepay.vn/v2`), use a live token, and set `SEPAY_ACCOUNT` and the other `SEPAY_*` bank fields so the QR code shows your real account.

### Card payments with Stripe (test mode)

1. Create a free Stripe account and switch the dashboard to **Test mode**.
2. Copy the keys from **Developers -> API keys** into `.env`:

   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

3. Restart the server, add a product to the cart and choose **Credit / debit card** at checkout. You are redirected to Stripe's hosted payment page.
4. Pay with one of [Stripe's test cards](https://docs.stripe.com/testing), any future expiry date and any CVC.

**How payment is confirmed.** The order becomes *Paid* only when Stripe confirms the money was collected, through either of two idempotent paths: the return page (`/checkout/stripe/return`, which re-checks the session with Stripe) or the webhook. A paid single-item order is then approved automatically.

**Webhook (optional).** The return page is enough for local development. To also receive webhooks, install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run:

```bash
stripe listen --forward-to localhost:3000/stripe/webhook
```

Put the `whsec_...` secret it prints into `STRIPE_WEBHOOK_SECRET`.

## Deployment

The app needs Node.js and a SQL Server database. For a public deployment:

- Run the three SQL scripts against the production SQL Server once (the scripts expect a full SQL Server; managed variants such as Azure SQL Database need small changes to `01_schema.sql`, which uses `USE master` and `CREATE DATABASE`).
- Set `NODE_ENV=production`, a random `SESSION_SECRET` and `TRUST_PROXY=1` when running behind a proxy or platform router.
- Set `APP_URL` to the exact public address (`https://...`). The CSRF origin check compares against it, so a wrong value makes every form post fail with 403.
- Set the `DB_*` variables; use `DB_ENCRYPT=true` when the provider requires TLS.
- Give SePay the webhook URL `https://<domain>/sepay/webhook`, or keep `SEPAY_POLL=true`. On hosts that put idle apps to sleep, the webhook also wakes the server.
- Platforms that provide a `PORT` variable work out of the box; start the app with `npm start`.

## Project structure

```text
.
|-- database/
|   |-- 01_schema.sql                          tables and constraints
|   |-- 02_programmability.sql                 triggers, views, stored procedures
|   `-- 03_seed.sql                            sample data and app login
|-- src/
|   |-- server.js, app.js                      startup and Express setup
|   |-- config/                                database connection and checks
|   |-- core/                                  auth (RBAC), sessions, mail, Stripe, SePay, rate limiting, helpers
|   |-- routes/                                one file per area
|   |-- controllers/                           parse request, call model, render view
|   |   |-- admin/  auth/  customer/  staff/  store/  warehouse/
|   |-- models/                                the only place that contains SQL
|   `-- views/                                 EJS layouts, partials and pages
|-- public/                                    CSS, JS, images, vendored Bootstrap
|-- docs/                                      database dictionary, module split
|-- tools/gen_dictionary.py                    regenerates the database dictionary
`-- .env.example                               configuration template
```

## Architecture notes

- **Layering.** `routes -> controllers -> models -> database`. Controllers never contain SQL; models use parameterised queries only.
- **Stored procedures for business rules.** Placing an order reserves stock atomically, approving it deducts stock and assigns serial numbers, cancelling it releases stock, recording a payment updates the payment state, and posting a goods receipt updates stock, serials and cost. Node only calls `db.exec(...)`.
- **Order lifecycle.** `Pending -> Approved -> Completed`, or `Cancelled` at any point before completion. Cash-on-delivery and instalment orders with a single item and serials in stock are approved at once. Bank-transfer and Stripe orders are approved only after they are paid (`sp_ApproveOrder` refuses unpaid ones, `sp_AutoApproveIfEligible` approves the single-item case right after payment). Larger orders wait for staff to confirm availability. Prepaid orders must be *Paid* before they can be completed.
- **Customer-facing status.** `orderStage`, `orderSteps` and `orderBadge` in `core/helpers.js` turn the two states into the wording, progress bar and badge shown on the order pages and in emails, so each payment method tells a coherent story.
- **Payment gateways.** `core/stripe.js`, `core/sepay.js` and `core/sepaySync.js` talk to the providers; the models only call stored procedures. Every payment path is idempotent, so webhooks and polling can overlap safely.
- **RBAC.** Roles map to fine-grained permissions (for example `order.approve`, `receipt.post`, `user.manage`). Routes check permissions with `requirePermission(...)`, and permissions are reloaded so changes take effect without a new login.
- **Reusable list pages.** Filtering and pagination go through `paginate()` in `core/helpers.js` and `views/partials/pager.ejs`; every filter is normalised against an allow-list in the model.

## Security

- Helmet security headers with a Content Security Policy, gzip compression.
- Session cookies are `HttpOnly` and `SameSite=Lax` (and `Secure` in production); sessions are stored in SQL Server and the session ID is regenerated on login.
- CSRF protection by checking `Origin`/`Referer` on every state-changing request. The payment webhooks are outside this check and are authenticated instead (Stripe signature, SePay API key compared in constant time).
- Rate limits on login, registration, password reset, checkout, order lookup and chat. Repeated failed logins lock the account/IP pair for 15 minutes. The checkout limit (20 per hour per IP) counts only orders that were actually placed.
- Passwords are hashed with bcrypt. Changing a password signs out every other session of that account.
- Payment keys are read only on the server. Card data never touches this app.
- Abuse limits on checkout: at most 3 unpaid pending orders and 10 orders per 24 hours per phone number (orders that are already paid do not count towards the first limit). Orders left in "pending review" are cancelled automatically after 48 hours in production (`PENDING_HOLD_HOURS`), which also releases the reserved stock.

**Production checklist:** set `NODE_ENV=production`, a random `SESSION_SECRET`, `TRUST_PROXY=1` when behind a proxy, and `APP_URL` to the public address.

## Testing

```bash
npm test
```

Runs the unit tests with Node's built-in runner. They do not need SQL Server or any external service.

## Documentation

- [Database dictionary and ERD](docs/DATABASE_DICTIONARY.md) - every table, column, key and constraint.
- [Module split](docs/MODULES.md) - how the work is divided between the four modules (in Vietnamese).
- Sample data, accounts and promo codes are defined in `database/03_seed.sql`.
