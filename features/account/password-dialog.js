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
    "    <span class=\"password-field\">",
    "      <input id=\"currentOwnPassword\" type=\"password\" autocomplete=\"current-password\" required>",
    "      <button class=\"password-toggle\" type=\"button\" data-password-target=\"currentOwnPassword\" aria-label=\"Hi\u1ec7n m\u1eadt kh\u1ea9u\" aria-pressed=\"false\">",
    "        <svg viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\"><path d=\"M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\"12\" cy=\"12\" r=\"2.6\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>",
    "      </button>",
    "    </span>",
    "  </label>",
    '  <label>Mật khẩu mới',
    "    <span class=\"password-field\">",
    "      <input id=\"newOwnPassword\" type=\"password\" minlength=\"8\" autocomplete=\"new-password\" required>",
    "      <button class=\"password-toggle\" type=\"button\" data-password-target=\"newOwnPassword\" aria-label=\"Hi\u1ec7n m\u1eadt kh\u1ea9u\" aria-pressed=\"false\">",
    "        <svg viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\"><path d=\"M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\"12\" cy=\"12\" r=\"2.6\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>",
    "      </button>",
    "    </span>",
    "  </label>",
    '  <ul class="password-checklist" aria-live="polite">',
    '    <li data-password-rule="length">Ít nhất 8 ký tự</li>',
    '    <li data-password-rule="mixed">Có cả chữ và số</li>',
    "  </ul>",
    '  <label>Nhập lại mật khẩu mới',
    "    <span class=\"password-field\">",
    "      <input id=\"newOwnPassword2\" type=\"password\" minlength=\"8\" autocomplete=\"new-password\" required>",
    "      <button class=\"password-toggle\" type=\"button\" data-password-target=\"newOwnPassword2\" aria-label=\"Hi\u1ec7n m\u1eadt kh\u1ea9u\" aria-pressed=\"false\">",
    "        <svg viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\"><path d=\"M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\"12\" cy=\"12\" r=\"2.6\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>",
    "      </button>",
    "    </span>",
    "  </label>",
    '  <button class="btn btn-primary btn-block" type="submit">Đổi mật khẩu</button>',
    "</form>"
  ].join("");
}
