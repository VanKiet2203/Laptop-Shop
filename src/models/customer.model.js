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


exports.findById = (customerId) => db.queryOne('SELECT * FROM dbo.Customers WHERE CustomerId = @customerId', { customerId });

exports.update = (customerId, data) => db.query(
  `UPDATE dbo.Customers
   SET FullName = @fullName,
       Phone = @phone,
       Email = @email 
   WHERE CustomerId = @customerId;
   SELECT CAST(CASE WHEN @@ROWCOUNT > 0 THEN 1 ELSE 0 END AS BIT) AS Success;`,
  {
    customerId: customerId,
    fullName: data.FullName,
    phone: data.Phone,
    email: data.Email,
  }
).then((rows) => Boolean(rows[0] && rows[0].Success));

///lấy tất cả địa chỉ của khách hàng theo customerId, sắp xếp theo mặc định ở đầu , AddressId tăng dần
exports.findAddressesByCustomerId = (customerId) => db.query(
  `SELECT * FROM dbo.CustomerAddresses
   WHERE CustomerId = @customerId
   ORDER BY IsDefault DESC, AddressId ASC`,
  { customerId }
);

exports.addAddress = (customerId, address) =>
  db.transaction(async (t) => {
    // Khóa dòng customer để hai request đồng thời không cùng vượt giới hạn.
    await t.query(
      `SELECT CustomerId
       FROM dbo.Customers WITH (UPDLOCK, HOLDLOCK)
       WHERE CustomerId = @customerId`,
      { customerId }
    );

    const countRows = await t.query(
      `SELECT COUNT(*) AS AddressCount
       FROM dbo.CustomerAddresses
       WHERE CustomerId = @customerId`,
      { customerId }
    );

    if (countRows[0].AddressCount >= 10) {
      throw Object.assign(
        new Error('Mỗi khách hàng chỉ được lưu tối đa 10 địa chỉ.'),
        { number: 50030 }
      );
    }

    if (address.isDefault) {
      await t.query(
        `UPDATE dbo.CustomerAddresses
         SET IsDefault = 0
         WHERE CustomerId = @customerId`,
        { customerId }
      );
    }

    await t.query(
      `INSERT INTO dbo.CustomerAddresses
        (CustomerId, ReceiverName, ReceiverPhone, AddressLine,
         Ward, District, Province, IsDefault)
       VALUES
        (@customerId, @receiverName, @receiverPhone, @addressLine,
         @ward, @district, @province, @isDefault)`,
      {
        customerId,
        receiverName: address.receiverName,
        receiverPhone: address.receiverPhone,
        addressLine: address.addressLine,
        ward: address.ward,
        district: address.district,
        province: address.province,
        isDefault: address.isDefault ? 1 : 0
      }
    );

    return true;
  });



// hàm update address nên có kiểm tra xem có phải địa chỉ mặc định hay không, nếu là mặc định thì cần set tất cả các địa chỉ khác của khách hàng này về IsDefault = 0 trước khi update địa chỉ này về IsDefault = 1
exports.updateAddress = (customerId, addressId, address) =>
  db.transaction(async (t) => {
    // Khóa dòng customer để hai request đồng thời không cùng vượt giới hạn.    
    await t.query(
      `SELECT CustomerId
       FROM dbo.Customers WITH (UPDLOCK, HOLDLOCK)
       WHERE CustomerId = @customerId`,
      { customerId }
    );

    const addressRows = await t.query(
      `SELECT AddressId
       FROM dbo.CustomerAddresses
       WHERE CustomerId = @customerId AND AddressId = @addressId`,
      { customerId, addressId }
    );
    if (!addressRows.length) return false;

    if (address.isDefault) {
      await t.query(
        `UPDATE dbo.CustomerAddresses
         SET IsDefault = 0
         WHERE CustomerId = @customerId`,
        { customerId }
      );
    }

    await t.query(
      `UPDATE dbo.CustomerAddresses
       SET ReceiverName = @receiverName,
           ReceiverPhone = @receiverPhone,
           AddressLine = @addressLine,
           Ward = @ward,
           District = @district,
           Province = @province,
           IsDefault = @isDefault
       WHERE CustomerId = @customerId AND AddressId = @addressId`,
      {
        customerId,
        addressId,
        receiverName: address.receiverName,
        receiverPhone: address.receiverPhone,
        addressLine: address.addressLine,
        ward: address.ward,
        district: address.district,
        province: address.province,
        isDefault: address.isDefault ? 1 : 0
      }
    );

    return true;
  });

//delete address
exports.deleteAddress = (customerId, addressId) =>
  db.query(
    `DELETE FROM dbo.CustomerAddresses
     WHERE CustomerId = @customerId AND AddressId = @addressId;
     SELECT CAST(CASE WHEN @@ROWCOUNT > 0 THEN 1 ELSE 0 END AS BIT) AS Success;`,
    { customerId, addressId }
  ).then((rows) => Boolean(rows[0] && rows[0].Success));
//chỉ set default address với địa chỉ đang chọn , các địa chỉ còn lại set là 0
exports.setDefault = (customerId, addressId) =>
  db.transaction(async (t) => {
    const addressRows = await t.query(
      `SELECT AddressId
       FROM dbo.CustomerAddresses
       WHERE CustomerId = @customerId AND AddressId = @addressId`,
      { customerId, addressId }
    );
    if (!addressRows.length) return false;

    await t.query(
      `UPDATE dbo.CustomerAddresses
       SET IsDefault = CASE
           WHEN AddressId = @addressId THEN 1
           ELSE 0
       END
       WHERE CustomerId = @customerId`,
      { customerId, addressId }
    );

    return true;
  });
 

