// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này.
const db = require('../config/db');

exports.list = () => db.query(
  `SELECT a.AttributeId, a.AttrCode, a.AttrName, a.Unit, a.IsFilterable,
          (SELECT COUNT(*) FROM dbo.ProductAttributeValues pav WHERE pav.AttributeId = a.AttributeId) AS ProductCount,
          (SELECT COUNT(*) FROM dbo.CompatibilityRules cr WHERE cr.AttributeId = a.AttributeId) AS RuleCount
   FROM dbo.Attributes a
   ORDER BY a.AttrName, a.AttrCode`);

exports.findById = (id) => db.queryOne(
  `SELECT AttributeId, AttrCode, AttrName, Unit, IsFilterable
   FROM dbo.Attributes WHERE AttributeId = @id`, { id });

exports.create = async ({ attrCode, attrName, unit, isFilterable }, transaction = null) => {
  const query = transaction ? transaction.query : db.query;
  const rows = await query(
    `INSERT INTO dbo.Attributes (AttrCode, AttrName, Unit, IsFilterable)
     VALUES (@attrCode, @attrName, @unit, @isFilterable);
     SELECT CAST(SCOPE_IDENTITY() AS INT) AS AttributeId`,
    { attrCode, attrName, unit: unit || null, isFilterable: isFilterable ? 1 : 0 });
  return rows[0] ? rows[0].AttributeId : null;
};

exports.update = async (id, { attrCode, attrName, unit, isFilterable }, transaction = null) => {
  const query = transaction ? transaction.query : db.query;
  const rows = await query(
    `UPDATE dbo.Attributes
     SET AttrCode = @attrCode, AttrName = @attrName, Unit = @unit, IsFilterable = @isFilterable
     WHERE AttributeId = @id;
     SELECT @@ROWCOUNT AS affected`,
    { id, attrCode, attrName, unit: unit || null, isFilterable: isFilterable ? 1 : 0 });
  return rows[0] ? rows[0].affected > 0 : false;
};

exports.remove = async (id, transaction = null) => {
  const query = transaction ? transaction.query : db.query;
  const rows = await query(
    `DELETE FROM dbo.Attributes WHERE AttributeId = @id;
     SELECT @@ROWCOUNT AS affected`,
    { id });
  return rows[0] ? rows[0].affected > 0 : false;
};
