// MODULE 1 - Dashboard quản trị (đã làm sẵn: ví dụ gọi DB rồi render view)
const db = require('../../config/db');

exports.index = async (req, res) => {
  const stats = await db.queryOne(
    `SELECT (SELECT COUNT(*) FROM dbo.Accounts) AS accounts,
            (SELECT COUNT(*) FROM dbo.Accounts WHERE IsActive = 0) AS lockedAccounts,
            (SELECT COUNT(*) FROM dbo.Roles) AS roles,
            (SELECT COUNT(*) FROM dbo.AuditLogs WHERE CreatedAt >= DATEADD(DAY,-1,SYSDATETIME())) AS logs24h`);
  const recent = await db.query(
    `SELECT TOP 8 l.Action, l.EntityName, l.Detail, l.CreatedAt, a.Username
     FROM dbo.AuditLogs l LEFT JOIN dbo.Accounts a ON a.AccountId = l.AccountId ORDER BY l.AuditId DESC`);
  res.render('admin/dashboard', { title: 'Tổng quan quản trị', stats, recent });
};
