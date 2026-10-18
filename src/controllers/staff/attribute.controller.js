// MODULE 2 - Quản lý thuộc tính kỹ thuật
const Attribute = require('../../models/attribute.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');

function parseId(value) {
  const id = Number(value);
  return String(value).length <= 10
    && /^\d+$/.test(String(value))
    && Number.isSafeInteger(id)
    && id > 0
    && id <= 2147483647
    ? id
    : null;
}

function parseForm(body) {
  const attrCode = String(body.attrCode || '').trim().toUpperCase();
  const attrName = String(body.attrName || '').trim();
  const unit = String(body.unit || '').trim();

  if (!/^[A-Z0-9_]{1,40}$/.test(attrCode)) {
    return { error: 'Mã thuộc tính chỉ gồm chữ in hoa, số và dấu gạch dưới; tối đa 40 ký tự.' };
  }
  if (!attrName) return { error: 'Tên thuộc tính không được để trống.' };
  if (attrName.length > 100) return { error: 'Tên thuộc tính không được vượt quá 100 ký tự.' };
  if (unit.length > 20) return { error: 'Đơn vị không được vượt quá 20 ký tự.' };

  return {
    value: {
      attrCode,
      attrName,
      unit,
      isFilterable: body.isFilterable === '1',
    },
  };
}

function renderForm(res, { title, attribute = {}, action }) {
  return res.render('staff/attributes/form', { title, attribute, action });
}

exports.index = async (req, res) => {
  const attributes = await Attribute.list();
  res.render('staff/attributes/index', { title: 'Thuộc tính kỹ thuật', attributes });
};

exports.showCreate = (req, res) => renderForm(res, {
  title: 'Thêm thuộc tính',
  action: '/staff/attributes',
});

exports.create = async (req, res) => {
  const parsed = parseForm(req.body);
  if (parsed.error) {
    req.flash('danger', parsed.error);
    return res.redirect('/staff/attributes/new');
  }

  try {
    await db.transaction(async (transaction) => {
      const attributeId = await Attribute.create(parsed.value, transaction);
      if (!attributeId) throw new Error('Không nhận được mã thuộc tính vừa tạo.');
      await audit.logInTransaction(
        transaction, req, 'CREATE', 'Attribute', attributeId,
        `${parsed.value.attrCode} - ${parsed.value.attrName}`,
      );
    });
    req.flash('success', 'Đã thêm thuộc tính kỹ thuật.');
    return res.redirect('/staff/attributes');
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      req.flash('danger', 'Mã thuộc tính đã tồn tại.');
      return res.redirect('/staff/attributes/new');
    }
    throw err;
  }
};

exports.showEdit = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) return res.status(404).render('errors/404', { layout: 'layouts/staff', title: 'Không tìm thấy thuộc tính' });

  const attribute = await Attribute.findById(id);
  if (!attribute) return res.status(404).render('errors/404', { layout: 'layouts/staff', title: 'Không tìm thấy thuộc tính' });
  return renderForm(res, {
    title: 'Sửa thuộc tính',
    attribute,
    action: `/staff/attributes/${id}`,
  });
};

exports.update = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) {
    req.flash('danger', 'Thuộc tính không hợp lệ.');
    return res.redirect('/staff/attributes');
  }

  const existing = await Attribute.findById(id);
  if (!existing) {
    req.flash('danger', 'Thuộc tính không tồn tại.');
    return res.redirect('/staff/attributes');
  }

  const parsed = parseForm(req.body);
  if (parsed.error) {
    req.flash('danger', parsed.error);
    return res.redirect(`/staff/attributes/${id}/edit`);
  }

  try {
    const updated = await db.transaction(async (transaction) => {
      const didUpdate = await Attribute.update(id, parsed.value, transaction);
      if (!didUpdate) return false;
      await audit.logInTransaction(
        transaction, req, 'UPDATE', 'Attribute', id,
        `${parsed.value.attrCode} - ${parsed.value.attrName}`,
      );
      return true;
    });
    if (!updated) {
      req.flash('danger', 'Thuộc tính không tồn tại hoặc đã được xoá.');
      return res.redirect('/staff/attributes');
    }
    req.flash('success', 'Đã cập nhật thuộc tính kỹ thuật.');
    return res.redirect('/staff/attributes');
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      req.flash('danger', 'Mã thuộc tính đã được sử dụng.');
      return res.redirect(`/staff/attributes/${id}/edit`);
    }
    throw err;
  }
};

exports.remove = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) {
    req.flash('danger', 'Thuộc tính không hợp lệ.');
    return res.redirect('/staff/attributes');
  }

  const attribute = await Attribute.findById(id);
  if (!attribute) {
    req.flash('danger', 'Thuộc tính không tồn tại.');
    return res.redirect('/staff/attributes');
  }

  try {
    const removed = await db.transaction(async (transaction) => {
      const didRemove = await Attribute.remove(id, transaction);
      if (!didRemove) return false;
      await audit.logInTransaction(
        transaction, req, 'DELETE', 'Attribute', id,
        `${attribute.AttrCode} - ${attribute.AttrName}`,
      );
      return true;
    });
    if (!removed) {
      req.flash('danger', 'Thuộc tính không tồn tại hoặc đã được xoá.');
      return res.redirect('/staff/attributes');
    }
    req.flash('success', 'Đã xoá thuộc tính kỹ thuật.');
  } catch (err) {
    if (err.number === 547) {
      req.flash('warning', 'Thuộc tính đang được sản phẩm hoặc luật tương thích sử dụng; không thể xoá.');
    } else {
      throw err;
    }
  }
  return res.redirect('/staff/attributes');
};
