# Laptop Shop

A full-stack e-commerce and back-office system for a laptop & PC-components retailer. Customers browse and buy online; sales staff, warehouse staff and administrators run the business from role-specific dashboards.

Built with **Node.js (Express + EJS, MVC)** and **SQL Server**. Business-critical logic (placing, approving and cancelling orders, posting goods receipts) lives in **stored procedures** so stock and payment state stay consistent even under concurrent requests.

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Demo accounts](#demo-accounts)
- [Card payments with Stripe (test mode)](#card-payments-with-stripe-test-mode)
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
| **Sales** | `/staff` | Sales staff | Review and approve/cancel orders; issue and print invoices; warranty lookup; revenue and best-seller reports; manage products, categories, brands and attributes; answer customer chat |
| **Warehouse** | `/warehouse` | Warehouse staff | Manage suppliers; create, post, cancel and print goods receipts; stock levels, serial-number lookup and stock movements |
| **Admin** | `/admin` | Administrators | Manage user accounts; roles and permissions (RBAC); audit log |

Highlights:

- **Inventory that stays correct.** Stock is reserved when an order is placed, deducted on approval and released on cancellation. Serial numbers are assigned to sold units and warranties are created automatically.
- **Several payment methods.** Cash on delivery, bank transfer (VietQR), instalments and card payment through **Stripe Checkout**.
- **Guest checkout.** Guests can order without an account and look an order up later with the order number plus phone number.
- **Customer chat with an AI assistant.** If no staff member replies in time, an assistant powered by Google Gemini answers; it stops as soon as a human takes over. A keyword-based fallback works without any API key.
- **Membership tiers and promotions.** Loyalty points and tier upgrades on completed orders; percent and fixed-amount promo codes with usage limits.
- **Auditability.** Every state change and sensitive action is written to an audit log.
- **Vietnamese UI.** The interface is in Vietnamese; money is in VND.

## Tech stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 18+ |
| Web framework | Express 4, EJS templates, express-ejs-layouts |
| UI | Bootstrap 5 (served locally from `public/vendor`) and a custom SVG icon sprite |
| Database | Microsoft SQL Server 2017+ via `mssql`, T-SQL stored procedures, triggers and views |
| Auth | `express-session` (stored in SQL Server), `bcryptjs`, optional Google OAuth |
| Payments | Stripe Checkout |
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

Run these scripts from `database/` in order, in the **same connection window**:

```text
01_schema.sql  ->  02_programmability.sql  ->  03_seed.sql
```

`01_schema.sql` drops and recreates `LaptopShopDB`. `03_seed.sql` loads sample data and (re)creates the `laptopshop_app` login with the right permissions.

> **Upgrading a database created before Stripe support?** Run these as a SQL admin (for example `sa` or Windows authentication in SSMS), because `laptopshop_app` cannot alter schema:
>
> ```text
> 04_migration_stripe.sql  ->  05_migration_stripe_confirm_guard.sql
> ```
>
> Both are idempotent. A fresh database built from scripts 01 and 02 does not need them.

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
| `PORT`, `APP_URL` | Port and public base URL (used in email links and Stripe return URLs) |
| `SESSION_SECRET` | Session signing secret. **Required** in production |
| `DB_SERVER`, `DB_PORT`, `DB_INSTANCE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`, `DB_TRUST_CERT` | SQL Server connection |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe card payments. The Stripe option is hidden at checkout until `STRIPE_SECRET_KEY` is set |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | "Sign in with Google" (optional) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Order confirmation, password reset and order-code emails. Without `SMTP_HOST`, emails are written to `outbox/` as HTML files |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `CHAT_AI_*` | AI chat assistant (a free Gemini key is enough) |
| `NODE_ENV`, `TRUST_PROXY`, `SESSION_STORE`, `PENDING_HOLD_HOURS`, `SHOW_DEMO_ACCOUNTS` | Operations and hardening, see [Security](#security) |

## Demo accounts

All demo accounts use the password `123456`.

| Username | Role | Entry point |
| --- | --- | --- |
| `admin` | Administrator | `/admin` |
| `sales1`, `sales2` | Sales staff | `/staff` |
| `kho1` | Warehouse staff | `/warehouse` |
| `khach1`, `khach2`, `khach3` | Customer | `/` |

The login page shows these accounts in development. Set `SHOW_DEMO_ACCOUNTS=false` to hide them.

## Card payments with Stripe (test mode)

1. Create a free Stripe account and switch the dashboard to **Test mode**.
2. Copy the keys from **Developers -> API keys** into `.env`:

   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

3. Restart the server, add a product to the cart and choose **Credit / debit card** at checkout. You are redirected to Stripe's hosted payment page.
4. Pay with the test card `4242 4242 4242 4242`, any future expiry date and any CVC. Use `4000 0000 0000 0002` to simulate a declined card.

**How payment is confirmed.** The order is created first with payment status *Pending*. It becomes *Paid* only when Stripe confirms the money was collected, through either of two idempotent paths: the return page (`/checkout/stripe/return`, which re-checks the session with Stripe) or the webhook. Staff cannot mark a Stripe order as paid by hand.

**Webhook (optional).** The return page is enough for local development. To also receive webhooks, install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run:

```bash
stripe listen --forward-to localhost:3000/stripe/webhook
```

Put the `whsec_...` secret it prints into `STRIPE_WEBHOOK_SECRET`.

## Project structure

```text
.
|-- database/
|   |-- 01_schema.sql                          tables and constraints
|   |-- 02_programmability.sql                 triggers, views, stored procedures
|   |-- 03_seed.sql                            sample data and app login
|   `-- 04_*, 05_*                             migrations for older databases
|-- src/
|   |-- server.js, app.js                      startup and Express setup
|   |-- config/                                database connection and checks
|   |-- core/                                  auth (RBAC), sessions, mail, Stripe, rate limiting, helpers
|   |-- routes/                                one file per area
|   |-- controllers/                           parse request, call model, render view
|   |   |-- admin/  auth/  customer/  staff/  store/  warehouse/
|   |-- models/                                the only place that contains SQL
|   `-- views/                                 EJS layouts, partials and pages
|-- public/                                    CSS, JS, images, vendored Bootstrap
|-- docs/                                      database dictionary
|-- tools/                                     report, diagram and screenshot generators
`-- .env.example                               configuration template
```

## Architecture notes

- **Layering.** `routes -> controllers -> models -> database`. Controllers never contain SQL; models use parameterised queries only.
- **Stored procedures for business rules.** Placing an order reserves stock atomically, approving it deducts stock and assigns serial numbers, cancelling it releases stock, and posting a goods receipt updates stock, serials and cost. Node only calls `db.exec(...)`.
- **Order lifecycle.** `Pending -> Approved -> Completed`, or `Cancelled` at any point before completion. Single-item orders with serials in stock are approved automatically; larger orders wait for staff to confirm availability. Payment status is tracked separately (`Pending`, `Paid`, `RefundPending`, `Refunded`).
- **RBAC.** Roles map to fine-grained permissions (for example `order.approve`, `receipt.post`, `user.manage`). Routes check permissions with `requirePermission(...)`, and permissions are reloaded so changes take effect without a new login.
- **Reusable list pages.** Filtering and pagination go through `paginate()` in `core/helpers.js` and `views/partials/pager.ejs`; every filter is normalised against an allow-list in the model.

## Security

- Helmet security headers with a Content Security Policy, gzip compression.
- Session cookies are `HttpOnly` and `SameSite=Lax` (and `Secure` in production); sessions are stored in SQL Server and the session ID is regenerated on login.
- CSRF protection by checking `Origin`/`Referer` on every state-changing request.
- Rate limits on login, registration, password reset, checkout, order lookup and chat. Repeated failed logins lock the account/IP pair for 15 minutes.
- Passwords are hashed with bcrypt. Changing a password signs out every other session of that account.
- Stripe keys are read only on the server. Card data never touches this app.
- Abuse limits on guest checkout: at most 3 pending orders and 10 orders per 24 hours per phone number. Orders left in "pending review" are cancelled automatically after 48 hours in production (`PENDING_HOLD_HOURS`).

**Production checklist:** set `NODE_ENV=production`, a random `SESSION_SECRET`, `TRUST_PROXY=1` when behind a proxy, and `SHOW_DEMO_ACCOUNTS=false`.

## Testing

```bash
npm test
```

Runs the unit tests with Node's built-in runner. They do not need SQL Server or any external service.

## Documentation

- [Database dictionary and ERD](docs/DATABASE_DICTIONARY.md) - every table, column, key and constraint.
- Sample data, accounts and promo codes are defined in `database/03_seed.sql`.
