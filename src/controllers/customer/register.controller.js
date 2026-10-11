// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
const bcrypt = require('bcryptjs');
const Customer = require('../../models/customer.model');
const Account = require('../../models/account.model');
const audit = require('../../models/audit.model');
const { homeFor } = require('../../core/auth');

// GET /register
exports.showRegister = (req, res) => {
  if (req.session.user) return res.redirect(homeFor(req.session.user.role));
  res.render('customer/register', { title: 'Đăng ký', errors: [], old: {} });
};

// POST /register
exports.register = async (req, res) => {
  const username = (req.body.username || '').trim();
  const email = (req.body.email || '').trim();
  const fullName = (req.body.fullName || '').trim();
  const phone = (req.body.phone || '').trim();
  const { password = '', confirmPassword = '' } = req.body;
  // Giữ lại để điền lại form nếu lỗi - KHÔNG giữ mật khẩu (không hiện mật khẩu đã gõ ra lại).
  const old = { username, email, fullName, phone };

  const errors = [];
  if (!username) errors.push('Tên đăng nhập không được trống.');
  if (!fullName) errors.push('Họ tên không được trống.');
  if (!/^0\d{9,10}$/.test(phone)) errors.push('Số điện thoại không hợp lệ (bắt đầu bằng 0, 10-11 số).');
  if (password.length < 6) errors.push('Mật khẩu phải có ít nhất 6 ký tự.');
  if (password !== confirmPassword) errors.push('Mật khẩu nhập lại không khớp.');

  if (!errors.length) {
    if (await Customer.findAccountByUsernameOrEmail(username)) errors.push('Tên đăng nhập đã được sử dụng.');
    if (email && await Customer.findAccountByUsernameOrEmail(email)) errors.push('Email đã được sử dụng.');
    if (await Customer.findCustomerByPhone(phone)) errors.push('Số điện thoại đã được sử dụng.');
  }

  if (errors.length) {
    return res.render('customer/register', { title: 'Đăng ký', errors, old });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const { accountId, customerId, roleId } = await Customer.createWithAccount({
      username, email: email || null, passwordHash, fullName, phone,
    });
    req.session.user = {
      accountId, username, fullName, role: 'CUSTOMER', employeeId: null, customerId,
      permissions: await Account.getPermissions(roleId),
    };
    req.session.cartCount = 0;
    req.accountForLog = { AccountId: accountId };
    await audit.log(req, 'CREATE', 'Account', accountId, `Đăng ký tài khoản khách hàng (${username})`);
    req.flash('success', `Chào mừng ${fullName}! Tài khoản đã được tạo.`);
    res.redirect('/');
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      return res.render('customer/register', { title: 'Đăng ký', errors: ['Tên đăng nhập, email hoặc số điện thoại đã tồn tại.'], old });
    }
    throw e;
  }
};
