// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
const Cart = require('../../models/cart.model');
const { isBusinessError } = require('../../core/helpers');

async function syncCartCount(req) {
  req.session.cartCount = await Cart.count(req.session.user.customerId);
}

// GET /cart
exports.show = async (req, res) => {
  const items = await Cart.items(req.session.user.customerId);
  const subtotal = items.reduce((sum, i) => sum + i.Quantity * i.SalePrice, 0);
  res.render('customer/cart', { title: 'Giỏ hàng', items, subtotal });
};

// POST /cart/add
exports.add = async (req, res) => {
  const productId = parseInt(req.body.productId, 10);
  const qty = Math.max(1, Math.min(99, parseInt(req.body.qty, 10) || 1));
  try {
    await Cart.add(req.session.user.customerId, productId, qty);
    await syncCartCount(req);
    req.flash('success', 'Đã thêm vào giỏ hàng.');
  } catch (e) {
    if (isBusinessError(e)) req.flash('danger', e.message); else throw e;
  }
  res.redirect(req.get('Referer') || '/cart');
};

// POST /cart/update
exports.update = async (req, res) => {
  const productId = parseInt(req.body.productId, 10);
  const qty = parseInt(req.body.qty, 10) || 0;
  await Cart.updateQty(req.session.user.customerId, productId, qty);
  await syncCartCount(req);
  req.flash('success', 'Đã cập nhật giỏ hàng.');
  res.redirect('/cart');
};

// POST /cart/remove/:productId
exports.remove = async (req, res) => {
  await Cart.remove(req.session.user.customerId, parseInt(req.params.productId, 10));
  await syncCartCount(req);
  req.flash('success', 'Đã bỏ sản phẩm khỏi giỏ.');
  res.redirect('/cart');
};
