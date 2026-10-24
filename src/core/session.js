// Thiết lập phiên đăng nhập dùng chung cho đăng nhập thường và đăng nhập Google.
const Account = require('../models/account.model');
const Cart = require('../models/cart.model');
const guestCart = require('./guestCart');

/**
 * Ghi thông tin người dùng vào session. Khách hàng: gộp giỏ hàng (lưu session lúc chưa đăng nhập) vào giỏ trong DB
 * để không mất những gì đã chọn trước khi đăng nhập.
 * acc: dòng từ Account.findForLogin / findByEmail.
 */
exports.startSession = async (req, acc) => {
  const guestEntries = guestCart.entries(req);
  req.session.user = {
    accountId: acc.AccountId,
    username: acc.Username,
    fullName: acc.FullName,
    role: acc.RoleCode,
    employeeId: acc.EmployeeId || null,
    customerId: acc.CustomerId || null,
    avatarUrl: acc.AvatarUrl || null,
    pwv: Account.pwVersion(acc.PasswordChangedAt), // đổi mật khẩu ở nơi khác thì phiên này bị đăng xuất (xem requireLogin)
    permissions: await Account.getPermissions(acc.RoleId),
  };
  await Account.touchLastLogin(acc.AccountId);
  if (acc.RoleCode === 'CUSTOMER' && acc.CustomerId) {
    if (guestEntries.length) await Cart.mergeEntries(acc.CustomerId, guestEntries);
    delete req.session.cart;
    req.session.cartCount = await Cart.count(acc.CustomerId);
  }
  req.accountForLog = acc;
};
