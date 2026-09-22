// MODULE 1 - Nhật ký hệ thống. Các module khác gọi audit.log(...) sau thao tác quan trọng.
const db = require('../config/db');

exports.log = (req, action, entityName = null, entityId = null, detail = null) =>
  db.query(
    `INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail, IpAddress)
     VALUES (@accountId, @action, @entityName, @entityId, @detail, @ip)`,
    {
      accountId: req.session && req.session.user ? req.session.user.accountId : null,
      action, entityName, entityId: entityId == null ? null : String(entityId), detail, ip: req.ip,
    }).catch((e) => console.error('Audit log lỗi:', e.message)); // không để lỗi log làm hỏng nghiệp vụ

// TODO (M1): search({ from, to, accountId, action, page }) cho trang Admin > Nhật ký
