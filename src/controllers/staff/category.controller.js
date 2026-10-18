// MODULE 2 - Quản lý danh mục sản phẩm
const Category = require('../../models/category.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const { slugify } = require('../../core/helpers');

function flattenTree(categories, excludedIds = new Set()) {
  const childrenByParent = new Map();
  for (const category of categories) {
    const key = category.ParentId == null ? 'root' : String(category.ParentId);
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(category);
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.SortOrder - b.SortOrder || a.CategoryName.localeCompare(b.CategoryName, 'vi'));
  }

  const flattened = [];
  const visited = new Set();
  function visit(parentId, level) {
    const key = parentId == null ? 'root' : String(parentId);
    for (const category of childrenByParent.get(key) || []) {
      if (visited.has(category.CategoryId)) continue;
      visited.add(category.CategoryId);
      if (!excludedIds.has(category.CategoryId)) flattened.push({ ...category, Level: level });
      visit(category.CategoryId, level + 1);
    }
  }
  visit(null, 0);

  // Preserve visibility of any invalid/orphaned rows rather than silently hiding them.
  for (const category of categories) {
    if (!visited.has(category.CategoryId) && !excludedIds.has(category.CategoryId)) {
      flattened.push({ ...category, Level: 0 });
    }
  }
  return flattened;
}

const descendantIds = Category.descendantIds;
const hasActiveAncestorChain = Category.hasActiveAncestorChain;

function fitsCategoryDepth(categories, categoryId, parentId) {
  const parentDepth = parentId == null ? 0 : Category.depthOf(categories, parentId);
  const subtreeHeight = categoryId == null ? 1 : Category.subtreeHeight(categories, categoryId);
  return parentDepth != null
    && subtreeHeight != null
    && parentDepth + subtreeHeight <= Category.MAX_DEPTH;
}

