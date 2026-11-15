// Hàm tiện ích dùng chung (định dạng, phân trang, lỗi nghiệp vụ)
const fmtMoney = (n) => (n == null ? '' : new Intl.NumberFormat('vi-VN').format(Math.round(Number(n))) + ' ₫');
const pad = (x) => String(x).padStart(2, '0');
const fmtDate = (d) => { if (!d) return ''; const x = new Date(d); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
const fmtDateTime = (d) => { if (!d) return ''; const x = new Date(d); return `${fmtDate(x)} ${pad(x.getHours())}:${pad(x.getMinutes())}`; };

// Orders.Status. Pending hiển thị là "Đang kiểm tra hàng": đơn 1 sản phẩm được hệ thống tự xác nhận ngay,
// đơn từ 2 sản phẩm trở lên chờ nhân viên kiểm tra tồn kho rồi mới duyệt (xem sp_PlaceOrder).
const ORDER_STATUS = {
  Pending: { label: 'Đang kiểm tra hàng', cls: 'warning', hint: 'Nhân viên đang kiểm tra tồn kho cho đơn của bạn.' },
  Approved: { label: 'Đã xác nhận', cls: 'primary', hint: 'Đơn đã được xác nhận còn hàng, đang chuẩn bị giao.' },
  Completed: { label: 'Đã giao', cls: 'success', hint: 'Đơn hàng đã giao thành công.' },
  Cancelled: { label: 'Đã huỷ', cls: 'secondary', hint: 'Đơn hàng đã bị huỷ.' },
};
// Orders.PaymentStatus (xem CK_Orders_PayStatus trong database/01_schema.sql)
const PAYMENT_STATUS = {
  Pending: { label: 'Chờ thanh toán', cls: 'warning' },
  Paid: { label: 'Đã thanh toán', cls: 'success' },
  RefundPending: { label: 'Chờ hoàn tiền', cls: 'info' },
  Refunded: { label: 'Đã hoàn tiền', cls: 'secondary' },
};
// ProductSerials.Status
const SERIAL_STATUS = {
  Pending: { label: 'Chờ nhập kho', cls: 'secondary' },
  InStock: { label: 'Trong kho', cls: 'success' },
  Sold: { label: 'Đã bán', cls: 'primary' },
  InWarranty: { label: 'Đang bảo hành', cls: 'info' },
  SentToVendor: { label: 'Gửi hãng', cls: 'warning' },
  Defective: { label: 'Lỗi', cls: 'danger' },
};
// GoodsReceipts.Status
const RECEIPT_STATUS = {
  Draft: { label: 'Nháp', cls: 'warning' },
  Posted: { label: 'Đã nhập kho', cls: 'success' },
  Cancelled: { label: 'Đã huỷ', cls: 'secondary' },
};
const PAYMENT_METHOD = { COD: 'Thanh toán khi nhận hàng', BankTransfer: 'Chuyển khoản ngân hàng', Card: 'Thẻ', Installment: 'Trả góp', Cash: 'Tiền mặt', Stripe: 'Thẻ qua Stripe' };

// Phương thức khách trả tiền NGAY sau khi đặt (QR / thẻ). COD trả khi nhận hàng; Trả góp / Thẻ do nhân viên xác nhận thanh toán.
const PAY_NOW = ['BankTransfer', 'Stripe'];

/**
 * Giai đoạn của đơn cho khách, gộp trạng thái xử lý (Orders.Status) và trạng thái thanh toán (Orders.PaymentStatus)
 * theo từng phương thức: tiêu đề + mô tả cho trang "đặt hàng thành công" và dòng gợi ý dưới thanh tiến độ.
 * Trả { tone: 'ok'|'pending'|'cancel', icon, title, message, hint }.
 */
function orderStage(ord) {
  const money = fmtMoney(ord.TotalAmount);
  const approved = ord.Status === 'Approved' || ord.Status === 'Completed';
  const paid = ord.PaymentStatus === 'Paid';
  const payNow = PAY_NOW.includes(ord.PaymentMethod);
  const checking = `Nhân viên sẽ kiểm tra tồn kho và xác nhận với bạn qua số ${ord.ReceiverPhone}.`;
  if (ord.Status === 'Cancelled') return { tone: 'cancel', icon: 'x', title: 'Đơn hàng đã huỷ', message: ord.CancelReason || '', hint: '' };
  if (ord.Status === 'Completed') return { tone: 'ok', icon: 'checkcircle', title: 'Đơn hàng đã giao', message: 'Cảm ơn bạn đã mua hàng.', hint: ORDER_STATUS.Completed.hint };
  if (payNow && !paid) {
    return {
      tone: 'pending', icon: 'clock', title: 'Đã ghi nhận đơn — chờ thanh toán',
      message: `Vui lòng hoàn tất thanh toán ${money} để chúng tôi xử lý đơn.${approved ? ' Đơn đã được xác nhận còn hàng.' : ''}`,
      hint: 'Đơn sẽ được xử lý ngay khi chúng tôi nhận được thanh toán.',
    };
  }
  if (payNow && paid) {
    return approved
      ? { tone: 'ok', icon: 'checkcircle', title: 'Thanh toán thành công!', message: `Đã nhận ${money}. Đơn đã được xác nhận còn hàng và đang chuẩn bị giao.`, hint: ORDER_STATUS.Approved.hint }
      : { tone: 'ok', icon: 'checkcircle', title: 'Thanh toán thành công!', message: `Đã nhận ${money}. ${checking}`, hint: 'Đã nhận thanh toán. Nhân viên đang kiểm tra tồn kho cho đơn của bạn.' };
  }
  if (!approved) return { tone: 'pending', icon: 'clock', title: 'Đặt hàng thành công!', message: checking, hint: ORDER_STATUS.Pending.hint };
  const later = ord.PaymentMethod === 'COD' ? 'Bạn thanh toán khi nhận hàng.'
    : paid ? 'Đã nhận thanh toán.'
      : ord.PaymentMethod === 'Installment' ? 'Nhân viên sẽ gọi hướng dẫn hồ sơ trả góp.' : 'Nhân viên sẽ gửi link thanh toán cho bạn.';
  return { tone: 'ok', icon: 'checkcircle', title: 'Đặt hàng thành công!', message: `Đơn đã được xác nhận còn hàng. ${later}`, hint: `${ORDER_STATUS.Approved.hint} ${later}` };
}

/** Một huy hiệu duy nhất cho danh sách / chi tiết đơn của khách, gộp trạng thái xử lý và thanh toán: { label, cls }. */
function orderBadge(ord) {
  const paid = ord.PaymentStatus === 'Paid';
  const payNow = PAY_NOW.includes(ord.PaymentMethod);
  if (ord.Status === 'Cancelled') {
    if (ord.PaymentStatus === 'RefundPending') return { label: 'Đã huỷ · chờ hoàn tiền', cls: 'secondary' };
    if (ord.PaymentStatus === 'Refunded') return { label: 'Đã huỷ · đã hoàn tiền', cls: 'secondary' };
    return ORDER_STATUS.Cancelled;
  }
  if (ord.Status === 'Completed') return ORDER_STATUS.Completed;
  if (payNow && !paid) return { label: ord.Status === 'Approved' ? 'Đã xác nhận · chờ thanh toán' : 'Chờ thanh toán', cls: 'warning' };
  if (ord.Status === 'Pending') return paid ? { label: 'Đã thanh toán · đang kiểm tra hàng', cls: 'warning' } : ORDER_STATUS.Pending;
  if (paid && payNow) return { label: 'Đã thanh toán · đã xác nhận', cls: 'primary' };
  if (!paid && ord.PaymentMethod !== 'COD') return { label: 'Đã xác nhận · chờ thanh toán', cls: 'primary' };
  return ORDER_STATUS.Approved;
}

/** Các bước tiến độ đơn (có bước thanh toán với mọi phương thức trừ COD). Bước đầu tiên chưa xong là bước hiện tại. */
function orderSteps(ord) {
  const approved = ord.Status === 'Approved' || ord.Status === 'Completed';
  const paid = ord.PaymentStatus === 'Paid';
  const check = { key: 'check', label: approved ? 'Đã xác nhận' : 'Đang kiểm tra hàng', done: approved, time: ord.ApprovedAt };
  const pay = { key: 'pay', label: paid ? 'Đã thanh toán' : 'Chờ thanh toán', done: paid, time: ord.PaidAt };
  const steps = [{ key: 'placed', label: 'Đã đặt hàng', done: true, time: ord.CreatedAt }];
  if (ord.PaymentMethod === 'COD') steps.push(check);
  else if (PAY_NOW.includes(ord.PaymentMethod)) steps.push(pay, check);
  else steps.push(check, pay);
  steps.push({ key: 'done', label: 'Đã giao', done: ord.Status === 'Completed', time: ord.CompletedAt });
  const cur = steps.find((s) => !s.done);
  if (cur) cur.current = true;
  return steps;
}

/** Tính phân trang: paginate(page, pageSize, total) -> { page, pageSize, total, pages, offset } */
function paginate(page, pageSize, total) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(p, pages);
  return { page: cur, pageSize, total, pages, offset: (cur - 1) * pageSize };
}

