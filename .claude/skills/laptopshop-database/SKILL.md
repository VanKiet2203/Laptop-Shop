---
name: laptopshop-database
description: T-SQL / SQL Server conventions for the Laptop Shop database (database/01_schema.sql, 02_programmability.sql, 03_seed.sql). Load before writing or editing any table, CHECK constraint, trigger, view, or stored procedure in this project — encodes real bugs already found and fixed in this exact codebase (CHECK operator precedence, state-machine bypass, cart race conditions, sequence truncation, CTE-in-subquery syntax errors) so they don't get reintroduced.
---

# Laptop Shop — Database conventions (SQL Server / T-SQL)

This project's DB layer lives in three files, run in this exact order against a
fresh `LaptopShopDB`: `database/01_schema.sql` → `02_programmability.sql` →
`03_seed.sql`. `01_schema.sql` starts with `DROP DATABASE` — it is destructive by
design (dev-only). After any schema edit, re-run all three in order to verify.

Local dev instance on this machine: SQL Server 2022 Developer, default instance
`MSSQLSERVER` on `localhost`, Mixed Mode enabled, app login `laptopshop_app`
(`.env` already has it). `sqlcmd` lives at `C:\Program Files\SqlCmd\sqlcmd.exe`
(not on PATH). Quick verify loop:

```
& "C:\Program Files\SqlCmd\sqlcmd.exe" -S localhost -E -i database\01_schema.sql -b
& "C:\Program Files\SqlCmd\sqlcmd.exe" -S localhost -E -i database\02_programmability.sql -b
& "C:\Program Files\SqlCmd\sqlcmd.exe" -S localhost -E -i database\03_seed.sql -b
```
`-E` = Windows auth (the dev Windows account is sysadmin on this instance) —
use it instead of asking for a password when just verifying scripts run clean.

## Core architecture rule

Business transactions (place order, approve order, cancel order, post goods
receipt, complete order, confirm payment/refund) live in **stored procedures**
wrapped in `BEGIN TRAN ... COMMIT TRAN` with `SET XACT_ABORT ON`, not as
loose multi-statement sequences in app code. Node only calls `EXEC`. If you're
adding a new multi-step write that must be all-or-nothing, it belongs in
`02_programmability.sql` as a new procedure, following the shape of the
existing ones (`sp_PlaceOrderFromCart`, `sp_ApproveOrder`, `sp_CancelOrder`,
`sp_CompleteOrder`).

## Bugs already hit in this codebase — don't reintroduce these

**1. CHECK constraint operator precedence.** `AND` binds tighter than `OR`.
`CHECK (PaidAmount >= 0 AND PaidAmount <= TotalAmount OR Status = 'Draft')`
parses as `(PaidAmount >= 0 AND PaidAmount <= TotalAmount) OR (Status = 'Draft')`
— meaning *any* `PaidAmount`, including negative, passes while `Status = 'Draft'`.
Always parenthesize explicitly when mixing `AND`/`OR` in a CHECK:
`CHECK (PaidAmount >= 0 AND (PaidAmount <= TotalAmount OR Status = 'Draft'))`.

**2. A CTE can't be nested inside `IF EXISTS(...)`, a derived table, or any
other sub-expression.** `IF EXISTS (WITH cte AS (...) SELECT 1 FROM cte)`
fails with `Incorrect syntax near 'WITH'` — SQL Server requires a CTE to be
its own statement (optionally preceded by `;`). This bit `trg_Categories_NoCycle`
in `01_schema.sql` on first real run. Fix pattern: materialize the CTE result
into a `#temp` table as its own statement, then `IF EXISTS (SELECT 1 FROM #temp)`
against that:
```sql
;WITH chain AS (...)
SELECT StartId INTO #CategoryCycleCheck FROM chain WHERE CategoryId = StartId;

IF EXISTS (SELECT 1 FROM #CategoryCycleCheck) THROW 50002, N'...', 1;
DROP TABLE #CategoryCycleCheck;
```

**3. Don't let a state-machine column (`Orders.Status`, `ProductSerials.Status`)
be reachable by direct `UPDATE` from anywhere — app code, seed scripts, ad-hoc
fixes — without going through the procedure that enforces the transition. Even
inside `03_seed.sql`, call `sp_CompleteOrder` rather than
`UPDATE dbo.Orders SET Status = 'Completed' ...` directly. As defense in depth,
`trg_Orders_StatusGuard` / `trg_ProductSerials_StatusGuard` in `01_schema.sql`
reject structurally-invalid transitions (e.g. `Pending -> Completed`,
skipping `Approved`) regardless of entry point — extend their allow-list
when you add a legitimate new transition, don't work around them.

