// MODULE 1 - ADMIN: vai trò & ma trận phân quyền
const Role = require('../../models/role.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const { parseId } = require('../../core/helpers');

const NOT_FOUND = { layout: 'layouts/admin', title: 'Không tìm thấy' };

// GET /admin/roles
exports.index = async (req, res) => {
  const [roles, totalPerms] = await Promise.all([Role.list(), Role.totalPermissions()]);
  res.render('admin/roles/index', { title: 'Vai trò & phân quyền', roles, totalPerms });
};

// GET /admin/roles/:id/permissions
exports.showPermissions = async (req, res) => {
  const id = parseId(req.params.id);
  const role = id ? await Role.findById(id) : null;
  if (!role) return res.status(404).render('errors/404', NOT_FOUND);
  const groups = await Role.matrix(id);
  res.render('admin/roles/permissions', {
    title: `Phân quyền: ${role.RoleName}`, role, groups,
    locked: role.RoleCode === 'ADMIN' ? Role.ADMIN_REQUIRED : [],
  });
};

// POST /admin/roles/:id/permissions
exports.savePermissions = async (req, res) => {
  const id = parseId(req.params.id);
  const role = id ? await Role.findById(id) : null;
  if (!role) return res.status(404).render('errors/404', NOT_FOUND);

  const raw = req.body && req.body.permissionIds;
  const ids = [...new Set((Array.isArray(raw) ? raw : raw ? [raw] : []).map(parseId).filter(Boolean))];
  try {
    const saved = await db.transaction(async (tx) => {
      const valid = await Role.savePermissions(id, ids, tx);
      // Vai trò ADMIN bắt buộc giữ quyền quản trị người dùng/vai trò, nếu thiếu thì huỷ cả thao tác
      if (role.RoleCode === 'ADMIN') {
        const codes = valid.map((p) => p.PermCode);
        const missing = Role.ADMIN_REQUIRED.filter((c) => !codes.includes(c));
        if (missing.length) throw Object.assign(new Error(`Vai trò ADMIN phải giữ quyền: ${missing.join(', ')}.`), { business: true });
      }
      await audit.logInTransaction(tx, req, 'UPDATE', 'Role', id, `Phân quyền vai trò ${role.RoleCode}: ${valid.length} quyền`);
      return valid;
    });
    req.flash('success', `Đã lưu ${saved.length} quyền cho vai trò ${role.RoleName}. Có hiệu lực ngay ở lần thao tác tiếp theo của người dùng.`);
    return res.redirect('/admin/roles');
  } catch (e) {
    if (!e.business) throw e;
    req.flash('danger', e.message);
    return res.redirect(`/admin/roles/${id}/permissions`);
  }
};
