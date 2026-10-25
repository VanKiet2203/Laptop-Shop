// MODULE 1 - Model tài khoản (đã hoàn chỉnh phần đăng nhập; thêm CRUD user ở đây)
const db = require('../config/db');

const LOGIN_SELECT = `SELECT a.AccountId, a.Username, a.PasswordHash, a.IsActive, r.RoleId, r.RoleCode,
          COALESCE(e.FullName, c.FullName, a.Username) AS FullName,
          c.CustomerId, e.EmployeeId, c.AvatarUrl, a.PasswordChangedAt
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

/** Tìm tài khoản theo Email (dùng cho đăng nhập Google: đối chiếu email đã xác minh). */
exports.findByEmail = (email) => db.queryOne(`${LOGIN_SELECT} WHERE a.Email = @email`, { email });

exports.getPermissions = async (roleId, transaction = null) => {
  const query = transaction ? transaction.query : db.query;
  return (await query(
    `SELECT p.PermCode FROM dbo.RolePermissions rp JOIN dbo.Permissions p ON p.PermissionId = rp.PermissionId WHERE rp.RoleId = @roleId`,
    { roleId })).map((r) => r.PermCode);
};

/**
 * "Phiên bản mật khẩu" của tài khoản (mili-giây của lần đổi mật khẩu gần nhất, 0 nếu chưa từng đổi).
 * Lưu trong session lúc đăng nhập; đổi mật khẩu thì giá trị thay đổi và mọi phiên cũ bị đăng xuất ở request kế tiếp.
 */
exports.pwVersion = (changedAt) => (changedAt ? new Date(changedAt).getTime() : 0);

exports.getPwVersion = async (accountId) => {
  const row = await db.queryOne('SELECT PasswordChangedAt FROM dbo.Accounts WHERE AccountId = @accountId', { accountId });
  return row ? exports.pwVersion(row.PasswordChangedAt) : 0;
};

exports.touchLastLogin = (accountId) =>
  db.query('UPDATE dbo.Accounts SET LastLoginAt = SYSDATETIME() WHERE AccountId = @accountId', { accountId });

/**
 * Trạng thái và quyền mới nhất của tài khoản để middleware auth kiểm tra lại mỗi request.
 */
exports.getAuthState = async (accountId) => {
  const rows = await db.query(
    `SELECT a.IsActive, a.PasswordChangedAt, r.RoleId, r.RoleCode, p.PermCode
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
    pwv: exports.pwVersion(rows[0].PasswordChangedAt),
    permissions: [],
  };
  for (const row of rows) {
    if (row.PermCode != null) state.permissions.push(row.PermCode);
  }
  return state;
};

/* ---------- Quên / đổi mật khẩu ---------- */
const PROFILE_NAME = 'COALESCE(e.FullName, c.FullName, a.Username)';
const PROFILE_JOIN = `FROM dbo.Accounts a
   LEFT JOIN dbo.Employees e ON e.AccountId = a.AccountId
   LEFT JOIN dbo.Customers c ON c.AccountId = a.AccountId`;

/** Tài khoản đang hoạt động có email này (để gửi link đặt lại mật khẩu). */
exports.findActiveByEmail = (email) => db.queryOne(
  `SELECT a.AccountId, a.Username, a.Email, ${PROFILE_NAME} AS FullName ${PROFILE_JOIN} WHERE a.Email = @email AND a.IsActive = 1`, { email });

/** Thông tin để kiểm tra mật khẩu cũ / gửi thông báo sau khi đổi mật khẩu. */
exports.findAuthInfo = (accountId) => db.queryOne(
  `SELECT a.AccountId, a.Username, a.Email, a.PasswordHash, ${PROFILE_NAME} AS FullName ${PROFILE_JOIN} WHERE a.AccountId = @accountId`, { accountId });

