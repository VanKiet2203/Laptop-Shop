// MODULE 2 - Quản lý sản phẩm
const Product = require('../../models/product.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const { paginate, slugify } = require('../../core/helpers');

const PAGE_SIZE = 20;
const MAX_PRICE = Number.MAX_SAFE_INTEGER;
const MAX_IMAGE_COUNT = 8;

function parseId(value) {
  const id = Number(value);
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(id) && id > 0 && id <= 2147483647
    ? id
    : null;
}

function safeQueryId(value) {
  if (value == null || value === '') return null;
  return parseId(value);
}

function normalizeImageUrl(value) {
  const text = String(value || '').trim();
  if (!text || /[\u0000-\u001f\u007f\\]/.test(text)) return null;

  if (text.startsWith('/') && !text.startsWith('//')) {
    const normalized = encodeURI(text);
    const path = normalized.split(/[?#]/, 1)[0];
    if (path.split('/').some((segment) => segment === '..' || segment === '.')) return null;
    return normalized.length <= 500 ? normalized : null;
  }

  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    const normalized = url.toString();
    return normalized.length <= 500 ? normalized : null;
  } catch (_) {
    return null;
  }
}

function parseImages(value) {
  const entries = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  const imageUrls = [];
  const seen = new Set();
  for (const entry of entries) {
    const raw = String(entry || '').trim();
    if (!raw) continue;
    const imageUrl = normalizeImageUrl(raw);
    if (!imageUrl) return { error: 'Mỗi ảnh phải là URL http/https hoặc đường dẫn nội bộ bắt đầu bằng /, tối đa 500 ký tự.' };
    if (seen.has(imageUrl)) return { error: 'Danh sách ảnh không được có đường dẫn trùng nhau.' };
    seen.add(imageUrl);
    imageUrls.push(imageUrl);
  }
  if (imageUrls.length > MAX_IMAGE_COUNT) {
    return { error: `Mỗi sản phẩm chỉ được có tối đa ${MAX_IMAGE_COUNT} ảnh.` };
  }
  return { imageUrls };
}

function parseAttributes(body, attributes) {
  const allowedIds = new Set(attributes.map((attribute) => attribute.AttributeId));
  const attributeValues = [];
  for (const [key, raw] of Object.entries(body)) {
    const match = /^attr_(\d+)$/.exec(key);
    if (!match) continue;
    const attributeId = parseId(match[1]);
    if (attributeId == null || !allowedIds.has(attributeId)) {
      return { error: 'Danh sách thuộc tính không hợp lệ. Vui lòng tải lại biểu mẫu.' };
    }
    const attrValue = String(raw || '').trim();
    if (!attrValue) continue;
    if (attrValue.length > 200) {
      return { error: `Giá trị "${attributes.find((attribute) => attribute.AttributeId === attributeId).AttrName}" không được vượt quá 200 ký tự.` };
    }
    attributeValues.push({ attributeId, attrValue });
  }
  return { attributeValues };
}

function parseForm(body, attributes, currentProduct = null) {
  const sku = String(body.sku || '').trim().toUpperCase();
  const productName = String(body.productName || '').trim();
  const shortDesc = String(body.shortDesc || '').trim();
  const description = String(body.description || '').trim();
  const categoryId = parseId(body.categoryId);
  const brandId = parseId(body.brandId);
  const salePriceText = String(body.salePrice == null ? '' : body.salePrice).trim();
  const salePrice = Number(salePriceText);
  const warrantyText = String(body.warrantyMonths == null ? '' : body.warrantyMonths).trim();
  const warrantyMonths = Number(warrantyText);

  if (!/^[A-Z0-9][A-Z0-9._-]{0,39}$/.test(sku)) {
    return { error: 'SKU bắt buộc, tối đa 40 ký tự; chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.' };
  }
  if (!productName) return { error: 'Tên sản phẩm không được để trống.' };
  if (productName.length > 200) return { error: 'Tên sản phẩm không được vượt quá 200 ký tự.' };
  if (categoryId == null) return { error: 'Vui lòng chọn danh mục hợp lệ.' };
  if (brandId == null) return { error: 'Vui lòng chọn thương hiệu hợp lệ.' };
  if (!/^\d+$/.test(salePriceText) || !Number.isSafeInteger(salePrice) || salePrice < 0 || salePrice > MAX_PRICE) {
    return { error: 'Giá bán phải là số nguyên VND không âm và nằm trong giới hạn cho phép.' };
  }
  if (!/^\d+$/.test(warrantyText) || !Number.isSafeInteger(warrantyMonths) || warrantyMonths > 1200) {
    return { error: 'Thời hạn bảo hành phải là số nguyên từ 0 đến 1200 tháng.' };
  }
  if (shortDesc.length > 500) return { error: 'Mô tả ngắn không được vượt quá 500 ký tự.' };
  if (description.length > 10000) return { error: 'Mô tả chi tiết không được vượt quá 10.000 ký tự.' };

  const images = parseImages(body.imageUrls);
  if (images.error) return images;
  const parsedAttributes = parseAttributes(body, attributes);
  if (parsedAttributes.error) return parsedAttributes;

  return {
    value: {
      sku,
      productName,
      categoryId,
      brandId,
      shortDesc,
      description,
      salePrice,
      warrantyMonths,
      isSerialTracked: currentProduct && body.isSerialTracked === undefined
        ? Boolean(currentProduct.IsSerialTracked)
        : body.isSerialTracked === '1',
      isActive: currentProduct ? body.isActive === '1' : true,
      imageUrls: images.imageUrls,
      attributeValues: parsedAttributes.attributeValues,
    },
  };
}

function queryFilters(query) {
  const categoryId = safeQueryId(query.categoryId);
  const brandId = safeQueryId(query.brandId);
  return {
    q: typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '',
    categoryId,
    brandId,
    status: ['active', 'inactive'].includes(query.status) ? query.status : 'all',
    sort: typeof query.sort === 'string' ? query.sort : 'newest',
  };
}

function pageQuery(value) {
  const page = Number.parseInt(value, 10);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

async function renderForm(res, {
  title,
  product = {},
  action,
  serialTrackingLocked = false,
}) {
  const [options, attributes, images] = await Promise.all([
    Product.staffCatalogOptions({
      categoryId: product.CategoryId,
      brandId: product.BrandId,
    }),
    Product.staffAttributesOf(product.ProductId || null),
    product.ProductId ? Product.imagesOf(product.ProductId) : [],
  ]);
  res.render('staff/products/form', {
    title,
    product,
    action,
    categories: options.categories,
    brands: options.brands,
    attributes,
    imagesText: images.map((image) => image.ImageUrl).join('\n'),
    serialTrackingLocked,
  });
}

async function prepareWriteData(req, res, currentProduct = null) {
  const options = await Product.staffCatalogOptions({
    categoryId: currentProduct && currentProduct.CategoryId,
    brandId: currentProduct && currentProduct.BrandId,
  });
  const parsed = parseForm(req.body, options.attributes, currentProduct);
  if (parsed.error) {
    req.flash('danger', parsed.error);
    res.redirect(currentProduct ? `/staff/products/${currentProduct.ProductId}/edit` : '/staff/products/new');
    return null;
  }

  const category = options.categories.find((item) => item.CategoryId === parsed.value.categoryId);
  const brand = options.brands.find((item) => item.BrandId === parsed.value.brandId);
  const unchangedInactiveCategory = currentProduct
    && !currentProduct.CategoryIsActive
    && currentProduct.CategoryId === parsed.value.categoryId
    && !parsed.value.isActive;
  const unchangedInactiveBrand = currentProduct
    && !currentProduct.BrandIsActive
    && currentProduct.BrandId === parsed.value.brandId
    && !parsed.value.isActive;
  if ((!category || !category.IsActive) && !unchangedInactiveCategory) {
    req.flash('danger', 'Danh mục không tồn tại hoặc đã ngừng sử dụng.');
    res.redirect(currentProduct ? `/staff/products/${currentProduct.ProductId}/edit` : '/staff/products/new');
    return null;
  }
  if ((!brand || !brand.IsActive) && !unchangedInactiveBrand) {
    req.flash('danger', 'Thương hiệu không tồn tại hoặc đã ngừng sử dụng.');
    res.redirect(currentProduct ? `/staff/products/${currentProduct.ProductId}/edit` : '/staff/products/new');
    return null;
  }

  return parsed.value;
}

exports.index = async (req, res) => {
  const filters = queryFilters(req.query);
  const requestedPage = pageQuery(req.query.page);
  const [result, options] = await Promise.all([
    Product.staffSearch({ ...filters, page: requestedPage, pageSize: PAGE_SIZE }),
    Product.staffCatalogOptions(),
  ]);
  res.render('staff/products/index', {
    title: 'Sản phẩm',
    products: result.rows,
    categories: options.categories.filter((category) => category.IsActive),
    brands: options.brands.filter((brand) => brand.IsActive),
    filters,
    pg: paginate(result.page, result.pageSize, result.total),
  });
};

exports.showCreate = (req, res) => renderForm(res, {
  title: 'Thêm sản phẩm',
  action: '/staff/products',
});

exports.create = async (req, res) => {
  const data = await prepareWriteData(req, res);
  if (!data) return;
  const slugBase = slugify(data.productName) || slugify(data.sku) || 'san-pham';

  try {
    const slug = await Product.uniqueProductSlug(slugBase);
    const result = await db.transaction(async (transaction) => {
      const created = await Product.createManaged({ ...data, slug }, transaction);
      if (created.invalidCatalogReference) return created;
      await audit.logInTransaction(
        transaction, req, 'CREATE', 'Product', created.productId,
        `${data.sku} - ${data.productName}`,
      );
      return created;
    });
    if (result.invalidCatalogReference) {
      req.flash('danger', 'Danh mục hoặc thương hiệu không còn hoạt động. Vui lòng tải lại biểu mẫu.');
      return res.redirect('/staff/products/new');
    }
    req.flash('success', 'Đã thêm sản phẩm.');
    return res.redirect('/staff/products');
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      req.flash('danger', 'SKU hoặc đường dẫn sản phẩm đã tồn tại. Vui lòng kiểm tra lại thông tin.');
      return res.redirect('/staff/products/new');
    }
    if (err.number === 547) {
      req.flash('danger', 'Danh mục, thương hiệu hoặc thuộc tính đã thay đổi. Vui lòng tải lại biểu mẫu.');
      return res.redirect('/staff/products/new');
    }
    throw err;
  }
};

exports.showEdit = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) return res.status(404).render('errors/404', { layout: 'layouts/staff', title: 'Không tìm thấy sản phẩm' });

  const product = await Product.staffFindById(id);
  if (!product) return res.status(404).render('errors/404', { layout: 'layouts/staff', title: 'Không tìm thấy sản phẩm' });
  const serialTrackingLocked = await Product.serialTrackingIsLocked(id);
  return renderForm(res, {
    title: `Sửa sản phẩm ${product.Sku}`,
    product,
    action: `/staff/products/${id}`,
    serialTrackingLocked,
  });
};

