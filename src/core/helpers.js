// Hàm tiện ích dùng chung (định dạng, phân trang, lỗi nghiệp vụ)
const fmtMoney = (n) => (n == null ? '' : new Intl.NumberFormat('vi-VN').format(Math.round(Number(n))) + ' ₫');
const pad = (x) => String(x).padStart(2, '0');
const fmtDate = (d) => { if (!d) return ''; const x = new Date(d); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
const fmtDateTime = (d) => { if (!d) return ''; const x = new Date(d); return `${fmtDate(x)} ${pad(x.getHours())}:${pad(x.getMinutes())}`; };

const ORDER_STATUS = {
  Pending: { label: 'Chờ duyệt', cls: 'warning' },
  Approved: { label: 'Đã duyệt', cls: 'primary' },
  Completed: { label: 'Hoàn tất', cls: 'success' },
  Cancelled: { label: 'Đã huỷ', cls: 'secondary' },
};
// Orders.PaymentStatus (xem CK_Orders_PayStatus trong database/01_schema.sql)
const PAYMENT_STATUS = {
  Pending: { label: 'Chờ thanh toán', cls: 'warning' },
  Paid: { label: 'Đã thanh toán', cls: 'success' },
  RefundPending: { label: 'Chờ hoàn tiền', cls: 'info' },
  Refunded: { label: 'Đã hoàn tiền', cls: 'secondary' },
};
const PAYMENT_METHOD = { COD: 'Thanh toán khi nhận hàng', BankTransfer: 'Chuyển khoản', Card: 'Thẻ', Installment: 'Trả góp', Cash: 'Tiền mặt' };

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

module.exports = { ico, fmtMoney, fmtDate, fmtDateTime, ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, paginate, isBusinessError, slugify };
