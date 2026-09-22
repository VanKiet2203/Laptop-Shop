// MODULE 2 - Model Thương hiệu. ĐÂY LÀ VÍ DỤ CHUẨN (reference) - copy cách viết này cho các model khác.
const db = require('../config/db');

exports.list = ({ q } = {}) => db.query(
  `SELECT b.BrandId, b.BrandName, b.Country, b.IsActive,
          (SELECT COUNT(*) FROM dbo.Products p WHERE p.BrandId = b.BrandId) AS ProductCount
   FROM dbo.Brands b
   WHERE (@q IS NULL OR b.BrandName LIKE '%' + @q + '%')
   ORDER BY b.BrandName`, { q: q || null });

exports.findById = (id) => db.queryOne('SELECT * FROM dbo.Brands WHERE BrandId = @id', { id });

exports.create = ({ brandName, country }) => db.query(
  'INSERT INTO dbo.Brands (BrandName, Country) VALUES (@brandName, @country)', { brandName, country: country || null });

exports.update = (id, { brandName, country, isActive }) => db.query(
  'UPDATE dbo.Brands SET BrandName = @brandName, Country = @country, IsActive = @isActive WHERE BrandId = @id',
  { id, brandName, country: country || null, isActive: isActive ? 1 : 0 });

exports.remove = (id) => db.query('DELETE FROM dbo.Brands WHERE BrandId = @id', { id });
