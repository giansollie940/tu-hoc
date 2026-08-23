import { sectionHeader } from '../ui/page-kit.js';

export function renderSchedulePage({headerHtml='',days=[],periods=[],activeKeys=new Set(),weekNumber=''}={}){
  return `${headerHtml}<section class="v850-panel timetable-panel">
    ${sectionHeader({kicker:'THỜI KHÓA BIỂU',title:'Lịch tự học trong tuần',subtitle:'Bấm vào ô để bật hoặc tắt tiết tự học. Thay đổi được lưu bằng nút Lưu TKB.'})}
    <div class="timetable-note">Mỗi tiết 40 phút · Học Thứ 2–Thứ 6 · Nghỉ trưa 11:30–13:15.</div>
    <div class="weekly-timetable-scroll"><div class="weekly-timetable-grid" style="--day-count:${days.length}">
      <div class="timetable-corner">Tiết</div>${days.map(day=>`<div class="timetable-day-head">${day}</div>`).join('')}
      ${periods.map(period=>`<div class="timetable-period"><b>Tiết ${period.n}</b><span>${period.start}–${period.end}</span></div>${days.map((_,dow)=>{const key=`${dow}-${period.n}`;const active=activeKeys.has(key);return `<button type="button" class="slot-btn timetable-slot ${active?'active':''}" data-slot="${key}" aria-pressed="${active}" aria-label="${days[dow]} tiết ${period.n}"><span class="timetable-slot-dot"></span><small>${active?'Có tự học':'Không học'}</small></button>`;}).join('')}`).join('')}
    </div></div>
    <div class="timetable-legend"><span><i class="on"></i>Có tự học</span><span><i></i>Không học</span><span>Áp dụng cho Tuần ${weekNumber} khi chọn chế độ riêng tuần.</span></div>
  </section>`;
}

export function renderWeeksPage({headerHtml='',firstWeek=null,weeks=[],registrationDeadline='20:00',isAdmin=false}={}){
  const rows=weeks.map(item=>`<article class="week-accordion-card ${item.isCurrent?'is-current':''} ${item.open?'is-open':''}" data-week-id="${item.id}">
    <button type="button" class="week-accordion-toggle" data-week-toggle="${item.id}" aria-expanded="${item.open}">
      <span class="week-accordion-number">Tuần ${item.number}</span>
      <span class="week-accordion-date">${item.dateRange}</span>
      <span class="week-accordion-status">${item.statusHtml}</span>
      <span class="week-accordion-chevron" aria-hidden="true">⌄</span>
    </button>
    <div class="week-accordion-body">
      <div class="week-config-grid">
        <div class="week-config-block"><span class="v850-section-kicker">TRẠNG THÁI</span><label class="week-holiday-toggle"><input class="week-holiday" type="checkbox" data-id="${item.id}" ${item.holiday?'checked':''}><span>Đánh dấu tuần nghỉ</span></label><small>${item.autoStatus}</small></div>
        <div class="week-config-block deadline-choice"><span class="v850-section-kicker">HẠN ĐĂNG KÝ</span><select class="week-deadline-mode" data-id="${item.id}" aria-label="Chế độ deadline tuần ${item.number}"><option value="per_session_20" ${item.mode==='per_session_20'?'selected':''}>Mặc định · ${registrationDeadline} tối hôm trước từng buổi</option><option value="specific" ${item.mode==='specific'?'selected':''}>Hạn cụ thể của tuần</option></select><input class="week-deadline" data-id="${item.id}" type="datetime-local" value="${item.deadline}" ${item.mode==='specific'?'':'disabled'}><small class="deadline-preview">${item.deadlineSummary}</small></div>
        <div class="week-config-block week-quick-actions"><span class="v850-section-kicker">THAO TÁC</span><button class="btn btn-ghost view-week" data-id="${item.id}" type="button">Xem tuần này</button><small>${item.isCurrent?'Đây là tuần đang được hiển thị trên thanh điều hướng.':'Chuyển toàn bộ trang sang dữ liệu của tuần này.'}</small></div>
      </div>
    </div>
  </article>`).join('');
  return `${headerHtml}<section class="v850-panel week-calendar-panel">
    ${sectionHeader({kicker:'MỐC NĂM HỌC',title:'Thiết lập Tuần 1',subtitle:`Trạng thái mở/khóa được tính tự động. Hạn mặc định hiện tại: ${registrationDeadline} tối hôm trước từng buổi.`})}
    <div class="week-calendar-controls"><label>Ngày bắt đầu Tuần 1<input id="week1Start" type="date" value="${firstWeek?.startDate||''}"><small>Phải là ngày Thứ Hai.</small></label><div class="week-calendar-summary"><small>Tuần 1 hiện tại</small><b>${firstWeek?.dateRange||'Chưa thiết lập'}</b></div>${isAdmin?`<button class="btn btn-primary" id="applyWeekCalendar" type="button">Áp dụng mốc tuần</button>`:`<div class="v850-inline-notice info">Mốc Tuần 1 do quản trị viên thiết lập.</div>`}</div>
  </section>
  <div class="week-accordion-toolbar"><div><span class="v850-section-kicker">CẤU HÌNH TỪNG TUẦN</span><b>${weeks.length} tuần</b></div><div><button class="btn btn-ghost" id="expandAllWeeks" type="button">Mở tất cả</button><button class="btn btn-ghost" id="collapseAllWeeks" type="button">Thu gọn tất cả</button></div></div>
  <section class="week-accordion-list">${rows}</section>`;
}
