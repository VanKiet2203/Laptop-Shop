// SePay (https://sepay.vn): theo dõi biến động số dư ngân hàng và gọi webhook về server khi có tiền vào.
// Khoá API CHỈ đọc từ .env ở phía server. SePay gửi header:  Authorization: Apikey <SEPAY_API_KEY>
const crypto = require('crypto');

const enabled = () => Boolean(process.env.SEPAY_API_KEY);

/** Header Authorization của webhook có đúng khoá không (so sánh hằng thời gian). */
const verifyAuth = (header) => {
  if (!enabled() || typeof header !== 'string') return false;
  const m = /^Apikey\s+(.+)$/i.exec(header.trim());
  if (!m) return false;
  const a = crypto.createHash('sha256').update(m[1]).digest();
  const b = crypto.createHash('sha256').update(process.env.SEPAY_API_KEY).digest();
  return crypto.timingSafeEqual(a, b);
};

/**
 * Tách mã đơn (DH2611-00001) khỏi nội dung chuyển khoản. Nhiều ngân hàng bỏ dấu '-' hoặc thêm chữ vào nội dung
 * ("MBVCB.123.DH261100001.CT tu ...") nên dấu '-' là tuỳ chọn; trả về dạng chuẩn có '-' hoặc null.
 */
const orderNoFrom = (content) => {
  const m = /DH(\d{4})\s*-?\s*(\d{5,})/i.exec(String(content || ''));
  return m ? `DH${m[1]}-${m[2]}` : null;
};

module.exports = { enabled, verifyAuth, orderNoFrom };
