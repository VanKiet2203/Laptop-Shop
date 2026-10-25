// MODULE 1 - KHO: phiếu nhập kho (lập phiếu nháp -> chốt phiếu -> cộng tồn; có thể huỷ khi còn Nháp)
const Receipt = require('../../models/goodsReceipt.model');
const Supplier = require('../../models/supplier.model');
const audit = require('../../models/audit.model');
const { parseId, isBusinessError } = require('../../core/helpers');

const NOT_FOUND = { layout: 'layouts/warehouse', title: 'Không tìm thấy' };
const MAX_LINES = 50;
const MAX_QTY = 10000;
const MAX_COST = 2000000000;
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Serial nhập dạng nhiều dòng/ngăn cách bằng dấu phẩy -> mảng đã làm sạch (giữ nguyên chữ hoa/thường như người nhập) */
const splitSerials = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map((s) => String(s).trim()).filter(Boolean);

/** Kiểm tra dữ liệu form phiếu nhập; trả về { value, errors, draft } - draft dùng để điền lại form khi lỗi */
async function parseForm(body) {
  const errors = [];
  const supplierId = parseId(body.supplierId);
  const paidAmount = body.paidAmount === undefined || body.paidAmount === '' ? 0 : Number(body.paidAmount);
  const note = text(body.note, 255);
  let raw = [];
  try { raw = JSON.parse(typeof body.itemsJson === 'string' ? body.itemsJson : '[]'); } catch (e) { raw = null; }
  if (!Array.isArray(raw)) { raw = []; errors.push('Dữ liệu các dòng sản phẩm không hợp lệ.'); }

  const draft = { supplierId: supplierId || '', note, paidAmount: body.paidAmount || '', items: raw.slice(0, MAX_LINES).map((i) => ({
    productId: i && i.productId, qty: i && i.qty, unitCost: i && i.unitCost, serials: splitSerials(i && i.serials).join('\n'),
  })) };

  if (!supplierId) errors.push('Vui lòng chọn nhà cung cấp.');
  else {
    const sup = await Supplier.findById(supplierId);
    if (!sup) errors.push('Nhà cung cấp không tồn tại.');
    else if (!sup.IsActive) errors.push('Nhà cung cấp này đã ngừng hợp tác.');
  }
  if (!raw.length) errors.push('Phiếu nhập cần ít nhất một dòng sản phẩm.');
  if (raw.length > MAX_LINES) errors.push(`Mỗi phiếu tối đa ${MAX_LINES} dòng sản phẩm.`);

  const items = [];
  const seen = new Set();
  const ids = raw.slice(0, MAX_LINES).map((i) => parseId(i && i.productId)).filter(Boolean);
  const products = new Map((await Receipt.productsByIds([...new Set(ids)])).map((p) => [p.ProductId, p]));
  raw.slice(0, MAX_LINES).forEach((i, idx) => {
    const label = `Dòng ${idx + 1}`;
    const productId = parseId(i && i.productId);
    const product = productId ? products.get(productId) : null;
    if (!product) { errors.push(`${label}: chưa chọn sản phẩm hợp lệ.`); return; }
    if (!product.IsActive) { errors.push(`${label}: sản phẩm ${product.Sku} đã ngừng bán.`); return; }
    if (seen.has(productId)) { errors.push(`${label}: sản phẩm ${product.Sku} bị lặp, hãy gộp vào một dòng.`); return; }
    seen.add(productId);
    const qty = Number(i.qty);
    const unitCost = Number(i.unitCost);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) { errors.push(`${label} (${product.Sku}): số lượng từ 1 đến ${MAX_QTY}.`); return; }
    if (!Number.isInteger(unitCost) || unitCost < 0 || unitCost > MAX_COST) { errors.push(`${label} (${product.Sku}): đơn giá nhập phải là số nguyên không âm.`); return; }
    let serials = [];
    if (product.IsSerialTracked) {
      serials = splitSerials(i.serials);
      if (serials.length !== qty) { errors.push(`${label} (${product.Sku}): sản phẩm quản lý theo Serial cần đúng ${qty} số Serial, hiện có ${serials.length}.`); return; }
      if (new Set(serials.map((s) => s.toUpperCase())).size !== serials.length) { errors.push(`${label} (${product.Sku}): có Serial bị trùng nhau trong danh sách.`); return; }
      if (serials.some((s) => s.length > 60 || !/^[A-Za-z0-9._\-/]+$/.test(s))) { errors.push(`${label} (${product.Sku}): Serial chỉ gồm chữ, số, . _ - / và tối đa 60 ký tự.`); return; }
    }
    items.push({ productId, qty, unitCost, serials });
  });

  const total = items.reduce((sum, i) => sum + i.qty * i.unitCost, 0);
  if (!Number.isInteger(paidAmount) || paidAmount < 0) errors.push('Số tiền đã thanh toán phải là số nguyên không âm.');
  else if (paidAmount > total && items.length) errors.push('Số tiền đã thanh toán không được lớn hơn tổng tiền phiếu nhập.');
  return { value: { supplierId, note, paidAmount, items }, errors, draft };
}