/** Số yêu cầu đặt lại mật khẩu gần đây của tài khoản và của IP (chống spam email). */
exports.countRecentResets = async (accountId, ip, minutes) => db.queryOne(
  `SELECT (SELECT COUNT(*) FROM dbo.PasswordResets WHERE AccountId = @accountId AND CreatedAt >= DATEADD(MINUTE, -@minutes, SYSDATETIME())) AS byAccount,
          (SELECT COUNT(*) FROM dbo.PasswordResets WHERE @ip IS NOT NULL AND RequestIp = @ip AND CreatedAt >= DATEADD(MINUTE, -@minutes, SYSDATETIME())) AS byIp`,
  { accountId, ip: ip || null, minutes });

/** Tạo yêu cầu mới; các yêu cầu cũ chưa dùng của tài khoản bị vô hiệu (chỉ link mới nhất có tác dụng). */
exports.createPasswordReset = (accountId, tokenHash, minutes, ip) => db.transaction(async (tx) => {
  await tx.query('UPDATE dbo.PasswordResets SET UsedAt = SYSDATETIME() WHERE AccountId = @accountId AND UsedAt IS NULL', { accountId });
  await tx.query(
    `INSERT INTO dbo.PasswordResets (AccountId, TokenHash, ExpiresAt, RequestIp)
     VALUES (@accountId, @tokenHash, DATEADD(MINUTE, @minutes, SYSDATETIME()), @ip)`,
    { accountId, tokenHash, minutes, ip: ip || null });
});

const VALID_RESET = `FROM dbo.PasswordResets r
   JOIN dbo.Accounts a ON a.AccountId = r.AccountId AND a.IsActive = 1
   LEFT JOIN dbo.Employees e ON e.AccountId = a.AccountId
   LEFT JOIN dbo.Customers c ON c.AccountId = a.AccountId
   WHERE r.TokenHash = @tokenHash AND r.UsedAt IS NULL AND r.ExpiresAt > SYSDATETIME()`;

/** Link còn hiệu lực (chưa dùng, chưa hết hạn, tài khoản còn hoạt động)? Trả về tài khoản hoặc null. */
exports.findValidReset = (tokenHash) => db.queryOne(
  `SELECT r.ResetId, a.AccountId, a.Username, a.Email, ${PROFILE_NAME} AS FullName ${VALID_RESET}`, { tokenHash });

/** Đặt mật khẩu mới bằng link: đánh dấu đã dùng + đổi mật khẩu trong CÙNG transaction (link chỉ dùng được 1 lần). */
exports.completeReset = (tokenHash, passwordHash) => db.transaction(async (tx) => {
  const rows = await tx.query(
    `SELECT r.ResetId, a.AccountId, a.Username, a.Email, ${PROFILE_NAME} AS FullName
     FROM dbo.PasswordResets r WITH (UPDLOCK, ROWLOCK)
     JOIN dbo.Accounts a ON a.AccountId = r.AccountId AND a.IsActive = 1
     LEFT JOIN dbo.Employees e ON e.AccountId = a.AccountId
     LEFT JOIN dbo.Customers c ON c.AccountId = a.AccountId
     WHERE r.TokenHash = @tokenHash AND r.UsedAt IS NULL AND r.ExpiresAt > SYSDATETIME()`, { tokenHash });
  const acc = rows[0];
  if (!acc) return null;
  await tx.query('UPDATE dbo.PasswordResets SET UsedAt = SYSDATETIME() WHERE AccountId = @accountId AND UsedAt IS NULL', { accountId: acc.AccountId });
  await tx.query('UPDATE dbo.Accounts SET PasswordHash = @passwordHash, PasswordChangedAt = SYSDATETIME() WHERE AccountId = @accountId', { accountId: acc.AccountId, passwordHash });
  return acc;
});

/* ---------- Quản trị người dùng (Admin > Tài khoản) ---------- */
const { paginate } = require('../core/helpers');

const USER_PAGE_SIZE = 15;
const STAFF_ROLES = ['ADMIN', 'SALES', 'WAREHOUSE'];
exports.STAFF_ROLES = STAFF_ROLES;
exports.SYSTEM_EMPLOYEE_CODE = 'NV000'; // tài khoản hệ thống tự duyệt đơn - không được sửa/khoá/xoá

