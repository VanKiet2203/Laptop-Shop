// MODULE 1 - Đăng nhập / đăng xuất / quên mật khẩu / đổi mật khẩu (dùng chung cho mọi vai trò)
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const Account = require('../../models/account.model');
const audit = require('../../models/audit.model');
const mailer = require('../../core/mailer');
const rateLimit = require('../../core/rateLimit');
const { passwordReset, passwordChanged } = require('../../core/mailTemplates');
const { homeFor } = require('../../core/auth');
const { startSession } = require('../../core/session');
const { isConfigured: googleConfigured } = require('./google.controller');

const RESET_MINUTES = 60;            // link đặt lại mật khẩu hết hạn sau 60 phút
const RESET_MAX_PER_ACCOUNT = 3;     // tối đa 3 email / tài khoản / giờ
const RESET_MAX_PER_IP = 10;         // tối đa 10 yêu cầu / IP / giờ
const WRONG_OLD_MAX = 5;             // sai mật khẩu cũ tối đa 5 lần / 15 phút (mỗi phiên)
const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const LAYOUT_BY_ROLE = { ADMIN: 'layouts/admin', SALES: 'layouts/staff', WAREHOUSE: 'layouts/warehouse' };

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const isToken = (t) => typeof t === 'string' && /^[a-f0-9]{64}$/.test(t);

