// MODULE 1 - ADMIN: quản lý tài khoản (thêm / sửa / đổi vai trò / khoá / đặt lại mật khẩu / xoá)
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const Account = require('../../models/account.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const { parseId } = require('../../core/helpers');
const mailer = require('../../core/mailer');
const { passwordChanged } = require('../../core/mailTemplates');

const NOT_FOUND = { layout: 'layouts/admin', title: 'Không tìm thấy' };
const text = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Mật khẩu tạm 10 ký tự, bỏ các ký tự dễ nhầm (0/O, 1/l/I) */
const tempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(10), (b) => chars[b % chars.length]).join('');
};

async function loadTarget(req, res) {
  const id = parseId(req.params.id);
  const user = id ? await Account.findUserById(id) : null;
  if (!user) { res.status(404).render('errors/404', NOT_FOUND); return null; }
  return user;
}

const isSelf = (req, user) => req.session.user.accountId === user.AccountId;
const isSystem = (user) => user.EmployeeCode === Account.SYSTEM_EMPLOYEE_CODE;

/** Có được phép làm mất một admin đang hoạt động này (khoá / hạ quyền / xoá) không? Admin cuối cùng thì không. */
async function wouldRemoveLastAdmin(user, query) {
  return user.RoleCode === 'ADMIN' && user.IsActive && (await Account.countOtherActiveAdmins(user.AccountId, query)) === 0;
}

function parseUserForm(body, { creating, roles, existing }) {
  const errors = [];
  const d = {
    username: text(body.username, 50),
    email: text(body.email, 150).toLowerCase(),
    fullName: text(body.fullName, 100),
    phone: text(body.phone, 15).replace(/[\s.-]/g, ''),
    password: typeof body.password === 'string' ? body.password : '',
    roleId: parseId(body.roleId),
  };
  if (creating) {
    if (!/^[A-Za-z0-9._-]{3,50}$/.test(d.username)) errors.push('Tên đăng nhập gồm 3-50 ký tự: chữ, số, dấu chấm, gạch dưới, gạch ngang.');
    if (d.password.length < 6) errors.push('Mật khẩu phải có ít nhất 6 ký tự.');
    else if (Buffer.byteLength(d.password, 'utf8') > 72) errors.push('Mật khẩu không được vượt quá 72 byte.');
  }
  const role = roles.find((r) => r.RoleId === d.roleId);
  if (creating && !role) errors.push('Vui lòng chọn vai trò.');
  if (!creating) {
    // Chỉ đổi vai trò giữa các vai trò nhân viên; tài khoản khách giữ nguyên vai trò
    if (existing.RoleCode === 'CUSTOMER') d.roleId = null;
    else if (!role || !Account.STAFF_ROLES.includes(role.RoleCode)) errors.push('Vai trò không hợp lệ.');
  }
  d.roleCode = role ? role.RoleCode : (existing ? existing.RoleCode : '');
  if (!d.fullName) errors.push('Họ tên không được để trống.');
  if (d.email && (d.email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))) errors.push('Email không hợp lệ.');
  if (d.phone && !/^0\d{9,10}$/.test(d.phone)) errors.push('Số điện thoại không hợp lệ (bắt đầu bằng 0, 10-11 số).');
  return { value: d, errors };
}

// GET /admin/users
exports.index = async (req, res) => {
  const [result, roles, counts] = await Promise.all([Account.searchUsers(req.query, req.query.page), Account.roleOptions(), Account.userCounts()]);
  res.render('admin/users/index', { title: 'Tài khoản', users: result.rows, pg: result.pg, filters: result.filters, roles, counts, me: req.session.user.accountId });
};

// GET /admin/users/new
exports.showCreate = async (req, res) => {
  const roles = await Account.roleOptions();
  res.render('admin/users/form', { title: 'Thêm tài khoản', user: null, roles, values: {}, errors: [], action: '/admin/users' });
};

