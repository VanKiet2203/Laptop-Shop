// MODULE 2 - Trang chủ cửa hàng
const Product = require('../../models/product.model');
const Promotion = require('../../models/promotion.model');

exports.index = async (req, res) => {
  const [products, categories, bestSellers, gaming, office, upgrade, promotions, facets] = await Promise.all([
    Product.featured(8),
    Product.rootCategories(),
    Product.bestSellers(8),
    Product.topByCategorySlugs(['laptop-gaming'], 4),
    Product.topByCategorySlugs(['laptop-van-phong'], 4),
    Product.topByCategorySlugs(['ram', 'ssd'], 4),
    Promotion.active(3),
    Product.facets({}),
  ]);
  res.render('store/home', {
    title: 'Trang chủ',
    products,
    categories,
    bestSellers,
    gaming,
    office,
    upgrade,
    promotions,
    brands: facets.brands,
  });
};
