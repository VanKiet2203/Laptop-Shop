// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này.
const db = require('../config/db');
const MAX_CATEGORY_DEPTH = 100;

function categoryError(code) {
  return Object.assign(new Error(code), { code });
}

function hasActiveAncestorChain(categories, categoryId) {
  const byId = new Map(categories.map((category) => [category.CategoryId, category]));
  const visited = new Set();
  let current = byId.get(Number(categoryId));
  if (!current) return false;
  while (current) {
    if (!current.IsActive || visited.has(current.CategoryId)) return false;
    visited.add(current.CategoryId);
    if (current.ParentId == null) return true;
    current = byId.get(current.ParentId);
    if (!current) return false;
  }
  return false;
}

function descendantIds(categories, rootId) {
  const childrenByParent = new Map();
  for (const category of categories) {
    const key = String(category.ParentId);
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(category.CategoryId);
  }

  const found = new Set([Number(rootId)]);
  const pending = [Number(rootId)];
  while (pending.length) {
    const parentId = pending.pop();
    for (const childId of childrenByParent.get(String(parentId)) || []) {
      if (found.has(childId)) continue;
      found.add(childId);
      pending.push(childId);
    }
  }
  return found;
}

function depthOf(categories, categoryId) {
  const byId = new Map(categories.map((category) => [category.CategoryId, category]));
  const visited = new Set();
  let current = byId.get(Number(categoryId));
  let depth = 0;
  while (current) {
    if (visited.has(current.CategoryId)) return null;
    visited.add(current.CategoryId);
    depth += 1;
    if (current.ParentId == null) return depth;
    current = byId.get(current.ParentId);
  }
  return null;
}

function subtreeHeight(categories, rootId) {
  const childrenByParent = new Map();
  for (const category of categories) {
    const key = String(category.ParentId);
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(category.CategoryId);
  }

  let maxHeight = 0;
  const pending = [{ id: Number(rootId), height: 1 }];
  const visited = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (visited.has(current.id)) return null;
    visited.add(current.id);
    maxHeight = Math.max(maxHeight, current.height);
    for (const childId of childrenByParent.get(String(current.id)) || []) {
      pending.push({ id: childId, height: current.height + 1 });
    }
  }
  return maxHeight;
}

exports.MAX_DEPTH = MAX_CATEGORY_DEPTH;
exports.depthOf = depthOf;
exports.subtreeHeight = subtreeHeight;

async function lockCategories(transaction) {
  // Hold the tree stable until commit so no concurrent category mutation can invalidate validation.
  return transaction.query(
    `SELECT CategoryId, ParentId, IsActive
     FROM dbo.Categories WITH (TABLOCKX, HOLDLOCK)`);
}

exports.list = () => db.query(
  `SELECT c.CategoryId, c.ParentId, c.CategoryName, c.Slug, c.SortOrder, c.IsActive,
          parent.CategoryName AS ParentCategoryName,
          (SELECT COUNT(*) FROM dbo.Products p WHERE p.CategoryId = c.CategoryId) AS ProductCount,
          (SELECT COUNT(*) FROM dbo.Categories child WHERE child.ParentId = c.CategoryId) AS ChildCount,
          (SELECT COUNT(*) FROM dbo.CompatibilityRules cr
           WHERE cr.MainCategoryId = c.CategoryId OR cr.ComponentCategoryId = c.CategoryId) AS RuleCount
   FROM dbo.Categories c
   LEFT JOIN dbo.Categories parent ON parent.CategoryId = c.ParentId
   ORDER BY c.SortOrder, c.CategoryName`);

exports.findById = (id) => db.queryOne(
  `SELECT CategoryId, ParentId, CategoryName, Slug, SortOrder, IsActive
   FROM dbo.Categories WHERE CategoryId = @id`, { id });

