import { renderNavigation } from "./renderers/shell.js";
import { renderStudentDashboardPage, renderStudentHistoryPage, renderStudentCommentsPage } from "./renderers/student-pages.js";
import { renderTeacherDashboardPage, renderApprovalsWorkbench } from "./renderers/teacher-pages.js";
import { renderSchedulePage, renderWeeksPage } from "./renderers/planning-pages.js";
import { renderStudentsManagementPage, renderStatisticsPage } from "./renderers/management-pages.js";
import { renderAdminPageShell, renderSettingsPage } from "./renderers/admin-pages.js";
import { renderDeviceChoice } from "./features/registration/registration-form.js";
import {
  renderPasswordDialog,
  renderPasswordField
} from "./features/account/password-dialog.js";
import { validateStudentPassword } from "./features/account/password-policy.js";
import {
  renderClassTrackingPage,
  renderClassSessionDetails,
  renderMissingRegistrationsPage,
  renderRevisionIssuesPage as renderRevisionIssuesPageV850
} from "./renderers/class-pages.js";
import { initOwlPet } from "./ui/owl-pet.js?v=8.5.3";
import { createQuoteRotator } from "./ui/quote-rotation.js?v=8.5.3";
import { getWeekLifecycle } from "./features/weeks/week-lifecycle.js?v=8.5.3";
import { friendlyAppError } from "./utils/error-map.js";

