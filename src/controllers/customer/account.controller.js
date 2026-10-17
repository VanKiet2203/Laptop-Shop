// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const Customer  = require('../../models/customer.model');

// GET /account
exports.profile = async (req, res) =>{ 
    try {
      const customer = await Customer.findById(req.session.user.customerId) || await Customer.findByAccountId(req.session.user.accountId);
      if (!customer) {
        return res.status(404).send('Không tìm thấy thông tin khách hàng');
      }
      res.render('customer/profile', { title: 'Hồ sơ khách hàng', customer }); 
    }
    catch (error) {
      console.error(error);
      res.status(500).send('Không kết nối được cơ sở dữ liệu');
    }
  };




// POST /account
exports.updateProfile = async (req, res) => {
  // kiểm tra dữ liệu đầu vào (nameCustomer, email, phone, TierId) hợp lệ
      const nameCustomer = (req.body.nameCustomer||'').trim();
      const phone = (req.body.phone||'').trim();
      const email = (req.body.email||'').trim();
      
      const erorMessages = [];
      if (!nameCustomer || !email || !phone ) {
        return res.status(400).send('Thiếu thông tin bắt buộc');
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        erorMessages.push('Email không hợp lệ');
      } 
      if( !/^\d{10,11}$/.test(phone)) {
        erorMessages.push('Số điện thoại không hợp lệ');
      }
      if (erorMessages.length > 0) {
        return res.status(400).send(erorMessages.join(', '));
      }
      // kiểm tra đã có khách hàng này tồn tại chưa (theo email hoặc phone)
      
      const customer = await Customer.findById(req.session.user.customerId) || await Customer.findByAccountId(req.session.user.accountId);
      if (!customer) {
      return res.status(400).send('Khách hàng không tồn tại với email hoặc số điện thoại này');
      // có thể làm là thêm mới khách hàng hoặc kiểm tra lại thông tin khách hàng hiện tại, nhưng ở đây chỉ kiểm tra tồn tại

      } else {
        // khách hàng tồn tại, có thể cập nhật thông tin
        await Customer.update(customer.CustomerId, { FullName: nameCustomer, Email: email, Phone: phone  });
      }
      
      // thông báo cập nhật thành công và chuyển hướng về trang hồ sơ
      req.flash('success', 'Cập nhật hồ sơ thành công.');
      return res.redirect('/account');
      
    };



// GET /account/addresses
exports.addresses = async (req, res) => {
  const addressesCustomer = await Customer.findAddressesByCustomerId(req.session.user.customerId) || await Customer.findAddressesByCustomerId(req.session.user.accountId);
  if (!addressesCustomer) {
    return res.status(404).send('Hiện tại chưa có địa chỉ nào được lưu trong hệ thống');
  } 
  res.render('customer/addresses', { title: 'Địa chỉ giao hàng', addresses: addressesCustomer });

};
  
// POST /account/addresses
exports.addAddress = async (req, res) => {
  const customer = await Customer.findById(req.session.user.customerId)|| await Customer.findByAccountId(req.session.user.accountId);
  if (!customer) {
    return res.status(404).send('Không tìm thấy thông tin khách hàng trên hệ thống');
  }
  const ReceiverName = customer.FullName;
  const ReceiverPhone = customer.Phone;
  const addressLine = (req.body.addressLine || '').trim();
  const ward = (req.body.ward || '').trim();
  const district = (req.body.district || '').trim();
  const province = (req.body.province || '').trim();
  const isDefault = req.body.isDefault;
  if(!addressLine || !ward || !district || !province || isDefault === undefined){
    return res.status(400).send('Thiếu thông tin bắt buộc');
  }
  if(await Customer.addAddress( customer.CustomerId, {
    receiverName: customer.FullName,
    receiverPhone: customer.Phone,
    addressLine: addressLine,
    ward: ward, district: district,
    province: province,
    isDefault: isDefault })){
    req.flash('success', 'Thêm địa chỉ thành công.');
    return res.redirect('/account/addresses');
  } else {
    return res.status(500).send('Có lỗi xảy ra khi thêm địa chỉ');
  }

};

//POST /account/addresses/updateAddress
exports.updateAddress = async (req, res) => {
  const customer = await Customer.findById(req.session.user.customerId)|| await Customer.findByAccountId(req.session.user.accountId);
  if (!customer) {
    return res.status(404).send('Không tìm thấy thông tin khách hàng trên hệ thống');
  }
  const ReceiverName = customer.FullName;
  const ReceiverPhone = customer.Phone;
  const addressId = req.body.addressId; // lấy địa chỉ đang muốn cập nhật từ form
  const addressLine = (req.body.addressLine || '').trim();
  const ward = (req.body.ward || '').trim();
  const district = (req.body.district || '').trim();
  const province = (req.body.province || '').trim();
  const isDefault = req.body.isDefault;
  if(!addressId || !addressLine || !ward || !district || !province || !isDefault){
    return res.status(400).send('Thiếu thông tin bắt buộc');
  }
  if(await Customer.updateAddress(customer.CustomerId, addressId, { 
      receiverName: customer.FullName,
      receiverPhone: customer.Phone,
      addressLine: addressLine,
      ward: ward,
      district: district,
      province: province,
      isDefault: isDefault })){
    req.flash('success', 'Cập nhật địa chỉ thành công.');
    return res.redirect('/account/addresses');
  } else {
    return res.status(500).send('Có lỗi xảy ra khi cập nhật địa chỉ');
  }
};

// POST /account/addresses/:id/delete
exports.deleteAddress = async (req, res) => {
  const customer = await Customer.findById(req.session.user.customerId)|| await Customer.findByAccountId(req.session.user.accountId);
  if (!customer) {
    return res.status(404).send('Không tìm thấy thông tin khách hàng trên hệ thống');
  }
  const addressId = req.params.id;
  if (!addressId) {
    return res.status(400).send('Thiếu thông tin địa chỉ cần xoá');
  }

  if(await Customer.deleteAddress(customer.CustomerId, addressId)) {
    req.flash('success', 'Xoá địa chỉ thành công.');
    return res.redirect('/account/addresses');
  } else {
    return res.status(500).send('Có lỗi xảy ra khi xoá địa chỉ');
  }

};

// POST /account/addresses/:id/default
exports.setDefault = async (req, res) => {
  const customer = await Customer.findById(req.session.user.customerId)|| await Customer.findByAccountId(req.session.user.accountId);
  if (!customer) {
    return res.status(404).send('Không tìm thấy thông tin khách hàng trên hệ thống');
  }
  const addressId = parseInt(req.params.id,10); // id đang muốn đặt làm mặc định
  if (!addressId) {
    return res.status(400).send('Thiếu thông tin địa chỉ cần đặt mặc định');
  }
  // nếu đã có thì setdefault, nếu chưa có thì báo lỗi
  if(await Customer.setDefault(customer.CustomerId, addressId)) {
    req.flash('success', 'Đặt địa chỉ mặc định thành công.');
    return res.redirect('/account/addresses');
  } else {
    return res.status(500).send('Có lỗi xảy ra khi đặt địa chỉ mặc định');
  }
};

