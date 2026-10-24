// Đăng nhập bằng Google (OAuth 2.0 Authorization Code) - không dùng thư viện ngoài, chỉ gọi 2 endpoint của Google.
// Cấu hình trong .env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, (tuỳ chọn) GOOGLE_CALLBACK_URL.
// Redirect URI đăng ký trên Google Cloud Console phải TRÙNG với GOOGLE_CALLBACK_URL
// (mặc định http://localhost:<PORT>/auth/google/callback).
//
// Quy tắc an toàn:
//  - có `state` ngẫu nhiên trong session để chống CSRF;
//  - chỉ chấp nhận email đã được Google xác minh;
//  - email trùng tài khoản đã có thì chỉ liên kết nếu đó là tài khoản KHÁCH HÀNG (không cho đăng nhập vào tài khoản
//    admin/nhân viên bằng Google chỉ vì trùng email);
//  - tài khoản mới tạo bằng Google có mật khẩu ngẫu nhiên không ai biết (đăng nhập qua Google, hoặc đặt lại mật khẩu sau).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Account = require('../../models/account.model');
const Customer = require('../../models/customer.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const { homeFor } = require('../../core/auth');
const sessionCore = require('../../core/session');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const isConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const callbackUrl = () => process.env.GOOGLE_CALLBACK_URL
  || `http://localhost:${process.env.PORT || 3000}/auth/google/callback`;

function fail(req, res, message) {
  req.flash('danger', message);
  return res.redirect('/auth/login');
}

// GET /auth/google
exports.start = (req, res) => {
  if (!isConfigured()) {
    return fail(req, res, 'Đăng nhập bằng Google chưa được cấu hình (thiếu GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET trong .env).');
  }
  const state = crypto.randomBytes(16).toString('hex');
  req.session.googleState = state;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return res.redirect(`${AUTH_URL}?${params}`);
};

async function fetchGoogleProfile(code) {
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(),
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) throw new Error(`Google token ${tokenRes.status}`);
  const token = await tokenRes.json();
  const infoRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!infoRes.ok) throw new Error(`Google userinfo ${infoRes.status}`);
  return infoRes.json();
}

/** Tên đăng nhập duy nhất từ phần trước @ của email */
async function uniqueUsername(email) {
  const base = (email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user').slice(0, 40);
  let candidate = base;
  for (let i = 0; i < 20; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await Customer.findAccountByUsername(candidate))) return candidate;
    candidate = `${base}${crypto.randomInt(100, 9999)}`;
  }
  return `${base}${Date.now()}`.slice(0, 50);
}

// GET /auth/google/callback
exports.callback = async (req, res) => {
  const { code, state, error } = req.query;
  const expected = req.session.googleState;
  delete req.session.googleState;

  if (error) return fail(req, res, 'Bạn đã huỷ đăng nhập Google.');
  if (!isConfigured()) return fail(req, res, 'Đăng nhập bằng Google chưa được cấu hình.');
  if (!code || !state || !expected || state !== expected) {
    return fail(req, res, 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn, vui lòng thử lại.');
  }

  let profile;
  try {
    profile = await fetchGoogleProfile(String(code));
  } catch (e) {
    console.error('Google OAuth lỗi:', e.message);
    return fail(req, res, 'Không kết nối được Google, vui lòng thử lại sau.');
  }
  const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
  if (!email || profile.email_verified !== true) {
    return fail(req, res, 'Email Google chưa được xác minh nên không thể đăng nhập.');
  }
  if (email.length > 150) return fail(req, res, 'Email Google quá dài.');

  let acc = await Account.findByEmail(email);
  if (acc) {
    if (!acc.IsActive) return fail(req, res, 'Tài khoản đã bị khoá.');
    if (acc.RoleCode !== 'CUSTOMER') {
      return fail(req, res, 'Email này thuộc tài khoản nhân viên, hãy đăng nhập bằng tên đăng nhập và mật khẩu.');
    }
    if (!acc.AvatarUrl && acc.CustomerId && typeof profile.picture === 'string' && /^https:\/\//.test(profile.picture)) {
      await Customer.setAvatar(acc.CustomerId, profile.picture.slice(0, 500));
      acc.AvatarUrl = profile.picture.slice(0, 500);
    }
  } else {
    const fullName = (typeof profile.name === 'string' && profile.name.trim()) || email.split('@')[0];
    const username = await uniqueUsername(email);
    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    const avatarUrl = typeof profile.picture === 'string' && /^https:\/\//.test(profile.picture) ? profile.picture.slice(0, 500) : null;
    try {
      await db.transaction(async (transaction) => {
        const created = await Customer.createWithAccount(
          { username, email, passwordHash, fullName: fullName.slice(0, 100), phone: null, avatarUrl }, transaction);
        req.accountForLog = { AccountId: created.accountId };
        await audit.logInTransaction(transaction, req, 'CREATE', 'Account', created.accountId,
          `Đăng ký tài khoản khách hàng bằng Google (${username})`);
      });
    } catch (e) {
      if (e.number === 2627 || e.number === 2601 || e.number === 50003) {
        return fail(req, res, 'Không thể tạo tài khoản từ email Google này (đã tồn tại), vui lòng đăng nhập thường.');
      }
      throw e;
    }
    acc = await Account.findByEmail(email);
  }

  await sessionCore.startSession(req, acc);
  await audit.log(req, 'LOGIN', 'Account', acc.AccountId, 'Đăng nhập bằng Google');
  const back = req.session.returnTo;
  delete req.session.returnTo;
  return res.redirect(back || homeFor(acc.RoleCode));
};

exports.isConfigured = isConfigured;
