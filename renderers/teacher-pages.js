import { sectionHeader, metricCard, progressBar, emptyState } from '../ui/page-kit.js';

export function renderTeacherDashboardPage({
  headerHtml='',bannerHtml='',stats={},unread=0,pendingCount=0,pendingItems='',aiWaiting=0,
  aiAutomationEnabled=false,aiThreshold=90,weekInfo={}
}={}){
  const metrics=[
    metricCard({label:'Đăng ký hợp lệ',value:stats.valid??0,tone:'success'}),
    metricCard({label:'Báo cáo lỗi',value:stats.issues??0,tone:'warning'}),
    metricCard({label:'Chưa đăng ký',value:stats.missing??0,tone:'danger'}),
    metricCard({label:'Cần GV xem',value:unread||pendingCount,tone:'primary'}),
    metricCard({label:'Hoàn thành hợp lệ',value:`${stats.rate??0}%`,tone:'success'})
  ].join('');
  return `${headerHtml}${bannerHtml}
    <section class="teacher-dashboard-metrics"><div class="v850-metrics teacher-metrics">${metrics}</div></section>
    ${aiWaiting?`<div class="v850-inline-notice warning teacher-ai-alert"><span><b>${aiWaiting} đăng ký đang chờ AI.</b> Nếu AI không phản hồi trong 2 phút, backend sẽ chuyển sang danh sách cần giáo viên xử lý.</span><button class="btn btn-ghost" type="button" data-route-approvals="1">Xem hàng đợi</button></div>`:''}
    <section class="teacher-ai-status ${aiAutomationEnabled?'on':'off'}">
      <div><span class="teacher-ai-dot" aria-hidden="true"></span><div><b>${aiAutomationEnabled?'Duyệt tự động bằng AI đang bật':'Duyệt tự động bằng AI đang tắt'}</b><p>${aiAutomationEnabled?`Groq AI kiểm tra đăng ký mới và chỉ tự duyệt từ ${aiThreshold}% tin cậy.`:'Mọi đăng ký gửi mới sẽ chuyển giáo viên duyệt.'}</p></div></div>
      <button class="btn btn-ghost" data-route-settings="1">Cài đặt AI</button>
    </section>
    <section class="teacher-dashboard-workspace">
      <div class="v850-panel teacher-priority-panel">
        ${sectionHeader({kicker:'ƯU TIÊN XỬ LÝ',title:'Cần giáo viên xử lý',subtitle:'Các đăng ký cần quyết định hoặc phản hồi trực tiếp.',action:pendingCount?`<span class="v850-count-badge">${pendingCount}</span>`:''})}
        <div class="teacher-priority-list">${pendingCount?pendingItems:emptyState({title:'Không còn đăng ký chờ xử lý',description:'Hàng đợi hiện tại đã được giải quyết.'})}</div>
        ${pendingCount>6?`<button class="btn btn-ghost btn-block" type="button" data-route-approvals="1">Xem toàn bộ ${pendingCount} đăng ký</button>`:''}
      </div>
      <div class="v850-panel teacher-week-panel">
        ${sectionHeader({kicker:'TUẦN HIỆN TẠI',title:'Tiến độ của lớp',subtitle:'Tỷ lệ hoàn thành hợp lệ trên toàn bộ lượt cần đăng ký.'})}
        <div class="teacher-week-score"><strong>${stats.rate??0}%</strong><span>hoàn thành hợp lệ</span></div>
        ${progressBar({value:stats.rate??0,label:`${stats.valid??0}/${stats.total??0} lượt hợp lệ`,tone:'success'})}
        <div class="teacher-week-meta">
          <span><small>Tuần</small><b>${weekInfo.number??''}</b></span>
          <span><small>Thời gian</small><b>${weekInfo.dateRange??''}</b></span>
          <span><small>Deadline</small><b>${weekInfo.deadline??''}</b></span>
          <span><small>Trạng thái</small><b>${weekInfo.status??''}</b></span>
        </div>
        <div class="teacher-week-buckets">
          <span class="success"><b>${stats.valid??0}</b> hợp lệ</span><span class="warning"><b>${stats.issues??0}</b> báo cáo lỗi</span><span class="danger"><b>${stats.missing??0}</b> chưa đăng ký</span>
        </div>
      </div>
    </section>`;
}

export function renderApprovalsWorkbench({headerHtml='',filters=[],activeFilter='attention',items=[],selectedId='',weekNumber='',aiWaiting=0,emergencyCount=0}={}){
  const selected=items.find(item=>item.id===selectedId)||items[0]||null;
  return `${headerHtml}
    <div class="approval-filter-bar-v850" role="tablist" aria-label="Lọc đăng ký">
      ${filters.map(f=>`<button type="button" class="approval-filter-chip ${activeFilter===f.id?'active':''}" data-approval-filter="${f.id}" role="tab" aria-selected="${activeFilter===f.id}">${f.label}<span>${f.count}</span></button>`).join('')}
    </div>
    ${aiWaiting?`<div class="v850-inline-notice warning"><span><b>${aiWaiting} đăng ký đang chờ AI.</b> Hệ thống sẽ tự chuyển GV nếu vượt quá thời gian chờ.</span></div>`:''}
    ${emergencyCount?`<div class="v850-inline-notice danger"><span><b>${emergencyCount} đăng ký bổ sung</b> trong tuần ${weekNumber}. Chúng vẫn xuất hiện trong hàng đợi theo trạng thái hiện tại.</span></div>`:''}
    ${items.length?`<section class="approval-workbench">
      <aside class="approval-queue v850-panel" aria-label="Danh sách đăng ký">
        <div class="approval-queue-head"><div><span class="v850-section-kicker">HÀNG ĐỢI</span><h2>${items.length} đăng ký</h2></div><span>Tuần ${weekNumber}</span></div>
        <div class="approval-queue-list">${items.map(item=>`<button type="button" class="approval-queue-item ${selected?.id===item.id?'active':''}" data-approval-select="${item.id}">
          <span class="approval-queue-avatar">${item.initials}</span><span class="approval-queue-copy"><b>${item.studentName}</b><small>${item.slotLabel}</small><em>${item.content}</em></span>${item.statusHtml}
        </button>`).join('')}</div>
      </aside>
      <article class="approval-detail v850-panel">
        ${selected?`<div class="approval-detail-head"><div><span class="v850-section-kicker">CHI TIẾT ĐĂNG KÝ</span><h2>${selected.studentName}</h2><p>${selected.studentCode} · ${selected.slotLabel}</p></div>${selected.statusHtml}</div>
          <div class="approval-detail-content"><span>Nội dung tự học</span><h3>${selected.content}</h3>${selected.note?`<p>${selected.note}</p>`:''}</div>
          ${selected.teacherComment?`<div class="approval-detail-feedback"><b>Nhận xét giáo viên</b><p>${selected.teacherComment}</p></div>`:''}
          ${selected.aiReason?`<div class="approval-detail-ai"><b>Phân tích AI</b><p>${selected.aiReason}</p>${selected.aiBadge||''}</div>`:''}
          ${selected.emergencyReason?`<div class="approval-detail-emergency"><b>Đăng ký bổ sung</b><p>${selected.emergencyReason}</p></div>`:''}
          <div class="approval-detail-actions">${selected.actionsHtml}</div>`:''}
      </article>
    </section>`:emptyState({title:'Không có đăng ký trong bộ lọc này',description:'Thử chọn một trạng thái khác hoặc chuyển sang tuần khác.'})}`;
}
