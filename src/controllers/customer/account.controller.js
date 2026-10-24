// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
const Customer = require('../../models/customer.model');
const geo = require('../../core/geo');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

function textField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseAddressId(value) {
  const id = Number(value);
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(id) && id > 0 && id <= 2147483647
    ? id
    : null;
}

function profileValues(body) {
  const values = {
    fullName: textField(body.fullName),
    phone: textField(body.phone),
    email: textField(body.email),
  };
  const errors = [];
  if (!values.fullName) errors.push('Họ tên không được để trống.');
  else if (values.fullName.length > 100) errors.push('Họ tên không được vượt quá 100 ký tự.');
  // SĐT không bắt buộc (chỉ bắt buộc khi chốt đơn); có nhập thì phải đúng định dạng.
  if (values.phone && !/^0\d{9,10}$/.test(values.phone)) errors.push('Số điện thoại không hợp lệ (bắt đầu bằng 0, 10-11 số).');
  if (values.email.length > 150) errors.push('Email không được vượt quá 150 ký tự.');
  else if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push('Email không hợp lệ.');
  return { values, errors };
}

async function addressValues(body) {
  const values = {
    receiverName: textField(body.receiverName),
    receiverPhone: textField(body.receiverPhone),
    addressLine: textField(body.addressLine),
    ward: textField(body.ward),
    district: '', // sau sáp nhập không còn cấp quận/huyện
    province: textField(body.province),
    isDefault: body.isDefault === '1',
  };
  const errors = [];
  if (!values.receiverName) errors.push('Tên người nhận không được để trống.');
  else if (values.receiverName.length > 100) errors.push('Tên người nhận không được vượt quá 100 ký tự.');
  if (!/^0\d{9,10}$/.test(values.receiverPhone)) errors.push('Số điện thoại người nhận không hợp lệ.');
  if (!values.addressLine) errors.push('Địa chỉ không được để trống.');
  else if (values.addressLine.length > 200) errors.push('Địa chỉ không được vượt quá 200 ký tự.');
  if (!values.province) errors.push('Tỉnh/Thành phố không được để trống.');
  else {
    const geoError = await geo.validate(values.province, values.ward);
    if (geoError) errors.push(geoError);
  }
  if (values.ward.length > 100) errors.push('Phường/Xã không được vượt quá 100 ký tự.');
  return { values, errors };
}

function isUniqueViolation(error) {
  return error.number === 2627 || error.number === 2601;
}

const ADDRESS_PAGE = '/account#addresses';

// Hồ sơ + sổ địa chỉ nằm chung MỘT trang (/account) để khách đỡ phải chuyển qua lại nhiều mục.
async function renderProfile(req, res, { status = 200, profile, values, errors = [] }) {
  const addresses = await Customer.addresses(req.session.user.customerId);
  const view = {
    title: 'Hồ sơ của tôi',
    profile,
    values,
    errors,
    addresses,
    provinces: await geo.provinces(),
  };
  return status === 200 ? res.render('customer/account', view) : res.status(status).render('customer/account', view);
}

// GET /account
exports.profile = async (req, res) => {
  const profile = await Customer.findByAccountId(req.session.user.accountId);
  if (!profile) return res.status(404).render('errors/404', { title: 'Không tìm thấy hồ sơ' });
  return renderProfile(req, res, { profile, values: profile });
};

// POST /account
exports.updateProfile = async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { values, errors } = profileValues(body);
  if (errors.length) {
    const profile = await Customer.findByAccountId(req.session.user.accountId);
    if (!profile) return res.status(404).render('errors/404', { title: 'Không tìm thấy hồ sơ' });
    return renderProfile(req, res, { status: 400, profile, values, errors });
  }

  try {
    const updated = await Customer.updateProfile(req.session.user.accountId, {
      ...values,
      phone: values.phone || null,
      email: values.email || null,
    });
    if (!updated) return res.status(404).render('errors/404', { title: 'Không tìm thấy hồ sơ' });
  } catch (error) {
    if (!isUniqueViolation(error) && error.number !== 50003) throw error;
    const profile = await Customer.findByAccountId(req.session.user.accountId);
    if (!profile) return res.status(404).render('errors/404', { title: 'Không tìm thấy hồ sơ' });
    return renderProfile(req, res, {
      status: 400,
      profile,
      values,
      errors: ['Email hoặc số điện thoại đã được sử dụng bởi tài khoản khác.'],
    });
  }

  req.session.user.fullName = values.fullName;
  req.flash('success', 'Đã cập nhật hồ sơ.');
  return res.redirect('/account');
};

// GET /account/addresses (đường dẫn cũ) -> sổ địa chỉ giờ nằm trong trang hồ sơ
exports.addresses = (req, res) => res.redirect(ADDRESS_PAGE);

