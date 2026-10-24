// Thành viên 1 - Hệ thống & Kho: nhà cung cấp. Model = nơi DUY NHẤT chứa SQL của nhóm chức năng này.
// Bảng / view liên quan: Suppliers, GoodsReceipts, vw_SupplierPayables
const db = require('../config/db');
const { paginate } = require('../core/helpers');

const PAGE_SIZE = 15;
const SORTS = {
  name: 's.SupplierName',
  debt_desc: 'ISNULL(pay.Outstanding, 0) DESC, s.SupplierName',
  purchased_desc: 'ISNULL(pay.TotalPurchased, 0) DESC, s.SupplierName',
  newest: 's.SupplierId DESC',
};

exports.normalizeFilters = (query = {}) => ({
  q: typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '',
  status: ['active', 'inactive'].includes(query.status) ? query.status : '',
  sort: SORTS[query.sort] ? query.sort : 'name',
});

exports.search = async (filters, page) => {
  const f = exports.normalizeFilters(filters);
  const where = `WHERE (@q = '' OR s.SupplierName LIKE '%' + @q + '%' OR s.TaxCode LIKE '%' + @q + '%'
                         OR s.ContactName LIKE '%' + @q + '%' OR s.Phone LIKE '%' + @q + '%')
                   AND (@status = '' OR (@status = 'active' AND s.IsActive = 1) OR (@status = 'inactive' AND s.IsActive = 0))`;
  const total = (await db.queryOne(`SELECT COUNT(*) AS n FROM dbo.Suppliers s ${where}`, f)).n;
  const pg = paginate(page, PAGE_SIZE, total);
  const rows = await db.query(
    `SELECT s.SupplierId, s.SupplierName, s.TaxCode, s.ContactName, s.Phone, s.Email, s.PaymentTermDays, s.IsActive,
            ISNULL(pay.TotalPurchased, 0) AS TotalPurchased, ISNULL(pay.Outstanding, 0) AS Outstanding,
            (SELECT COUNT(*) FROM dbo.GoodsReceipts g WHERE g.SupplierId = s.SupplierId) AS ReceiptCount
     FROM dbo.Suppliers s
     LEFT JOIN dbo.vw_SupplierPayables pay ON pay.SupplierId = s.SupplierId
     ${where}
     ORDER BY ${SORTS[f.sort]}
     OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...f, offset: pg.offset, size: pg.pageSize });
  return { rows, pg, filters: f };
};

/** Tổng công nợ phải trả toàn bộ NCC (hiện trên đầu trang danh sách) */
exports.totals = () => db.queryOne(
  `SELECT COUNT(*) AS suppliers, SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS active,
          (SELECT ISNULL(SUM(Outstanding), 0) FROM dbo.vw_SupplierPayables) AS outstanding
   FROM dbo.Suppliers`);

/** NCC đang hợp tác, dùng cho ô chọn khi lập phiếu nhập / lọc */
exports.options = (includeInactive = false) => db.query(
  `SELECT SupplierId, SupplierName, PaymentTermDays, IsActive FROM dbo.Suppliers
   ${includeInactive ? '' : 'WHERE IsActive = 1'} ORDER BY SupplierName`);

exports.findById = (id) => db.queryOne('SELECT * FROM dbo.Suppliers WHERE SupplierId = @id', { id });

const params = (d) => ({
  supplierName: d.supplierName, taxCode: d.taxCode || null, contactName: d.contactName || null, phone: d.phone || null,
  email: d.email || null, address: d.address || null, paymentTermDays: d.paymentTermDays, isActive: d.isActive ? 1 : 0,
});

exports.create = async (d, transaction = null) => {
  const query = transaction ? transaction.query : db.query;
  const rows = await query(
    `INSERT INTO dbo.Suppliers (SupplierName, TaxCode, ContactName, Phone, Email, Address, PaymentTermDays, IsActive)
     VALUES (@supplierName, @taxCode, @contactName, @phone, @email, @address, @paymentTermDays, @isActive);
     SELECT CAST(SCOPE_IDENTITY() AS INT) AS SupplierId`, params(d));
  return rows[0] ? rows[0].SupplierId : null;
};

exports.update = async (id, d, transaction = null) => {
  const query = transaction ? transaction.query : db.query;
  const rows = await query(
    `UPDATE dbo.Suppliers SET SupplierName = @supplierName, TaxCode = @taxCode, ContactName = @contactName, Phone = @phone,
            Email = @email, Address = @address, PaymentTermDays = @paymentTermDays, IsActive = @isActive
     WHERE SupplierId = @id;
     SELECT @@ROWCOUNT AS affected`, { id, ...params(d) });
  return rows[0] ? rows[0].affected > 0 : false;
};

/**
 * Xoá NCC chưa từng có phiếu nhập; đã có phiếu nhập thì chỉ ngừng hợp tác (IsActive = 0) để giữ lịch sử.
 * Trả về 'deleted' | 'deactivated' | 'notFound'.
 */
exports.removeOrDeactivate = async (id, transaction) => {
  const used = await transaction.query(
    'SELECT COUNT(*) AS n FROM dbo.GoodsReceipts WITH (UPDLOCK, HOLDLOCK) WHERE SupplierId = @id', { id });
  if (used[0].n > 0) {
    const r = await transaction.query('UPDATE dbo.Suppliers SET IsActive = 0 WHERE SupplierId = @id; SELECT @@ROWCOUNT AS affected', { id });
    return r[0].affected > 0 ? 'deactivated' : 'notFound';
  }
  const r = await transaction.query('DELETE FROM dbo.Suppliers WHERE SupplierId = @id; SELECT @@ROWCOUNT AS affected', { id });
  return r[0].affected > 0 ? 'deleted' : 'notFound';
};

exports.PAGE_SIZE = PAGE_SIZE;
