// Thành viên 3 - Khách mua hàng
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: Customers, CustomerAddresses, MembershipTiers, Accounts
const db = require('../config/db');

// Tách riêng theo từng cột (không OR Username/Email trong cùng 1 điều kiện) để tránh nhập nhằng
// khi Username của người này trùng Email của người khác - dùng cho kiểm tra trùng khi đăng ký.
exports.findAccountByUsername = (username) => db.queryOne(
  'SELECT AccountId FROM dbo.Accounts WHERE Username = @username', { username });

exports.findAccountByEmail = (email) => db.queryOne(
  'SELECT AccountId FROM dbo.Accounts WHERE Email = @email', { email });

exports.findCustomerByPhone = (phone) => db.queryOne(
  'SELECT CustomerId FROM dbo.Customers WHERE Phone = @phone', { phone });

/**
 * Transaction: tạo Accounts (role CUSTOMER) + Customers + Carts.
 * passwordHash phải được bcrypt.hash() sẵn ở controller (model chỉ chứa SQL, không chứa logic mã hoá).
 */
async function createWithAccountInTransaction(t, { username, email, passwordHash, fullName, phone }) {
  const roleRows = await t.query('SELECT RoleId FROM dbo.Roles WHERE RoleCode = @rc', { rc: 'CUSTOMER' });
  if (!roleRows[0]) {
    throw Object.assign(new Error('Không tìm thấy vai trò khách hàng.'), {
      code: 'CUSTOMER_ROLE_NOT_FOUND',
    });
  }
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
  if (!accRows[0]) throw new Error('Không nhận được mã tài khoản vừa tạo.');
  const accountId = accRows[0].AccountId;

  const custRows = await t.query(
    `INSERT INTO dbo.Customers (AccountId, FullName, Phone, Email) OUTPUT INSERTED.CustomerId
     VALUES (@accountId, @fullName, @phone, @email)`,
    { accountId, fullName, phone, email: email || null });
  if (!custRows[0]) throw new Error('Không nhận được mã khách hàng vừa tạo.');
  const customerId = custRows[0].CustomerId;

  await t.query('INSERT INTO dbo.Carts (CustomerId) VALUES (@customerId)', { customerId });

  return { accountId, customerId, roleId };
}

exports.createWithAccount = (data, transaction = null) => (
  transaction
    ? createWithAccountInTransaction(transaction, data)
    : db.transaction((t) => createWithAccountInTransaction(t, data))
);

exports.findByAccountId = (accountId) => db.queryOne(
  `SELECT c.CustomerId, c.FullName, c.Phone, c.Email, c.LoyaltyPoints,
          c.CompanyName, c.TaxCode, t.TierName, t.DiscountPercent, a.Username, a.Email AS AccountEmail
   FROM dbo.Customers c
   JOIN dbo.Accounts a ON a.AccountId = c.AccountId
   JOIN dbo.MembershipTiers t ON t.TierId = c.TierId
   WHERE c.AccountId = @accountId`,
  { accountId });

exports.updateProfile = (accountId, { fullName, phone, email }) => db.transaction(async (transaction) => {
  const customers = await transaction.query(
    `SELECT CustomerId FROM dbo.Customers WITH (UPDLOCK, HOLDLOCK)
     WHERE AccountId = @accountId`,
    { accountId });
  if (!customers[0]) return false;

  await transaction.query(
    `UPDATE dbo.Customers
     SET FullName = @fullName, Phone = @phone, Email = @email
     WHERE CustomerId = @customerId`,
    { customerId: customers[0].CustomerId, fullName, phone, email });
  await transaction.query(
    'UPDATE dbo.Accounts SET Email = @email WHERE AccountId = @accountId',
    { accountId, email });
  return true;
});

exports.addresses = (customerId) => db.query(
  `SELECT AddressId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault
   FROM dbo.CustomerAddresses
   WHERE CustomerId = @customerId
   ORDER BY IsDefault DESC, AddressId`,
  { customerId });

const MAX_ADDRESSES_PER_CUSTOMER = 10;

