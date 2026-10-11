---
name: laptopshop-backend
description: Node.js/Express backend conventions for the Laptop Shop app (src/controllers, src/models, src/routes, src/core). Load before writing or editing any controller, model, route, or middleware in this project — covers the route->controller->model->db layering, transaction/auth/error-handling rules, and the specific mistakes the team's own code review flagged (trusting client data, bypassing stored procedures, stale session permissions).
---

# Laptop Shop — Backend conventions (Express + mssql)

Stack: Express 4 + EJS (`express-ejs-layouts`) + `mssql` (tedious driver) +
`express-session` + `bcryptjs`. No ORM, no ok TypeScript, no bundler — plain
CommonJS. Reference `src/config/db.js` for the query/exec/transaction helpers.

## Layering — don't blur it

`routes/*.routes.js` → `controllers/**/*.controller.js` → `models/**/*.model.js`
→ `db.query`/`db.exec`/`db.transaction`. Every model file's header comment says
it plainly: **"Model = nơi DUY NHẤT chứa câu lệnh SQL"** (the model is the
*only* place SQL text lives). A controller should never build a query string.
A route should never touch the DB directly or contain business logic beyond
wiring middleware → controller method.

**Reference implementation:** `src/controllers/staff/brand.controller.js` +
`src/models/brand.model.js` are explicitly commented as the complete example
("VÍ DỤ HOÀN CHỈNH") every other CRUD module should copy the shape of —
list/form/create/update/delete, flash messages, `audit.log(...)` on every
mutation, and catching specific SQL error numbers (`2627`/`2601` = unique
violation, `547` = FK violation) to turn them into a friendly flash message
instead of a 500. When scaffolding a new CRUD feature, start from that file,
not from scratch.

## Transactions and atomicity

If a route needs more than one write to succeed-or-fail together (place an
order, approve/cancel an order, post a goods receipt), that belongs in a SQL
Server stored procedure (see the `laptopshop-database` skill) called via
`db.exec('sp_Xxx', { ... })` — not as 2+ separate `db.query` calls from Node.
Node-side `db.transaction(async (t) => {...})` exists for cases that
genuinely need several raw statements in one connection/transaction (e.g.
the warehouse flow inserts a Draft `GoodsReceipts` + `GoodsReceiptDetails` +
`ProductSerials` rows before calling `sp_PostGoodsReceipt`); reach for the
stored-procedure path first.

## Trust nothing from the client for money/stock

Never use a client-submitted price, discount, or stock-availability value to
decide what gets charged or reserved. Always re-derive `SalePrice`,
`CostPrice`, discount amount, and available quantity from the database inside
the procedure/query at write time. This is exactly the class of bug the
team's review flagged (cart contents read multiple times at different
moments could disagree with what got charged) — the fix lives in
`sp_PlaceOrderFromCart`'s cart snapshot, but the *principle* — recompute
server-side, never trust the request body for anything financial — applies
to every new write path too.

## Auth — always through `src/core/auth.js`

`requireLogin`, `requireRole(...roles)`, `requirePermission(...perms)` all
re-check `IsActive` and the current role against the DB on **every request**
(via `Account.getAuthState`), not just at login — a locked account or a
changed role takes effect immediately, not after the session expires. Don't
write an ad-hoc `if (req.session.user) {...}` check in a controller; always
route through one of these three. Apply them in the route file, not inside
the controller body (see every `router.get/post(...)` in
`src/routes/staff-sales.routes.js` for the pattern: `requirePermission('x.y')`
as route middleware, controller stays auth-agnostic).

On the client/view side, `res.locals.currentUser.permissions` is the same
array the middleware checks — a nav link/button the user can't use should be
hidden with `<% if (currentUser.permissions.includes('x.y')) { %>`, not just
left for the server to 403 after a click.

## Error handling

- Wrap every async route handler in `asyncHandler` (`src/core/asyncHandler.js`,
  imported as `wrap` in route files) so a rejected promise reaches Express's
  error middleware instead of crashing/hanging the request.
- A stored procedure's `THROW 50xxx` is an expected business-rule failure, not
  a server error — check it with `helpers.isBusinessError(err)` and show
  `err.message` (already in Vietnamese from the `THROW`) via `req.flash`,
  don't let it fall through to a generic 500 page.
- Known SQL error numbers worth catching specifically in a `try/catch` around
  a mutating model call: `2627`/`2601` (unique constraint), `547` (FK
  constraint — "this is still referenced elsewhere, can't delete").

## Session and identity

`req.session.user` (set once, in `auth.controller.js` `login`) is the single
source of truth for who's logged in: `{ accountId, username, fullName, role,
employeeId, customerId, permissions }`. If you add a field here, check whether
`Account.getAuthState`/`requireLogin`'s per-request revalidation needs to
refresh it too — don't let the revalidated subset (role/permissions today)
silently drift from what login sets.

Passwords: `bcryptjs` only, always via `bcrypt.compare`/`bcrypt.hash`. Never
log, flash, or render `PasswordHash`. Never add a "remember password in
plaintext" convenience anywhere.

## Writing to the DB — don't bypass procedures

Never issue a raw `UPDATE`/`INSERT` against `Orders`, `ProductSerials`,
`Products` stock columns, etc. from app code (or demo/seed scripts) when a
stored procedure already owns that transition. Beyond being inconsistent,
`trg_Orders_StatusGuard`/`trg_ProductSerials_StatusGuard` will now actively
reject structurally-invalid direct transitions — and even a *valid* direct
write skips the audit log row, invoice, loyalty points, etc. that the
procedure is responsible for.

## Audit logging

Any state-changing staff/admin action should produce an `AuditLogs` row.
Follow the `audit.log(req, action, entityName, entityId, detail)` call
pattern already used in `brand.controller.js` and inside the stored
procedures — don't skip it because another part of the same request already
logged something unrelated.

## Placeholder routes (`todo(...)`)

Most routes in this codebase currently render `todo(res, {...})`
(`src/core/todo.js`) — a scaffold describing the module owner, route, tasks,
and `"db"` objects to use. When implementing one for real:
1. Verify the `"db"` hint still matches the actual schema/procs — table names
   drift (the review caught stale references to tables that had been
   dropped/renamed). Check `database/01_schema.sql`/`02_programmability.sql`
   before copying the hint verbatim.
2. Replace the whole `todo(...)` call with `res.render(...)`/`res.redirect(...)`
   — don't leave a dead `todo` import/call alongside real logic.
3. Follow the brand CRUD reference for the shape (flash + audit + specific
   error-number handling), not a from-scratch design.

## Config

`.env` (gitignored) holds real local credentials; `.env.example` stays
placeholder-only. `src/config/db.js` reads `DB_SERVER`/`DB_PORT`/`DB_INSTANCE`/
`DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_ENCRYPT`/`DB_TRUST_CERT` — don't
hardcode connection details anywhere else.
