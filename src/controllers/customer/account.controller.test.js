const assert = require('node:assert/strict');
const test = require('node:test');
const Customer = require('../../models/customer.model');
const accountController = require('./account.controller');

const originals = {};
const profile = {
  CustomerId: 7,
  FullName: 'Khách hàng',
  Phone: '0912345678',
  Email: 'customer@example.com',
  LoyaltyPoints: 25,
  TierName: 'Bạc',
  Username: 'customer',
};

test.beforeEach(() => {
  for (const key of ['findByAccountId', 'updateProfile', 'addresses', 'addAddress', 'deleteAddress', 'setDefaultAddress']) {
    originals[key] = Customer[key];
  }
  Customer.findByAccountId = async () => profile;
  Customer.updateProfile = async () => true;
  Customer.addresses = async () => [];
  Customer.addAddress = async () => 12;
  Customer.deleteAddress = async () => true;
  Customer.setDefaultAddress = async () => true;
});

test.afterEach(() => {
  for (const [key, value] of Object.entries(originals)) Customer[key] = value;
  for (const key of Object.keys(originals)) delete originals[key];
});

function request(body = {}) {
  const flashes = [];
  return {
    req: {
      body,
      params: {},
      session: { user: { accountId: 3, customerId: 7, fullName: 'Old name' } },
      flash(...message) { flashes.push(message); },
    },
    res: {
      status(code) { this.statusCode = code; return this; },
      render(view, data) { this.rendered = { view, data }; return this; },
      redirect(location) { this.redirected = location; return this; },
    },
    flashes,
  };
}

test('profile renders membership data and only updates mutable contact fields', async () => {
  const { req, res } = request();
  await accountController.profile(req, res);

  assert.equal(res.rendered.view, 'customer/account');
  assert.equal(res.rendered.data.profile.TierName, 'Bạc');
  assert.deepEqual(res.rendered.data.errors, []);
});

test('profile update validates values, synchronizes email and refreshes the session name', async () => {
  const { req, res, flashes } = request({
    fullName: '  Tên mới ',
    phone: '0987654321',
    email: ' new@example.com ',
  });
  let update;
  Customer.updateProfile = async (accountId, values) => {
    update = { accountId, values };
    return true;
  };

  await accountController.updateProfile(req, res);

  assert.deepEqual(update, {
    accountId: 3,
    values: { fullName: 'Tên mới', phone: '0987654321', email: 'new@example.com' },
  });
  assert.equal(req.session.user.fullName, 'Tên mới');
  assert.equal(res.redirected, '/account');
  assert.deepEqual(flashes, [['success', 'Đã cập nhật hồ sơ.']]);
});

test('invalid profile fields are re-rendered and do not call the update model', async () => {
  const { req, res } = request({ fullName: '', phone: 'invalid', email: 'bad' });
  Customer.updateProfile = async () => {
    assert.fail('invalid profile must not be persisted');
  };

  await accountController.updateProfile(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.rendered.view, 'customer/account');
  assert.equal(res.rendered.data.errors.length, 3);
});

test('a duplicate phone or email race is rendered as a validation error', async () => {
  const { req, res } = request({
    fullName: 'Tên mới',
    phone: '0987654321',
    email: 'new@example.com',
  });
  Customer.updateProfile = async () => {
    throw Object.assign(new Error('duplicate key'), { number: 2601 });
  };

  await accountController.updateProfile(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.rendered.data.errors[0], /đã được sử dụng/);
  assert.equal(req.session.user.fullName, 'Old name');
});

test('cross-account username/email conflicts from the database trigger are shown inline', async () => {
  const { req, res } = request({
    fullName: 'Tên mới',
    phone: '0987654321',
    email: 'sales1@example.com',
  });
  Customer.updateProfile = async () => {
    throw Object.assign(new Error('cross login conflict'), { number: 50003 });
  };

  await accountController.updateProfile(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.rendered.view, 'customer/account');
  assert.equal(req.session.user.fullName, 'Old name');
});

test('first address can be added and invalid address identifiers do not call the model', async () => {
  const addRequest = request({
    receiverName: 'Người nhận',
    receiverPhone: '0912345678',
    addressLine: '1 Đường A',
    province: 'TP. Hồ Chí Minh',
    isDefault: '1',
  });
  let address;
  Customer.addAddress = async (customerId, values) => {
    address = { customerId, values };
    return 12;
  };
  await accountController.addAddress(addRequest.req, addRequest.res);
  assert.equal(address.customerId, 7);
  assert.equal(address.values.isDefault, true);
  assert.equal(addRequest.res.redirected, '/account/addresses');

  const deleteRequest = request();
  deleteRequest.req.params.id = '1.5';
  Customer.deleteAddress = async () => assert.fail('invalid identifier must be rejected');
  await accountController.deleteAddress(deleteRequest.req, deleteRequest.res);
  assert.deepEqual(deleteRequest.flashes, [['danger', 'Địa chỉ không hợp lệ.']]);
});

test('addresses belonging to another customer are reported as unavailable', async () => {
  const { req, res, flashes } = request();
  req.params.id = '44';
  Customer.deleteAddress = async (customerId, addressId) => {
    assert.equal(customerId, 7);
    assert.equal(addressId, 44);
    return false;
  };

  await accountController.deleteAddress(req, res);

  assert.deepEqual(flashes, [['warning', 'Địa chỉ không tồn tại hoặc không thuộc tài khoản của bạn.']]);
  assert.equal(res.redirected, '/account/addresses');
});
