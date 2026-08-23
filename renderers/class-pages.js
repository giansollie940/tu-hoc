import { renderClassOverview, renderSessionDetails } from '../features/class-overview/class-overview.js';
import { emptyState, sectionHeader } from '../ui/page-kit.js';
export const renderClassTrackingPage=args=>renderClassOverview(args);
export const renderClassSessionDetails=args=>renderSessionDetails(args);

export function renderMissingRegistrationsPage({headerHtml='',groups=[]}={}){
  if(!groups.length)return `${headerHtml}${emptyState({title:'Cả lớp đã đăng ký đầy đủ',description:'Không còn lượt thiếu trong tuần đang xem.'})}`;
  return `${headerHtml}<section class="missing-session-groups">${groups.map(group=>`<article class="v850-panel missing-session-card"><header><div><span class="v850-section-kicker">BUỔI TỰ HỌC</span><h2>${group.label}</h2></div><span class="v850-count-badge">${group.students.length}</span></header><div class="missing-student-chips">${group.students.map(s=>`<span><b>${s.name}</b><small>${s.code}</small></span>`).join('')}</div></article>`).join('')}</section>`;
}

export function renderRevisionIssuesPage({headerHtml='',items=[]}={}){
  if(!items.length)return `${headerHtml}${emptyState({title:'Tuần này chưa có báo cáo lỗi',description:'Các đăng ký không chỉnh sửa kịp trước giờ học sẽ xuất hiện tại đây.'})}`;
  return `${headerHtml}<div class="v850-inline-notice warning"><span>Các mục dưới đây <b>không còn là yêu cầu chỉnh sửa</b>; hệ thống giữ lại để giáo viên và cán sự theo dõi.</span></div><section class="revision-issue-board">${items.map(item=>`<article class="v850-panel revision-issue-card"><div class="revision-issue-head"><div><span class="v850-section-kicker">${item.slotLabel}</span><h3>${item.studentName}</h3><small>${item.studentCode}</small></div>${item.statusHtml}</div><div class="revision-issue-content"><small>Nội dung đăng ký</small><b>${item.content}</b>${item.note?`<p>${item.note}</p>`:''}</div><div class="revision-issue-feedback"><small>Yêu cầu chỉnh sửa của GV</small><p>${item.teacherComment}</p></div><footer>Ghi nhận: ${item.reportedAt}</footer></article>`).join('')}</section>`;
}