/** Lỗi do THROW 50xxx trong stored procedure là lỗi nghiệp vụ -> hiện cho người dùng */
const isBusinessError = (err) => err && typeof err.number === 'number' && err.number >= 50000;

const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Icon riêng của dự án (public/icons/sprite.svg). ico('cart') -> <svg>; dùng với <%- %>.
 *  `name` chỉ nhận [a-z0-9-] nên an toàn để in raw. Icon trang trí => aria-hidden. */
const ico = (name, cls = '') => {
  const n = String(name).replace(/[^a-z0-9-]/g, '');
  const c = String(cls).replace(/[^a-zA-Z0-9_ -]/g, '');
  return `<svg class="ico ${c}" aria-hidden="true" focusable="false"><use href="/icons/sprite.svg#i-${n}"></use></svg>`;
};

/** Mức giá hiển thị gọn: 12500000 -> "12,5 triệu", 750000 -> "750 nghìn" */
const fmtMoneyShort = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  if (v >= 1000000) return `${(v / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`;
  if (v >= 1000) return `${Math.round(v / 1000).toLocaleString('vi-VN')} nghìn`;
  return fmtMoney(v);
};

/** Nhãn trục biểu đồ, ngắn gọn: 9856800000 -> "9,9 tỷ", 30239000 -> "30 tr", 4500 -> "5 k" */
const fmtAxis = (n) => {
  const v = Number(n) || 0;
  const f = (x, d) => x.toLocaleString('vi-VN', { maximumFractionDigits: d });
  if (v >= 1e9) return `${f(v / 1e9, 1)} tỷ`;
  if (v >= 1e6) return `${f(v / 1e6, v >= 1e7 ? 0 : 1)} tr`;
  if (v >= 1e3) return `${f(v / 1e3, 0)} k`;
  return String(Math.round(v));
};

