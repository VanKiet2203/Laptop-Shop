const assert = require('node:assert/strict');
const test = require('node:test');
const Product = require('../../models/product.model');
const Promotion = require('../../models/promotion.model');
const controller = require('./home.controller');

const names = ['featured', 'rootCategories', 'bestSellers', 'topByCategorySlugs', 'facets'];
const originals = {};

test.beforeEach(() => {
  for (const n of names) originals[n] = Product[n];
  originals.active = Promotion.active;
});

test.afterEach(() => {
  for (const n of names) Product[n] = originals[n];
  Promotion.active = originals.active;
});

test('home page renders featured, best sellers, category rows, promotions and brands', async () => {
  const products = [{ ProductId: 1, ProductName: 'Laptop' }];
  const categories = [{ CategoryId: 2, CategoryName: 'Laptop' }];
  const best = [{ ProductId: 9, ProductName: 'Best' }];
  const slugCalls = [];
  let featuredLimit;
  Product.featured = async (limit) => { featuredLimit = limit; return products; };
  Product.rootCategories = async () => categories;
  Product.bestSellers = async () => best;
  Product.topByCategorySlugs = async (slugs) => { slugCalls.push(slugs); return []; };
  Product.facets = async () => ({ brands: [{ BrandId: 1, BrandName: 'Asus', count: 3 }] });
  Promotion.active = async () => [{ Code: 'BTS2026' }];
  const res = { render(view, data) { this.rendered = { view, data }; } };

  await controller.index({}, res);

  assert.equal(featuredLimit, 8);
  assert.equal(res.rendered.view, 'store/home');
  assert.equal(res.rendered.data.products, products);
  assert.equal(res.rendered.data.categories, categories);
  assert.equal(res.rendered.data.bestSellers, best);
  assert.deepEqual(slugCalls, [['laptop-gaming'], ['laptop-van-phong'], ['ram', 'ssd']]);
  assert.equal(res.rendered.data.promotions[0].Code, 'BTS2026');
  assert.equal(res.rendered.data.brands[0].BrandName, 'Asus');
});
