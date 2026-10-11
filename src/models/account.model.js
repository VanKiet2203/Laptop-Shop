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

exports.getPermissions = async (roleId) =>
  (await db.query(
    `SELECT p.PermCode FROM dbo.RolePermissions rp JOIN dbo.Permissions p ON p.PermissionId = rp.PermissionId WHERE rp.RoleId = @roleId`,
    { roleId })).map((r) => r.PermCode);

exports.touchLastLogin = (accountId) =>
  db.query('UPDATE dbo.Accounts SET LastLoginAt = SYSDATETIME() WHERE AccountId = @accountId', { accountId });

/**
 * Trạng thái mới nhất của tài khoản (IsActive, vai trò) để middleware auth kiểm tra lại
 * mỗi request - đảm bảo khoá tài khoản/đổi quyền có hiệu lực ngay với phiên đã đăng nhập,
 * không phải chờ khách đăng nhập lại.
 */
exports.getAuthState = (accountId) => db.queryOne(
  `SELECT a.IsActive, r.RoleId, r.RoleCode FROM dbo.Accounts a JOIN dbo.Roles r ON r.RoleId = a.RoleId WHERE a.AccountId = @accountId`,
  { accountId });

// TODO (M1): list(), findById(), create(), update(), setActive(), resetPassword(), remove() cho trang Admin > Người dùng
