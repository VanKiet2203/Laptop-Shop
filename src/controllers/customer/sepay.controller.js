// MODULE 3 - KHÁCH MUA HÀNG: nhận chuyển khoản ngân hàng (VietQR) và tự xác nhận qua webhook SePay.
// Đơn BankTransfer tạo ra ở PaymentStatus = Pending; khi SePay báo có tiền vào đúng mã đơn + đủ số tiền thì chuyển sang Paid.
const sepay = require('../../core/sepay');
const SepayTxn = require('../../models/sepay.model');
const { ingest, parseDate } = require('../../core/sepaySync');

const isCustomer = (req) => Boolean(req.session.user && req.session.user.customerId);

// POST /sepay/webhook   (không qua session/originCheck - xem app.js; xác thực bằng header Authorization: Apikey ...)
exports.webhook = async (req, res) => {
  if (!sepay.enabled()) return res.status(503).json({ success: false, message: 'SePay chưa cấu hình.' });
  if (!sepay.verifyAuth(req.headers.authorization)) return res.status(401).json({ success: false, message: 'Sai khoá API.' });

  const b = req.body || {};
  const id = String(b.id === undefined || b.id === null ? '' : b.id).trim();
  const amount = Number(b.transferAmount);
  if (!id || id.length > 64 || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ.' });
  // Chỉ quan tâm tiền VÀO tài khoản; tiền ra thì bỏ qua nhưng vẫn trả 200 để SePay không gửi lại.
  if (b.transferType !== 'in') return res.json({ success: true, ignored: 'transferType' });
  try {
    await ingest({
      id,
      gateway: b.gateway,
      accountNumber: b.accountNumber,
      amount,
      content: b.content || b.description,
      referenceCode: b.referenceCode,
      transactionDate: parseDate(b.transactionDate),
    });
  } catch (e) {
    if (e && (e.number === 2627 || e.number === 2601)) return res.json({ success: true, duplicate: true }); // SePay gửi trùng đồng thời
    console.error('[sepay] không ghi được giao dịch:', e.message);
    return res.status(500).json({ success: false }); // lỗi tạm thời -> SePay sẽ gửi lại
  }
  return res.json({ success: true });
};

// GET /checkout/sepay/status?orderId=...   (trang QR hỏi định kỳ xem đã nhận tiền chưa)
exports.status = async (req, res) => {
  const orderId = Number.parseInt(req.query.orderId, 10);
  const o = Number.isInteger(orderId) ? await SepayTxn.paymentState(orderId) : null;
  const mine = o && (isCustomer(req)
    ? o.CustomerId === req.session.user.customerId
    : (req.session.guestOrderIds || []).includes(o.OrderId));
  if (!mine || o.PaymentMethod !== 'BankTransfer') return res.status(404).json({ paid: false });
  return res.json({ paid: o.PaymentStatus === 'Paid' });
};
