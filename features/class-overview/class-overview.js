function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function activeStudents(users) {
  return (users ?? []).filter(user =>
    user?.active !== false && ["student", "monitor"].includes(user?.role)
  );
}

function isVisibleRegistration(registration) {
  return Boolean(
    registration
    && !registration.isDeleted
    && ["submitted", "needs_revision", "approved"].includes(registration.status)
  );
}

function registrationBucket(registration) {
  if (!isVisibleRegistration(registration)) return "missing";
  if (registration.revisionOverdueAt) return "issue";
  return "valid";
}

function sessionRegistrations(session, registrations) {
  return (registrations ?? []).filter(registration =>
    registration?.dow === session.dow
    && Number(registration?.period) === Number(session.period)
    && isVisibleRegistration(registration)
  );
}

function summarizeSessionThreeWay({ registrations = [], activeStudentIds = [] } = {}) {
  const activeIds = new Set(activeStudentIds.map(String));
  const byStudent = new Map();

  for (const registration of registrations) {
    const studentId = String(registration?.studentId ?? "");
    if (!activeIds.has(studentId) || !isVisibleRegistration(registration)) continue;

    const bucket = registrationBucket(registration);
    const current = byStudent.get(studentId);

    // Ưu tiên issue nếu có dữ liệu bất thường; còn lại valid.
    if (!current || bucket === "issue") {
      byStudent.set(studentId, {
        bucket,
        usesElectronicDevice: registration.usesElectronicDevice === true
      });
    } else if (registration.usesElectronicDevice === true) {
      current.usesElectronicDevice = true;
    }
  }

  let validCount = 0;
  let issueCount = 0;
  let deviceCount = 0;

  for (const value of byStudent.values()) {
    if (value.bucket === "issue") issueCount++;
    else validCount++;
    if (value.usesElectronicDevice) deviceCount++;
  }

  const missingCount = Math.max(0, activeIds.size - validCount - issueCount);

  return {
    validCount,
    issueCount,
    missingCount,
    deviceCount,
    classifiedCount: validCount + issueCount + missingCount
  };
}

function effectiveStatus(registration) {
  return registration?.revisionOverdueAt ? "revision_overdue" : registration?.status;
}

function statusText(status) {
  return {
    approved: "Đã duyệt",
    submitted: "Chờ duyệt",
    needs_revision: "Cần chỉnh sửa",
    revision_overdue: "Báo cáo lỗi"
  }[status] ?? status;
}

export function renderClassOverview({
  week,
  sessions = [],
  users = [],
  registrations = []
} = {}) {
  const students = activeStudents(users);
  const cards = sessions.map(session => {
    const rows = sessionRegistrations(session, registrations);
    const summary = summarizeSessionThreeWay({
      registrations: rows,
      activeStudentIds: students.map(student => student.id)
    });
    const key = String(session.dow) + "-" + String(session.period);
    return [
      '<article class="session-summary-card">',
      '  <div class="session-summary-head">',
      "    <div>",
      '      <span class="session-eyebrow">Buổi tự học</span>',
      "      <h3>" + escapeHtml(session.label) + "</h3>",
      "    </div>",
      '    <span class="device-total-badge">' + summary.deviceCount + " dùng thiết bị</span>",
      "  </div>",
      '  <div class="session-summary-counts three-state-session-counts">',
      '    <span class="state-valid"><b>' + summary.validCount + "</b> hợp lệ</span>",
      '    <span class="state-issue"><b>' + summary.issueCount + "</b> báo cáo lỗi</span>",
      '    <span class="state-missing"><b>' + summary.missingCount + "</b> chưa đăng ký</span>",
      "  </div>",
      '  <button class="btn btn-primary btn-block" type="button" data-open-session="' + key + '">Xem nội dung</button>',
      "</article>"
    ].join("");
  }).join("");

  return [
    '<section class="class-overview-v830">',
    '  <div class="page-head class-overview-head">',
    "    <div><h1>Theo dõi cả lớp</h1><p>Tuần " + escapeHtml(week?.number ?? "") + " · " + students.length + " thành viên</p></div>",
    "  </div>",
    sessions.length
      ? (() => {
          const totalExpected = students.length * sessions.length;
          const allSessionRegs = sessions.flatMap(session => sessionRegistrations(session, registrations));
          const valid = allSessionRegs.filter(registration => registrationBucket(registration) === "valid").length;
          const issues = allSessionRegs.filter(registration => registrationBucket(registration) === "issue").length;
          const missing = Math.max(0, totalExpected - valid - issues);
          const rate = totalExpected ? Math.round(valid / totalExpected * 100) : 0;
          return [
            '<div class="class-three-state-summary">',
            '  <div class="class-state-card state-valid"><b>' + valid + '</b><span>Đăng ký hợp lệ</span></div>',
            '  <div class="class-state-card state-issue"><b>' + issues + '</b><span>Báo cáo lỗi</span></div>',
            '  <div class="class-state-card state-missing"><b>' + missing + '</b><span>Chưa đăng ký</span></div>',
            '  <div class="class-state-card"><b>' + rate + '%</b><span>Hoàn thành hợp lệ</span></div>',
            '</div>',
            '<div class="session-summary-grid">' + cards + '</div>'
          ].join("");
        })()
      : '<div class="empty"><b>Chưa cấu hình tiết tự học.</b></div>',
    "</section>"
  ].join("");
}

