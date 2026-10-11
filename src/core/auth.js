// Middleware xác thực & phân quyền (RBAC). Dùng trong file routes.
//   router.use(requireRole('ADMIN'));
//   router.post('/orders/:id/approve', requirePermission('order.approve'), ctrl.approve);
const Account = require('../models/account.model');
const wrap = require('./asyncHandler');

const forbidden = (req, res) =>
  res.status(403).render('errors/403', { layout: 'layouts/store', title: 'Không có quyền truy cập' });

function goToLogin(req, res) {
  req.session.returnTo = req.originalUrl;
  req.flash('warning', 'Vui lòng đăng nhập để tiếp tục.');
  return res.redirect('/auth/login');
}

/**
 * Không chỉ kiểm tra session còn hay không: đối chiếu lại IsActive/vai trò với DB mỗi request.
 * Nếu tài khoản bị khoá hoặc đổi vai trò sau khi đăng nhập, phiên cũ bị thu hồi ngay (vấn đề #5
 * trong báo cáo rà soát: "quyền và trạng thái tài khoản đã đăng nhập không được kiểm tra lại").
 */
const requireLogin = wrap(async (req, res, next) => {
  if (!req.session.user) return goToLogin(req, res);

  const state = await Account.getAuthState(req.session.user.accountId);
  if (!state || !state.IsActive) {
    return req.session.destroy(() => goToLogin(req, res));
  }
  if (state.RoleCode !== req.session.user.role) {
    // Vai trò đã đổi: nạp lại quyền mới nhất thay vì dùng permissions cũ trong session.
    req.session.user.role = state.RoleCode;
    req.session.user.permissions = await Account.getPermissions(state.RoleId);
  }
  return next();
});

const requireRole = (...roles) => wrap((req, res, next) => requireLogin(req, res, () =>
  (roles.includes(req.session.user.role) ? next() : forbidden(req, res))));

const requirePermission = (...perms) => wrap((req, res, next) => requireLogin(req, res, () => {
  const has = perms.every((p) => req.session.user.permissions.includes(p));
  return has ? next() : forbidden(req, res);
}));

/** Trang chủ theo vai trò sau khi đăng nhập */
const homeFor = (role) => ({ ADMIN: '/admin', SALES: '/staff', WAREHOUSE: '/warehouse' }[role] || '/');

module.exports = { requireLogin, requireRole, requirePermission, homeFor };