exports.update = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) {
    req.flash('danger', 'Mã sản phẩm không hợp lệ.');
    return res.redirect('/staff/products');
  }

  const currentProduct = await Product.staffFindById(id);
  if (!currentProduct) {
    req.flash('danger', 'Sản phẩm không tồn tại.');
    return res.redirect('/staff/products');
  }

  const data = await prepareWriteData(req, res, currentProduct);
  if (!data) return;
  const slugBase = slugify(data.productName) || slugify(data.sku) || 'san-pham';

  try {
    const slug = await Product.uniqueProductSlug(slugBase, id);
    const result = await db.transaction(async (transaction) => {
      const updated = await Product.updateManaged(id, { ...data, slug }, transaction);
      if (!updated.updated) return updated;
      await audit.logInTransaction(
        transaction, req, 'UPDATE', 'Product', id,
        `${data.sku} - ${data.productName}`,
      );
      return updated;
    });
    if (result.notFound) {
      req.flash('danger', 'Sản phẩm không tồn tại hoặc đã bị xoá.');
      return res.redirect('/staff/products');
    }
    if (result.serialTrackingLocked) {
      req.flash('warning', 'Không thể đổi chế độ quản lý Serial khi sản phẩm đã có tồn kho hoặc lịch sử nhập/bán.');
      return res.redirect(`/staff/products/${id}/edit`);
    }
    if (result.invalidCatalogReference) {
      req.flash('danger', 'Danh mục hoặc thương hiệu không còn phù hợp. Vui lòng tải lại biểu mẫu.');
      return res.redirect(`/staff/products/${id}/edit`);
    }
    req.flash('success', 'Đã cập nhật sản phẩm.');
    return res.redirect('/staff/products');
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      req.flash('danger', 'SKU hoặc đường dẫn sản phẩm đã tồn tại. Vui lòng kiểm tra lại thông tin.');
      return res.redirect(`/staff/products/${id}/edit`);
    }
    if (err.number === 547) {
      req.flash('danger', 'Danh mục, thương hiệu hoặc thuộc tính đang được sử dụng. Vui lòng tải lại biểu mẫu.');
      return res.redirect(`/staff/products/${id}/edit`);
    }
    throw err;
  }
};