// POST /account/addresses
exports.addAddress = async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { values, errors } = await addressValues(body);
  if (errors.length) {
    req.flash('danger', errors.join(' '));
    return res.redirect(ADDRESS_PAGE);
  }

  try {
    const addressId = await Customer.addAddress(req.session.user.customerId, values);
    if (!addressId) {
      req.flash('danger', 'Không tìm thấy hồ sơ khách hàng.');
      return res.redirect(ADDRESS_PAGE);
    }
  } catch (error) {
    if (error.code === 'ADDRESS_LIMIT_REACHED' || error.code === 'ADDRESS_DUPLICATE') {
      req.flash('danger', error.message);
      return res.redirect(ADDRESS_PAGE);
    }
    if (!isUniqueViolation(error)) throw error;
    req.flash('danger', 'Không thể đặt địa chỉ mặc định do có thay đổi đồng thời. Vui lòng thử lại.');
    return res.redirect(ADDRESS_PAGE);
  }
  req.flash('success', 'Đã thêm địa chỉ giao hàng.');
  return res.redirect(ADDRESS_PAGE);
};

// POST /account/addresses/:id/delete
exports.deleteAddress = async (req, res) => {
  const addressId = parseAddressId(req.params.id);
  if (addressId == null) {
    req.flash('danger', 'Địa chỉ không hợp lệ.');
    return res.redirect(ADDRESS_PAGE);
  }

  const deleted = await Customer.deleteAddress(req.session.user.customerId, addressId);
  if (!deleted) req.flash('warning', 'Địa chỉ không tồn tại hoặc không thuộc tài khoản của bạn.');
  else req.flash('success', 'Đã xoá địa chỉ giao hàng.');
  return res.redirect(ADDRESS_PAGE);
};

// POST /account/addresses/:id/default
exports.setDefault = async (req, res) => {
  const addressId = parseAddressId(req.params.id);
  if (addressId == null) {
    req.flash('danger', 'Địa chỉ không hợp lệ.');
    return res.redirect(ADDRESS_PAGE);
  }

  const updated = await Customer.setDefaultAddress(req.session.user.customerId, addressId);
  if (!updated) req.flash('warning', 'Địa chỉ không tồn tại hoặc không thuộc tài khoản của bạn.');
  else req.flash('success', 'Đã đặt địa chỉ giao hàng mặc định.');
  return res.redirect(ADDRESS_PAGE);
};

/* ---------- Ảnh đại diện ----------
   Trình duyệt thu nhỏ ảnh về 256x256 JPEG rồi gửi dạng data URL (JSON) - không cần thư viện upload.
   Server vẫn kiểm tra định dạng (đọc "magic bytes"), giới hạn dung lượng và tự đặt tên file, không dùng tên do client gửi. */
const AVATAR_URL_PREFIX = '/uploads/avatars/';
const AVATAR_DIR = path.join(__dirname, '..', '..', '..', 'public', 'uploads', 'avatars');
const AVATAR_MAX_BYTES = 150 * 1024;

function imageExtension(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

async function removeUploadedAvatar(url) {
  if (typeof url !== 'string' || !url.startsWith(AVATAR_URL_PREFIX)) return;
  const file = path.basename(url);
  try { await fs.unlink(path.join(AVATAR_DIR, file)); } catch (_) { /* file đã mất thì thôi */ }
}

// POST /account/avatar  (JSON: { image: "data:image/jpeg;base64,..." })
exports.uploadAvatar = async (req, res) => {
  const image = req.body && req.body.image;
  const match = typeof image === 'string' ? /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image) : null;
  if (!match) return res.status(400).json({ ok: false, message: 'Ảnh không hợp lệ.' });
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > AVATAR_MAX_BYTES) {
    return res.status(413).json({ ok: false, message: 'Ảnh quá lớn (tối đa 150 KB sau khi thu nhỏ).' });
  }
  const ext = imageExtension(buffer);
  if (!ext) return res.status(400).json({ ok: false, message: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.' });

  const { customerId } = req.session.user;
  const file = `c${customerId}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  await fs.mkdir(AVATAR_DIR, { recursive: true });
  await fs.writeFile(path.join(AVATAR_DIR, file), buffer);
  const url = AVATAR_URL_PREFIX + file;

  const old = req.session.user.avatarUrl;
  await Customer.setAvatar(customerId, url);
  req.session.user.avatarUrl = url;
  await removeUploadedAvatar(old);
  return res.json({ ok: true, url });
};

// POST /account/avatar/delete
exports.removeAvatar = async (req, res) => {
  const old = req.session.user.avatarUrl;
  await Customer.setAvatar(req.session.user.customerId, null);
  req.session.user.avatarUrl = null;
  await removeUploadedAvatar(old);
  req.flash('success', 'Đã xoá ảnh đại diện.');
  return res.redirect('/account');
};
