const assert = require('node:assert/strict');
const test = require('node:test');
const Brand = require('./brand.model');

test('brand deactivation serializes on the brand row before checking active products', async () => {
  const statements = [];
  const transaction = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes('SELECT BrandId, IsActive')) return [{ BrandId: 7, IsActive: true }];
      if (sql.includes('ActiveProductCount')) return [{ ActiveProductCount: 2 }];
      return [];
    },
  };

  const result = await Brand.update(7, {
    brandName: 'Acme',
    country: null,
    isActive: false,
  }, transaction);

  assert.deepEqual(result, { hasActiveProducts: true });
  assert.match(statements[0], /WITH \(UPDLOCK, HOLDLOCK\)/);
  assert.ok(statements[1].includes('WHERE BrandId = @id AND IsActive = 1'));
  assert.equal(statements.some((sql) => sql.includes('UPDATE dbo.Brands')), false);
});

test('brand update is rejected as not found without executing deactivation checks', async () => {
  const statements = [];
  const transaction = {
    async query(sql) {
      statements.push(sql);
      return [];
    },
  };

  const result = await Brand.update(999, {
    brandName: 'Missing',
    country: null,
    isActive: false,
  }, transaction);

  assert.deepEqual(result, { notFound: true });
  assert.equal(statements.length, 1);
  assert.match(statements[0], /UPDLOCK, HOLDLOCK/);
});
