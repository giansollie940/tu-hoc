import { normalizeDeviceChoice } from "./registration-domain.js";

export function deviceChoiceFromValue(value) {
  return normalizeDeviceChoice(value);
}

export function renderDeviceChoice({ checked = false, disabled = false } = {}) {
  const checkedAttribute = checked ? " checked" : "";
  const disabledAttribute = disabled ? " disabled" : "";
  return [
    '<label class="device-choice" for="usesElectronicDevice">',
    '  <span class="device-choice-copy">',
    '    <b>Sử dụng thiết bị điện tử</b>',
    '    <small>Buổi này em có sử dụng thiết bị điện tử không?</small>',
    "  </span>",
    '  <span class="switch-control">',
    '    <input id="usesElectronicDevice" name="usesElectronicDevice" type="checkbox"',
    checkedAttribute,
    disabledAttribute,
    ">",
    '    <span class="switch-track" aria-hidden="true"></span>',
    "  </span>",
    "</label>"
  ].join("");
}
