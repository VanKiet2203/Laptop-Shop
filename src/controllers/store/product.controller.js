// MODULE 2 - CỬA HÀNG (khách xem sản phẩm)
// Chủ sở hữu: Thành viên 2 - Danh mục sản phẩm
const Product = require('../../models/product.model');
const { paginate } = require('../../core/helpers');

const PAGE_SIZE = 12;
const MAX_FILTER_VALUE = Number.MAX_SAFE_INTEGER;
const MAX_QUERY_LENGTH = 100;
const MAX_BRANDS = 10;
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

/** brandId có thể lặp lại (?brandId=1&brandId=3) để chọn nhiều hãng. Giá trị sai bị bỏ qua. */
function parseBrandIds(value) {
  if (value === undefined || value === '') return { values: [] };
  const list = Array.isArray(value) ? value : [value];
  const values = [];
  let error = list.length > MAX_BRANDS;
  for (const item of list.slice(0, MAX_BRANDS)) {
    const parsed = parseOptionalId(item);
    if (parsed.error) error = true;
    else if (parsed.value !== undefined && !values.includes(parsed.value)) values.push(parsed.value);
  }
  return { values, error };
}

function parsePage(value) {
  if (value === undefined || value === '') return { value: 1 };
  if (typeof value !== 'string' || value.length > 10 || !/^\d+$/.test(value)) return { error: true };
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 2147483647) return { error: true };
  return { value: page };
}

const isFetch = (req) => typeof req.get === 'function' && req.get('X-Requested-With') === 'fetch';

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

  const brands = parseBrandIds(query.brandId);
  if (brands.error) warnings.push(true);

  const sort = query.sort === undefined || query.sort === '' ? 'newest' : query.sort;
  if (typeof sort !== 'string' || !SORT_OPTIONS.has(sort)) warnings.push(true);

  const requestedPage = parsePage(query.page);
  if (requestedPage.error) warnings.push(true);

  if (warnings.length && !isFetch(req)) req.flash('warning', 'Một số điều kiện tìm kiếm không hợp lệ đã được bỏ qua.');

  const categoryId = category.error ? undefined : category.value;

  // Bộ lọc theo ngữ cảnh: chỉ gợi ý hãng / mức giá thực sự có trong danh mục (và từ khoá) đang xem.
  const facets = await Product.facets({ categoryId, q });
  const allowedBrands = new Set(facets.brands.map((b) => b.BrandId));
  const brandIds = brands.values.filter((id) => allowedBrands.has(id));

  const filters = {
    q,
    minPrice: price.error ? undefined : price.minPrice,
    maxPrice: price.error ? undefined : price.maxPrice,
    categoryId,
    brandIds,
    sort: typeof sort === 'string' && SORT_OPTIONS.has(sort) ? sort : 'newest',
  };
  const result = await Product.search({
    ...filters,
    page: requestedPage.error ? 1 : requestedPage.value,
    pageSize: PAGE_SIZE,
  });
  const pg = paginate(result.page || (requestedPage.error ? 1 : requestedPage.value), PAGE_SIZE, result.total);
  const priceRange = (filters.minPrice !== undefined || filters.maxPrice !== undefined)
    ? `${filters.minPrice === undefined ? '' : filters.minPrice}-${filters.maxPrice === undefined ? '' : filters.maxPrice}`
    : '';
  const data = {
    title: 'Sản phẩm',
    products: result.rows,
    facets,
    pg,
    filters: { ...filters, priceRange },
    ...extra,
  };
  // Lọc tức thì: fetch chỉ cần phần danh sách + bộ lọc (không kèm layout) để thay vào trang
  if (isFetch(req)) return res.render('store/_catalog', { ...data, layout: false });
  return res.render('store/products', data);
}

// GET /products
exports.index = (req, res) => listPage(req, res, {}, {});

// GET /category/:slug
exports.byCategory = async (req, res) => {
  const category = await Product.categoryBySlug(req.params.slug);
  if (!category) return res.status(404).render('errors/404', { title: 'Không tìm thấy danh mục' });
  await listPage(req, res, { categoryId: category.CategoryId }, { title: category.CategoryName, activeCategory: category });
};

// GET /api/suggest?q=...  (gợi ý khi đang gõ ô tìm kiếm, chưa cần Enter)
exports.suggest = async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, MAX_QUERY_LENGTH) : '';
  const result = await Product.suggest(q);
  res.set('Cache-Control', 'private, max-age=20');
  res.json(result);
};

// GET /products/:slug
exports.show = async (req, res) => {
  const product = await Product.findBySlug(req.params.slug);
  if (!product) return res.status(404).render('errors/404', { title: 'Không tìm thấy sản phẩm' });
  const [attributes, images, compatibilityGroups, otherProducts] = await Promise.all([
    Product.attributesOf(product.ProductId),
    Product.imagesOf(product.ProductId),
    Product.compatibleComponentsOf(product.ProductId),
    Product.otherInGroup(product),
  ]);
  res.render('store/product-detail', {
    title: product.ProductName,
    product,
    attributes,
    images,
    compatibilityGroups,
    otherProducts,
  });
};
