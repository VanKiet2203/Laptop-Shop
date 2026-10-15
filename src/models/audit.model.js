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
      cause: error,
    });
  }
};

// TODO (M1): search({ from, to, accountId, action, page }) cho trang Admin > Nhật ký
