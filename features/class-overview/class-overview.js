import { isCountedRegistration } from "../registration/registration-domain.js";
import { summarizeSession } from "./class-summary.js";

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

function sessionRegistrations(session, registrations) {
  return (registrations ?? []).filter(registration =>
    registration?.dow === session.dow
    && Number(registration?.period) === Number(session.period)
    && isCountedRegistration(registration)
  );
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
    const summary = summarizeSession({
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
      '  <div class="session-summary-counts">',
      '    <span><b>' + summary.registeredCount + "</b> đã đăng ký</span>",
      '    <span><b>' + summary.missingCount + "</b> chưa đăng ký</span>",
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
      ? '<div class="session-summary-grid">' + cards + "</div>"
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
