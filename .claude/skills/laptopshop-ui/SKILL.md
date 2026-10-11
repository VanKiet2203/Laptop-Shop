---
name: laptopshop-ui
description: UI conventions for the Laptop Shop EJS + Bootstrap 5 server-rendered views (src/views/**). Load before writing or editing any .ejs view, layout, or partial in this project. This is a multi-role back-office + small storefront app (store/staff/warehouse/admin), NOT a marketing landing page — do not apply flashy agency/SaaS-landing design patterns (glassmorphism, Framer Motion, Tailwind) here; this project has no bundler, no React, no Tailwind, just Bootstrap 5 via CDN and plain EJS.
---

# Laptop Shop — UI conventions (EJS + Bootstrap 5)

This is a **server-rendered admin/e-commerce back-office**, not a marketing
site: four roles (customer storefront, sales staff, warehouse staff, admin),
data tables, forms, dashboards — usability and correctness matter more than
visual flair. Don't reach for the `high-end-visual-design` skill's landing-page
aesthetic (glass cards, scroll-reveal animations, banned-font lists, Tailwind
utility classes) here; it targets a different kind of project entirely.

## Stack reality — stay inside it

Bootstrap 5 (`bootstrap.min.css`) + Bootstrap Icons (`bi bi-*`) via CDN, loaded
once in `src/views/partials/head.ejs` / `partials/scripts.ejs`. Plain EJS with
`express-ejs-layouts`. No React/Vue, no Tailwind, no bundler, no client-side
framework beyond small inline `<script>` blocks. Don't introduce a new library
or build step for one page — if a page needs real interactivity, write plain
JS against the DOM, matching what's already there.

Four layouts, one per role area — reuse the matching one via the
`useLayout('layouts/xxx')` middleware (set in the relevant `*.routes.js`),
don't duplicate nav/shell markup inside an individual view:
- `layouts/store.ejs` — public storefront + logged-in customer
- `layouts/staff.ejs` — sales staff
- `layouts/warehouse.ejs` — warehouse staff
- `layouts/admin.ejs` — admin

## Shared helpers — use them, don't hand-roll

`src/core/helpers.js` is spread onto every view's locals (`locals.js`). Use
these instead of ad-hoc formatting so there's one place to fix rounding/locale
bugs later:
- `fmtMoney(n)` for every VND amount — never hand-roll `toLocaleString` or
  paste `₫` next to a raw number.
- `fmtDate(d)` / `fmtDateTime(d)` for every date/datetime column.
- `paginate(page, pageSize, total)` → `{ page, pageSize, total, pages, offset }`
  — use this shape consistently for every paginated list; render pager links
  as a Bootstrap `<nav><ul class="pagination">`, don't invent a different
  pager per view.
- Status-label maps like `ORDER_STATUS` (`{label, cls}` per DB enum value,
  rendered as `<span class="badge bg-<%= ORDER_STATUS[o.Status].cls %>">`).
  **When a DB enum column gains a new value, add it to the matching map in
  `helpers.js` in the same change** — e.g. `Orders.PaymentStatus` now
  includes `RefundPending`/`Refunded` at the DB level; any view that renders
  `PaymentStatus` needs a label for them too, or it'll render `undefined`.

## Security — EJS escaping is not optional

- `<%= value %>` (auto-escapes HTML) for **any** value that came from a
  database column or user/customer input — product names, SKUs, notes,
  addresses, search queries, everything. This project has several free-text
  fields a customer or staff member controls directly (`Orders.Note`,
  `CustomerAddresses.*`, `Products.Description`, search `q`) — rendering one
  of those with `<%- %>` is a stored-XSS hole.
- `<%- %>` (raw, unescaped) only for trusted, pre-built markup you wrote
  yourself — partial includes (`<%- include(...) %>`), the layout `body`,
  content you've explicitly sanitized. Never `<%- %>` a DB column.

## Permission-aware rendering

`res.locals.currentUser.permissions` is the same permission array the server
checks via `requirePermission` (see the `laptopshop-backend` skill). A nav
link or action button the current user can't use shouldn't just 403 on click
— gate it in the view: `<% if (currentUser.permissions.includes('order.cancel')) { %>`.
Keep the permission string identical to what the route uses.

## Forms, tables, feedback — match the established pattern

Reference implementation: `src/views/staff/brands/index.ejs` +
`src/views/staff/brands/form.ejs` (paired with the `brand.controller.js`
"complete example"). Copy its shape for new CRUD screens:
- List view: search form up top, `<table class="table table-hover bg-white
  align-middle">`, action buttons right-aligned (`text-end`), explicit
  "Không có dữ liệu" empty-state row when the list is empty — never render a
  bare empty `<table>`.
- Wrap any table that can get wide (orders, serials, invoices, product
  attributes) in `<div class="table-responsive">` — staff/warehouse users use
  this on tablets too, don't assume desktop-only.
- Every state-changing POST (delete, cancel, void) needs a confirmation:
  `<form method="post" ... onsubmit="return confirm('...')">`. A bare submit
  button on a destructive action is a misclick away from data loss.
- Every POST handler that redirects should have set a flash message first
  (`req.flash('success'|'danger'|'warning', ...)`) — a silent redirect after
  a mutation leaves the user unsure whether it worked. `partials/flash.ejs`
  is already included in every layout's `main`.

## Accessibility baseline

- Every `<img>` gets `alt`.
- Every icon-only button/link (`<button><i class="bi bi-x"></i></button>`)
  gets `aria-label` or visually-hidden text — icons alone aren't
  screen-reader accessible.
- Label every form input with `<label for="id">` matching the input's `id`;
  a placeholder is not a label.

## Consistency over novelty

Match what's already established — Bootstrap defaults, `bi-*` icons,
`container`/`py-4`/`mb-3` spacing rhythm from the existing layouts — rather
than introducing one-off custom CSS per page. If a chunk of markup shows up
in two views (a status-badge snippet, a pagination block, a product card),
promote it to `src/views/partials/` instead of copy-pasting.

## Visual polish & micro-interactions

The whole app currently looks flat/generic because `public/css/app.css` —
the **one file** every layout loads (via `partials/head.ejs`) — is only ~20
lines of bare Bootstrap overrides (one product-card hover, flat sidebar
colors, no shadows, no transitions anywhere else). When asked to make a page
"look nicer," add real, systemic CSS to this one file (page-specific
`<style>` only as a last resort for something genuinely one-off), not inline
`style=""` attributes scattered across views.

This is still a dense, data-heavy internal tool used all day by staff — the
goal is **tasteful, fast polish**, not a marketing-site experience. A few
well-placed transitions and a real shadow/elevation system read as "designed"
immediately; don't add scroll-triggered reveal animations, page-transition
overlays, or anything that would slow down someone scanning a 50-row order
table.

Define tokens once, reuse everywhere:
```css
:root {
  --ls-radius: .75rem;
  --ls-shadow-sm: 0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1);
  --ls-shadow-md: 0 4px 12px rgba(16,24,40,.08), 0 2px 4px rgba(16,24,40,.06);
  --ls-ease: cubic-bezier(.4,0,.2,1);
}
```

Give Bootstrap's flat `.card` real elevation + a lift on hover:
```css
.card { border: 0; border-radius: var(--ls-radius); box-shadow: var(--ls-shadow-sm);
  transition: box-shadow .2s var(--ls-ease), transform .2s var(--ls-ease); }
.card.card-hover:hover { box-shadow: var(--ls-shadow-md); transform: translateY(-2px); }
```

Buttons get a touch of press/hover feedback (Bootstrap's defaults are instant,
no motion at all):
```css
.btn { transition: transform .12s var(--ls-ease), box-shadow .12s var(--ls-ease); }
.btn:active { transform: scale(.97); }
```

Table rows, flash messages, and the main content area get a subtle
fade-in/transition instead of popping in statically:
```css
.table-hover tbody tr { transition: background-color .12s var(--ls-ease); }
.alert, main.container { animation: ls-fade-up .3s var(--ls-ease) both; }
@keyframes ls-fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
```

Extend the two hover effects that already exist rather than inventing a
different style per page — `.product-card:hover` (storefront) and
`.stat-card` (dashboards) should both use the same `--ls-shadow-md` lift as
`.card.card-hover` above, plus a soft image zoom on the product card:
```css
.product-card img { transition: transform .3s var(--ls-ease); }
.product-card:hover img { transform: scale(1.04); }
```

Rules while adding this:
- Animate only `transform`, `opacity`, `box-shadow`, `background-color` —
  never `width`/`height`/`top`/`left` (layout thrash).
- Respect motion sensitivity: `@media (prefers-reduced-motion: reduce) { *,
  *::before, *::after { animation: none !important; transition: none
  !important; } }` once, near the bottom of `app.css`.
- **Keep the existing per-role accent colors** — `panel-admin` slate
  (`#1f2937`), `panel-staff` teal (`#0f766e`), `panel-warehouse` rust
  (`#9a3412`), and the store's blue/purple hero gradient. That color coding
  is a real wayfinding cue (instant "which area am I in" signal) — polish it
  with better shadows/spacing/motion, don't flatten it into one global
  palette.