/** Kiểm tra mật khẩu mới: dùng chung cho đăng ký / đặt lại / đổi mật khẩu. Trả về chuỗi lỗi hoặc null. */
function passwordError(password, confirm) {
  if (typeof password !== 'string' || password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Mật khẩu không được vượt quá 72 byte.';
  if (password !== confirm) return 'Mật khẩu nhập lại không khớp.';
  return null;
}
exports.passwordError = passwordError;

exports.showLogin = (req, res) => {
  if (req.session.user) return res.redirect(homeFor(req.session.user.role));
  // Hộp "tài khoản thử nghiệm" chỉ hiện khi KHÔNG chạy production (đặt SHOW_DEMO_ACCOUNTS=false để tắt hẳn)
  const showDemo = process.env.NODE_ENV !== 'production' && process.env.SHOW_DEMO_ACCOUNTS !== 'false';
  res.render('auth/login', { title: 'Đăng nhập', googleEnabled: googleConfigured(), showDemo });
};

// Chống dò mật khẩu: sai 5 lần liên tiếp từ MỘT IP với cùng tài khoản thì khoá thử 15 phút; một tài khoản bị sai 20 lần
// từ nhiều IP khác nhau cũng tạm khoá; mỗi IP tối đa 100 lượt đăng nhập / 15 phút (rộng để nhiều người dùng chung một mạng vẫn đăng nhập được). Đăng nhập đúng thì xoá bộ đếm sai.
const LOGIN_WINDOW = 15 * 60 * 1000;
exports.login = async (req, res) => {
  const { username = '', password = '' } = req.body;
  const name = String(username).trim().slice(0, 100);
  const pairKey = `login-fail:${req.ip}:${name.toLowerCase()}`;
  const userKey = `login-fail:${name.toLowerCase()}`;
  const ipHit = rateLimit.hit(`login:ip:${req.ip}`, 100, LOGIN_WINDOW);
  if (!ipHit.allowed || rateLimit.count(pairKey, LOGIN_WINDOW) >= 5 || rateLimit.count(userKey, LOGIN_WINDOW) >= 20) {
    req.flash('danger', 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi khoảng 15 phút rồi thử lại, hoặc dùng "Quên mật khẩu".');
    res.set('Retry-After', String(ipHit.retryAfterSec || 900));
    return res.redirect('/auth/login');
  }
  const acc = await Account.findForLogin(name);
  const ok = acc && acc.IsActive && (await bcrypt.compare(String(password), acc.PasswordHash));
  if (!ok) {
    rateLimit.hit(pairKey, Infinity, LOGIN_WINDOW);
    rateLimit.hit(userKey, Infinity, LOGIN_WINDOW);
    req.flash('danger', acc && !acc.IsActive ? 'Tài khoản đã bị khoá.' : 'Sai tên đăng nhập hoặc mật khẩu.');
    return res.redirect('/auth/login');
  }
  rateLimit.reset(pairKey);
  await startSession(req, acc);
  await audit.log(req, 'LOGIN', 'Account', acc.AccountId, `Đăng nhập (${acc.RoleCode})`);
  const back = req.session.returnTo;
  delete req.session.returnTo;
  res.redirect(back || homeFor(acc.RoleCode));
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
};

/* ---------- Quên mật khẩu ---------- */

// GET /auth/forgot
exports.showForgot = (req, res) => {
  if (req.session.user) return res.redirect('/auth/password');
  res.render('auth/forgot', { title: 'Quên mật khẩu' });
};

// POST /auth/forgot - luôn trả cùng một thông báo dù email có tồn tại hay không (không cho dò email đã đăng ký)
exports.forgot = async (req, res) => {
  if (!rateLimit.hit('forgot:ip:' + req.ip, 10, 60 * 60 * 1000).allowed) { req.flash('warning', 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.'); return res.redirect('/auth/forgot'); }
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 150) : '';
  const now = Date.now();
  if (req.session.lastForgot && now - req.session.lastForgot < 60 * 1000) {
    req.flash('warning', 'Vui lòng đợi khoảng 1 phút rồi thử lại.');
    return res.redirect('/auth/forgot');
  }
  req.session.lastForgot = now;

  if (EMAIL_RE.test(email)) {
    const acc = await Account.findActiveByEmail(email);
    if (acc) {
      const recent = await Account.countRecentResets(acc.AccountId, req.ip, 60);
      if (recent.byAccount < RESET_MAX_PER_ACCOUNT && recent.byIp < RESET_MAX_PER_IP) {
        const token = crypto.randomBytes(32).toString('hex');
        await Account.createPasswordReset(acc.AccountId, sha256(token), RESET_MINUTES, req.ip);
        const link = `${mailer.baseUrl()}/auth/reset/${token}`;
        await mailer.sendMail({ to: acc.Email, ...passwordReset({ name: acc.FullName, link, minutes: RESET_MINUTES }) });
        req.accountForLog = { AccountId: acc.AccountId };
        await audit.log(req, 'FORGOT_PASSWORD', 'Account', acc.AccountId, 'Yêu cầu đặt lại mật khẩu qua email');
      }
    }
  }
  req.flash('success', 'Nếu email này thuộc một tài khoản, chúng tôi đã gửi link đặt lại mật khẩu (có hiệu lực 60 phút). Vui lòng kiểm tra hộp thư, kể cả mục Spam.');
  return res.redirect('/auth/forgot');
};

// GET /auth/reset/:token
exports.showReset = async (req, res) => {
  const token = req.params.token;
  const acc = isToken(token) ? await Account.findValidReset(sha256(token)) : null;
  if (!acc) return res.status(400).render('auth/reset', { title: 'Link không hợp lệ', invalid: true, token: '', errors: [] });
  return res.render('auth/reset', { title: 'Đặt mật khẩu mới', invalid: false, token, username: acc.Username, errors: [] });
};

// POST /auth/reset/:token
exports.reset = async (req, res) => {
  const token = req.params.token;
  if (!isToken(token)) return res.status(400).render('auth/reset', { title: 'Link không hợp lệ', invalid: true, token: '', errors: [] });
  const { password = '', confirmPassword = '' } = req.body || {};
  const error = passwordError(password, confirmPassword);
  if (error) {
    const acc = await Account.findValidReset(sha256(token));
    if (!acc) return res.status(400).render('auth/reset', { title: 'Link không hợp lệ', invalid: true, token: '', errors: [] });
    return res.status(400).render('auth/reset', { title: 'Đặt mật khẩu mới', invalid: false, token, username: acc.Username, errors: [error] });
  }
  const acc = await Account.completeReset(sha256(token), await bcrypt.hash(password, 10));
  if (!acc) return res.status(400).render('auth/reset', { title: 'Link không hợp lệ', invalid: true, token: '', errors: [] });

  req.accountForLog = { AccountId: acc.AccountId };
  await audit.log(req, 'RESET_PASSWORD', 'Account', acc.AccountId, 'Đặt lại mật khẩu bằng link email');
  if (acc.Email) await mailer.sendMail({ to: acc.Email, ...passwordChanged({ name: acc.FullName, when: new Date(), how: 'đặt lại bằng link trong email' }) });
  req.flash('success', 'Đã đặt mật khẩu mới. Hãy đăng nhập bằng mật khẩu vừa tạo.');
  return res.redirect('/auth/login');
};

/* ---------- Đổi mật khẩu (đã đăng nhập, mọi vai trò) ---------- */

const changePage = (req, res, { status = 200, errors = [] } = {}) => res.status(status).render('auth/change-password', {
  layout: LAYOUT_BY_ROLE[req.session.user.role] || 'layouts/store', title: 'Đổi mật khẩu', errors,
});

// GET /auth/password
exports.showChangePassword = (req, res) => changePage(req, res);

// POST /auth/password
exports.changePassword = async (req, res) => {
  const { oldPassword = '', password = '', confirmPassword = '' } = req.body || {};
  const now = Date.now();
  const fails = req.session.pwFails && now - req.session.pwFails.since < 15 * 60 * 1000 ? req.session.pwFails : { n: 0, since: now };
  if (fails.n >= WRONG_OLD_MAX) return changePage(req, res, { status: 429, errors: ['Bạn đã nhập sai mật khẩu hiện tại quá nhiều lần. Vui lòng thử lại sau 15 phút hoặc dùng "Quên mật khẩu".'] });

  const acc = await Account.findAuthInfo(req.session.user.accountId);
  if (!acc || !(await bcrypt.compare(String(oldPassword), acc.PasswordHash))) {
    req.session.pwFails = { n: fails.n + 1, since: fails.since };
    return changePage(req, res, { status: 400, errors: ['Mật khẩu hiện tại không đúng.'] });
  }
  const error = passwordError(password, confirmPassword);
  if (error) return changePage(req, res, { status: 400, errors: [error] });
  if (password === oldPassword) return changePage(req, res, { status: 400, errors: ['Mật khẩu mới phải khác mật khẩu hiện tại.'] });

  await Account.setPassword(acc.AccountId, await bcrypt.hash(password, 10));
  delete req.session.pwFails;
  // Phiên hiện tại giữ nguyên đăng nhập; các thiết bị/phiên khác sẽ bị đăng xuất ở request kế tiếp
  req.session.user.pwv = await Account.getPwVersion(acc.AccountId);
  await audit.log(req, 'CHANGE_PASSWORD', 'Account', acc.AccountId, 'Đổi mật khẩu');
  if (acc.Email) await mailer.sendMail({ to: acc.Email, ...passwordChanged({ name: acc.FullName, when: new Date(), how: 'đổi trong trang tài khoản' }) });
  req.flash('success', `Đã đổi mật khẩu. Các thiết bị khác đang đăng nhập tài khoản này sẽ bị đăng xuất.${acc.Email ? ' Chúng tôi đã gửi email thông báo tới địa chỉ của bạn.' : ''}`);
  return res.redirect(req.session.user.role === 'CUSTOMER' ? '/account' : homeFor(req.session.user.role));
};
