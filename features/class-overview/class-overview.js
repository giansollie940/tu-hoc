const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const activeLearners=users=>(users||[]).filter(u=>u.active!==false&&['student','monitor'].includes(u.role));
function regFor(registrations,userId,session){return (registrations||[]).find(r=>r.studentId===userId&&Number(r.dow)===Number(session.dow)&&Number(r.period)===Number(session.period)&&r.isDeleted!==true);}

export function registrationBucket(reg){
  if(!reg||reg.status==='draft')return 'missing';
  if(reg.revisionOverdueAt)return 'attention';
  if(reg.status==='submitted'||reg.aiReviewStatus==='error')return 'attention';
  return 'registered';
}

export function summarizeSession({users,registrations,session}){
  const learners=activeLearners(users);let registered=0,missing=0,attention=0;
  const rows=learners.map(user=>{
    const registration=regFor(registrations,user.id,session);
    const bucket=registrationBucket(registration);
    if(bucket==='missing')missing++;else registered++;
    if(bucket==='attention')attention++;
    return {user,registration,bucket};
  });
  return {total:learners.length,registered,missing,attention,rows};
}

export function renderClassOverview({week,sessions=[],users=[],registrations=[]}={}){
  const cards=sessions.map(session=>{
    const summary=summarizeSession({users,registrations,session});
    const completed=summary.total?Math.round(summary.registered/summary.total*100):0;
    return `<button type="button" class="class-session-card" data-open-session="${session.dow}-${session.period}">
      <div class="class-session-card-head"><div><span>${esc(session.label)}</span><h3>${summary.total} học sinh</h3></div><span class="class-session-open" aria-hidden="true">→</span></div>
      <div class="class-session-progress"><span style="width:${completed}%"></span></div>
      <div class="class-session-metrics"><span class="good"><b>${summary.registered}</b>Đã đăng ký</span><span class="missing"><b>${summary.missing}</b>Chưa đăng ký</span><span class="attention"><b>${summary.attention}</b>Cần xử lý</span></div>
      <span class="class-session-cta">Xem chi tiết buổi</span>
    </button>`;
  }).join('');
  return `<header class="v850-page-header"><div class="v850-page-heading"><span class="v850-kicker">THEO DÕI LỚP</span><h1>Theo dõi cả lớp</h1><p>Tuần ${esc(week?.number||'')} · Chọn một buổi rồi dùng bộ lọc để xem đúng nhóm học sinh cần theo dõi.</p></div></header>
    <section class="class-session-grid-v850">${cards||'<div class="v850-panel">Tuần này chưa có tiết tự học.</div>'}</section>`;
}

function fallbackManagerActions(reg){
  return {canApprove:reg?.status==='submitted',canRequestRevision:['submitted','needs_revision','approved'].includes(reg?.status),canComment:!!reg,canDelete:!!reg};
}

function statusText(row){
  const r=row.registration;
  if(row.bucket==='missing')return 'Chưa đăng ký';
  if(r?.revisionOverdueAt)return 'Báo cáo lỗi';
  if(r?.status==='approved')return 'Đã duyệt';
  if(r?.status==='needs_revision')return 'Cần chỉnh sửa';
  return 'Chờ duyệt';
}

function deviceRegistrationText(row){
  const r=row.registration;
  if(!r)return 'Chưa có đăng ký';
  return r.usesElectronicDevice===true?'Có đăng ký':'Không đăng ký';
}

function deviceRegistrationClass(row){
  const r=row.registration;
  if(!r)return 'is-na';
  return r.usesElectronicDevice===true?'is-yes':'is-no';
}

function aiStatusText(reg){
  if(!reg)return '—';
  const value=String(reg.aiReviewStatus||'').toLowerCase();
  return ({approved:'Đạt',manual:'GV xem',needs_revision:'Cần sửa',error:'Lỗi',pending:'Đang chờ',processing:'Đang xử lý'})[value]||'—';
}