// POST /admin/users
exports.create = async (req, res) => {
  const roles = await Account.roleOptions();
  const body = req.body || {};
  const { value, errors } = parseUserForm(body, { creating: true, roles });
  if (!errors.length) {
    const taken = await Account.usernameOrEmailTaken(value.username, value.email);
    if (taken) errors.push(taken.field === 'username' ? 'Tên đăng nhập đã được sử dụng.' : 'Email đã được sử dụng.');
  }
  if (errors.length) {
    return res.status(400).render('admin/users/form', { title: 'Thêm tài khoản', user: null, roles, values: { ...value, password: '' }, errors, action: '/admin/users' });
  }
  try {
    const passwordHash = await bcrypt.hash(value.password, 10);
    const created = await db.transaction(async (tx) => {
      const r = await Account.createUser({ ...value, passwordHash }, tx);
      await audit.logInTransaction(tx, req, 'CREATE', 'Account', r.accountId, `Tạo tài khoản ${value.username} (${value.roleCode})`);
      return r;
    });
    req.flash('success', `Đã tạo tài khoản ${value.username}${created.employeeCode ? ` (mã nhân viên ${created.employeeCode})` : ''}.`);
    return res.redirect('/admin/users');
  } catch (e) {
    if (e.number === 2627 || e.number === 2601 || e.number === 50003) {
      return res.status(400).render('admin/users/form', {
        title: 'Thêm tài khoản', user: null, roles, values: { ...value, password: '' }, action: '/admin/users',
        errors: ['Tên đăng nhập, email hoặc số điện thoại đã được sử dụng.'],
      });
    }
    throw e;
  }
};

// GET /admin/users/:id/edit
exports.showEdit = async (req, res) => {
  const user = await loadTarget(req, res);
  if (!user) return null;
  const roles = await Account.roleOptions();
  return res.render('admin/users/form', {
    title: 'Sửa tài khoản', user, roles, errors: [], action: `/admin/users/${user.AccountId}`,
    values: { username: user.Username, email: user.Email || '', fullName: user.FullName, phone: user.Phone || '', roleId: user.RoleId },
    self: isSelf(req, user), system: isSystem(user),
  });
};

// POST /admin/users/:id
exports.update = async (req, res) => {
  const user = await loadTarget(req, res);
  if (!user) return null;
  const roles = await Account.roleOptions();
  const self = isSelf(req, user);
  const system = isSystem(user);
  const redirectBack = (msg) => { req.flash('danger', msg); return res.redirect(`/admin/users/${user.AccountId}/edit`); };
  if (system) return redirectBack('Đây là tài khoản hệ thống (tự duyệt đơn 1 sản phẩm), không được chỉnh sửa.');

  const { value, errors } = parseUserForm(req.body || {}, { creating: false, roles, existing: user });
  // Không tự đổi vai trò của chính mình (tránh tự hạ quyền rồi bị khoá khỏi trang quản trị)
  if (self && value.roleId && value.roleId !== user.RoleId) errors.push('Bạn không thể tự thay đổi vai trò của chính mình.');
  if (errors.length) return redirectBack(errors.join(' '));
  if (value.email && value.email !== (user.Email || '') && await Account.usernameOrEmailTaken(user.Username, value.email, user.AccountId)) {
    return redirectBack('Email đã được sử dụng bởi tài khoản khác.');
  }
  try {
    await db.transaction(async (tx) => {
      if (value.roleId && value.roleId !== user.RoleId && user.RoleCode === 'ADMIN' && await wouldRemoveLastAdmin(user, tx.query)) {
        throw Object.assign(new Error('Đây là quản trị viên hoạt động cuối cùng, không thể đổi sang vai trò khác.'), { number: 50099, business: true });
      }
      await Account.updateUser(user.AccountId, value, tx);
      const roleNote = value.roleId && value.roleId !== user.RoleId ? `, đổi vai trò ${user.RoleCode} -> ${value.roleCode}` : '';
      await audit.logInTransaction(tx, req, 'UPDATE', 'Account', user.AccountId, `Sửa tài khoản ${user.Username}${roleNote}`);
    });
  } catch (e) {
    if (e.business) return redirectBack(e.message);
    if (e.number === 2627 || e.number === 2601 || e.number === 50003) return redirectBack('Email hoặc số điện thoại đã được sử dụng bởi tài khoản khác.');
    throw e;
  }
  req.flash('success', 'Đã cập nhật tài khoản.');
  return res.redirect('/admin/users');
};