/** Ảnh sản phẩm: ảnh thật nếu có, không thì ảnh minh hoạ theo danh mục (public/images/cat-*.svg) */
const CATEGORY_ART = {
  laptop: 'laptop', 'laptop-gaming': 'laptop', 'laptop-van-phong': 'laptop', 'laptop-do-hoa': 'laptop',
  ram: 'ram', ssd: 'ssd', chuot: 'mouse', 'ban-phim': 'keyboard', 'tai-nghe': 'headset', balo: 'bag', 'sac-cap': 'charger',
};
const productImage = (url, categorySlug) => {
  if (url && !/placeholder\.svg$/.test(url)) return url;
  return `/images/cat-${CATEGORY_ART[categorySlug] || 'laptop'}.svg`;
};

/**
 * Ước tính trả góp (chỉ mang tính tham khảo): trả trước prepayPct%, phần còn lại chia đều `months` tháng,
 * lãi `ratePctPerMonth`%/tháng tính trên dư nợ gốc ban đầu (lãi phẳng). 0% => chia đều.
 */
function installmentPlan(total, months, prepayPct, ratePctPerMonth = 0) {
  const t = Math.max(0, Number(total) || 0);
  const m = Math.max(1, Number(months) || 1);
  const prepay = Math.round(t * Math.min(90, Math.max(0, Number(prepayPct) || 0)) / 100);
  const principal = t - prepay;
  const interest = Math.round(principal * (ratePctPerMonth / 100) * m);
  const monthly = Math.round((principal + interest) / m);
  return { prepay, principal, interest, monthly, totalPaid: prepay + principal + interest };
}

/** Mã (id) trong URL/form -> số nguyên dương hợp lệ cho cột INT, hoặc null nếu không hợp lệ */
const parseId = (value) => {
  const id = Number(value);
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
};

/** Chuỗi ngày yyyy-mm-dd hợp lệ, hoặc '' */
const parseDateStr = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? m[0] : '';
};

module.exports = {
  parseId, parseDateStr, SERIAL_STATUS, RECEIPT_STATUS, fmtAxis,
  ico, fmtMoney, fmtMoneyShort, fmtDate, fmtDateTime, ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD,
  paginate, isBusinessError, slugify, productImage, installmentPlan, orderStage, orderSteps, orderBadge,
};