function learnerCard(row,role,getManagerActions){
  const r=row.registration;
  let actions='';
  if(['teacher','admin'].includes(role)&&r){
    const p=typeof getManagerActions==='function'?getManagerActions(r):fallbackManagerActions(r);
    const buttons=[];
    if(p.canApprove)buttons.push(`<button class="btn btn-success approve-btn" data-id="${r.id}" type="button">Duyệt</button>`);
    if(p.canRequestRevision)buttons.push(`<button class="btn btn-warning revise-btn" data-id="${r.id}" type="button">Yêu cầu sửa</button>`);
    if(p.canComment)buttons.push(`<button class="btn btn-ghost comment-btn" data-id="${r.id}" type="button">Nhận xét</button>`);
    if(p.canDelete)buttons.push(`<button class="btn btn-danger delete-reg-btn" data-id="${r.id}" type="button">Xóa</button>`);
    actions=`<div class="class-learner-actions">${buttons.join('')}</div>`;
  }
  return `<article class="class-learner-card bucket-${row.bucket}">
    <div class="class-learner-head"><span class="class-learner-avatar">${esc((row.user.name||row.user.fullName||'?').split(' ').slice(-2).map(x=>x[0]).join('').toUpperCase())}</span><div><b>${esc(row.user.name||row.user.fullName||'')}</b><small>${esc(row.user.code||'')}</small></div><span class="class-learner-status">${esc(statusText(row))}</span></div>
    <div class="class-learner-facts">
      <span><small>Thiết bị điện tử</small><b class="device-registration ${deviceRegistrationClass(row)}">${esc(deviceRegistrationText(row))}</b></span>
      <span><small>AI</small><b>${esc(aiStatusText(r))}</b></span>
      <span><small>Phản hồi GV</small><b>${r?.teacherComment?'Có':'—'}</b></span>
    </div>
    <div class="class-learner-content"><small>Nội dung đăng ký</small><p>${esc(r?.content||'Chưa có nội dung đăng ký')}</p></div>
    ${r?.note?`<div class="class-learner-note"><small>Ghi chú</small><p>${esc(r.note)}</p></div>`:''}
    ${r?.teacherComment?`<div class="class-learner-comment"><b>GV:</b> ${esc(r.teacherComment)}</div>`:''}
    ${actions}
  </article>`;
}

export function renderSessionDetails({session,users=[],registrations=[],role,filter='all',getManagerActions}={}){
  const summary=summarizeSession({users,registrations,session});
  const buckets={
    all:summary.rows,
    registered:summary.rows.filter(row=>row.bucket!=='missing'),
    missing:summary.rows.filter(row=>row.bucket==='missing'),
    attention:summary.rows.filter(row=>row.bucket==='attention'),
    device:summary.rows.filter(row=>row.registration&&row.registration.usesElectronicDevice===true),
    'no-device':summary.rows.filter(row=>row.registration&&row.registration.usesElectronicDevice!==true&&row.bucket!=='missing')
  };
  const counts=Object.fromEntries(Object.entries(buckets).map(([key,rows])=>[key,rows.length]));
  const filters=[
    ['all','Tất cả'],['registered','Đã đăng ký'],['missing','Chưa đăng ký'],['attention','Cần xử lý'],['device','Có thiết bị'],['no-device','Không thiết bị']
  ];
  const tabs=filters.map(([key,label])=>`<button type="button" class="session-filter ${filter===key?'active':''}" data-session-filter="${key}">${label} (${counts[key]||0})</button>`).join('');
  const visible=buckets[filter]||buckets.all;
  const completed=summary.total?Math.round(summary.registered/summary.total*100):0;
  return `<div class="session-detail-v850">
    <div class="session-detail-toolbar"><div><span class="v850-section-kicker">CHI TIẾT BUỔI</span><h3>${esc(session?.label||'Buổi tự học')}</h3><p>${summary.total} học sinh · ${completed}% đã có đăng ký</p></div></div>
    <div class="session-detail-summary">
      <span class="is-total"><small>Sĩ số</small><b>${summary.total}</b></span>
      <span class="is-registered"><small>Đã đăng ký</small><b>${summary.registered}</b></span>
      <span class="is-missing"><small>Chưa đăng ký</small><b>${summary.missing}</b></span>
      <span class="is-attention"><small>Cần xử lý</small><b>${summary.attention}</b></span>
    </div>
    <div class="session-filter-shell"><div><span class="v850-section-kicker">LỌC DANH SÁCH</span><small>Chỉ hiển thị nhóm cần xem; danh sách luôn dùng toàn bộ chiều ngang.</small></div><div class="session-filter-bar">${tabs}</div></div>
    <div class="session-detail-list">${visible.length?visible.map(row=>learnerCard(row,role,getManagerActions)).join(''):`<div class="session-list-empty">Không có học sinh phù hợp với bộ lọc này.</div>`}</div>
  </div>`;
}
