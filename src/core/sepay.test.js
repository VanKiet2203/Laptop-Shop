const test = require('node:test');
const assert = require('node:assert/strict');
const sepay = require('./sepay');

test('orderNoFrom extracts the order number even when the bank strips the dash or adds text', () => {
  assert.equal(sepay.orderNoFrom('DH2611-00001'), 'DH2611-00001');
  assert.equal(sepay.orderNoFrom('MBVCB.123456.DH261100001.CT tu NGUYEN VAN A'), 'DH2611-00001');
  assert.equal(sepay.orderNoFrom('thanh toan dh2611 00012'), 'DH2611-00012');
  assert.equal(sepay.orderNoFrom('chuyen tien an trua'), null);
  assert.equal(sepay.orderNoFrom(null), null);
});

test('verifyAuth accepts only the configured Apikey header', () => {
  const old = process.env.SEPAY_API_KEY;
  process.env.SEPAY_API_KEY = 'secret-123';
  try {
    assert.equal(sepay.verifyAuth('Apikey secret-123'), true);
    assert.equal(sepay.verifyAuth('apikey secret-123'), true);
    assert.equal(sepay.verifyAuth('Apikey wrong'), false);
    assert.equal(sepay.verifyAuth('Bearer secret-123'), false);
    assert.equal(sepay.verifyAuth(undefined), false);
    delete process.env.SEPAY_API_KEY;
    assert.equal(sepay.verifyAuth('Apikey secret-123'), false);
  } finally {
    if (old === undefined) delete process.env.SEPAY_API_KEY; else process.env.SEPAY_API_KEY = old;
  }
});