// POST /admin/users/:id/toggle - khoá / mở khoá
exports.toggleActive = async (req, res) => {
  const user = await loadTarget(req, res);
  if (!user) return null;
  if (isSelf(req, user)) { req.flash('danger', 'Bạn không thể tự khoá tài khoản của chính mình.'); return res.redirect('/admin/users'); }
  if (isSystem(user)) { req.flash('danger', 'Không thể khoá tài khoản hệ thống.'); return res.redirect('/admin/users'); }
  const lock = !!user.IsActive;
  const done = await db.transaction(async (tx) => {
    if (lock && await wouldRemoveLastAdmin(user, tx.query)) return false;
    await Account.setActive(user.AccountId, !lock, tx.query);
    await audit.logInTransaction(tx, req, lock ? 'LOCK' : 'UNLOCK', 'Account', user.AccountId, `${lock ? 'Khoá' : 'Mở khoá'} tài khoản ${user.Username}`);
    return true;
  });
  if (!done) req.flash('danger', 'Đây là quản trị viên hoạt động cuối cùng, không thể khoá.');
  else req.flash('success', lock ? `Đã khoá tài khoản ${user.Username}. Người này sẽ bị đăng xuất ở lần thao tác tiếp theo.` : `Đã mở khoá tài khoản ${user.Username}.`);
  return res.redirect('/admin/users');
};

// POST /admin/users/:id/reset-password - sinh mật khẩu tạm, hiện MỘT lần cho admin
exports.resetPassword = async (req, res) => {
  const user = await loadTarget(req, res);
  if (!user) return null;
  if (isSystem(user)) { req.flash('danger', 'Không thể đặt lại mật khẩu tài khoản hệ thống.'); return res.redirect('/admin/users'); }
  const password = tempPassword();
  await Account.setPassword(user.AccountId, await bcrypt.hash(password, 10));
  await audit.log(req, 'RESET_PASSWORD', 'Account', user.AccountId, `Đặt lại mật khẩu tài khoản ${user.Username}`);
  // Chỉ báo cho chủ tài khoản biết mật khẩu đã bị đổi (KHÔNG gửi mật khẩu tạm qua email)
  if (user.Email) await mailer.sendMail({ to: user.Email, ...passwordChanged({ name: user.FullName, when: new Date(), how: 'đặt lại bởi quản trị viên' }) });
  req.flash('warning', `Mật khẩu tạm của ${user.Username}: ${password} — hãy gửi cho người dùng và yêu cầu đổi lại. Mật khẩu chỉ hiện một lần.`);
  return res.redirect('/admin/users');
};

// POST /admin/users/:id/delete - xoá nếu chưa phát sinh dữ liệu, ngược lại chuyển sang khoá
exports.remove = async (req, res) => {
  const user = await loadTarget(req, res);
  if (!user) return null;
  if (isSelf(req, user)) { req.flash('danger', 'Bạn không thể xoá tài khoản của chính mình.'); return res.redirect('/admin/users'); }
  if (isSystem(user)) { req.flash('danger', 'Không thể xoá tài khoản hệ thống.'); return res.redirect('/admin/users'); }
  try {
    const removed = await db.transaction(async (tx) => {
      if (await wouldRemoveLastAdmin(user, tx.query)) return 'lastAdmin';
      const ok = await Account.removeUser(user.AccountId, tx);
      if (ok) await audit.logInTransaction(tx, req, 'DELETE', 'Account', user.AccountId, `Xoá tài khoản ${user.Username}`);
      return ok ? 'deleted' : 'none';
    });
    if (removed === 'lastAdmin') req.flash('danger', 'Đây là quản trị viên hoạt động cuối cùng, không thể xoá.');
    else if (removed === 'deleted') req.flash('success', `Đã xoá tài khoản ${user.Username}.`);
    else req.flash('danger', 'Tài khoản không còn tồn tại.');
  } catch (e) {
    if (e.number !== 547) throw e;
    await Account.setActive(user.AccountId, false);
    await audit.log(req, 'LOCK', 'Account', user.AccountId, `Tài khoản ${user.Username} đã phát sinh dữ liệu nên được khoá thay vì xoá`);
    req.flash('warning', `Tài khoản ${user.Username} đã phát sinh dữ liệu (đơn hàng, phiếu nhập...) nên không thể xoá, hệ thống đã chuyển sang khoá tài khoản.`);
  }
  return res.redirect('/admin/users');
};
