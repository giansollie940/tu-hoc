import { sectionHeader, metricCard, emptyState, progressBar } from '../ui/page-kit.js';

export function renderStudentsManagementPage({
  headerHtml='',users=[],filteredUsers=[],query='',role='all',status='active',counts={},
  escapeHtml=value=>String(value??''),iconFor=()=>'',initialsFor=()=>'',roleLabels={}
}={}){
  const rows=filteredUsers.map(u=>`<tr>
    <td><div class="code-cell"><b class="code-badge">${escapeHtml(u.code)}</b><button class="mini-icon-btn copy-code-btn" data-code="${escapeHtml(u.code)}" title="Sao chép mã đăng nhập" aria-label="Sao chép mã ${escapeHtml(u.code)}">${iconFor('copy')}</button></div></td>
    <td><div class="person"><span class="avatar">${initialsFor(u.name)}</span><div class="student-person-copy"><b>${escapeHtml(u.name)}</b><small>${u.role==='monitor'?'Cán sự lớp':'Học sinh'}</small></div></div></td>
    <td>${roleLabels[u.role]||escapeHtml(u.role)}</td>
    <td>${u.active?'<span class="status approved">Hoạt động</span>':'<span class="status missing">Đã xóa</span>'}</td>
    <td><div class="toolbar student-row-actions">
      ${u.active?`
        <button class="btn btn-ghost edit-user-btn" data-id="${u.id}">${iconFor('edit')}<span>Sửa</span></button>
        <button class="btn btn-ghost reset-password-btn" data-id="${u.id}">${iconFor('lock')}<span>Mật khẩu</span></button>
        <button class="btn btn-ghost danger delete-user-btn" data-id="${u.id}">${iconFor('delete')}<span>Xóa</span></button>
      `:`<button class="btn btn-ghost restore-user-btn" data-id="${u.id}">${iconFor('restore')}<span>Khôi phục</span></button>`}
    </div></td>
  </tr>`).join('');

  return `${headerHtml}<div class="student-management-v850">
    <section class="student-management-hero-v850">
      <div class="student-management-hero-copy">
        <span class="v850-section-kicker">TÀI KHOẢN LỚP HỌC</span>
        <h2>${counts.active||0} tài khoản đang hoạt động</h2>
        <p>Quản lý học sinh và cán sự theo một luồng thống nhất. Tài khoản bị xóa được vô hiệu hóa nhưng lịch sử học tập vẫn được giữ.</p>
        <div class="v850-inline-notice info">${iconFor('warning')}<span><b>Xóa mềm an toàn:</b> có thể chuyển sang bộ lọc “Đã xóa” để khôi phục tài khoản khi cần.</span></div>
      </div>
      <img src="assets/images/student-cards.png" alt="Minh họa quản lý học sinh">
    </section>

    <section class="student-management-summary">
      <div class="v850-metrics student-management-metrics">
        ${metricCard({label:'Học sinh',value:counts.student||0,icon:iconFor('user'),tone:'primary'})}
        ${metricCard({label:'Cán sự',value:counts.monitor||0,icon:iconFor('students'),tone:'primary'})}
        ${metricCard({label:'Hoạt động',value:counts.active||0,icon:iconFor('check'),tone:'success'})}
        ${metricCard({label:'Đã xóa',value:counts.deleted||0,icon:iconFor('delete'),tone:'danger'})}
      </div>
    </section>

    <section class="v850-panel student-directory-panel">
      ${sectionHeader({kicker:'DANH BẠ LỚP',title:'Học sinh và cán sự',subtitle:`Đang hiển thị ${filteredUsers.length}/${users.length} tài khoản.`,action:`<button class="btn btn-primary" id="addStudentBtn">${iconFor('add')}<span>Thêm học sinh</span></button>`})}
      <div class="students-toolbar students-toolbar-v850">
        <label class="search-box student-search-box"><span>${iconFor('search')}</span><input id="studentSearch" value="${escapeHtml(query)}" placeholder="Tìm theo mã hoặc họ tên" aria-label="Tìm học sinh"></label>
        <label class="filter-field"><span>Vai trò</span><select id="studentRoleFilter"><option value="all" ${role==='all'?'selected':''}>Tất cả</option><option value="student" ${role==='student'?'selected':''}>Học sinh</option><option value="monitor" ${role==='monitor'?'selected':''}>Cán sự lớp</option></select></label>
        <label class="filter-field"><span>Trạng thái</span><select id="studentStatusFilter"><option value="active" ${status==='active'?'selected':''}>Đang hoạt động</option><option value="deleted" ${status==='deleted'?'selected':''}>Đã xóa</option><option value="all" ${status==='all'?'selected':''}>Tất cả</option></select></label>
        <button class="btn btn-ghost" id="clearStudentFilters">Xóa lọc</button>
      </div>
      <div class="table-wrap student-table-wrap">
        ${filteredUsers.length?`<table class="data-table modern-data-table"><thead><tr><th>Mã đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>`:emptyState({title:'Không có tài khoản phù hợp',description:'Thử thay đổi từ khóa hoặc bộ lọc để xem các tài khoản khác.'})}
      </div>
    </section>
  </div>`;
}

export function renderStatisticsPage({headerHtml='',current={},rows=[],iconFor=()=>''}={}){
  return `${headerHtml}<div class="statistics-page-v850">
    <section class="statistics-kpi-grid v850-metrics">
      ${metricCard({label:'Đăng ký hợp lệ',value:current.valid||0,icon:iconFor('check'),tone:'success'})}
      ${metricCard({label:'Cần xử lý',value:current.issues||0,icon:iconFor('warning'),tone:'warning'})}
      ${metricCard({label:'Chưa đăng ký',value:current.missing||0,icon:iconFor('missing'),tone:'danger'})}
      ${metricCard({label:'Hoàn thành hợp lệ',value:`${current.rate||0}%`,icon:iconFor('stats'),tone:'primary'})}
    </section>
    <section class="v850-panel statistics-trend-panel">
      ${sectionHeader({kicker:'XU HƯỚNG 12 TUẦN',title:'Tỷ lệ hoàn thành theo tuần',subtitle:'So sánh nhanh đăng ký hợp lệ, trường hợp cần xử lý và số học sinh còn thiếu.',action:`<button id="exportCsv" class="btn btn-ghost">${iconFor('export')}<span>Xuất CSV tuần đang xem</span></button>`})}
      <div class="statistics-week-list">
        ${rows.length?rows.map(x=>`<article class="statistics-week-row">
          <div class="statistics-week-name"><b>Tuần ${x.w.number}</b><small>${x.valid} hợp lệ · ${x.issues} cần xử lý · ${x.missing} chưa đăng ký</small></div>
          <div class="statistics-week-progress">${progressBar({value:x.rate,tone:x.rate>=80?'success':x.rate>=50?'warning':'primary'})}</div>
          <strong>${x.rate}%</strong>
        </article>`).join(''):emptyState({title:'Chưa có dữ liệu thống kê',description:'Dữ liệu theo tuần sẽ xuất hiện khi lớp bắt đầu có lịch và đăng ký.'})}
      </div>
    </section>
  </div>`;
}
