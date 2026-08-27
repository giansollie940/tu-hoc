export function renderNavigation({items=[],route='',iconFor=()=>'',escapeHtml=value=>String(value)}={}){
  return items.map(item=>{
    const [id,,label]=item;
    const active=route===id;
    return `<button class="nav-btn ${active?'active':''}" data-route="${escapeHtml(id)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" ${active?'aria-current="page"':''}><span class="nav-icon-slot">${iconFor(id)}</span><span class="nav-label">${escapeHtml(label)}</span></button>`;
  }).join('');
}
