const MESSAGES = Object.freeze({
  PERMISSION_DENIED: "Bạn không có quyền thực hiện thao tác này hoặc thời hạn đăng ký đã thay đổi. Hãy tải lại và thử lại.",
  SESSION_EXPIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  NETWORK: "Không thể kết nối. Nội dung của bạn vẫn được giữ lại; hãy kiểm tra mạng và thử lại.",
  DUPLICATE: "Buổi này đã có đăng ký. Ứng dụng sẽ tải lại dữ liệu mới nhất.",
  UNKNOWN: "Không thể hoàn tất thao tác. Vui lòng thử lại."
});

export function friendlyAppError(error) {
  const code = String(error?.code ?? "");
  const status = Number(error?.status ?? 0);
  const message = String(error?.message ?? "").toLowerCase();

  if (code === "42501" || message.includes("row-level security")) {
    return { code: "PERMISSION_DENIED", message: MESSAGES.PERMISSION_DENIED };
  }
  if (status === 401 || message.includes("jwt expired") || message.includes("session expired")) {
    return { code: "SESSION_EXPIRED", message: MESSAGES.SESSION_EXPIRED };
  }
  if (code === "23505" || message.includes("duplicate key")) {
    return { code: "DUPLICATE", message: MESSAGES.DUPLICATE };
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return { code: "NETWORK", message: MESSAGES.NETWORK };
  }
  return { code: "UNKNOWN", message: MESSAGES.UNKNOWN };
}
