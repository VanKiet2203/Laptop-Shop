// MODULE 3 - KHÁCH MUA HÀNG
// Thanh toán & đặt hàng cho cả khách ĐÃ đăng nhập và CHƯA đăng nhập. Tạo tài khoản không bắt buộc nhập SĐT/địa chỉ;
// đến bước chốt đơn này mới bắt buộc: họ tên người nhận, số điện thoại, địa chỉ nhận hàng.
const Checkout = require('../../models/checkout.model');
const Customer = require('../../models/customer.model');
const CustomerOrder = require('../../models/customerOrder.model');
const Promotion = require('../../models/promotion.model');
const guestCart = require('../../core/guestCart');
const mailer = require('../../core/mailer');
const { orderConfirmation } = require('../../core/mailTemplates');
const geo = require('../../core/geo');
const { isBusinessError } = require('../../core/helpers');

const isCustomer = (req) => Boolean(req.session.user && req.session.user.customerId);
const textField = (v) => (typeof v === 'string' ? v.trim() : '');
const sourceOf = (req) => (isCustomer(req)
  ? { customerId: req.session.user.customerId }
  : { entries: guestCart.entries(req) });

// Trả góp: các lựa chọn hợp lệ (client chỉ gửi mã, server tự kiểm tra)
const INSTALL_TERMS = [6, 9, 12, 18, 24];
const INSTALL_PREPAY = [0, 10, 20, 30, 40, 50];
const INSTALL_PROVIDERS = {
  card: 'thẻ tín dụng (0%)',
  finance: 'công ty tài chính',
};

function parseInstallment(body) {
  const months = Number.parseInt(body.instMonths, 10);
  const prepay = Number.parseInt(body.instPrepay, 10);
  const provider = textField(body.instProvider);
  if (!INSTALL_TERMS.includes(months) || !INSTALL_PREPAY.includes(prepay) || !INSTALL_PROVIDERS[provider]) return null;
  return { months, prepay, provider };
}

// GET /checkout
exports.show = async (req, res) => {
  const checkoutData = await Checkout.getCheckoutData(sourceOf(req));
  if (checkoutData.items.length === 0) {
    req.flash('warning', 'Giỏ hàng đang trống.');
    return res.redirect('/cart');
  }
  const draft = req.session.checkoutDraft || {};
  delete req.session.checkoutDraft;

  // Điền sẵn từ hồ sơ khi khách đã đăng nhập mà chưa có địa chỉ nào lưu
  let profile = null;
  if (isCustomer(req)) profile = await Customer.findByAccountId(req.session.user.accountId);
  const promotions = await Promotion.active(3);

  return res.render('customer/checkout', {
    title: 'Thanh toán',
    checkoutData,
    profile,
    draft,
    promotions,
    provinces: await geo.provinces(),
    wards: draft.province ? (await geo.wardsOf(draft.province)) || [] : [],
    isGuest: !isCustomer(req),
    installTerms: INSTALL_TERMS,
    installPrepay: INSTALL_PREPAY,
  });
};