exports.addAddress = (customerId, address) => db.transaction(async (transaction) => {
  const customers = await transaction.query(
    'SELECT CustomerId FROM dbo.Customers WITH (UPDLOCK, HOLDLOCK) WHERE CustomerId = @customerId',
    { customerId });
  if (!customers[0]) return false;

  const addresses = await transaction.query(
    `SELECT AddressId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province
     FROM dbo.CustomerAddresses WITH (UPDLOCK, HOLDLOCK)
     WHERE CustomerId = @customerId`,
    { customerId });
  // So khớp trong transaction (đã khoá) để tránh race khi gửi form 2 lần; không phân biệt hoa/thường.
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const fields = [
    ['ReceiverName', 'receiverName'], ['ReceiverPhone', 'receiverPhone'], ['AddressLine', 'addressLine'],
    ['Ward', 'ward'], ['District', 'district'], ['Province', 'province'],
  ];
  if (addresses.some((row) => fields.every(([col, key]) => same(row[col], address[key])))) {
    throw Object.assign(new Error('Địa chỉ này đã tồn tại trong sổ địa chỉ của bạn.'), { code: 'ADDRESS_DUPLICATE' });
  }
  if (addresses.length >= MAX_ADDRESSES_PER_CUSTOMER) {
    throw Object.assign(new Error('Mỗi khách hàng chỉ được lưu tối đa 10 địa chỉ.'), { code: 'ADDRESS_LIMIT_REACHED' });
  }
  const isDefault = address.isDefault || addresses.length === 0;
  if (isDefault) {
    await transaction.query(
      'UPDATE dbo.CustomerAddresses SET IsDefault = 0 WHERE CustomerId = @customerId AND IsDefault = 1',
      { customerId });
  }

  const rows = await transaction.query(
    `INSERT INTO dbo.CustomerAddresses
       (CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault)
     OUTPUT INSERTED.AddressId
     VALUES (@customerId, @receiverName, @receiverPhone, @addressLine, @ward, @district, @province, @isDefault)`,
    { customerId, ...address, isDefault: isDefault ? 1 : 0 });
  return rows[0] ? rows[0].AddressId : false;
});

exports.deleteAddress = (customerId, addressId) => db.transaction(async (transaction) => {
  await transaction.query(
    'SELECT CustomerId FROM dbo.Customers WITH (UPDLOCK, HOLDLOCK) WHERE CustomerId = @customerId',
    { customerId });
  const addresses = await transaction.query(
    `SELECT IsDefault FROM dbo.CustomerAddresses WITH (UPDLOCK, HOLDLOCK)
     WHERE AddressId = @addressId AND CustomerId = @customerId`,
    { customerId, addressId });
  if (!addresses[0]) return false;

  await transaction.query(
    'DELETE FROM dbo.CustomerAddresses WHERE AddressId = @addressId AND CustomerId = @customerId',
    { customerId, addressId });
  if (addresses[0].IsDefault) {
    await transaction.query(
      `UPDATE dbo.CustomerAddresses
       SET IsDefault = 1
       WHERE CustomerId = @customerId AND AddressId = (
         SELECT TOP (1) AddressId FROM dbo.CustomerAddresses
         WHERE CustomerId = @customerId ORDER BY AddressId
       )`,
      { customerId });
  }
  return true;
});

exports.setDefaultAddress = (customerId, addressId) => db.transaction(async (transaction) => {
  await transaction.query(
    'SELECT CustomerId FROM dbo.Customers WITH (UPDLOCK, HOLDLOCK) WHERE CustomerId = @customerId',
    { customerId });
  const addresses = await transaction.query(
    `SELECT AddressId FROM dbo.CustomerAddresses WITH (UPDLOCK, HOLDLOCK)
     WHERE AddressId = @addressId AND CustomerId = @customerId`,
    { customerId, addressId });
  if (!addresses[0]) return false;

  await transaction.query(
    'UPDATE dbo.CustomerAddresses SET IsDefault = 0 WHERE CustomerId = @customerId AND IsDefault = 1',
    { customerId });
  await transaction.query(
    'UPDATE dbo.CustomerAddresses SET IsDefault = 1 WHERE AddressId = @addressId AND CustomerId = @customerId',
    { customerId, addressId });
  return true;
});
