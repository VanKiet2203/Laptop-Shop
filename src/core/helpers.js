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

module.exports = { fmtMoney, fmtDate, fmtDateTime, ORDER_STATUS, PAYMENT_METHOD, paginate, isBusinessError, slugify };
