// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const Checkout  = require('../../models/checkout.model');
const Customer  = require('../../models/customer.model');

// GET /checkout
exports.show = async (req, res) => {
  // tìm checkout từ id tài khoản hoặc id khách hàng 
  try{
    const customer = await Customer.findByAccountId(req.session.user.accountId);
    if (!customer) {
       req.flash('error', 'Không tìm thấy thông tin khách hàng. Vui lòng đăng nhập lại.');
       return res.redirect('/auth/login');
        } else {
      const checkoutData = await Checkout.getCheckoutData(customer.CustomerId);
      if (checkoutData.items.length === 0) {
         req.flash('error', 'Giỏ hàng trống');
         return res.redirect('/cart');
      }
      return res.render('customer/checkout', { title: 'Khách - Thanh toán', checkoutData });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send('Lỗi khi lấy thông tin thanh toán');
  }

  
};

// POST /checkout/promo
exports.checkPromo = async (req, res) => {
  const { promoCode } = req.body;
  try {
    // Tự tính subtotal từ giỏ hàng thật trong DB, không dùng giá trị client gửi lên
    // (client có thể sửa subtotal để preview sai lệch mức giảm giá/VAT/phí ship).
    const customer = await Customer.findByAccountId(req.session.user.accountId);
    if (!customer) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập lại.' });
    }
    const checkoutData = await Checkout.getCheckoutData(customer.CustomerId);
    const subtotal = checkoutData.subtotal;
    if (!subtotal) {
      return res.status(400).json({ success: false, message: 'Không có tổng tiền hàng' });
    }
    // Gọi đúng tên previewPromo trong Model
    const promoData = await Checkout.previewPromo(promoCode, subtotal);
    return res.json({ success: true, ...promoData });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};


// POST /checkout
exports.place = async (req, res) => {
  try {
    const orderId = await Checkout.placeOrder({
  customerId: req.session.user.customerId,
  addressId: parseInt(req.body.addressId, 10),
  paymentMethod: req.body.paymentMethod,
  promoCode: req.body.promoCode || null,
  note: req.body.note || null,
  });
  req.session.cartCount = 0; // Reset số lượng trên giỏ hàng
  req.flash('success', 'Đặt hàng thành công!');
  res.redirect(`/orders/${orderId}`);
  } catch (e) {
    if (e.number >= 50020 && e.number <= 50024) {
      req.flash('danger', e.message);  
      return res.redirect('/checkout');
    }
    throw e;
  }
};
