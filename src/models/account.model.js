// MODULE 1 - Model tài khoản (đã hoàn chỉnh phần đăng nhập; thêm CRUD user ở đây)
const db = require('../config/db');

/** Lấy tài khoản + vai trò + tên hiển thị (nhân viên hoặc khách) để đăng nhập */
exports.findForLogin = (username) => db.queryOne(
  `SELECT a.AccountId, a.Username, a.PasswordHash, a.IsActive, r.RoleId, r.RoleCode,
          COALESCE(e.FullName, c.FullName, a.Username) AS FullName,
          c.CustomerId, e.EmployeeId
   FROM dbo.Accounts a
   JOIN dbo.Roles r ON r.RoleId = a.RoleId
   LEFT JOIN dbo.Employees e ON e.AccountId = a.AccountId
   LEFT JOIN dbo.Customers c ON c.AccountId = a.AccountId
   WHERE a.Username = @username OR a.Email = @username`, { username });

exports.getPermissions = async (roleId) =>
  (await db.query(
    `SELECT p.PermCode FROM dbo.RolePermissions rp JOIN dbo.Permissions p ON p.PermissionId = rp.PermissionId WHERE rp.RoleId = @roleId`,
    { roleId })).map((r) => r.PermCode);

exports.touchLastLogin = (accountId) =>
  db.query('UPDATE dbo.Accounts SET LastLoginAt = SYSDATETIME() WHERE AccountId = @accountId', { accountId });

// TODO (M1): list(), findById(), create(), update(), setActive(), resetPassword(), remove() cho trang Admin > Người dùng
