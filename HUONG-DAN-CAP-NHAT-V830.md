# Hướng dẫn cập nhật Sổ Tự Học V8.3.0

## Trước khi làm

1. Sao lưu dự án web hiện tại.
2. Trong Supabase, kiểm tra bản sao lưu cơ sở dữ liệu gần nhất.
3. Không xóa bảng, tài khoản, đăng ký, Function hay policy bằng tay trước khi chạy bản vá.

Các câu lệnh đã lưu trong **SQL Editor** chỉ là nội dung truy vấn để tiện mở lại. Xóa chúng không xóa dữ liệu, nhưng cũng không làm cơ sở dữ liệu “sạch” hơn. Bản V8.3.0 tự chuẩn hóa các policy liên quan bằng bản vá.

## Trường hợp đang dùng V8.2.5

Chỉ dùng hai tệp sau theo đúng thứ tự:

1. Mở `supabase/PATCH-V830-CUMULATIVE-FROM-V825.sql`, sao chép toàn bộ vào SQL Editor và bấm **Run**.
2. Mở `supabase/VERIFY-V830.sql`, sao chép toàn bộ và bấm **Run**.
3. Kiểm tra các dòng kiểm tra cột, index, policy và `search_path` đều có `ok = true`.

Không chạy `schema.sql` lên dự án đang có dữ liệu. Tệp đó chỉ dành cho một Supabase hoàn toàn mới.

## Trường hợp tạo Supabase mới hoàn toàn

1. Chạy `supabase/schema.sql` đúng một lần.
2. Chạy `supabase/VERIFY-V830.sql` để kiểm tra.
3. Không chạy thêm bản vá V8.3.0 vì nội dung cuối đã nằm trong `schema.sql`.

## Cập nhật Edge Functions trên web Supabase

Trong **Edge Functions**, thay nội dung `index.ts` của tám Function sau bằng tệp cùng tên trong thư mục `supabase/function`:

- `admin-create-user`
- `admin-delete-user`
- `admin-list-users`
- `admin-reset-password`
- `admin-update-user`
- `ai-review-registration`
- `audit-log`
- `emergency-register`

Function `quote-feed` không còn được ứng dụng sử dụng. Sau khi bản web V8.3.0 đã chạy ổn, có thể xóa Function này trên Supabase để giảm một điểm truy cập không cần thiết.

Với tám Function trên, bật **Verify JWT**. Ứng dụng gọi Function bằng phiên đăng nhập của người dùng; mỗi Function còn tự kiểm tra lại JWT, trạng thái tài khoản và vai trò. Tài liệu Supabase hiện tại cũng hướng dẫn giữ kiểm tra JWT cho Function chỉ được gọi bởi người dùng đã đăng nhập: <https://supabase.com/docs/guides/functions/auth-headers>.

## Secrets cần đặt

Trong **Edge Functions → Secrets**, thêm:

```text
ALLOWED_ORIGIN=https://ten-mien-web-cua-ban
LOGIN_DOMAIN=users.example.com
```

`ALLOWED_ORIGIN` phải là đúng phần gốc của địa chỉ web, không có dấu `/` ở cuối. Ví dụ: `https://so-tu-hoc.vercel.app`.

Nếu dùng AI duyệt đăng ký, giữ thêm `GROQ_API_KEY`. Không đưa bất kỳ secret key hoặc service-role key nào vào `config.js` hay kho mã nguồn. Supabase tự cung cấp `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` và `SUPABASE_SECRET_KEYS` cho Function đã triển khai: <https://supabase.com/docs/guides/functions/secrets>.

## Cấu hình web

Mở `config.js` và chỉ điền:

```js
projectUrl: "https://PROJECT_REF.supabase.co",
publishableKey: "PUBLISHABLE_KEY_CUA_BAN",
```

Publishable key được phép nằm ở giao diện khi RLS đã bật. Tuyệt đối không điền secret key hoặc service-role key.

## Kiểm tra sau cập nhật

1. Học sinh đăng nhập, đăng ký một buổi và bật lựa chọn dùng thiết bị.
2. Giáo viên mở **Theo dõi cả lớp**, kiểm tra tổng số dùng thiết bị và nội dung theo buổi.
3. Cán sự mở cùng trang, xác nhận chỉ xem được và không có nút duyệt/xóa.
4. Học sinh vào tài khoản, đổi mật khẩu bằng mật khẩu hiện tại; mật khẩu mới phải có ít nhất 8 ký tự và gồm chữ lẫn số.
5. Kiểm tra đăng ký bổ sung sau hạn nhưng trước giờ học.

