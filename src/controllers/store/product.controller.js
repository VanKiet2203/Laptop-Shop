// MODULE 2 - CỬA HÀNG (khách xem sản phẩm)
// Chủ sở hữu: Thành viên 2 - Danh mục sản phẩm
const Product = require('../../models/product.model');
const { paginate } = require('../../core/helpers');

const PAGE_SIZE = 12;
const MAX_FILTER_VALUE = Number.MAX_SAFE_INTEGER;
const MAX_QUERY_LENGTH = 100;
const SORT_OPTIONS = new Set(['newest', 'price_asc', 'price_desc', 'name']);

/** "0-1000000" -> { minPrice: 0, maxPrice: 1000000 }; vế rỗng = không giới hạn phía đó */
function parsePriceRange(priceRange) {
  if (priceRange === undefined || priceRange === '') {
    return { minPrice: undefined, maxPrice: undefined };
  }
  if (typeof priceRange !== 'string' || priceRange.length > 33) return { error: true };

  const match = /^(\d*)-(\d*)$/.exec(priceRange);
  if (!match || (!match[1] && !match[2])) return { error: true };
  if (match[1].length > 16 || match[2].length > 16) return { error: true };

  const minPrice = match[1] ? Number(match[1]) : undefined;
  const maxPrice = match[2] ? Number(match[2]) : undefined;
  if (
    (minPrice !== undefined && (!Number.isSafeInteger(minPrice) || minPrice > MAX_FILTER_VALUE))
    || (maxPrice !== undefined && (!Number.isSafeInteger(maxPrice) || maxPrice > MAX_FILTER_VALUE))
    || (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
  ) {
    return { error: true };
  }
  return { minPrice, maxPrice };
}

function parseOptionalId(value) {
  if (value === undefined || value === '') return { value: undefined };
  if (typeof value !== 'string' || value.length > 10 || !/^\d+$/.test(value)) return { error: true };
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return { error: true };
  return { value: id };
}

function parsePage(value) {
  if (value === undefined || value === '') return { value: 1 };
  if (typeof value !== 'string' || value.length > 10 || !/^\d+$/.test(value)) return { error: true };
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 2147483647) return { error: true };
  return { value: page };
}

async function listPage(req, res, extraWhere = {}, extra = {}) {
  const query = req.query || {};
  const warnings = [];
  let q = '';
  if (query.q !== undefined) {
    if (typeof query.q !== 'string') {
      warnings.push(true);
    } else {
      q = query.q.trim().slice(0, MAX_QUERY_LENGTH);
      if (query.q.trim().length > MAX_QUERY_LENGTH) warnings.push(true);
    }
  }

  const price = parsePriceRange(query.priceRange);
  if (price.error) warnings.push(true);

  const category = extraWhere.categoryId !== undefined
    ? { value: extraWhere.categoryId }
    : parseOptionalId(query.categoryId);
  if (category.error) warnings.push(true);

  const brand = parseOptionalId(query.brandId);
  if (brand.error) warnings.push(true);

  const sort = query.sort === undefined || query.sort === '' ? 'newest' : query.sort;
  if (typeof sort !== 'string' || !SORT_OPTIONS.has(sort)) warnings.push(true);

  const requestedPage = parsePage(query.page);
  if (requestedPage.error) warnings.push(true);

  if (warnings.length) req.flash('warning', 'Một số điều kiện tìm kiếm không hợp lệ đã được bỏ qua.');

  const filters = {
    q,
    minPrice: price.error ? undefined : price.minPrice,
    maxPrice: price.error ? undefined : price.maxPrice,
    categoryId: category.error ? undefined : category.value,
    brandId: brand.error ? undefined : brand.value,
    sort: typeof sort === 'string' && SORT_OPTIONS.has(sort) ? sort : 'newest',
  };
  const [result, categories, brands] = await Promise.all([
    Product.search({ ...filters, page: requestedPage.error ? 1 : requestedPage.value, pageSize: PAGE_SIZE }),
    Product.rootCategories(),
    Product.allBrands(),
  ]);
  const pg = paginate(result.page || (requestedPage.error ? 1 : requestedPage.value), PAGE_SIZE, result.total);
  res.render('store/products', {
    title: 'Sản phẩm',
    products: result.rows,
    categories,
    brands,
    pg,
    filters,
    ...extra,
  });
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
  const [attributes, images, compatibilityGroups] = await Promise.all([
    Product.attributesOf(product.ProductId),
    Product.imagesOf(product.ProductId),
    Product.compatibleComponentsOf(product.ProductId),
  ]);
  res.render('store/product-detail', {
    title: product.ProductName,
    product,
    attributes,
    images,
    compatibilityGroups,
  });
};
