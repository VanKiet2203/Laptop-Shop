// MODULE 3 - KHÁCH MUA HÀNG
// Giỏ hàng cho cả khách ĐÃ đăng nhập (lưu DB) và CHƯA đăng nhập (lưu session, xem core/guestCart.js).
// Các thao tác (thêm / sửa số lượng / xoá) trả JSON khi gọi bằng fetch (header X-Requested-With: fetch)
// để trang không phải tải lại; không có JS thì vẫn hoạt động bằng form + redirect.
const Cart = require('../../models/cart.model');
const guestCart = require('../../core/guestCart');
const { isBusinessError } = require('../../core/helpers');

const isCustomer = (req) => Boolean(req.session.user && req.session.user.customerId);
const wantsJson = (req) => req.get('X-Requested-With') === 'fetch';

const loadItems = (req) => (isCustomer(req)
  ? Cart.items(req.session.user.customerId)
  : Cart.itemsForEntries(guestCart.entries(req)));

async function syncCartCount(req) {
  req.session.cartCount = isCustomer(req)
    ? await Cart.count(req.session.user.customerId)
    : guestCart.count(req);
  return req.session.cartCount;
}

const subtotalOf = (items) => items.reduce((sum, i) => sum + i.Quantity * i.SalePrice, 0);
const purchasable = (i) => Boolean(i.IsActive) && i.QtyAvailable > 0;

function parseId(value) {
  if (!/^\d{1,10}$/.test(String(value == null ? '' : value).trim())) return null; // "1e3", "12abc", "-5" không hợp lệ
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

// GET /cart
exports.show = async (req, res) => {
  const items = await loadItems(req);
  // Mặc định chọn hết sản phẩm còn bán được; nếu khách đã chọn trước đó (rồi quay lại sửa giỏ) thì giữ nguyên lựa chọn
  const saved = Array.isArray(req.session.checkoutSelection) ? req.session.checkoutSelection : null;
  const selected = items.filter((i) => purchasable(i) && (!saved || saved.includes(i.ProductId))).map((i) => i.ProductId);
  const selectedItems = items.filter((i) => selected.includes(i.ProductId));
  res.render('customer/cart', { title: 'Giỏ hàng', items, selected, subtotal: subtotalOf(selectedItems) });
};

// POST /cart/checkout - chốt các sản phẩm được chọn để mua, phần còn lại ở nguyên trong giỏ
exports.selectForCheckout = async (req, res) => {
  const raw = [].concat((req.body && req.body.productId) || []);
  const ids = new Set(raw.map(parseId).filter(Boolean));
  // Chỉ nhận sản phẩm đang có trong giỏ và còn bán được (client không thể chọn món lạ hay đã hết hàng)
  const chosen = (await loadItems(req)).filter((i) => ids.has(i.ProductId) && purchasable(i)).map((i) => i.ProductId);
  if (!chosen.length) {
    req.flash('warning', 'Vui lòng chọn ít nhất một sản phẩm để đặt hàng.');
    return res.redirect('/cart');
  }
  req.session.checkoutSelection = chosen;
  return res.redirect('/checkout');
};

// POST /cart/add
exports.add = async (req, res) => {
  const productId = parseId(req.body.productId);
  const qty = Math.max(1, Math.min(99, Number.parseInt(req.body.qty, 10) || 1));
  try {
    if (!productId) throw Object.assign(new Error('Sản phẩm không hợp lệ.'), { number: 50090 });
    if (isCustomer(req)) {
      await Cart.add(req.session.user.customerId, productId, qty);
    } else {
      const available = await Cart.assertAddable(productId);
      guestCart.add(req, productId, qty, available);
    }
    // Sản phẩm vừa thêm mặc định được chọn nếu khách đang giữ một lựa chọn riêng
    if (Array.isArray(req.session.checkoutSelection) && !req.session.checkoutSelection.includes(productId)) req.session.checkoutSelection.push(productId);
    const count = await syncCartCount(req);
    if (wantsJson(req)) return res.json({ ok: true, message: 'Đã thêm vào giỏ hàng.', count });
    req.flash('success', 'Đã thêm vào giỏ hàng.');
  } catch (e) {
    if (!isBusinessError(e)) throw e;
    if (wantsJson(req)) return res.status(400).json({ ok: false, message: e.message, count: req.session.cartCount || 0 });
    req.flash('danger', e.message);
  }
  return res.redirect(req.get('Referer') || '/cart');
};

// POST /cart/update
exports.update = async (req, res) => {
  const productId = parseId(req.body.productId);
  const requested = Number.parseInt(req.body.qty, 10) || 0;
  if (!productId) {
    if (wantsJson(req)) return res.status(400).json({ ok: false, message: 'Sản phẩm không hợp lệ.' });
    return res.redirect('/cart');
  }

  // Không cho đặt số lượng vượt tồn có thể bán (tránh để khách tới bước thanh toán mới bị báo thiếu hàng)
  let items = await loadItems(req);
  const line = items.find((i) => i.ProductId === productId);
  let qty = requested;
  let clamped = false;
  if (line && qty > 0 && line.QtyAvailable > 0 && qty > line.QtyAvailable) {
    qty = line.QtyAvailable;
    clamped = true;
  }
  if (line) {
    if (isCustomer(req)) await Cart.updateQty(req.session.user.customerId, productId, qty);
    else guestCart.setQty(req, productId, qty);
  }
  const count = await syncCartCount(req);

  if (wantsJson(req)) {
    items = await loadItems(req);
    const updated = items.find((i) => i.ProductId === productId);
    return res.json({
      ok: true,
      count,
      removed: !updated,
      qty: updated ? updated.Quantity : 0,
      available: updated ? updated.QtyAvailable : 0,
      lineTotal: updated ? updated.Quantity * updated.SalePrice : 0,
      subtotal: subtotalOf(items),
      clamped,
      message: clamped ? `Chỉ còn ${qty} sản phẩm trong kho.` : null,
    });
  }
  req.flash(clamped ? 'warning' : 'success', clamped ? `Chỉ còn ${qty} sản phẩm trong kho, đã chỉnh lại số lượng.` : 'Đã cập nhật giỏ hàng.');
  return res.redirect('/cart');
};

// POST /cart/remove/:productId
exports.remove = async (req, res) => {
  const productId = parseId(req.params.productId);
  if (productId) {
    if (isCustomer(req)) await Cart.remove(req.session.user.customerId, productId);
    else guestCart.remove(req, productId);
  }
  const count = await syncCartCount(req);
  if (wantsJson(req)) {
    const items = await loadItems(req);
    return res.json({ ok: true, count, removed: true, subtotal: subtotalOf(items), empty: items.length === 0 });
  }
  req.flash('success', 'Đã bỏ sản phẩm khỏi giỏ.');
  return res.redirect('/cart');
};
