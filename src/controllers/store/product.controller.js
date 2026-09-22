// MODULE 2 - CỬA HÀNG (khách xem sản phẩm)
// Chủ sở hữu: Thành viên 2 - Danh mục sản phẩm
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /products
exports.index = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "Cửa hàng - Danh sách sản phẩm",
    "route": "GET /products",
    "tasks": [
      "Tìm kiếm theo tên (q), lọc theo khoảng giá (minPrice, maxPrice), danh mục, thương hiệu, sắp xếp (giá, tên, mới nhất), phân trang",
      "Dùng view vw_ProductCatalog, hiện QtyAvailable (còn hàng / hết hàng)",
      "Lọc theo thuộc tính IsFilterable (RAM_TYPE...) nếu còn thời gian"
    ],
    "db": "vw_ProductCatalog, Categories, Brands, Attributes",
    "rubric": "A3 xem hàng hoá + số lượng, tìm kiếm, lọc theo giá bán/tên",
    "controller": "src/controllers/store/product.controller.js",
    "view": "src/views/store/..."
  });
};

// GET /category/:slug
exports.byCategory = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "Cửa hàng - Theo danh mục",
    "route": "GET /category/:slug",
    "tasks": [
      "Lấy cả danh mục con (Categories.ParentId), tái sử dụng logic của /products"
    ],
    "db": "Categories",
    "rubric": "",
    "controller": "src/controllers/store/product.controller.js",
    "view": "src/views/store/..."
  });
};

// GET /products/:slug
exports.show = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "Cửa hàng - Chi tiết sản phẩm",
    "route": "GET /products/:slug",
    "tasks": [
      "Thông tin, ảnh, thông số kỹ thuật (ProductAttributeValues), số lượng còn",
      "Gợi ý linh kiện tương thích (CompatibilityRules) cho laptop",
      "Nút Thêm vào giỏ (gọi M3: POST /cart/add)"
    ],
    "db": "Products, ProductImages, ProductAttributeValues, CompatibilityRules",
    "rubric": "A3",
    "controller": "src/controllers/store/product.controller.js",
    "view": "src/views/store/..."
  });
};
