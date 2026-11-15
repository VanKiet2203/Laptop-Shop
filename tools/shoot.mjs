// Chụp ảnh giao diện cho báo cáo: node tools/shoot.mjs  (cần app đang chạy - mặc định :3000, đổi bằng BASE_URL; Edge cài sẵn)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = new URL('../report/shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
mkdirSync(OUT, { recursive: true });
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const prof = process.env.TEMP + '/shoot-profile-' + Date.now();
const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + prof,
  '--window-size=1366,860', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 40; i++) {
  try { targets = await (await fetch('http://localhost:9333/json')).json(); if (targets.length) break; } catch {}
  await sleep(500);
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const go = async (path) => { await send('Page.navigate', { url: BASE + path }); await sleep(1800); };
const ev = (e) => send('Runtime.evaluate', { expression: e, awaitPromise: true });
const shot = async (name, full = false) => {
  let clip;
  if (full) {
    const m = await send('Page.getLayoutMetrics');
    const h = Math.min(Math.ceil(m.cssContentSize.height), 1800);
    clip = { x: 0, y: 0, width: 1366, height: h, scale: 1 };
  }
  const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) });
  writeFileSync(OUT + name + '.png', Buffer.from(r.data, 'base64'));
  console.log('saved', name);
};
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 860, deviceScaleFactor: 1, mobile: false });

const login = async (u) => {
  await go('/auth/logout'); await go('/auth/login');
  await ev(`document.querySelector('#login-username').value='${u}';document.querySelector('#login-password').value='123456';document.querySelector('form[action="/auth/login"]').submit()`);
  await sleep(2000);
};

// công khai
await go('/'); await shot('store_home');
await go('/products'); await shot('store_products');
const slug = (await ev(`document.querySelector('a[href^="/products/"]')?.getAttribute('href')`)).result.value;
if (slug) { await go(slug); await shot('store_detail'); }
await go('/auth/login'); await shot('login');

// admin
await login('admin');
await go('/admin'); await shot('admin_dashboard');
await go('/admin/users'); await shot('admin_users');
await go('/admin/roles/2/permissions'); await shot('admin_permissions');
await go('/admin/audit-logs'); await shot('admin_audit');

// nhân viên bán hàng
await login('sales1');
await go('/staff'); await shot('staff_dashboard');
await go('/staff/products'); await shot('staff_products');
await go('/staff/orders'); await shot('staff_orders');
const od = (await ev(`document.querySelector('a[href^="/staff/orders/"]')?.getAttribute('href')`)).result.value;
if (od) { await go(od); await shot('staff_order_detail', true); }
await go('/staff/invoices'); await shot('staff_invoices');
await go('/staff/reports'); await shot('staff_reports', true);

// kho
await login('kho1');
await go('/warehouse'); await shot('wh_dashboard');
await go('/warehouse/suppliers'); await shot('wh_suppliers');
await go('/warehouse/receipts'); await shot('wh_receipts');
await go('/warehouse/stock'); await shot('wh_stock');

// khách
await login('khach1');
await go('/products');
await ev(`fetch('/cart/add',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'productId=1&quantity=1'})`);
await go('/cart'); await shot('cart');
await go('/orders'); await shot('customer_orders');
await go('/account'); await shot('customer_account');

ws.close(); edge.kill();
process.exit(0);
