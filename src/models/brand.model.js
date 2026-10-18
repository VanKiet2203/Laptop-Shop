// MODULE 2 - Model Thương hiệu. ĐÂY LÀ VÍ DỤ CHUẨN (reference) - copy cách viết này cho các model khác.
const db = require('../config/db');

exports.list = ({ q } = {}) => db.query(
  `SELECT b.BrandId, b.BrandName, b.Country, b.IsActive,
          (SELECT COUNT(*) FROM dbo.Products p WHERE p.BrandId = b.BrandId) AS ProductCount
   FROM dbo.Brands b
   WHERE (@q IS NULL OR b.BrandName LIKE '%' + @q + '%')
   ORDER BY b.BrandName`, { q: q || null });

exports.findById = (id) => db.queryOne('SELECT * FROM dbo.Brands WHERE BrandId = @id', { id });

exports.create = async ({ brandName, country }, transaction = null) => {
  const query = transaction ? transaction.query : db.query;
  const rows = await query(
    `INSERT INTO dbo.Brands (BrandName, Country)
     VALUES (@brandName, @country);
     SELECT CAST(SCOPE_IDENTITY() AS INT) AS BrandId`,
    { brandName, country: country || null });
  return rows[0] ? rows[0].BrandId : null;
};

async function updateInTransaction(transaction, id, { brandName, country, isActive }) {
  // Product create/update takes the same lock before validating a brand reference.
  const brands = await transaction.query(
    `SELECT BrandId, IsActive
     FROM dbo.Brands WITH (UPDLOCK, HOLDLOCK)
     WHERE BrandId = @id`,
    { id });
  const brand = brands[0];
  if (!brand) return { notFound: true };

  if (brand.IsActive && !isActive) {
    const products = await transaction.query(
      `SELECT COUNT(*) AS ActiveProductCount
       FROM dbo.Products
       WHERE BrandId = @id AND IsActive = 1`,
      { id });
    if (products[0] && products[0].ActiveProductCount > 0) {
      return { hasActiveProducts: true };
    }
  }

  await transaction.query(
    `UPDATE dbo.Brands
     SET BrandName = @brandName, Country = @country, IsActive = @isActive
     WHERE BrandId = @id`,
    { id, brandName, country: country || null, isActive: isActive ? 1 : 0 });
  return { updated: true };
}

exports.update = (id, data, transaction = null) => (
  transaction
    ? updateInTransaction(transaction, id, data)
    : db.transaction((tx) => updateInTransaction(tx, id, data))
);

exports.remove = async (id, transaction = null) => {
  const query = transaction ? transaction.query : db.query;
  const rows = await query(
    `DELETE FROM dbo.Brands WHERE BrandId = @id;
     SELECT @@ROWCOUNT AS affected`,
    { id });
  return rows[0] ? rows[0].affected > 0 : false;
};
