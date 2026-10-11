// MODULE 2 - CỬA HÀNG (khách xem sản phẩm)
// Chủ sở hữu: Thành viên 2 - Danh mục sản phẩm
const Product = require('../../models/product.model');
const { paginate } = require('../../core/helpers');

const PAGE_SIZE = 12;

/** "0-1000000" -> { minPrice: 0, maxPrice: 1000000 }; vế rỗng = không giới hạn phía đó */
function parsePriceRange(priceRange) {
  if (!priceRange) return { minPrice: undefined, maxPrice: undefined };
  const [min, max] = String(priceRange).split('-');
  return { minPrice: min ? Number(min) : undefined, maxPrice: max ? Number(max) : undefined };
}

async function listPage(req, res, extraWhere = {}, extra = {}) {
  const { q, priceRange, brandId, sort, page } = req.query;
  const { minPrice, maxPrice } = parsePriceRange(priceRange);
  const categoryId = extraWhere.categoryId || req.query.categoryId;
  const filters = { q, minPrice, maxPrice, categoryId, brandId, sort };
  const [{ rows, total }, categories, brands] = await Promise.all([
    Product.search({ ...filters, page, pageSize: PAGE_SIZE }),
    Product.rootCategories(),
    Product.allBrands(),
  ]);
  const pg = paginate(page, PAGE_SIZE, total);
  res.render('store/products', { title: 'Sản phẩm', products: rows, categories, brands, pg, filters, ...extra });
}

// GET /products
exports.index = (req, res) => listPage(req, res, {}, {});

// GET /category/:slug
exports.byCategory = async (req, res) => {
  const category = await Product.categoryBySlug(req.params.slug);
  if (!category) return res.status(404).render('errors/404', { title: 'Không tìm thấy danh mục' });
  await listPage(req, res, { categoryId: category.CategoryId }, { title: category.CategoryName, activeCategory: category });
};

// GET /products/:slug
exports.show = async (req, res) => {
  const product = await Product.findBySlug(req.params.slug);
  if (!product) return res.status(404).render('errors/404', { title: 'Không tìm thấy sản phẩm' });
  const [attributes, images] = await Promise.all([
    Product.attributesOf(product.ProductId),
    Product.imagesOf(product.ProductId),
  ]);
  res.render('store/product-detail', { title: product.ProductName, product, attributes, images });
};
