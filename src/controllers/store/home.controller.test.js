const assert = require('node:assert/strict');
const test = require('node:test');
const Product = require('../../models/product.model');
const controller = require('./home.controller');

const originalFeatured = Product.featured;
const originalRootCategories = Product.rootCategories;

test.afterEach(() => {
  Product.featured = originalFeatured;
  Product.rootCategories = originalRootCategories;
});

test('home page renders featured products and active root categories', async () => {
  const products = [{ ProductId: 1, ProductName: 'Laptop' }];
  const categories = [{ CategoryId: 2, CategoryName: 'Laptop' }];
  let featuredLimit;
  Product.featured = async (limit) => {
    featuredLimit = limit;
    return products;
  };
  Product.rootCategories = async () => categories;
  const res = {
    render(view, data) {
      this.rendered = { view, data };
    },
  };

  await controller.index({}, res);

  assert.equal(featuredLimit, 8);
  assert.equal(res.rendered.view, 'store/home');
  assert.equal(res.rendered.data.products, products);
  assert.equal(res.rendered.data.categories, categories);
});