// POST /checkout/promo
exports.checkPromo = async (req, res) => {
  const promoCode = textField(req.body && req.body.promoCode);
  try {
    // Tự tính subtotal từ giỏ hàng thật, không dùng giá trị client gửi lên
    // (client có thể sửa subtotal để preview sai lệch mức giảm giá/VAT/phí ship).
    const checkoutData = await Checkout.getCheckoutData(sourceOf(req));
    const subtotal = checkoutData.subtotal;
    if (!subtotal) {
      return res.status(400).json({ success: false, message: 'Giỏ hàng đang trống.' });
    }
    if (!promoCode) return res.status(400).json({ success: false, message: 'Vui lòng nhập mã khuyến mãi.' });
    const promoData = await Checkout.previewPromo(promoCode, subtotal);
    return res.json({ success: true, ...promoData });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

/** Đọc + kiểm tra thông tin người nhận: dùng địa chỉ đã lưu (khách đăng nhập) hoặc các ô nhập mới. */
async function readReceiver(req, body) {
  const addressIdRaw = textField(body.addressId);
  if (isCustomer(req) && /^\d+$/.test(addressIdRaw)) {
    const saved = await Customer.findAddress(req.session.user.customerId, Number(addressIdRaw));
    if (!saved) return { errors: ['Địa chỉ giao hàng không hợp lệ.'] };
    return {
      errors: [],
      receiverName: saved.ReceiverName,
      receiverPhone: saved.ReceiverPhone,
      shippingAddress: [saved.AddressLine, saved.Ward, saved.District, saved.Province].filter(Boolean).join(', '),
      isNew: false,
    };
  }

  const v = {
    receiverName: textField(body.receiverName),
    receiverPhone: textField(body.receiverPhone).replace(/[\s.-]/g, ''),
    addressLine: textField(body.addressLine),
    ward: textField(body.ward),
    district: '', // sau sáp nhập không còn cấp quận/huyện
    province: textField(body.province),
  };
  const errors = [];
  if (!v.receiverName) errors.push('Vui lòng nhập họ tên người nhận.');
  else if (v.receiverName.length > 100) errors.push('Họ tên không được vượt quá 100 ký tự.');
  if (!/^0\d{9,10}$/.test(v.receiverPhone)) errors.push('Số điện thoại không hợp lệ (bắt đầu bằng 0, 10-11 số).');
  if (!v.addressLine) errors.push('Vui lòng nhập số nhà, tên đường.');
  else if (v.addressLine.length > 200) errors.push('Địa chỉ không được vượt quá 200 ký tự.');
  if (!v.province) errors.push('Vui lòng chọn tỉnh/thành phố.');
  else {
    const geoError = await geo.validate(v.province, v.ward);
    if (geoError) errors.push(geoError);
  }
  if (v.ward.length > 100) errors.push('Phường/Xã không được vượt quá 100 ký tự.');
  return {
    errors,
    ...v,
    shippingAddress: [v.addressLine, v.ward, v.district, v.province].filter(Boolean).join(', '),
    isNew: true,
    save: body.saveAddress === '1',
  };
}

// POST /checkout
exports.place = async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const paymentMethod = textField(body.paymentMethod);
  const errors = [];

  const receiver = await readReceiver(req, body);
  errors.push(...receiver.errors);

  // Email nhận MÃ ĐƠN: khách chưa đăng nhập bắt buộc (không có tài khoản thì email là cách duy nhất để nhận lại mã đơn);
  // khách đã đăng nhập thì mặc định lấy email trong hồ sơ.
  let receiverEmail = textField(body.email).toLowerCase();
  if (!receiverEmail && isCustomer(req)) {
    const profile = await Customer.findByAccountId(req.session.user.accountId);
    receiverEmail = String((profile && (profile.Email || profile.AccountEmail)) || '').toLowerCase();
  }
  if (!receiverEmail && !isCustomer(req)) errors.push('Vui lòng nhập email để nhận mã đơn hàng.');
  // Cột Orders.ReceiverEmail là VARCHAR nên chỉ nhận email ký tự ASCII (tránh lưu sai rồi không tra lại được)
  else if (receiverEmail && (receiverEmail.length > 150 || !/^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(receiverEmail))) errors.push('Email không hợp lệ (chỉ dùng chữ không dấu, số và ký tự . _ - +).');
  if (!Checkout.PAYMENT_METHODS.some((m) => m.code === paymentMethod)) errors.push('Vui lòng chọn phương thức thanh toán.');

  let noteText = textField(body.note);
  if (paymentMethod === 'Installment') {
    const inst = parseInstallment(body);
    if (!inst) errors.push('Vui lòng chọn kỳ hạn, mức trả trước và hình thức trả góp.');
    else {
      noteText = `[TRẢ GÓP] ${inst.months} tháng · trả trước ${inst.prepay}% · ${INSTALL_PROVIDERS[inst.provider]}${noteText ? ` | ${noteText}` : ''}`;
    }
  }
  noteText = noteText.slice(0, 500);

  const keepDraft = () => {
    req.session.checkoutDraft = {
      addressId: textField(body.addressId),
      receiverName: textField(body.receiverName),
      receiverPhone: textField(body.receiverPhone),
      email: textField(body.email),
      addressLine: textField(body.addressLine),
      ward: textField(body.ward),
      district: textField(body.district),
      province: textField(body.province),
      paymentMethod,
      promoCode: textField(body.promoCode),
      note: textField(body.note),
      instMonths: textField(body.instMonths),
      instPrepay: textField(body.instPrepay),
      instProvider: textField(body.instProvider),
      saveAddress: body.saveAddress === '1',
    };
  };

  if (errors.length) {
    keepDraft();
    req.flash('danger', errors.join(' '));
    return res.redirect('/checkout');
  }

  let placed;
  try {
    placed = await Checkout.placeOrder({
      customerId: isCustomer(req) ? req.session.user.customerId : null,
      entries: isCustomer(req) ? null : guestCart.entries(req),
      receiverName: receiver.receiverName,
      receiverPhone: receiver.receiverPhone,
      receiverEmail: receiverEmail || null,
      shippingAddress: receiver.shippingAddress,
      paymentMethod,
      promoCode: textField(body.promoCode) || null,
      note: noteText || null,
    });
  } catch (e) {
    if (isBusinessError(e) && e.number >= 50020 && e.number <= 50026) {
      keepDraft();
      req.flash('danger', e.message);
      return res.redirect(e.number === 50020 ? '/cart' : '/checkout');
    }
    throw e;
  }

  // Sau khi đặt thành công: dọn giỏ, nhớ đơn để hiện trang cảm ơn (kể cả khách chưa đăng nhập)
  if (isCustomer(req)) {
    const { customerId } = req.session.user;
    // Lưu địa chỉ mới vào sổ địa chỉ nếu khách muốn; điền SĐT vào hồ sơ nếu chưa có. Lỗi phụ (trùng/đủ 10 địa chỉ) bỏ qua.
    if (receiver.isNew && receiver.save) {
      try {
        await Customer.addAddress(customerId, {
          receiverName: receiver.receiverName,
          receiverPhone: receiver.receiverPhone,
          addressLine: receiver.addressLine,
          ward: receiver.ward,
          district: receiver.district,
          province: receiver.province,
          isDefault: false,
        });
      } catch (e) {
        if (!['ADDRESS_DUPLICATE', 'ADDRESS_LIMIT_REACHED'].includes(e.code) && e.number !== 2627 && e.number !== 2601) throw e;
      }
    }
    await Customer.fillPhoneIfEmpty(customerId, receiver.receiverPhone);
  } else {
    guestCart.clear(req);
  }
  req.session.cartCount = 0;
  req.session.lastOrder = { orderId: placed.orderId };

  // Gửi email xác nhận kèm MÃ ĐƠN (khách vãng lai cần mã này để tra cứu). Lỗi gửi mail không làm hỏng đơn hàng.
  if (receiverEmail) {
    const order = await CustomerOrder.findAfterPlace(placed.orderId);
    if (order) {
      const message = orderConfirmation({ ...order, ReceiverEmail: receiverEmail }, mailer.baseUrl());
      const result = await mailer.sendMail({ to: receiverEmail, ...message });
      req.session.lastOrder.mail = { email: receiverEmail, mode: result.mode };
    }
  }
  return res.redirect('/checkout/success');
};

// GET /checkout/success
exports.success = async (req, res) => {
  const last = req.session.lastOrder;
  const order = last ? await CustomerOrder.findAfterPlace(last.orderId) : null;
  // Chỉ chủ đơn mới xem được: đơn nằm trong session của chính phiên này (khách vãng lai) hoặc thuộc khách đang đăng nhập
  const allowed = order && (
    !isCustomer(req) ? true : order.CustomerId === req.session.user.customerId);
  if (!allowed) return res.redirect(isCustomer(req) ? '/orders' : '/');
  return res.render('customer/order-success', {
    title: 'Đặt hàng thành công', order, isGuest: !isCustomer(req), mail: last.mail || null,
  });
};
