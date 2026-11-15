// Giao dịch chuyển khoản do SePay báo về. Bảng: SepayTransactions. Thủ tục: sp_MarkPaidBySepay.
const db = require('../config/db');

/** Ghi giao dịch + đối soát đơn trong 1 transaction SQL. Trả { Result, OrderId } (Result = 'Duplicate' nếu SePay gửi lại). */
exports.record = async (t) => {
  const { rows } = await db.exec('sp_MarkPaidBySepay', {
    SepayId: { type: db.sql.VarChar(64), value: t.id },
    Gateway: { type: db.sql.NVarChar(50), value: t.gateway },
    AccountNumber: { type: db.sql.VarChar(30), value: t.accountNumber },
    Amount: { type: db.sql.Decimal(18, 0), value: t.amount },
    Content: { type: db.sql.NVarChar(500), value: t.content },
    ReferenceCode: { type: db.sql.VarChar(100), value: t.referenceCode },
    TransactionDate: { type: db.sql.DateTime2(0), value: t.transactionDate },
    OrderNo: { type: db.sql.VarChar(20), value: t.orderNo },
  });
  return rows[0];
};

/** Trạng thái thanh toán tối thiểu của đơn (cho trang QR tự làm mới). */
exports.paymentState = (orderId) => db.queryOne(
  'SELECT OrderId, CustomerId, PaymentMethod, PaymentStatus FROM dbo.Orders WHERE OrderId = @orderId',
  { orderId }
);
