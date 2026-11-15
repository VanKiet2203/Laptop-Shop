// Đồng bộ giao dịch chuyển khoản từ SePay về đơn hàng. Có 2 đường vào, cùng gọi ingest():
//  - webhook (SePay gọi vào server; cần URL công khai)            -> controllers/customer/sepay.controller.js
//  - polling (server tự hỏi API SePay định kỳ; KHÔNG cần URL công khai, máy nào có SEPAY_API_KEY cũng chạy được)
// Thủ tục SQL idempotent theo mã giao dịch nên chạy cả hai cũng không làm đơn bị tính tiền hai lần.
const sepay = require('./sepay');
const db = require('../config/db');
const SepayTxn = require('../models/sepay.model');

/** t = { id, gateway, accountNumber, amount, content, referenceCode, transactionDate(Date|null) }. Trả kết quả đối soát hoặc null nếu bỏ qua. */
async function ingest(t) {
  // Nếu có cấu hình số tài khoản nhận, chỉ nhận giao dịch của đúng tài khoản đó.
  if (process.env.SEPAY_ACCOUNT && String(t.accountNumber || '') !== process.env.SEPAY_ACCOUNT) return null;
  const out = await SepayTxn.record({
    id: String(t.id).slice(0, 64),
    gateway: t.gateway ? String(t.gateway).slice(0, 50) : null,
    accountNumber: t.accountNumber ? String(t.accountNumber).slice(0, 30) : null,
    amount: Math.round(Number(t.amount)),
    content: String(t.content || '').slice(0, 500),
    referenceCode: t.referenceCode ? String(t.referenceCode).slice(0, 100) : null,
    transactionDate: t.transactionDate instanceof Date && !Number.isNaN(t.transactionDate.getTime()) ? t.transactionDate : null,
    orderNo: sepay.orderNoFrom(t.content),
  });
  if (out && out.Result !== 'Duplicate') console.log(`[sepay] giao dịch ${t.id}: ${out.Result}${out.OrderId ? ` (đơn #${out.OrderId})` : ''}`);
  return out;
}

const parseDate = (s) => new Date(String(s || '').replace(' ', 'T'));

// ---------- Polling ----------
const API_BASE = () => (process.env.SEPAY_API_BASE || 'https://userapi.sepay.vn/v2').replace(/\/+$/, '');
let running = false;

async function pollOnce() {
  if (running) return;
  running = true;
  try {
    // Không có đơn chuyển khoản nào đang chờ thì khỏi hỏi SePay (tiết kiệm hạn mức 3 yêu cầu/giây/IP).
    const pending = await db.queryOne(
      "SELECT COUNT(*) AS n FROM dbo.Orders WHERE PaymentMethod = 'BankTransfer' AND PaymentStatus = 'Pending' AND Status <> 'Cancelled'"
    );
    if (!pending || !pending.n) return;

    const res = await fetch(`${API_BASE()}/transactions?transfer_type=in&per_page=100&transaction_date_sort=desc`, {
      headers: { Authorization: `Bearer ${process.env.SEPAY_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`[sepay] polling lỗi HTTP ${res.status}${res.status === 401 ? ' (sai SEPAY_API_KEY hoặc sai SEPAY_API_BASE: token Test mode chỉ dùng được với userapi-sandbox.sepay.vn)' : ''}`);
      return;
    }
    const body = await res.json();
    // Giao dịch cũ -> mới để đơn được ghi nhận theo đúng thứ tự thời gian.
    for (const x of (body.data || []).slice().reverse()) {
      if (x.transfer_type !== 'in' || !(Number(x.amount_in) > 0)) continue;
      await ingest({
        id: x.id,
        gateway: x.bank_brand_name,
        accountNumber: x.account_number,
        amount: x.amount_in,
        content: x.transaction_content,
        referenceCode: x.reference_number,
        transactionDate: parseDate(x.transaction_date),
      });
    }
  } catch (e) {
    console.error('[sepay] polling lỗi:', e.message);
  } finally {
    running = false;
  }
}

/** Bật polling khi SEPAY_POLL=true và có SEPAY_API_KEY. SEPAY_POLL_SECONDS: chu kỳ hỏi (mặc định 5 giây). */
function startPolling() {
  if (process.env.SEPAY_POLL !== 'true' || !sepay.enabled()) return;
  const sec = Math.max(2, Number(process.env.SEPAY_POLL_SECONDS) || 5);
  console.log(`[sepay] polling bật: hỏi ${API_BASE()} mỗi ${sec} giây`);
  setInterval(pollOnce, sec * 1000).unref();
}

module.exports = { ingest, parseDate, startPolling, pollOnce };