exports.remove = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) {
    req.flash('danger', 'Mã sản phẩm không hợp lệ.');
    return res.redirect('/staff/products');
  }

  try {
    const result = await db.transaction(async (transaction) => {
      const removed = await Product.removeManaged(id, transaction);
      if (removed.deactivated) {
        await audit.logInTransaction(transaction, req, 'DELETE', 'Product', id, 'Đặt ngừng bán để giữ nguyên lịch sử/tồn kho.');
      } else if (removed.deleted) {
        await audit.logInTransaction(transaction, req, 'DELETE', 'Product', id, 'Xoá sản phẩm chưa phát sinh giao dịch.');
      }
      return removed;
    });
    if (result.notFound) {
      req.flash('danger', 'Sản phẩm không tồn tại.');
    } else if (result.alreadyInactive) {
      req.flash('warning', 'Sản phẩm đã ngừng bán.');
    } else if (result.deactivated) {
      req.flash('success', 'Sản phẩm đã được ngừng bán; dữ liệu lịch sử và tồn kho được giữ nguyên.');
    } else if (result.deleted) {
      req.flash('success', 'Đã xoá sản phẩm chưa phát sinh giao dịch.');
    }
  } catch (err) {
    if (err.number === 547) {
      const deactivated = await db.transaction(async (transaction) => {
        const didDeactivate = await Product.deactivateManaged(id, transaction);
        if (!didDeactivate) return false;
        await audit.logInTransaction(
          transaction, req, 'DELETE', 'Product', id,
          'Đặt ngừng bán do phát sinh tham chiếu trong khi xoá.',
        );
        return true;
      });
      if (!deactivated) {
        req.flash('danger', 'Sản phẩm không còn tồn tại.');
        return res.redirect('/staff/products');
      }
      req.flash('warning', 'Sản phẩm đã được ngừng bán vì phát sinh dữ liệu tham chiếu; lịch sử được giữ nguyên.');
    } else {
      throw err;
    }
  }
  return res.redirect('/staff/products');
};