export function renderSessionDetails({
  session,
  users = [],
  registrations = [],
  role = "monitor",
  filter = "all"
} = {}) {
  const userById = new Map(activeStudents(users).map(user => [user.id, user]));
  let rows = sessionRegistrations(session, registrations)
    .filter(registration => userById.has(registration.studentId));

  if (filter === "device") {
    rows = rows.filter(registration => registration.usesElectronicDevice === true);
  } else if (filter === "no_device") {
    rows = rows.filter(registration => registration.usesElectronicDevice !== true);
  } else if (filter === "needs_action") {
    rows = rows.filter(registration =>
      !registration.revisionOverdueAt
      && ["submitted", "needs_revision"].includes(registration.status)
    );
  } else if (filter === "revision_overdue") {
    rows = rows.filter(registration => Boolean(registration.revisionOverdueAt));
  }

  const filterButtons = [
    ["all", "Tất cả"],
    ["device", "Dùng thiết bị"],
    ["no_device", "Không dùng thiết bị"],
    ["needs_action", "Cần xử lý"],
    ["revision_overdue", "Báo cáo lỗi"]
  ].map(([value, label]) =>
    '<button type="button" class="filter-chip' + (filter === value ? " active" : "") +
    '" data-session-filter="' + value + '">' + label + "</button>"
  ).join("");

  const body = rows.map(registration => {
    const student = userById.get(registration.studentId);
    const teacherActions = role === "teacher"
      ? [
          '<div class="session-detail-actions">',
          registration.revisionOverdueAt
            ? ""
            : (registration.status !== "approved"
                ? '<button class="btn btn-success approve-btn" data-id="' + escapeHtml(registration.id) + '">Duyệt</button>'
                : ""),
          registration.revisionOverdueAt
            ? ""
            : '<button class="btn btn-warning revise-btn" data-id="' + escapeHtml(registration.id) + '">Yêu cầu sửa</button>',
          '<button class="btn btn-ghost comment-btn" data-id="' + escapeHtml(registration.id) + '">Nhận xét</button>',
          '<button class="btn btn-danger delete-reg-btn" data-id="' + escapeHtml(registration.id) + '">Xóa</button>',
          "</div>"
        ].join("")
      : "";

    return [
      '<article class="session-detail-row">',
      '  <div class="person"><span class="avatar">' + escapeHtml((student?.name ?? "?").slice(0, 1)) + "</span>",
      "    <div><b>" + escapeHtml(student?.name ?? "Học sinh") + "</b><small>" + escapeHtml(student?.code ?? "") + "</small></div>",
      "  </div>",
      '  <div class="session-detail-content"><b>' + escapeHtml(registration.content) + "</b>",
      registration.note ? "<p>" + escapeHtml(registration.note) + "</p>" : "",
      "  </div>",
      '  <div class="session-detail-meta">',
      '    <span class="status ' + escapeHtml(effectiveStatus(registration)) + '">' + escapeHtml(statusText(effectiveStatus(registration))) + "</span>",
      registration.usesElectronicDevice
        ? '<span class="device-badge yes">Có dùng thiết bị</span>'
        : '<span class="device-badge no">Không dùng thiết bị</span>',
      "  </div>",
      teacherActions,
      "</article>"
    ].join("");
  }).join("");

  return [
    '<div class="session-detail-view" data-session-dow="' + escapeHtml(session?.dow) + '" data-session-period="' + escapeHtml(session?.period) + '">',
    '  <div class="session-filter-bar">' + filterButtons + "</div>",
    body || '<div class="empty"><b>Không có đăng ký phù hợp.</b></div>',
    "</div>"
  ].join("");
}