exports.uniqueSlug = async (base) => {
  const rows = await db.query(
    'SELECT Slug FROM dbo.Categories WHERE Slug = @base OR Slug LIKE @pattern',
    { base, pattern: `${base}-%` });
  const used = new Set(rows.map((row) => row.Slug));
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

exports.hasActiveSubtreeReferences = async (id) => {
  const row = await db.queryOne(
    `;WITH CategorySubtree AS (
       SELECT CategoryId FROM dbo.Categories WHERE CategoryId = @id
       UNION ALL
       SELECT child.CategoryId
       FROM dbo.Categories child
       JOIN CategorySubtree parent ON parent.CategoryId = child.ParentId
     )
     SELECT
       (SELECT COUNT(*)
        FROM dbo.Products p
        JOIN CategorySubtree subtree ON subtree.CategoryId = p.CategoryId
        WHERE p.IsActive = 1) AS ActiveProductCount,
       (SELECT COUNT(*)
        FROM dbo.Categories child
        JOIN CategorySubtree subtree ON subtree.CategoryId = child.CategoryId
        WHERE child.CategoryId <> @id AND child.IsActive = 1) AS ActiveChildCount
     OPTION (MAXRECURSION 100)`,
    { id });
  return row.ActiveProductCount > 0 || row.ActiveChildCount > 0;
};

async function createWithTransaction(transaction, { parentId, categoryName, slug, sortOrder }) {
  const categories = await lockCategories(transaction);
  if (parentId != null) {
    const parentDepth = depthOf(categories, parentId);
    if (!hasActiveAncestorChain(categories, parentId) || parentDepth == null) {
      throw categoryError('CATEGORY_PARENT_INVALID');
    }
    if (parentDepth >= MAX_CATEGORY_DEPTH) throw categoryError('CATEGORY_DEPTH_LIMIT');
  }

  const rows = await transaction.query(
    `DECLARE @created TABLE (CategoryId INT);
     INSERT INTO dbo.Categories (ParentId, CategoryName, Slug, SortOrder)
     OUTPUT INSERTED.CategoryId INTO @created
     VALUES (@parentId, @categoryName, @slug, @sortOrder);
     SELECT CategoryId FROM @created`,
    { parentId, categoryName, slug, sortOrder });
  return rows[0] ? rows[0].CategoryId : null;
};

exports.create = async (data, transaction = null) => (
  transaction
    ? createWithTransaction(transaction, data)
    : db.transaction((tx) => createWithTransaction(tx, data))
);

async function updateWithTransaction(transaction, id, { parentId, categoryName, sortOrder, isActive }) {
  const categories = await lockCategories(transaction);
  const existing = categories.find((category) => category.CategoryId === Number(id));
  if (!existing) throw categoryError('CATEGORY_NOT_FOUND');

  const descendants = descendantIds(categories, id);
  if (parentId != null && descendants.has(Number(parentId))) {
    throw categoryError('CATEGORY_PARENT_INVALID');
  }

  const parentDepth = parentId == null ? 0 : depthOf(categories, parentId);
  const currentSubtreeHeight = subtreeHeight(categories, id);
  if (parentDepth == null || currentSubtreeHeight == null) {
    throw categoryError('CATEGORY_PARENT_INVALID');
  }
  if (parentDepth + currentSubtreeHeight > MAX_CATEGORY_DEPTH) {
    throw categoryError('CATEGORY_DEPTH_LIMIT');
  }

  const sameInactiveParent = !existing.IsActive && Number(existing.ParentId) === Number(parentId);
  if (parentId != null && !hasActiveAncestorChain(categories, parentId) && !sameInactiveParent) {
    throw categoryError('CATEGORY_PARENT_INVALID');
  }
  if (isActive && parentId != null && !hasActiveAncestorChain(categories, parentId)) {
    throw categoryError('CATEGORY_PARENT_INVALID');
  }

  if (existing.IsActive && !isActive) {
    const references = await transaction.query(
      `;WITH CategorySubtree AS (
         SELECT CategoryId FROM dbo.Categories WHERE CategoryId = @id
         UNION ALL
         SELECT child.CategoryId
         FROM dbo.Categories child
         JOIN CategorySubtree parent ON parent.CategoryId = child.ParentId
       )
       SELECT
         (SELECT COUNT(*)
          FROM dbo.Products p
          JOIN CategorySubtree subtree ON subtree.CategoryId = p.CategoryId
          WHERE p.IsActive = 1) AS ActiveProductCount,
         (SELECT COUNT(*)
          FROM dbo.Categories child
          JOIN CategorySubtree subtree ON subtree.CategoryId = child.CategoryId
          WHERE child.CategoryId <> @id AND child.IsActive = 1) AS ActiveChildCount
       OPTION (MAXRECURSION 100)`,
      { id });
    const referencesInSubtree = references[0];
    if (referencesInSubtree && (
      referencesInSubtree.ActiveProductCount > 0
      || referencesInSubtree.ActiveChildCount > 0
    )) {
      throw categoryError('CATEGORY_HAS_ACTIVE_REFERENCES');
    }
  }

  await transaction.query(
    `UPDATE dbo.Categories
     SET ParentId = @parentId, CategoryName = @categoryName, SortOrder = @sortOrder, IsActive = @isActive
     WHERE CategoryId = @id`,
    { id, parentId, categoryName, sortOrder, isActive: isActive ? 1 : 0 });
  return true;
}

exports.update = async (id, data, transaction = null) => (
  transaction
    ? updateWithTransaction(transaction, id, data)
    : db.transaction((tx) => updateWithTransaction(tx, id, data))
);

exports.remove = async (id, transaction = null) => {
  const query = transaction ? transaction.query : db.query;
  const rows = await query(
    `DELETE FROM dbo.Categories WHERE CategoryId = @id;
     SELECT @@ROWCOUNT AS affected`,
    { id });
  return rows[0] ? rows[0].affected > 0 : false;
};
