// Giỏ hàng của khách CHƯA đăng nhập - lưu trong session dạng [{ productId, qty }].
// Chỉ lưu mã + số lượng; giá, tên, tồn kho luôn đọc lại từ DB (Cart.itemsForEntries) nên client không giả mạo được giá.
const MAX_LINES = 50;
const MAX_QTY = 99;

const clampQty = (n) => Math.min(MAX_QTY, Math.max(1, Number.parseInt(n, 10) || 1));

function entries(req) {
  const raw = Array.isArray(req.session.cart) ? req.session.cart : [];
  return raw
    .map((e) => ({ productId: Number.parseInt(e && e.productId, 10), qty: clampQty(e && e.qty) }))
    .filter((e) => Number.isSafeInteger(e.productId) && e.productId > 0)
    .slice(0, MAX_LINES);
}

const count = (req) => entries(req).reduce((s, e) => s + e.qty, 0);

function save(req, list) {
  req.session.cart = list;
  req.session.cartCount = list.reduce((s, e) => s + e.qty, 0);
}

/** Cộng dồn số lượng (tối đa `maxQty` nếu truyền vào, ví dụ = tồn có thể bán). */
function add(req, productId, qty, maxQty = MAX_QTY) {
  const list = entries(req);
  const cap = Math.max(1, Math.min(MAX_QTY, maxQty));
  const cur = list.find((e) => e.productId === productId);
  if (cur) cur.qty = Math.min(cap, cur.qty + clampQty(qty));
  else if (list.length < MAX_LINES) list.push({ productId, qty: Math.min(cap, clampQty(qty)) });
  save(req, list);
}

function setQty(req, productId, qty) {
  const q = Number.parseInt(qty, 10) || 0;
  const list = entries(req).filter((e) => e.productId !== productId || q > 0);
  const cur = list.find((e) => e.productId === productId);
  if (cur) cur.qty = clampQty(q);
  save(req, list);
}

function remove(req, productId) {
  save(req, entries(req).filter((e) => e.productId !== productId));
}

function clear(req) {
  save(req, []);
}

module.exports = { entries, count, add, setQty, remove, clear, MAX_QTY };
