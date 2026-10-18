const assert = require('node:assert/strict');
const test = require('node:test');
const Category = require('./category.model');

function categoryRows(depth) {
  return Array.from({ length: depth }, (_, index) => ({
    CategoryId: index + 1,
    ParentId: index === 0 ? null : index,
    IsActive: true,
  }));
}

function transactionFor(categories) {
  const statements = [];
  return {
    statements,
    async query(sql) {
      statements.push(sql);
      if (sql.includes('FROM dbo.Categories WITH (TABLOCKX, HOLDLOCK)')) return categories;
      if (sql.includes('SELECT CategoryId, ParentId, IsActive')) return categories;
      return [{ CategoryId: categories.length + 1 }];
    },
  };
}

test('the maximum category depth is 100 levels', () => {
  assert.equal(Category.MAX_DEPTH, 100);
});

test('creating a child at depth 100 succeeds but depth 101 is rejected', async () => {
  const depth99 = categoryRows(99);
  const validTransaction = transactionFor(depth99);
  const categoryId = await Category.create({
    parentId: 99,
    categoryName: 'Level 100',
    slug: 'level-100',
    sortOrder: 0,
  }, validTransaction);
  assert.equal(categoryId, 100);
  assert.ok(validTransaction.statements.some((statement) => statement.includes('INSERT INTO dbo.Categories')));

  const depth100 = categoryRows(100);
  const invalidTransaction = transactionFor(depth100);
  await assert.rejects(
    Category.create({
      parentId: 100,
      categoryName: 'Level 101',
      slug: 'level-101',
      sortOrder: 0,
    }, invalidTransaction),
    (error) => error.code === 'CATEGORY_DEPTH_LIMIT',
  );
  assert.equal(invalidTransaction.statements.some((statement) => statement.includes('INSERT INTO dbo.Categories')), false);
});

test('moving a subtree permits exactly 100 total levels and rejects a deeper placement', async () => {
  const rows = categoryRows(99);
  rows.push(
    { CategoryId: 200, ParentId: null, IsActive: true },
    { CategoryId: 201, ParentId: 200, IsActive: true },
  );

  const allowed = transactionFor(rows);
  assert.equal(await Category.update(200, {
    parentId: 98,
    categoryName: 'Moved root',
    sortOrder: 0,
    isActive: true,
  }, allowed), true);
  assert.ok(allowed.statements.some((statement) => statement.includes('UPDATE dbo.Categories')));

  const rejected = transactionFor(rows);
  await assert.rejects(
    Category.update(200, {
      parentId: 99,
      categoryName: 'Moved root',
      sortOrder: 0,
      isActive: true,
    }, rejected),
    (error) => error.code === 'CATEGORY_DEPTH_LIMIT',
  );
  assert.equal(rejected.statements.some((statement) => statement.includes('UPDATE dbo.Categories')), false);
});

test('depth helpers report missing, cyclic and deep descendants safely', () => {
  assert.equal(Category.depthOf(categoryRows(100), 100), 100);
  assert.equal(Category.depthOf(categoryRows(100), 101), null);
  assert.equal(Category.subtreeHeight([
    { CategoryId: 1, ParentId: 2 },
    { CategoryId: 2, ParentId: 1 },
  ], 1), null);
});
