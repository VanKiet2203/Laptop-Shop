// MODULE 1 - Nhật ký hệ thống. Các module khác gọi audit.log(...) sau thao tác quan trọng.
const db = require('../config/db');

function auditParams(req, action, entityName, entityId, detail) {
  const sessionAccountId = req.session && req.session.user
    ? req.session.user.accountId
    : null;
  const accountId = sessionAccountId != null
    ? sessionAccountId
    : req.accountForLog && req.accountForLog.AccountId != null
      ? req.accountForLog.AccountId
      : null;
  return {
    accountId,
    action,
    entityName,
    entityId: entityId == null ? null : String(entityId),
    detail,
    ip: req.ip,
  };
}

const INSERT_AUDIT = `INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail, IpAddress)
                      VALUES (@accountId, @action, @entityName, @entityId, @detail, @ip)`;

exports.log = (req, action, entityName = null, entityId = null, detail = null) =>
  db.query(INSERT_AUDIT, auditParams(req, action, entityName, entityId, detail))
    .catch((e) => console.error('Audit log lỗi:', e.message)); // non-transactional callers remain best-effort

exports.logInTransaction = async (transaction, req, action, entityName = null, entityId = null, detail = null) => {
  try {
    return await transaction.query(INSERT_AUDIT, auditParams(req, action, entityName, entityId, detail));
  } catch (error) {
    throw Object.assign(new Error('Không thể ghi nhật ký thao tác; giao dịch đã bị hủy.'), {
      code: 'AUDIT_WRITE_FAILED',
      number: 50099,
      cause: error,
    });
  }
};

/* ---------- Trang Admin > Nhật ký hoạt động ---------- */
const { paginate, parseDateStr } = require('../core/helpers');

const AUDIT_PAGE_SIZE = 25;

exports.normalizeFilters = (q = {}) => ({
  q: typeof q.q === 'string' ? q.q.trim().slice(0, 100) : '',
  action: /^[A-Za-z_]{1,50}$/.test(q.action || '') ? q.action : '',
  entity: /^[A-Za-z]{1,50}$/.test(q.entity || '') ? q.entity : '',
  from: parseDateStr(q.from),
  to: parseDateStr(q.to),
});

exports.search = async (filters, page) => {
  const f = exports.normalizeFilters(filters);
  const from = `FROM dbo.AuditLogs l LEFT JOIN dbo.Accounts a ON a.AccountId = l.AccountId
     WHERE (@action = '' OR l.Action = @action) AND (@entity = '' OR l.EntityName = @entity)
       AND (@q = '' OR a.Username LIKE '%' + @q + '%' OR l.Detail LIKE '%' + @q + '%' OR l.EntityId = @q OR l.IpAddress = @q)
       AND (@from = '' OR l.CreatedAt >= @from) AND (@to = '' OR l.CreatedAt < DATEADD(DAY, 1, CAST(@to AS DATE)))`;
  const total = (await db.queryOne(`SELECT COUNT(*) AS n ${from}`, f)).n;
  const pg = paginate(page, AUDIT_PAGE_SIZE, total);
  const rows = await db.query(
    `SELECT l.AuditId, l.Action, l.EntityName, l.EntityId, l.Detail, l.IpAddress, l.CreatedAt, a.Username
     ${from} ORDER BY l.AuditId DESC OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...f, offset: pg.offset, size: pg.pageSize });
  return { rows, pg, filters: f };
};

/** Giá trị Action / EntityName đang có trong nhật ký, dùng cho ô lọc */
exports.facets = async () => {
  const [actions, entities] = await Promise.all([
    db.query('SELECT DISTINCT Action FROM dbo.AuditLogs ORDER BY Action'),
    db.query('SELECT DISTINCT EntityName FROM dbo.AuditLogs WHERE EntityName IS NOT NULL ORDER BY EntityName'),
  ]);
  return { actions: actions.map((r) => r.Action), entities: entities.map((r) => r.EntityName) };
};
