# Thay đổi trong V8.3.0

- Loại bỏ hoàn toàn chế độ demo và dữ liệu giả.
- Thay cú cũ bằng cú hoa văn sáu lớp từ `owl-layout.json`; ảnh đã được tối ưu WebP và JSON nguồn không được đưa vào gói chạy.
- Thêm lựa chọn **Sử dụng thiết bị điện tử** cho đăng ký thường và đăng ký bổ sung.
- Giáo viên/cán sự xem nội dung theo từng buổi, số đã đăng ký, số chưa đăng ký và số dùng thiết bị.
- Cán sự chỉ xem; giáo viên có nút duyệt, yêu cầu sửa, nhận xét và xóa.
- Học sinh tự đổi mật khẩu bằng mật khẩu hiện tại; chỉ có hai tiêu chí: ít nhất 8 ký tự, gồm chữ và số.
- Áp dụng bảng màu học tập xanh lam – san hô đã duyệt, tăng độ tương phản và hỗ trợ giảm chuyển động.
- Dữ liệu lớp được tải theo tuần đang xem, còn lịch sử cá nhân vẫn được giữ.
- Tinh gọn gói SQL triển khai còn `schema.sql`, bản vá cộng dồn và tệp kiểm tra.
- Gia cố CORS, JWT/role checks, thông báo lỗi trung hòa và phiên bản thư viện cố định.

