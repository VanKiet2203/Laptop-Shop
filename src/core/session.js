// Thiết lập phiên đăng nhập dùng chung cho đăng nhập thường và đăng nhập Google.
const Account = require('../models/account.model');
const Cart = require('../models/cart.model');
const guestCart = require('./guestCart');

/** Đổi sang mã phiên MỚI (chống session fixation) nhưng giữ lại vài giá trị cần thiết xuyên qua bước đăng nhập. */
function regenerate(req, keep = ['returnTo', 'chatConversationId', 'chatGuestName']) {
  const saved = {};
  for (const k of keep) if (req.session[k] !== undefined) saved[k] = req.session[k];
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      Object.assign(req.session, saved);
      return resolve();
    });
  });
}
exports.regenerate = regenerate;

/**
 * Ghi thông tin người dùng vào session (SAU KHI đã đổi mã phiên). Khách hàng: gộp giỏ hàng (lưu session lúc chưa đăng nhập)
 * vào giỏ trong DB để không mất những gì đã chọn trước khi đăng nhập.
 * acc: dòng từ Account.findForLogin / findByEmail.
 */
exports.startSession = async (req, acc) => {
  const guestEntries = guestCart.entries(req);
  await regenerate(req);
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
