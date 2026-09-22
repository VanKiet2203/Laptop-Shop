// Middleware xác thực & phân quyền (RBAC). Dùng trong file routes.
//   router.use(requireRole('ADMIN'));
//   router.post('/orders/:id/approve', requirePermission('order.approve'), ctrl.approve);
const forbidden = (req, res) =>
  res.status(403).render('errors/403', { layout: 'layouts/store', title: 'Không có quyền truy cập' });

function requireLogin(req, res, next) {
  if (req.session.user) return next();
  req.session.returnTo = req.originalUrl;
  req.flash('warning', 'Vui lòng đăng nhập để tiếp tục.');
  return res.redirect('/auth/login');
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.session.user) return requireLogin(req, res, next);
  return roles.includes(req.session.user.role) ? next() : forbidden(req, res);
};

const requirePermission = (...perms) => (req, res, next) => {
  if (!req.session.user) return requireLogin(req, res, next);
  const has = perms.every((p) => req.session.user.permissions.includes(p));
  return has ? next() : forbidden(req, res);
};

/** Trang chủ theo vai trò sau khi đăng nhập */
const homeFor = (role) => ({ ADMIN: '/admin', SALES: '/staff', WAREHOUSE: '/warehouse' }[role] || '/');

module.exports = { requireLogin, requireRole, requirePermission, homeFor };
