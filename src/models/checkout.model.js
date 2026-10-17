// Thành viên 3 - Khách mua hàng
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: sp_PlaceOrderFromCart, Promotions
// Hàm gợi ý: previewPromo(code, subtotal), placeOrder({customerId, addressId, paymentMethod, promoCode, note}) -> orderId

const db = require('../config/db');

/**
 * Kiểm tra mã voucher và tính trước số tiền giảm giá cho đơn hàng
 * @param {string} code - Mã voucher
 * @param {number} subtotal - Tổng tiền hàng tạm tính
 * @returns {Promise<{ promotionId: number, code: string, discountAmount: number }>}
 */

function calculateTotals(subtotal, discountAmount = 0) {
  const safeDiscount = Math.min(discountAmount, subtotal);
  const taxable = Math.max(0, subtotal - safeDiscount); // Tiền chịu thuế sau giảm giá
  
  // Miễn phí vận chuyển cho đơn từ 5.000.000đ, dưới 5 triệu phí ship 30.000đ (theo sp_PlaceOrderFromCart)
  const shippingFee = (subtotal >= 5000000 || subtotal === 0) ? 0 : 30000;
  const vatRate = 10;
  const vatAmount = Math.round(taxable * (vatRate / 100));
  const totalAmount = taxable + shippingFee + vatAmount;
  return {
    subtotal,
    discountAmount: safeDiscount,
    shippingFee,
    vatRate,
    vatAmount,
    totalAmount,
  };
}
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
  // Tái sử dụng hàm tính tiền dùng chung
  const totals = calculateTotals(subtotal, discount);
  return {
    promotionId: promo.PromotionId,
    code: promo.Code,
    ...totals, // Trả về đủ: discountAmount, shippingFee, vatAmount, totalAmount
  };
};




exports.placeOrder = async ({ customerId, addressId, paymentMethod, promoCode, note }) => {
  const result = await db.exec(
    'dbo.sp_PlaceOrderFromCart',
    {
      CustomerId: customerId,
      AddressId: addressId,
      PaymentMethod: paymentMethod,
      PromoCode: promoCode ? promoCode.trim() : null,
      Note: note ? note.trim() : null,
    },
    { OrderId: db.sql.Int } // Nhận tham số @OrderId OUTPUT từ procedure
  );
  return result.output.OrderId;
};

//Lấy thông tin checkout gồm: địa chỉ, món hàng, tổng tiền, phương thức thanh toán
exports.getCheckoutData = async (customerId) => {
  // 1. Lấy sổ địa chỉ của khách hàng (địa chỉ mặc định xếp lên đầu)
  const addresses = await db.query(
    `SELECT AddressId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault
     FROM dbo.CustomerAddresses
     WHERE CustomerId = @customerId
     ORDER BY IsDefault DESC, AddressId ASC`,
    { customerId }
  );
  // 2. Lấy các món hàng đang có trong giỏ kèm hình ảnh & tồn kho khả dụng
  const items = await db.query(
    `SELECT ci.Quantity, p.ProductId, p.ProductName, p.Slug, p.Sku, p.SalePrice, p.IsActive,
            (p.QtyOnHand - p.QtyReserved) AS QtyAvailable,
            img.ImageUrl AS PrimaryImage
     FROM dbo.Carts c
     JOIN dbo.CartItems ci ON ci.CartId = c.CartId
     JOIN dbo.Products p ON p.ProductId = ci.ProductId
     LEFT JOIN dbo.ProductImages img ON img.ProductId = p.ProductId AND img.IsPrimary = 1
     WHERE c.CustomerId = @customerId`,
    { customerId }
  );
  // 3. Tính tiền ban đầu (khi chưa áp mã giảm giá)
  const subtotal = items.reduce((sum, i) => sum + i.Quantity * i.SalePrice, 0);
  const totals = calculateTotals(subtotal, 0);
  // 4. Danh sách các phương thức thanh toán hỗ trợ
  const paymentMethods = [
    { code: 'COD', name: 'Thanh toán khi nhận hàng (COD)', desc: 'Nhận hàng, kiểm tra rồi thanh toán tiền mặt' },
    { code: 'BankTransfer', name: 'Chuyển khoản ngân hàng', desc: 'Chuyển khoản qua mã QR VietQR / Internet Banking' },
    { code: 'Card', name: 'Thẻ tín dụng / Ghi nợ', desc: 'Hỗ trợ thẻ Visa, MasterCard, JCB' },
    { code: 'Installment', name: 'Trả góp', desc: 'Trả góp qua thẻ tín dụng lãi suất 0%' },
  ];
  return {
    addresses,
    items,
    ...totals, // Gồm: subtotal, discountAmount (0), shippingFee, vatRate (10), vatAmount, totalAmount
    paymentMethods,
  };
};