exports.normalizeUserFilters = (q = {}) => ({
  q: typeof q.q === 'string' ? q.q.trim().slice(0, 100) : '',
  role: /^[A-Z_]{1,30}$/.test(q.role || '') ? q.role : '',
  status: ['active', 'locked'].includes(q.status) ? q.status : '',
});

exports.searchUsers = async (filters, page) => {
  const f = exports.normalizeUserFilters(filters);
  const from = `FROM dbo.Accounts a
     JOIN dbo.Roles r ON r.RoleId = a.RoleId
     LEFT JOIN dbo.Employees e ON e.AccountId = a.AccountId
     LEFT JOIN dbo.Customers c ON c.AccountId = a.AccountId
     WHERE (@q = '' OR a.Username LIKE '%' + @q + '%' OR a.Email LIKE '%' + @q + '%'
            OR e.FullName LIKE '%' + @q + '%' OR c.FullName LIKE '%' + @q + '%' OR e.EmployeeCode LIKE '%' + @q + '%')
       AND (@role = '' OR r.RoleCode = @role)
       AND (@status = '' OR (@status = 'active' AND a.IsActive = 1) OR (@status = 'locked' AND a.IsActive = 0))`;
  const total = (await db.queryOne(`SELECT COUNT(*) AS n ${from}`, f)).n;
  const pg = paginate(page, USER_PAGE_SIZE, total);
  const rows = await db.query(
    `SELECT a.AccountId, a.Username, a.Email, a.IsActive, a.LastLoginAt, a.CreatedAt, r.RoleCode, r.RoleName,
            COALESCE(e.FullName, c.FullName, a.Username) AS FullName, e.EmployeeCode, COALESCE(e.Phone, c.Phone) AS Phone
     ${from}
     ORDER BY a.AccountId DESC
     OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...f, offset: pg.offset, size: pg.pageSize });
  return { rows, pg, filters: f };
};

exports.userCounts = () => db.queryOne(
  `SELECT COUNT(*) AS total, SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN IsActive = 0 THEN 1 ELSE 0 END) AS locked FROM dbo.Accounts`);

exports.roleOptions = () => db.query('SELECT RoleId, RoleCode, RoleName FROM dbo.Roles ORDER BY RoleId');

exports.findUserById = (accountId) => db.queryOne(
  `SELECT a.AccountId, a.Username, a.Email, a.IsActive, a.LastLoginAt, a.CreatedAt, a.RoleId, r.RoleCode, r.RoleName,
          e.EmployeeId, e.EmployeeCode, e.Gender, e.BirthDate, e.Address, e.HireDate,
          c.CustomerId, COALESCE(e.FullName, c.FullName, a.Username) AS FullName, COALESCE(e.Phone, c.Phone) AS Phone
   FROM dbo.Accounts a JOIN dbo.Roles r ON r.RoleId = a.RoleId
   LEFT JOIN dbo.Employees e ON e.AccountId = a.AccountId
   LEFT JOIN dbo.Customers c ON c.AccountId = a.AccountId
   WHERE a.AccountId = @accountId`, { accountId });

/** Số admin đang hoạt động, không tính tài khoản `exceptAccountId` (để chặn việc khoá/hạ quyền/xoá admin cuối cùng) */
exports.countOtherActiveAdmins = async (exceptAccountId, query = db.query) => (await query(
  `SELECT COUNT(*) AS n FROM dbo.Accounts a JOIN dbo.Roles r ON r.RoleId = a.RoleId
   WHERE r.RoleCode = 'ADMIN' AND a.IsActive = 1 AND a.AccountId <> @exceptAccountId`, { exceptAccountId }))[0].n;

exports.usernameOrEmailTaken = async (username, email, exceptAccountId = 0) => (await db.queryOne(
  `SELECT TOP 1 CASE WHEN Username = @username THEN 'username' ELSE 'email' END AS field
   FROM dbo.Accounts WHERE AccountId <> @exceptAccountId AND (Username = @username OR (@email IS NOT NULL AND Email = @email)
        OR Email = @username OR (@email IS NOT NULL AND Username = @email))`,
  { username, email: email || null, exceptAccountId }));

/** Tạo tài khoản + hồ sơ (nhân viên hoặc khách) trong transaction. Trả về { accountId, employeeCode } */
exports.createUser = async (d, transaction) => {
  const ids = await transaction.query(
    `DECLARE @ids TABLE (AccountId INT);
     INSERT INTO dbo.Accounts (Username, Email, PasswordHash, RoleId, IsActive)
     OUTPUT INSERTED.AccountId INTO @ids
     VALUES (@username, @email, @passwordHash, @roleId, 1);
     SELECT AccountId FROM @ids`,
    { username: d.username, email: d.email || null, passwordHash: d.passwordHash, roleId: d.roleId });
  const accountId = ids[0].AccountId;
  let employeeCode = null;
  if (STAFF_ROLES.includes(d.roleCode)) {
    const code = await transaction.query(
      `SELECT 'NV' + RIGHT('000' + CAST(ISNULL(MAX(TRY_CAST(SUBSTRING(EmployeeCode, 3, 10) AS INT)), 0) + 1 AS VARCHAR(10)), 3) AS Code
       FROM dbo.Employees WITH (UPDLOCK, HOLDLOCK) WHERE EmployeeCode LIKE 'NV[0-9]%'`);
    employeeCode = code[0].Code;
    await transaction.query(
      `INSERT INTO dbo.Employees (AccountId, EmployeeCode, FullName, Phone) VALUES (@accountId, @code, @fullName, @phone)`,
      { accountId, code: employeeCode, fullName: d.fullName, phone: d.phone || null });
  } else {
    await transaction.query(
      `INSERT INTO dbo.Customers (AccountId, FullName, Phone, Email) VALUES (@accountId, @fullName, @phone, @email)`,
      { accountId, fullName: d.fullName, phone: d.phone || null, email: d.email || null });
  }
  return { accountId, employeeCode };
};

/** Cập nhật email, họ tên, SĐT và (chỉ giữa các vai trò nhân viên) vai trò */
exports.updateUser = async (accountId, d, transaction) => {
  await transaction.query(
    `UPDATE dbo.Accounts SET Email = @email, RoleId = COALESCE(@roleId, RoleId) WHERE AccountId = @accountId`,
    { accountId, email: d.email || null, roleId: d.roleId || null });
  await transaction.query('UPDATE dbo.Employees SET FullName = @fullName, Phone = @phone WHERE AccountId = @accountId',
    { accountId, fullName: d.fullName, phone: d.phone || null });
  await transaction.query('UPDATE dbo.Customers SET FullName = @fullName, Phone = @phone, Email = @email WHERE AccountId = @accountId',
    { accountId, fullName: d.fullName, phone: d.phone || null, email: d.email || null });
};

exports.setActive = (accountId, isActive, query = db.query) => query(
  'UPDATE dbo.Accounts SET IsActive = @isActive WHERE AccountId = @accountId', { accountId, isActive: isActive ? 1 : 0 });

exports.setPassword = (accountId, passwordHash) => db.query(
  'UPDATE dbo.Accounts SET PasswordHash = @passwordHash, PasswordChangedAt = SYSDATETIME() WHERE AccountId = @accountId', { accountId, passwordHash });

/** Xoá hẳn tài khoản chưa phát sinh dữ liệu. Có ràng buộc FK (lỗi 547) thì ném lỗi để controller chuyển sang khoá tài khoản. */
exports.removeUser = async (accountId, transaction) => {
  await transaction.query('DELETE FROM dbo.Employees WHERE AccountId = @accountId', { accountId });
  await transaction.query('DELETE FROM dbo.Customers WHERE AccountId = @accountId', { accountId });
  const r = await transaction.query('DELETE FROM dbo.Accounts WHERE AccountId = @accountId; SELECT @@ROWCOUNT AS affected', { accountId });
  return r[0].affected > 0;
};
