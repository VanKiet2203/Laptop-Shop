// MODULE 2 - Model Sản phẩm (phần công khai cho cửa hàng + phần quản lý của nhân viên)
const db = require('../config/db');

/** Sản phẩm nổi bật cho trang chủ (mới nhất, đang bán) */
exports.featured = (limit = 8) => db.query(
  `SELECT TOP (@limit) ProductId, Sku, ProductName, Slug, SalePrice, BrandName, CategoryName, QtyAvailable, PrimaryImage
   FROM dbo.vw_ProductCatalog WHERE IsActive = 1 ORDER BY ProductId DESC`, { limit });

exports.rootCategories = () => db.query(
  'SELECT CategoryId, CategoryName, Slug FROM dbo.Categories WHERE ParentId IS NULL AND IsActive = 1 ORDER BY SortOrder');

// TODO (M2) - công khai:  search({ q, minPrice, maxPrice, categoryId, brandId, sort, page, pageSize }) -> { rows, total }
//                         findBySlug(slug), attributesOf(productId), compatibleComponents(productId)
// TODO (M2) - quản lý  :  adminSearch(...), create(), update(), softDeleteOrRemove(id), saveAttributes(), saveImages()
//   Gợi ý phân trang: SELECT ... ORDER BY ... OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY  (+ COUNT(*) OVER() hoặc truy vấn đếm riêng)
