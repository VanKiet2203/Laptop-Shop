// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
const bcrypt = require('bcryptjs');
const Customer = require('../../models/customer.model');
const Account = require('../../models/account.model');
const audit = require('../../models/audit.model');
const Cart = require('../../models/cart.model');
const db = require('../../config/db');
const guestCart = require('../../core/guestCart');
const { regenerate } = require('../../core/session');
const { homeFor } = require('../../core/auth');

function textField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// GET /register
exports.showRegister = (req, res) => {
  if (req.session.user) return res.redirect(homeFor(req.session.user.role));
  res.render('customer/register', { title: 'Đăng ký', errors: [], old: {} });
};

// POST /register
exports.register = async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const username = textField(body.username);
  const email = textField(body.email);
  const fullName = textField(body.fullName);
  const phone = textField(body.phone);
  const password = typeof body.password === 'string' ? body.password : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
  // Giữ lại để điền lại form nếu lỗi - KHÔNG giữ mật khẩu (không hiện mật khẩu đã gõ ra lại).
  const old = { username, email, fullName, phone };

  const errors = [];
  const guestOrderIds = req.session.guestOrderIds || [];
  let guestPhoneHolder = null;
  if (!username) errors.push('Tên đăng nhập không được trống.');
  else if (username.length > 50) errors.push('Tên đăng nhập không được vượt quá 50 ký tự.');
  if (!fullName) errors.push('Họ tên không được trống.');
  else if (fullName.length > 100) errors.push('Họ tên không được vượt quá 100 ký tự.');
  if (email.length > 150) errors.push('Email không được vượt quá 150 ký tự.');
  else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email không hợp lệ.');
  // SĐT không bắt buộc khi tạo tài khoản - chỉ bắt buộc ở bước chốt đơn hàng. Có nhập thì phải đúng định dạng.
  if (phone && !/^0\d{9,10}$/.test(phone)) errors.push('Số điện thoại không hợp lệ (bắt đầu bằng 0, 10-11 số).');
  if (password.length < 6) errors.push('Mật khẩu phải có ít nhất 6 ký tự.');
  else if (Buffer.byteLength(password, 'utf8') > 72) errors.push('Mật khẩu không được vượt quá 72 byte.');
  if (password !== confirmPassword) errors.push('Mật khẩu nhập lại không khớp.');

  if (!errors.length) {
    if (await Customer.findAccountByUsername(username)) errors.push('Tên đăng nhập đã được sử dụng.');
    if (email && await Customer.findAccountByEmail(email)) errors.push('Email đã được sử dụng.');
    if (phone) {
      const holder = await Customer.findCustomerByPhone(phone);
      // SĐT đang nằm ở hồ sơ khách vãng lai mà CHÍNH phiên này vừa đặt đơn -> được phép dùng (đơn sẽ được gắn vào tài khoản mới)
      const ownGuest = holder && holder.AccountId == null
        && (await Customer.guestCustomersOfOrders(guestOrderIds)).some((g) => g.CustomerId === holder.CustomerId);
      if (holder && !ownGuest) errors.push('Số điện thoại đã được sử dụng.');
      else if (ownGuest) guestPhoneHolder = holder.CustomerId;
    }
  }

  if (errors.length) {
    return res.render('customer/register', { title: 'Đăng ký', errors, old });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    let registration;
    const previousAccountForLog = req.accountForLog;
    try {
      registration = await db.transaction(async (transaction) => {
        // Nhường SĐT (cột duy nhất) cho tài khoản mới; hồ sơ vãng lai cũ vẫn giữ nguyên đơn chưa được chuyển
        if (guestPhoneHolder) await transaction.query('UPDATE dbo.Customers SET Phone = NULL WHERE CustomerId = @id AND AccountId IS NULL', { id: guestPhoneHolder });
        const created = await Customer.createWithAccount({
          username, email: email || null, passwordHash, fullName, phone,
        }, transaction);
        await Customer.claimGuestOrders(created.customerId, guestOrderIds, transaction);
        const permissions = await Account.getPermissions(created.roleId, transaction);
        req.accountForLog = { AccountId: created.accountId };
        await audit.logInTransaction(
          transaction, req, 'CREATE', 'Account', created.accountId,
          `Đăng ký tài khoản khách hàng (${username})`,
        );
        return { ...created, permissions };
      });
    } finally {
      if (previousAccountForLog === undefined) delete req.accountForLog;
      else req.accountForLog = previousAccountForLog;
    }

    const { accountId, customerId, permissions } = registration;
    const guestEntries = guestCart.entries(req);
    await regenerate(req); // mã phiên mới sau khi tạo tài khoản (chống session fixation)
    req.session.user = {
      accountId, username, fullName, role: 'CUSTOMER', employeeId: null, customerId, avatarUrl: null, pwv: 0,
      permissions,
    };
    // Giỏ hàng chọn lúc chưa có tài khoản chuyển sang giỏ của tài khoản mới
    if (guestEntries.length) await Cart.mergeEntries(customerId, guestEntries);
    delete req.session.cart;
    req.session.cartCount = guestEntries.length ? await Cart.count(customerId) : 0;
    req.flash('success', `Chào mừng ${fullName}! Tài khoản đã được tạo.`);
    res.redirect('/');
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      return res.render('customer/register', { title: 'Đăng ký', errors: ['Tên đăng nhập, email hoặc số điện thoại đã tồn tại.'], old });
    }
    throw e;
  }
};
