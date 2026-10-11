// Thành viên 3 - Khách mua hàng
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: Carts, CartItems
const db = require('../config/db');

async function getOrCreateCartId(customerId) {
  const existing = await db.queryOne('SELECT CartId FROM dbo.Carts WHERE CustomerId = @customerId', { customerId });
  if (existing) return existing.CartId;
  const rows = await db.query(
    'INSERT INTO dbo.Carts (CustomerId) OUTPUT INSERTED.CartId VALUES (@customerId)', { customerId });
  return rows[0].CartId;
}
exports.getOrCreateCartId = getOrCreateCartId;

/** Giỏ hàng + thông tin sản phẩm + tồn kho hiện tại, để cảnh báo vượt tồn trên view */
exports.items = (customerId) => db.query(
  `SELECT p.ProductId, p.Sku, p.ProductName, p.Slug, p.SalePrice, p.IsActive,
          (p.QtyOnHand - p.QtyReserved) AS QtyAvailable, img.ImageUrl AS PrimaryImage, ci.Quantity
   FROM dbo.Carts c
   JOIN dbo.CartItems ci ON ci.CartId = c.CartId
   JOIN dbo.Products p ON p.ProductId = ci.ProductId
   LEFT JOIN dbo.ProductImages img ON img.ProductId = p.ProductId AND img.IsPrimary = 1
   WHERE c.CustomerId = @customerId
   ORDER BY ci.AddedAt DESC`, { customerId });

/** Tổng số lượng trong giỏ - dùng cho badge trên navbar (req.session.cartCount) */
exports.count = async (customerId) => {
  const r = await db.queryOne(
    `SELECT ISNULL(SUM(ci.Quantity), 0) AS n FROM dbo.Carts c JOIN dbo.CartItems ci ON ci.CartId = c.CartId WHERE c.CustomerId = @customerId`,
    { customerId });
  return r ? r.n : 0;
};

/** Thêm sản phẩm vào giỏ - cộng dồn nếu đã có, giới hạn tối đa 99 (CK_CI_Qty) */
exports.add = async (customerId, productId, qty) => {
  const product = await db.queryOne('SELECT IsActive FROM dbo.Products WHERE ProductId = @productId', { productId });
  if (!product || !product.IsActive) {
    throw Object.assign(new Error('Sản phẩm không tồn tại hoặc đã ngừng bán.'), { number: 50090 });
  }
  const cartId = await getOrCreateCartId(customerId);
  const existing = await db.queryOne(
    'SELECT Quantity FROM dbo.CartItems WHERE CartId = @cartId AND ProductId = @productId', { cartId, productId });
  const newQty = Math.min(99, (existing ? existing.Quantity : 0) + qty);
  if (existing) {
    await db.query('UPDATE dbo.CartItems SET Quantity = @newQty WHERE CartId = @cartId AND ProductId = @productId', { cartId, productId, newQty });
  } else {
    await db.query('INSERT INTO dbo.CartItems (CartId, ProductId, Quantity) VALUES (@cartId, @productId, @newQty)', { cartId, productId, newQty });
  }
};

/** Sửa số lượng - về <= 0 thì coi như bỏ khỏi giỏ */
exports.updateQty = (customerId, productId, qty) => {
  if (qty <= 0) return exports.remove(customerId, productId);
  const q = Math.min(99, qty);
  return db.query(
    `UPDATE ci SET ci.Quantity = @q
     FROM dbo.CartItems ci JOIN dbo.Carts c ON c.CartId = ci.CartId
     WHERE c.CustomerId = @customerId AND ci.ProductId = @productId`, { customerId, productId, q });
};

exports.remove = (customerId, productId) => db.query(
  `DELETE ci FROM dbo.CartItems ci JOIN dbo.Carts c ON c.CartId = ci.CartId
   WHERE c.CustomerId = @customerId AND ci.ProductId = @productId`, { customerId, productId });
