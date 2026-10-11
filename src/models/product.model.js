// MODULE 2 - Model Sản phẩm (phần công khai cho cửa hàng + phần quản lý của nhân viên)
const db = require('../config/db');

/** Sản phẩm nổi bật cho trang chủ (mới nhất, đang bán) */
exports.featured = (limit = 8) => db.query(
  `SELECT TOP (@limit) ProductId, Sku, ProductName, Slug, SalePrice, BrandName, CategoryName, QtyAvailable, PrimaryImage
   FROM dbo.vw_ProductCatalog WHERE IsActive = 1 ORDER BY ProductId DESC`, { limit });

exports.rootCategories = () => db.query(
  'SELECT CategoryId, CategoryName, Slug FROM dbo.Categories WHERE ParentId IS NULL AND IsActive = 1 ORDER BY SortOrder');

exports.allBrands = () => db.query('SELECT BrandId, BrandName FROM dbo.Brands WHERE IsActive = 1 ORDER BY BrandName');

exports.categoryBySlug = (slug) => db.queryOne(
  'SELECT CategoryId, CategoryName, Slug, ParentId FROM dbo.Categories WHERE Slug = @slug AND IsActive = 1', { slug });

/**
 * Tìm kiếm/lọc/phân trang sản phẩm cho cửa hàng.
 * sort KHÔNG được đưa thẳng vào SQL - chỉ ánh xạ qua danh sách cột cho phép (ORDER BY
 * không parameterize được trong T-SQL), tránh SQL injection từ query string.
 */
const SORT_COLUMNS = {
  price_asc: 'SalePrice ASC',
  price_desc: 'SalePrice DESC',
  name: 'ProductName ASC',
  newest: 'ProductId DESC',
};

exports.search = async ({ q, minPrice, maxPrice, categoryId, brandId, sort, page = 1, pageSize = 12 } = {}) => {
  const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * pageSize;
  const orderBy = SORT_COLUMNS[sort] || SORT_COLUMNS.newest;
  const where = `WHERE IsActive = 1
    AND (@q IS NULL OR ProductName LIKE '%' + @q + '%' OR Sku LIKE '%' + @q + '%')
    AND (@minPrice IS NULL OR SalePrice >= @minPrice)
    AND (@maxPrice IS NULL OR SalePrice <= @maxPrice)
    AND (@categoryId IS NULL OR CategoryId = @categoryId OR CategoryParentId = @categoryId)
    AND (@brandId IS NULL OR BrandId = @brandId)`;
  const params = {
    q: q ? String(q).trim() : null,
    minPrice: minPrice ? Number(minPrice) : null,
    maxPrice: maxPrice ? Number(maxPrice) : null,
    categoryId: categoryId ? Number(categoryId) : null,
    brandId: brandId ? Number(brandId) : null,
  };
  const [rows, totalRow] = await Promise.all([
    db.query(
      `SELECT ProductId, Sku, ProductName, Slug, SalePrice, BrandName, CategoryName, QtyAvailable, PrimaryImage
       FROM dbo.vw_ProductCatalog ${where}
       ORDER BY ${orderBy}
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      { ...params, offset, pageSize }),
    db.queryOne(`SELECT COUNT(*) AS total FROM dbo.vw_ProductCatalog ${where}`, params),
  ]);
  return { rows, total: totalRow.total };
};

exports.findBySlug = (slug) => db.queryOne('SELECT * FROM dbo.vw_ProductCatalog WHERE Slug = @slug AND IsActive = 1', { slug });

exports.attributesOf = (productId) => db.query(
  `SELECT a.AttrName, a.Unit, pav.AttrValue
   FROM dbo.ProductAttributeValues pav JOIN dbo.Attributes a ON a.AttributeId = pav.AttributeId
   WHERE pav.ProductId = @productId ORDER BY a.AttributeId`, { productId });

exports.imagesOf = (productId) => db.query(
  'SELECT ImageUrl, IsPrimary FROM dbo.ProductImages WHERE ProductId = @productId ORDER BY IsPrimary DESC, SortOrder', { productId });

// TODO (M2) - quản lý: adminSearch(...), create(), update(), softDeleteOrRemove(id), saveAttributes(), saveImages()
