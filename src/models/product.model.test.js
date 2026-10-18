const assert = require('node:assert/strict');
const test = require('node:test');
const Product = require('./product.model');

const validProduct = {
  sku: 'TEST-1',
  productName: 'Test Laptop',
  slug: 'test-laptop',
  categoryId: 2,
  brandId: 3,
  shortDesc: null,
  description: null,
  salePrice: 1000000,
  warrantyMonths: 12,
  isSerialTracked: false,
  imageUrls: [],
  attributeValues: [],
};

test('product creation locks category tree then the brand before validating references', async () => {
  const statements = [];
  const transaction = {
    async query(sql, params) {
      statements.push({ sql, params });
      if (sql.includes('SELECT BrandId, IsActive')) return [{ BrandId: 3, IsActive: true }];
      if (sql.includes('AS valid')) return [{ valid: 1 }];
      if (sql.includes('INSERT INTO dbo.Products')) return [{ ProductId: 17 }];
      return [];
    },
  };

  const result = await Product.createManaged(validProduct, transaction);

  assert.deepEqual(result, { productId: 17 });
  const treeLockIndex = statements.findIndex(({ sql }) => sql.includes('TABLOCK, HOLDLOCK'));
  const brandLockIndex = statements.findIndex(({ sql }) => sql.includes('UPDLOCK, HOLDLOCK'));
  const categoryValidationIndex = statements.findIndex(({ sql }) => sql.includes('AS valid'));
  const insertIndex = statements.findIndex(({ sql }) => sql.includes('INSERT INTO dbo.Products'));
  assert.ok(treeLockIndex >= 0);
  assert.ok(brandLockIndex > treeLockIndex);
  assert.ok(categoryValidationIndex > brandLockIndex);
  assert.ok(insertIndex > categoryValidationIndex);
  assert.equal(statements[brandLockIndex].params.brandId, validProduct.brandId);
});

test('product creation refuses inactive brands before catalog validation or writes', async () => {
  const statements = [];
  const transaction = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes('SELECT BrandId, IsActive')) return [{ BrandId: 3, IsActive: false }];
      return [];
    },
  };

  const result = await Product.createManaged(validProduct, transaction);

  assert.deepEqual(result, { invalidCatalogReference: true });
  assert.equal(statements.some((sql) => sql.includes('AS valid')), false);
  assert.equal(statements.some((sql) => sql.includes('INSERT INTO dbo.Products')), false);
});

test('product update uses the same brand lock before validating and writing catalog references', async () => {
  const statements = [];
  const transaction = {
    async query(sql, params) {
      statements.push({ sql, params });
      if (sql.includes('SELECT BrandId, IsActive')) return [{ BrandId: 3, IsActive: true }];
      if (sql.includes('SELECT ProductId, CategoryId, BrandId')) {
        return [{
          ProductId: 17,
          CategoryId: 2,
          BrandId: 3,
          IsSerialTracked: false,
          IsActive: true,
          QtyOnHand: 0,
          QtyReserved: 0,
        }];
      }
      if (sql.includes('AS CategoryValid')) return [{ CategoryValid: 1, BrandValid: 1 }];
      return [];
    },
  };

  const result = await Product.updateManaged(17, validProduct, transaction);

  assert.deepEqual(result, { updated: true });
  const brandLockIndex = statements.findIndex(({ sql }) => sql.includes('SELECT BrandId, IsActive'));
  const productLockIndex = statements.findIndex(({ sql }) => sql.includes('WITH (UPDLOCK, HOLDLOCK)') && sql.includes('dbo.Products'));
  const catalogCheckIndex = statements.findIndex(({ sql }) => sql.includes('AS CategoryValid'));
  const updateIndex = statements.findIndex(({ sql }) => sql.includes('UPDATE dbo.Products'));
  assert.ok(brandLockIndex >= 0);
  assert.ok(productLockIndex > brandLockIndex);
  assert.ok(catalogCheckIndex > productLockIndex);
  assert.ok(updateIndex > catalogCheckIndex);
});

test('product search maps unknown sort expressions to a fixed safe order and bounds page size', async (t) => {
  const db = require('../config/db');
  const originalQuery = db.query;
  const originalQueryOne = db.queryOne;
  const calls = [];
  db.queryOne = async (sql, params) => {
    calls.push({ kind: 'one', sql, params });
    return { total: 0 };
  };
  db.query = async (sql, params) => {
    calls.push({ kind: 'many', sql, params });
    return [];
  };
  t.after(() => {
    db.query = originalQuery;
    db.queryOne = originalQueryOne;
  });

  const maliciousSort = 'SalePrice; DROP TABLE Products';
  await Product.search({
    q: '  test ',
    sort: maliciousSort,
    page: 1,
    pageSize: 10000,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].params.q, 'test');
  assert.match(calls[0].sql, /OPTION \(MAXRECURSION 100\)/);
  assert.match(calls[1].sql, /ORDER BY ProductId DESC/);
  assert.equal(calls[1].sql.includes(maliciousSort), false);
  assert.equal(calls[1].params.pageSize, 100);
});

test('compatible component query applies category rules, RAM upgrade guard and groups bounded results', async (t) => {
  const db = require('../config/db');
  const originalQuery = db.query;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    return [
      {
        ComponentCategoryId: 10,
        ComponentCategoryName: 'RAM',
        ProductId: 21,
        ProductName: 'DDR5 RAM',
      },
      {
        ComponentCategoryId: 10,
        ComponentCategoryName: 'RAM',
        ProductId: 22,
        ProductName: 'Another DDR5 RAM',
      },
      {
        ComponentCategoryId: 11,
        ComponentCategoryName: 'SSD',
        ProductId: 31,
        ProductName: 'NVMe SSD',
      },
    ];
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const groups = await Product.compatibleComponentsOf(7, 99);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.productId, 7);
  assert.equal(calls[0].params.limitPerCategory, 12);
  assert.match(calls[0].sql, /MainCategoryPath/);
  assert.match(calls[0].sql, /RuleCategoryTree/);
  assert.match(calls[0].sql, /componentValue\.AttrValue = mainValue\.AttrValue/);
  assert.match(calls[0].sql, /upgradeAttribute\.AttrCode = 'RAM_UPGRADABLE'/);
  assert.match(calls[0].sql, /upgradeValue\.AttrValue = N'Có'/);
  assert.match(calls[0].sql, /product\.IsActive = 1/);
  assert.match(calls[0].sql, /OPTION \(MAXRECURSION 100\)/);
  assert.deepEqual(groups.map(({ categoryName, products }) => [categoryName, products.length]), [
    ['RAM', 2],
    ['SSD', 1],
  ]);
  assert.equal(groups[0].products[1].ProductId, 22);
});

test('compatible component query falls back to a safe default result limit', async (t) => {
  const db = require('../config/db');
  const originalQuery = db.query;
  let params;
  db.query = async (_sql, queryParams) => {
    params = queryParams;
    return [];
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const groups = await Product.compatibleComponentsOf(7, 'invalid');

  assert.deepEqual(groups, []);
  assert.equal(params.limitPerCategory, 4);
});
