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

## Quy ước các màn hình quản trị đã làm (staff / warehouse / admin)

Toàn bộ route của 3 khu vực này đã được triển khai (25/10/2026); khi thêm màn hình mới hãy bắt chước chúng:
- **Danh sách**: model có `normalizeFilters(query)` (whitelist trạng thái/sắp xếp, cắt độ dài, kiểm tra ngày bằng `parseDateStr`) + `search(filters, page)` trả `{ rows, pg, filters }` dùng `paginate()`; SQL dùng cờ `@x = '' OR ...`, `ORDER BY` lấy từ map cố định (không nối chuỗi từ client); view dùng `partials/pager`.
- **Id trong URL/form**: luôn qua `parseId()` (core/helpers) → `null` thì 404 hoặc flash lỗi; không bao giờ `Number(req.params.id)` thẳng vào SQL.
- **Chuyển trạng thái** (duyệt/huỷ/chốt phiếu...) gọi stored procedure; `isBusinessError(e)` → flash `e.message`, lỗi khác ném tiếp. Thủ tục SQL đã tự ghi AuditLogs nên controller KHÔNG ghi thêm; thao tác CRUD thường thì `audit.logInTransaction(tx, ...)` cùng transaction.
- **Bảo vệ tài khoản/quyền** (`admin/user.controller`, `role.controller`): không tự khoá/xoá/đổi vai trò chính mình; không khoá/xoá/hạ quyền admin hoạt động cuối cùng; tài khoản hệ thống NV000 không đụng được; ADMIN luôn giữ `user.manage` + `role.manage`; xoá user đã phát sinh dữ liệu (lỗi FK 547) thì chuyển sang khoá.
- **Phiếu nhập kho**: Nháp → Chốt (`sp_PostGoodsReceipt`) hoặc Huỷ (chỉ khi Nháp); Serial nhập kèm phiếu, số Serial phải đúng bằng số lượng; trùng Serial (lỗi 2627) báo thân thiện kèm giá trị trùng.
- **Địa giới hành chính** lấy từ API (`core/geo.js`, cache 24h, có dự phòng) - không hard-code danh sách phường/xã.
- `requireLogin` khi tài khoản bị khoá phải dùng `session.regenerate` (KHÔNG `destroy` rồi ghi `req.session` - sẽ làm sập server; đã từng gặp). Test giả lập session phải giống express-session thật.

## Placeholder routes (`todo(...)`)

Hiện không còn route nào dùng `todo(...)`; mục này chỉ còn áp dụng nếu bạn dựng khung chức năng mới bằng
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

## Cập nhật 25/10/2026 - mua hàng không cần đăng nhập, Google, email

- **Khách vãng lai**: giỏ lưu trong session (`core/guestCart.js`, chỉ lưu mã + số lượng; giá/tồn luôn đọc lại từ DB). Route giỏ/thanh toán dùng middleware `shopper` (cho khách chưa đăng nhập + khách đã đăng nhập; tài khoản nhân viên bị chuyển đi), KHÔNG dùng `requireRole('CUSTOMER')`. Đăng nhập/đăng ký/Google sẽ gộp giỏ session vào giỏ DB (`core/session.js startSession`, `Cart.mergeEntries`).
- **Thông tin giao hàng chỉ bắt buộc ở bước chốt đơn** (họ tên, SĐT, tỉnh, địa chỉ; khách vãng lai còn phải có email). Đăng ký / Google không bắt buộc SĐT hay địa chỉ (`Customers.Phone` cho phép NULL).
- Đặt hàng gọi `sp_PlaceOrder` (xem skill database). Controller KHÔNG tự tính tiền; quy tắc freeship/VAT trong `checkout.model.calculateTotals` phải khớp procedure.
- **Email**: `core/mailer.js` (nodemailer; chưa cấu hình `SMTP_*` thì ghi file HTML vào `outbox/`), mẫu thư ở `core/mailTemplates.js` (mọi dữ liệu người dùng phải `esc()`). Email xác nhận chứa MÃ ĐƠN + link tra cứu; "Quên mã đơn" (`POST /orders/track/resend`) luôn trả cùng một thông báo và giới hạn 1 lần/phút để không bị dò. Lỗi gửi mail không được làm hỏng đơn hàng (sendMail không throw).
- **Tra cứu đơn khách vãng lai**: bắt buộc cả mã đơn + SĐT (`CustomerOrder.findByNoAndPhone`).
- **Google login**: `controllers/auth/google.controller.js` (OAuth code flow thuần fetch, có `state`, chỉ nhận email đã xác minh, KHÔNG liên kết vào tài khoản admin/nhân viên theo email). Cần `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` trong `.env`.
- **Avatar**: `POST /account/avatar` nhận data URL JPEG đã thu nhỏ, kiểm tra magic bytes + dung lượng, lưu `public/uploads/avatars/` (đã gitignore).
- Bộ lọc danh mục: `Product.facets()` chỉ gợi ý hãng/mức giá có thật trong danh mục (cache 30s); thay đổi sản phẩm nhìn thấy trễ tối đa 30s (gọi `Product.invalidateCatalogCache()` nếu cần ngay).
- Test controller: mock hàm của model/`mailer` bằng cách gán lại thuộc tính module (đừng destructure khi require trong controller, nếu không test không mock được - google controller dùng `sessionCore.startSession` vì lý do này).
