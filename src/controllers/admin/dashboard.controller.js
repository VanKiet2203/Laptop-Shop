// MODULE 1 - Dashboard quản trị (đã làm sẵn: ví dụ gọi DB rồi render view)
const db = require('../../config/db');

exports.index = async (req, res) => {
  const [stats, recent, hourly, topActions, byRole] = await Promise.all([
    db.queryOne(
      `SELECT (SELECT COUNT(*) FROM dbo.Accounts) AS accounts,
              (SELECT COUNT(*) FROM dbo.Accounts WHERE IsActive = 0) AS lockedAccounts,
              (SELECT COUNT(*) FROM dbo.Roles) AS roles,
              (SELECT COUNT(*) FROM dbo.AuditLogs WHERE CreatedAt >= DATEADD(DAY,-1,SYSDATETIME())) AS logs24h`),
    db.query(
      `SELECT TOP 8 l.Action, l.EntityName, l.Detail, l.CreatedAt, a.Username
       FROM dbo.AuditLogs l LEFT JOIN dbo.Accounts a ON a.AccountId = l.AccountId ORDER BY l.AuditId DESC`),
    // Số log theo từng giờ trong 24 giờ qua (hoursAgo = 0 là giờ hiện tại)
    db.query(
      `SELECT DATEDIFF(HOUR, CreatedAt, SYSDATETIME()) AS hoursAgo, COUNT(*) AS n
       FROM dbo.AuditLogs WHERE CreatedAt >= DATEADD(HOUR, -23, DATEADD(HOUR, DATEDIFF(HOUR, 0, SYSDATETIME()), 0))
       GROUP BY DATEDIFF(HOUR, CreatedAt, SYSDATETIME())`),
    db.query(
      `SELECT TOP 5 Action, COUNT(*) AS n FROM dbo.AuditLogs
       WHERE CreatedAt >= DATEADD(DAY, -7, SYSDATETIME()) GROUP BY Action ORDER BY COUNT(*) DESC`),
    db.query(
      `SELECT r.RoleName, COUNT(a.AccountId) AS n FROM dbo.Roles r
       LEFT JOIN dbo.Accounts a ON a.RoleId = r.RoleId GROUP BY r.RoleId, r.RoleName ORDER BY COUNT(a.AccountId) DESC`),
  ]);

  // Điền đủ 24 cột (cũ -> mới) kể cả giờ không có log, để biểu đồ không bị "nhảy" cột.
  const now = new Date();
  const buckets = Array.from({ length: 24 }, (_, i) => {
    const hoursAgo = 23 - i;
    const t = new Date(now.getTime() - hoursAgo * 3600 * 1000);
    return { hour: t.getHours(), n: 0, hoursAgo };
  });
  hourly.forEach((r) => {
    const b = buckets[23 - r.hoursAgo];
    if (b) b.n = r.n;
  });

  res.render('admin/dashboard', { title: 'Tổng quan quản trị', stats, recent, buckets, topActions, byRole });
};