async function renderForm(res, { status = 200, errors = [], draft = null } = {}) {
  const [suppliers, products] = await Promise.all([Supplier.options(), Receipt.productOptions()]);
  // Dữ liệu nhúng vào trang dạng JSON: thay "<" để không thể đóng thẻ <script> sớm
  const safe = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  return res.status(status).render('warehouse/receipts/new', {
    title: 'Lập phiếu nhập kho', suppliers, errors, productsJson: safe(products), draftJson: safe(draft),
    draft: draft || { supplierId: '', note: '', paidAmount: '', items: [] },
  });
}

// GET /warehouse/receipts
exports.index = async (req, res) => {
  const now = new Date();
  const year = /^\d{4}$/.test(req.query.year || '') ? Number(req.query.year) : now.getFullYear();
  const [result, suppliers, monthly, counts] = await Promise.all([
    Receipt.search(req.query, req.query.page), Supplier.options(true), Receipt.monthlyTotals(year), Receipt.counts()]);
  res.render('warehouse/receipts/index', {
    title: 'Phiếu nhập kho', receipts: result.rows, pg: result.pg, filters: result.filters, postedTotal: result.postedTotal,
    suppliers, monthly, year, counts,
  });
};

// GET /warehouse/receipts/new
exports.showCreate = (req, res) => renderForm(res);

// POST /warehouse/receipts
exports.create = async (req, res) => {
  const { value, errors, draft } = await parseForm(req.body || {});
  if (errors.length) return renderForm(res, { status: 400, errors, draft });
  try {
    const created = await Receipt.create(value, req.session.user.employeeId, (tx, receiptId, receiptNo) =>
      audit.logInTransaction(tx, req, 'CREATE', 'GoodsReceipt', receiptId, `Lập phiếu nhập nháp ${receiptNo}`));
    req.flash('success', `Đã lưu phiếu nhập nháp ${created.receiptNo}. Kiểm tra lại rồi bấm "Chốt phiếu" để cộng tồn kho.`);
    return res.redirect(`/warehouse/receipts/${created.receiptId}`);
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      const dup = /\(([^)]+)\)\.?\s*$/.exec(e.message);
      draft.items = draft.items || [];
      return renderForm(res, { status: 400, errors: [`Serial${dup ? ` "${dup[1]}"` : ''} đã tồn tại trong hệ thống (Serial/IMEI phải duy nhất toàn kho).`], draft });
    }
    throw e;
  }
};

// GET /warehouse/receipts/:id
exports.show = async (req, res) => {
  const id = parseId(req.params.id);
  const receipt = id ? await Receipt.findById(id) : null;
  if (!receipt) return res.status(404).render('errors/404', NOT_FOUND);
  res.render('warehouse/receipts/show', { title: `Phiếu nhập ${receipt.ReceiptNo}`, receipt });
};

// POST /warehouse/receipts/:id/post - lỗi nghiệp vụ 50039-50043 hiện thành thông báo
exports.post = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) { req.flash('danger', 'Mã phiếu nhập không hợp lệ.'); return res.redirect('/warehouse/receipts'); }
  try {
    await Receipt.post(id, req.session.user.accountId);
    req.flash('success', 'Đã chốt phiếu nhập: tồn kho, Serial và giá vốn đã được cập nhật.');
  } catch (e) {
    if (!isBusinessError(e)) throw e;
    req.flash('danger', e.message);
  }
  return res.redirect(`/warehouse/receipts/${id}`);
};

// POST /warehouse/receipts/:id/cancel - chỉ huỷ được phiếu Nháp
exports.cancel = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) { req.flash('danger', 'Mã phiếu nhập không hợp lệ.'); return res.redirect('/warehouse/receipts'); }
  const result = await Receipt.cancelDraft(id, (tx) => audit.logInTransaction(tx, req, 'CANCEL', 'GoodsReceipt', id, 'Huỷ phiếu nhập nháp'));
  if (result === 'ok') req.flash('success', 'Đã huỷ phiếu nhập nháp.');
  else if (result === 'notDraft') req.flash('danger', 'Chỉ huỷ được phiếu ở trạng thái Nháp. Phiếu đã chốt không thể huỷ.');
  else req.flash('danger', 'Phiếu nhập không tồn tại.');
  return res.redirect(`/warehouse/receipts/${id}`);
};

// GET /warehouse/receipts/:id/print - bản in (không layout) để in / lưu PDF từ trình duyệt
exports.print = async (req, res) => {
  const id = parseId(req.params.id);
  const receipt = id ? await Receipt.findById(id) : null;
  if (!receipt) return res.status(404).render('errors/404', NOT_FOUND);
  res.render('warehouse/receipts/print', { layout: false, title: `Phiếu nhập ${receipt.ReceiptNo}`, receipt });
};
