const assert = require('node:assert/strict');
const test = require('node:test');
const geo = require('./geo');

const realFetch = global.fetch;
let calls;
test.beforeEach(() => { calls = 0; geo._reset(); });
test.afterEach(() => { global.fetch = realFetch; });

const api = [
  { name: 'Thành phố Hà Nội', wards: [{ name: 'Phường Ba Đình' }, { name: 'Phường Cửa Nam' }] },
  { name: 'Tỉnh Cao Bằng', wards: [{ name: 'Phường Thục Phán' }] },
];
const okFetch = async () => { calls += 1; return { ok: true, json: async () => api }; };

test('provinces and wards come from the API, names shortened to the stored form, and are cached', async () => {
  global.fetch = okFetch;
  assert.deepEqual(await geo.provinces(), ['TP. Hà Nội', 'Cao Bằng']);
  assert.deepEqual(await geo.wardsOf('TP. Hà Nội'), ['Phường Ba Đình', 'Phường Cửa Nam']);
  assert.equal(calls, 1);
});

test('validate accepts only a ward that belongs to the chosen province', async () => {
  global.fetch = okFetch;
  assert.equal(await geo.validate('TP. Hà Nội', 'Phường Ba Đình'), null);
  assert.match(await geo.validate('TP. Hà Nội', 'Phường Thục Phán'), /không thuộc/);
  assert.match(await geo.validate('TP. Hà Nội', ''), /chọn phường/);
  assert.match(await geo.validate('Nơi lạ', 'x'), /không hợp lệ/);
});

test('when the API is down, the fallback province list is used and any non-empty ward is accepted', async () => {
  const log = console.error; console.error = () => {};
  global.fetch = async () => { throw new Error('offline'); };
  try {
    assert.ok((await geo.provinces()).includes('TP. Hồ Chí Minh'));
    assert.equal(await geo.wardsOf('TP. Hồ Chí Minh'), null);
    assert.equal(await geo.validate('TP. Hồ Chí Minh', 'Phường bất kỳ'), null);
    assert.match(await geo.validate('TP. Hồ Chí Minh', ''), /nhập phường/);
    assert.match(await geo.validate('Nơi lạ', 'x'), /không hợp lệ/);
  } finally { console.error = log; }
});
