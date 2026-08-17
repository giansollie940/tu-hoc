const EYE_ICON=`
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5Z"
      stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="2"/>
  </svg>`;

function escapeAttribute(value=""){
  return String(value).replace(/[&<>"']/g,character=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  })[character]);
}

export function renderPasswordField({
  id,
  autocomplete="new-password",
  required=true,
  minlength=8,
  maxlength=128,
  placeholder=""
}={}){
  if(!id)throw new Error("Password field cần id.");

  return [
    '<span class="password-field">',
    `  <input id="${escapeAttribute(id)}" type="password"`,
    `    autocomplete="${escapeAttribute(autocomplete)}"`,
    `    minlength="${Number(minlength)||8}"`,
    `    maxlength="${Number(maxlength)||128}"`,
    placeholder?`    placeholder="${escapeAttribute(placeholder)}"`:"",
    required?"    required":"",
    "  >",
    `  <button class="password-toggle" type="button" data-password-target="${escapeAttribute(id)}"`,
    '    aria-label="Hiện mật khẩu" aria-pressed="false">',
    EYE_ICON,
    "  </button>",
    "</span>"
  ].filter(Boolean).join("");
}

export function renderPasswordDialog(){
  return [
    '<form id="changePasswordForm">',
    '  <p class="callout">Mật khẩu mới chỉ cần đáp ứng hai tiêu chí dưới đây.</p>',
    '  <label>Mật khẩu hiện tại',
    renderPasswordField({
      id:"currentOwnPassword",
      autocomplete:"current-password",
      minlength:1,
      maxlength:256
    }),
    "  </label>",
    '  <label>Mật khẩu mới',
    renderPasswordField({id:"newOwnPassword"}),
    "  </label>",
    '  <ul class="password-checklist" aria-live="polite">',
    '    <li data-password-rule="length">Ít nhất 8 ký tự</li>',
    '    <li data-password-rule="mixed">Có cả chữ và số</li>',
    "  </ul>",
    '  <label>Nhập lại mật khẩu mới',
    renderPasswordField({id:"newOwnPassword2"}),
    "  </label>",
    '  <button class="btn btn-primary btn-block" type="submit">Đổi mật khẩu</button>',
    "</form>"
  ].join("");
}
