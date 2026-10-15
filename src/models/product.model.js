// MODULE 2 - Model Sản phẩm (phần công khai cho cửa hàng + phần quản lý của nhân viên)
const db = require('../config/db');

/** Sản phẩm nổi bật cho trang chủ (mới nhất, đang bán) */
exports.featured = (limit = 8) => db.query(
  `SELECT TOP (@limit) ProductId, Sku, ProductName, Slug, SalePrice, BrandName, CategoryName, QtyAvailable, PrimaryImage
   FROM dbo.vw_ProductCatalog WHERE IsActive = 1 ORDER BY ProductId DESC`, { limit });

exports.rootCategories = () => db.query(
  'SELECT CategoryId, CategoryName, Slug FROM dbo.Categories WHERE ParentId IS NULL AND IsActive = 1 ORDER BY SortOrder');

exports.allBrands = () => db.query('SELECT BrandId, BrandName FROM dbo.Brands WHERE IsActive = 1 ORDER BY BrandName');

exports.categoryBySlug = (slug) => db.queryOne(
  'SELECT CategoryId, CategoryName, Slug, ParentId FROM dbo.Categories WHERE Slug = @slug AND IsActive = 1', { slug });

/**
 * Tìm kiếm/lọc/phân trang sản phẩm cho cửa hàng.
 * sort KHÔNG được đưa thẳng vào SQL - chỉ ánh xạ qua danh sách cột cho phép (ORDER BY
 * không parameterize được trong T-SQL), tránh SQL injection từ query string.
 */
const SORT_COLUMNS = {
  price_asc: 'SalePrice ASC',
  price_desc: 'SalePrice DESC',
  name: 'ProductName ASC',
  newest: 'ProductId DESC',
};

exports.search = async ({ q, minPrice, maxPrice, categoryId, brandId, sort, page = 1, pageSize = 12 } = {}) => {
  const pageNumber = Number.isSafeInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const safePageSize = Number.isSafeInteger(Number(pageSize))
    ? Math.min(100, Math.max(1, Number(pageSize)))
    : 12;
  const orderBy = SORT_COLUMNS[sort] || SORT_COLUMNS.newest;
  const where = `WHERE IsActive = 1
    AND (@q IS NULL OR ProductName LIKE '%' + @q + '%' OR Sku LIKE '%' + @q + '%')
    AND (@minPrice IS NULL OR SalePrice >= @minPrice)
    AND (@maxPrice IS NULL OR SalePrice <= @maxPrice)
    AND (@categoryId IS NULL OR CategoryId IN (SELECT CategoryId FROM CategoryTree))
    AND (@brandId IS NULL OR BrandId = @brandId)`;
  const categoryTree = `;WITH CategoryAncestors AS (
      SELECT CategoryId AS SelectedCategoryId, CategoryId, ParentId, IsActive
      FROM dbo.Categories
      WHERE CategoryId = @categoryId
      UNION ALL
      SELECT ancestors.SelectedCategoryId, parent.CategoryId, parent.ParentId, parent.IsActive
      FROM CategoryAncestors ancestors
      JOIN dbo.Categories parent ON parent.CategoryId = ancestors.ParentId
    ),
    CategoryTree AS (
      SELECT category.CategoryId
      FROM dbo.Categories category
      WHERE category.CategoryId = @categoryId
        AND category.IsActive = 1
        AND NOT EXISTS (SELECT 1 FROM CategoryAncestors WHERE IsActive = 0)
      UNION ALL
      SELECT child.CategoryId
      FROM dbo.Categories child
      JOIN CategoryTree parent ON parent.CategoryId = child.ParentId
      WHERE child.IsActive = 1
    )`;
  const params = {
    q: q ? String(q).trim() : null,
    minPrice: minPrice == null || minPrice === '' ? null : Number(minPrice),
    maxPrice: maxPrice == null || maxPrice === '' ? null : Number(maxPrice),
    categoryId: categoryId == null || categoryId === '' ? null : Number(categoryId),
    brandId: brandId == null || brandId === '' ? null : Number(brandId),
  };
  const totalRow = await db.queryOne(
    `${categoryTree}
     SELECT COUNT(*) AS total FROM dbo.vw_ProductCatalog ${where}
     OPTION (MAXRECURSION 100)`,
    params);
  const total = totalRow ? totalRow.total : 0;
  const pages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(pageNumber, pages);
  const offset = (currentPage - 1) * safePageSize;
  const rows = await db.query(
    `${categoryTree}
     SELECT ProductId, Sku, ProductName, Slug, SalePrice, BrandName, CategoryName, QtyAvailable, PrimaryImage
     FROM dbo.vw_ProductCatalog ${where}
     ORDER BY ${orderBy}
     OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
     OPTION (MAXRECURSION 100)`,
    { ...params, offset, pageSize: safePageSize });
  return { rows, total, page: currentPage, pageSize: safePageSize };
};

