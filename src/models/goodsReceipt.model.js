// Thành viên 1 - Hệ thống & Kho: phiếu nhập kho. Model = nơi DUY NHẤT chứa SQL của nhóm chức năng này.
// Bảng / thủ tục liên quan: GoodsReceipts, GoodsReceiptDetails, ProductSerials, sp_PostGoodsReceipt, sq_ReceiptNo
// Luồng: create() lưu phiếu Nháp (+ Serial "Chờ nhập kho") trong 1 transaction -> post() gọi sp_PostGoodsReceipt (cộng tồn,
// kích hoạt Serial, cập nhật giá vốn) | cancel() chỉ cho phiếu Nháp.
const db = require('../config/db');
const { paginate } = require('../core/helpers');

const PAGE_SIZE = 15;

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

exports.normalizeFilters = (q = {}) => ({
  q: str(q.q, 30),
  month: /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month || '') ? q.month : '',
  supplierId: /^\d{1,9}$/.test(String(q.supplierId || '')) ? String(Number(q.supplierId)) : '',
  status: ['Draft', 'Posted', 'Cancelled'].includes(q.status) ? q.status : '',
});

exports.search = async (filters, page) => {
  const f = exports.normalizeFilters(filters);
  const params = { ...f, monthStart: f.month ? `${f.month}-01` : '' };
  const where = `WHERE (@q = '' OR g.ReceiptNo LIKE '%' + @q + '%' OR s.SupplierName LIKE '%' + @q + '%')
      AND (@monthStart = '' OR (g.ReceiptDate >= @monthStart AND g.ReceiptDate < DATEADD(MONTH, 1, CAST(@monthStart AS DATE))))
      AND (@supplierId = '' OR g.SupplierId = TRY_CAST(@supplierId AS INT))
      AND (@status = '' OR g.Status = @status)`;
  const join = 'FROM dbo.GoodsReceipts g JOIN dbo.Suppliers s ON s.SupplierId = g.SupplierId JOIN dbo.Employees e ON e.EmployeeId = g.EmployeeId';
  const agg = await db.queryOne(
    `SELECT COUNT(*) AS n, ISNULL(SUM(CASE WHEN g.Status = 'Posted' THEN g.TotalAmount END), 0) AS postedTotal ${join} ${where}`, params);
  const pg = paginate(page, PAGE_SIZE, agg.n);
  const rows = await db.query(
    `SELECT g.ReceiptId, g.ReceiptNo, g.ReceiptDate, g.Status, g.TotalAmount, g.PaidAmount, g.DueDate,
            s.SupplierName, e.FullName AS EmployeeName,
            (SELECT COUNT(*) FROM dbo.GoodsReceiptDetails d WHERE d.ReceiptId = g.ReceiptId) AS LineCount,
            (SELECT ISNULL(SUM(d.Quantity), 0) FROM dbo.GoodsReceiptDetails d WHERE d.ReceiptId = g.ReceiptId) AS TotalQty
     ${join} ${where}
     ORDER BY g.ReceiptId DESC
     OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...params, offset: pg.offset, size: pg.pageSize });
  return { rows, pg, filters: f, postedTotal: agg.postedTotal };
};

/** Giá trị nhập (phiếu đã chốt) theo từng tháng của một năm: [{ month: 1..12, receipts, amount }] đủ 12 tháng */
exports.monthlyTotals = async (year) => {
  const rows = await db.query(
    `SELECT MONTH(ReceiptDate) AS m, COUNT(*) AS receipts, SUM(TotalAmount) AS amount
     FROM dbo.GoodsReceipts WHERE Status = 'Posted' AND YEAR(ReceiptDate) = @year GROUP BY MONTH(ReceiptDate)`, { year });
  return Array.from({ length: 12 }, (_, i) => {
    const r = rows.find((x) => x.m === i + 1);
    return { month: i + 1, receipts: r ? r.receipts : 0, amount: r ? Number(r.amount) : 0 };
  });
};

exports.counts = async () => {
  const rows = await db.query('SELECT Status, COUNT(*) AS n FROM dbo.GoodsReceipts GROUP BY Status');
  const out = { Draft: 0, Posted: 0, Cancelled: 0 };
  rows.forEach((r) => { out[r.Status] = r.n; });
  return out;
};

exports.recent = (top = 6) => db.query(
  `SELECT TOP (@top) g.ReceiptId, g.ReceiptNo, g.ReceiptDate, g.Status, g.TotalAmount, s.SupplierName
   FROM dbo.GoodsReceipts g JOIN dbo.Suppliers s ON s.SupplierId = g.SupplierId ORDER BY g.ReceiptId DESC`, { top });

exports.monthSummary = () => db.queryOne(
  `SELECT COUNT(*) AS receipts, ISNULL(SUM(TotalAmount), 0) AS amount
   FROM dbo.GoodsReceipts
   WHERE Status = 'Posted' AND ReceiptDate >= DATEADD(DAY, 1 - DAY(CAST(SYSDATETIME() AS DATE)), CAST(SYSDATETIME() AS DATE))`);

/** Sản phẩm có thể nhập (đang kinh doanh) cho form lập phiếu */
exports.productOptions = () => db.query(
  `SELECT ProductId, Sku, ProductName, IsSerialTracked, CostPrice, QtyOnHand
   FROM dbo.Products WHERE IsActive = 1 ORDER BY ProductName`);

exports.productsByIds = (ids) => (ids.length
  ? db.query(`SELECT ProductId, Sku, ProductName, IsSerialTracked, IsActive FROM dbo.Products WHERE ProductId IN (${ids.map((_, i) => `@p${i}`).join(',')})`,
    Object.fromEntries(ids.map((id, i) => [`p${i}`, id])))
  : Promise.resolve([]));

exports.findById = async (receiptId) => {
  const receipt = await db.queryOne(
    `SELECT g.ReceiptId, g.ReceiptNo, g.SupplierId, g.ReceiptDate, g.Status, g.TotalAmount, g.PaidAmount, g.DueDate, g.Note,
            s.SupplierName, s.TaxCode, s.Phone AS SupplierPhone, s.Address AS SupplierAddress, s.PaymentTermDays,
            e.FullName AS EmployeeName, e.EmployeeCode
     FROM dbo.GoodsReceipts g
     JOIN dbo.Suppliers s ON s.SupplierId = g.SupplierId
     JOIN dbo.Employees e ON e.EmployeeId = g.EmployeeId
     WHERE g.ReceiptId = @receiptId`, { receiptId });
  if (!receipt) return null;
  receipt.lines = await db.query(
    `SELECT d.ReceiptDetailId, d.ProductId, d.Quantity, d.UnitCost, d.LineTotal, p.Sku, p.ProductName, p.IsSerialTracked
     FROM dbo.GoodsReceiptDetails d JOIN dbo.Products p ON p.ProductId = d.ProductId
     WHERE d.ReceiptId = @receiptId ORDER BY d.ReceiptDetailId`, { receiptId });
  const serials = await db.query(
    `SELECT s.ReceiptDetailId, s.SerialNumber, s.Status
     FROM dbo.ProductSerials s JOIN dbo.GoodsReceiptDetails d ON d.ReceiptDetailId = s.ReceiptDetailId
     WHERE d.ReceiptId = @receiptId ORDER BY s.SerialId`, { receiptId });
  receipt.lines.forEach((l) => { l.serials = serials.filter((s) => s.ReceiptDetailId === l.ReceiptDetailId); });
  receipt.computedTotal = receipt.lines.reduce((sum, l) => sum + Number(l.LineTotal), 0);
  return receipt;
};

/**
 * Lưu phiếu nhập NHÁP + dòng chi tiết + Serial (Pending) trong cùng 1 transaction.
 * data = { supplierId, note, paidAmount, items: [{ productId, qty, unitCost, serials: [] }] } (đã được controller kiểm tra)
 */
exports.create = (data, employeeId, onCreated) => db.transaction(async (tx) => {
  const total = data.items.reduce((sum, i) => sum + i.qty * i.unitCost, 0);
  const noRow = await tx.query(
    `DECLARE @s INT = NEXT VALUE FOR dbo.sq_ReceiptNo, @str VARCHAR(10);
     SET @str = CAST(@s AS VARCHAR(10));
     SELECT 'PN' + FORMAT(SYSDATETIME(), 'yyMM') + '-' + RIGHT(REPLICATE('0', 5) + @str, CASE WHEN LEN(@str) > 5 THEN LEN(@str) ELSE 5 END) AS ReceiptNo`);
  const receiptNo = noRow[0].ReceiptNo;
  const head = await tx.query(
    `INSERT INTO dbo.GoodsReceipts (ReceiptNo, SupplierId, EmployeeId, Status, TotalAmount, PaidAmount, Note)
     VALUES (@receiptNo, @supplierId, @employeeId, 'Draft', @total, @paid, @note);
     SELECT CAST(SCOPE_IDENTITY() AS INT) AS ReceiptId`,
    { receiptNo, supplierId: data.supplierId, employeeId, total, paid: data.paidAmount, note: data.note || null });
  const receiptId = head[0].ReceiptId;
  for (const item of data.items) {
    const line = await tx.query(
      `INSERT INTO dbo.GoodsReceiptDetails (ReceiptId, ProductId, Quantity, UnitCost) VALUES (@receiptId, @productId, @qty, @unitCost);
       SELECT CAST(SCOPE_IDENTITY() AS INT) AS ReceiptDetailId`,
      { receiptId, productId: item.productId, qty: item.qty, unitCost: item.unitCost });
    for (const serial of item.serials) {
      await tx.query(
        `INSERT INTO dbo.ProductSerials (ProductId, SerialNumber, ReceiptDetailId, Status) VALUES (@productId, @serial, @detailId, 'Pending')`,
        { productId: item.productId, serial, detailId: line[0].ReceiptDetailId });
    }
  }
  if (onCreated) await onCreated(tx, receiptId, receiptNo);
  return { receiptId, receiptNo };
});

/** Chốt phiếu: cộng tồn, kích hoạt Serial, cập nhật giá vốn - toàn bộ nằm trong sp_PostGoodsReceipt */
exports.post = (receiptId, accountId) => db.exec('sp_PostGoodsReceipt', { ReceiptId: receiptId, AccountId: accountId });

/** Huỷ phiếu NHÁP: xoá Serial chờ nhập, đổi trạng thái Cancelled. Trả về false nếu phiếu không còn ở trạng thái Nháp. */
exports.cancelDraft = (receiptId, onCancelled) => db.transaction(async (tx) => {
  const rows = await tx.query('SELECT Status FROM dbo.GoodsReceipts WITH (UPDLOCK, ROWLOCK) WHERE ReceiptId = @receiptId', { receiptId });
  if (!rows[0]) return 'notFound';
  if (rows[0].Status !== 'Draft') return 'notDraft';
  await tx.query(
    `DELETE s FROM dbo.ProductSerials s JOIN dbo.GoodsReceiptDetails d ON d.ReceiptDetailId = s.ReceiptDetailId
     WHERE d.ReceiptId = @receiptId AND s.Status = 'Pending'`, { receiptId });
  await tx.query("UPDATE dbo.GoodsReceipts SET Status = 'Cancelled' WHERE ReceiptId = @receiptId", { receiptId });
  if (onCancelled) await onCancelled(tx);
  return 'ok';
});

exports.PAGE_SIZE = PAGE_SIZE;