**4. Don't re-read a mutable source table multiple times across one
transaction.** `sp_PlaceOrderFromCart` used to `SELECT` from `CartItems`
three separate times (reserve stock, compute subtotal, insert order lines) —
a concurrent cart edit between those reads could make the reserved quantity,
the charged total, and the inserted line items disagree. Fix pattern: snapshot
the source with a lock at the top of the transaction into a temp table, and
do every subsequent read from that snapshot only:
```sql
SELECT ci.ProductId, ci.Quantity, p.SalePrice, p.CostPrice
INTO #Cart
FROM dbo.CartItems ci
JOIN dbo.Products p WITH (UPDLOCK, HOLDLOCK) ON p.ProductId = ci.ProductId
WHERE ci.CartId = @CartId;
-- every later step (reserve, subtotal, INSERT INTO OrderDetails) reads from #Cart
```

**5. Sequence-to-document-number padding must never truncate.**
`RIGHT('00000' + CAST(@Seq AS VARCHAR(10)), 5)` silently drops leading digits
once `@Seq >= 100000`, so e.g. seq `100000` and seq `0` both produce `00000`
— a real collision in `OrderNo`/`InvoiceNo`/`ReceiptNo`. Pad to the minimum
width but never cut the number itself:
```sql
DECLARE @SeqStr VARCHAR(10) = CAST(@Seq AS VARCHAR(10));
SET @DocNo = 'DH' + FORMAT(SYSDATETIME(),'yyMM') + '-'
  + RIGHT(REPLICATE('0',5) + @SeqStr, CASE WHEN LEN(@SeqStr) > 5 THEN LEN(@SeqStr) ELSE 5 END);
```

**6. Don't use `OR` across two different columns for an identity/uniqueness
lookup.** `WHERE Username = @x OR Email = @x` is ambiguous the moment one
account's `Username` equals a *different* account's `Email`. Either query one
column at a time (try exact match on the primary field, fall back to the
secondary one only if the first misses — see `account.model.js
findForLogin`), or add a trigger that rejects the cross-collision at write
time (see `trg_Accounts_NoCrossLogin`).

**7. Validate the acting identity inside the procedure, not just in the
session.** Every procedure that takes `@AccountId` (or similar) should check
the account exists, `IsActive = 1`, and is actually authorized for *this* row
(the row's own customer, or an employee) before mutating anything — a
revoked/locked account's old session shouldn't still be able to act (see
`sp_CancelOrder`'s ownership check, `sp_ApproveOrder`/`sp_PostGoodsReceipt`'s
active-employee check).

**8. Don't collapse a real-world confirmation step into an automatic status
flip.** Cancelling an order that was already `Paid` is not the same event as
"money has actually been refunded" — model it as `PaymentStatus =
'RefundPending'` plus a separate `sp_ConfirmRefund` procedure that a human
calls after the refund actually happens, not an automatic `'Refunded'` inside
`sp_CancelOrder`.

**9. `INSERT ... OUTPUT INSERTED.col VALUES (...)` fails if the target table has
an enabled trigger.** SQL Server error: *"The target table ... of the DML
statement cannot have any enabled triggers if the statement contains an OUTPUT
clause without INTO clause."* `Accounts` has `trg_Accounts_NoCrossLogin`, so
app-layer inserts into it (e.g. customer self-registration, see
`customer.model.js createWithAccount`) can't use the bare `OUTPUT` form. Fix:
`OUTPUT ... INTO` a table variable, then `SELECT` from that:
```sql
DECLARE @ids TABLE (AccountId INT);
INSERT INTO dbo.Accounts (Username, Email, PasswordHash, RoleId)
OUTPUT INSERTED.AccountId INTO @ids
VALUES (@username, @email, @passwordHash, @roleId);
SELECT AccountId FROM @ids;
```
Applies to any table with a trigger — currently `Accounts`, `Orders`,
`ProductSerials`, `Categories` (see the trigger list in `01_schema.sql`). Plain
tables without triggers (`Carts`, `Customers`, ...) don't need this.

## Constraints and schema hygiene

- Give every business-numeric column (rates, percentages, discount caps,
  totals) an explicit `CHECK` range. Don't skip it just because "the UI will
  always send a sane value" — direct writes, migrations, and future features
  won't all go through that UI.
- Size `VARCHAR`/`NVARCHAR` columns for real-world data, not just today's seed
  values — e.g. `ProductImages.ImageUrl` was `VARCHAR(300)` until real scraped
  product image URLs (300+ chars with CDN transform paths) overflowed it; it's
  now `VARCHAR(500)`. When seeding real external data, check max length first.
- After any `01_schema.sql` edit, keep `docs/DATABASE_DICTIONARY.md` in sync.
  It's generated by `tools/gen_dictionary.py` (parses column/CHECK comments
  from `01_schema.sql`) — run it if Python is available; otherwise hand-edit
  the affected table's row/Check line to match.
- When a table is dropped/renamed (e.g. `OrderStatusHistory` and
  `StockMovements` were folded into `AuditLogs`), `grep` the whole repo for
  the old name — it tends to survive in TODO hint strings
  (`"db": "...OrderStatusHistory..."` in `todo(res, {...})` calls) and model
  file header comments long after the table itself is gone.
- Every column needs a trailing `-- mô tả` comment (see the file header note
  in `01_schema.sql`) — the dictionary generator depends on it.
