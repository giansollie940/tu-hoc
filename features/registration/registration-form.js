export function renderDeviceChoice({checked=false,disabled=false}={}){
  return `<label class="device-choice"><span>Sử dụng thiết bị điện tử?</span><span class="device-toggle"><input id="usesElectronicDevice" name="usesElectronicDevice" type="checkbox" ${checked?'checked':''} ${disabled?'disabled':''}><span aria-hidden="true"></span></span><small>Chỉ bật khi em dự kiến dùng điện thoại, máy tính, internet, website, video hoặc ứng dụng để học.</small></label>`;
}
