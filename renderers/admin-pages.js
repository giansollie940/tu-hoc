import { sectionHeader, tabs, emptyState } from '../ui/page-kit.js';

export function renderAdminPageShell({headerHtml='',activeClasses=[],escapeHtml=v=>String(v??''),iconFor=()=>''}={}){
  return `${headerHtml}<div id="adminPageV850" class="admin-page-v850" data-admin-current-tab="overview">
    <div class="admin-page-tabs">${tabs([
      {id:'overview',label:'Tổng quan'},
      {id:'classes',label:'Lớp học'},
      {id:'teachers',label:'Giáo viên'},
      {id:'permissions',label:'Phân quyền'}
    ],'overview').replaceAll('data-tab=', 'data-admin-tab=')}</div>

    <div class="admin-overview-panel" data-admin-panel="overview">
      <section class="admin-command-hero dashboard-section">
        <div class="admin-command-copy">
          <span class="v850-section-kicker">ROOT ADMIN · TRUNG TÂM ĐIỀU PHỐI</span>
          <h2>Quản trị lớp, giáo viên và quyền truy cập từ một nơi</h2>
          <p>Mỗi nhiệm vụ quản trị có một khu vực riêng; dữ liệu học tập và tài khoản không bị trộn vào cùng một bảng dài.</p>
          <div id="adminSummaryCards" class="admin-summary-cards" aria-live="polite">
            <span><small>Lớp hoạt động</small><b>${activeClasses.length}</b></span>
            <span><small>Giáo viên</small><b>…</b></span>
            <span><small>Phân quyền</small><b>…</b></span>
          </div>
        </div>
        <div class="admin-command-art" aria-hidden="true"><img src="assets/images/teacher-dashboard-illustration.png" alt=""></div>
      </section>

      <section class="admin-quick-grid dashboard-section">
        <article class="v850-panel admin-quick-card">
          ${sectionHeader({kicker:'LỚP LÀM VIỆC',title:'Mở nhanh lớp',subtitle:'Chuyển sang lớp đang hoạt động để xem học sinh, lịch và đăng ký.',action:`<button class="btn btn-primary" type="button" data-admin-goto-tab="classes">${iconFor('class')}<span>Quản lý lớp</span></button>`})}
          <div class="admin-active-class-list">
            ${activeClasses.length?activeClasses.map(c=>`<button class="admin-active-class-chip admin-open-class" data-id="${c.id}"><span>${escapeHtml(c.code)}</span><small>${escapeHtml(c.name||c.code)}</small>${iconFor('right')}</button>`).join(''):emptyState({title:'Chưa có lớp đang hoạt động',description:'Tạo lớp mới để bắt đầu phân quyền giáo viên và quản lý dữ liệu.'})}
          </div>
        </article>
        <article class="v850-panel admin-safety-card">
          ${sectionHeader({kicker:'AN TOÀN DỮ LIỆU',title:'Các thao tác nhạy cảm có rào chắn',subtitle:'Quyền tài khoản được tách khỏi lịch sử học tập.'})}
          <ul class="admin-safety-list">
            <li>${iconFor('check')} Xóa giáo viên là <b>xóa mềm</b>; lịch sử vẫn được giữ.</li>
            <li>${iconFor('check')} Giáo viên bị khóa/xóa sẽ mất phân công đang hoạt động theo backend hiện có.</li>
            <li>${iconFor('lock')} Root admin không nằm trong luồng xóa giáo viên.</li>
          </ul>
        </article>
      </section>
    </div>

    <section class="v850-panel admin-directory-shell" data-admin-panel="directory">
      ${sectionHeader({kicker:'DANH MỤC QUẢN TRỊ',title:'Lớp học · Giáo viên · Phân quyền',subtitle:'Chọn tab phía trên để tập trung vào đúng nhóm thao tác.',action:`<div class="admin-directory-actions"><button class="btn btn-ghost" id="adminReloadClasses">${iconFor('refresh')}<span>Làm mới</span></button><button class="btn btn-ghost" id="adminCreateClass">${iconFor('add')}<span>Tạo lớp</span></button><button class="btn btn-primary" id="adminCreateTeacher">${iconFor('add')}<span>Tạo giáo viên</span></button></div>`})}
      <div id="adminClassDirectory"><div class="loading-inline"><span class="diamond-mini" aria-hidden="true"></span> Đang tải dữ liệu quản trị...</div></div>
    </section>
  </div>`;
}

