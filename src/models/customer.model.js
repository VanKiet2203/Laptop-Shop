// Thành viên 3 - Khách mua hàng
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: Customers, CustomerAddresses, MembershipTiers, Accounts
const db = require('../config/db');

exports.findAccountByUsernameOrEmail = (value) => db.queryOne(
  'SELECT AccountId FROM dbo.Accounts WHERE Username = @value OR Email = @value', { value });

exports.findCustomerByPhone = (phone) => db.queryOne(
  'SELECT CustomerId FROM dbo.Customers WHERE Phone = @phone', { phone });

/**
 * Transaction: tạo Accounts (role CUSTOMER) + Customers + Carts.
 * passwordHash phải được bcrypt.hash() sẵn ở controller (model chỉ chứa SQL, không chứa logic mã hoá).
 */
exports.createWithAccount = ({ username, email, passwordHash, fullName, phone }) => db.transaction(async (t) => {
  const roleRows = await t.query('SELECT RoleId FROM dbo.Roles WHERE RoleCode = @rc', { rc: 'CUSTOMER' });
  const roleId = roleRows[0].RoleId;

  // Bảng Accounts có trigger (trg_Accounts_NoCrossLogin) nên không dùng được
  // "OUTPUT INSERTED.x" trực tiếp (SQL Server cấm khi bảng đích có trigger đang bật) -
  // phải OUTPUT ... INTO một bảng biến rồi SELECT lại từ đó.
  const accRows = await t.query(
    `DECLARE @ids TABLE (AccountId INT);
     INSERT INTO dbo.Accounts (Username, Email, PasswordHash, RoleId)
     OUTPUT INSERTED.AccountId INTO @ids
     VALUES (@username, @email, @passwordHash, @roleId);
     SELECT AccountId FROM @ids;`,
    { username, email: email || null, passwordHash, roleId });
  const accountId = accRows[0].AccountId;

  const custRows = await t.query(
    `INSERT INTO dbo.Customers (AccountId, FullName, Phone, Email) OUTPUT INSERTED.CustomerId
     VALUES (@accountId, @fullName, @phone, @email)`,
    { accountId, fullName, phone, email: email || null });
  const customerId = custRows[0].CustomerId;

  await t.query('INSERT INTO dbo.Carts (CustomerId) VALUES (@customerId)', { customerId });

  return { accountId, customerId, roleId };
});

exports.findByAccountId = (accountId) => db.queryOne('SELECT * FROM dbo.Customers WHERE AccountId = @accountId', { accountId });
exports.addresses = (customerId) => db.query('SELECT * FROM dbo.CustomerAddresses WHERE CustomerId = @customerId ORDER BY IsDefault DESC, AddressId', { customerId });

// TODO (M3): update(), addAddress(), deleteAddress(), setDefault()
