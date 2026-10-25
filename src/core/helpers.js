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
const PAYMENT_METHOD = { COD: 'Thanh toán khi nhận hàng', BankTransfer: 'Chuyển khoản ngân hàng', Card: 'Thẻ', Installment: 'Trả góp', Cash: 'Tiền mặt' };

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
  paginate, isBusinessError, slugify, productImage, installmentPlan,
};
