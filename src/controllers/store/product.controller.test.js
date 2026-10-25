const assert = require('node:assert/strict');
const test = require('node:test');
const Product = require('../../models/product.model');
const controller = require('./product.controller');

const originals = {};
let calls;
const result = { rows: [{ ProductId: 1, ProductName: 'Laptop' }], total: 1, page: 1 };

test.beforeEach(() => {
  calls = [];
  for (const key of [
    'search', 'facets', 'suggest', 'rootCategories', 'allBrands', 'categoryBySlug', 'findBySlug',
    'attributesOf', 'imagesOf', 'compatibleComponentsOf',
  ]) {
    originals[key] = Product[key];
  }
  Product.search = async (filters) => {
    calls.push(['search', filters]);
    return result;
  };
  Product.facets = async (args) => {
    calls.push(['facets', args]);
    return {
      brands: [{ BrandId: 3, BrandName: 'Acme', count: 4 }],
      priceTiers: [{ label: 'Dưới 10 triệu', value: '0-9999999', count: 4 }],
      categories: [{ CategoryId: 2, CategoryName: 'Laptop', Slug: 'laptop', count: 4 }],
      children: [],
      total: 4,
    };
  };
  Product.suggest = async (q) => ({ products: [{ ProductName: q }], categories: [], brands: [] });
  Product.rootCategories = async () => [{ CategoryId: 2, CategoryName: 'Laptop', Slug: 'laptop' }];
  Product.allBrands = async () => [{ BrandId: 3, BrandName: 'Acme' }];
  Product.categoryBySlug = async () => ({
    CategoryId: 2, CategoryName: 'Laptop', Slug: 'laptop', ParentId: null,
  });
  Product.findBySlug = async () => null;
  Product.attributesOf = async () => [];
  Product.imagesOf = async () => [];
  Product.compatibleComponentsOf = async () => [];
});

test.afterEach(() => {
  for (const [key, value] of Object.entries(originals)) Product[key] = value;
  for (const key of Object.keys(originals)) delete originals[key];
});

function request(query = {}, params = {}) {
  const flashes = [];
  return {
    req: { query, params, flash(...args) { flashes.push(args); } },
    res: {
      status(code) { this.statusCode = code; return this; },
      render(view, data) { this.rendered = { view, data }; return this; },
    },
    flashes,
  };
}

test('store search clamps query length and passes supported filters and paging to model', async () => {
  const query = {
    q: ` ${'a'.repeat(110)} `,
    priceRange: '0-25000000',
    categoryId: '2',
    brandId: '3',
    sort: 'price_asc',
    page: '3',
  };
  const { req, res, flashes } = request(query);

  await controller.index(req, res);

  const search = calls.find(([name]) => name === 'search')[1];
  assert.equal(search.q.length, 100);
  assert.equal(search.minPrice, 0);
  assert.equal(search.maxPrice, 25000000);
  assert.equal(search.categoryId, 2);
  assert.deepEqual(search.brandIds, [3]);
  assert.equal(search.sort, 'price_asc');
  assert.equal(search.page, 3);
  assert.equal(search.pageSize, 12);
  assert.equal(flashes.length, 1);
  assert.equal(res.rendered.view, 'store/products');
});

test('malformed filters, page, and unsupported sort are ignored with a warning', async () => {
  const { req, res, flashes } = request({
    q: ['unexpected', 'array'],
    priceRange: '999-100',
    categoryId: '1.2',
    brandId: '2147483648',
    sort: 'SalePrice; DROP TABLE Products',
    page: '-3',
  });

  await controller.index(req, res);

  const search = calls.find(([name]) => name === 'search')[1];
  assert.equal(search.q, '');
  assert.equal(search.minPrice, undefined);
  assert.equal(search.maxPrice, undefined);
  assert.equal(search.categoryId, undefined);
  assert.deepEqual(search.brandIds, []);
  assert.equal(search.sort, 'newest');
  assert.equal(search.page, 1);
  assert.equal(flashes[0][0], 'warning');
});

test('category slug is resolved before listing and cannot be overridden by query categoryId', async () => {
  const { req, res } = request({ categoryId: '999', sort: 'name' }, { slug: 'laptop' });

  await controller.byCategory(req, res);

  const search = calls.find(([name]) => name === 'search')[1];
  assert.equal(search.categoryId, 2);
  assert.equal(res.rendered.data.activeCategory.Slug, 'laptop');
});

test('unknown categories and products return not-found without exposing inactive records', async () => {
  Product.categoryBySlug = async () => null;
  Product.findBySlug = async () => null;
  const categoryRequest = request({}, { slug: 'missing' });
  await controller.byCategory(categoryRequest.req, categoryRequest.res);
  assert.equal(categoryRequest.res.statusCode, 404);
  assert.equal(calls.some(([name]) => name === 'search'), false);

  const productRequest = request({}, { slug: 'inactive-product' });
  await controller.show(productRequest.req, productRequest.res);
  assert.equal(productRequest.res.statusCode, 404);
  assert.equal(productRequest.res.rendered.view, 'errors/404');
});

test('product detail loads only public product fields with its specifications and images', async () => {
  const product = { ProductId: 5, ProductName: 'Public Laptop', Slug: 'public-laptop' };
  const attributes = [{ AttrName: 'RAM', AttrValue: '16', Unit: 'GB' }];
  const images = [{ ImageUrl: '/images/laptop.jpg', IsPrimary: true }];
  const compatibilityGroups = [{
    categoryId: 4,
    categoryName: 'RAM',
    products: [{ ProductId: 9, ProductName: 'Compatible RAM' }],
  }];
  Product.findBySlug = async (slug) => {
    assert.equal(slug, 'public-laptop');
    return product;
  };
  Product.attributesOf = async (productId) => {
    assert.equal(productId, 5);
    return attributes;
  };
  Product.imagesOf = async (productId) => {
    assert.equal(productId, 5);
    return images;
  };
  Product.compatibleComponentsOf = async (productId) => {
    assert.equal(productId, 5);
    return compatibilityGroups;
  };
  const { req, res } = request({}, { slug: 'public-laptop' });

  await controller.show(req, res);

  assert.equal(res.rendered.view, 'store/product-detail');
  assert.equal(res.rendered.data.product, product);
  assert.equal(res.rendered.data.attributes, attributes);
  assert.equal(res.rendered.data.images, images);
  assert.equal(res.rendered.data.compatibilityGroups, compatibilityGroups);
});