exports.findBySlug = (slug) => db.queryOne(
  `SELECT p.ProductId, p.Sku, p.ProductName, p.Slug, p.ShortDesc, p.SalePrice,
          p.WarrantyMonths, p.IsSerialTracked, p.CategoryName, c.Slug AS CategorySlug,
          p.BrandName, p.QtyAvailable
   FROM dbo.vw_ProductCatalog p
   JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
   WHERE p.Slug = @slug AND p.IsActive = 1`,
  { slug });

exports.attributesOf = (productId) => db.query(
  `SELECT a.AttrName, a.Unit, pav.AttrValue
   FROM dbo.ProductAttributeValues pav JOIN dbo.Attributes a ON a.AttributeId = pav.AttributeId
   WHERE pav.ProductId = @productId ORDER BY a.AttributeId`, { productId });

exports.imagesOf = (productId) => db.query(
  'SELECT ImageUrl, IsPrimary FROM dbo.ProductImages WHERE ProductId = @productId ORDER BY IsPrimary DESC, SortOrder', { productId });

exports.compatibleComponentsOf = async (productId, limitPerCategory = 4) => {
  const safeLimit = Number.isSafeInteger(Number(limitPerCategory))
    ? Math.min(12, Math.max(1, Number(limitPerCategory)))
    : 4;
  const rows = await db.query(
    `;WITH MainCategoryPath AS (
       SELECT c.CategoryId, c.ParentId, c.IsActive
       FROM dbo.Products p
       JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
       WHERE p.ProductId = @productId AND p.IsActive = 1
       UNION ALL
       SELECT parent.CategoryId, parent.ParentId, parent.IsActive
       FROM MainCategoryPath path
       JOIN dbo.Categories parent ON parent.CategoryId = path.ParentId
     ),
     ApplicableRules AS (
       SELECT compatRule.RuleId, compatRule.ComponentCategoryId, compatRule.AttributeId,
              componentRoot.CategoryName AS ComponentCategoryName,
              attribute.AttrCode
       FROM MainCategoryPath path
       JOIN dbo.CompatibilityRules compatRule ON compatRule.MainCategoryId = path.CategoryId
       JOIN dbo.Categories componentRoot ON componentRoot.CategoryId = compatRule.ComponentCategoryId
       JOIN dbo.Attributes attribute ON attribute.AttributeId = compatRule.AttributeId
       WHERE componentRoot.IsActive = 1
         AND NOT EXISTS (SELECT 1 FROM MainCategoryPath WHERE IsActive = 0)
     ),
     RuleCategoryTree AS (
       SELECT compatRule.RuleId, compatRule.ComponentCategoryId, compatRule.ComponentCategoryId AS CategoryId
       FROM ApplicableRules compatRule
       UNION ALL
       SELECT tree.RuleId, tree.ComponentCategoryId, child.CategoryId
       FROM RuleCategoryTree tree
       JOIN dbo.Categories child ON child.ParentId = tree.CategoryId AND child.IsActive = 1
     ),
     CompatibleProducts AS (
       SELECT DISTINCT compatRule.ComponentCategoryId, compatRule.ComponentCategoryName,
              product.ProductId, product.Sku, product.ProductName, product.Slug,
              product.SalePrice, product.BrandName, product.QtyAvailable, product.PrimaryImage
       FROM ApplicableRules compatRule
       JOIN RuleCategoryTree tree ON tree.RuleId = compatRule.RuleId
       JOIN dbo.vw_ProductCatalog product ON product.CategoryId = tree.CategoryId
       WHERE product.IsActive = 1
         AND product.ProductId <> @productId
         AND (
           NOT EXISTS (
             SELECT 1
             FROM ApplicableRules ramRule
             WHERE ramRule.ComponentCategoryId = compatRule.ComponentCategoryId
               AND ramRule.AttrCode = 'RAM_TYPE'
           )
           OR EXISTS (
             SELECT 1
             FROM dbo.ProductAttributeValues upgradeValue
             JOIN dbo.Attributes upgradeAttribute ON upgradeAttribute.AttributeId = upgradeValue.AttributeId
             WHERE upgradeValue.ProductId = @productId
               AND upgradeAttribute.AttrCode = 'RAM_UPGRADABLE'
               AND upgradeValue.AttrValue = N'Có'
           )
         )
         AND NOT EXISTS (
           SELECT 1
           FROM ApplicableRules requiredRule
           WHERE requiredRule.ComponentCategoryId = compatRule.ComponentCategoryId
             AND NOT EXISTS (
               SELECT 1
               FROM dbo.ProductAttributeValues mainValue
               JOIN dbo.ProductAttributeValues componentValue
                 ON componentValue.AttributeId = mainValue.AttributeId
                AND componentValue.AttrValue = mainValue.AttrValue
               WHERE mainValue.ProductId = @productId
                 AND componentValue.ProductId = product.ProductId
                 AND mainValue.AttributeId = requiredRule.AttributeId
             )
         )
     ),
     RankedProducts AS (
       SELECT compatible.*,
              ROW_NUMBER() OVER (
                PARTITION BY compatible.ComponentCategoryId
                ORDER BY CASE WHEN compatible.QtyAvailable > 0 THEN 0 ELSE 1 END,
                         compatible.QtyAvailable DESC, compatible.SalePrice ASC,
                         compatible.ProductId DESC
              ) AS RecommendationRank
       FROM CompatibleProducts compatible
     )
     SELECT ComponentCategoryId, ComponentCategoryName, ProductId, Sku, ProductName,
            Slug, SalePrice, BrandName, QtyAvailable, PrimaryImage
     FROM RankedProducts
     WHERE RecommendationRank <= @limitPerCategory
     ORDER BY ComponentCategoryName, RecommendationRank
     OPTION (MAXRECURSION 100)`,
    { productId, limitPerCategory: safeLimit });

  const groups = new Map();
  for (const row of rows) {
    let group = groups.get(row.ComponentCategoryId);
    if (!group) {
      group = {
        categoryId: row.ComponentCategoryId,
        categoryName: row.ComponentCategoryName,
        products: [],
      };
      groups.set(row.ComponentCategoryId, group);
    }
    group.products.push(row);
  }
  return [...groups.values()];
};

