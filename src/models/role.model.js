// MODULE 1 - Vai trò & phân quyền (RBAC). Model = nơi DUY NHẤT chứa SQL của nhóm này.
// Bảng liên quan: Roles, Permissions, RolePermissions. Quyền được middleware auth kiểm tra lại với DB mỗi request nên có hiệu lực ngay.
const db = require('../config/db');

// Vai trò ADMIN luôn phải giữ các quyền này, nếu không sẽ tự khoá mình khỏi trang quản trị
const ADMIN_REQUIRED = ['user.manage', 'role.manage'];
exports.ADMIN_REQUIRED = ADMIN_REQUIRED;

exports.list = () => db.query(
  `SELECT r.RoleId, r.RoleCode, r.RoleName, r.Description,
          (SELECT COUNT(*) FROM dbo.Accounts a WHERE a.RoleId = r.RoleId) AS AccountCount,
          (SELECT COUNT(*) FROM dbo.Accounts a WHERE a.RoleId = r.RoleId AND a.IsActive = 1) AS ActiveCount,
          (SELECT COUNT(*) FROM dbo.RolePermissions rp WHERE rp.RoleId = r.RoleId) AS PermCount
   FROM dbo.Roles r ORDER BY r.RoleId`);

exports.totalPermissions = async () => (await db.queryOne('SELECT COUNT(*) AS n FROM dbo.Permissions')).n;

exports.findById = (roleId) => db.queryOne('SELECT RoleId, RoleCode, RoleName, Description FROM dbo.Roles WHERE RoleId = @roleId', { roleId });

/** Toàn bộ quyền nhóm theo ModuleName, kèm cờ `granted` của vai trò: [{ module, items: [{PermissionId, PermCode, PermName, granted}] }] */
exports.matrix = async (roleId) => {
  const rows = await db.query(
    `SELECT p.PermissionId, p.PermCode, p.PermName, p.ModuleName,
            CAST(CASE WHEN rp.RoleId IS NULL THEN 0 ELSE 1 END AS BIT) AS granted
     FROM dbo.Permissions p LEFT JOIN dbo.RolePermissions rp ON rp.PermissionId = p.PermissionId AND rp.RoleId = @roleId
     ORDER BY p.ModuleName, p.PermCode`, { roleId });
  const groups = [];
  rows.forEach((r) => {
    let g = groups.find((x) => x.module === r.ModuleName);
    if (!g) { g = { module: r.ModuleName, items: [] }; groups.push(g); }
    g.items.push(r);
  });
  return groups;
};

/** Ghi lại quyền của vai trò (xoá cũ + thêm mới) trong transaction. permissionIds đã được lọc là số nguyên. */
exports.savePermissions = async (roleId, permissionIds, transaction) => {
  const valid = permissionIds.length
    ? await transaction.query(
      `SELECT PermissionId, PermCode FROM dbo.Permissions WHERE PermissionId IN (${permissionIds.map((_, i) => `@p${i}`).join(',')})`,
      Object.fromEntries(permissionIds.map((id, i) => [`p${i}`, id])))
    : [];
  await transaction.query('DELETE FROM dbo.RolePermissions WHERE RoleId = @roleId', { roleId });
  for (const p of valid) {
    await transaction.query('INSERT INTO dbo.RolePermissions (RoleId, PermissionId) VALUES (@roleId, @permissionId)', { roleId, permissionId: p.PermissionId });
  }
  return valid;
};
