export function renderPanel({className='',header='',body='',footer=''}={}){
  return `<section class="v850-panel ${className}">${header}${body}${footer?`<footer class="v850-panel-footer">${footer}</footer>`:''}</section>`;
}

export function renderToolbar(content='',className=''){
  return `<div class="v850-toolbar ${className}">${content}</div>`;
}

export function renderSplit(left='',right='',className=''){
  return `<div class="v850-split ${className}"><div>${left}</div><div>${right}</div></div>`;
}