(async () => {
  const prod = window.SupabaseService;
  let state = null;
  let currentUser = null;
  let realtimeStop=null;
  let realtimeQueue=[];
  let realtimeFlushTimer=null;
  let realtimeStructuralRefresh=false;
  let realtimeSubscribed=false;
  let lastRealtimeActivity=0;
  let aiRecoveryTimer=null;
  let aiRecoveryRunning=false;
  const aiRecoveryAttemptedAt=new Map();
  let route="dashboard";
  const SIDEBAR_COLLAPSED_KEY="so-tu-hoc:sidebar-collapsed:v1";
  let owlRouteTimer=null;
  let approvalFilter="attention";
  let approvalSelectedId="";
  let weekSelectionTouched=false;
  let weekLifecycleTimer=null;
  const ADMIN_DIRECTORY_CACHE_MS=3*60*1000;

  const $ = s => document.querySelector(s);
  const content=$("#content"), loginView=$("#loginView"), appView=$("#appView");
  const modal=$("#modal"), modalBody=$("#modalBody"), modalTitle=$("#modalTitle");
  const owlMotionController=initOwlPet(document);
  const ThemePreference=window.ThemePreference;

  function syncThemeControls(){
    const dark=document.documentElement.dataset.theme==="dark";
    const label=dark?"Chuyển sang giao diện sáng":"Chuyển sang giao diện tối";
    [$("#loginThemeToggle"),$("#themeToggle")].forEach(button=>{
      if(!button)return;
      button.setAttribute("aria-label",label);
      button.setAttribute("title",label);
      button.setAttribute("aria-pressed",String(dark));
    });
  }

  function bindThemeControls(){
    [$("#loginThemeToggle"),$("#themeToggle")].forEach(button=>{
      if(!button)return;
      button.addEventListener("click",()=>ThemePreference?.toggle?.());
    });
    window.addEventListener("themechange",syncThemeControls);
    syncThemeControls();
  }

  bindThemeControls();

  function sanitizeTemplateHtml(html){
    const template=document.createElement("template");
    template.innerHTML=String(html??"");

    template.content
      .querySelectorAll("script,iframe,object,embed,base,meta,link")
      .forEach(node=>node.remove());

    template.content.querySelectorAll("*").forEach(node=>{
      [...node.attributes].forEach(attribute=>{
        const name=attribute.name.toLowerCase();
        const value=attribute.value.trim();

        if(name.startsWith("on")||name==="srcdoc"){
          node.removeAttribute(attribute.name);
          return;
        }

        if(
          ["href","src","xlink:href","formaction"].includes(name)
          && /^(?:javascript|vbscript|data:text\/html)/i.test(value)
        ){
          node.removeAttribute(attribute.name);
        }
      });
    });

    return template.innerHTML;
  }

  function setSafeHtml(target,html){
    if(target)target.innerHTML=sanitizeTemplateHtml(html);
  }

  const safeErrorMessage=(error,fallback)=>{
    const mapped=friendlyAppError(error);
    return mapped.code==="UNKNOWN"?fallback:mapped.message;
  };

  const isManager=(user=currentUser)=>["teacher","admin"].includes(user?.role);

  function setGlobalLoading(active,text="Đang tải dữ liệu..."){
    const overlay=$("#globalLoading"),label=$("#globalLoadingText"),loginCard=document.querySelector(".login-card"),loginBtn=$("#loginSubmitBtn");
    if(label)label.textContent=text;
    overlay?.classList.toggle("hidden",!active);
    loginCard?.classList.toggle("is-loading",active&&loginView&&!loginView.classList.contains("hidden"));
    if(loginBtn)loginBtn.disabled=!!active;
  }

  function isAiAutomationEnabled(settings=state?.settings){
    return settings?.aiAutomationEnabled!==false;
  }

  document.addEventListener("click",event=>{
    const toggle=event.target.closest?.(".password-toggle");
    if(!toggle)return;
    const targetId=toggle.dataset.passwordTarget;
    const input=targetId?document.getElementById(targetId):null;
    if(!input)return;

    const showing=input.type==="text";
    input.type=showing?"password":"text";
    toggle.setAttribute("aria-pressed",String(!showing));
    toggle.setAttribute("aria-label",showing?"Hiện mật khẩu":"Ẩn mật khẩu");
    toggle.classList.toggle("is-visible",!showing);
  });

  const roleLabel={student:"Học sinh",monitor:"Cán sự lớp",teacher:"Giáo viên",admin:"Quản trị viên"};
  const statusLabel={approved:"Đã duyệt",submitted:"Chờ duyệt",needs_revision:"Cần chỉnh sửa",revision_overdue:"Báo cáo lỗi",draft:"Bản nháp",missing:"Chưa đăng ký"};
  const DOW=["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6"];
  const navs={
    student:[
      ["dashboard","🌟","Trang chủ"],["register","🪄","Đăng ký tự học"],["history","📚","Lịch sử của tôi"],["comments","💎","Nhận xét của GV"]
    ],
    monitor:[
      ["dashboard","🌈","Tổng quan"],["register","✨","Đăng ký của tôi"],["class","🫶","Theo dõi cả lớp"],
      ["missing","🚨","Danh sách thiếu"],["issues","⚠️","Báo cáo lỗi"],["history","📚","Lịch sử của tôi"],["comments","💎","Nhận xét của GV"]
    ],
    teacher:[
      ["dashboard","🌠","Dashboard"],["approvals","🪄","Duyệt đăng ký"],["issues","⚠️","Báo cáo lỗi"],["class","🫶","Theo dõi cả lớp"],["schedule","🗓️","TKB tự học"],
      ["weeks","📆","Quản lý tuần"],["students","🧑‍🎓","Quản lý học sinh"],["stats","📈","Thống kê"],["settings","🦄","Cài đặt"]
    ],
    admin:[
      ["dashboard","🌠","Dashboard"],["admin","🛡️","Quản trị lớp"],["students","🧑‍🎓","Tài khoản lớp"],["class","🫶","Theo dõi cả lớp"],
      ["approvals","🪄","Duyệt đăng ký"],["schedule","🗓️","TKB tự học"],["weeks","📆","Quản lý tuần"],["stats","📈","Thống kê"],["settings","🦄","Cài đặt lớp"]
    ]
  };


  const uiIcons={
    dashboard:`<svg viewBox="0 0 24 24" fill="none"><path d="M4 13.2 12 5l8 8.2V20a1 1 0 0 1-1 1h-4.8v-5.3H9.8V21H5a1 1 0 0 1-1-1v-6.8Z" stroke-width="2" stroke-linejoin="round"/></svg>`,
    approvals:`<svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8l4 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke-width="2" stroke-linejoin="round"/><path d="M9 13.5l2 2 4-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    issues:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 21 20H3L12 3Z" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v5M12 17.5v.1" stroke-width="2" stroke-linecap="round"/></svg>`,
    class:`<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="9" r="2.8" stroke-width="2"/><circle cx="16.5" cy="8" r="2.2" stroke-width="2"/><path d="M4.5 18c.9-2.6 3.2-4.2 5.8-4.2s4.9 1.6 5.8 4.2" stroke-width="2" stroke-linecap="round"/><path d="M14.7 17.6c.6-1.8 2.1-2.9 4-2.9 1.1 0 2.1.4 2.8 1.1" stroke-width="2" stroke-linecap="round"/></svg>`,
    schedule:`<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="15" rx="3" stroke-width="2"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17M7 13h4M13 13h4M7 17h4" stroke-width="2" stroke-linecap="round"/></svg>`,
    weeks:`<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="15" rx="3" stroke-width="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M13 14h3M8 17.5h8" stroke-width="2" stroke-linecap="round"/></svg>`,
    students:`<svg viewBox="0 0 24 24" fill="none"><path d="M3.5 8 12 4l8.5 4-8.5 4-8.5-4Z" stroke-width="2" stroke-linejoin="round"/><path d="M6.5 10.8V15c0 1.9 2.5 3.5 5.5 3.5s5.5-1.6 5.5-3.5v-4.2" stroke-width="2" stroke-linejoin="round"/><path d="M20.5 8v5" stroke-width="2" stroke-linecap="round"/></svg>`,
    stats:`<svg viewBox="0 0 24 24" fill="none"><path d="M5 19V11M12 19V6M19 19v-8" stroke-width="2" stroke-linecap="round"/><path d="M4 19h16" stroke-width="2" stroke-linecap="round"/></svg>`,
    settings:`<svg viewBox="0 0 24 24" fill="none"><path d="M10 4h4M6 12h12M8.5 20h7" stroke-width="2" stroke-linecap="round"/><circle cx="15.5" cy="4" r="2.5" stroke-width="2"/><circle cx="8.5" cy="12" r="2.5" stroke-width="2"/><circle cx="13.5" cy="20" r="2.5" stroke-width="2"/></svg>`,
    register:`<svg viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="12" height="16" rx="3" stroke-width="2"/><path d="M9 8.5h6M9 12.5h6M9 16.5h4" stroke-width="2" stroke-linecap="round"/></svg>`,
    history:`<svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 1 0 2.3-5.7" stroke-width="2" stroke-linecap="round"/><path d="M4 4v5h5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8v4l3 2" stroke-width="2" stroke-linecap="round"/></svg>`,
    comments:`<svg viewBox="0 0 24 24" fill="none"><path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" stroke-width="2" stroke-linejoin="round"/><path d="M8.5 11.2h7M8.5 14.2h4.5" stroke-width="2" stroke-linecap="round"/></svg>`,
    missing:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 4 3.5 19h17L12 4Z" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v4.5M12 17h.01" stroke-width="2" stroke-linecap="round"/></svg>`,
    add:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/></svg>`,
    edit:`<svg viewBox="0 0 24 24" fill="none"><path d="m4 20 4.7-.9 8.4-8.4a2.1 2.1 0 1 0-3-3l-8.4 8.4L4 20Z" stroke-width="2" stroke-linejoin="round"/><path d="m13.2 6.8 4 4" stroke-width="2" stroke-linecap="round"/></svg>`,
    lock:`<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2.5" stroke-width="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3" stroke-width="2" stroke-linecap="round"/></svg>`,
    delete:`<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    search:`<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6" stroke-width="2"/><path d="m20 20-4.2-4.2" stroke-width="2" stroke-linecap="round"/></svg>`,
    filter:`<svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h10M10 18h4" stroke-width="2" stroke-linecap="round"/></svg>`,
    copy:`<svg viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="10" height="12" rx="2" stroke-width="2"/><path d="M6 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1" stroke-width="2" stroke-linecap="round"/></svg>`,
    user:`<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke-width="2"/><path d="M5 19c1.2-2.9 4-4.7 7-4.7s5.8 1.8 7 4.7" stroke-width="2" stroke-linecap="round"/></svg>`,
    save:`<svg viewBox="0 0 24 24" fill="none"><path d="M5 4h12l2 2v14H5V4Z" stroke-width="2" stroke-linejoin="round"/><path d="M8 4v6h8V4M8 20v-6h8v6" stroke-width="2" stroke-linejoin="round"/></svg>`,
    close:`<svg viewBox="0 0 24 24" fill="none"><path d="m7 7 10 10M17 7 7 17" stroke-width="2" stroke-linecap="round"/></svg>`,
    refresh:`<svg viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2.34-5.66" stroke-width="2" stroke-linecap="round"/><path d="M20 4v5h-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    export:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v11M8 11l4 4 4-4M5 19h14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    restore:`<svg viewBox="0 0 24 24" fill="none"><path d="M5 8a8 8 0 1 1-.5 7" stroke-width="2" stroke-linecap="round"/><path d="M5 4v4h4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    login:`<svg viewBox="0 0 24 24" fill="none"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" stroke-width="2" stroke-linecap="round"/><path d="M13 8l4 4-4 4M8 12h9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    check:`<svg viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.2 4.2L19 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    warning:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 4 3.5 19h17L12 4Z" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v4M12 16.5h.01" stroke-width="2" stroke-linecap="round"/></svg>`,
    comment:`<svg viewBox="0 0 24 24" fill="none"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke-width="2" stroke-linejoin="round"/></svg>`,
    key:`<svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="12" r="4" stroke-width="2"/><path d="M12 12h8M17 12v3M20 12v2" stroke-width="2" stroke-linecap="round"/></svg>`,
    today:`<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="15" rx="3" stroke-width="2"/><path d="M8 3v4M16 3v4M4 10h16" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="15" r="2" stroke-width="2"/></svg>`,
    send:`<svg viewBox="0 0 24 24" fill="none"><path d="m4 5 16 7-16 7 3-7-3-7Z" stroke-width="2" stroke-linejoin="round"/><path d="M7 12h8" stroke-width="2" stroke-linecap="round"/></svg>`,
    right:`<svg viewBox="0 0 24 24" fill="none"><path d="m9 5 7 7-7 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    open:`<svg viewBox="0 0 24 24" fill="none"><path d="M5 19 19 5M11 5h8v8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    shield:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z" stroke-width="2" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };

  function uiIcon(name, extraClass=""){
    const svg=uiIcons[name]||uiIcons.dashboard;
    return `<span class="ui-icon ${extraClass||""}" aria-hidden="true">${svg}</span>`;
  }

  function actionIconFor(button){
    const hint=[button.dataset.uiIcon,button.id,button.className,button.textContent]
      .filter(Boolean).join(" ").toLowerCase();
    const rules=[
      ["restore",/khôi phục|restore/],
      ["delete",/xóa|delete|remove/],
      ["save",/lưu|save/],
      ["close",/hủy|đóng|cancel|close/],
      ["refresh",/làm mới|đồng bộ|refresh|sync/],
      ["export",/xuất|export|csv/],
      ["login",/đăng nhập|login/],
      ["add",/thêm|tạo lớp|tạo gv|tạo tài khoản|add|create/],
      ["edit",/sửa|chỉnh|edit|yêu cầu sửa/],
      ["key",/mật khẩu|password/],
      ["check",/duyệt|hoàn tất|đã lưu|xác nhận/],
      ["comment",/nhận xét|bình luận|comment/],
      ["warning",/báo lỗi|bổ sung|chưa đúng|warning/],
      ["today",/hôm nay|tuần theo ngày/],
      ["open",/xem|chi tiết|mở tuần|mở lớp/],
      ["copy",/sao chép|copy/],
      ["filter",/xóa lọc|lọc|filter/],
      ["send",/gửi|send/]
    ];
    return rules.find(([,pattern])=>pattern.test(hint))?.[0]||"";
  }

  function stripLeadingPictograph(button){
    const node=[...button.childNodes].find(item=>item.nodeType===Node.TEXT_NODE&&item.textContent.trim());
    if(!node)return;
    node.textContent=node.textContent.replace(/^\s*(?:[✓＋⬇]|[\p{Extended_Pictographic}\uFE0F\u200D])+\s*/u,"");
  }

  function decorateActionButtons(root){
    if(!root)return;
    root.querySelectorAll("button.btn,button.mini-icon-btn").forEach(button=>{
      if(button.closest(".password-field")||button.classList.contains("password-toggle"))return;
      stripLeadingPictograph(button);
      const iconName=actionIconFor(button);
      if(!iconName)return;
      if(!button.querySelector(":scope > .ui-icon")){
        button.insertAdjacentHTML("afterbegin",uiIcon(iconName,"action-icon"));
      }
      const toneByIcon={
        copy:"info",open:"info",comment:"info",
        edit:"warning",warning:"warning",
        restore:"success",check:"success",
        delete:"danger",
        key:"violet",export:"teal",refresh:"teal"
      };
      const tone=toneByIcon[iconName];
      if(tone&&(button.classList.contains("btn-ghost")||button.classList.contains("mini-icon-btn"))){
        button.classList.add(`btn-tone-${tone}`);
      }
      button.classList.add("btn-iconized");
    });
  }

  function navIconFor(route){
    const map={
      dashboard:"dashboard",
      approvals:"approvals",
      class:"class",
      schedule:"schedule",
      weeks:"weeks",
      students:"students",
      stats:"stats",
      settings:"settings",
      register:"register",
      history:"history",
      comments:"comments",
      missing:"missing",
      admin:"shield"
    };
    return uiIcon(map[route]||"dashboard",`nav-icon nav-icon--${route}`);
  }

  function kpiClayIcon(symbol){
    const map={
      "👥":"class",
      "✨":"approvals",
      "⌛":"history",
      "🔔":"comments",
      "📈":"stats",
      "✅":"approvals",
      "⚠️":"missing"
    };
    return uiIcon(map[symbol]||"dashboard","clay-kpi-icon");
  }

  const OWL_QUOTE_SOURCE="https://www.tudiendanhngon.vn/danhngon/ds/strcats/180";
  const OWL_QUOTES=[
    {text:"Hãy xây dựng niềm đam mê học tập. Nếu bạn làm được, bạn sẽ không ngừng tiến bộ.",author:"Anthony J. D'Angelo"},
    {text:"Tôi học được rằng chìa khóa dẫn đến sự khôn ngoan là khiêm tốn, bởi vì đó là trạng thái cho phép bạn có thể học hỏi và thay đổi.",author:"Joseph K. Chan"},
    {text:"Một số người học hỏi nhanh hơn người khác đôi chút. Học nhanh thì tốt, nhưng học từ tốn cũng hay.",author:"James Agee"},
    {text:"Học từ ngày hôm qua, sống ngày hôm nay, hi vọng cho ngày mai. Điều quan trọng nhất là không ngừng đặt câu hỏi.",author:"Albert Einstein"},
    {text:"Chuyến phiêu lưu của đời là học hỏi. Mục đích của đời là trưởng thành.",author:"William Arthur Ward"},
    {text:"Hãy học khi người khác ngủ; lao động khi người khác lười nhác; chuẩn bị khi người khác chơi bời; và có giấc mơ khi người khác chỉ ao ước.",author:"William Arthur Ward"},
    {text:"Kẻ ngu dốt có học ngu dốt hơn người vô học nhiều.",author:"Benjamin Franklin"},
    {text:"Trong cách học, phải lấy tự học làm cốt.",author:"Hồ Chí Minh"},
    {text:"Đầu tư vào tri thức đem lại lợi nhuận cao nhất.",author:"Benjamin Franklin"},
    {text:"Nếu ta không gieo trồng tri thức khi còn trẻ, nó sẽ không cho ta bóng râm khi ta về già.",author:"Lãnh chúa Chesterfield"},
    {text:"Sự tò mò là ngọn bấc trong cây nến học hỏi.",author:"William Arthur Ward"},
    {text:"Lạc thú lớn nhất trong mọi lạc thú là học hỏi.",author:"Aristotle"},
    {text:"Tất cả chúng ta đều là người mới học. Chỉ có người chết mới không còn gì để học.",author:"Khuyết danh"},
    {text:"Qua tìm kiếm và vấp váp mà chúng ta học hỏi.",author:"Johann Wolfgang von Goethe"},
    {text:"Không phải là tri thức, mà chính sự học mới đem lại niềm vui lớn nhất.",author:"Carl Friedrich Gauss"},
    {text:"Ngọc không mài dũa thì không thể trở thành khí dụng; người ta không học thì không hiểu được lẽ phải.",author:"Tam Tự Kinh"},
    {text:"Học hỏi trong tuổi trẻ sẽ đánh đuổi cái không tốt của tuổi già.",author:"Leonardo da Vinci"},
    {text:"Thật sai lầm khi nghĩ rằng một khi rời khỏi trường học, bạn không bao giờ cần học thêm điều mới nữa.",author:"Sophia Loren"}
  ];
  const owlQuoteRotator=createQuoteRotator(OWL_QUOTES,{recentLimit:4});
  const OWL_DAILY_QUOTE_CACHE_KEY="so-tu-hoc:owl-daily-quote:v1";
  const OWL_QUOTE_RETRY_MS=15*60*1000;
  let owlReady=false, owlHideTimer=null, owlMessageCursor=0, owlLastUrgentCount=-1, owlLastContextKey="", owlJustGreetedUntil=0;
  let owlDailyQuote=null, owlDailyQuoteDate="", owlDailyQuotePromise=null, owlDailyQuoteLastAttempt=0;

  function owlToday(){
    try{
      return prod?.dateISOInTimeZone?.(new Date())||new Date().toISOString().slice(0,10);
    }catch{
      return new Date().toISOString().slice(0,10);
    }
  }

  function localDailyOwlFallback(dateKey=owlToday()){
    let hash=2166136261;
    for(const char of String(dateKey||"")){
      hash^=char.charCodeAt(0);
      hash=Math.imul(hash,16777619);
    }
    const q=OWL_QUOTES[(hash>>>0)%OWL_QUOTES.length]||OWL_QUOTES[0];
    return {
      ...q,
      id:`local-${dateKey}`,
      url:OWL_QUOTE_SOURCE,
      date:dateKey,
      quoteDate:dateKey,
      stale:true,
      cache:"local-fallback"
    };
  }

  function normalizeOwlDailyQuote(payload,dateKey=owlToday()){
    const q=payload?.quote||payload;
    const text=String(q?.text||"").trim();
    if(text.length<12)return null;
    return {
      id:String(q?.id||`daily-${dateKey}`),
      text,
      author:String(q?.author||"Khuyết danh").trim()||"Khuyết danh",
      url:String(q?.url||payload?.sourceUrl||OWL_QUOTE_SOURCE),
      date:dateKey,
      quoteDate:String(payload?.quoteDate||payload?.date||dateKey),
      stale:Boolean(payload?.stale),
      cache:String(payload?.cache||"daily-db")
    };
  }

  function readOwlDailyQuoteCache(dateKey=owlToday()){
    try{
      const raw=localStorage.getItem(OWL_DAILY_QUOTE_CACHE_KEY);
      if(!raw)return null;
      const saved=JSON.parse(raw);
      if(saved?.date!==dateKey)return null;
      return normalizeOwlDailyQuote(saved,dateKey);
    }catch{
      return null;
    }
  }

  function writeOwlDailyQuoteCache(quote){
    try{
      localStorage.setItem(OWL_DAILY_QUOTE_CACHE_KEY,JSON.stringify(quote));
    }catch{}
  }

  async function loadWiseOwlDailyQuote({force=false}={}){
    const dateKey=owlToday();

    if(owlDailyQuoteDate!==dateKey){
      owlDailyQuote=readOwlDailyQuoteCache(dateKey);
      owlDailyQuoteDate=dateKey;
    }

    if(owlDailyQuote&&!owlDailyQuote.stale&&!force)return owlDailyQuote;
    if(!prod?.getDailyQuote)return owlDailyQuote||localDailyOwlFallback(dateKey);
    if(owlDailyQuotePromise)return owlDailyQuotePromise;
    if(!force&&owlDailyQuote?.stale&&Date.now()-owlDailyQuoteLastAttempt<OWL_QUOTE_RETRY_MS){
      return owlDailyQuote;
    }

    owlDailyQuoteLastAttempt=Date.now();
    owlDailyQuotePromise=(async()=>{
      try{
        const payload=await prod.getDailyQuote();
        const quote=normalizeOwlDailyQuote(payload,dateKey);
        if(quote){
          owlDailyQuote=quote;
          owlDailyQuoteDate=dateKey;
          writeOwlDailyQuoteCache(quote);
          return quote;
        }
      }catch(error){
        console.warn("Không tải được danh ngôn trực tuyến hôm nay.",error);
      }finally{
        owlDailyQuotePromise=null;
      }

      if(!owlDailyQuote){
        owlDailyQuote=localDailyOwlFallback(dateKey);
        owlDailyQuoteDate=dateKey;
      }
      return owlDailyQuote;
    })();

    return owlDailyQuotePromise;
  }

  function nextWiseOwlQuoteInstant(){
    const dateKey=owlToday();
    if(owlDailyQuoteDate!==dateKey){
      owlDailyQuote=readOwlDailyQuoteCache(dateKey);
      owlDailyQuoteDate=dateKey;
      owlQuoteRotator.reset();
      void loadWiseOwlDailyQuote();
    }
    if(!owlDailyQuote){
      owlDailyQuote=localDailyOwlFallback(dateKey);
      owlDailyQuoteDate=dateKey;
      void loadWiseOwlDailyQuote();
    }else if(owlDailyQuote.stale){
      void loadWiseOwlDailyQuote();
    }
    return owlQuoteRotator.next(owlDailyQuote?[owlDailyQuote]:[]);
  }

  function setupWiseOwl(){
    if(owlReady)return;

    const pet=$("#wiseOwlPet");
    const body=$("#owlBody");
    const speech=$("#owlSpeech");
    const closeBtn=$("#owlMuteBtn");
    if(!pet||!body||!speech)return;
    owlReady=true;

    body.addEventListener("click",()=>{
      speech.classList.remove("hidden");

      pet.classList.remove("owl-flap");
      void pet.offsetWidth;
      pet.classList.add("owl-flap");
      setTimeout(()=>pet.classList.remove("owl-flap"),1350);

      showOwlMessage({
        preferQuote:(owlMessageCursor+1)%3===0,
        force:true
      });
      owlMessageCursor++;
    });

    closeBtn?.addEventListener("click",event=>{
      event.stopPropagation();
      speech.classList.add("hidden");
      clearTimeout(owlHideTimer);
    });

    setInterval(()=>{
      if(!currentUser||document.hidden)return;
      if(!modal.classList.contains("hidden"))return;
      showOwlMessage({preferQuote:true,quiet:true});
    },95000);
  }

  function owlDeadlineTime(iso){
    if(!iso)return Infinity;
    const full=iso.length===16?`${iso}:00+07:00`:iso;
    const t=new Date(full).getTime();
    return Number.isFinite(t)?t:Infinity;
  }

  function owlRouteContextMessages(){
    if(!currentUser||!state)return [];
    const messages=[];
    const activeUsers=(state.users||[]).filter(u=>u.active!==false);
    const activeLearners=activeUsers.filter(u=>["student","monitor"].includes(u.role));
    const currentWeek=week();

    if(route==="admin"&&currentUser.role==="admin"){
      const directory=state.adminDirectory;
      if(directory){
        const classes=(directory.classes||[]);
        const teachers=(directory.teachers||[]);
        const assignments=(directory.assignments||[]).filter(a=>a.active!==false);
        messages.push({text:`🛡️ Trang Quản trị đang có ${classes.filter(c=>c.active!==false).length} lớp hoạt động, ${teachers.filter(t=>t.active!==false).length} giáo viên hoạt động và ${assignments.length} phân quyền lớp.`});
        const inactive=teachers.filter(t=>t.active===false).length;
        if(inactive)messages.push({text:`👩‍🏫 Có ${inactive} giáo viên đang khóa. Root admin có thể mở lại hoặc quản lý tài khoản trong khối Giáo viên.`});
      }else{
        messages.push({text:"🛡️ Cú đang chờ danh mục lớp và giáo viên tải xong để tóm tắt phân quyền cho bạn."});
      }
    }else if(route==="students"&&isManager()){
      const deleted=(state.users||[]).filter(u=>["student","monitor"].includes(u.role)&&u.active===false).length;
      messages.push({text:`🧑‍🎓 Lớp hiện có ${activeLearners.length} học sinh/cán sự hoạt động${deleted?` và ${deleted} tài khoản đã xóa mềm`:""}.`});
    }else if(route==="approvals"&&isManager()){
      const waiting=(state.registrations||[]).filter(r=>r.weekId===state.currentWeekId&&needsTeacherReview(r)).length;
      messages.push({urgent:waiting>0,text:waiting?`📋 Tuần ${currentWeek.number} còn ${waiting} đăng ký cần thầy/cô xử lý.`:`✅ Tuần ${currentWeek.number} hiện không còn đăng ký nào cần giáo viên xử lý.`});
    }else if(route==="class"&&isManager()){
      const st=statsForWeek();
      messages.push({text:`👥 Tổng quan lớp tuần ${currentWeek.number}: ${st.valid} lượt hợp lệ, ${st.issues} lượt cần chú ý và ${st.missing} lượt chưa đăng ký.`});
    }else if(route==="schedule"&&isManager()){
      messages.push({text:`🗓️ Thời khóa biểu tự học hiện có ${effectiveSchedule().length} tiết đang áp dụng cho lớp ${state.settings.className}.`});
    }else if(route==="weeks"&&isManager()){
      messages.push({text:`📆 Bạn đang xem Tuần ${currentWeek.number} · ${weekStatus(effectiveWeekStatus(currentWeek))}. Hạn đăng ký: ${deadlineSummary(currentWeek)}.`});
    }else if(route==="settings"&&isManager()){
      messages.push({text:isAiAutomationEnabled()?`🤖 Duyệt AI đang bật ở ngưỡng ${Math.round(Number(state.settings.aiAutoApproveThreshold||.9)*100)}%.`:`👤 Duyệt AI đang tắt; đăng ký sẽ chuyển giáo viên xử lý.`});
    }else if(["dashboard","register"].includes(route)&&!isManager()){
      const missing=effectiveSchedule().filter(sl=>!regFor(currentUser.id,sl.dow,sl.period)).length;
      messages.push({urgent:missing>0,text:missing?`📚 Tuần ${currentWeek.number} bạn còn ${missing} tiết chưa đăng ký nội dung tự học.`:`🌟 Tuần ${currentWeek.number} bạn đã có nội dung cho toàn bộ tiết tự học.`});
    }else if(route==="history"&&!isManager()){
      const mine=(state.registrations||[]).filter(r=>r.studentId===currentUser.id);
      messages.push({text:`📚 Lịch sử của bạn đang có ${mine.length} lượt đăng ký tự học được tải từ hệ thống.`});
    }else if(route==="comments"&&!isManager()){
      const revisions=(state.registrations||[]).filter(r=>r.studentId===currentUser.id&&r.teacherComment).length;
      messages.push({text:revisions?`💬 Có ${revisions} đăng ký từng nhận phản hồi của giáo viên. Bạn có thể mở từng mục để xem lại.`:"💬 Hiện chưa có phản hồi giáo viên nào trong dữ liệu của bạn."});
    }else if(route==="dashboard"&&isManager()){
      const waiting=(state.registrations||[]).filter(r=>r.weekId===state.currentWeekId&&needsTeacherReview(r)).length;
      messages.push({text:`🌠 Dashboard lớp ${state.settings.className}: ${activeLearners.length} học sinh/cán sự hoạt động${waiting?`, ${waiting} đăng ký cần xử lý`:""}.`});
    }
    return messages;
  }

  function scheduleOwlRouteContext({force=false,delay=900}={}){
    if(!currentUser||!state)return;
    const key=[currentUser.id,route,state.activeClassId||"",state.currentWeekId||""].join("|");
    if(!force&&key===owlLastContextKey)return;
    owlLastContextKey=key;
    clearTimeout(owlRouteTimer);
    const wait=Math.max(delay,Math.max(0,owlJustGreetedUntil-Date.now()));
    owlRouteTimer=setTimeout(()=>{
      const item=owlRouteContextMessages()[0];
      if(item)showOwlMessage({text:item.text,urgent:!!item.urgent,force:true});
    },wait);
  }

  function owlContextMessages(){
    if(!currentUser||!state)return [];
    const messages=[...owlRouteContextMessages()];
    const w=week();

    if(isManager()){
      const unread=(state.notifications||[]).filter(n=>!n.isRead).length;
      const aiPending=(state.registrations||[]).filter(r=>r.aiReviewStatus==="pending"||r.aiReviewStatus==="processing").length;
      const manual=(state.registrations||[]).filter(r=>r.weekId===state.currentWeekId&&needsTeacherReview(r)).length;
      if(unread)messages.push({urgent:true,text:`🔔 Thầy/cô có ${unread} thông báo mới cần xem. Cú đã đánh dấu chuông ở góc trên.`});
      if(aiPending)messages.push({text:`🤖 AI đang phân loại ${aiPending} đăng ký. Trường hợp chưa đủ chắc chắn sẽ tự chuyển sang thầy/cô.`});
      if(manual)messages.push({urgent:true,text:`📋 Tuần ${w.number} còn ${manual} đăng ký cần giáo viên xử lý.`});
    }else{
      const mine=(state.registrations||[]).filter(r=>r.studentId===currentUser.id&&r.weekId===state.currentWeekId);
      const needs=mine.filter(r=>r.status==="needs_revision"&&!isRevisionOverdue(r)).length;
      const pending=mine.filter(r=>r.status==="submitted").length;
      if(needs)messages.push({urgent:true,text:`📝 Bạn có ${needs} đăng ký được giáo viên yêu cầu chỉnh sửa. Hãy mở “Nhận xét của GV”.`});
      if(pending)messages.push({text:`⏳ Bạn có ${pending} đăng ký đang chờ duyệt. Cú sẽ báo khi trạng thái thay đổi.`});

      const slots=effectiveSchedule();
      const missing=slots.filter(sl=>!regFor(currentUser.id,sl.dow,sl.period));
      const candidates=missing.map(sl=>({
        sl,
        deadline:deadlineForSlot(w,sl.dow),
        t:owlDeadlineTime(deadlineForSlot(w,sl.dow))
      })).filter(x=>Number.isFinite(x.t)&&x.t>Date.now()).sort((a,b)=>a.t-b.t);

      if(candidates.length){
        const next=candidates[0];
        const hours=(next.t-Date.now())/3600000;
        const urgency=hours<=24;
        messages.push({
          urgent:urgency,
          text:`${urgency?"⏰":"📅"} Tiết ${next.sl.period} ${DOW[next.sl.dow]} chưa đăng ký. Hạn: ${fmtDeadline(next.deadline)}.`
        });
      }else if(missing.length&&effectiveWeekStatus(w)==="open"){
        messages.push({urgent:true,text:`⚠️ Tuần ${w.number} còn ${missing.length} tiết của bạn chưa có nội dung đăng ký.`});
      }

      if(currentUser.role==="monitor"){
        const st=statsForWeek();
        if(st.missing>0)messages.push({text:`👥 Với vai trò cán sự, bạn có thể theo dõi lớp: hiện còn ${st.missing} lượt tự học chưa đăng ký.`});
      }
    }

    return messages;
  }

  function showOwlMessage({preferQuote=false,force=false,quiet=false,text=null,urgent=false}={}){
    if(!currentUser)return;
    setupWiseOwl();
    const pet=$("#wiseOwlPet"), speech=$("#owlSpeech"), textEl=$("#owlSpeechText"), source=$("#owlQuoteSource"), alertDot=$("#owlAlertDot");
    if(!pet||!speech||!textEl)return;
    pet.classList.remove("hidden");

    let item=null, quote=false;
    if(text){
      item={text,urgent};
    }else{
      const context=owlContextMessages();
      if(!preferQuote&&context.length){
        item=context[owlMessageCursor%context.length];
      }else{
        const q=nextWiseOwlQuoteInstant();
        item={
          text:`📚 ${q.text} — ${q.author}`,
          urgent:false,
          quoteUrl:q.url||OWL_QUOTE_SOURCE
        };
        quote=true;
      }
    }

    if(quiet&&!force&&item?.urgent)return;
    textEl.textContent=item?.text||"Cú Thông Thái chúc bạn một buổi tự học hiệu quả.";
    source?.classList.toggle("hidden",!quote);
    if(source)source.href=item?.quoteUrl||OWL_QUOTE_SOURCE;
    speech.classList.remove("hidden");
    if(force&&!item?.urgent){
      pet.classList.remove("owl-flap");
      void pet.offsetWidth;
      pet.classList.add("owl-flap");
      setTimeout(()=>pet.classList.remove("owl-flap"),1550);
    }
    pet.classList.toggle("owl-alert",!!item?.urgent);
    alertDot?.classList.toggle("hidden",!item?.urgent);

    clearTimeout(owlHideTimer);
    owlHideTimer=setTimeout(()=>{
      speech.classList.add("hidden");
      pet.classList.remove("owl-alert");
    }, item?.urgent?12500:9000);
  }

  function setOwlThinking(on,message="🤖 Cú đang nhờ Groq AI đọc ngữ cảnh đăng ký của bạn..."){
    const pet=$("#wiseOwlPet");
    if(!pet)return;
    pet.classList.toggle("owl-thinking",!!on);
    if(on)showOwlMessage({text:message,force:true});
  }

  function refreshWiseOwl(){
    if(!currentUser||!state){
      $("#wiseOwlPet")?.classList.add("hidden");
      return;
    }
    setupWiseOwl();
    $("#wiseOwlPet")?.classList.remove("hidden");
    void loadWiseOwlDailyQuote();

    let urgentCount=0;
    if(isManager()){
      urgentCount=(state.notifications||[]).filter(n=>!n.isRead).length;
    }else{
      urgentCount=(state.registrations||[]).filter(r=>
        r.studentId===currentUser.id&&
        r.weekId===state.currentWeekId&&
        r.status==="needs_revision"
      ).length;
    }
    $("#owlAlertDot")?.classList.toggle("hidden",urgentCount===0);

    if(owlLastUrgentCount>=0&&urgentCount>owlLastUrgentCount){
      setTimeout(()=>showOwlMessage({force:true}),500);
    }
    owlLastUrgentCount=urgentCount;

    const greetKey=`wiseOwlGreeted:${currentUser.id}`;
    if(!sessionStorage.getItem(greetKey)){
      sessionStorage.setItem(greetKey,"1");
      owlJustGreetedUntil=Date.now()+2800;
      setTimeout(()=>showOwlMessage({
        text:`🦉 Xin chào ${currentUser.name}! Cú Thông Thái sẽ nhắc deadline, thông báo và thỉnh thoảng kể bạn một câu danh ngôn.`,
        force:true
      }),700);
    }
  }

  function saveState(){
    return prod.syncState(state,currentUser).catch(err=>{
      console.error(err);
      toast(safeErrorMessage(err,"Không đồng bộ được dữ liệu. Vui lòng thử lại."),"warn");
      throw err;
    });
  }
  function esc(v=""){ return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
  function fmtDate(s){ if(!s)return""; const [y,m,d]=s.slice(0,10).split("-"); return `${d}/${m}/${y}`; }
  function fmtDateShort(s){ if(!s)return""; const [y,m,d]=s.slice(0,10).split("-"); return `${d}/${m}`; }
  function addDaysDateISO(iso,n){
    const d=new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+Number(n||0));
    return d.toISOString().slice(0,10);
  }
  function dateForDow(w,dow){ return w?.startDate?addDaysDateISO(w.startDate,Number(dow||0)):""; }
  function fmtDeadline(s){
    if(!s)return "Chưa đặt deadline";
    const date=s.slice(0,10), time=(s.split("T")[1]||"").slice(0,5);
    return `${fmtDate(date)} lúc ${time||"--:--"}`;
  }
  function registrationDeadlineTime(){
    const value=String(state?.settings?.registrationDeadlineTime||"20:00");
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)?value:"20:00";
  }
  function deadlineModeLabel(mode){
    const time=registrationDeadlineTime();
    return {
      per_session_20:`${time} tối hôm trước từng buổi`,
      week_before_20:`${time} ngày trước khi tuần bắt đầu`,
      specific:"Hạn cụ thể của tuần"
    }[mode||"per_session_20"] || "Hạn đăng ký";
  }
  function deadlineForSlot(w,dow=0){
    if(!w)return "";
    const mode=w.deadlineMode||"per_session_20";
    const time=registrationDeadlineTime();
    if(mode==="per_session_20"){
      const sessionDate=dateForDow(w,dow);
      return `${addDaysDateISO(sessionDate,-1)}T${time}`;
    }
    if(mode==="week_before_20"){
      return `${addDaysDateISO(w.startDate,-1)}T${time}`;
    }
    return w.deadline||"";
  }
  function deadlinePassed(w,dow=0){
    const dl=deadlineForSlot(w,dow);
    if(!dl)return false;
    const iso=dl.length===16?`${dl}:00+07:00`:dl;
    const t=new Date(iso).getTime();
    return Number.isFinite(t) && Date.now()>t;
  }
  function deadlineChip(w,dow=null){
    const mode=w?.deadlineMode||"per_session_20";
    const time=registrationDeadlineTime();
    if(mode==="per_session_20" && dow===null){
      return `<span class="deadline-chip ok">⏰ Theo từng buổi: ${time} tối hôm trước</span>`;
    }
    const dl=deadlineForSlot(w,dow??0);
    if(!dl)return `<span class="deadline-chip neutral">⏰ Chưa đặt deadline</span>`;
    return `<span class="deadline-chip ${deadlinePassed(w,dow??0)?"late":"ok"}">⏰ ${fmtDeadline(dl)}${deadlinePassed(w,dow??0)?" · Đã qua hạn":""}</span>`;
  }
  function deadlineSummary(w){
    const mode=w?.deadlineMode||"per_session_20";
    if(mode==="per_session_20") return `Mỗi buổi: ${registrationDeadlineTime()} tối hôm trước`;
    if(mode==="week_before_20") return fmtDeadline(deadlineForSlot(w,0));
    return w?.deadline ? fmtDeadline(w.deadline) : "Chưa chọn hạn cụ thể";
  }
  function markLocalNotificationReadByReg(registrationId){
    (state.notifications||[]).forEach(n=>{
      if(n.registrationId===registrationId)n.isRead=true;
    });
  }
  function isRevisionOverdue(registration){
    if(!registration)return false;
    if(registration.revisionOverdueAt)return true;
    if(registration.status!=="needs_revision")return false;
    const registrationWeek=state?.weeks?.find(w=>w.id===registration.weekId);
    if(!registrationWeek)return false;
    return sessionHasStarted(registrationWeek,registration.dow,registration.period);
  }
  function effectiveRegistrationStatus(registration){
    return isRevisionOverdue(registration)?"revision_overdue":(registration?.status||"missing");
  }
  function revisionReportTime(registration){
    if(registration?.revisionOverdueAt)return registration.revisionOverdueAt;
    const registrationWeek=state?.weeks?.find(w=>w.id===registration?.weekId);
    if(!registrationWeek)return null;
    const start=sessionStartTime(registrationWeek,registration.dow,registration.period);
    return Number.isFinite(start)?new Date(start).toISOString():null;
  }
  function registrationManagerActions(registration){
    const registrationWeek=state?.weeks?.find(w=>w.id===registration?.weekId);
    const revisionOverdue=isRevisionOverdue(registration);
    const sessionStarted=registrationWeek
      ?sessionHasStarted(registrationWeek,registration?.dow,registration?.period)
      :true;
    const status=registration?.status||"";
    const exists=!!registration&&registration?.isDeleted!==true;
    const aiBusy=["pending","processing"].includes(registration?.aiReviewStatus);

    return {
      canApprove:exists
        &&!revisionOverdue
        &&status==="submitted"
        &&!aiBusy,
      canRequestRevision:exists
        &&!revisionOverdue
        &&!sessionStarted
        &&["submitted","needs_revision","approved"].includes(status),
      canComment:exists,
      canDelete:exists,
      sessionStarted,
      revisionOverdue
    };
  }

  function needsTeacherReview(registration){
    if(!registration || registration.isDeleted===true)return false;
    if(registration.status!=="submitted")return false;
    return registrationManagerActions(registration).canApprove;
  }

  function registrationManagerActionButtons(registration,{showAiWrong=false}={}){
    const actions=registrationManagerActions(registration);
    const buttons=[];
    if(showAiWrong&&registration?.status==="approved"&&registration?.approvalSource==="ai"&&actions.canRequestRevision){
      buttons.push(`<button class="btn btn-warning ai-wrong-btn" data-id="${registration.id}">⚠️ AI chưa đúng</button>`);
    }
    if(actions.canApprove){
      buttons.push(`<button class="btn btn-success approve-btn" data-id="${registration.id}">✓ Duyệt</button>`);
    }
    if(actions.canRequestRevision){
      buttons.push(`<button class="btn btn-warning revise-btn" data-id="${registration.id}">↩ Yêu cầu sửa</button>`);
    }else if(actions.sessionStarted&&["submitted","needs_revision","approved"].includes(registration?.status)){
      buttons.push(`<span class="tiny muted manager-action-note">Đã bắt đầu tiết · chỉ nhận xét/báo cáo</span>`);
    }
    if(actions.canComment){
      buttons.push(`<button class="btn btn-ghost comment-btn" data-id="${registration.id}">💬 Nhận xét</button>`);
    }
    if(actions.canDelete){
      buttons.push(`<button class="btn btn-danger delete-reg-btn" data-id="${registration.id}">🗑 Xóa</button>`);
    }
    return buttons.join("");
  }


  function week(){ return state.weeks.find(w=>w.id===state.currentWeekId)||state.weeks[0]; }
  function todayDateISO(){
    if(prod?.dateISOInTimeZone)return prod.dateISOInTimeZone(new Date());
    const now=new Date();
    const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,"0"),d=String(now.getDate()).padStart(2,"0");
    return `${y}-${m}-${d}`;
  }

  function weekLifecycleSnapshot(nowMs=Date.now()){
    if(!state?.weeks?.length)return {currentWeekId:null,statuses:{},nextBoundaryMs:null};
    return getWeekLifecycle({
      weeks:state.weeks,
      periods:state.periods||[],
      getSlots:weekId=>scheduleForWeek(weekId),
      nowMs
    });
  }

  function actualWeek(){
    const lifecycle=weekLifecycleSnapshot();
    return state.weeks.find(w=>w.id===lifecycle.currentWeekId)
      || state.weeks.find(w=>lifecycle.statuses[w.id]==="upcoming")
      || state.weeks[state.weeks.length-1]
      || null;
  }

  function automaticWeekStatus(w){
    if(!w)return "upcoming";
    return weekLifecycleSnapshot().statuses[w.id]||"upcoming";
  }

  function effectiveWeekStatus(w){
    if(!w)return "upcoming";
    return w.status==="holiday"?"holiday":automaticWeekStatus(w);
  }

  function period(n){ return state.periods.find(p=>p.n===Number(n)); }
  function slotLabel(dow,p){ const pe=period(p); return `${DOW[dow]} · Tiết ${p}${pe?` (${pe.start}–${pe.end})`:""}`; }
  function sortKeyCode(code=""){
    return String(code||"").toUpperCase().match(/[A-Z]+|\d+/g)?.map(part=>/^\d+$/.test(part)?part.padStart(8,"0"):part).join("|")
      || String(code||"").toUpperCase();
  }
  function compareByCode(a,b){
    return sortKeyCode(a?.code).localeCompare(sortKeyCode(b?.code),undefined,{numeric:true,sensitivity:"base"});
  }
  function studentUsers(){
    return state.users
      .filter(u=>u.active && (u.role==="student"||u.role==="monitor"))
      .sort(compareByCode);
  }
  function initials(name){ return name.split(" ").slice(-2).map(x=>x[0]).join("").toUpperCase(); }
  function statusBadge(status){ return `<span class="status ${status||"missing"}">${statusLabel[status]||"Chưa đăng ký"}</span>`; }
  function toast(msg,type=""){ const el=document.createElement("div"); el.className=`toast ${type}`; el.textContent=msg; $("#toastHost").appendChild(el); setTimeout(()=>el.remove(),2800); }
  function openModal(title,html){ modalTitle.textContent=title; setSafeHtml(modalBody,html); modal.classList.remove("hidden"); decorateActionButtons(modal); }
  function closeModal(){ modal.classList.add("hidden"); modalBody.replaceChildren(); }
  function audit(action,entityId,detail=""){
    state.audit.unshift({
      at:new Date().toISOString(),
      userId:currentUser?.id,
      action,
      entityId,
      detail
    });
  }

  function scheduleForWeek(weekId){
    const overrides=(state.overrides||[]).filter(o=>o.weekId===weekId);
    if(!overrides.length){
      return [...(state.schedule||[])].sort((a,b)=>a.dow-b.dow||a.period-b.period);
    }
    return overrides
      .filter(o=>o.active)
      .map(o=>({dow:o.dow,period:o.period}))
      .sort((a,b)=>a.dow-b.dow||a.period-b.period);
  }

  function effectiveSchedule(){
    return scheduleForWeek(state.currentWeekId);
  }

  function sessionStartTime(w,dow,p){
    const pe=period(p);
    if(!w||!pe?.start)return NaN;
    const date=dateForDow(w,dow);
    return new Date(`${date}T${pe.start}:00+07:00`).getTime();
  }

  function sessionHasStarted(w,dow,p){
    const t=sessionStartTime(w,dow,p);
    return Number.isFinite(t)&&Date.now()>=t;
  }

  function emergencyRegistrationEligible(w,dow,p,r=null){
    if(r)return false;
    if(effectiveWeekStatus(w)!=="open")return false;
    if(!deadlinePassed(w,dow))return false;
    const start=sessionStartTime(w,dow,p);
    return Number.isFinite(start)&&Date.now()<start;
  }

  function alignWeekToLifecycle(force=false){
    if(!state?.weeks?.length)return false;
    if(weekSelectionTouched&&!force)return false;
    const current=actualWeek();
    if(!current||current.id===state.currentWeekId)return false;
    state.currentWeekId=current.id;
    return true;
  }

  async function runWeekLifecycleTick(){
    weekLifecycleTimer=null;
    if(!currentUser||!state?.weeks?.length)return;
    const current=actualWeek();
    if(!weekSelectionTouched&&current?.id&&current.id!==state.currentWeekId){
      await selectWeek(current.id);
      return;
    }
    renderShell();
    render();
  }

  function scheduleWeekLifecycleTick(){
    clearTimeout(weekLifecycleTimer);
    weekLifecycleTimer=null;
    if(!currentUser||!state?.weeks?.length)return;
    const boundary=weekLifecycleSnapshot().nextBoundaryMs;
    const now=Date.now();
    if(!Number.isFinite(boundary)||boundary<=now)return;
    const delay=Math.max(250,Math.min(boundary-now+250,2147483000));
    weekLifecycleTimer=setTimeout(()=>{void runWeekLifecycleTick();},delay);
  }
  function regFor(studentId,dow,p,weekId=state.currentWeekId){
    return state.registrations.find(r=>r.studentId===studentId&&r.weekId===weekId&&r.dow===dow&&r.period===p);
  }
  function registrationBucket(r){
    if(!r||r.status==="draft")return "missing";
    if(isRevisionOverdue(r))return "issue";
    return "valid";
  }

  function statsForWeek(){
    const students=studentUsers(), slots=effectiveSchedule();
    const total=students.length*slots.length;
    let valid=0,issues=0,missing=0,needs=0;

    students.forEach(s=>slots.forEach(sl=>{
      const r=regFor(s.id,sl.dow,sl.period);
      const bucket=registrationBucket(r);

      if(bucket==="valid")valid++;
      else if(bucket==="issue")issues++;
      else missing++;

      if(bucket==="valid"&&r?.status==="needs_revision")needs++;
    }));

    return {
      students:students.length,
      slots:slots.length,
      total,
      valid,
      submitted:valid,
      issues,
      missing,
      needs,
      rate:total?Math.round(valid/total*100):0
    };
  }


  function pendingAiRecoveryCandidates(){
    if(!currentUser||!state||!isAiAutomationEnabled())return [];

    const now=Date.now();
    const ownOnly=!isManager();
    const minAge=isManager()?1800:600;

    return (state.registrations||[])
      .filter(registration=>
        registration.status==="submitted"
        &&registration.aiReviewStatus==="pending"
        &&registration.isDeleted!==true
        &&(!ownOnly||registration.studentId===currentUser.id)
        &&(
          !isManager()
          || registration.weekId===state.currentWeekId
        )
        &&now-Number(registration.updatedAt||0)>=minAge
        &&now-Number(aiRecoveryAttemptedAt.get(registration.id)||0)>=30000
      )
      .sort((a,b)=>Number(a.updatedAt||0)-Number(b.updatedAt||0));
  }

  function schedulePendingAiRecovery(delay=1200){
    if(!currentUser||document.hidden)return;
    clearTimeout(aiRecoveryTimer);
    aiRecoveryTimer=setTimeout(()=>{
      recoverPendingAiReviews().catch(error=>{
        console.warn("AI recovery queue",error);
      });
    },Math.max(200,Number(delay)||1200));
  }

  async function recoverPendingAiReviews(){
    if(aiRecoveryRunning||!currentUser||document.hidden)return;

    const limit=isManager()?6:2;
    const candidates=pendingAiRecoveryCandidates().slice(0,limit);
    if(!candidates.length)return;

    aiRecoveryRunning=true;
    let touched=false;

    try{
      for(const registration of candidates){
        aiRecoveryAttemptedAt.set(registration.id,Date.now());

        try{
          const result=await prod.requestAiReview(registration.id);
          touched=true;

          if(result?.fallbackToManual){
            console.warn("AI recovery fallback",registration.id,result?.reason||"");
          }
        }catch(error){
          console.warn("AI recovery request failed",registration.id,error);
        }

        await new Promise(resolve=>setTimeout(resolve,350));
      }

      if(touched){
        await refreshFromServer(false);
      }
    }finally{
      aiRecoveryRunning=false;

      if(pendingAiRecoveryCandidates().length){
        schedulePendingAiRecovery(2500);
      }
    }
  }

  function realtimeInputBusy(){
    const active=document.activeElement;
    const activeEditor=active?.matches?.("input,textarea,select,[contenteditable='true']");
    const modalOpen=!modal.classList.contains("hidden");
    return Boolean(modalOpen||activeEditor);
  }

  function comparableRegistration(registration){
    if(!registration)return null;
    const {updatedAt,...rest}=registration;
    return rest;
  }

  function sameRealtimeRegistration(a,b){
    return JSON.stringify(comparableRegistration(a))===JSON.stringify(comparableRegistration(b));
  }

  function sameRealtimeNotification(a,b){
    return JSON.stringify(a||null)===JSON.stringify(b||null);
  }

  function applyRealtimeEvent(change){
    if(!change||!state)return false;

    if(change.table==="registrations"){
      const id=change.id||change.record?.id;
      if(!id)return false;

      const index=state.registrations.findIndex(row=>row.id===id);

      if(change.deleted){
        if(index<0)return false;
        state.registrations.splice(index,1);
        return true;
      }

      const incoming=change.record;
      if(!incoming)return false;

      if(index>=0){
        if(sameRealtimeRegistration(state.registrations[index],incoming))return false;
        state.registrations[index]=incoming;
      }else{
        state.registrations.push(incoming);
      }
      return true;
    }

    if(change.table==="teacher_notifications"){
      if(!isManager())return false;
      const id=change.id||change.record?.id;
      if(!id)return false;

      const notifications=state.notifications||(state.notifications=[]);
      const index=notifications.findIndex(row=>row.id===id);

      if(change.deleted){
        if(index<0)return false;
        notifications.splice(index,1);
        return true;
      }

      const incoming=change.record;
      if(!incoming)return false;

      if(index>=0){
        if(sameRealtimeNotification(notifications[index],incoming))return false;
        notifications[index]=incoming;
      }else{
        notifications.unshift(incoming);
        if(notifications.length>100)notifications.length=100;
      }
      return true;
    }

    if(change.structural){
      realtimeStructuralRefresh=true;
    }

    return false;
  }

  async function flushRealtimeQueue(){
    clearTimeout(realtimeFlushTimer);
    realtimeFlushTimer=null;

    if(!currentUser||!state){
      realtimeQueue=[];
      realtimeStructuralRefresh=false;
      return;
    }

    if(document.hidden||realtimeInputBusy()){
      realtimeFlushTimer=setTimeout(flushRealtimeQueue,500);
      return;
    }

    const queue=realtimeQueue;
    realtimeQueue=[];

    // Coalesce nhiều UPDATE liên tiếp của cùng một row.
    const coalesced=new Map();
    for(const change of queue){
      const key=change?.id
        ?`${change.table}:${change.id}`
        :`${change.table}:structural`;
      coalesced.set(key,change);
    }

    let changed=false;
    for(const change of coalesced.values()){
      changed=applyRealtimeEvent(change)||changed;
    }

    if(realtimeStructuralRefresh){
      realtimeStructuralRefresh=false;
      try{
        await refreshFromServer(false);
      }catch(error){
        console.warn("Realtime structural refresh failed.",error);
      }
      return;
    }

    if(changed){
      renderShell();
      render();
    }
  }

  function queueRealtimeChange(change){
    lastRealtimeActivity=Date.now();
    realtimeQueue.push(change);

    if(
      change?.table==="registrations"
      &&change?.record?.status==="submitted"
      &&change?.record?.aiReviewStatus==="pending"
    ){
      schedulePendingAiRecovery(isManager()?1800:650);
    }

    clearTimeout(realtimeFlushTimer);
    realtimeFlushTimer=setTimeout(flushRealtimeQueue,220);
  }

  function startRealtime(){
    realtimeStop?.();
    realtimeStop=null;
    realtimeSubscribed=false;

    if(!currentUser||!prod?.subscribeRealtime)return;

    realtimeStop=prod.subscribeRealtime(
      queueRealtimeChange,
      (status,error)=>{
        if(status==="SUBSCRIBED"){
          const wasSubscribed=realtimeSubscribed;
          realtimeSubscribed=true;
          lastRealtimeActivity=Date.now();
          schedulePendingAiRecovery(isManager()?1800:800);

          // Khi vừa reconnect sau lỗi/mất mạng, tải một snapshot yên lặng.
          if(wasSubscribed===false && realtimeQueue.length){
            clearTimeout(realtimeFlushTimer);
            realtimeFlushTimer=setTimeout(flushRealtimeQueue,100);
          }
          return;
        }

        if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status)){
          realtimeSubscribed=false;
          if(error)console.warn("Supabase Realtime",status,error);
        }
      }
    );
  }

  function stopRealtime(){
    clearTimeout(realtimeFlushTimer);
    clearTimeout(aiRecoveryTimer);
    realtimeFlushTimer=null;
    aiRecoveryTimer=null;
    aiRecoveryRunning=false;
    aiRecoveryAttemptedAt.clear();
    realtimeQueue=[];
    realtimeStructuralRefresh=false;
    realtimeSubscribed=false;
    const stop=realtimeStop;
    realtimeStop=null;
    try{stop?.();}catch(error){console.warn(error);}
  }

  function login(user){
    currentUser=user;
    route="dashboard";
    renderShell();
    render();
    startRealtime();
  }
  async function logout(){
    stopRealtime();
    clearTimeout(weekLifecycleTimer);
    weekLifecycleTimer=null;
    try{ await prod.signOut(); }catch(err){ console.error(err); }
    currentUser=null;
    owlDailyQuote=null;
    owlDailyQuoteDate="";
    owlDailyQuoteLastAttempt=0;
    owlQuoteRotator.reset();
    $("#wiseOwlPet")?.classList.add("hidden");
    $("#owlSpeech")?.classList.add("hidden");
    appView.classList.add("hidden"); loginView.classList.remove("hidden");
  }
  $("#loginForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const code=$("#loginId").value.trim(),password=$("#loginPassword").value;
    if(!code){toast("Hãy nhập mã đăng nhập.","warn");return;}
    setGlobalLoading(true,"Đang đăng nhập...");
    try{
      await prod.signInCode(code,password);
      const loaded=await prod.loadState();
      if(!loaded.currentUser?.active){await prod.signOut();throw new Error("Tài khoản đã bị khóa.");}
      state=loaded.state;login(loaded.currentUser);toast("Đăng nhập thành công.","success");
    }catch(err){
      console.error(err);toast("Đăng nhập không thành công. Hãy kiểm tra mã và mật khẩu.","warn");
    }finally{setGlobalLoading(false);}
  });
  $("#syncBtn")?.classList.remove("hidden");

  function renderShell(){
    if(!currentUser){
      loginView.classList.remove("hidden");
      appView.classList.add("hidden");
      $("#wiseOwlPet")?.classList.add("hidden");
      return;
    }
    loginView.classList.add("hidden"); appView.classList.remove("hidden");
    $("#profileName").textContent=currentUser.name; $("#profileRole").textContent=roleLabel[currentUser.role]; $("#profileAvatar").textContent=initials(currentUser.name);
    setSafeHtml($("#sideNav"),renderNavigation({items:navs[currentUser.role]||navs.student,route,iconFor:navIconFor,escapeHtml:esc}));
    $("#sideNav").querySelectorAll("[data-route]").forEach(b=>b.onclick=()=>{route=b.dataset.route; setSidebarOpen(false); renderShell(); render();});
    setSafeHtml($("#globalWeekSelect"),state.weeks.map(w=>`<option value="${w.id}" ${w.id===state.currentWeekId?"selected":""}>Tuần ${w.number} · ${fmtDateShort(w.startDate)}–${fmtDateShort(w.endDate)}</option>`).join(""));
    const classWrap=$("#classPickerWrap"),classSelect=$("#globalClassSelect");
    if(isManager()){
      classWrap?.classList.remove("hidden");
      setSafeHtml(classSelect,(state.availableClasses||[]).map(c=>`<option value="${c.id}" ${c.id===state.activeClassId?"selected":""}>${esc(c.code||c.name)}${c.name&&c.name!==c.code?` · ${esc(c.name)}`:""}</option>`).join(""));
      if(classSelect)classSelect.disabled=(state.availableClasses||[]).length<2;
    }else classWrap?.classList.add("hidden");

    const notifBtn=$("#notificationBtn"), notifBadge=$("#notificationBadge");
    if(isManager()){
      notifBtn?.classList.remove("hidden");
      const unread=(state.notifications||[]).filter(n=>!n.isRead).length;
      if(notifBadge){
        notifBadge.textContent=String(unread>99?"99+":unread);
        notifBadge.classList.toggle("hidden",unread===0);
      }
    }else{
      notifBtn?.classList.add("hidden");
      notifBadge?.classList.add("hidden");
    }

    refreshWiseOwl();
  }
  async function selectWeek(weekId,{announce=false}={}){
    if(!weekId)return;
    try{
      const weekData=await prod.loadWeekData(weekId,state.activeClassId||currentUser?.classId||null);
      state.registrations=(state.registrations||[])
        .filter(row=>row.weekId!==weekId)
        .concat(weekData.registrations||[]);
      state.overrides=(state.overrides||[])
        .filter(row=>row.weekId!==weekId)
        .concat(weekData.overrides||[]);
      state.currentWeekId=weekId;
      prod.resetSnapshot(state);
      renderShell();
      render();
      if(announce)toast(`Đã chuyển đến Tuần ${week().number}.`,"success");
    }catch(error){
      console.error(error);
      renderShell();
      toast("Không tải được dữ liệu của tuần đã chọn.","warn");
    }
  }
  $("#globalWeekSelect").addEventListener("change",async e=>{
    const current=actualWeek();
    weekSelectionTouched=e.target.value!==current?.id;
    await selectWeek(e.target.value);
  });
  $("#globalClassSelect")?.addEventListener("change",async e=>{
    if(!isManager()||!e.target.value)return;
    setGlobalLoading(true,"Đang chuyển lớp...");
    try{
      prod.setActiveClassId?.(currentUser.id,e.target.value);
      const loaded=await prod.loadState(e.target.value);
      currentUser=loaded.currentUser;state=loaded.state;route=route==="admin"&&currentUser.role!=="admin"?"dashboard":route;
      weekSelectionTouched=false;
      const aligned=alignWeekToLifecycle(true);
      if(aligned)await selectWeek(state.currentWeekId);
      else{renderShell();render();}
    }catch(error){console.error(error);toast(safeErrorMessage(error,"Không chuyển được lớp."),"warn");}
    finally{setGlobalLoading(false);}
  });
  $("#profileBtn").addEventListener("click",()=>openModal("Tài khoản",`
    <div class="card" style="box-shadow:none">
      <div class="person"><span class="avatar">${initials(currentUser?.name||"")}</span><div><b>${esc(currentUser?.name)}</b><div class="muted tiny">${roleLabel[currentUser?.role]} · ${esc(currentUser?.code)}</div></div></div>
      <p class="muted">Lớp ${esc(state.settings.className)} · Năm học ${esc(state.settings.schoolYear)}</p>
      <div class="toolbar"><button class="btn btn-ghost" id="changeMyPasswordBtn">🔑 Đổi mật khẩu</button><button class="btn btn-danger right" id="logoutBtn">Đăng xuất</button></div>
    </div>`));
  document.addEventListener("click",e=>{
    if(e.target?.id==="logoutBtn"){closeModal();logout();}
    if(e.target?.id==="changeMyPasswordBtn"){ changeOwnPasswordModal(); }
  });
  $("#notificationBtn")?.addEventListener("click",()=>openTeacherNotifications());
  const menuBtn=$("#menuBtn"), sidebar=$("#sidebar");
  const isMobileSidebar=()=>window.matchMedia("(max-width: 820px)").matches;
  const readSidebarCollapsed=()=>{
    try{return localStorage.getItem(SIDEBAR_COLLAPSED_KEY)==="1";}catch{return false;}
  };
  const setSidebarOpen=(open)=>{
    const value=Boolean(open);
    sidebar?.classList.toggle("open",value);
    if(isMobileSidebar()){
      menuBtn?.setAttribute("aria-expanded",String(value));
      menuBtn?.setAttribute("aria-label",value?"Đóng menu":"Mở menu");
      menuBtn?.setAttribute("title",value?"Đóng menu":"Mở menu");
    }
  };
  const setSidebarCollapsed=(collapsed,{persist=true}={})=>{
    const value=Boolean(collapsed);
    sidebar?.classList.toggle("is-collapsed",value);
    appView?.classList.toggle("sidebar-collapsed",value);
    if(persist){try{localStorage.setItem(SIDEBAR_COLLAPSED_KEY,value?"1":"0");}catch{}}
    if(!isMobileSidebar()){
      menuBtn?.setAttribute("aria-expanded",String(!value));
      menuBtn?.setAttribute("aria-label",value?"Mở rộng menu":"Thu gọn menu");
      menuBtn?.setAttribute("title",value?"Mở rộng menu":"Thu gọn menu");
    }
  };
  const syncSidebarMode=()=>{
    if(isMobileSidebar()){
      sidebar?.classList.remove("is-collapsed");
      appView?.classList.remove("sidebar-collapsed");
      setSidebarOpen(false);
    }else{
      sidebar?.classList.remove("open");
      setSidebarCollapsed(readSidebarCollapsed(),{persist:false});
    }
  };
  menuBtn.onclick=()=>{
    if(isMobileSidebar())setSidebarOpen(!sidebar.classList.contains("open"));
    else setSidebarCollapsed(!sidebar.classList.contains("is-collapsed"));
  };
  window.addEventListener("resize",syncSidebarMode,{passive:true});
  syncSidebarMode();
  $("#modalClose").onclick=closeModal; modal.addEventListener("click",e=>{if(e.target===modal)closeModal();});
  document.addEventListener("keydown",e=>{
    if(e.key!=="Escape")return;
    closeModal();
    setSidebarOpen(false);
  });

  async function openTeacherNotifications(){
    if(!isManager())return;
    const items=(state.notifications||[]).slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    const unread=items.filter(n=>!n.isRead);
    openModal("Thông báo",`
      <div class="notification-panel">
        <div class="callout">
          <b>${unread.length} thông báo chưa đọc</b><br>
          Đăng ký mới đi qua AI sẽ có thông báo <b>🤖 đang chờ AI</b> ngay lập tức. Nếu AI duyệt được, thông báo này tự đóng; nếu AI lỗi hoặc quá 2 phút, hệ thống chuyển thành <b>cần GV xử lý</b>.
        </div>
        ${items.length?items.slice(0,20).map(n=>`
          <div class="notification-item ${n.isRead?"":"unread"}">
            <div class="notification-icon">${n.type==="emergency_notice"?"🚨":n.type==="ai_watch"?"🤖":"🔔"}</div>
            <div><b>${esc(n.title)}</b><p>${esc(n.message||"")}</p><small>${n.createdAt?new Date(n.createdAt).toLocaleString("vi-VN"):""}</small></div>
          </div>`).join(""):`<div class="empty-mini">Không có thông báo cần duyệt.</div>`}
        <button class="btn btn-primary btn-block" id="openApprovalsFromNotifications">Mở đăng ký & danh sách bổ sung</button>
      </div>`);

    $("#openApprovalsFromNotifications").onclick=()=>{
      closeModal();route="approvals";renderShell();render();
    };

    if(unread.length){
      unread.forEach(n=>n.isRead=true);
      renderShell();
      try{await prod.markNotificationsRead(unread.map(n=>n.id));}
      catch(err){console.error("markNotificationsRead",err);}
    }
  }

  function changeOwnPasswordModal(){
    openModal("Đổi mật khẩu",renderPasswordDialog());
    const newPasswordInput=$("#newOwnPassword");
    const updateChecklist=()=>{
      const rules=validateStudentPassword(newPasswordInput.value);
      modalBody.querySelector('[data-password-rule="length"]')?.classList.toggle("valid",rules.hasMinLength);
      modalBody.querySelector('[data-password-rule="mixed"]')?.classList.toggle("valid",rules.hasLetterAndNumber);
    };
    newPasswordInput.addEventListener("input",updateChecklist);
    updateChecklist();

    $("#changePasswordForm").onsubmit=async e=>{
      e.preventDefault();
      const current=$("#currentOwnPassword").value;
      const p1=newPasswordInput.value, p2=$("#newOwnPassword2").value;
      const rules=validateStudentPassword(p1);
      if(!rules.hasMinLength||!rules.hasLetterAndNumber){toast("Mật khẩu mới chưa đạt đủ hai tiêu chí.","warn");return;}
      if(p1!==p2){toast("Hai mật khẩu chưa khớp.","warn");return;}
      const submit=e.submitter;
      if(submit)submit.disabled=true;
      try{
        await prod.changeOwnPassword(current,p1);
        closeModal(); toast("Đã đổi mật khẩu.","success");
      }catch(err){
        console.error(err);
        toast(err?.code==="CURRENT_PASSWORD_INVALID"?"Mật khẩu hiện tại không đúng.":"Không đổi được mật khẩu. Vui lòng thử lại.","warn");
        $("#currentOwnPassword").value="";
        if(submit)submit.disabled=false;
      }
    };
  }

  function head(title,sub="",action=""){
    $("#pageTitle").textContent=title; $("#pageEyebrow").textContent=`Lớp ${state.settings.className} · ${state.settings.schoolYear}`;
    return `<div class="page-head page-shell-head">
      <div class="page-shell-head-copy">
        <span class="page-shell-kicker">SỔ TỰ HỌC · ${esc(state.settings.className)}</span>
        <h1>${title}</h1>
        <p>${sub}</p>
      </div>
      ${action?`<div class="page-shell-actions">${action}</div>`:""}
    </div>`;
  }
  function weekBanner(){
    const w=week();
    const manager=isManager();
    const image=manager?"assets/images/teacher-dashboard-illustration.png":"assets/images/student-cards.png";
    const title=manager?`Tổng quan tuần ${w.number}`:`Kế hoạch tự học tuần ${w.number}`;
    const helper=manager
      ?"Theo dõi tình hình đăng ký, ưu tiên các trường hợp cần giáo viên xử lý."
      :"Xem tiến độ, hoàn thiện từng buổi tự học và theo dõi phản hồi của giáo viên.";
    return `<section class="learning-hero dashboard-section ${manager?"learning-hero-manager":"learning-hero-student"}">
      <div class="learning-hero-copy">
        <span class="learning-hero-badge">${uiIcon("today")} ${manager?"TUẦN ĐANG XEM":"TUẦN ĐANG ĐĂNG KÝ"}</span>
        <h2>${title}</h2>
        <p class="learning-hero-lead">${helper}</p>
        <div class="learning-hero-meta">
          <span><small>Thời gian</small><b>${fmtDate(w.startDate)} – ${fmtDate(w.endDate)}</b></span>
          <span><small>Trạng thái</small><b>${weekStatus(effectiveWeekStatus(w))}</b></span>
          <span><small>Hạn đăng ký</small><b>${deadlineChip(w)}</b></span>
        </div>
        ${state.settings.announcement?`<div class="learning-hero-announcement">${uiIcon("comment")}<span>${esc(state.settings.announcement)}</span></div>`:""}
        ${!manager?`<p class="tiny learning-hero-helper">Dùng ô <b>Chọn tuần đăng ký</b> ở thanh trên để chuyển sang tuần khác.</p>`:""}
      </div>
      <div class="learning-hero-media">
        <img class="learning-hero-image" src="${image}" alt="Minh họa hoạt động tự học">
        <span class="learning-hero-glow" aria-hidden="true"></span>
      </div>
    </section>`;
  }

  function studentDashboard(){
    const slots=effectiveSchedule(), regs=slots.map(sl=>regFor(currentUser.id,sl.dow,sl.period));
    const done=regs.filter(r=>registrationBucket(r)==="valid").length;
    const issueCount=regs.filter(r=>registrationBucket(r)==="issue").length;
    const total=slots.length, pct=total?Math.round(done/total*100):0;
    const actual=actualWeek();
    const viewingNext=actual&&week().number>actual.number;
    return renderStudentDashboardPage({
      headerHtml:head("Trang chủ",`Xin chào ${esc(currentUser.name)}`),
      bannerHtml:weekBanner(),viewingNext,weekNumber:week().number,done,issueCount,total,pct,
      iconCheck:uiIcon("check"),iconWarning:uiIcon("warning"),iconSchedule:uiIcon("schedule"),
      sessionCards:slots.map((sl,i)=>studyCard(sl,regs[i])).join(""),hasSessions:slots.length>0
    });
  }

  function studyCard(sl,r){
    const w=week();
    const pe=period(sl.period);
    const effectiveStatus=effectiveWeekStatus(w);
    const started=sessionHasStarted(w,sl.dow,sl.period);
    const pastDeadline=deadlinePassed(w,sl.dow);
    const emergency=emergencyRegistrationEligible(w,sl.dow,sl.period,r);
    const reported=isRevisionOverdue(r);

    const icon=reported
      ?"⚠️"
      :r?.status==="approved"
      ?"✅"
      :r?.status==="needs_revision"
        ?"📝"
        :r
          ?"📘"
          :started
            ?"⌛"
            :emergency
              ?"🚨"
              :"🗒️";

    const regularNewAllowed=!r&&effectiveStatus==="open"&&!pastDeadline&&!started;
    const approvedEditable=r?.status==="approved"&&effectiveStatus==="open"&&!pastDeadline&&!started;
    const revisionEditable=r?.status==="needs_revision"&&!reported&&!started;
    const ordinaryEditable=!!r&&["draft","submitted"].includes(r.status)&&effectiveStatus==="open"&&!pastDeadline&&!started;
    const editable=approvedEditable||revisionEditable||ordinaryEditable;

    let actionHtml="";
    if(r){
      const label=reported
        ?"Xem báo cáo lỗi"
        :approvedEditable
          ?"Sửa đăng ký"
          :revisionEditable
          ?"Sửa theo yêu cầu"
          :ordinaryEditable
            ?"Xem / sửa"
            :"Xem";
      actionHtml=`<button class="btn ${editable?"btn-ghost":"btn-soft"} reg-btn" data-dow="${sl.dow}" data-period="${sl.period}">${label}</button>
        ${r.isEmergency&&!started
          ?`<button class="btn btn-danger delete-own-emergency-btn" data-id="${r.id}">Hủy bổ sung</button>`
          :""}`;
    }else if(regularNewAllowed){
      actionHtml=`<button class="btn btn-primary reg-btn" data-dow="${sl.dow}" data-period="${sl.period}">+ Đăng ký ngay</button>`;
    }else if(emergency){
      actionHtml=`<button class="btn emergency-reg-btn" data-dow="${sl.dow}" data-period="${sl.period}">🚨 Đăng ký bổ sung</button>`;
    }else{
      const label=started
        ?"Đã qua buổi"
        :effectiveStatus==="upcoming"
          ?"Chưa mở"
          :effectiveStatus==="holiday"
            ?"Tuần nghỉ"
            :pastDeadline
              ?"Đã quá hạn"
              :"Đã khóa";
      actionHtml=`<button class="btn btn-soft" disabled>${label}</button>`;
    }

    const cardClass=(!r&&!regularNewAllowed&&!emergency)?"closed-slot":"";
    return `<div class="card study-card ${cardClass} ${emergency?"emergency-slot":""}">
      <div class="study-icon">${icon}</div>
      <div class="study-main">
        <h3>${DOW[sl.dow]} · ${fmtDate(dateForDow(w,sl.dow))} · Tiết ${sl.period}</h3>
        <p>🕘 ${pe.start} – ${pe.end}</p>
        <p class="slot-deadline ${pastDeadline?"expired":""}">
          ⏰ Hạn: <b>${fmtDeadline(deadlineForSlot(w,sl.dow))}</b>
          ${pastDeadline?" · Đã qua":""}
        </p>
        ${started?`<p class="tiny session-passed-note">⌛ Buổi tự học đã bắt đầu/đã qua.</p>`:""}
        ${emergency?`<p class="tiny emergency-note">🚨 Deadline đã qua nhưng buổi học chưa bắt đầu. Đăng ký bổ sung sẽ được AI kiểm tra trước; chỉ trường hợp có vấn đề mới chuyển GV duyệt.</p>`:""}
        <p><b>${r?esc(r.content):"Chưa đăng ký"}</b></p>
        ${r?.note?`<p>${esc(r.note)}</p>`:""}
        ${reported?`<p class="tiny revision-overdue-note">⚠️ Quá thời hạn chỉnh sửa trước khi tiết tự học bắt đầu. Đã chuyển sang Báo cáo lỗi.</p>`:""}
        ${r?.teacherComment?`<p style="color:#7c3aed">💬 GV: ${esc(r.teacherComment)}</p>`:""}
        ${r?.aiDecision==="request_revision"&&r?.aiReason?`<p class="tiny ai-review-badge">🤖 <b>AI kiểm tra lại:</b> ${esc(r.aiReason)}</p>`:""}
        ${r?.isEmergency?`<p class="tiny emergency-badge">🚨 Đăng ký bổ sung · ${esc(r.emergencyReason||"")}</p>`:""}
        ${r?.usesElectronicDevice&&r?.deviceDetectionSource==="ai"?`<p class="tiny device-ai-badge">🤖 AI phát hiện nội dung có sử dụng thiết bị điện tử${r.deviceDetectionConfidence==null?"":` · ${Math.round(r.deviceDetectionConfidence*100)}%`}</p>`:""}
        ${r?.status==="approved"&&r?.approvalSource==="ai"?`<p class="tiny auto-approved-note">🤖 AI đã duyệt${r.aiConfidence==null?"":` · ${Math.round(r.aiConfidence*100)}%`}</p>`:""}
        ${["pending","processing"].includes(r?.aiReviewStatus)?`<p class="tiny ai-review-badge">🤖 AI đang đánh giá...</p>`:""}
      </div>
      <div class="study-actions">
        ${statusBadge(effectiveRegistrationStatus(r))}
        ${actionHtml}
      </div>
    </div>`;
  }

  function bindRegistrationButtons(){
    content.querySelectorAll(".reg-btn").forEach(button=>{
      button.onclick=()=>registrationModal(
        Number(button.dataset.dow),
        Number(button.dataset.period)
      );
    });

    content.querySelectorAll(".emergency-reg-btn").forEach(button=>{
      button.onclick=()=>emergencyRegistrationModal(
        Number(button.dataset.dow),
        Number(button.dataset.period)
      );
    });

    content.querySelectorAll(".delete-own-emergency-btn").forEach(button=>{
      button.onclick=async()=>{
        const registration=state.registrations.find(row=>row.id===button.dataset.id);
        if(!registration?.isEmergency)return;
        if(!confirm("Hủy đăng ký bổ sung này? Bạn chỉ có thể hủy trước khi buổi tự học bắt đầu."))return;

        button.disabled=true;
        try{
          await prod.deleteRegistration(registration.id);
          await refreshFromServer(false);
          toast("Đã hủy đăng ký bổ sung.","success");
          render();
        }catch(error){
          console.error(error);
          toast(
            safeErrorMessage(
              error,
              "Không hủy được đăng ký bổ sung. Có thể buổi học đã bắt đầu hoặc đăng ký không còn hợp lệ."
            ),
            "warn"
          );
          button.disabled=false;
        }
      };
    });
  }

  function registrationModal(dow,p){
    const w=week();
    const r=regFor(currentUser.id,dow,p);
    const pe=period(p);
    const pastDeadline=deadlinePassed(w,dow);
    const started=sessionHasStarted(w,dow,p);
    const approvedEdit=r?.status==="approved"
      &&effectiveWeekStatus(w)==="open"
      &&!pastDeadline
      &&!started;
    const reported=isRevisionOverdue(r);
    const needsRevision=r?.status==="needs_revision"&&!reported&&!started;
    const ordinaryEdit=!!r
      &&["draft","submitted"].includes(r.status)
      &&effectiveWeekStatus(w)==="open"
      &&!pastDeadline
      &&!started;
    const newAllowed=!r
      &&effectiveWeekStatus(w)==="open"
      &&!pastDeadline
      &&!started;
    const editable=approvedEdit||needsRevision||ordinaryEdit||newAllowed;
    const locked=!editable;

    openModal(`Đăng ký · ${DOW[dow]} · Tiết ${p}`,`
      <div class="registration-summary">
        <div><span>📅 Ngày học</span><b>${DOW[dow]}, ${fmtDate(dateForDow(w,dow))}</b></div>
        <div><span>🕘 Khung giờ</span><b>${pe.start} – ${pe.end}</b></div>
        <div><span>🗓️ Tuần</span><b>Tuần ${w.number} · ${fmtDate(w.startDate)}–${fmtDate(w.endDate)}</b></div>
        <div><span>⏰ Hạn đăng ký</span><b>${fmtDeadline(deadlineForSlot(w,dow))}</b></div>
      </div>

      ${approvedEdit?`<div class="callout re-review-callout"><b>✏️ Sửa đăng ký đã duyệt.</b> Khi bạn lưu thay đổi, đăng ký sẽ được gửi duyệt lại từ đầu.</div>`:""}
      ${reported?`<div class="callout warning"><b>⚠️ Báo cáo lỗi.</b> Đăng ký đã không được chỉnh sửa trước khi tiết tự học bắt đầu nên không còn ở trạng thái nhắc sửa.</div>`:""}
      ${needsRevision?`<div class="callout"><b>Đăng ký đang cần chỉnh sửa theo phản hồi GV.</b> Bạn vẫn được sửa và gửi duyệt lại sau deadline, nhưng chỉ đến trước giờ bắt đầu tiết tự học.</div>`:""}
      ${r?.isEmergency?`<div class="callout emergency-callout"><b>🚨 Đây là đăng ký bổ sung.</b> Lý do: ${esc(r.emergencyReason||"—")}</div>`:""}
      ${started?`<div class="callout warning"><b>Buổi tự học đã bắt đầu/đã qua.</b> Không thể tạo đăng ký mới hoặc sửa đăng ký bình thường.</div>`:""}
      ${pastDeadline&&!needsRevision&&!reported?`<div class="callout warning"><b>Đã qua deadline.</b> Hạn tự động hiện tại là ${registrationDeadlineTime()} tối hôm trước buổi học.</div>`:""}
      ${r?.teacherComment?`<div class="callout warning"><b>Nhận xét giáo viên:</b><br>${esc(r.teacherComment)}</div>`:""}
      ${r?.aiDecision==="request_revision"&&r?.aiReason?`<div class="callout"><b>🤖 AI kiểm tra lại:</b><br>${esc(r.aiReason)}<br><small>Vui lòng chỉnh sửa tiếp theo phản hồi giáo viên trước đó.</small></div>`:""}

      <form id="regForm">
        <label>Nội dung tự học *
          <input id="regContent" maxlength="180" required value="${esc(r?.content||"")}" ${locked?"disabled":""}
            placeholder="VD: Ôn tập phương trình bậc hai">
        </label>
        <label>Ghi chú / mục tiêu
          <textarea id="regNote" maxlength="500" ${locked?"disabled":""}
            placeholder="Nêu bài, trang hoặc mục tiêu cụ thể...">${esc(r?.note||"")}</textarea>
        </label>
        ${renderDeviceChoice({checked:r?.usesElectronicDevice===true,disabled:locked})}
        ${r?.usesElectronicDevice&&r?.deviceDetectionSource==="ai"
          ?`<p class="tiny device-detection-hint">🤖 AI đã nhận diện nội dung có sử dụng thiết bị điện tử dù bạn chưa bật công tắc.</p>`
          :""}

        ${locked
          ?`<p class="muted tiny">Đăng ký này hiện chỉ được xem.</p>`
          :approvedEdit
            ?`<div class="toolbar"><button class="btn btn-primary right" type="submit">✏️ Lưu thay đổi & gửi duyệt lại</button></div>`
            :`<div class="toolbar">
                ${needsRevision?"":`<button type="button" id="saveDraft" class="btn btn-ghost">Lưu nháp</button>`}
                <button class="btn btn-primary right" type="submit">${needsRevision?"Gửi lại để duyệt":"Gửi đăng ký"}</button>
              </div>`
        }
      </form>
    `);

    if(locked)return;

    const save=async(requestedStatus)=>{
      const contentVal=$("#regContent").value.trim();
      if(!contentVal){
        toast("Bạn cần nhập nội dung tự học.","warn");
        return;
      }

      let rr=regFor(currentUser.id,dow,p);
      const wasApproved=rr?.status==="approved";
      const status=wasApproved?"submitted":requestedStatus;

      if(!rr){
        rr={
          id:"r"+Date.now(),
          studentId:currentUser.id,
          weekId:state.currentWeekId,
          dow,
          period:p,
          teacherComment:"",
          approvalSource:"manual",
          autoReviewReason:"",
          updatedAt:Date.now()
        };
        state.registrations.push(rr);
      }

      Object.assign(rr,{
        content:contentVal,
        note:$("#regNote").value.trim(),
        usesElectronicDevice:$("#usesElectronicDevice")?.checked===true,
        status,
        updatedAt:Date.now()
      });

      if(wasApproved){
        rr.approvalSource="manual";
        rr.approvedAt=null;
        rr.aiReviewStatus="not_needed";
        rr.aiDecision="";
        rr.aiCategory="";
        rr.aiConfidence=null;
        rr.aiRevisionStatus="";
        rr.aiRevisionConfidence=null;
        rr.aiReason="";
      }

      state.audit.unshift({
        at:new Date().toISOString(),
        userId:currentUser?.id,
        action:wasApproved
          ?"Sửa đăng ký — gửi duyệt lại"
          :status==="draft"
            ?"Lưu nháp"
            :"Gửi đăng ký",
        entityId:rr.id,
        detail:rr.content
      });

      try{
        await saveState();

        if(status==="submitted"){
          try{
            await refreshFromServer(false);
            rr=regFor(currentUser.id,dow,p) || rr;
          }catch(refreshError){
            console.warn("Refresh registration before AI invoke",refreshError);
          }
        }

        if(status==="submitted"&&rr.aiReviewStatus==="pending"){
          setOwlThinking(true,"🤖 Cú Thông Thái đang nhờ Groq AI đọc ngữ cảnh đăng ký này...");
          toast((wasApproved||rr.teacherComment)?"Đã lưu thay đổi; AI đang duyệt lại theo phản hồi GV...":"AI đang đánh giá đăng ký...","success");
          try{
            await prod.requestAiReview(rr.id);
            await refreshFromServer(false);
            const fresh=state.registrations.find(x=>x.id===rr.id);
            closeModal();
            setOwlThinking(false);

            if(fresh?.status==="approved"&&fresh?.approvalSource==="ai"){
              const pct=fresh.aiConfidence==null?"":` (${Math.round(fresh.aiConfidence*100)}%)`;
              toast(`AI đã duyệt${pct}.`,"success");
            }else if(fresh?.status==="needs_revision"&&fresh?.aiDecision==="request_revision"){
              toast("AI kiểm tra lại: nội dung vẫn chưa đáp ứng phản hồi GV. Vui lòng chỉnh sửa tiếp.","warn");
            }else{
              toast("Đã chuyển giáo viên duyệt.","success");
            }
            render();
            return;
          }catch(aiErr){
            console.error("AI review",aiErr);
            setOwlThinking(false);
            closeModal();
            toast("Đã lưu; AI tạm thời chưa phản hồi nên giáo viên sẽ duyệt.","warn");
            try{await refreshFromServer(false);}catch{}
            render();
            return;
          }
        }

        closeModal();

        if(wasApproved){
          toast("Đã sửa đăng ký và gửi duyệt lại.","success");
        }else if(status==="draft"){
          toast("Đã lưu nháp.","success");
        }else if(rr.status==="approved"&&rr.approvalSource==="ai"){
          toast("Đã gửi và được AI duyệt.","success");
        }else{
          toast("Đã gửi. Nội dung đang chờ giáo viên duyệt.","success");
        }
        render();
      }catch(err){
        console.error(err);
        setOwlThinking(false);

        const message=String(err?.message||err||"");
        try{await refreshFromServer(false);}catch{}

        if(/row-level security|security policy|42501|SECURITY_REGISTRATION/i.test(message)){
          toast("Không thể lưu: quyền, trạng thái tuần hoặc deadline không còn hợp lệ. Dữ liệu đã được tải lại.","warn");
        }else if(/duplicate|23505|DUPLICATE_REGISTRATION/i.test(message)){
          toast("Buổi này đã có đăng ký đang hoạt động. Dữ liệu đã được tải lại.","warn");
        }else{
          toast("Không lưu được đăng ký: "+message,"warn");
        }
        render();
      }
    };

    $("#saveDraft")?.addEventListener("click",()=>save("draft"));
    $("#regForm").onsubmit=event=>{
      event.preventDefault();
      save("submitted");
    };
  }

  function emergencyRegistrationModal(dow,p){
    const w=week();
    const pe=period(p);
    const existing=regFor(currentUser.id,dow,p);

    if(!emergencyRegistrationEligible(w,dow,p,existing)){
      toast("Buổi này không còn ở cửa sổ đăng ký bổ sung.","warn");
      render();
      return;
    }

    openModal(`🚨 Đăng ký bổ sung · ${DOW[dow]} · Tiết ${p}`,`
      <div class="callout emergency-callout">
        <b>Đăng ký bổ sung khẩn cấp</b><br>
        Deadline đã qua nhưng buổi tự học chưa bắt đầu. Sau khi gửi, <b>AI sẽ kiểm tra trước</b>.
        Nếu nội dung phù hợp và đủ tin cậy, AI có thể duyệt; chỉ trường hợp mơ hồ, có vấn đề hoặc AI lỗi mới chuyển <b>giáo viên duyệt</b>.
        Giáo viên vẫn thấy đăng ký này trong danh sách bổ sung.
      </div>

      <div class="registration-summary">
        <div><span>📅 Buổi học</span><b>${DOW[dow]}, ${fmtDate(dateForDow(w,dow))}</b></div>
        <div><span>🕘 Thời gian</span><b>${pe.start} – ${pe.end}</b></div>
        <div><span>⏰ Deadline đã qua</span><b>${fmtDeadline(deadlineForSlot(w,dow))}</b></div>
      </div>

      <form id="emergencyRegForm">
        <label>Nội dung tự học *
          <input id="emergencyContent" maxlength="180" required
            placeholder="VD: Hoàn thành bài tập Toán chương 2">
        </label>
        <label>Ghi chú / mục tiêu
          <textarea id="emergencyNote" maxlength="500"
            placeholder="Nêu bài, trang hoặc mục tiêu cụ thể..."></textarea>
        </label>
        ${renderDeviceChoice()}
        <label>Lý do đăng ký bổ sung *
          <textarea id="emergencyReason" maxlength="300" required
            placeholder="VD: Em quên xác nhận đăng ký trước deadline."></textarea>
          <small>Lý do này sẽ được gửi cho giáo viên.</small>
        </label>
        <div class="toolbar">
          <button class="btn emergency-submit-btn right" type="submit">🚨 Gửi đăng ký bổ sung</button>
        </div>
      </form>
    `);

    $("#emergencyRegForm").onsubmit=async event=>{
      event.preventDefault();

      const contentVal=$("#emergencyContent").value.trim();
      const noteVal=$("#emergencyNote").value.trim();
      const reasonVal=$("#emergencyReason").value.trim();
      const usesElectronicDevice=$("#usesElectronicDevice")?.checked===true;

      if(!contentVal){
        toast("Bạn cần nhập nội dung tự học.","warn");
        return;
      }
      if(reasonVal.length<5){
        toast("Hãy ghi lý do cần đăng ký bổ sung.","warn");
        return;
      }

      const submitBtn=$("#emergencyRegForm button[type='submit']");
      if(submitBtn){
        submitBtn.disabled=true;
        submitBtn.textContent="Đang gửi...";
      }

      try{
        const created=await prod.emergencyRegister({
          weekId:w.id,
          dow,
          period:p,
          content:contentVal,
          note:noteVal,
          reason:reasonVal,
          usesElectronicDevice
        });

        if(created?.aiReviewStatus==="pending"){
          setOwlThinking(true);
          try{
            await prod.requestAiReview(created.id);
            await refreshFromServer(false);

            const fresh=state.registrations.find(row=>row.id===created.id);
            setOwlThinking(false);
            closeModal();

            if(fresh?.status==="approved"&&fresh?.approvalSource==="ai"){
              const pct=fresh.aiConfidence==null?"":` (${Math.round(fresh.aiConfidence*100)}%)`;
              toast(`Đăng ký bổ sung đã được AI duyệt${pct}.`,"success");
              showOwlMessage({
                text:"🤖 AI đã kiểm tra và duyệt đăng ký bổ sung của bạn.",
                force:true
              });
            }else{
              toast("AI thấy đăng ký cần giáo viên xem thêm. Đã chuyển GV duyệt.","warn");
              showOwlMessage({
                text:"🚨 AI cần giáo viên xem thêm đăng ký bổ sung này.",
                force:true
              });
            }
            render();
            return;
          }catch(aiError){
            console.error("Emergency AI review",aiError);
            setOwlThinking(false);
            try{await refreshFromServer(false);}catch{}
            closeModal();
            toast("Đã lưu đăng ký bổ sung; AI tạm thời chưa xử lý được nên giáo viên sẽ duyệt.","warn");
            render();
            return;
          }
        }

        await refreshFromServer(false);
        closeModal();
        toast("Đã gửi đăng ký bổ sung. Hệ thống đang chuyển giáo viên duyệt theo cấu hình hiện tại.","success");
        render();
      }catch(error){
        console.error(error);
        toast(safeErrorMessage(error,"Không gửi được đăng ký bổ sung. Vui lòng thử lại."),"warn");
        if(submitBtn){
          submitBtn.disabled=false;
          submitBtn.textContent="🚨 Gửi đăng ký bổ sung";
        }
      }
    };
  }

  function historyPage(){
    const regs=state.registrations.filter(r=>r.studentId===currentUser.id).sort((a,b)=>b.updatedAt-a.updatedAt);
    const rows=regs.map(r=>{
      const w=state.weeks.find(x=>x.id===r.weekId);
      return {
        weekLabel:`Tuần ${w?.number||"?"}`,slotLabel:slotLabel(r.dow,r.period),content:esc(r.content),note:esc(r.note||""),
        statusHtml:statusBadge(effectiveRegistrationStatus(r)),comment:esc(r.teacherComment||""),emergency:Boolean(r.isEmergency)
      };
    });
    return renderStudentHistoryPage({headerHtml:head("Lịch sử của tôi","Xem lại đăng ký và phản hồi ở các tuần trước."),rows});
  }
  function commentsPage(){
    const regs=state.registrations.filter(r=>r.studentId===currentUser.id&&r.teacherComment);
    const items=regs.map(r=>({slotLabel:slotLabel(r.dow,r.period),content:esc(r.content),comment:esc(r.teacherComment),statusHtml:statusBadge(effectiveRegistrationStatus(r))}));
    return renderStudentCommentsPage({headerHtml:head("Nhận xét của giáo viên","Các phản hồi dành cho đăng ký của bạn."),items});
  }

  function classOverview(){
    $("#pageTitle").textContent="Theo dõi cả lớp";
    $("#pageEyebrow").textContent=`Tuần ${week().number} · Xem theo từng buổi`;
    const sessions=effectiveSchedule().map(session=>({
      ...session,
      label:slotLabel(session.dow,session.period)
    }));
    const registrations=(state.registrations||[])
      .filter(registration=>registration.weekId===state.currentWeekId)
      .map(registration=>isRevisionOverdue(registration)
        ?{...registration,revisionOverdueAt:revisionReportTime(registration)}
        :registration
      );
    return renderClassTrackingPage({
      week:week(),
      sessions,
      users:state.users||[],
      registrations,
      role:currentUser.role
    });
  }

  function bindClassOverview(){
    content.querySelectorAll("[data-open-session]").forEach(button=>{
      button.addEventListener("click",()=>{
        const [dow,periodNumber]=String(button.dataset.openSession||"").split("-").map(Number);
        const session={dow,period:periodNumber,label:slotLabel(dow,periodNumber)};
        let aiBusy=false;
        let aiProgress="";
        let activeFilter="all";

        const sessionAiCandidates=()=>(
          (state.registrations||[]).filter(registration=>
            registration.weekId===state.currentWeekId
            &&registration.dow===session.dow
            &&Number(registration.period)===Number(session.period)
            &&registration.isDeleted!==true
            &&!isRevisionOverdue(registration)
            &&(
              registration.status==="approved"
              ||(
                registration.status==="submitted"
                &&!["pending","processing"].includes(registration.aiReviewStatus)
              )
            )
          )
        );

        const renderDetails=(filter=activeFilter)=>{
          activeFilter=filter;

          const registrations=(state.registrations||[])
            .filter(registration=>registration.weekId===state.currentWeekId)
            .map(registration=>isRevisionOverdue(registration)
              ?{...registration,revisionOverdueAt:revisionReportTime(registration)}
              :registration
            );

          const candidates=sessionAiCandidates();
          const aiEnabled=isAiAutomationEnabled();
          const aiToolbar=isManager()
            ?`<div class="card" style="margin-bottom:14px;box-shadow:none">
                <div class="toolbar">
                  <div>
                    <b>🤖 AI duyệt lại theo buổi</b>
                    <div class="tiny muted" style="margin-top:4px">
                      ${aiEnabled
                        ?`${candidates.length} đăng ký có thể gọi AI duyệt lại. Bỏ qua bản nháp, yêu cầu sửa, báo cáo lỗi và đăng ký AI đang chờ/đang xử lý.`
                        :"AI đang tắt trong Cài đặt."}
                    </div>
                  </div>
                  <button
                    class="btn btn-primary right"
                    type="button"
                    data-session-ai-rereview="1"
                    ${aiBusy||!aiEnabled||!candidates.length?"disabled":""}>
                    ${aiBusy?"⏳ Đang gọi AI...":"🤖 Gọi AI duyệt lại buổi này"}
                  </button>
                </div>
                <div id="sessionAiRereviewProgress" class="tiny ${aiProgress?"":"hidden"}" style="margin-top:10px">
                  ${esc(aiProgress)}
                </div>
              </div>`
            :"";

          setSafeHtml(modalBody,aiToolbar+renderClassSessionDetails({
            session,
            users:state.users||[],
            registrations,
            role:currentUser.role,
            filter,
            getManagerActions:registrationManagerActions
          }));
          decorateActionButtons(modalBody);

          modalBody.querySelectorAll("[data-session-filter]").forEach(filterButton=>{
            filterButton.addEventListener("click",()=>renderDetails(filterButton.dataset.sessionFilter));
          });

          if(isManager()){
            bindTeacherActions(modalBody);

            modalBody.querySelector("[data-session-ai-rereview]")?.addEventListener("click",async()=>{
              if(aiBusy)return;

              const candidatesNow=sessionAiCandidates();
              if(!candidatesNow.length){
                toast("Buổi này không có đăng ký phù hợp để AI duyệt lại.","warn");
                return;
              }

              const approvedCount=candidatesNow.filter(r=>r.status==="approved").length;
              const confirmText=
                `Gọi AI duyệt lại ${candidatesNow.length} đăng ký của ${session.label}?\n\n`+
                (approvedCount
                  ?`${approvedCount} đăng ký đang được duyệt sẽ tạm chuyển sang trạng thái chờ AI.\n`
                  :"")+
                `Bản nháp, Cần chỉnh sửa và Báo cáo lỗi sẽ không bị thay đổi.\n`+
                `Nếu AI không phản hồi quá 2 phút, hệ thống sẽ chuyển GV xử lý.`;

              if(!window.confirm(confirmText))return;

              aiBusy=true;
              aiProgress="Đang chuẩn bị hàng đợi AI...";
              renderDetails(activeFilter);

              let ids=[];
              let success=0;
              let manualFallback=0;
              let skipped=0;
              let failed=0;

              try{
                ids=await prod.prepareSessionAiRereview({
                  classId:state.activeClassId,
                  weekId:state.currentWeekId,
                  dow:session.dow,
                  period:session.period
                });

                if(!ids.length){
                  aiBusy=false;
                  aiProgress="Không có đăng ký nào được đưa vào hàng đợi AI.";
                  renderDetails(activeFilter);
                  toast("Không có đăng ký phù hợp để duyệt lại.","warn");
                  return;
                }

                for(let i=0;i<ids.length;i++){
                  aiProgress=`AI đang xử lý ${i+1}/${ids.length} đăng ký...`;
                  const progressEl=modalBody.querySelector("#sessionAiRereviewProgress");
                  if(progressEl){
                    progressEl.textContent=aiProgress;
                    progressEl.classList.remove("hidden");
                  }

                  try{
                    await prod.prepareRegistrationAiRereview(ids[i]);
                    const result=await prod.requestAiReview(ids[i]);

                    if(result?.fallbackToManual){
                      manualFallback++;
                    }else if(result?.skipped){
                      skipped++;
                    }else{
                      success++;
                    }
                  }catch(error){
                    failed++;
                    console.error("Session AI re-review",ids[i],error);
                  }

                  if(i<ids.length-1){
                    await new Promise(resolve=>setTimeout(resolve,450));
                  }
                }

                await refreshFromServer(false);
                const issues=manualFallback+failed;
                aiProgress=
                  `Hoàn tất ${ids.length} đăng ký: ${success} AI phản hồi`+
                  `${manualFallback?` · ${manualFallback} chuyển GV`:""}`+
                  `${skipped?` · ${skipped} bỏ qua`:""}`+
                  `${failed?` · ${failed} lỗi gọi`:""}.`;

                toast(
                  issues
                    ?`AI xử lý trực tiếp ${success}/${ids.length}; ${issues} đăng ký đã/chờ chuyển GV xử lý.`
                    :`AI đã duyệt lại xong ${success}/${ids.length} đăng ký.`,
                  issues?"warn":"success"
                );
              }catch(error){
                console.error("Prepare session AI re-review",error);
                aiProgress="Không khởi động được lượt AI duyệt lại.";
                toast(safeErrorMessage(error,"Không gọi được AI duyệt lại theo buổi."),"warn");
                try{await refreshFromServer(false);}catch{}
              }finally{
                aiBusy=false;
                renderDetails(activeFilter);
              }
            });
          }
        };

        openModal("Nội dung · "+session.label,"");
        renderDetails();
      });
    });
  }

  function missingPage(){
    const slots=effectiveSchedule(), rows=[];
    studentUsers().forEach(s=>slots.forEach(sl=>{const r=regFor(s.id,sl.dow,sl.period);if(!r||r.status==="draft")rows.push({s,sl});}));
    const groups=slots.map(sl=>({label:slotLabel(sl.dow,sl.period),students:rows.filter(x=>x.sl.dow===sl.dow&&Number(x.sl.period)===Number(sl.period)).map(x=>({name:esc(x.s.name),code:esc(x.s.code||"")}))})).filter(g=>g.students.length);
    return renderMissingRegistrationsPage({headerHtml:head("Danh sách chưa đăng ký",`Tuần ${week().number} · ${rows.length} lượt còn thiếu`),groups});
  }

  function revisionIssuesPage(){
    const reports=(state.registrations||[]).filter(r=>r.weekId===state.currentWeekId&&isRevisionOverdue(r)).sort((a,b)=>String(revisionReportTime(b)||"").localeCompare(String(revisionReportTime(a)||"")));
    const items=reports.map(r=>{const student=state.users.find(u=>u.id===r.studentId);const reportedAt=revisionReportTime(r);return {studentName:esc(student?.name||""),studentCode:esc(student?.code||""),slotLabel:slotLabel(r.dow,r.period),content:esc(r.content),note:esc(r.note||""),teacherComment:esc(r.teacherComment||"—"),statusHtml:statusBadge("revision_overdue"),reportedAt:reportedAt?new Date(reportedAt).toLocaleString("vi-VN"):"—"};});
    return renderRevisionIssuesPageV850({headerHtml:head("Báo cáo lỗi",`Tuần ${week().number} · ${reports.length} đăng ký không được chỉnh sửa trước giờ bắt đầu tiết`),items});
  }

  function teacherDashboard(){
    const pendingAll=state.registrations.filter(r=>r.weekId===state.currentWeekId&&needsTeacherReview(r));
    const aiWaiting=state.registrations.filter(r=>r.weekId===state.currentWeekId&&r.status==="submitted"&&r.approvalSource==="manual"&&["pending","processing"].includes(r.aiReviewStatus));
    const pending=pendingAll.slice(0,6), st=statsForWeek();
    const unread=(state.notifications||[]).filter(n=>!n.isRead).length;
    const aiAutomationEnabled=isAiAutomationEnabled();
    return renderTeacherDashboardPage({
      headerHtml:head("Dashboard",`Tổng quan hoạt động lớp trong tuần ${week().number}`),bannerHtml:weekBanner(),stats:st,unread,pendingCount:pendingAll.length,
      pendingItems:pending.map(approvalItem).join(""),aiWaiting:aiWaiting.length,aiAutomationEnabled,aiThreshold:Math.round(Number(state.settings.aiAutoApproveThreshold||0.90)*100),
      weekInfo:{number:week().number,dateRange:`${fmtDate(week().startDate)} – ${fmtDate(week().endDate)}`,deadline:deadlineModeLabel(week().deadlineMode),status:weekStatus(effectiveWeekStatus(week()))}
    });
  }

  function kpi(icon,val,label){return `<div class="card kpi"><div class="kpi-icon">${kpiClayIcon(icon)}</div><div><div class="kpi-value">${val}</div><div class="kpi-label">${label}</div></div></div>`;}
  function approvalItem(r){
    const s=state.users.find(u=>u.id===r.studentId);
    return `<div class="approval-item manual-review-item"><div class="approval-content"><div class="person"><span class="avatar">${initials(s?.name||"?")}</span><div><b>${esc(s?.name||"")}</b><div class="tiny muted">${slotLabel(r.dow,r.period)}</div></div></div><p><b>${esc(r.content)}</b></p><p>${esc(r.note||"")}</p>${r.isEmergency?`<div class="callout emergency-callout"><b>🚨 Đăng ký bổ sung</b><br>Lý do: ${esc(r.emergencyReason||"—")}</div>`:""}
      ${(r.aiReason||r.autoReviewReason)?`<div class="review-reason">🧠 <b>Lý do cần GV xem:</b> ${esc(r.aiReason||r.autoReviewReason)}${r.aiConfidence==null?"":` <b>(${Math.round(r.aiConfidence*100)}%)</b>`}</div>`:""}
      ${r.teacherComment?`<p style="color:#7c3aed">💬 ${esc(r.teacherComment)}</p>`:""}</div>
      <div class="approval-actions">${statusBadge(r.status)}${registrationManagerActionButtons(r,{showAiWrong:true})}</div></div>`;
  }
  function bindTeacherActions(root=content){
    root.querySelectorAll(".approve-btn").forEach(button=>button.onclick=async()=>{
      const r=state.registrations.find(x=>x.id===button.dataset.id);
      if(!r||!registrationManagerActions(r).canApprove)return;
      button.disabled=true;
      const previous={status:r.status,approvalSource:r.approvalSource,approvedAt:r.approvedAt};
      r.status="approved";
      r.approvalSource="manual";
      r.approvedAt=Date.now();
      markLocalNotificationReadByReg(r.id);
      audit("Phê duyệt đăng ký",r.id);
      try{
        await saveState();
        await refreshFromServer(false);
        toast("Đã phê duyệt.","success");
      }catch(error){
        Object.assign(r,previous);
        console.error(error);
        toast(safeErrorMessage(error,"Không phê duyệt được đăng ký."),"warn");
        try{await refreshFromServer(false);}catch{}
      }
    });
    root.querySelectorAll(".revise-btn").forEach(b=>b.onclick=()=>teacherComment(b.dataset.id,true));
    root.querySelectorAll(".comment-btn").forEach(b=>b.onclick=()=>teacherComment(b.dataset.id,false));
    root.querySelectorAll(".ai-wrong-btn").forEach(b=>b.onclick=()=>{
      const r=state.registrations.find(x=>x.id===b.dataset.id);
      if(!r||!registrationManagerActions(r).canRequestRevision)return;
      const s=state.users.find(u=>u.id===r.studentId);
      openModal("AI duyệt chưa đúng",`
        <div class="callout warning">
          <b>${esc(s?.name||"Học sinh")}</b> · ${slotLabel(r.dow,r.period)}<br>
          ${esc(r.content)}
        </div>
        <form id="aiWrongForm">
          <label>GV muốn học sinh chỉnh gì?
            <textarea id="aiWrongComment" required placeholder="VD: Cần ghi rõ thiết bị được dùng để làm bài nào/môn nào."></textarea>
          </label>
          <button class="btn btn-warning btn-block" type="submit">Chuyển sang “Cần chỉnh sửa”</button>
        </form>`);
      $("#aiWrongForm").onsubmit=async e=>{
        e.preventDefault();
        const comment=$("#aiWrongComment").value.trim();
        if(!comment){toast("Vui lòng nhập nội dung yêu cầu chỉnh sửa.","warn");return;}
        const submit=e.submitter;if(submit)submit.disabled=true;
        try{
          await prod.requestRegistrationRevision(r.id,comment);
          markLocalNotificationReadByReg(r.id);
          await refreshFromServer(false);
          closeModal();
          toast("Đã hủy duyệt AI và yêu cầu học sinh chỉnh sửa.","success");
        }catch(error){
          console.error(error);
          toast(safeErrorMessage(error,"Không gửi được yêu cầu chỉnh sửa."),"warn");
          try{await refreshFromServer(false);}catch{}
          if(submit)submit.disabled=false;
        }
      };
    });

    root.querySelectorAll(".delete-reg-btn").forEach(b=>b.onclick=async()=>{
      const r=state.registrations.find(x=>x.id===b.dataset.id);
      if(!r||!registrationManagerActions(r).canDelete)return;
      const s=state.users.find(u=>u.id===r.studentId);
      if(!confirm(`Xóa đăng ký của ${s?.name||"học sinh"} - ${slotLabel(r.dow,r.period)}?`))return;

      b.disabled=true;
      try{
        await prod.deleteRegistration(r.id);
        markLocalNotificationReadByReg(r.id);
        audit("Xóa mềm đăng ký",r.id,`${s?.name||""} - ${slotLabel(r.dow,r.period)}`);
        await refreshFromServer(false);
        toast(r.isEmergency?"Đã xóa đăng ký bổ sung.":"Đã xóa đăng ký.","success");
      }catch(error){
        console.error(error);
        toast(safeErrorMessage(error,"Không xóa được đăng ký. Vui lòng thử lại."),"warn");
        try{await refreshFromServer(false);}catch{}
      }
    });
  }
  function teacherComment(id,needsRevision){
    const r=state.registrations.find(x=>x.id===id); if(!r)return;
    const actions=registrationManagerActions(r);
    if(needsRevision&&!actions.canRequestRevision){
      toast(actions.sessionStarted?"Buổi tự học đã bắt đầu; không thể mở lại đăng ký để sửa.":"Đăng ký hiện không thể yêu cầu chỉnh sửa.","warn");
      return;
    }
    openModal(needsRevision?"Yêu cầu chỉnh sửa":"Nhận xét đăng ký",`<form id="commentForm"><label>Nhận xét<textarea id="teacherComment" required>${esc(r.teacherComment||"")}</textarea></label><button class="btn ${needsRevision?"btn-warning":"btn-primary"} btn-block">${needsRevision?"Gửi yêu cầu sửa":"Lưu nhận xét"}</button></form>`);
    $("#commentForm").onsubmit=async e=>{
      e.preventDefault();
      const comment=$("#teacherComment").value.trim();
      if(!comment){toast("Vui lòng nhập nội dung nhận xét.","warn");return;}
      const submit=e.submitter;if(submit)submit.disabled=true;
      if(needsRevision){
        try{
          await prod.requestRegistrationRevision(r.id,comment);
          markLocalNotificationReadByReg(r.id);
          await refreshFromServer(false);
          closeModal();
          toast("Đã yêu cầu học sinh chỉnh sửa đăng ký.","success");
        }catch(error){
          console.error(error);
          toast(safeErrorMessage(error,"Không gửi được yêu cầu chỉnh sửa."),"warn");
          try{await refreshFromServer(false);}catch{}
          if(submit)submit.disabled=false;
        }
        return;
      }

      r.teacherComment=comment;
      audit("Nhận xét",r.id,r.teacherComment);
      try{
        await saveState();
        await refreshFromServer(false);
        closeModal();
        toast("Đã lưu phản hồi.","success");
      }catch(error){
        console.error(error);
        toast(safeErrorMessage(error,"Không lưu được phản hồi."),"warn");
        try{await refreshFromServer(false);}catch{}
        if(submit)submit.disabled=false;
      }
    };
  }
  function approvalsPage(){
    const allWeek=(state.registrations||[]).filter(r=>r.weekId===state.currentWeekId).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
    const pending=allWeek.filter(needsTeacherReview);
    const aiWaiting=allWeek.filter(r=>!r.isEmergency&&r.status==="submitted"&&r.approvalSource==="manual"&&["pending","processing"].includes(r.aiReviewStatus));
    const filterDefs=[["attention","Cần xử lý"],["approved","Đã duyệt"],["revision","Cần sửa"],["all","Tất cả"]];
    const matchesFilter=r=>approvalFilter==="approved"?r.status==="approved":approvalFilter==="revision"?r.status==="needs_revision"&&!isRevisionOverdue(r):approvalFilter==="all"?true:needsTeacherReview(r);
    const filteredWeek=allWeek.filter(matchesFilter);
    const filterCount=key=>key==="approved"?allWeek.filter(r=>r.status==="approved").length:key==="revision"?allWeek.filter(r=>r.status==="needs_revision"&&!isRevisionOverdue(r)).length:key==="all"?allWeek.length:pending.length;
    const filters=filterDefs.map(([id,label])=>({id,label,count:filterCount(id)}));
    const items=filteredWeek.map(r=>{
      const student=state.users.find(u=>u.id===r.studentId);
      const sourceBadge=r.status==="approved"&&r.approvalSource==="ai"?`<span class="ai-review-badge">AI${r.aiConfidence==null?"":` ${Math.round(r.aiConfidence*100)}%`}</span>`:`<span class="manual-review-badge">GV</span>`;
      return {id:r.id,studentName:esc(student?.name||""),studentCode:esc(student?.code||""),initials:initials(student?.name||"?"),slotLabel:slotLabel(r.dow,r.period),content:esc(r.content),note:esc(r.note||""),
        statusHtml:statusBadge(effectiveRegistrationStatus(r)),teacherComment:esc(r.teacherComment||""),aiReason:esc(r.aiReason||r.autoReviewReason||""),aiBadge:sourceBadge,emergencyReason:r.isEmergency?esc(r.emergencyReason||"—"):"",
        actionsHtml:registrationManagerActionButtons(r,{showAiWrong:true})};
    });
    if(!items.some(item=>item.id===approvalSelectedId))approvalSelectedId=items[0]?.id||"";
    return renderApprovalsWorkbench({
      headerHtml:head("Duyệt đăng ký",`${pending.length} đăng ký đang cần giáo viên xử lý`,pending.length?`<button class="btn btn-success" id="approveAll">Duyệt tất cả đang chờ</button>`:""),
      filters,activeFilter:approvalFilter,items,selectedId:approvalSelectedId,weekNumber:week().number,aiWaiting:aiWaiting.length,emergencyCount:allWeek.filter(r=>r.isEmergency).length
    });
  }

  function schedulePage(){
    const current=effectiveSchedule(), activeKeys=new Set(current.map(s=>`${s.dow}-${s.period}`));
    return renderSchedulePage({
      headerHtml:head("TKB tự học","Bật/tắt tiết tự học. Mặc định áp dụng cho toàn bộ tuần.",`<div class="toolbar"><label style="margin:0"><input id="weekSpecific" type="checkbox" style="width:auto"> Áp dụng riêng tuần ${week().number}</label><button id="saveSchedule" class="btn btn-primary">Lưu TKB</button></div>`),
      days:DOW,periods:state.periods,activeKeys,weekNumber:week().number
    });
  }
  function bindSchedule(){
    content.querySelectorAll(".slot-btn").forEach(b=>b.onclick=()=>{b.classList.toggle("active");b.textContent=b.classList.contains("active")?"●":"○";});
    $("#saveSchedule")?.addEventListener("click",()=>{
      const slots=[...content.querySelectorAll(".slot-btn.active")].map(b=>{const [dow,p]=b.dataset.slot.split("-").map(Number);return{dow,period:p}});
      if($("#weekSpecific").checked){
        state.overrides=state.overrides.filter(o=>o.weekId!==state.currentWeekId);
        slots.forEach(s=>state.overrides.push({weekId:state.currentWeekId,dow:s.dow,period:s.period,active:true}));
        audit("Cập nhật TKB riêng tuần",state.currentWeekId,`${slots.length} tiết`);
      }else{
        state.schedule=slots;
        state.overrides=[];
        audit("Cập nhật TKB mặc định","schedule",`${slots.length} tiết`);
      }
      saveState();toast("Đã lưu thời khóa biểu.","success");render();
    });
  }

  function weeksPage(){
    const first=state.weeks[0];
    const weeks=state.weeks.map(w=>{const mode=w.deadlineMode||"per_session_20";const effective=effectiveWeekStatus(w);const auto=automaticWeekStatus(w);return {id:w.id,number:w.number,dateRange:`${fmtDate(w.startDate)} – ${fmtDate(w.endDate)}`,statusHtml:`<span class="status ${effective==="open"?"approved":effective==="locked"?"missing":"draft"}">${weekStatus(effective)}</span>`,holiday:w.status==="holiday",autoStatus:w.status==="holiday"?"Đã đặt là tuần nghỉ.":`Tự động: ${weekStatus(auto)}.`,mode,deadline:w.deadline||"",deadlineSummary:deadlineSummary(w),isCurrent:w.id===state.currentWeekId,open:w.id===state.currentWeekId};});
    return renderWeeksPage({
      headerHtml:head("Quản lý tuần","Mỗi tuần là một khối riêng. Tuần đang xem được mở sẵn; có thể mở hoặc thu gọn toàn bộ.",`<div class="toolbar"><button class="btn btn-ghost" id="goCurrentWeek">Tuần hiện hành</button><button class="btn btn-primary" id="saveWeeks">Lưu cấu hình</button></div>`),
      firstWeek:first?{startDate:first.startDate,dateRange:`${fmtDate(first.startDate)} – ${fmtDate(first.endDate)}`} : null,weeks,registrationDeadline:registrationDeadlineTime(),isAdmin:currentUser.role==="admin"
    });
  }

  function bindWeeks(){
    const setWeekOpen=(card,open)=>{if(!card)return;card.classList.toggle("is-open",open);card.querySelector("[data-week-toggle]")?.setAttribute("aria-expanded",String(open));};
    content.querySelectorAll("[data-week-toggle]").forEach(button=>button.addEventListener("click",()=>{const card=button.closest(".week-accordion-card");setWeekOpen(card,!card.classList.contains("is-open"));}));
    $("#expandAllWeeks")?.addEventListener("click",()=>content.querySelectorAll(".week-accordion-card").forEach(card=>setWeekOpen(card,true)));
    $("#collapseAllWeeks")?.addEventListener("click",()=>content.querySelectorAll(".week-accordion-card").forEach(card=>setWeekOpen(card,false)));
    $("#applyWeekCalendar")?.addEventListener("click",async()=>{
      const start=$("#week1Start").value;
      if(!start){toast("Hãy chọn ngày bắt đầu Tuần 1.","warn");return;}
      const d=new Date(`${start}T00:00:00Z`);
      if(d.getUTCDay()!==1){
        toast("Ngày bắt đầu Tuần 1 phải là Thứ Hai.","warn");return;
      }
      if(!confirm(`Xếp lại lịch với Tuần 1 bắt đầu ${fmtDate(start)}? Trạng thái mở/khóa sẽ được tính tự động.`))return;

      try{
        await prod.teacherRebaseWeeks(start,registrationDeadlineTime());
        toast("Đã xếp lại lịch. Cửa sổ hai tuần mở sẽ tự cập nhật theo buổi học cuối cùng.","success");
        await refreshFromServer(false);
      }catch(err){
        console.error(err);
        toast(safeErrorMessage(err,"Không xếp lại được lịch tuần. Vui lòng thử lại."),"warn");
      }
    });

    content.querySelectorAll(".week-deadline-mode").forEach(sel=>sel.addEventListener("change",()=>{
      const row=sel.closest(".week-accordion-card");
      const input=row?.querySelector(".week-deadline");
      if(input)input.disabled=sel.value!=="specific";
      const w=state.weeks.find(x=>x.id===sel.dataset.id);
      if(w){
        w.deadlineMode=sel.value;
        const preview=row?.querySelector(".deadline-preview");
        if(preview)preview.textContent=deadlineSummary(w);
      }
    }));

    $("#saveWeeks")?.addEventListener("click",async()=>{
      let invalid=false;

      content.querySelectorAll(".week-holiday").forEach(el=>{
        const w=state.weeks.find(x=>x.id===el.dataset.id);
        if(!w)return;
        w.status=el.checked?"holiday":automaticWeekStatus(w);
      });

      content.querySelectorAll(".week-deadline-mode").forEach(el=>{
        const w=state.weeks.find(x=>x.id===el.dataset.id);
        if(w)w.deadlineMode=el.value;
      });

      content.querySelectorAll(".week-deadline").forEach(el=>{
        const w=state.weeks.find(x=>x.id===el.dataset.id);
        if(!w)return;
        if((w.deadlineMode||"per_session_20")==="specific"&&!el.value){
          invalid=true;
          el.focus();
          return;
        }
        w.deadline=(w.deadlineMode==="specific")?el.value:"";
      });

      if(invalid){
        toast("Tuần dùng “Hạn cụ thể” phải có ngày và giờ.","warn");
        return;
      }

      audit("Cập nhật tuần học","weeks");
      try{
        await saveState();
        toast("Đã lưu. Trạng thái tuần sẽ tự động theo buổi học cuối cùng.","success");
        await refreshFromServer(false);
      }catch{}
    });

    content.querySelectorAll(".view-week").forEach(b=>b.onclick=async()=>{
      const current=actualWeek();
      weekSelectionTouched=b.dataset.id!==current?.id;
      await selectWeek(b.dataset.id,{announce:true});
    });

    $("#goCurrentWeek")?.addEventListener("click",async()=>{
      const w=actualWeek();
      if(!w){toast("Chưa có tuần học nào.","warn");return;}
      weekSelectionTouched=false;
      await selectWeek(w.id,{announce:true});
    });
  }

  function weekStatus(x){return {open:"🟢 Đang mở",locked:"🔒 Đã khóa",upcoming:"🕒 Sắp tới",holiday:"🏖️ Nghỉ"}[x]||x;}

  function studentsPage(){
    state.studentsUi=state.studentsUi||{query:"",role:"all",status:"active"};
    const ui=state.studentsUi;
    const allUsers=state.users
      .filter(u=>u.role!=="teacher" && !String(u.code||"").startsWith("__deleted__"))
      .sort(compareByCode);
    const q=(ui.query||"").trim().toLowerCase();
    const filtered=allUsers.filter(u=>{
      const hitText=!q || String(u.code||"").toLowerCase().includes(q) || String(u.name||"").toLowerCase().includes(q);
      const hitRole=ui.role==="all" || u.role===ui.role;
      const hitStatus=ui.status==="all" || (ui.status==="active"?!!u.active:(ui.status==="deleted"?!u.active:true));
      return hitText && hitRole && hitStatus;
    });
    return renderStudentsManagementPage({
      headerHtml:head("Quản lý học sinh","Quản lý tài khoản học sinh, cán sự và trạng thái sử dụng trong lớp."),
      users:allUsers,
      filteredUsers:filtered,
      query:ui.query,
      role:ui.role,
      status:ui.status,
      counts:{
        student:allUsers.filter(u=>u.role==="student").length,
        monitor:allUsers.filter(u=>u.role==="monitor").length,
        active:allUsers.filter(u=>u.active).length,
        deleted:allUsers.filter(u=>!u.active).length
      },
      escapeHtml:esc,
      iconFor:uiIcon,
      initialsFor:initials,
      roleLabels:roleLabel
    });
  }

  function bindStudents(){
    state.studentsUi=state.studentsUi||{query:"",role:"all",status:"active"};

    $("#studentSearch")?.addEventListener("input",e=>{
      state.studentsUi.query=e.target.value;
      render();
    });
    $("#studentRoleFilter")?.addEventListener("change",e=>{
      state.studentsUi.role=e.target.value;
      render();
    });
    $("#studentStatusFilter")?.addEventListener("change",e=>{
      state.studentsUi.status=e.target.value;
      render();
    });
    $("#clearStudentFilters")?.addEventListener("click",()=>{
      state.studentsUi={query:"",role:"all",status:"active"};
      render();
    });
    content.querySelectorAll(".copy-code-btn").forEach(btn=>btn.addEventListener("click",async()=>{
      const code=btn.dataset.code||"";
      try{
        if(navigator.clipboard?.writeText){
          await navigator.clipboard.writeText(code);
        }else{
          const tmp=document.createElement("input");
          tmp.value=code; document.body.appendChild(tmp); tmp.select();
          document.execCommand("copy"); tmp.remove();
        }
        toast(`Đã sao chép mã ${code}.`,"success");
      }catch(err){
        console.error(err);
        toast("Không sao chép được mã đăng nhập.","warn");
      }
    }));

    $("#addStudentBtn")?.addEventListener("click",()=>{
      openModal("Thêm học sinh",`
        <form id="addStudentForm">
          <div class="callout">Tạo ngay tài khoản đăng nhập Supabase và hồ sơ học sinh. Nếu để trống mật khẩu, hệ thống sẽ tự sinh mật khẩu tạm.</div>
          <label>Mã đăng nhập *
            <input id="newStudentCode" maxlength="32" required pattern="[A-Za-z0-9._-]{2,32}" placeholder="VD: 10A1-33">
          </label>
          <label>Họ và tên *
            <input id="newStudentName" maxlength="120" required placeholder="Nguyễn Văn A">
          </label>
          <label>Vai trò
            <select id="newStudentRole">
              <option value="student">Học sinh</option>
              <option value="monitor">Cán sự lớp</option>
            </select>
          </label>
          <label>Mật khẩu tạm
            ${renderPasswordField({
              id:"newStudentPassword",
              autocomplete:"new-password",
              required:false,
              placeholder:"Để trống để tự sinh"
            })}
            <small>Nếu tự nhập: ít nhất 8 ký tự và có cả chữ lẫn số.</small>
          </label>
          <div class="toolbar">
            <button class="btn btn-ghost" type="button" id="cancelAddStudent">Hủy</button>
            <button class="btn btn-primary right" type="submit">Tạo tài khoản</button>
          </div>
        </form>`);
      $("#cancelAddStudent").onclick=closeModal;
      $("#addStudentForm").onsubmit=async e=>{
        e.preventDefault();
        const changes={
          code:$("#newStudentCode").value.trim().toUpperCase(),
          fullName:$("#newStudentName").value.trim(),
          role:$("#newStudentRole").value,
          classId:state.activeClassId,
          password:$("#newStudentPassword").value.trim()
        };
        if(!/^[A-Z0-9._-]{2,32}$/.test(changes.code)){
          toast("Mã chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.","warn");return;
        }
        const passwordRules=validateStudentPassword(changes.password);
        if(changes.password && (!passwordRules.hasMinLength||!passwordRules.hasLetterAndNumber)){
          toast("Mật khẩu cần ít nhất 8 ký tự và có cả chữ lẫn số.","warn");return;
        }

        try{
            const result=await prod.teacherCreateUser(changes);
            openModal("Đã thêm học sinh",`
              <div class="success-account-card">
                <div class="success-icon">🎉</div>
                <h3>${esc(result.user?.fullName||changes.fullName)}</h3>
                <p>Mã đăng nhập</p><div class="credential-box">${esc(result.user?.code||changes.code)}</div>
                <p>Mật khẩu tạm</p><div class="credential-box">${esc(result.password||changes.password)}</div>
                <div class="callout warning">Hãy chép mật khẩu này và gửi riêng cho học sinh. Mật khẩu hiện tại không thể xem lại sau khi đóng cửa sổ.</div>
                <button class="btn btn-primary btn-block" id="finishAddStudent">Đã lưu thông tin</button>
              </div>`);
            $("#finishAddStudent").onclick=async()=>{closeModal();await refreshFromServer(false);};
        }catch(err){
          console.error(err);toast(safeErrorMessage(err,"Không thêm được học sinh. Vui lòng thử lại."),"warn");
        }
      };
    });

    content.querySelectorAll(".edit-user-btn").forEach(btn=>btn.addEventListener("click",()=>{
      const u=state.users.find(x=>x.id===btn.dataset.id); if(!u)return;
      openModal("Sửa tài khoản học sinh",`
        <form id="editUserForm">
          <div class="callout">Mã hiện tại: <b>${esc(u.code)}</b></div>
          <label class="toggle-row">
            <input id="changeCodeToggle" type="checkbox">
            <span>
              <b>Đổi mã đăng nhập</b>
              <small>Nếu chỉ đổi vai trò, trạng thái hoặc họ tên thì không cần nhập lại mã.</small>
            </span>
          </label>
          <div id="editCodeWrap" class="hidden">
            <label>Mã đăng nhập mới *
              <input id="editUserCode" value="${esc(u.code)}" maxlength="32"
                pattern="[A-Za-z0-9._-]{2,32}" placeholder="VD: 10A1-05">
            </label>
          </div>
          <label>Họ và tên *
            <input id="editUserName" value="${esc(u.name)}" maxlength="120" required>
          </label>
          <label>Vai trò
            <select id="editUserRole">
              <option value="student" ${u.role==="student"?"selected":""}>Học sinh</option>
              <option value="monitor" ${u.role==="monitor"?"selected":""}>Cán sự lớp</option>
            </select>
          </label>
          ${currentUser.role==="admin"?`<label>Lớp
            <select id="editUserClass">${(state.availableClasses||[]).map(c=>`<option value="${c.id}" ${c.id===(u.classId||state.activeClassId)?"selected":""}>${esc(c.code||c.name)}</option>`).join("")}</select>
            <small>Chỉ quản trị viên gốc được chuyển lớp.</small>
          </label>`:""}
          <label style="display:flex;align-items:center;gap:8px">
            <input id="editUserActive" type="checkbox" style="width:auto" ${u.active?"checked":""}>
            Tài khoản đang hoạt động
          </label>
          <div class="toolbar">
            <button class="btn btn-ghost" type="button" id="cancelEditUser">Hủy</button>
            <button class="btn btn-primary right" type="submit">Lưu tài khoản</button>
          </div>
        </form>`);
      $("#cancelEditUser").onclick=closeModal;
      $("#changeCodeToggle")?.addEventListener("change",e=>{
        const on=e.target.checked;
        $("#editCodeWrap")?.classList.toggle("hidden",!on);
        const input=$("#editUserCode");
        if(input){
          input.required=on;
          if(on) setTimeout(()=>input.focus(),20);
        }
      });
      $("#editUserForm").onsubmit=async e=>{
        e.preventDefault();
        const changeCode=$("#changeCodeToggle")?.checked;
        const changes={
          changeCode:!!changeCode,
          code:changeCode ? $("#editUserCode").value.trim().toUpperCase() : u.code,
          fullName:$("#editUserName").value.trim(),
          role:$("#editUserRole").value,
          active:$("#editUserActive").checked,
          classId:currentUser.role==="admin"?($("#editUserClass")?.value||u.classId||state.activeClassId):(u.classId||state.activeClassId)
        };
        if(changeCode && !/^[A-Z0-9._-]{2,32}$/.test(changes.code)){
          toast("Mã chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.","warn");return;
        }
        try{
            await prod.teacherUpdateUser(u.id,changes);
            closeModal();
            toast(`Đã cập nhật ${changes.code}.`,"success");
            await refreshFromServer(false);
        }catch(err){
          console.error(err);toast(safeErrorMessage(err,"Không cập nhật được tài khoản. Vui lòng thử lại."),"warn");
        }
      };
    }));

    content.querySelectorAll(".delete-user-btn").forEach(btn=>btn.addEventListener("click",()=>{
      const u=state.users.find(x=>x.id===btn.dataset.id); if(!u)return;
      openModal("Xóa học sinh",`
        <div class="danger-zone-card">
          <div class="danger-zone-icon">${uiIcon("delete")}</div>
          <h3>${esc(u.name)}</h3>
          <p>Mã đăng nhập: <b>${esc(u.code)}</b></p>
          <div class="callout warning">
            <b>Đây là xóa mềm, không xóa lịch sử.</b><br>
            Tài khoản sẽ bị vô hiệu hóa và biến khỏi danh sách mặc định. Lịch sử đăng ký vẫn được giữ; có thể khôi phục từ bộ lọc <b>Đã xóa</b>.
          </div>
          <form id="deleteUserForm">
            <label>Nhập lại mã <b>${esc(u.code)}</b> để xác nhận
              <input id="deleteUserConfirmCode" autocomplete="off" required placeholder="${esc(u.code)}">
            </label>
            <div class="toolbar">
              <button class="btn btn-ghost" type="button" id="cancelDeleteUser">Hủy</button>
              <button class="btn btn-danger right" type="submit">Xóa học sinh</button>
            </div>
          </form>
        </div>`);
      $("#cancelDeleteUser").onclick=closeModal;
      $("#deleteUserForm").onsubmit=async e=>{
        e.preventDefault();
        const confirmCode=$("#deleteUserConfirmCode").value.trim().toUpperCase();
        if(confirmCode!==String(u.code||"").toUpperCase()){
          toast("Mã xác nhận chưa đúng.","warn");return;
        }
        try{
            await prod.teacherDeleteUser(u.id,confirmCode);
            closeModal();
            toast(`Đã xóa ${u.code} khỏi danh sách; lịch sử được giữ lại.`,"success");
            await refreshFromServer(false);
        }catch(err){
          console.error(err);toast(safeErrorMessage(err,"Không xóa được tài khoản. Vui lòng thử lại."),"warn");
        }
      };
    }));

    content.querySelectorAll(".restore-user-btn").forEach(btn=>btn.addEventListener("click",()=>{
      const u=state.users.find(x=>x.id===btn.dataset.id); if(!u)return;
      openModal("Khôi phục học sinh",`
        <div class="restore-user-card">
          <div class="restore-user-icon">${uiIcon("restore")}</div>
          <h3>${esc(u.name)}</h3>
          <p>Mã đăng nhập: <b>${esc(u.code)}</b></p>
          <div class="callout">
            Tài khoản sẽ được kích hoạt lại và học sinh có thể đăng nhập bằng mã hiện tại.
          </div>
          <div class="toolbar">
            <button class="btn btn-ghost" type="button" id="cancelRestoreUser">Hủy</button>
            <button class="btn btn-primary right" type="button" id="confirmRestoreUser">Khôi phục</button>
          </div>
        </div>`);
      $("#cancelRestoreUser").onclick=closeModal;
      $("#confirmRestoreUser").onclick=async()=>{
        try{
          await prod.teacherUpdateUser(u.id,{
            changeCode:false,
            code:u.code,
            fullName:u.name,
            role:u.role,
            active:true,
            classId:u.classId||state.activeClassId
          });
          closeModal();
          toast(`Đã khôi phục tài khoản ${u.code}.`,"success");
          await refreshFromServer(false);
        }catch(err){
          console.error(err);toast(safeErrorMessage(err,"Không khôi phục được tài khoản. Vui lòng thử lại."),"warn");
        }
      };
    }));

    content.querySelectorAll(".reset-password-btn").forEach(btn=>btn.addEventListener("click",()=>{
      const u=state.users.find(x=>x.id===btn.dataset.id); if(!u)return;
      openModal("Đặt lại mật khẩu",`
        <div class="callout"><b>${esc(u.name)}</b> · ${esc(u.code)}</div>
        <form id="teacherResetPasswordForm">
          <label>Mật khẩu tạm mới
            ${renderPasswordField({id:"teacherNewPassword",autocomplete:"new-password"})}
          </label>
          <small>Ít nhất 8 ký tự và có cả chữ lẫn số.</small>
          <label>Nhập lại mật khẩu
            ${renderPasswordField({id:"teacherNewPassword2",autocomplete:"new-password"})}
          </label>
          <button class="btn btn-primary btn-block" type="submit">Đặt lại mật khẩu</button>
        </form>`);
      $("#teacherResetPasswordForm").onsubmit=async e=>{
        e.preventDefault();
        const p1=$("#teacherNewPassword").value,p2=$("#teacherNewPassword2").value;
        const rules=validateStudentPassword(p1);
        if(!rules.hasMinLength||!rules.hasLetterAndNumber){toast("Mật khẩu chưa đạt đủ hai tiêu chí.","warn");return;}
        if(p1!==p2){toast("Hai mật khẩu chưa khớp.","warn");return;}
        try{
          await prod.teacherResetPassword(u.id,p1);
          closeModal();
          toast(`Đã đặt lại mật khẩu cho ${u.code}.`,"success");
        }catch(err){console.error(err);toast(safeErrorMessage(err,"Không đặt lại được mật khẩu. Vui lòng thử lại."),"warn");}
      };
    }));
  }

  function statsPage(){
    const current=statsForWeek();
    const rows=state.weeks.slice(0,12).map(w=>{
      const old=state.currentWeekId; state.currentWeekId=w.id; const st=statsForWeek(); state.currentWeekId=old;
      return {w,rate:st.rate,valid:st.valid,issues:st.issues,missing:st.missing,total:st.total};
    });
    return renderStatisticsPage({
      headerHtml:head("Thống kê","Tỷ lệ hoàn thành hợp lệ và xu hướng đăng ký theo tuần."),
      current,
      rows,
      iconFor:uiIcon
    });
  }

  function csvCell(value){
    let text=String(value??"");
    if(/^[=+\-@]/.test(text))text="'"+text;
    return `"${text.replace(/"/g,'""')}"`;
  }

  function bindStats(){
    $("#exportCsv")?.addEventListener("click",()=>{
      const slots=effectiveSchedule();
      const lines=[
        ["Mã","Họ tên",...slots.map(s=>`${DOW[s.dow]}-T${s.period}`)]
          .map(csvCell)
          .join(",")
      ];
      studentUsers().forEach(student=>{
        lines.push([
          student.code,
          student.name,
          ...slots.map(sl=>{
            const r=regFor(student.id,sl.dow,sl.period);
            return statusLabel[effectiveRegistrationStatus(r)]||"Chưa đăng ký";
          })
        ].map(csvCell).join(","));
      });
      const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"}), a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`so-tu-hoc-tuan-${week().number}.csv`;a.click();URL.revokeObjectURL(a.href);
      toast("Đã tạo file CSV.","success");
    });
  }

  function adminPage(){
    if(currentUser?.role!=="admin")return head("Quản trị lớp","Chỉ quản trị viên gốc được sử dụng mục này.")+empty("🔒","Không có quyền truy cập.");
    return renderAdminPageShell({
      headerHtml:head("Quản trị lớp","Quản lý lớp, giáo viên và phân quyền theo từng khu vực riêng."),
      activeClasses:state.availableClasses||[],
      escapeHtml:esc,
      iconFor:uiIcon
    });
  }

  function bindAdmin(){
    if(currentUser?.role!=="admin")return;
    const adminRoot=$("#adminPageV850");
    if(!adminRoot)return;
    const selectAdminTab=tab=>{
      adminRoot.dataset.adminCurrentTab=tab||"overview";
      adminRoot.querySelectorAll("[data-admin-tab]").forEach(item=>{
        const active=item.dataset.adminTab===adminRoot.dataset.adminCurrentTab;
        item.classList.toggle("active",active);
        item.setAttribute("aria-selected",String(active));
      });
    };
    adminRoot?.querySelectorAll("[data-admin-tab]").forEach(button=>button.addEventListener("click",()=>selectAdminTab(button.dataset.adminTab)));
    adminRoot?.querySelectorAll("[data-admin-goto-tab]").forEach(button=>button.addEventListener("click",()=>selectAdminTab(button.dataset.adminGotoTab)));

    const openActiveClass=classId=>{
      const select=$("#globalClassSelect");
      if(!select||![...select.options].some(o=>o.value===classId)){
        toast("Lớp đang bị khóa nên không thể mở làm lớp làm việc.","warn");
        return;
      }
      select.value=classId;
      select.dispatchEvent(new Event("change"));
    };

    const loadDirectory=async({force=false}={})=>{
      const cached=state.adminDirectory;
      const cacheFresh=!force&&cached?.loadedAt&&Date.now()-cached.loadedAt<ADMIN_DIRECTORY_CACHE_MS;
      if(!cacheFresh)setGlobalLoading(true,"Đang tải phân quyền lớp...");
      try{
        const data=cacheFresh?cached:await prod.adminManageClasses("list");
        const classes=data.classes||[],teachers=data.teachers||[],assignments=data.assignments||[];
        const box=$("#adminClassDirectory");if(!box)return;
        if(!cacheFresh)state.adminDirectory={classes,teachers,assignments,loadedAt:Date.now()};
        const activeClasses=classes.filter(c=>c.active!==false);
        const activeTeachers=teachers.filter(t=>t.active!==false);
        const activeAssignments=assignments.filter(a=>a.active!==false);
        const summary=$("#adminSummaryCards");
        if(summary)setSafeHtml(summary,`
          <span><small>Lớp hoạt động</small><b>${activeClasses.length}</b></span>
          <span><small>Giáo viên hoạt động</small><b>${activeTeachers.length}</b></span>
          <span><small>Phân quyền đang bật</small><b>${activeAssignments.length}</b></span>`);

        const classCards=classes.map(c=>{
          const active=c.active!==false;
          const blockers=Array.isArray(c.deleteBlockers)?c.deleteBlockers:[];
          const blockerText=blockers.map(item=>item.message||item.code).filter(Boolean).join(" ");
          const assignedTeachers=teachers.filter(t=>assignments.some(a=>a.class_id===c.id&&a.teacher_id===t.id&&a.active!==false));
          return `<article class="admin-class-card ${active?"":"is-inactive"}" data-admin-class-card="${c.id}">
            <div class="admin-class-card-main">
              <div class="admin-class-title-row">
                <div class="admin-class-symbol">${esc(String(c.code||"L").slice(0,2))}</div>
                <div><h4>${esc(c.code)} · ${esc(c.name||c.code)}</h4><span class="admin-status-pill ${active?"is-active":"is-inactive"}">${active?"Đang hoạt động":"Đã khóa"}</span></div>
              </div>
              <div class="admin-class-metrics">
                <span><small>HS/cán sự</small><b>${Number(c.learnerCount||0)}</b></span>
                <span><small>Hồ sơ</small><b>${Number(c.profileCount||0)}</b></span>
                <span><small>Đăng ký</small><b>${Number(c.registrationCount||0)}</b></span>
                <span><small>GV phụ trách</small><b>${assignedTeachers.length}</b></span>
              </div>
              ${assignedTeachers.length?`<div class="admin-class-teacher-chips">${assignedTeachers.map(t=>`<span>${esc(t.full_name||t.student_code||"GV")}</span>`).join("")}</div>`:`<div class="tiny muted">Chưa có giáo viên phụ trách.</div>`}
              ${!c.canDelete&&blockers.length?`<div class="admin-delete-blockers"><b>Chưa thể xóa lớp:</b>${blockers.map(item=>`<span>${esc(item.message||item.code)}</span>`).join("")}</div>`:""}
            </div>
            <div class="admin-class-card-actions">
              ${active?`<button class="btn btn-ghost admin-directory-open" data-id="${c.id}">${uiIcon("open")}<span>Mở lớp</span></button>`:""}
              <button class="btn btn-ghost admin-class-learners" data-id="${c.id}" data-code="${esc(c.code)}">${uiIcon("students")}<span>Học sinh</span></button>
              <button class="btn btn-ghost admin-edit-class" data-id="${c.id}" data-code="${esc(c.code)}" data-name="${esc(c.name||c.code)}">${uiIcon("edit")}<span>Sửa lớp</span></button>
              <button class="btn btn-ghost ${active?"danger":""} admin-toggle-class" data-id="${c.id}" data-active="${active}">${uiIcon(active?"lock":"restore")}<span>${active?"Khóa lớp":"Kích hoạt"}</span></button>
              <button class="btn btn-danger admin-delete-class" data-id="${c.id}" data-code="${esc(c.code)}" data-can-delete="${c.canDelete===true}" ${c.canDelete===true?"":"disabled"} title="${esc(c.canDelete===true?"Xóa vĩnh viễn lớp rỗng":blockerText||"Lớp còn dữ liệu nên không thể xóa")}">${uiIcon("delete")}<span>Xóa lớp</span></button>
            </div>
            <div class="admin-learner-panel hidden" id="adminClassLearners-${c.id}" data-class-id="${c.id}"></div>
          </article>`;
        }).join("")||`<p class="muted">Chưa có lớp nào.</p>`;

        const permissionRows=teachers.map(t=>{
          const assigned=activeClasses.filter(c=>assignments.some(a=>a.class_id===c.id&&a.teacher_id===t.id&&a.active!==false));
          return `<div class="admin-permission-row ${t.active===false?"is-inactive":""}">
            <div class="admin-permission-person"><span class="avatar">${initials(t.full_name||t.student_code||"GV")}</span><div><b>${esc(t.full_name||t.student_code||"Giáo viên")}</b><small>${esc(t.student_code||"")} · ${assigned.length} lớp</small></div></div>
            <div class="admin-permission-classes">${activeClasses.map(c=>{
              const on=assignments.some(a=>a.class_id===c.id&&a.teacher_id===t.id&&a.active!==false);
              return `<label class="admin-permission-chip"><input class="admin-teacher-assignment" type="checkbox" data-class="${c.id}" data-teacher="${t.id}" ${on?"checked":""} ${t.active===false?"disabled":""}><span>${esc(c.code)}</span></label>`;
            }).join("")||`<span class="tiny muted">Chưa có lớp hoạt động.</span>`}</div>
          </div>`;
        }).join("")||`<div class="learning-empty-mini">Chưa có giáo viên để phân quyền.</div>`;

        const teacherCards=teachers.map(teacher=>{
          const assigned=classes.filter(c=>assignments.some(a=>a.class_id===c.id&&a.teacher_id===teacher.id&&a.active!==false));
          const active=teacher.active!==false;
          return `<article class="admin-teacher-card ${active?"":"is-inactive"}">
            <div class="admin-teacher-card-head">
              <div class="admin-permission-person"><span class="avatar">${initials(teacher.full_name||teacher.student_code||"GV")}</span><div><b>${esc(teacher.full_name||teacher.student_code||"Giáo viên")}</b><small>${esc(teacher.student_code||"")}</small></div></div>
              <span class="admin-status-pill ${active?"is-active":"is-inactive"}">${active?"Hoạt động":"Đã khóa"}</span>
            </div>
            <div class="admin-teacher-meta"><span>${uiIcon("class")} ${assigned.length?assigned.map(c=>esc(c.code)).join(" · "):"Chưa được phân lớp"}</span></div>
            <div class="admin-teacher-actions">
              <button class="btn btn-ghost admin-toggle-teacher" data-id="${teacher.id}" data-active="${active}" data-code="${esc(teacher.student_code||"")}" data-name="${esc(teacher.full_name||"")}">${uiIcon(active?"lock":"restore")}<span>${active?"Khóa":"Mở khóa"}</span></button>
              ${active?`<button class="btn btn-ghost danger admin-delete-teacher" data-id="${teacher.id}" data-code="${esc(teacher.student_code||"")}" data-name="${esc(teacher.full_name||"")}">${uiIcon("delete")}<span>Xóa giáo viên</span></button>`:""}
            </div>
          </article>`;
        }).join("")||`<div class="learning-empty-mini">Chưa có giáo viên.</div>`;

        setSafeHtml(box,`
          <section class="admin-directory-section admin-class-directory">
            <div class="admin-block-heading"><div><span class="section-kicker">01 · LỚP HỌC</span><h4>Danh mục lớp</h4><p>Quản lý trạng thái lớp và dữ liệu học sinh.</p></div><span class="section-count-badge">${classes.length}</span></div>
            <div class="admin-class-card-grid">${classCards}</div>
          </section>
          <section class="admin-directory-section admin-permission-matrix">
            <div class="admin-block-heading"><div><span class="section-kicker">02 · PHÂN QUYỀN</span><h4>Giáo viên phụ trách lớp</h4><p>Bật/tắt quyền theo ma trận; mỗi ô là một lớp đang hoạt động.</p></div><span class="section-count-badge">${activeAssignments.length}</span></div>
            <div class="admin-permission-list">${permissionRows}</div>
          </section>
          <section class="admin-directory-section admin-teacher-directory">
            <div class="admin-block-heading"><div><span class="section-kicker">03 · GIÁO VIÊN</span><h4>Tài khoản giáo viên</h4><p>Khóa, mở lại hoặc xóa mềm giáo viên. Xóa mềm giữ lịch sử và vô hiệu phân quyền lớp.</p></div><span class="section-count-badge">${teachers.length}</span></div>
            <div class="admin-teacher-grid">${teacherCards}</div>
          </section>`);
        scheduleOwlRouteContext({force:true,delay:500});

        box.querySelectorAll(".admin-directory-open").forEach(btn=>btn.addEventListener("click",()=>openActiveClass(btn.dataset.id)));
        box.querySelectorAll(".admin-class-learners").forEach(btn=>btn.addEventListener("click",async()=>{
          const panel=box.querySelector(`#adminClassLearners-${CSS.escape(btn.dataset.id)}`);
          if(!panel)return;
          if(panel.dataset.loaded==="true"){
            panel.classList.toggle("hidden");
            btn.textContent=panel.classList.contains("hidden")?"Học sinh":"Ẩn học sinh";
            return;
          }
          panel.classList.remove("hidden");
          setSafeHtml(panel,`<div class="loading-inline"><span class="diamond-mini" aria-hidden="true"></span> Đang tải học sinh lớp ${esc(btn.dataset.code||"")}...</div>`);
          btn.disabled=true;
          try{
            const directory=await prod.teacherListUsers(btn.dataset.id);
            const learners=(directory.users||[]).filter(user=>["student","monitor"].includes(user.role));
            const targetClasses=classes.filter(item=>item.active!==false&&item.id!==btn.dataset.id);
            const rows=learners.map(user=>`<div class="admin-learner-row ${user.active===false?"is-inactive":""}">
              <div class="admin-learner-identity"><b>${esc(user.fullName||user.code||"Học sinh")}</b><span>${esc(user.code||"")} · ${user.role==="monitor"?"Cán sự":"Học sinh"}${user.active===false?" · Đã khóa":""}</span></div>
              ${user.active!==false&&targetClasses.length?`<div class="admin-learner-transfer"><select class="admin-transfer-target" data-user="${user.id}" aria-label="Chọn lớp đích cho ${esc(user.fullName||user.code||"")}"><option value="">Chuyển sang...</option>${targetClasses.map(target=>`<option value="${target.id}">${esc(target.code)} · ${esc(target.name||target.code)}</option>`).join("")}</select><button type="button" class="btn btn-ghost admin-transfer-student" data-user="${user.id}" data-source="${btn.dataset.id}">Chuyển</button></div>`:""}
            </div>`).join("");
            setSafeHtml(panel,`<div class="admin-learner-panel-head"><b>Học sinh/cán sự · ${learners.length}</b><span class="tiny muted">Tải trực tiếp theo class_id</span></div>${rows||`<div class="tiny muted">Lớp chưa có học sinh/cán sự.</div>`}`);
            panel.dataset.loaded="true";
            btn.textContent="Ẩn học sinh";

            panel.querySelectorAll(".admin-transfer-student").forEach(transferBtn=>transferBtn.addEventListener("click",async()=>{
              const select=panel.querySelector(`.admin-transfer-target[data-user="${CSS.escape(transferBtn.dataset.user)}"]`);
              const targetClassId=select?.value||"";
              if(!targetClassId){toast("Hãy chọn lớp đích.","warn");return;}
              const target=classes.find(item=>item.id===targetClassId);
              const learner=learners.find(item=>item.id===transferBtn.dataset.user);
              if(!confirm(`Chuyển ${learner?.fullName||learner?.code||"học sinh"} sang lớp ${target?.code||"đã chọn"}?`))return;
              transferBtn.disabled=true;
              try{
                await prod.adminManageClasses("transfer_student",{classId:targetClassId,userId:transferBtn.dataset.user});
                toast(`Đã chuyển học sinh sang ${target?.code||"lớp mới"}.`,"success");
                await refreshFromServer(false);
              }catch(error){
                console.error(error);
                toast(safeErrorMessage(error,"Không chuyển được học sinh."),"warn");
                transferBtn.disabled=false;
              }
            }));
          }catch(error){
            console.error(error);
            setSafeHtml(panel,`<div class="callout warning">Không tải được danh sách học sinh của lớp.</div>`);
            toast(safeErrorMessage(error,"Không tải được danh sách học sinh."),"warn");
          }finally{btn.disabled=false;}
        }));
        box.querySelectorAll(".admin-teacher-assignment").forEach(el=>el.addEventListener("change",async()=>{
          try{
            await prod.adminManageClasses(el.checked?"assign_teacher":"unassign_teacher",{classId:el.dataset.class,teacherId:el.dataset.teacher});
            toast("Đã cập nhật phân quyền giáo viên.","success");
          }catch(error){
            el.checked=!el.checked;
            toast(safeErrorMessage(error,"Không cập nhật được phân quyền."),"warn");
          }
        }));
        box.querySelectorAll(".admin-toggle-teacher").forEach(btn=>btn.addEventListener("click",async()=>{
          try{
            await prod.teacherUpdateUser(btn.dataset.id,{changeCode:false,code:btn.dataset.code,fullName:btn.dataset.name,role:"teacher",active:btn.dataset.active!=="true"});
            toast("Đã cập nhật trạng thái giáo viên.","success");
            await loadDirectory({force:true});
          }catch(error){toast(safeErrorMessage(error,"Không cập nhật được giáo viên."),"warn");}
        }));
        box.querySelectorAll(".admin-delete-teacher").forEach(btn=>btn.addEventListener("click",()=>{
          const teacher=teachers.find(item=>item.id===btn.dataset.id);
          if(!teacher)return;
          openModal("Xóa giáo viên",`
            <form id="adminDeleteTeacherForm" class="delete-confirm-form">
              <div class="callout warning"><b>Xóa mềm tài khoản giáo viên</b><br>Tài khoản sẽ bị vô hiệu hóa, lịch sử vẫn được giữ và các phân quyền lớp đang hoạt động sẽ bị tắt.</div>
              <div class="person admin-delete-teacher-person"><span class="avatar">${initials(teacher.full_name||teacher.student_code||"GV")}</span><div><b>${esc(teacher.full_name||"Giáo viên")}</b><div class="tiny muted">Mã: ${esc(teacher.student_code||"")}</div></div></div>
              <label>Nhập đúng mã giáo viên để xác nhận
                <input id="adminDeleteTeacherCode" autocomplete="off" spellcheck="false" required placeholder="${esc(teacher.student_code||"")}">
              </label>
              <div class="toolbar"><button type="button" class="btn btn-ghost" id="cancelDeleteTeacher">Hủy</button><button class="btn btn-danger right" type="submit">${uiIcon("delete")}<span>Xóa giáo viên</span></button></div>
            </form>`);
          $("#cancelDeleteTeacher").onclick=closeModal;
          $("#adminDeleteTeacherForm").onsubmit=async event=>{
            event.preventDefault();
            const confirmCode=$("#adminDeleteTeacherCode").value.trim().toUpperCase();
            if(confirmCode!==String(teacher.student_code||"").trim().toUpperCase()){
              toast("Mã xác nhận chưa khớp với tài khoản giáo viên.","warn");
              return;
            }
            setGlobalLoading(true,"Đang xóa mềm giáo viên...");
            try{
              await prod.teacherDeleteUser(teacher.id, confirmCode);
              closeModal();
              toast(`Đã xóa mềm giáo viên ${teacher.full_name||teacher.student_code||""}.`,"success");
              await loadDirectory({force:true});
            }catch(error){
              console.error(error);
              toast(safeErrorMessage(error,"Không xóa được giáo viên."),"warn");
            }finally{setGlobalLoading(false);}
          };
        }));
        box.querySelectorAll(".admin-edit-class").forEach(btn=>btn.addEventListener("click",()=>{
          openModal("Sửa thông tin lớp",`<form id="adminEditClassForm"><label>Mã lớp<input id="adminEditClassCode" required maxlength="40" value="${esc(btn.dataset.code||"")}"></label><label>Tên lớp<input id="adminEditClassName" required maxlength="120" value="${esc(btn.dataset.name||"")}"></label><div class="toolbar"><button type="button" class="btn btn-ghost" id="cancelEditClass">Hủy</button><button class="btn btn-primary right">Lưu</button></div></form>`);
          $("#cancelEditClass").onclick=closeModal;
          $("#adminEditClassForm").onsubmit=async e=>{
            e.preventDefault();setGlobalLoading(true,"Đang cập nhật lớp...");
            try{
              await prod.adminManageClasses("update_class",{classId:btn.dataset.id,code:$("#adminEditClassCode").value.trim(),name:$("#adminEditClassName").value.trim()});
              closeModal();toast("Đã cập nhật lớp.","success");await refreshFromServer(false);
            }catch(error){toast(safeErrorMessage(error,"Không cập nhật được lớp."),"warn");}
            finally{setGlobalLoading(false);}
          };
        }));
        box.querySelectorAll(".admin-toggle-class").forEach(btn=>btn.addEventListener("click",async()=>{
          const isActive=btn.dataset.active==="true";
          if(isActive&&!confirm("Khóa lớp này? Hệ thống chỉ cho phép khi không còn học sinh/cán sự đang hoạt động trong lớp."))return;
          setGlobalLoading(true,isActive?"Đang khóa lớp...":"Đang kích hoạt lớp...");
          try{
            await prod.adminManageClasses("update_class",{classId:btn.dataset.id,active:!isActive});
            toast(isActive?"Đã khóa lớp.":"Đã kích hoạt lớp.","success");
            await refreshFromServer(false);
          }catch(error){toast(safeErrorMessage(error,isActive?"Không khóa được lớp.":"Không kích hoạt được lớp."),"warn");}
          finally{setGlobalLoading(false);}
        }));
        box.querySelectorAll(".admin-delete-class").forEach(btn=>btn.addEventListener("click",async()=>{
          if(btn.dataset.canDelete!=="true")return;
          if(!confirm(`Xóa vĩnh viễn lớp ${btn.dataset.code}? Chỉ lớp hoàn toàn rỗng mới được phép xóa.`))return;
          btn.disabled=true;
          setGlobalLoading(true,"Đang xóa lớp rỗng...");
          try{
            await prod.adminManageClasses("delete_class",{classId:btn.dataset.id});
            toast(`Đã xóa lớp ${btn.dataset.code}.`,"success");
            await refreshFromServer(false);
          }catch(error){
            console.error(error);
            toast(safeErrorMessage(error,"Không xóa được lớp. Lớp có thể vừa phát sinh dữ liệu mới."),"warn");
            btn.disabled=false;
          }finally{setGlobalLoading(false);}
        }));
      }catch(error){
        console.error(error);toast(safeErrorMessage(error,"Không tải được dữ liệu quản trị."),"warn");
        const box=$("#adminClassDirectory");if(box)setSafeHtml(box,`<div class="callout warning">Không tải được danh mục lớp/giáo viên. Bấm “Làm mới” để thử lại.</div>`);
      }finally{if(!cacheFresh)setGlobalLoading(false);}
    };

    $("#adminReloadClasses")?.addEventListener("click",()=>loadDirectory({force:true}));
    content.querySelectorAll(".admin-open-class").forEach(btn=>btn.addEventListener("click",()=>openActiveClass(btn.dataset.id)));

    $("#adminCreateTeacher")?.addEventListener("click",()=>{
      openModal("Tạo tài khoản giáo viên",`<form id="adminCreateTeacherForm"><label>Mã đăng nhập<input id="adminTeacherCode" required maxlength="32" placeholder="VD: GV-HIEU"></label><label>Họ và tên<input id="adminTeacherName" required maxlength="120"></label><label>Mật khẩu tạm${renderPasswordField({id:"adminTeacherPassword",autocomplete:"new-password",required:false,placeholder:"Để trống để tự sinh"})}</label><button class="btn btn-primary btn-block">Tạo giáo viên</button></form>`);
      $("#adminCreateTeacherForm")?.addEventListener("submit",async e=>{
        e.preventDefault();setGlobalLoading(true,"Đang tạo giáo viên...");
        try{
          const result=await prod.teacherCreateUser({code:$("#adminTeacherCode").value.trim(),fullName:$("#adminTeacherName").value.trim(),role:"teacher",password:$("#adminTeacherPassword").value.trim()});
          openModal("Đã tạo giáo viên",`<div class="success-account-card"><div class="success-icon">👩‍🏫</div><h3>${esc(result.user?.fullName||"")}</h3><p>Mã đăng nhập</p><div class="credential-box">${esc(result.user?.code||"")}</div><p>Mật khẩu tạm</p><div class="credential-box">${esc(result.password||"")}</div><div class="callout warning">Lưu mật khẩu này trước khi đóng.</div><button class="btn btn-primary btn-block" id="finishCreateTeacher">Đã lưu</button></div>`);
          $("#finishCreateTeacher").onclick=()=>{closeModal();loadDirectory({force:true});};
        }catch(error){toast(safeErrorMessage(error,"Không tạo được giáo viên."),"warn");}
        finally{setGlobalLoading(false);}
      });
    });

    $("#adminCreateClass")?.addEventListener("click",()=>{
      openModal("Tạo lớp mới",`<form id="adminCreateClassForm"><label>Mã lớp<input id="adminClassCode" required maxlength="40" placeholder="VD: 7A1"></label><label>Tên lớp<input id="adminClassName" required maxlength="120" placeholder="VD: Lớp 7A1"></label><button class="btn btn-primary btn-block">Tạo lớp</button></form>`);
      $("#adminCreateClassForm")?.addEventListener("submit",async e=>{
        e.preventDefault();setGlobalLoading(true,"Đang tạo lớp...");
        try{
          await prod.adminManageClasses("create_class",{code:$("#adminClassCode").value.trim(),name:$("#adminClassName").value.trim(),schoolYearId:state.activeSchoolYearId});
          closeModal();toast("Đã tạo lớp.","success");await refreshFromServer(false);
        }catch(error){toast(safeErrorMessage(error,"Không tạo được lớp."),"warn");}
        finally{setGlobalLoading(false);}
      });
    });

    // The full directory is intentionally loaded on entry; the working-class
    // picker only contains active classes and is not the administration list.
    loadDirectory();
  }

  function settingsPage(){
    const threshold=Math.round(Number(state.settings.aiAutoApproveThreshold||0.90)*100);
    const revisionThreshold=Math.round(Number(state.settings.aiRevisionActionThreshold||0.85)*100);
    const memory=state.aiFeedbackMemoryStats||{};
    const memoryLast=memory.lastFeedbackAt?new Date(memory.lastFeedbackAt).toLocaleString("vi-VN"):"Chưa có";
    return renderSettingsPage({
      headerHtml:head("Cài đặt","Cấu hình lớp học, đăng ký, AI và trải nghiệm Cú Thông Thái."),
      className:state.settings.className,
      schoolYear:state.settings.schoolYear,
      deadlineTime:registrationDeadlineTime(),
      announcement:state.settings.announcement,
      threshold,
      revisionThreshold,
      memory,
      memoryLast,
      periods:state.periods,
      aiEnabled:isAiAutomationEnabled(),
      escapeHtml:esc,
      iconFor:uiIcon
    });
  }

  function bindSettings(){
    const settingsRoot=$("#settingsPageV850");
    settingsRoot?.querySelectorAll("[data-settings-tab]").forEach(button=>button.addEventListener("click",()=>{
      const tab=button.dataset.settingsTab||"general";
      settingsRoot.dataset.settingsCurrentTab=tab;
      settingsRoot.querySelectorAll("[data-settings-tab]").forEach(item=>{
        const active=item.dataset.settingsTab===tab;
        item.classList.toggle("active",active);
        item.setAttribute("aria-selected",String(active));
      });
    }));
    $("#aiAutoApproveThreshold")?.addEventListener("input",e=>{
      $("#aiThresholdValue").textContent=`${e.target.value}%`;
    });

    $("#settingsForm")?.addEventListener("submit",async e=>{
      e.preventDefault();
      state.settings.announcement=$("#setAnnouncement").value.trim();
      const aiAutomationEnabled=$("#smartApprovalEnabled").checked;
      state.settings.aiAutomationEnabled=aiAutomationEnabled;
      state.settings.smartApprovalEnabled=aiAutomationEnabled;
      state.settings.aiReviewEnabled=aiAutomationEnabled;
      state.settings.aiAutoApproveThreshold=Number($("#aiAutoApproveThreshold").value)/100;
      state.settings.registrationDeadlineTime=$("#registrationDeadlineTime").value||"20:00";

      state.audit.unshift({
        at:new Date().toISOString(),userId:currentUser?.id,
        action:"Cập nhật cài đặt",entityId:"settings",
        detail:`AI_AUTO=${aiAutomationEnabled}; threshold=${state.settings.aiAutoApproveThreshold}; deadline=${state.settings.registrationDeadlineTime}`
      });

      try{
        await saveState();
        toast(`Đã lưu cài đặt. Deadline tự động: ${registrationDeadlineTime()}.`,"success");
        showOwlMessage({
          text:aiAutomationEnabled
            ? `🤖 Duyệt tự động bằng AI đang bật với ngưỡng ${Math.round(state.settings.aiAutoApproveThreshold*100)}%.`
            : "👤 Duyệt tự động bằng AI đang tắt; mọi đăng ký sẽ chuyển giáo viên duyệt.",
          force:true
        });
        await refreshFromServer(false);
      }catch{}
    });
  }

  function empty(icon,text){return `<div class="empty learning-empty-state"><img class="empty-image" src="assets/images/empty-state.png" alt=""><div class="learning-empty-copy"><span class="learning-empty-icon" aria-hidden="true">${icon}</span><b>${text}</b><p>Thông tin sẽ xuất hiện tại đây khi có dữ liệu phù hợp.</p></div></div>`;}

  function render(){
    if(!currentUser){renderShell();return;}
    let html="";
    if(currentUser.role==="student"){
      if(route==="dashboard"||route==="register")html=studentDashboard();
      else if(route==="history")html=historyPage();
      else if(route==="comments")html=commentsPage();
      else html=studentDashboard();
    }else if(currentUser.role==="monitor"){
      if(route==="dashboard"||route==="class")html=classOverview();
      else if(route==="register")html=studentDashboard();
      else if(route==="missing")html=missingPage();
      else if(route==="issues")html=revisionIssuesPage();
      else if(route==="history")html=historyPage();
      else if(route==="comments")html=commentsPage();
      else html=classOverview();
    }else{
      if(route==="admin"&&currentUser.role==="admin")html=adminPage();
      else if(route==="dashboard")html=teacherDashboard();
      else if(route==="approvals")html=approvalsPage();
      else if(route==="issues")html=revisionIssuesPage();
      else if(route==="class")html=classOverview();
      else if(route==="schedule")html=schedulePage();
      else if(route==="weeks")html=weeksPage();
      else if(route==="students")html=studentsPage();
      else if(route==="stats")html=statsPage();
      else if(route==="settings")html=settingsPage();
      else html=teacherDashboard();
    }
    setSafeHtml(content,html);
    decorateActionButtons(content);
    bindRegistrationButtons(); bindTeacherActions(); bindClassOverview(); bindSchedule(); bindWeeks(); bindStudents(); bindStats(); bindSettings(); bindAdmin();
    content.querySelector("[data-route-settings]")?.addEventListener("click",()=>{route="settings";renderShell();render();});
    content.querySelectorAll("[data-route-approvals]").forEach(button=>{
      button.addEventListener("click",()=>{route="approvals";renderShell();render();});
    });
    content.querySelectorAll("[data-approval-filter]").forEach(button=>{
      button.addEventListener("click",()=>{
        approvalFilter=button.dataset.approvalFilter||"attention";
        render();
      });
    });
    content.querySelectorAll("[data-approval-select]").forEach(button=>{
      button.addEventListener("click",()=>{
        approvalSelectedId=button.dataset.approvalSelect||"";
        render();
      });
    });
    $("#approveAll")?.addEventListener("click",async event=>{
      const rows=state.registrations.filter(r=>r.weekId===state.currentWeekId&&registrationManagerActions(r).canApprove);
      if(!rows.length)return;
      const button=event.currentTarget;if(button)button.disabled=true;
      rows.forEach(r=>{
        r.status="approved";
        r.approvalSource="manual";
        r.approvedAt=Date.now();
        markLocalNotificationReadByReg(r.id);
      });
      audit("Duyệt hàng loạt","registrations",`${rows.length} đăng ký`);
      try{
        await saveState();
        await refreshFromServer(false);
        toast("Đã duyệt tất cả đăng ký đang chờ.","success");
      }catch(error){
        console.error(error);
        toast(safeErrorMessage(error,"Không duyệt được toàn bộ đăng ký."),"warn");
        try{await refreshFromServer(false);}catch{}
      }
    });
    renderShell();
    scheduleOwlRouteContext();
    scheduleWeekLifecycleTick();
  }

  async function refreshFromServer(showToast=true){
    try{
      const loaded=await prod.loadState(state?.activeClassId||null);
      if(!loaded.currentUser){ await logout(); return; }
      currentUser=loaded.currentUser; state=loaded.state; route=route||"dashboard";
      const aligned=alignWeekToLifecycle();
      if(aligned)await selectWeek(state.currentWeekId);
      renderShell(); render();
      schedulePendingAiRecovery(isManager()?1800:800);
      if(showToast) toast("Đã đồng bộ dữ liệu mới nhất.","success");
    }catch(err){ console.error(err); if(showToast) toast(safeErrorMessage(err,"Không tải được dữ liệu mới. Vui lòng thử lại."),"warn"); }
  }
  $("#syncBtn")?.addEventListener("click",()=>refreshFromServer(true));

  try{
    setGlobalLoading(true,"Đang tải Sổ Tự Học...");
    if(!prod?.enabled?.()) throw new Error("Thiếu URL hoặc publishable key của Supabase.");
    await prod.init();
    const loaded=await prod.loadState();
    if(loaded.currentUser){
      currentUser=loaded.currentUser;
      state=loaded.state;
      const aligned=alignWeekToLifecycle(true);
      if(aligned)await selectWeek(state.currentWeekId);
      renderShell();
      render();
      startRealtime();

      // Polling chỉ là lớp dự phòng. Realtime xử lý luồng chính.
      const fallbackSeconds=Math.max(120,Number(window.APP_CONFIG?.fallbackRefreshSeconds||180));
      setInterval(()=>{
        if(!currentUser||document.hidden||realtimeInputBusy())return;
        refreshFromServer(false);
      },fallbackSeconds*1000);

      document.addEventListener("visibilitychange",()=>{
        if(document.hidden||!currentUser)return;

        if(realtimeQueue.length){
          clearTimeout(realtimeFlushTimer);
          realtimeFlushTimer=setTimeout(flushRealtimeQueue,120);
          return;
        }

        // Sau khi tab ngủ lâu, đồng bộ một lần để bù cho WebSocket có thể bị ngắt.
        if(Date.now()-lastRealtimeActivity>90000){
          refreshFromServer(false);
        }
      });
    }else renderShell();
  }catch(err){
    console.error(err); renderShell();
    toast("Supabase chưa sẵn sàng. Hãy kiểm tra cấu hình triển khai.","warn");
  }finally{setGlobalLoading(false);}
})();
