# Báo cáo bảo mật V8.3.0

## Kết quả chính

- Không phát hiện API key, JWT, khóa Groq, secret key hoặc service-role key thật trong gói bàn giao.
- `config.js` chỉ chứa chỗ trống để người triển khai tự điền Project URL và publishable key.
- Secret key chỉ được đọc từ biến môi trường của Edge Functions và không đi xuống trình duyệt.
- Phiên đăng nhập dùng `sessionStorage`, không lưu access token lâu dài trong `localStorage`.
- Học sinh/cán sự chỉ ghi đăng ký của chính mình; cán sự chỉ đọc đăng ký đã gửi của lớp; giáo viên mới có thao tác quản lý.
- Đăng ký bổ sung được kiểm tra lại hoàn toàn ở Function máy chủ.
- Tám Function nhạy cảm kiểm tra bearer JWT, hồ sơ đang hoạt động và vai trò trước khi xử lý.
- CORS mặc định đóng; chỉ miền trong `ALLOWED_ORIGIN` được trình duyệt chấp nhận.
- Thông báo lỗi gửi về giao diện đã được trung hòa, không trả nguyên văn lỗi cơ sở dữ liệu hoặc nhà cung cấp.
- Thư viện Supabase JS được ghim ở phiên bản `2.95.0` để tránh thay đổi ngoài ý muốn khi triển khai lại.
- Function lấy danh ngôn từ website ngoài đã được bỏ; cú dùng kho câu cục bộ nên nhanh và ít phụ thuộc hơn.

## Bảo vệ dữ liệu

Bản vá V8.3.0 không xóa bảng hay đăng ký. Nó thêm cột boolean có mặc định `false`, thêm hai index có điều kiện và chuẩn hóa bốn policy của bảng `registrations`.

`VERIFY-V830.sql` chỉ đọc metadata và số liệu tổng hợp; không có lệnh thay đổi hoặc xóa dữ liệu.

## Giới hạn của lần kiểm tra

- Đã kiểm tra tĩnh mã nguồn, hợp đồng RLS/SQL, Function, lỗi người dùng, giao diện desktop/mobile và bộ kiểm tra tự động cục bộ.
- Chưa chạy trực tiếp trên Supabase thật vì gói bàn giao cố ý không chứa thông tin đăng nhập hoặc khóa dự án.
- Sau khi triển khai, cần chạy `VERIFY-V830.sql` và thử ba vai trò bằng tài khoản thật trước khi đưa cho cả lớp.