function parseId(value) {
  const id = Number(value);
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

function parseForm(body) {
  const categoryName = String(body.categoryName || '').trim();
  const rawParentId = String(body.parentId || '').trim();
  const rawSortOrder = String(body.sortOrder == null ? '0' : body.sortOrder).trim();
  const sortOrder = Number(rawSortOrder);

  if (!categoryName) return { error: 'Tên danh mục không được để trống.' };
  if (categoryName.length > 100) return { error: 'Tên danh mục không được vượt quá 100 ký tự.' };
  if (!/^\d+$/.test(rawSortOrder) || !Number.isSafeInteger(sortOrder) || sortOrder > 2147483647) {
    return { error: 'Thứ tự hiển thị phải là số nguyên không âm.' };
  }

  const slug = slugify(categoryName) || 'danh-muc';
  if (slug.length > 120) return { error: 'Tên danh mục tạo ra đường dẫn quá dài.' };
  return {
    value: {
      categoryName,
      parentId: rawParentId ? parseId(rawParentId) : null,
      sortOrder,
      isActive: body.isActive === '1',
    },
    slug,
    rawParentId,
  };
}

async function renderForm(res, { title, category = {}, categories, action }) {
  res.render('staff/categories/form', { title, category, categories, action });
}

exports.index = async (req, res) => {
  const categories = await Category.list();
  res.render('staff/categories/index', {
    title: 'Danh mục',
    categories: flattenTree(categories),
  });
};

exports.showCreate = async (req, res) => {
  const rows = await Category.list();
  const eligibleParents = rows.filter((row) => (
    hasActiveAncestorChain(rows, row.CategoryId)
    && fitsCategoryDepth(rows, null, row.CategoryId)
  ));
  return renderForm(res, {
    title: 'Thêm danh mục',
    categories: flattenTree(rows).filter((row) => eligibleParents.some((parent) => parent.CategoryId === row.CategoryId)),
    action: '/staff/categories',
  });
};

exports.create = async (req, res) => {
  const parsed = parseForm(req.body);
  if (parsed.error) {
    req.flash('danger', parsed.error);
    return res.redirect('/staff/categories/new');
  }

  const categories = await Category.list();
  const parentId = parsed.value.parentId;
  if (parsed.rawParentId && parentId == null) {
    req.flash('danger', 'Danh mục cha không hợp lệ.');
    return res.redirect('/staff/categories/new');
  }
  if (parentId != null && !hasActiveAncestorChain(categories, parentId)) {
    req.flash('danger', 'Danh mục cha không tồn tại, đã ngừng sử dụng hoặc nằm dưới nhánh đã ngừng.');
    return res.redirect('/staff/categories/new');
  }
  if (!fitsCategoryDepth(categories, null, parentId)) {
    req.flash('danger', `Không thể tạo danh mục: độ sâu tối đa là ${Category.MAX_DEPTH} cấp.`);
    return res.redirect('/staff/categories/new');
  }

  const slug = await Category.uniqueSlug(parsed.slug);
  try {
    await db.transaction(async (transaction) => {
      const categoryId = await Category.create({ ...parsed.value, slug }, transaction);
      if (!categoryId) throw new Error('Không nhận được mã danh mục vừa tạo.');
      await audit.logInTransaction(transaction, req, 'CREATE', 'Category', categoryId, parsed.value.categoryName);
    });
    req.flash('success', 'Đã thêm danh mục.');
    return res.redirect('/staff/categories');
  } catch (err) {
    if (err.code === 'CATEGORY_PARENT_INVALID') {
      req.flash('danger', 'Danh mục cha không còn hợp lệ, đã ngừng sử dụng hoặc nằm dưới nhánh đã ngừng.');
      return res.redirect('/staff/categories/new');
    }
    if (err.code === 'CATEGORY_DEPTH_LIMIT' || err.number === 50006) {
      req.flash('danger', `Không thể tạo danh mục: độ sâu tối đa là ${Category.MAX_DEPTH} cấp.`);
      return res.redirect('/staff/categories/new');
    }
    if (err.number === 2627 || err.number === 2601) {
      req.flash('danger', 'Không thể tạo đường dẫn duy nhất cho danh mục. Vui lòng đổi tên danh mục.');
      return res.redirect('/staff/categories/new');
    }
    if (err.number === 547) {
      req.flash('danger', 'Danh mục cha không còn hợp lệ. Vui lòng chọn lại.');
      return res.redirect('/staff/categories/new');
    }
    throw err;
  }
};

exports.showEdit = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) return res.status(404).render('errors/404', { layout: 'layouts/staff', title: 'Không tìm thấy danh mục' });

  const [category, rows] = await Promise.all([Category.findById(id), Category.list()]);
  if (!category) return res.status(404).render('errors/404', { layout: 'layouts/staff', title: 'Không tìm thấy danh mục' });

  const excludedIds = descendantIds(rows, id);
  const eligibleParents = rows.filter((row) => (
    (hasActiveAncestorChain(rows, row.CategoryId)
      || (!category.IsActive && row.CategoryId === category.ParentId))
    && fitsCategoryDepth(rows, id, row.CategoryId)
  ));
  return renderForm(res, {
    title: 'Sửa danh mục',
    category,
    categories: flattenTree(rows, excludedIds)
      .filter((row) => eligibleParents.some((parent) => parent.CategoryId === row.CategoryId)),
    action: `/staff/categories/${id}`,
  });
};

