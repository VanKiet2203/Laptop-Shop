const assert = require('node:assert/strict');
const test = require('node:test');
const sessionSync = require('./sessionSync');

function setup(mutate) {
  const events = [];
  const session = { user: null, save(cb) { events.push('save-start'); setTimeout(() => { events.push('save-done'); cb(null); }, 20); } };
  const req = { session };
  const res = {
    redirect(url) { events.push('redirect:' + url); return this; },
    send(body) { events.push('send:' + body); return this; },
  };
  sessionSync(req, res, () => {});
  if (mutate) mutate(req.session);
  return { req, res, events };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('when the session changed, the response is sent only AFTER the session is saved (login redirect race)', async () => {
  const { res, events } = setup((s) => { s.user = { accountId: 1 }; });
  res.redirect('/admin');
  assert.deepEqual(events, ['save-start']);
  await wait(50);
  assert.deepEqual(events, ['save-start', 'save-done', 'redirect:/admin']);
});

test('res.send / res.json / res.render (via send) are held back the same way', async () => {
  const { res, events } = setup((s) => { s.cart = [1]; });
  res.send('{"ok":true}');
  await wait(50);
  assert.deepEqual(events, ['save-start', 'save-done', 'send:{"ok":true}']);
});

test('an unchanged session adds no save at all (no extra SQL, no latency)', async () => {
  const { res, events } = setup();
  res.redirect('/x');
  res.send('y');
  assert.deepEqual(events, ['redirect:/x', 'send:y']);
});

test('a failed save is logged but the response is still sent', async () => {
  const log = console.error; console.error = () => {};
  try {
    const events = [];
    const req = { session: { a: 1, save(cb) { cb(new Error('db down')); } } };
    const res = { redirect(u) { events.push(u); } };
    sessionSync(req, res, () => {});
    req.session.a = 2;
    res.redirect('/ok');
    assert.deepEqual(events, ['/ok']);
  } finally { console.error = log; }
});

test('requests without a session (e.g. after logout/destroy) pass straight through', () => {
  let called = false;
  sessionSync({}, {}, () => { called = true; });
  assert.equal(called, true);
});