const STAFF_SORT_COLUMNS = {
  newest: 'ProductId DESC',
  oldest: 'ProductId ASC',
  name: 'ProductName ASC',
  price_asc: 'SalePrice ASC, ProductId DESC',
  price_desc: 'SalePrice DESC, ProductId DESC',
  stock_asc: 'QtyAvailable ASC, ProductId DESC',
  stock_desc: 'QtyAvailable DESC, ProductId DESC',
};

exports.staffSearch = async ({ q, categoryId, brandId, status, sort, page = 1, pageSize = 20 } = {}) => {
  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 20));
  const where = `WHERE (@q IS NULL OR Sku LIKE '%' + @q + '%' OR ProductName LIKE '%' + @q + '%')
    AND (@categoryId IS NULL OR CategoryId = @categoryId)
    AND (@brandId IS NULL OR BrandId = @brandId)
    AND (@status = 'all' OR (@status = 'active' AND IsActive = 1) OR (@status = 'inactive' AND IsActive = 0))`;
  const params = {
    q: q ? String(q).trim() : null,
    categoryId: categoryId || null,
    brandId: brandId || null,
    status: ['active', 'inactive'].includes(status) ? status : 'all',
  };
  const count = await db.queryOne(
    `SELECT COUNT(*) AS total FROM dbo.vw_ProductCatalog ${where}`,
    params);
  const total = count ? count.total : 0;
  const pages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(pageNumber, pages);
  const offset = (currentPage - 1) * safePageSize;
  const orderBy = STAFF_SORT_COLUMNS[sort] || STAFF_SORT_COLUMNS.newest;
  const rows = await db.query(
    `SELECT ProductId, Sku, ProductName, Slug, SalePrice, IsActive,
            CategoryId, CategoryName, BrandId, BrandName,
            QtyOnHand, QtyReserved, QtyAvailable, ReorderLevel, PrimaryImage
     FROM dbo.vw_ProductCatalog ${where}
     ORDER BY ${orderBy}
     OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    { ...params, offset, pageSize: safePageSize });
  return { rows, total, page: currentPage, pageSize: safePageSize };
};

exports.staffCatalogOptions = async ({ categoryId, brandId } = {}) => {
  const [categories, brands, attributes] = await Promise.all([
    db.query(
      `SELECT c.CategoryId, c.ParentId, c.CategoryName, c.IsActive,
              parent.CategoryName AS ParentCategoryName
       FROM dbo.Categories c
       LEFT JOIN dbo.Categories parent ON parent.CategoryId = c.ParentId
       WHERE c.IsActive = 1 OR c.CategoryId = @categoryId
       ORDER BY parent.SortOrder, parent.CategoryName, c.SortOrder, c.CategoryName`,
      { categoryId: categoryId || null }),
    db.query(
      `SELECT BrandId, BrandName, IsActive
       FROM dbo.Brands
       WHERE IsActive = 1 OR BrandId = @brandId
       ORDER BY BrandName`,
      { brandId: brandId || null }),
    db.query(
      `SELECT AttributeId, AttrCode, AttrName, Unit
       FROM dbo.Attributes
       ORDER BY AttrName, AttrCode`),
  ]);
  return { categories, brands, attributes };
};

exports.staffFindById = (id) => db.queryOne(
  `SELECT p.ProductId, p.Sku, p.ProductName, p.Slug, p.CategoryId, p.BrandId,
          p.ShortDesc, p.Description, p.SalePrice, p.WarrantyMonths,
          p.IsSerialTracked, p.IsActive, p.QtyOnHand, p.QtyReserved,
          c.IsActive AS CategoryIsActive, b.IsActive AS BrandIsActive
   FROM dbo.Products p
   JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
   JOIN dbo.Brands b ON b.BrandId = p.BrandId
   WHERE p.ProductId = @id`,
  { id });

exports.staffAttributesOf = (productId) => db.query(
  `SELECT a.AttributeId, a.AttrCode, a.AttrName, a.Unit, pav.AttrValue
   FROM dbo.Attributes a
   LEFT JOIN dbo.ProductAttributeValues pav
     ON pav.AttributeId = a.AttributeId AND pav.ProductId = @productId
   ORDER BY a.AttrName, a.AttrCode`,
  { productId });

exports.serialTrackingIsLocked = async (id) => {
  const row = await db.queryOne(
    `SELECT CASE WHEN p.QtyOnHand > 0 OR p.QtyReserved > 0
       OR EXISTS (SELECT 1 FROM dbo.ProductSerials s WHERE s.ProductId = p.ProductId)
       OR EXISTS (SELECT 1 FROM dbo.GoodsReceiptDetails d WHERE d.ProductId = p.ProductId)
       OR EXISTS (SELECT 1 FROM dbo.OrderDetails d WHERE d.ProductId = p.ProductId)
       THEN 1 ELSE 0 END AS IsLocked
     FROM dbo.Products p
     WHERE p.ProductId = @id`,
    { id });
  return !row || Boolean(row.IsLocked);
};

exports.uniqueProductSlug = async (base, excludedProductId = null) => {
  const rows = await db.query(
    `SELECT Slug FROM dbo.Products
     WHERE (@excludedProductId IS NULL OR ProductId <> @excludedProductId)
       AND (Slug = @base OR Slug LIKE @pattern)`,
    { base, pattern: `${base}-%`, excludedProductId });
  const used = new Set(rows.map((row) => row.Slug));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

async function saveImages(transaction, productId, imageUrls) {
  await transaction.query('DELETE FROM dbo.ProductImages WHERE ProductId = @productId', { productId });
  for (let index = 0; index < imageUrls.length; index += 1) {
    await transaction.query(
      `INSERT INTO dbo.ProductImages (ProductId, ImageUrl, IsPrimary, SortOrder)
       VALUES (@productId, @imageUrl, @isPrimary, @sortOrder)`,
      {
        productId,
        imageUrl: imageUrls[index],
        isPrimary: index === 0 ? 1 : 0,
        sortOrder: index,
      });
  }
}

async function saveAttributeValues(transaction, productId, attributeValues) {
  await transaction.query(
    'DELETE FROM dbo.ProductAttributeValues WHERE ProductId = @productId',
    { productId });
  for (const item of attributeValues) {
    await transaction.query(
      `INSERT INTO dbo.ProductAttributeValues (ProductId, AttributeId, AttrValue)
       VALUES (@productId, @attributeId, @attrValue)`,
      { productId, attributeId: item.attributeId, attrValue: item.attrValue });
  }
}

const PRODUCT_WRITE_COLUMNS = `Sku, ProductName, Slug, CategoryId, BrandId, ShortDesc,
                               Description, SalePrice, WarrantyMonths, IsSerialTracked`;

async function holdCategoryTree(transaction) {
  await transaction.query(
    `SELECT CategoryId
     FROM dbo.Categories WITH (TABLOCK, HOLDLOCK)`);
}

async function lockBrand(transaction, brandId) {
  const rows = await transaction.query(
    `SELECT BrandId, IsActive
     FROM dbo.Brands WITH (UPDLOCK, HOLDLOCK)
     WHERE BrandId = @brandId`,
    { brandId });
  return rows[0] || null;
}

async function createManagedInTransaction(transaction, data) {
  await holdCategoryTree(transaction);
  const brand = await lockBrand(transaction, data.brandId);
  if (!brand || !brand.IsActive) return { invalidCatalogReference: true };

  const rows = await transaction.query(
    `;WITH CategoryAncestors AS (
       SELECT CategoryId, ParentId, IsActive
       FROM dbo.Categories
       WHERE CategoryId = @categoryId
       UNION ALL
       SELECT parent.CategoryId, parent.ParentId, parent.IsActive
       FROM dbo.Categories parent
       JOIN CategoryAncestors child ON child.ParentId = parent.CategoryId
     )
     SELECT CASE WHEN EXISTS (SELECT 1 FROM CategoryAncestors)
       AND NOT EXISTS (SELECT 1 FROM CategoryAncestors WHERE IsActive = 0)
       AND EXISTS (SELECT 1 FROM CategoryAncestors WHERE ParentId IS NULL)
       AND EXISTS (SELECT 1 FROM dbo.Brands WHERE BrandId = @brandId AND IsActive = 1)
       THEN 1 ELSE 0 END AS valid
     OPTION (MAXRECURSION 100)`,
    { categoryId: data.categoryId, brandId: data.brandId });
  if (!rows[0] || rows[0].valid !== 1) return { invalidCatalogReference: true };

  const inserted = await transaction.query(
    `INSERT INTO dbo.Products (${PRODUCT_WRITE_COLUMNS})
     VALUES (@sku, @productName, @slug, @categoryId, @brandId, @shortDesc,
             @description, @salePrice, @warrantyMonths, @isSerialTracked);
     SELECT CAST(SCOPE_IDENTITY() AS INT) AS ProductId`,
    {
      sku: data.sku,
      productName: data.productName,
      slug: data.slug,
      categoryId: data.categoryId,
      brandId: data.brandId,
      shortDesc: data.shortDesc || null,
      description: data.description || null,
      salePrice: data.salePrice,
      warrantyMonths: data.warrantyMonths,
      isSerialTracked: data.isSerialTracked ? 1 : 0,
    });
  const productId = inserted[0] && inserted[0].ProductId;
  if (!productId) throw new Error('Không nhận được mã sản phẩm vừa tạo.');

  await saveImages(transaction, productId, data.imageUrls);
  await saveAttributeValues(transaction, productId, data.attributeValues);
  return { productId };
}

exports.createManaged = (data, transaction = null) => (
  transaction
    ? createManagedInTransaction(transaction, data)
    : db.transaction((tx) => createManagedInTransaction(tx, data))
);

async function updateManagedInTransaction(transaction, id, data) {
  await holdCategoryTree(transaction);
  const brand = await lockBrand(transaction, data.brandId);
  const currentRows = await transaction.query(
    `SELECT ProductId, CategoryId, BrandId, IsSerialTracked, IsActive, QtyOnHand, QtyReserved
     FROM dbo.Products WITH (UPDLOCK, HOLDLOCK)
     WHERE ProductId = @id`,
    { id });
  const current = currentRows[0];
  if (!current) return { notFound: true };

  if (data.isSerialTracked !== Boolean(current.IsSerialTracked)) {
    const references = await transaction.query(
      `SELECT
         (SELECT COUNT(*) FROM dbo.ProductSerials WHERE ProductId = @id) AS SerialCount,
         (SELECT COUNT(*) FROM dbo.GoodsReceiptDetails WHERE ProductId = @id) AS ReceiptCount,
         (SELECT COUNT(*) FROM dbo.OrderDetails WHERE ProductId = @id) AS OrderCount`,
      { id });
    const counts = references[0];
    if (
      current.QtyOnHand > 0
      || current.QtyReserved > 0
      || counts.SerialCount > 0
      || counts.ReceiptCount > 0
      || counts.OrderCount > 0
    ) {
      return { serialTrackingLocked: true };
    }
  }

  const catalogRows = await transaction.query(
    `;WITH CategoryAncestors AS (
       SELECT CategoryId, ParentId, IsActive
       FROM dbo.Categories
       WHERE CategoryId = @categoryId
       UNION ALL
       SELECT parent.CategoryId, parent.ParentId, parent.IsActive
       FROM dbo.Categories parent
       JOIN CategoryAncestors child ON child.ParentId = parent.CategoryId
     )
     SELECT
       CASE WHEN (
         (EXISTS (SELECT 1 FROM CategoryAncestors)
          AND NOT EXISTS (SELECT 1 FROM CategoryAncestors WHERE IsActive = 0)
          AND EXISTS (SELECT 1 FROM CategoryAncestors WHERE ParentId IS NULL))
         OR (@categoryId = @currentCategoryId AND @isActive = 0)
       ) THEN 1 ELSE 0 END AS CategoryValid,
       CASE WHEN @brandIsActive = 1
         OR (@brandId = @currentBrandId AND @isActive = 0)
         THEN 1 ELSE 0 END AS BrandValid
     OPTION (MAXRECURSION 100)`,
    {
      categoryId: data.categoryId,
      brandId: data.brandId,
      brandIsActive: brand && brand.IsActive ? 1 : 0,
      currentCategoryId: current.CategoryId,
      currentBrandId: current.BrandId,
      isActive: data.isActive ? 1 : 0,
    });
  if (!catalogRows[0] || !catalogRows[0].CategoryValid || !catalogRows[0].BrandValid) {
    return { invalidCatalogReference: true };
  }

  await transaction.query(
    `UPDATE dbo.Products
     SET Sku = @sku, ProductName = @productName, Slug = @slug,
         CategoryId = @categoryId, BrandId = @brandId,
         ShortDesc = @shortDesc, Description = @description,
         SalePrice = @salePrice, WarrantyMonths = @warrantyMonths,
         IsSerialTracked = @isSerialTracked, IsActive = @isActive,
         UpdatedAt = SYSDATETIME()
     WHERE ProductId = @id`,
    {
      id,
      sku: data.sku,
      productName: data.productName,
      slug: data.slug,
      categoryId: data.categoryId,
      brandId: data.brandId,
      shortDesc: data.shortDesc || null,
      description: data.description || null,
      salePrice: data.salePrice,
      warrantyMonths: data.warrantyMonths,
      isSerialTracked: data.isSerialTracked ? 1 : 0,
      isActive: data.isActive ? 1 : 0,
    });
  await saveImages(transaction, id, data.imageUrls);
  await saveAttributeValues(transaction, id, data.attributeValues);
  return { updated: true };
}

exports.updateManaged = (id, data, transaction = null) => (
  transaction
    ? updateManagedInTransaction(transaction, id, data)
    : db.transaction((tx) => updateManagedInTransaction(tx, id, data))
);

async function removeManagedInTransaction(transaction, id) {
  const rows = await transaction.query(
    `SELECT ProductId, IsActive, QtyOnHand, QtyReserved
     FROM dbo.Products WITH (UPDLOCK, HOLDLOCK)
     WHERE ProductId = @id`,
    { id });
  const product = rows[0];
  if (!product) return { notFound: true };
  if (!product.IsActive) return { alreadyInactive: true };

  const referenceRows = await transaction.query(
    `SELECT
       (SELECT COUNT(*) FROM dbo.CartItems WHERE ProductId = @id) AS CartCount,
       (SELECT COUNT(*) FROM dbo.OrderDetails WHERE ProductId = @id) AS OrderCount,
       (SELECT COUNT(*) FROM dbo.GoodsReceiptDetails WHERE ProductId = @id) AS ReceiptCount,
       (SELECT COUNT(*) FROM dbo.ProductSerials WHERE ProductId = @id) AS SerialCount`,
    { id });
  const references = referenceRows[0];
  const hasReferences = references.CartCount > 0
    || references.OrderCount > 0
    || references.ReceiptCount > 0
    || references.SerialCount > 0;

  if (hasReferences || product.QtyOnHand > 0 || product.QtyReserved > 0) {
    await transaction.query(
      `UPDATE dbo.Products SET IsActive = 0, UpdatedAt = SYSDATETIME()
       WHERE ProductId = @id`,
      { id });
    return { deactivated: true };
  }

  await transaction.query('DELETE FROM dbo.Products WHERE ProductId = @id', { id });
  return { deleted: true };
}

exports.removeManaged = (id, transaction = null) => (
  transaction
    ? removeManagedInTransaction(transaction, id)
    : db.transaction((tx) => removeManagedInTransaction(tx, id))
);

exports.deactivateManaged = async (id, transaction = null) => {
  const query = transaction ? transaction.query : db.query;
  const rows = await query(
    `UPDATE dbo.Products SET IsActive = 0, UpdatedAt = SYSDATETIME()
     WHERE ProductId = @id;
     SELECT @@ROWCOUNT AS affected`,
    { id });
  return rows[0] ? rows[0].affected > 0 : false;
};
