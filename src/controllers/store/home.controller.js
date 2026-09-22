// MODULE 2 - Trang chủ cửa hàng (đã làm sẵn để kiểm tra kết nối DB)
const Product = require('../../models/product.model');

exports.index = async (req, res) => {
  const [products, categories] = await Promise.all([Product.featured(8), Product.rootCategories()]);
  res.render('store/home', { title: 'Trang chủ', products, categories });
};
