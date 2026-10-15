// MODULE 1 - Model tài khoản (đã hoàn chỉnh phần đăng nhập; thêm CRUD user ở đây)
const db = require('../config/db');

const LOGIN_SELECT = `SELECT a.AccountId, a.Username, a.PasswordHash, a.IsActive, r.RoleId, r.RoleCode,
          COALESCE(e.FullName, c.FullName, a.Username) AS FullName,
          c.CustomerId, e.EmployeeId
   FROM dbo.Accounts a
   JOIN dbo.Roles r ON r.RoleId = a.RoleId
   LEFT JOIN dbo.Employees e ON e.AccountId = a.AccountId
   LEFT JOIN dbo.Customers c ON c.AccountId = a.AccountId`;

/**
 * Lấy tài khoản + vai trò + tên hiển thị (nhân viên hoặc khách) để đăng nhập.
 * Thử khớp Username trước, rồi mới thử Email - KHÔNG dùng "Username = @x OR Email = @x"
 * vì nếu Username của tài khoản A trùng Email của tài khoản B thì điều kiện OR sẽ mơ hồ
 * giữa hai tài khoản khác nhau (xem trigger trg_Accounts_NoCrossLogin chặn việc tạo trùng này).
 */
exports.findForLogin = async (username) =>
  (await db.queryOne(`${LOGIN_SELECT} WHERE a.Username = @username`, { username }))
  || db.queryOne(`${LOGIN_SELECT} WHERE a.Email = @username`, { username });

exports.getPermissions = async (roleId, transaction = null) => {
  const query = transaction ? transaction.query : db.query;
  return (await query(
    `SELECT p.PermCode FROM dbo.RolePermissions rp JOIN dbo.Permissions p ON p.PermissionId = rp.PermissionId WHERE rp.RoleId = @roleId`,
    { roleId })).map((r) => r.PermCode);
};

exports.touchLastLogin = (accountId) =>
  db.query('UPDATE dbo.Accounts SET LastLoginAt = SYSDATETIME() WHERE AccountId = @accountId', { accountId });

/**
 * Trạng thái và quyền mới nhất của tài khoản để middleware auth kiểm tra lại mỗi request.
 */
exports.getAuthState = async (accountId) => {
  const rows = await db.query(
    `SELECT a.IsActive, r.RoleId, r.RoleCode, p.PermCode
     FROM dbo.Accounts a
     JOIN dbo.Roles r ON r.RoleId = a.RoleId
     LEFT JOIN dbo.RolePermissions rp ON rp.RoleId = r.RoleId
     LEFT JOIN dbo.Permissions p ON p.PermissionId = rp.PermissionId
     WHERE a.AccountId = @accountId
     ORDER BY p.PermCode`,
    { accountId });
  if (!rows.length) return null;

  const state = {
    IsActive: rows[0].IsActive,
    RoleId: rows[0].RoleId,
    RoleCode: rows[0].RoleCode,
    permissions: [],
  };
  for (const row of rows) {
    if (row.PermCode != null) state.permissions.push(row.PermCode);
  }
  return state;
};

// TODO (M1): list(), findById(), create(), update(), setActive(), resetPassword(), remove() cho trang Admin > Người dùng
