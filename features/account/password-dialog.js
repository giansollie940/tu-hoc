import { validateStudentPassword } from "./password-policy.js";

export function passwordChecklistState(password) {
  const result = validateStudentPassword(password);
  return {
    hasMinLength: result.hasMinLength,
    hasLetterAndNumber: result.hasLetterAndNumber
  };
}

export function renderPasswordDialog() {
  return [
    '<form id="changePasswordForm">',
    '  <p class="callout">Mật khẩu mới chỉ cần đáp ứng hai tiêu chí dưới đây.</p>',
    '  <label>Mật khẩu hiện tại',
    '    <input id="currentOwnPassword" type="password" autocomplete="current-password" required>',
    "  </label>",
    '  <label>Mật khẩu mới',
    '    <input id="newOwnPassword" type="password" minlength="8" autocomplete="new-password" required>',
    "  </label>",
    '  <ul class="password-checklist" aria-live="polite">',
    '    <li data-password-rule="length">Ít nhất 8 ký tự</li>',
    '    <li data-password-rule="mixed">Có cả chữ và số</li>',
    "  </ul>",
    '  <label>Nhập lại mật khẩu mới',
    '    <input id="newOwnPassword2" type="password" minlength="8" autocomplete="new-password" required>',
    "  </label>",
    '  <button class="btn btn-primary btn-block" type="submit">Đổi mật khẩu</button>',
    "</form>"
  ].join("");
}
