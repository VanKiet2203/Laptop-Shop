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
 * Đối chiếu trạng thái, role và permissions với DB trên mọi request để thay đổi quyền
 * có hiệu lực ngay mà không phải chờ người dùng đăng nhập lại.
 */
const requireLogin = wrap(async (req, res, next) => {
  if (!req.session.user) return goToLogin(req, res);

  const state = await Account.getAuthState(req.session.user.accountId);
  // Phiên cũ hơn lần đổi mật khẩu gần nhất (đổi ở thiết bị khác / admin đặt lại / quên mật khẩu) cũng bị đăng xuất.
  // Phiên tạo trước khi có cơ chế này (pwv chưa có) thì nhận phiên bản hiện tại để không đá oan người đang dùng.
  const user = req.session.user;
  if (state && state.IsActive && user.pwv === undefined) user.pwv = state.pwv;
  const staleSecret = state && state.IsActive && state.pwv !== user.pwv;
  if (!state || !state.IsActive || staleSecret) {
    // Tài khoản vừa bị khoá/xoá hoặc mật khẩu vừa đổi: đổi sang phiên mới (không còn đăng nhập) rồi mới ghi returnTo + thông báo,
    // vì sau session.destroy() thì req.session không còn để ghi.
    const returnTo = req.originalUrl;
    const message = staleSecret ? 'Mật khẩu tài khoản vừa được thay đổi. Vui lòng đăng nhập lại.' : 'Tài khoản đã bị khoá hoặc không còn tồn tại. Vui lòng đăng nhập lại.';
    return req.session.regenerate((err) => {
      if (err) return res.redirect('/auth/login');
      req.session.returnTo = returnTo;
      req.flash('warning', message);
      return res.redirect('/auth/login');
    });
  }
  req.session.user.role = state.RoleCode;
  req.session.user.permissions = state.permissions;
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

/**
 * Giỏ hàng / thanh toán: khách CHƯA đăng nhập được đi tiếp (giỏ lưu session), khách đã đăng nhập thì
 * vẫn đối chiếu lại trạng thái tài khoản như mọi route khác. Tài khoản nhân viên/admin không dùng để mua hàng.
 */
const shopper = wrap((req, res, next) => {
  if (!req.session.user) return next();
  return requireLogin(req, res, () => {
    if (req.session.user.role === 'CUSTOMER') return next();
    req.flash('warning', 'Tài khoản nhân viên không dùng để mua hàng. Hãy đăng xuất và dùng tài khoản khách hàng (hoặc mua không cần đăng nhập).');
    return res.redirect(homeFor(req.session.user.role));
  });
});

module.exports = { requireLogin, requireRole, requirePermission, homeFor, shopper };