export function renderSettingsPage({
  headerHtml='',className='',schoolYear='',deadlineTime='20:00',announcement='',threshold=90,revisionThreshold=85,memory={},memoryLast='',periods=[],
  aiEnabled=true,escapeHtml=v=>String(v??''),iconFor=()=>''
}={}){
  return `${headerHtml}<div id="settingsPageV850" class="settings-page-v850" data-settings-current-tab="general">
    <div class="settings-tabs">${tabs([
      {id:'general',label:'Chung & đăng ký'},
      {id:'ai',label:'AI duyệt'},
      {id:'owl',label:'Cú Thông Thái'}
    ],'general').replaceAll('data-tab=', 'data-settings-tab=')}</div>

    <form id="settingsForm" class="settings-form-v850">
      <section class="v850-panel settings-panel" data-settings-panel="general">
        ${sectionHeader({kicker:'THÔNG TIN LỚP',title:'Thiết lập chung',subtitle:'Các giá trị định danh được đồng bộ từ hệ thống; deadline và thông báo có thể chỉnh tại đây.'})}
        <div class="settings-general-grid">
          <label>Tên lớp<input id="setClass" value="${escapeHtml(className)}" readonly></label>
          <label>Năm học<input id="setYear" value="${escapeHtml(schoolYear)}" readonly></label>
          <label>Mốc deadline tự động<input id="registrationDeadlineTime" type="time" step="60" value="${escapeHtml(deadlineTime)}"><small>Áp dụng cho chế độ “tối hôm trước từng buổi”.</small></label>
          <label class="settings-wide">Thông báo tuần<textarea id="setAnnouncement">${escapeHtml(announcement)}</textarea></label>
        </div>
        <div class="settings-period-block">
          ${sectionHeader({kicker:'KHUNG GIỜ',title:'Tiết học chuẩn',subtitle:'Dùng chung cho lịch tự học và thời điểm bắt đầu từng buổi.'})}
          <div class="settings-period-grid">${periods.map(p=>`<span><b>Tiết ${p.n}</b><small>${escapeHtml(p.start)} – ${escapeHtml(p.end)}</small></span>`).join('')}</div>
        </div>
      </section>

      <section class="v850-panel settings-panel" data-settings-panel="ai">
        ${sectionHeader({kicker:'TỰ ĐỘNG HÓA',title:'Duyệt đăng ký bằng AI',subtitle:'Giữ nguyên luồng AI hiện có; trang này chỉ tổ chức lại cách hiển thị và cấu hình.'})}
        <label class="toggle-row settings-ai-toggle"><input id="smartApprovalEnabled" type="checkbox" ${aiEnabled?'checked':''}><span><b>Duyệt tự động bằng AI</b><span class="settings-ai-help"><small class="settings-ai-help-line"><strong>Bật:</strong> Groq kiểm tra đăng ký mới/gửi lại và học từ phản hồi GV.</small><small class="settings-ai-help-line"><strong>Tắt:</strong> Mọi đăng ký chuyển GV duyệt.</small></span></span></label>
        <div class="ai-settings-card settings-ai-card">
          <div class="ai-threshold-row"><span><b>Ngưỡng AI được tự duyệt</b><br><small>AI dưới ngưỡng này luôn chuyển GV.</small></span><span id="aiThresholdValue" class="ai-threshold-value">${threshold}%</span><input id="aiAutoApproveThreshold" type="range" min="80" max="99" step="1" value="${threshold}"></div>
          <div class="settings-ai-explainer"><b>Luồng AI-only</b><p>Đăng ký mới dùng ngưỡng <b>${threshold}%</b>. Khi học sinh sửa theo phản hồi GV, AI chỉ tự hành động khi độ chắc chắn đạt <b>${revisionThreshold}%</b>; trường hợp không chắc chuyển giáo viên.</p></div>
          <div class="settings-memory-grid">
            <span><small>Phản hồi đã ghi nhận</small><b>${Number(memory.totalFeedback||0)}</b></span>
            <span><small>AI duyệt → GV yêu cầu sửa</small><b>${Number(memory.revisionAfterAiApprove||0)}</b></span>
            <span><small>AI chuyển GV → GV duyệt</small><b>${Number(memory.approveAfterAiManual||0)}</b></span>
            <span><small>AI yêu cầu sửa → GV duyệt</small><b>${Number(memory.approveAfterAiRevision||0)}</b></span>
          </div>
          <p class="tiny muted">Cập nhật gần nhất: ${escapeHtml(memoryLast)} · mỗi lần duyệt chọn tối đa ${Number(memory.selectedLimit||25)} ví dụ từ tối đa ${Number(memory.candidateLimit||80)} phản hồi ứng viên.</p>
        </div>
      </section>

      <section class="v850-panel settings-panel settings-owl-panel" data-settings-panel="owl">
        ${sectionHeader({kicker:'TRỢ LÝ TRONG APP',title:'Cú Thông Thái',subtitle:'Mascot đọc ngữ cảnh trang/lớp/tuần, ưu tiên cảnh báo và luân phiên danh ngôn khi người dùng tương tác.'})}
        <div class="settings-owl-layout">
          <div class="settings-owl-copy">
            <div class="settings-feature-list">
              <span>${iconFor('check')} Mắt chuyển động nhẹ và đầu nghiêng theo con trỏ.</span>
              <span>${iconFor('check')} Dữ liệu trang hiện tại được ưu tiên trước nội dung chung.</span>
              <span>${iconFor('check')} Danh ngôn hôm nay ổn định theo ngày; các câu của Cú được luân phiên để tránh lặp.</span>
            </div>
          </div>
          <div class="settings-owl-art" aria-hidden="true"><img src="assets/images/teacher-dashboard-illustration.png" alt=""></div>
        </div>
      </section>

      <div class="settings-save-bar"><span>Mọi thay đổi chỉ được lưu khi bấm nút bên cạnh.</span><button class="btn btn-primary" type="submit">${iconFor('save')}<span>Lưu cài đặt</span></button></div>
    </form>
  </div>`;
}
