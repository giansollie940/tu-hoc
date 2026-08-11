/*
  SỔ TỰ HỌC - CẤU HÌNH CHẠY

  mode: "demo"
    - Chạy ngay, không cần Supabase.
    - Dữ liệu lưu trong localStorage của từng trình duyệt.

  mode: "supabase"
    - Dùng thật cho cả lớp: mọi thiết bị dùng chung database.
    - Điền projectUrl và publishableKey bên dưới.
    - Chỉ dùng Publishable key/legacy anon key ở frontend.
      TUYỆT ĐỐI KHÔNG đưa Secret key/service_role key vào file này.
*/
window.APP_CONFIG = {
  mode: "supabase",
  projectUrl: "https://qhqqujozpqopahxscpks.supabase.co",
  publishableKey: "sb_publishable_iIrcm25VPzeURIKYTU1nlQ_QEvbZiCT",
  appName: "Sổ Tự Học",
  // Học sinh chỉ nhập mã. App ánh xạ 10A1-01 -> 10a1-01@users.example.com.
  // Domain này chỉ là định danh nội bộ, không dùng để nhận thư.
  loginDomain: "users.example.com",
  timeZone: "Asia/Ho_Chi_Minh",
  refreshSeconds: 60
};