exports.update = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) {
    req.flash('danger', 'Danh mục không hợp lệ.');
    return res.redirect('/staff/categories');
  }

  const [existing, rows] = await Promise.all([Category.findById(id), Category.list()]);
  if (!existing) {
    req.flash('danger', 'Danh mục không tồn tại.');
    return res.redirect('/staff/categories');
  }

  const parsed = parseForm(req.body);
  if (parsed.error) {
    req.flash('danger', parsed.error);
    return res.redirect(`/staff/categories/${id}/edit`);
  }

  const parentId = parsed.value.parentId;
  const excludedIds = descendantIds(rows, id);
  if (parsed.rawParentId && parentId == null) {
    req.flash('danger', 'Danh mục cha không hợp lệ.');
    return res.redirect(`/staff/categories/${id}/edit`);
  }
  const sameInactiveParent = !existing.IsActive && Number(existing.ParentId) === parentId;
  if (parentId != null && (
    excludedIds.has(parentId)
    || (!hasActiveAncestorChain(rows, parentId) && !sameInactiveParent)
  )) {
    req.flash('danger', 'Danh mục cha không hợp lệ, không thể chọn chính nó, danh mục con hoặc danh mục đã ngừng.');
    return res.redirect(`/staff/categories/${id}/edit`);
  }
  if (!fitsCategoryDepth(rows, id, parentId)) {
    req.flash('danger', `Không thể di chuyển nhánh: độ sâu tối đa là ${Category.MAX_DEPTH} cấp.`);
    return res.redirect(`/staff/categories/${id}/edit`);
  }
  if (parsed.value.isActive && parentId != null && !hasActiveAncestorChain(rows, parentId)) {
    req.flash('danger', 'Không thể kích hoạt danh mục bên dưới một nhánh đang ngừng hoạt động.');
    return res.redirect(`/staff/categories/${id}/edit`);
  }
  if (existing.IsActive && !parsed.value.isActive && await Category.hasActiveSubtreeReferences(id)) {
    req.flash('warning', 'Không thể ngừng danh mục khi nhánh này còn sản phẩm đang bán hoặc danh mục con đang hoạt động.');
    return res.redirect(`/staff/categories/${id}/edit`);
  }

  try {
    await db.transaction(async (transaction) => {
      await Category.update(id, parsed.value, transaction);
      await audit.logInTransaction(transaction, req, 'UPDATE', 'Category', id, parsed.value.categoryName);
    });
    req.flash('success', 'Đã cập nhật danh mục.');
    return res.redirect('/staff/categories');
  } catch (err) {
    if (err.code === 'CATEGORY_PARENT_INVALID' || err.number === 50001 || err.number === 50002) {
      req.flash('danger', 'Danh mục cha không còn hợp lệ hoặc thao tác sẽ tạo cấu trúc không hợp lệ.');
      return res.redirect(`/staff/categories/${id}/edit`);
    }
    if (err.code === 'CATEGORY_DEPTH_LIMIT' || err.number === 50006) {
      req.flash('danger', `Không thể di chuyển nhánh: độ sâu tối đa là ${Category.MAX_DEPTH} cấp.`);
      return res.redirect(`/staff/categories/${id}/edit`);
    }
    if (err.code === 'CATEGORY_HAS_ACTIVE_REFERENCES') {
      req.flash('warning', 'Không thể ngừng danh mục khi nhánh này còn sản phẩm đang bán hoặc danh mục con đang hoạt động.');
      return res.redirect(`/staff/categories/${id}/edit`);
    }
    if (err.code === 'CATEGORY_NOT_FOUND') {
      req.flash('danger', 'Danh mục không còn tồn tại.');
      return res.redirect('/staff/categories');
    }
    if (err.number === 547) {
      req.flash('danger', 'Danh mục cha không còn hợp lệ hoặc thao tác sẽ tạo cấu trúc không hợp lệ.');
      return res.redirect(`/staff/categories/${id}/edit`);
    }
    throw err;
  }
};

exports.remove = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) {
    req.flash('danger', 'Danh mục không hợp lệ.');
    return res.redirect('/staff/categories');
  }

  const category = await Category.findById(id);
  if (!category) {
    req.flash('danger', 'Danh mục không tồn tại.');
    return res.redirect('/staff/categories');
  }

  try {
    const removed = await db.transaction(async (transaction) => {
      const didRemove = await Category.remove(id, transaction);
      if (!didRemove) return false;
      await audit.logInTransaction(transaction, req, 'DELETE', 'Category', id, category.CategoryName);
      return true;
    });
    if (!removed) {
      req.flash('danger', 'Danh mục không tồn tại hoặc đã được xoá.');
      return res.redirect('/staff/categories');
    }
    req.flash('success', 'Đã xoá danh mục.');
  } catch (err) {
    if (err.number === 547) {
      req.flash('warning', 'Danh mục đang được sản phẩm, danh mục con hoặc luật tương thích sử dụng; không thể xoá. Hãy ngừng sử dụng danh mục nếu phù hợp.');
    } else {
      throw err;
    }
  }
  return res.redirect('/staff/categories');
};
