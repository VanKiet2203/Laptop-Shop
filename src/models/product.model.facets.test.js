const assert = require('node:assert/strict');
const test = require('node:test');
const db = require('../config/db');
const Product = require('./product.model');

const categories = [
  { CategoryId: 1, ParentId: null, CategoryName: 'Laptop', Slug: 'laptop', SortOrder: 1, IsActive: true },
  { CategoryId: 2, ParentId: null, CategoryName: 'Linh kiện', Slug: 'linh-kien', SortOrder: 2, IsActive: true },
  { CategoryId: 3, ParentId: 1, CategoryName: 'Laptop Gaming', Slug: 'laptop-gaming', SortOrder: 1, IsActive: true },
  { CategoryId: 4, ParentId: 2, CategoryName: 'RAM', Slug: 'ram', SortOrder: 1, IsActive: true },
  { CategoryId: 5, ParentId: 2, CategoryName: 'Ẩn', Slug: 'an', SortOrder: 2, IsActive: false },
];
const p = (id, name, catId, catName, brandId, brand, price) => ({
  ProductId: id, ProductName: name, Sku: `SKU${id}`, Slug: `p${id}`, CategoryId: catId, CategoryName: catName, BrandId: brandId, BrandName: brand, SalePrice: price, QtyAvailable: 3,
});
const products = [
  p(1, 'Acer Nitro 5', 3, 'Laptop Gaming', 10, 'Acer', 22000000),
  p(2, 'Asus TUF F15', 3, 'Laptop Gaming', 11, 'Asus', 25000000),
  p(3, 'Asus Vivobook', 3, 'Laptop Gaming', 11, 'Asus', 12000000),
  p(4, 'Kingston Fury 8GB', 4, 'RAM', 20, 'Kingston', 750000),
  p(5, 'Kingston Fury 16GB', 4, 'RAM', 20, 'Kingston', 1890000),
];

let originalQuery;
test.beforeEach(() => {
  originalQuery = db.query;
  Product.invalidateCatalogCache();
  db.query = async (sql) => (sql.includes('FROM dbo.Categories') ? categories : products);
});
test.afterEach(() => {
  db.query = originalQuery;
  Product.invalidateCatalogCache();
});

test('facets only offer brands and price tiers that exist in the selected category (laptop has no Kingston, RAM has no Acer)', async () => {
  const laptop = await Product.facets({ categoryId: 1 });
  assert.deepEqual(laptop.brands.map((b) => b.BrandName), ['Asus', 'Acer']);
  assert.ok(laptop.priceTiers.every((t) => t.count > 0));
  assert.ok(laptop.priceTiers.some((t) => t.label.includes('triệu')));

  const ram = await Product.facets({ categoryId: 4 });
  assert.deepEqual(ram.brands.map((b) => b.BrandName), ['Kingston']);
  assert.ok(ram.priceTiers.some((t) => /nghìn|triệu/.test(t.label)));
  // RAM tiers nhỏ hơn nhiều so với laptop
  assert.ok(ram.priceTiers.every((t) => t.min < 3000000));
});

test('facets hide inactive categories and count children for the sidebar', async () => {
  const all = await Product.facets({});
  assert.deepEqual(all.categories.map((c) => c.Slug), ['laptop', 'linh-kien']);
  assert.equal(all.categories[0].count, 3);
  const comp = await Product.facets({ categoryId: 2 });
  assert.deepEqual(comp.children.map((c) => c.Slug), ['ram']);
});

test('facets respect the search keyword with accent-insensitive matching', async () => {
  const f = await Product.facets({ q: 'kingston' });
  assert.equal(f.total, 2);
  const g = await Product.facets({ q: 'GAMING' });
  assert.equal(g.total, 3, 'từ khoá khớp tên danh mục, không phân biệt hoa thường');
});

test('price tier values are valid for the controller price range parser', async () => {
  const f = await Product.facets({ categoryId: 1 });
  for (const t of f.priceTiers) assert.match(t.value, /^\d+-\d*$/);
});

test('menuData returns root categories with children, brands and tiers', async () => {
  const menu = await Product.menuData();
  assert.equal(menu.length, 2);
  assert.equal(menu[0].children[0].Slug, 'laptop-gaming');
  assert.deepEqual(menu[1].brands.map((b) => b.BrandName), ['Kingston']);
});

test('search turns keywords into parameters (never string concatenation) and passes multiple brands', async () => {
  const seen = [];
  db.queryOne = async (sql, params) => { seen.push({ sql, params }); return { total: 0 }; };
  db.query = async (sql, params) => { seen.push({ sql, params }); return []; };
  await Product.search({ q: "asus'; DROP TABLE x;-- tuf", brandIds: [11, '20', 'x', -3], categoryId: 1, sort: 'price_desc' });
  const first = seen[0];
  assert.equal(first.params.brandIds, '11,20');
  assert.equal(first.params.t0, "asus';");
  assert.equal(first.params.t1, 'DROP');
  assert.ok(!first.sql.includes('DROP'));
  assert.match(first.sql, /Vietnamese_CI_AI/);
  assert.match(seen[1].sql, /ORDER BY SalePrice DESC/);
});

test('suggest ignores very short input and escapes LIKE wildcards', async () => {
  assert.deepEqual(await Product.suggest('a'), { products: [], categories: [], brands: [] });
  const seen = [];
  db.query = async (sql, params) => { seen.push({ sql, params }); return sql.includes('FROM dbo.Categories') ? categories : []; };
  await Product.suggest('50%_off');
  const productQuery = seen.find((s) => s.sql.includes('vw_ProductCatalog') && s.params && s.params.t0);
  assert.equal(productQuery.params.t0, '50[%][_]off');
});
