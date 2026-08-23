export function pageHeader({kicker='SỔ TỰ HỌC',title='',subtitle='',actions=''}={}){
  return `<header class="v850-page-header">
    <div class="v850-page-heading">
      <span class="v850-kicker">${kicker}</span>
      <h1>${title}</h1>
      ${subtitle?`<p>${subtitle}</p>`:''}
    </div>
    ${actions?`<div class="v850-page-actions">${actions}</div>`:''}
  </header>`;
}

export function sectionHeader({kicker='',title='',subtitle='',action=''}={}){
  return `<div class="v850-section-header">
    <div>${kicker?`<span class="v850-section-kicker">${kicker}</span>`:''}<h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>
    ${action?`<div class="v850-section-action">${action}</div>`:''}
  </div>`;
}

export function metricCard({label='',value='',meta='',icon='',tone='primary'}={}){
  return `<article class="v850-metric-card tone-${tone}">${icon?`<div class="v850-metric-icon">${icon}</div>`:''}<div><strong>${value}</strong><span>${label}</span>${meta?`<small>${meta}</small>`:''}</div></article>`;
}

export function emptyState({title='Chưa có dữ liệu',description='Thông tin sẽ xuất hiện tại đây khi có dữ liệu phù hợp.',image='assets/images/empty-state.png',action=''}={}){
  return `<div class="v850-empty-state">${image?`<img src="${image}" alt="">`:''}<div><h3>${title}</h3><p>${description}</p>${action?`<div class="v850-empty-action">${action}</div>`:''}</div></div>`;
}

export function progressBar({value=0,label='',tone='primary'}={}){
  const safe=Math.max(0,Math.min(100,Number(value)||0));
  return `<div class="v850-progress ${tone}">${label?`<div class="v850-progress-label"><span>${label}</span><b>${safe}%</b></div>`:''}<div class="v850-progress-track"><span style="width:${safe}%"></span></div></div>`;
}

export function tabs(items=[],active=''){
  return `<div class="v850-tabs" role="tablist">${items.map(item=>`<button type="button" role="tab" class="v850-tab ${item.id===active?'active':''}" data-tab="${item.id}" aria-selected="${item.id===active}">${item.label}</button>`).join('')}</div>`;
}

export function statusPill({label='',tone='neutral',icon=''}={}){
  return `<span class="v850-status-pill tone-${tone}">${icon||''}<span>${label}</span></span>`;
}
