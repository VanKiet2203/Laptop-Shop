// Trang thông tin tĩnh của cửa hàng (chính sách, giới thiệu, liên hệ) - nội dung ở core/siteInfo.js
const site = require('../../core/siteInfo');

// GET /info/:slug
exports.show = (req, res) => {
  const page = Object.prototype.hasOwnProperty.call(site.pages, req.params.slug) ? site.pages[req.params.slug] : null;
  if (!page) return res.status(404).render('errors/404', { title: 'Không tìm thấy trang' });
  return res.render('store/info', { title: page.title, page, slug: req.params.slug });
};
