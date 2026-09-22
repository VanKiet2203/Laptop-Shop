// MODULE 1 - Đăng nhập / đăng xuất (dùng chung cho mọi vai trò)
const bcrypt = require('bcryptjs');
const Account = require('../../models/account.model');
const audit = require('../../models/audit.model');
const { homeFor } = require('../../core/auth');

exports.showLogin = (req, res) => {
  if (req.session.user) return res.redirect(homeFor(req.session.user.role));
  res.render('auth/login', { title: 'Đăng nhập' });
};

exports.login = async (req, res) => {
  const { username = '', password = '' } = req.body;
  const acc = await Account.findForLogin(username.trim());
  const ok = acc && acc.IsActive && (await bcrypt.compare(password, acc.PasswordHash));
  if (!ok) {
    req.flash('danger', acc && !acc.IsActive ? 'Tài khoản đã bị khoá.' : 'Sai tên đăng nhập hoặc mật khẩu.');
    return res.redirect('/auth/login');
  }
  req.session.user = {
    accountId: acc.AccountId, username: acc.Username, fullName: acc.FullName, role: acc.RoleCode,
    employeeId: acc.EmployeeId || null, customerId: acc.CustomerId || null,
    permissions: await Account.getPermissions(acc.RoleId),
  };
  await Account.touchLastLogin(acc.AccountId);
  req.accountForLog = acc;
  await audit.log(req, 'LOGIN', 'Account', acc.AccountId, `Đăng nhập (${acc.RoleCode})`);
  const back = req.session.returnTo;
  delete req.session.returnTo;
  res.redirect(back || homeFor(acc.RoleCode));
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
};
