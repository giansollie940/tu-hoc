import { sectionHeader, progressBar, emptyState } from '../ui/page-kit.js';

export function renderStudentDashboardPage({
  headerHtml='',bannerHtml='',viewingNext=false,weekNumber='',done=0,issueCount=0,total=0,pct=0,
  iconCheck='',iconWarning='',iconSchedule='',sessionCards='',hasSessions=true
}={}){
  const remaining=Math.max(total-done-issueCount,0);
  return `${headerHtml}${bannerHtml}
    ${viewingNext?`<div class="v850-inline-notice info"><b>Đã chuyển sang Tuần ${weekNumber}.</b><span>Các buổi còn lại của tuần trước đã bắt đầu hoặc đã qua nên hệ thống ưu tiên tuần có hành động tiếp theo.</span></div>`:''}
    <section class="v850-panel student-progress-panel">
      ${sectionHeader({kicker:'TIẾN ĐỘ CÁ NHÂN',title:'Hoàn thành kế hoạch tuần',subtitle:'Theo dõi các buổi đã hợp lệ và những mục đang cần chỉnh sửa.'})}
      <div class="student-progress-layout">
        <div class="student-progress-primary"><strong>${pct}%</strong><span>${done}/${total} tiết hợp lệ</span></div>
        <div class="student-progress-bar">${progressBar({value:pct,label:'Tiến độ tuần',tone:issueCount?'warning':'success'})}</div>
        <div class="student-progress-summary">
          <span>${iconCheck}<b>${done}</b><small>Đã hợp lệ</small></span>
          <span>${iconWarning}<b>${issueCount}</b><small>Cần chú ý</small></span>
          <span>${iconSchedule}<b>${remaining}</b><small>Còn lại</small></span>
        </div>
      </div>
      ${issueCount?`<div class="v850-inline-notice warning">${iconWarning}<span><b>${issueCount} tiết</b> đang ở Báo cáo lỗi và chưa tính vào tiến độ hợp lệ.</span></div>`:''}
    </section>
    <section class="student-sessions-section">
      ${sectionHeader({kicker:'LỊCH TỰ HỌC',title:'Các buổi trong tuần',subtitle:'Mỗi buổi là một thẻ riêng với trạng thái, deadline và hành động chính.'})}
      ${hasSessions?`<div class="student-session-grid">${sessionCards}</div>`:emptyState({title:'Tuần này chưa có tiết tự học',description:'Khi giáo viên cấu hình lịch, các buổi sẽ xuất hiện tại đây.'})}
    </section>`;
}

export function renderStudentHistoryPage({headerHtml='',rows=[]}={}){
  if(!rows.length)return `${headerHtml}${emptyState({title:'Chưa có lịch sử đăng ký',description:'Những lần đăng ký và thay đổi trạng thái trước đây sẽ xuất hiện tại đây.'})}`;
  return `${headerHtml}<section class="v850-panel student-history-panel">
    ${sectionHeader({kicker:'DÒNG THỜI GIAN',title:'Hoạt động đăng ký',subtitle:'Sắp xếp từ thay đổi gần nhất để dễ theo dõi.'})}
    <div class="student-history-timeline">${rows.map(row=>`<article class="history-event">
      <div class="history-dot" aria-hidden="true"></div>
      <div class="history-event-main">
        <div class="history-event-head"><div><span>${row.weekLabel}</span><b>${row.slotLabel}</b></div>${row.statusHtml}</div>
        <h3>${row.content}</h3>
        ${row.note?`<p>${row.note}</p>`:''}
        ${row.emergency?`<span class="history-tag emergency">Đăng ký bổ sung</span>`:''}
        ${row.comment?`<div class="history-comment"><b>Nhận xét giáo viên</b><span>${row.comment}</span></div>`:''}
      </div>
    </article>`).join('')}</div>
  </section>`;
}

export function renderStudentCommentsPage({headerHtml='',items=[]}={}){
  if(!items.length)return `${headerHtml}${emptyState({title:'Chưa có nhận xét nào',description:'Phản hồi của giáo viên về đăng ký tự học sẽ được lưu tại đây.'})}`;
  return `${headerHtml}<section class="student-comment-inbox">
    ${items.map(item=>`<article class="v850-panel student-comment-card">
      <div class="comment-card-meta"><span>${item.slotLabel}</span>${item.statusHtml||''}</div>
      <h3>${item.content}</h3>
      <div class="comment-message"><span class="comment-avatar" aria-hidden="true">GV</span><div><b>Nhận xét của giáo viên</b><p>${item.comment}</p></div></div>
    </article>`).join('')}
  </section>`;
}
