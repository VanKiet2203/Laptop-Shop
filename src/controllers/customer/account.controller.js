// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
const Customer = require('../../models/customer.model');

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
  if (!/^0\d{9,10}$/.test(values.phone)) errors.push('Số điện thoại không hợp lệ (bắt đầu bằng 0, 10-11 số).');
  if (values.email.length > 150) errors.push('Email không được vượt quá 150 ký tự.');
  else if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push('Email không hợp lệ.');
  return { values, errors };
}

function addressValues(body) {
  const values = {
    receiverName: textField(body.receiverName),
    receiverPhone: textField(body.receiverPhone),
    addressLine: textField(body.addressLine),
    ward: textField(body.ward),
    district: textField(body.district),
    province: textField(body.province),
    isDefault: body.isDefault === '1',
  };
  const errors = [];
  if (!values.receiverName) errors.push('Tên người nhận không được để trống.');
  else if (values.receiverName.length > 100) errors.push('Tên người nhận không được vượt quá 100 ký tự.');
  if (!/^0\d{9,10}$/.test(values.receiverPhone)) errors.push('Số điện thoại người nhận không hợp lệ.');
  if (!values.addressLine) errors.push('Địa chỉ không được để trống.');
  else if (values.addressLine.length > 200) errors.push('Địa chỉ không được vượt quá 200 ký tự.');
  if (values.ward.length > 100) errors.push('Phường/Xã không được vượt quá 100 ký tự.');
  if (values.district.length > 100) errors.push('Quận/Huyện không được vượt quá 100 ký tự.');
  if (!values.province) errors.push('Tỉnh/Thành phố không được để trống.');
  else if (values.province.length > 100) errors.push('Tỉnh/Thành phố không được vượt quá 100 ký tự.');
  return { values, errors };
}

function isUniqueViolation(error) {
  return error.number === 2627 || error.number === 2601;
}

// GET /account
exports.profile = async (req, res) => {
  const profile = await Customer.findByAccountId(req.session.user.accountId);
  if (!profile) return res.status(404).render('errors/404', { title: 'Không tìm thấy hồ sơ' });
  return res.render('customer/account', {
    title: 'Hồ sơ của tôi',
    profile,
    values: profile,
    errors: [],
  });
};

// POST /account
exports.updateProfile = async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { values, errors } = profileValues(body);
  if (errors.length) {
    const profile = await Customer.findByAccountId(req.session.user.accountId);
    if (!profile) return res.status(404).render('errors/404', { title: 'Không tìm thấy hồ sơ' });
    return res.status(400).render('customer/account', {
      title: 'Hồ sơ của tôi',
      profile,
      values,
      errors,
    });
  }

  try {
    const updated = await Customer.updateProfile(req.session.user.accountId, {
      ...values,
      email: values.email || null,
    });
    if (!updated) return res.status(404).render('errors/404', { title: 'Không tìm thấy hồ sơ' });
  } catch (error) {
    if (!isUniqueViolation(error) && error.number !== 50003) throw error;
    const profile = await Customer.findByAccountId(req.session.user.accountId);
    if (!profile) return res.status(404).render('errors/404', { title: 'Không tìm thấy hồ sơ' });
    return res.status(400).render('customer/account', {
      title: 'Hồ sơ của tôi',
      profile,
      values,
      errors: ['Email hoặc số điện thoại đã được sử dụng bởi tài khoản khác.'],
    });
  }

  req.session.user.fullName = values.fullName;
  req.flash('success', 'Đã cập nhật hồ sơ.');
  return res.redirect('/account');
};

// GET /account/addresses
exports.addresses = async (req, res) => {
  const addresses = await Customer.addresses(req.session.user.customerId);
  return res.render('customer/addresses', { title: 'Sổ địa chỉ', addresses });
};

// POST /account/addresses
exports.addAddress = async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { values, errors } = addressValues(body);
  if (errors.length) {
    req.flash('danger', errors.join(' '));
    return res.redirect('/account/addresses');
  }
  if (await isDuplicateAddress(req.session.user.customerId, values)) {
    req.flash('danger', 'Địa chỉ này đã tồn tại trong sổ địa chỉ của bạn.');
    return res.redirect('/account/addresses');
  }

  try {
    const addressId = await Customer.addAddress(req.session.user.customerId, values);
    if (!addressId) {
      req.flash('danger', 'Không tìm thấy hồ sơ khách hàng.');
      return res.redirect('/account/addresses');
    }
  } catch (error) {
    if (error.code === 'ADDRESS_LIMIT_REACHED') {
      req.flash('danger', error.message);
      return res.redirect('/account/addresses');
    }
    if (!isUniqueViolation(error)) throw error;
    req.flash('danger', 'Không thể đặt địa chỉ mặc định do có thay đổi đồng thời. Vui lòng thử lại.');
    return res.redirect('/account/addresses');
  }
  req.flash('success', 'Đã thêm địa chỉ giao hàng.');
  return res.redirect('/account/addresses');
};

// POST /account/addresses/:id/delete
exports.deleteAddress = async (req, res) => {
  const addressId = parseAddressId(req.params.id);
  if (addressId == null) {
    req.flash('danger', 'Địa chỉ không hợp lệ.');
    return res.redirect('/account/addresses');
  }

  const deleted = await Customer.deleteAddress(req.session.user.customerId, addressId);
  if (!deleted) req.flash('warning', 'Địa chỉ không tồn tại hoặc không thuộc tài khoản của bạn.');
  else req.flash('success', 'Đã xoá địa chỉ giao hàng.');
  return res.redirect('/account/addresses');
};

// POST /account/addresses/:id/default
exports.setDefault = async (req, res) => {
  const addressId = parseAddressId(req.params.id);
  if (addressId == null) {
    req.flash('danger', 'Địa chỉ không hợp lệ.');
    return res.redirect('/account/addresses');
  }

  const updated = await Customer.setDefaultAddress(req.session.user.customerId, addressId);
  if (!updated) req.flash('warning', 'Địa chỉ không tồn tại hoặc không thuộc tài khoản của bạn.');
  else req.flash('success', 'Đã đặt địa chỉ giao hàng mặc định.');
  return res.redirect('/account/addresses');
};


async function isDuplicateAddress(customerId, value) {
  const normalized = {
    ReceiverName: textField(value.receiverName),
    ReceiverPhone: textField(value.receiverPhone),
    AddressLine: textField(value.addressLine),
    Ward: textField(value.ward),
    District: textField(value.district),
    Province: textField(value.province),
  };

  const addresses = await Customer.addresses(customerId);
  return addresses.some((address) =>
    ['ReceiverName', 'ReceiverPhone', 'AddressLine', 'Ward', 'District', 'Province']
      .every((field) => textField(address[field]) === normalized[field])
  );
}
