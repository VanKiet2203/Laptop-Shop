// Thành viên 3 - Khách mua hàng
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: Carts, CartItems
// Khách ĐÃ đăng nhập: giỏ lưu trong DB. Khách CHƯA đăng nhập: giỏ lưu trong session (core/guestCart.js),
// itemsForEntries() dựng lại thông tin sản phẩm từ DB cho cả hai trường hợp (giá/tồn luôn lấy từ DB).
const db = require('../config/db');

const ITEM_SELECT = `p.ProductId, p.Sku, p.ProductName, p.Slug, p.SalePrice, p.IsActive, cat.Slug AS CategorySlug,
          (p.QtyOnHand - p.QtyReserved) AS QtyAvailable, img.ImageUrl AS PrimaryImage`;

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
  `SELECT ${ITEM_SELECT}, ci.Quantity
   FROM dbo.Carts c
   JOIN dbo.CartItems ci ON ci.CartId = c.CartId
   JOIN dbo.Products p ON p.ProductId = ci.ProductId
   JOIN dbo.Categories cat ON cat.CategoryId = p.CategoryId
   LEFT JOIN dbo.ProductImages img ON img.ProductId = p.ProductId AND img.IsPrimary = 1
   WHERE c.CustomerId = @customerId
   ORDER BY ci.AddedAt DESC`, { customerId });

/** Giỏ của khách chưa đăng nhập: entries = [{ productId, qty }] (từ session) -> cùng dạng với items() */
exports.itemsForEntries = async (entries) => {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return [];
  const rows = await db.query(
    `SELECT ${ITEM_SELECT}
     FROM dbo.Products p
     JOIN dbo.Categories cat ON cat.CategoryId = p.CategoryId
     LEFT JOIN dbo.ProductImages img ON img.ProductId = p.ProductId AND img.IsPrimary = 1
     WHERE p.ProductId IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@ids, ','))`,
    { ids: list.map((e) => e.productId).join(',') });
  const byId = new Map(rows.map((r) => [r.ProductId, r]));
  // giữ thứ tự thêm (mới nhất lên đầu như giỏ trong DB); sản phẩm đã bị xoá khỏi DB thì bỏ qua
  return list.slice().reverse()
    .filter((e) => byId.has(e.productId))
    .map((e) => ({ ...byId.get(e.productId), Quantity: e.qty }));
};

/** Tổng số lượng trong giỏ - dùng cho badge trên navbar (req.session.cartCount) */
exports.count = async (customerId) => {
  const r = await db.queryOne(
    `SELECT ISNULL(SUM(ci.Quantity), 0) AS n FROM dbo.Carts c JOIN dbo.CartItems ci ON ci.CartId = c.CartId WHERE c.CustomerId = @customerId`,
    { customerId });
  return r ? r.n : 0;
};

/** Kiểm tra sản phẩm được phép thêm vào giỏ (đang bán + còn hàng). Trả về tồn có thể bán để giới hạn số lượng. */
exports.assertAddable = async (productId) => {
  const product = await db.queryOne(
    'SELECT IsActive, (QtyOnHand - QtyReserved) AS QtyAvailable FROM dbo.Products WHERE ProductId = @productId', { productId });
  if (!product || !product.IsActive) {
    throw Object.assign(new Error('Sản phẩm không tồn tại hoặc đã ngừng bán.'), { number: 50090 });
  }
  if (product.QtyAvailable <= 0) {
    throw Object.assign(new Error('Sản phẩm này tạm hết hàng.'), { number: 50091 });
  }
  return product.QtyAvailable;
};

/**
 * Thêm sản phẩm vào giỏ - cộng dồn nếu đã có, giới hạn tối đa 99 (CK_CI_Qty).
 * Dùng MERGE (1 câu lệnh atomic) thay vì SELECT rồi UPDATE/INSERT riêng, để
 * tránh lost-update khi 2 request "thêm vào giỏ" cùng sản phẩm chạy đồng thời
 * (double-click, mở 2 tab) ghi đè số lượng của nhau.
 */
exports.add = async (customerId, productId, qty) => {
  const available = await exports.assertAddable(productId);
  const cartId = await getOrCreateCartId(customerId);
  const maxQty = Math.min(99, available);
  await db.query(
    `MERGE dbo.CartItems WITH (HOLDLOCK) AS target
     USING (SELECT @cartId AS CartId, @productId AS ProductId, @qty AS Qty, @maxQty AS MaxQty) AS src
       ON target.CartId = src.CartId AND target.ProductId = src.ProductId
     WHEN MATCHED THEN
       UPDATE SET Quantity = CASE WHEN target.Quantity + src.Qty > src.MaxQty THEN src.MaxQty ELSE target.Quantity + src.Qty END
     WHEN NOT MATCHED THEN
       INSERT (CartId, ProductId, Quantity) VALUES (src.CartId, src.ProductId, CASE WHEN src.Qty > src.MaxQty THEN src.MaxQty ELSE src.Qty END);`,
    { cartId, productId, qty, maxQty });
};

/** Gộp giỏ session (lúc còn là khách vãng lai) vào giỏ DB sau khi đăng nhập/đăng ký. Bỏ qua dòng không thêm được. */
exports.mergeEntries = async (customerId, entries) => {
  for (const e of Array.isArray(entries) ? entries : []) {
    try {
      await exports.add(customerId, e.productId, e.qty);
    } catch (err) {
      if (!(err && (err.number === 50090 || err.number === 50091))) throw err;
    }
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
