// Thành viên 3 - Khách mua hàng
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: sp_PlaceOrder, Promotions
// Hàm chính: previewPromo(code, subtotal), placeOrder({...}) -> { orderId, status }, getCheckoutData({ customerId | entries })

const db = require('../config/db');
const Cart = require('./cart.model');

// Quy tắc tính tiền - PHẢI khớp sp_PlaceOrder: freeship từ 5 triệu (tính trên tiền hàng TRƯỚC giảm giá), VAT 10% trên tiền sau giảm.
const FREE_SHIPPING_FROM = 5000000;
const SHIPPING_FEE = 30000;
const VAT_RATE = 10;

function calculateTotals(subtotal, discountAmount = 0) {
  const safeDiscount = Math.min(discountAmount, subtotal);
  const taxable = Math.max(0, subtotal - safeDiscount); // Tiền chịu thuế sau giảm giá
  const shippingFee = (subtotal >= FREE_SHIPPING_FROM || subtotal === 0) ? 0 : SHIPPING_FEE;
  const vatAmount = Math.round(taxable * (VAT_RATE / 100));
  const totalAmount = taxable + shippingFee + vatAmount;
  return {
    subtotal,
    discountAmount: safeDiscount,
    shippingFee,
    vatRate: VAT_RATE,
    vatAmount,
    totalAmount,
  };
}
exports.calculateTotals = calculateTotals;

/**
 * Kiểm tra mã voucher và tính trước số tiền giảm giá
 */
exports.previewPromo = async (code, subtotal) => {
  const promo = await db.queryOne(
    `SELECT PromotionId, Code, DiscountType, DiscountValue, MaxDiscount, MinOrderAmount
     FROM dbo.Promotions
     WHERE Code = @code
       AND IsActive = 1
       AND SYSDATETIME() BETWEEN StartDate AND EndDate
       AND (UsageLimit IS NULL OR UsedCount < UsageLimit)`,
    { code }
  );
  if (!promo) {
    throw Object.assign(new Error('Mã khuyến mãi không tồn tại, đã hết hạn hoặc hết lượt dùng.'), { number: 50022 });
  }
  if (subtotal < promo.MinOrderAmount) {
    throw Object.assign(
      new Error(`Đơn hàng phải từ ${new Intl.NumberFormat('vi-VN').format(promo.MinOrderAmount)} ₫ mới được áp dụng mã này.`),
      { number: 50022 }
    );
  }
  let discount = promo.DiscountType === 'Percent'
    ? Math.round(subtotal * (promo.DiscountValue / 100))
    : promo.DiscountValue;
  if (promo.DiscountType === 'Percent' && promo.MaxDiscount != null && discount > promo.MaxDiscount) {
    discount = promo.MaxDiscount;
  }
  const totals = calculateTotals(subtotal, discount);
  return {
    promotionId: promo.PromotionId,
    code: promo.Code,
    ...totals, // Trả về đủ: discountAmount, shippingFee, vatAmount, totalAmount
  };
};

/**
 * Đặt hàng qua sp_PlaceOrder. Khách đã đăng nhập: truyền customerId (đọc giỏ trong DB).
 * Khách chưa đăng nhập: truyền entries [{productId, qty}] từ giỏ session (gửi JSON, giá/tồn đọc lại trong DB).
 * Trả về { orderId, status } - status 'Approved' nghĩa là hệ thống đã tự xác nhận (đơn 1 sản phẩm).
 */
exports.placeOrder = async ({
  customerId = null, entries = null, receiverName, receiverPhone, receiverEmail = null, shippingAddress, paymentMethod, promoCode, note,
}) => {
  const result = await db.exec(
    'dbo.sp_PlaceOrder',
    {
      ReceiverName: receiverName,
      ReceiverPhone: receiverPhone,
      ReceiverEmail: receiverEmail || null,
      ShippingAddress: shippingAddress,
      PaymentMethod: paymentMethod,
      CustomerId: customerId,
      PromoCode: promoCode ? promoCode.trim() : null,
      Note: note ? note.trim() : null,
      ItemsJson: customerId ? null : JSON.stringify((entries || []).map((e) => ({ productId: e.productId, qty: e.qty }))),
    },
    { OrderId: db.sql.Int, OrderStatus: db.sql.VarChar(10) }
  );
  return { orderId: result.output.OrderId, status: result.output.OrderStatus };
};

/** Phương thức thanh toán hỗ trợ */
exports.PAYMENT_METHODS = [
  { code: 'COD', name: 'Thanh toán khi nhận hàng (COD)', desc: 'Nhân viên gọi xác nhận, bạn kiểm tra hàng rồi trả tiền mặt', icon: 'truck' },
  { code: 'BankTransfer', name: 'Chuyển khoản ngân hàng', desc: 'Hiện mã QR VietQR ngay sau khi đặt hàng', icon: 'qr' },
  { code: 'Installment', name: 'Trả góp', desc: 'Thẻ tín dụng 0% hoặc công ty tài chính - ước tính tiền góp mỗi tháng', icon: 'percent' },
  { code: 'Card', name: 'Thẻ tín dụng / Ghi nợ', desc: 'Visa, MasterCard, JCB - nhân viên gửi link thanh toán an toàn', icon: 'card' },
];

/**
 * Dữ liệu trang thanh toán. source = { customerId } (khách đăng nhập) hoặc { entries } (khách vãng lai).
 */
exports.getCheckoutData = async ({ customerId = null, entries = null }) => {
  const items = customerId ? await Cart.items(customerId) : await Cart.itemsForEntries(entries);
  const addresses = customerId
    ? await db.query(
      `SELECT AddressId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault
       FROM dbo.CustomerAddresses
       WHERE CustomerId = @customerId
       ORDER BY IsDefault DESC, AddressId ASC`,
      { customerId })
    : [];
  const subtotal = items.reduce((sum, i) => sum + i.Quantity * i.SalePrice, 0);
  const totals = calculateTotals(subtotal, 0);
  return {
    addresses,
    items,
    ...totals, // Gồm: subtotal, discountAmount (0), shippingFee, vatRate (10), vatAmount, totalAmount
    paymentMethods: exports.PAYMENT_METHODS,
  };
};
