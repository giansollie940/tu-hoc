const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const activeLearners=users=>(users||[]).filter(u=>u.active!==false&&['student','monitor'].includes(u.role));
function regFor(registrations,userId,session){return (registrations||[]).find(r=>r.studentId===userId&&Number(r.dow)===Number(session.dow)&&Number(r.period)===Number(session.period)&&r.isDeleted!==true);}
export function registrationBucket(reg){
  if(!reg||reg.status==='draft')return 'missing';
  if(reg.revisionOverdueAt)return 'attention';
  if(reg.status==='submitted'||reg.aiReviewStatus==='error')return 'attention';
  if(reg.status==='needs_revision')return 'registered';
  return 'registered';
}
export function summarizeSession({users,registrations,session}){
  const learners=activeLearners(users);let registered=0,missing=0,attention=0;
  const rows=learners.map(user=>{const registration=regFor(registrations,user.id,session);const bucket=registrationBucket(registration);if(bucket==='missing')missing++;else registered++;if(bucket==='attention')attention++;return {user,registration,bucket};});
  return {total:learners.length,registered,missing,attention,rows};
}
export function renderClassOverview({week,sessions=[],users=[],registrations=[],role}={}){
  const sessionCards=sessions.map(session=>{const s=summarizeSession({users,registrations,session});return `<button type="button" class="card session-summary-card" data-open-session="${session.dow}-${session.period}"><div class="session-summary-head"><div><span class="eyebrow-pill">${esc(session.label)}</span><h3>${s.total} học sinh</h3></div><span class="session-open-arrow">›</span></div><div class="session-metrics"><span class="metric-good">✅ ${s.registered} đã đăng ký</span><span class="metric-missing">🚨 ${s.missing} chưa đăng ký</span><span class="metric-attention">⚠️ ${s.attention} cần xử lý</span></div></button>`;}).join('');
  return `<div class="page-head"><div><h1>Theo dõi cả lớp</h1><p>Tuần ${esc(week?.number||'')} · Mỗi buổi hiển thị ngay danh sách thiếu để dễ theo dõi.</p></div></div><div class="session-summary-grid">${sessionCards||'<div class="card">Tuần này chưa có tiết tự học.</div>'}</div>`;
}
function fallbackManagerActions(reg){
  return {
    canApprove:reg?.status==='submitted',
    canRequestRevision:['submitted','needs_revision','approved'].includes(reg?.status),
    canComment:!!reg,
    canDelete:!!reg
  };
}
function rowHtml(row,role,getManagerActions){
  const r=row.registration;
  const status=row.bucket==='missing'?'Chưa đăng ký':r?.revisionOverdueAt?'Báo cáo lỗi':r?.status==='approved'?'Đã duyệt':r?.status==='needs_revision'?'Cần chỉnh sửa':'Chờ duyệt';
  let actions='';
  if(['teacher','admin'].includes(role)&&r){
    const permissions=typeof getManagerActions==='function'?getManagerActions(r):fallbackManagerActions(r);
    const buttons=[];
    if(permissions.canApprove)buttons.push(`<button class="btn btn-success approve-btn" data-id="${r.id}" type="button">✓ Duyệt</button>`);
    if(permissions.canRequestRevision)buttons.push(`<button class="btn btn-warning revise-btn" data-id="${r.id}" type="button">↩ Yêu cầu sửa</button>`);
    if(permissions.canComment)buttons.push(`<button class="btn btn-ghost comment-btn" data-id="${r.id}" type="button">💬</button>`);
    if(permissions.canDelete)buttons.push(`<button class="btn btn-danger delete-reg-btn" data-id="${r.id}" type="button">🗑</button>`);
    actions=`<div class="session-row-actions">${buttons.join('')}</div>`;
  }
  return `<tr><td><b>${esc(row.user.name||row.user.fullName||'')}</b><div class="tiny muted">${esc(row.user.code||'')}</div></td><td>${esc(r?.content||'—')}</td><td><span class="status ${row.bucket==='missing'?'missing':row.bucket==='attention'?'draft':'approved'}">${esc(status)}</span></td><td>${actions}</td></tr>`;
}
export function renderSessionDetails({session,users=[],registrations=[],role,filter='all',getManagerActions}={}){
  const summary=summarizeSession({users,registrations,session});const counts={all:summary.total,registered:summary.registered,missing:summary.missing,attention:summary.attention};
  const filtered=summary.rows.filter(row=>filter==='all'||(filter==='registered'&&row.bucket!=='missing')||row.bucket===filter);
  const tabs=[['all','Tất cả'],['registered','Đã đăng ký'],['missing','Chưa đăng ký'],['attention','Cần xử lý']].map(([key,label])=>`<button type="button" class="session-filter ${filter===key?'active':''}" data-session-filter="${key}">${label} (${counts[key]})</button>`).join('');
  return `<div class="session-detail"><div class="session-detail-head"><h3>${esc(session?.label||'Buổi tự học')}</h3><div class="session-filter-bar">${tabs}</div></div><div class="table-wrap"><table class="data-table session-table"><thead><tr><th>Học sinh</th><th>Nội dung</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${filtered.length?filtered.map(row=>rowHtml(row,role,getManagerActions)).join(''):`<tr><td colspan="4" class="muted">Không có học sinh trong bộ lọc này.</td></tr>`}</tbody></table></div></div>`;
}
