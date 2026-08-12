(async () => {
  const KEY="soTuHocDemo_v1";
  const prod = window.SupabaseService;
  const isProd = !!prod?.enabled?.();
  let state = loadState();
  let currentUser = isProd ? null : JSON.parse(sessionStorage.getItem("soTuHocUser")||"null");
  let route="dashboard";

  const $ = s => document.querySelector(s);
  const content=$("#content"), loginView=$("#loginView"), appView=$("#appView");
  const modal=$("#modal"), modalBody=$("#modalBody"), modalTitle=$("#modalTitle");

  const roleLabel={student:"Học sinh",monitor:"Cán sự lớp",teacher:"Giáo viên"};
  const statusLabel={approved:"Đã duyệt",submitted:"Chờ duyệt",needs_revision:"Cần chỉnh sửa",draft:"Bản nháp",missing:"Chưa đăng ký"};
  const navs={
    student:[
      ["dashboard","🏠","Trang chủ"],["register","📝","Đăng ký tự học"],["history","🕘","Lịch sử của tôi"],["comments","💬","Nhận xét của GV"]
    ],
    monitor:[
      ["dashboard","🏠","Tổng quan"],["register","📝","Đăng ký của tôi"],["class","👥","Theo dõi cả lớp"],
      ["missing","⚠️","Danh sách thiếu"],["history","🕘","Lịch sử của tôi"],["comments","💬","Nhận xét của GV"]
    ],
    teacher:[
      ["dashboard","▦","Dashboard"],["approvals","✅","Duyệt đăng ký"],["class","👥","Theo dõi cả lớp"],["schedule","📅","TKB tự học"],
      ["weeks","🗓️","Quản lý tuần"],["students","🎓","Quản lý học sinh"],["stats","📊","Thống kê"],["settings","⚙️","Cài đặt"]
    ]
  };

  function loadState(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || DemoData.defaultState(); }
    catch(e){ return DemoData.defaultState(); }
  }
  function saveState(){
    if(isProd){
      return prod.syncState(state,currentUser).catch(err=>{
        console.error(err);
        toast("Không đồng bộ được dữ liệu: "+(err.message||err),"warn");
        throw err;
      });
    }else{
      localStorage.setItem(KEY,JSON.stringify(state));
      return Promise.resolve();
    }
  }
  function resetDemo(){
    if(isProd){ toast("Chức năng khôi phục chỉ dùng ở chế độ Demo.","warn"); return; }
    state=DemoData.defaultState(); const aw=actualWeek(); if(aw)state.currentWeekId=aw.id; saveState(); toast("Đã khôi phục dữ liệu demo.","success"); render();
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
  function deadlineModeLabel(mode){
    return {
      per_session_20:"20:00 tối hôm trước từng buổi",
      week_before_20:"20:00 ngày trước khi tuần bắt đầu",
      specific:"Hạn cụ thể của tuần"
    }[mode||"week_before_20"] || "Hạn đăng ký";
  }
  function deadlineForSlot(w,dow=0){
    if(!w)return "";
    const mode=w.deadlineMode||"week_before_20";
    if(mode==="per_session_20"){
      const sessionDate=dateForDow(w,dow);
      return `${addDaysDateISO(sessionDate,-1)}T20:00`;
    }
    if(mode==="week_before_20"){
      return `${addDaysDateISO(w.startDate,-1)}T20:00`;
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
    const mode=w?.deadlineMode||"week_before_20";
    if(mode==="per_session_20" && dow===null){
      return `<span class="deadline-chip ok">⏰ Theo từng buổi: 20:00 tối hôm trước</span>`;
    }
    const dl=deadlineForSlot(w,dow??0);
    if(!dl)return `<span class="deadline-chip neutral">⏰ Chưa đặt deadline</span>`;
    return `<span class="deadline-chip ${deadlinePassed(w,dow??0)?"late":"ok"}">⏰ ${fmtDeadline(dl)}${deadlinePassed(w,dow??0)?" · Đã qua hạn":""}</span>`;
  }
  function deadlineSummary(w){
    const mode=w?.deadlineMode||"week_before_20";
    if(mode==="per_session_20") return "Mỗi buổi: 20:00 tối hôm trước";
    if(mode==="week_before_20") return fmtDeadline(deadlineForSlot(w,0));
    return w?.deadline ? fmtDeadline(w.deadline) : "Chưa chọn hạn cụ thể";
  }
  function smartReviewDecision(content,note=""){
    const text=`${content||""} ${note||""}`.toLowerCase();
    const nonStudy=/(chơi\s*game|game\s*giải\s*trí|tiktok|facebook|instagram|xem\s*phim|video\s*giải\s*trí|nghe\s*nhạc|mạng\s*xã\s*hội|lướt\s*mạng|chat|nhắn\s*tin|giải\s*trí|shopping|mua\s*sắm)/i.test(text);
    const device=/(điện\s*thoại|laptop|máy\s*tính|tablet|ipad|chromebook|thiết\s*bị\s*điện\s*tử|internet|website|youtube|ứng\s*dụng|\bapp\b)/i.test(text);
    const study=/(học|ôn|ôn\s*tập|bài\s*tập|làm\s*bài|đọc\s*sách|soạn\s*bài|luyện|làm\s*đề|đề\s*kiểm\s*tra|nghiên\s*cứu|tra\s*cứu|tìm\s*tài\s*liệu|ghi\s*chép|thuyết\s*trình|dự\s*án|lập\s*trình|coding|programming|bài\s*giảng|từ\s*vựng|công\s*thức|sgk|sách\s*giáo\s*khoa|kiểm\s*tra|study|homework|research|practice|toán|ngữ\s*văn|văn\s*học|tiếng\s*anh|anh\s*văn|vật\s*lí|vật\s*lý|hóa\s*học|hoá\s*học|sinh\s*học|lịch\s*sử|địa\s*lí|địa\s*lý|tin\s*học|công\s*nghệ|giáo\s*dục)/i.test(text);

    if(nonStudy)return {auto:false,reason:"Có dấu hiệu giải trí/mạng xã hội; cần giáo viên xác nhận."};
    if(device&&study)return {auto:true,reason:"Thiết bị điện tử được nêu kèm mục đích học tập rõ ràng."};
    if(study&&!device)return {auto:true,reason:"Nội dung học tập rõ ràng."};
    if(device&&!study)return {auto:false,reason:"Có sử dụng thiết bị điện tử nhưng mục đích học tập chưa đủ rõ."};
    return {auto:false,reason:"Nội dung chưa đủ rõ để tự động duyệt."};
  }

  function syncDemoNotificationForRegistration(r){
    state.notifications=state.notifications||[];
    const existing=state.notifications.find(n=>n.registrationId===r.id&&n.type==="manual_review");
    if(r.status==="submitted"&&r.approvalSource==="manual"){
      const student=state.users.find(u=>u.id===r.studentId);
      const payload={
        id:existing?.id||`n-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        registrationId:r.id,studentId:r.studentId,weekId:r.weekId,type:"manual_review",
        title:"Đăng ký cần giáo viên duyệt",
        message:`${student?.name||"Học sinh"}: ${r.content} — ${r.autoReviewReason||""}`,
        isRead:false,createdAt:new Date().toISOString()
      };
      if(existing)Object.assign(existing,payload);else state.notifications.unshift(payload);
    }else if(existing){
      existing.isRead=true;
    }
  }

  function markLocalNotificationReadByReg(registrationId){
    (state.notifications||[]).forEach(n=>{
      if(n.registrationId===registrationId)n.isRead=true;
    });
  }

  function week(){ return state.weeks.find(w=>w.id===state.currentWeekId)||state.weeks[0]; }
  function actualWeek(){
    if(!state.weeks?.length) return null;
    if(isProd && prod?.chooseCurrentWeek) return prod.chooseCurrentWeek(state.weeks);
    const now=new Date(), y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,"0"), d=String(now.getDate()).padStart(2,"0");
    const today=`${y}-${m}-${d}`;
    return state.weeks.find(w=>w.startDate<=today&&w.endDate>=today)
      || state.weeks.find(w=>w.startDate>today)
      || state.weeks[state.weeks.length-1];
  }
  function period(n){ return state.periods.find(p=>p.n===Number(n)); }
  function slotLabel(dow,p){ const pe=period(p); return `${DemoData.DOW[dow]} · Tiết ${p}${pe?` (${pe.start}–${pe.end})`:""}`; }
  function studentUsers(){ return state.users.filter(u=>u.active && (u.role==="student"||u.role==="monitor")); }
  function initials(name){ return name.split(" ").slice(-2).map(x=>x[0]).join("").toUpperCase(); }
  function statusBadge(status){ return `<span class="status ${status||"missing"}">${statusLabel[status]||"Chưa đăng ký"}</span>`; }
  function toast(msg,type=""){ const el=document.createElement("div"); el.className=`toast ${type}`; el.textContent=msg; $("#toastHost").appendChild(el); setTimeout(()=>el.remove(),2800); }
  function openModal(title,html){ modalTitle.textContent=title; modalBody.innerHTML=html; modal.classList.remove("hidden"); }
  function closeModal(){ modal.classList.add("hidden"); modalBody.innerHTML=""; }
  function audit(action,entityId,detail=""){ state.audit.unshift({at:new Date().toISOString(),userId:currentUser?.id,action,entityId,detail}); saveState(); }

  function effectiveSchedule(){
    const overrides=state.overrides.filter(o=>o.weekId===state.currentWeekId);
    if(!overrides.length) return [...state.schedule].sort((a,b)=>a.dow-b.dow||a.period-b.period);
    return overrides.filter(o=>o.active).map(o=>({dow:o.dow,period:o.period})).sort((a,b)=>a.dow-b.dow||a.period-b.period);
  }
  function regFor(studentId,dow,p,weekId=state.currentWeekId){
    return state.registrations.find(r=>r.studentId===studentId&&r.weekId===weekId&&r.dow===dow&&r.period===p);
  }
  function statsForWeek(){
    const students=studentUsers(), slots=effectiveSchedule();
    const total=students.length*slots.length;
    let submitted=0,approved=0,needs=0,autoApproved=0;
    students.forEach(s=>slots.forEach(sl=>{
      const r=regFor(s.id,sl.dow,sl.period);
      if(r && r.status!=="draft"){submitted++;}
      if(r?.status==="approved")approved++;
      if(r?.status==="approved"&&r?.approvalSource==="auto_rule")autoApproved++;
      if(r?.status==="needs_revision")needs++;
    }));
    return {students:students.length,slots:slots.length,total,submitted,approved,autoApproved,needs,missing:Math.max(0,total-submitted),rate:total?Math.round(submitted/total*100):0};
  }

  function login(user){
    currentUser=user;
    if(!isProd) sessionStorage.setItem("soTuHocUser",JSON.stringify(user));
    route="dashboard"; renderShell(); render();
  }
  async function logout(){
    if(isProd){
      try{ await prod.signOut(); }catch(err){ console.error(err); }
    }else sessionStorage.removeItem("soTuHocUser");
    currentUser=null; appView.classList.add("hidden"); loginView.classList.remove("hidden");
  }
  function findLogin(id){
    const q=id.trim().toLowerCase();
    return state.users.find(u=>u.active&&(u.code.toLowerCase()===q||u.email.toLowerCase()===q));
  }
  $("#loginForm").addEventListener("submit",async e=>{
    e.preventDefault();
    if(isProd){
      try{
        const code=$("#loginId").value.trim();
        const password=$("#loginPassword").value;
        if(!code){ toast("Hãy nhập mã đăng nhập.","warn"); return; }
        await prod.signInCode(code,password);
        const loaded=await prod.loadState();
        if(!loaded.currentUser?.active){ await prod.signOut(); throw new Error("Tài khoản đã bị khóa."); }
        state=loaded.state; login(loaded.currentUser);
        toast("Đăng nhập thành công.","success");
      }catch(err){
        console.error(err); toast("Đăng nhập không thành công: "+(err.message||err),"warn");
      }
      return;
    }
    const user=findLogin($("#loginId").value);
    if(!user){ toast("Không tìm thấy tài khoản demo.","warn"); return; }
    if($("#loginPassword").value!=="123456"){ toast("Mật khẩu demo là 123456.","warn"); return; }
    login(user);
  });
  if(isProd){
    document.querySelector(".demo-divider")?.classList.add("hidden");
    document.querySelector(".demo-buttons")?.classList.add("hidden");
    document.querySelector(".login-card .tiny")?.classList.add("hidden");
    $("#loginId").value="";
    $("#loginPassword").value="";
    $("#loginId").placeholder="VD: 10A1-01 hoặc GV-10A1";
    $("#syncBtn")?.classList.remove("hidden");
  }
  document.querySelectorAll("[data-demo-role]").forEach(b=>b.addEventListener("click",()=>{
    const role=b.dataset.demoRole;
    const u=state.users.find(x=>x.role===role && x.active); if(u)login(u);
  }));

  function renderShell(){
    if(!currentUser){ loginView.classList.remove("hidden"); appView.classList.add("hidden"); return; }
    loginView.classList.add("hidden"); appView.classList.remove("hidden");
    $("#profileName").textContent=currentUser.name; $("#profileRole").textContent=roleLabel[currentUser.role]; $("#profileAvatar").textContent=initials(currentUser.name);
    $("#sideNav").innerHTML=navs[currentUser.role].map(n=>`<button class="nav-btn ${route===n[0]?"active":""}" data-route="${n[0]}"><span class="nav-icon">${n[1]}</span>${n[2]}</button>`).join("");
    $("#sideNav").querySelectorAll("[data-route]").forEach(b=>b.onclick=()=>{route=b.dataset.route; $("#sidebar").classList.remove("open"); renderShell(); render();});
    $("#globalWeekSelect").innerHTML=state.weeks.map(w=>`<option value="${w.id}" ${w.id===state.currentWeekId?"selected":""}>Tuần ${w.number} · ${fmtDateShort(w.startDate)}–${fmtDateShort(w.endDate)}</option>`).join("");

    const notifBtn=$("#notificationBtn"), notifBadge=$("#notificationBadge");
    if(currentUser.role==="teacher"){
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
  }
  $("#globalWeekSelect").addEventListener("change",e=>{state.currentWeekId=e.target.value;saveState();render();});
  $("#profileBtn").addEventListener("click",()=>openModal("Tài khoản",`
    <div class="card" style="box-shadow:none">
      <div class="person"><span class="avatar">${initials(currentUser?.name||"")}</span><div><b>${esc(currentUser?.name)}</b><div class="muted tiny">${roleLabel[currentUser?.role]} · ${esc(currentUser?.code)}</div></div></div>
      <p class="muted">Lớp ${esc(state.settings.className)} · Năm học ${esc(state.settings.schoolYear)}</p>
      <div class="toolbar">${isProd?`<button class="btn btn-ghost" id="changeMyPasswordBtn">🔑 Đổi mật khẩu</button>`:`<button class="btn btn-ghost" id="resetDemoBtn">↻ Khôi phục dữ liệu demo</button>`}<button class="btn btn-danger right" id="logoutBtn">Đăng xuất</button></div>
    </div>`));
  document.addEventListener("click",e=>{
    if(e.target?.id==="logoutBtn"){closeModal();logout();}
    if(e.target?.id==="resetDemoBtn"){if(confirm("Khôi phục toàn bộ dữ liệu demo?")){resetDemo();closeModal();}}
    if(e.target?.id==="changeMyPasswordBtn"){ changeOwnPasswordModal(); }
  });
  $("#notificationBtn")?.addEventListener("click",()=>openTeacherNotifications());
  $("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
  $("#modalClose").onclick=closeModal; modal.addEventListener("click",e=>{if(e.target===modal)closeModal();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});

  async function openTeacherNotifications(){
    if(currentUser?.role!=="teacher")return;
    const items=(state.notifications||[]).slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    const unread=items.filter(n=>!n.isRead);
    openModal("Thông báo cần xử lý",`
      <div class="notification-panel">
        <div class="callout">
          <b>${unread.length} thông báo chưa đọc</b><br>
          Nội dung không đủ điều kiện duyệt nhanh sẽ xuất hiện ở đây và vẫn nằm trong mục <b>Duyệt đăng ký</b>.
        </div>
        ${items.length?items.slice(0,20).map(n=>`
          <div class="notification-item ${n.isRead?"":"unread"}">
            <div class="notification-icon">🔔</div>
            <div><b>${esc(n.title)}</b><p>${esc(n.message||"")}</p><small>${n.createdAt?new Date(n.createdAt).toLocaleString("vi-VN"):""}</small></div>
          </div>`).join(""):`<div class="empty-mini">Không có thông báo cần duyệt.</div>`}
        <button class="btn btn-primary btn-block" id="openApprovalsFromNotifications">Mở danh sách cần duyệt</button>
      </div>`);

    $("#openApprovalsFromNotifications").onclick=()=>{
      closeModal();route="approvals";renderShell();render();
    };

    if(unread.length){
      unread.forEach(n=>n.isRead=true);
      renderShell();
      if(isProd){
        try{await prod.markNotificationsRead(unread.map(n=>n.id));}
        catch(err){console.error("markNotificationsRead",err);}
      }else{
        localStorage.setItem(KEY,JSON.stringify(state));
      }
    }
  }

  function changeOwnPasswordModal(){
    openModal("Đổi mật khẩu",`
      <form id="changePasswordForm">
        <div class="callout">Mật khẩu nên có ít nhất 8 ký tự và không dùng chung với tài khoản khác.</div>
        <label>Mật khẩu mới<input id="newOwnPassword" type="password" minlength="8" autocomplete="new-password" required></label>
        <label>Nhập lại mật khẩu<input id="newOwnPassword2" type="password" minlength="8" autocomplete="new-password" required></label>
        <button class="btn btn-primary btn-block" type="submit">Đổi mật khẩu</button>
      </form>`);
    $("#changePasswordForm").onsubmit=async e=>{
      e.preventDefault();
      const p1=$("#newOwnPassword").value, p2=$("#newOwnPassword2").value;
      if(p1!==p2){toast("Hai mật khẩu chưa khớp.","warn");return;}
      try{
        await prod.changeOwnPassword(p1);
        closeModal(); toast("Đã đổi mật khẩu.","success");
      }catch(err){console.error(err);toast("Không đổi được mật khẩu: "+(err.message||err),"warn");}
    };
  }

  function head(title,sub="",action=""){
    $("#pageTitle").textContent=title; $("#pageEyebrow").textContent=`Lớp ${state.settings.className} · ${state.settings.schoolYear}`;
    return `<div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`;
  }
  function weekBanner(){
    const w=week();
    const image=currentUser?.role==="teacher"?"assets/images/teacher-dashboard-illustration.svg":"assets/images/student-cards.svg";
    return `<div class="banner"><div>
      <div class="eyebrow-pill">📅 ${currentUser?.role==="teacher"?"Tuần đang xem":"Bạn đang đăng ký cho"}</div>
      <h2>Tuần ${w.number} · ${fmtDate(w.startDate)} – ${fmtDate(w.endDate)}</h2>
      <div class="deadline-row">${deadlineChip(w)} <span class="week-state-pill">${weekStatus(w.status)}</span></div>
      <p>${esc(state.settings.announcement)}</p>
      ${currentUser?.role!=="teacher"?`<p class="tiny banner-help">Dùng ô <b>“Chọn tuần đăng ký”</b> ở góc trên để chuyển sang tuần khác.</p>`:""}
      </div><img class="banner-image" src="${image}" alt="Minh họa hoạt động tự học"></div>`;
  }

  function studentDashboard(){
    const slots=effectiveSchedule(), regs=slots.map(sl=>regFor(currentUser.id,sl.dow,sl.period));
    const done=regs.filter(r=>r&&r.status!=="draft").length, total=slots.length, pct=total?Math.round(done/total*100):0;
    let html=head("Trang chủ",`Xin chào ${esc(currentUser.name)} 👋`)+weekBanner();
    html+=`<div class="card" style="margin-bottom:16px"><div class="toolbar"><b>Tiến độ của bạn</b><span class="right"><b>${done}/${total}</b> tiết</span></div><div class="progress" style="margin-top:10px"><span style="width:${pct}%"></span></div></div>`;
    if(!slots.length) html+=empty("📅","Tuần này chưa có tiết tự học.");
    else html+=`<div class="grid">${slots.map((sl,i)=>studyCard(sl,regs[i])).join("")}</div>`;
    return html;
  }
  function studyCard(sl,r){
    const w=week(), pe=period(sl.period), icon=r?.status==="approved"?"✅":r?.status==="needs_revision"?"📝":r?"📘":"🗒️";
    const slotClosed=w.status!=="open"||deadlinePassed(w,sl.dow);
    const noNewRegistration=slotClosed&&!r;
    const actionText=noNewRegistration?"Đã quá hạn":r?.status==="approved"?"Xem":r?"Xem / sửa":"+ Đăng ký ngay";
    return `<div class="card study-card ${noNewRegistration?"closed-slot":""}">
      <div class="study-icon">${icon}</div>
      <div class="study-main"><h3>${DemoData.DOW[sl.dow]} · ${fmtDate(dateForDow(w,sl.dow))} · Tiết ${sl.period}</h3><p>🕘 ${pe.start} – ${pe.end}</p>
      <p class="slot-deadline ${deadlinePassed(w,sl.dow)?"expired":""}">⏰ Hạn: <b>${fmtDeadline(deadlineForSlot(w,sl.dow))}</b>${deadlinePassed(w,sl.dow)?" · Đã qua":""}</p>
      <p><b>${r?esc(r.content):"Chưa đăng ký"}</b></p>${r?.note?`<p>${esc(r.note)}</p>`:""}${r?.teacherComment?`<p style="color:#7c3aed">💬 GV: ${esc(r.teacherComment)}</p>`:""}${r?.approvalSource==="auto_rule"?`<p class="tiny auto-approved-note">✨ Đã được duyệt nhanh tự động</p>`:""}</div>
      <div class="study-actions">${statusBadge(r?.status||"missing")}<button class="btn ${r?"btn-ghost":"btn-primary"} reg-btn" data-dow="${sl.dow}" data-period="${sl.period}" ${noNewRegistration?"disabled":""}>${actionText}</button></div>
    </div>`;
  }
  function bindRegistrationButtons(){
    content.querySelectorAll(".reg-btn").forEach(b=>b.onclick=()=>registrationModal(Number(b.dataset.dow),Number(b.dataset.period)));
  }
  function registrationModal(dow,p){
    const w=week(), r=regFor(currentUser.id,dow,p), pe=period(p);
    const pastDeadline=deadlinePassed(w,dow);
    const locked=w.status!=="open"||r?.status==="approved"||(pastDeadline&&r?.status!=="needs_revision");
    openModal(`Đăng ký · ${DemoData.DOW[dow]} · Tiết ${p}`,`
      <div class="registration-summary">
        <div><span>📅 Ngày học</span><b>${DemoData.DOW[dow]}, ${fmtDate(dateForDow(w,dow))}</b></div>
        <div><span>🕘 Khung giờ</span><b>${pe.start} – ${pe.end}</b></div>
        <div><span>🗓️ Tuần</span><b>Tuần ${w.number} · ${fmtDate(w.startDate)}–${fmtDate(w.endDate)}</b></div>
        <div><span>⏰ Hạn đăng ký</span><b>${fmtDeadline(deadlineForSlot(w,dow))}</b></div>
      </div>
      ${pastDeadline&&r?.status!=="needs_revision"?`<div class="callout warning" style="margin-top:10px"><b>Đã qua deadline.</b> Nếu cần đăng ký bổ sung, hãy báo giáo viên gia hạn tuần này.</div>`:""}
      ${pastDeadline&&r?.status==="needs_revision"?`<div class="callout" style="margin-top:10px"><b>GV đã yêu cầu chỉnh sửa.</b> Bạn vẫn được sửa đăng ký này dù deadline đã qua.</div>`:""}
      ${r?.teacherComment?`<div class="callout warning" style="margin-top:10px"><b>Nhận xét giáo viên:</b><br>${esc(r.teacherComment)}</div>`:""}
      <form id="regForm">
        <label>Nội dung tự học *
          <input id="regContent" maxlength="180" required value="${esc(r?.content||"")}" ${locked?"disabled":""} placeholder="VD: Ôn tập phương trình bậc hai">
        </label>
        <label>Ghi chú / mục tiêu
          <textarea id="regNote" maxlength="500" ${locked?"disabled":""} placeholder="Nêu bài, trang hoặc mục tiêu cụ thể...">${esc(r?.note||"")}</textarea>
        </label>
        ${locked?`<p class="muted tiny">Không thể chỉnh sửa vì đăng ký đã duyệt, tuần chưa mở/đã khóa/nghỉ hoặc đã quá deadline.</p>`:
        `<div class="toolbar"><button type="button" id="saveDraft" class="btn btn-ghost">Lưu nháp</button><button class="btn btn-primary right" type="submit">Gửi đăng ký</button></div>`}
      </form>`);
    if(locked)return;
    const save=async(status)=>{
      const contentVal=$("#regContent").value.trim();
      if(!contentVal){toast("Bạn cần nhập nội dung tự học.","warn");return;}
      let rr=regFor(currentUser.id,dow,p);
      if(!rr){
        rr={id:"r"+Date.now(),studentId:currentUser.id,weekId:state.currentWeekId,dow,period:p,teacherComment:"",approvalSource:"manual",autoReviewReason:"",updatedAt:Date.now()};
        state.registrations.push(rr);
      }
      Object.assign(rr,{content:contentVal,note:$("#regNote").value.trim(),status,updatedAt:Date.now()});

      if(!isProd&&status==="submitted"){
        const decision=state.settings.smartApprovalEnabled===false
          ? {auto:false,reason:"Duyệt nhanh thông minh đang tắt."}
          : smartReviewDecision(rr.content,rr.note);
        rr.autoReviewReason=decision.reason;
        rr.approvalSource=decision.auto?"auto_rule":"manual";
        if(decision.auto){rr.status="approved";rr.approvedAt=Date.now();}
        syncDemoNotificationForRegistration(rr);
      }

      state.audit.unshift({
        at:new Date().toISOString(),userId:currentUser?.id,
        action:status==="draft"?"Lưu nháp":"Gửi đăng ký",
        entityId:rr.id,detail:rr.content
      });

      try{
        await saveState();
        closeModal();
        if(status==="draft"){
          toast("Đã lưu nháp.","success");
        }else if(rr.status==="approved"&&rr.approvalSource==="auto_rule"){
          toast("Đã gửi và được duyệt nhanh vì nội dung học tập phù hợp.","success");
        }else{
          toast("Đã gửi. Nội dung này đang chờ giáo viên duyệt.","success");
        }
        render();
      }catch(err){
        console.error(err);
        toast("Không lưu được đăng ký: "+(err.message||err),"warn");
      }
    };
    $("#saveDraft").onclick=()=>save("draft");
    $("#regForm").onsubmit=e=>{e.preventDefault();save("submitted");};
  }

  function historyPage(){
    const regs=state.registrations.filter(r=>r.studentId===currentUser.id).sort((a,b)=>b.updatedAt-a.updatedAt);
    return head("Lịch sử của tôi","Xem lại đăng ký ở các tuần trước.")+
      (regs.length?`<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Tuần</th><th>Tiết</th><th>Nội dung</th><th>Trạng thái</th><th>Nhận xét GV</th></tr></thead><tbody>
      ${regs.map(r=>{const w=state.weeks.find(x=>x.id===r.weekId);return `<tr><td>Tuần ${w?.number||"?"}</td><td>${slotLabel(r.dow,r.period)}</td><td><b>${esc(r.content)}</b><div class="tiny muted">${esc(r.note||"")}</div></td><td>${statusBadge(r.status)}</td><td>${esc(r.teacherComment||"—")}</td></tr>`}).join("")}
      </tbody></table></div></div>`:empty("🕘","Chưa có lịch sử đăng ký."));
  }
  function commentsPage(){
    const regs=state.registrations.filter(r=>r.studentId===currentUser.id&&r.teacherComment);
    return head("Nhận xét của giáo viên","Các phản hồi dành cho đăng ký của bạn.")+
      (regs.length?`<div class="grid">${regs.map(r=>`<div class="card"><b>${slotLabel(r.dow,r.period)}</b><p>${esc(r.content)}</p><div class="callout">💬 ${esc(r.teacherComment)}</div></div>`).join("")}</div>`:empty("💬","Chưa có nhận xét nào."));
  }

  function classOverview(){
    const slots=effectiveSchedule(), students=studentUsers(), st=statsForWeek();
    let html=head("Theo dõi cả lớp",`Tuần ${week().number} · ${students.length} thành viên`);
    html+=`<div class="grid grid-4" style="margin-bottom:16px">
      ${kpi("👥",st.students,"Học sinh & cán sự")}${kpi("✅",st.submitted,"Đã đăng ký")}${kpi("⚠️",st.missing,"Chưa đăng ký")}${kpi("📝",st.needs,"Cần chỉnh sửa")}
    </div>`;
    if(!slots.length)return html+empty("📅","Chưa cấu hình tiết tự học.");
    html+=`<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Họ và tên</th>${slots.map(s=>`<th class="cell-center">${DemoData.DOW[s.dow]}<br><small>Tiết ${s.period}</small></th>`).join("")}<th>Hoàn thành</th></tr></thead><tbody>
      ${students.map(s=>{let done=0;const cells=slots.map(sl=>{const r=regFor(s.id,sl.dow,sl.period);if(r&&r.status!=="draft")done++;return `<td class="cell-center">${r?statusBadge(r.status):statusBadge("missing")}</td>`}).join("");return `<tr><td><div class="person"><span class="avatar">${initials(s.name)}</span><div><b>${esc(s.name)}</b><div class="tiny muted">${esc(s.code)}</div></div></div></td>${cells}<td><b>${done}/${slots.length}</b></td></tr>`}).join("")}
      </tbody></table></div></div>`;
    return html;
  }
  function missingPage(){
    const slots=effectiveSchedule(), rows=[];
    studentUsers().forEach(s=>slots.forEach(sl=>{const r=regFor(s.id,sl.dow,sl.period);if(!r||r.status==="draft")rows.push({s,sl});}));
    return head("Danh sách chưa đăng ký",`Tuần ${week().number} · ${rows.length} lượt còn thiếu`)+
      (rows.length?`<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Học sinh</th><th>Tiết tự học</th><th>Trạng thái</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.s.name)}</td><td>${slotLabel(x.sl.dow,x.sl.period)}</td><td>${statusBadge("missing")}</td></tr>`).join("")}</tbody></table></div></div>`:empty("🎉","Cả lớp đã đăng ký đầy đủ."));
  }

  function teacherDashboard(){
    const pendingAll=state.registrations.filter(r=>r.weekId===state.currentWeekId&&(r.status==="submitted"||r.status==="needs_revision"));
    const pending=pendingAll.slice(0,6), st=statsForWeek();
    const unread=(state.notifications||[]).filter(n=>!n.isRead).length;
    let html=head("Dashboard",`Tổng quan tuần ${week().number}`)+weekBanner();
    html+=`<div class="grid grid-5" style="margin-bottom:16px">${kpi("👥",st.students,"Thành viên")}${kpi("✨",st.autoApproved,"Duyệt nhanh")}${kpi("⌛",st.missing,"Chưa gửi")}${kpi("🔔",unread||pendingAll.length,"Cần GV xem")}${kpi("📈",st.rate+"%","Tỷ lệ hoàn thành")}</div>`;
    html+=`<div class="smart-approval-banner ${state.settings.smartApprovalEnabled===false?"off":"on"}">
      <div><b>${state.settings.smartApprovalEnabled===false?"⏸ Duyệt nhanh đang tắt":"✨ Duyệt nhanh đang bật"}</b>
      <span>${state.settings.smartApprovalEnabled===false?"Mọi đăng ký gửi mới sẽ chờ GV duyệt.":"Nội dung học tập rõ ràng được tự duyệt; nội dung còn lại báo chuông cho GV."}</span></div>
      <button class="btn btn-ghost" data-route-settings="1">Cài đặt</button>
    </div>`;
    html+=`<div class="grid grid-2"><div class="card"><h3>🔔 Cần giáo viên xử lý</h3>${pending.length?pending.map(approvalItem).join(""):empty("✅","Không còn đăng ký chờ xử lý.")}</div>
      <div class="card"><h3>Tuần hiện tại</h3><p><b>Tuần ${week().number}</b></p><p>${fmtDate(week().startDate)} – ${fmtDate(week().endDate)}</p><p><b>Kiểu deadline:</b> ${deadlineModeLabel(week().deadlineMode)}</p><p>${deadlineChip(week())}</p><p>Trạng thái: ${weekStatus(week().status)}</p>
      <div class="progress"><span style="width:${st.rate}%"></span></div><p class="muted tiny">${st.submitted}/${st.total} lượt đã đăng ký</p></div></div>`;
    return html;
  }
  function kpi(icon,val,label){return `<div class="card kpi"><div class="kpi-icon">${icon}</div><div><div class="kpi-value">${val}</div><div class="kpi-label">${label}</div></div></div>`;}
  function approvalItem(r){
    const s=state.users.find(u=>u.id===r.studentId);
    return `<div class="approval-item manual-review-item"><div class="approval-content"><div class="person"><span class="avatar">${initials(s?.name||"?")}</span><div><b>${esc(s?.name||"")}</b><div class="tiny muted">${slotLabel(r.dow,r.period)}</div></div></div><p><b>${esc(r.content)}</b></p><p>${esc(r.note||"")}</p>
      ${r.autoReviewReason?`<div class="review-reason">🧠 <b>Lý do cần GV xem:</b> ${esc(r.autoReviewReason)}</div>`:""}
      ${r.teacherComment?`<p style="color:#7c3aed">💬 ${esc(r.teacherComment)}</p>`:""}</div>
      <div class="approval-actions">${statusBadge(r.status)}<button class="btn btn-success approve-btn" data-id="${r.id}">✓ Duyệt</button><button class="btn btn-warning revise-btn" data-id="${r.id}">↩ Yêu cầu sửa</button><button class="btn btn-ghost comment-btn" data-id="${r.id}">💬 Nhận xét</button><button class="btn btn-danger delete-reg-btn" data-id="${r.id}">🗑 Xóa</button></div></div>`;
  }
  function bindTeacherActions(){
    content.querySelectorAll(".approve-btn").forEach(b=>b.onclick=()=>{const r=state.registrations.find(x=>x.id===b.dataset.id);if(r){r.status="approved";r.approvalSource="manual";r.approvedAt=Date.now();markLocalNotificationReadByReg(r.id);audit("Phê duyệt đăng ký",r.id);saveState();toast("Đã phê duyệt.","success");render();}});
    content.querySelectorAll(".revise-btn").forEach(b=>b.onclick=()=>teacherComment(b.dataset.id,true));
    content.querySelectorAll(".comment-btn").forEach(b=>b.onclick=()=>teacherComment(b.dataset.id,false));
    content.querySelectorAll(".delete-reg-btn").forEach(b=>b.onclick=()=>{
      const r=state.registrations.find(x=>x.id===b.dataset.id);
      if(!r) return;
      const s=state.users.find(u=>u.id===r.studentId);
      if(!confirm(`Xóa đăng ký của ${s?.name||"học sinh"} - ${slotLabel(r.dow,r.period)}?`)) return;
      markLocalNotificationReadByReg(r.id);
      state.registrations=state.registrations.filter(x=>x.id!==r.id);
      audit("Xóa mềm đăng ký",r.id,`${s?.name||""} - ${slotLabel(r.dow,r.period)}`);
      saveState(); toast("Đã xóa đăng ký.","success"); render();
    });
  }
  function teacherComment(id,needsRevision){
    const r=state.registrations.find(x=>x.id===id); if(!r)return;
    openModal(needsRevision?"Yêu cầu chỉnh sửa":"Nhận xét đăng ký",`<form id="commentForm"><label>Nhận xét<textarea id="teacherComment" required>${esc(r.teacherComment||"")}</textarea></label><button class="btn ${needsRevision?"btn-warning":"btn-primary"} btn-block">${needsRevision?"Gửi yêu cầu sửa":"Lưu nhận xét"}</button></form>`);
    $("#commentForm").onsubmit=e=>{e.preventDefault();r.teacherComment=$("#teacherComment").value.trim();if(needsRevision){r.status="needs_revision";markLocalNotificationReadByReg(r.id);}audit(needsRevision?"Yêu cầu chỉnh sửa":"Nhận xét",r.id,r.teacherComment);saveState();closeModal();toast("Đã lưu phản hồi.","success");render();};
  }
  function approvalsPage(){
    const pending=state.registrations.filter(r=>r.weekId===state.currentWeekId&&(r.status==="submitted"||r.status==="needs_revision"));
    const allWeek=state.registrations.filter(r=>r.weekId===state.currentWeekId);
    const allTable=allWeek.length?`<div class="card" style="margin-top:16px"><h3>Tất cả đăng ký tuần ${week().number}</h3>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Học sinh</th><th>Tiết</th><th>Nội dung</th><th>Trạng thái</th><th>Cách duyệt</th><th>Thao tác</th></tr></thead><tbody>
      ${allWeek.map(r=>{const s=state.users.find(u=>u.id===r.studentId);return `<tr><td>${esc(s?.name||"")}</td><td>${slotLabel(r.dow,r.period)}</td><td><b>${esc(r.content)}</b><div class="tiny muted">${esc(r.note||"")}</div></td><td>${statusBadge(r.status)}</td><td>${r.approvalSource==="auto_rule"?'<span class="auto-review-badge">✨ Tự động</span>':'<span class="manual-review-badge">👤 GV</span>'}</td><td><button class="btn btn-danger delete-reg-btn" data-id="${r.id}">🗑 Xóa</button></td></tr>`}).join("")}
      </tbody></table></div></div>`:"";
    return head("Duyệt đăng ký",`${pending.length} đăng ký đang cần xử lý`,
      pending.length?`<button class="btn btn-success" id="approveAll">✓ Duyệt tất cả đang chờ</button>`:"")+
      `<div class="card">${pending.length?pending.map(approvalItem).join(""):empty("🎉","Không có đăng ký cần xử lý.")}</div>`+allTable;
  }

  function schedulePage(){
    const current=effectiveSchedule(), set=new Set(current.map(s=>`${s.dow}-${s.period}`));
    let html=head("TKB tự học","Bật/tắt tiết tự học. Mặc định áp dụng cho toàn bộ tuần.",
      `<div class="toolbar"><label style="margin:0"><input id="weekSpecific" type="checkbox" style="width:auto"> Áp dụng riêng tuần ${week().number}</label><button id="saveSchedule" class="btn btn-primary">Lưu TKB</button></div>`);
    html+=`<div class="card"><div class="callout" style="margin-bottom:14px">Mỗi tiết 40 phút · Học Thứ 2–Thứ 6 · Nghỉ trưa 11:30–13:15.</div><div class="schedule-wrap"><div class="schedule-grid">
      <div></div>${DemoData.DOW.map(x=>`<div class="head">${x}</div>`).join("")}
      ${state.periods.map(p=>`<div class="period-label"><b>Tiết ${p.n}</b><span>${p.start}–${p.end}</span></div>${[0,1,2,3,4].map(d=>`<button class="slot-btn ${set.has(`${d}-${p.n}`)?"active":""}" data-slot="${d}-${p.n}" aria-label="${DemoData.DOW[d]} tiết ${p.n}">${set.has(`${d}-${p.n}`)?"●":"○"}</button>`).join("")}`).join("")}
      </div></div></div>`;
    return html;
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
    const rows=state.weeks.map(w=>{
      const mode=w.deadlineMode||"week_before_20";
      return `<div class="week-row v5-week-row ${w.id===state.currentWeekId?"active-week":""}" data-week-id="${w.id}">
        <div><b>Tuần ${w.number}</b><small>${w.id===state.currentWeekId?" · đang xem":""}</small></div>
        <div><b>${fmtDate(w.startDate)} – ${fmtDate(w.endDate)}</b><small>${w.number===1?" · mốc tuần đầu":""}</small></div>
        <select class="week-status" data-id="${w.id}" aria-label="Trạng thái tuần ${w.number}">
          <option value="upcoming" ${w.status==="upcoming"?"selected":""}>Sắp tới</option>
          <option value="open" ${w.status==="open"?"selected":""}>Đang mở</option>
          <option value="locked" ${w.status==="locked"?"selected":""}>Đã khóa</option>
          <option value="holiday" ${w.status==="holiday"?"selected":""}>Nghỉ</option>
        </select>
        <div class="deadline-choice">
          <select class="week-deadline-mode" data-id="${w.id}" aria-label="Chế độ deadline tuần ${w.number}">
            <option value="per_session_20" ${mode==="per_session_20"?"selected":""}>🕗 20:00 tối hôm trước từng buổi</option>
            <option value="week_before_20" ${mode==="week_before_20"?"selected":""}>📆 20:00 ngày trước khi tuần bắt đầu</option>
            <option value="specific" ${mode==="specific"?"selected":""}>🎯 Hạn cụ thể của tuần</option>
          </select>
          <input class="week-deadline" data-id="${w.id}" type="datetime-local"
            value="${w.deadline||""}" ${mode==="specific"?"":"disabled"}>
          <small class="deadline-preview">${deadlineSummary(w)}</small>
        </div>
        <button class="btn btn-ghost view-week" data-id="${w.id}">Xem tuần</button>
      </div>`;
    }).join("");

    return head("Quản lý tuần","Mỗi tuần có một chế độ deadline riêng; các chế độ loại trừ nhau.",
      `<div class="toolbar"><button class="btn btn-ghost" id="goCurrentWeek">📍 Tuần theo ngày hôm nay</button><button class="btn btn-primary" id="saveWeeks">💾 Lưu cấu hình tuần</button></div>`)+
      `<div class="card week-setup-card">
        <div>
          <div class="eyebrow-pill">🧭 Mốc năm học</div>
          <h3>Tuần 1 bắt đầu ngày nào?</h3>
          <p class="muted">Đặt mốc Tuần 1 một lần. Deadline được chọn <b>độc lập cho từng tuần</b> ở danh sách bên dưới.</p>
        </div>
        <div class="week-setup-grid v5-week-setup-grid">
          <label>Ngày bắt đầu Tuần 1
            <input id="week1Start" type="date" value="${first?.startDate||""}">
            <small>Phải là ngày Thứ Hai.</small>
          </label>
          <div class="deadline-mode-guide">
            <b>3 lựa chọn deadline</b>
            <span>🕗 Theo từng buổi: hạn 20:00 tối hôm trước buổi đó.</span>
            <span>📆 Trước tuần: hạn 20:00 ngày trước khi tuần bắt đầu.</span>
            <span>🎯 Hạn cụ thể: GV chọn một ngày/giờ dùng cho cả tuần.</span>
          </div>
          <button class="btn btn-primary glossy-action" id="applyWeekCalendar">✨ Áp dụng mốc tuần</button>
        </div>
        ${first?`<div class="calendar-preview">Tuần 1 hiện tại: <b>${fmtDate(first.startDate)} – ${fmtDate(first.endDate)}</b></div>`:""}
      </div>
      <div class="week-list">${rows}</div>`;
  }

  function bindWeeks(){
    $("#applyWeekCalendar")?.addEventListener("click",async()=>{
      const start=$("#week1Start").value;
      if(!start){toast("Hãy chọn ngày bắt đầu Tuần 1.","warn");return;}
      const d=new Date(`${start}T00:00:00Z`);
      if(d.getUTCDay()!==1){
        toast("Ngày bắt đầu Tuần 1 phải là Thứ Hai.","warn");return;
      }
      if(!confirm(`Xếp lại lịch với Tuần 1 bắt đầu ${fmtDate(start)}? Chế độ deadline riêng của từng tuần sẽ được giữ lại.`))return;

      try{
        if(isProd){
          await prod.teacherRebaseWeeks(start,"20:00");
          toast("Đã xếp lại lịch tuần và giữ chế độ deadline từng tuần.","success");
          await refreshFromServer(false);
        }else{
          const today=new Date().toISOString().slice(0,10);
          state.weeks.forEach((w,i)=>{
            w.startDate=addDaysDateISO(start,i*7);
            w.endDate=addDaysDateISO(w.startDate,4);
            if(!w.deadlineMode)w.deadlineMode="week_before_20";
          });
          const current=actualWeek();
          state.weeks.forEach(w=>{
            if(w.status==="holiday")return;
            w.status=w.id===current?.id?"open":(w.endDate<today?"locked":"upcoming");
          });
          if(current)state.currentWeekId=current.id;
          await saveState();toast("Đã xếp lại lịch tuần demo.","success");renderShell();render();
        }
      }catch(err){
        console.error(err);toast("Không xếp lại được lịch tuần: "+(err.message||err),"warn");
      }
    });

    content.querySelectorAll(".week-deadline-mode").forEach(sel=>sel.addEventListener("change",()=>{
      const row=sel.closest(".week-row");
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
      content.querySelectorAll(".week-status").forEach(el=>{
        const w=state.weeks.find(x=>x.id===el.dataset.id);if(w)w.status=el.value;
      });
      content.querySelectorAll(".week-deadline-mode").forEach(el=>{
        const w=state.weeks.find(x=>x.id===el.dataset.id);if(w)w.deadlineMode=el.value;
      });
      content.querySelectorAll(".week-deadline").forEach(el=>{
        const w=state.weeks.find(x=>x.id===el.dataset.id);
        if(!w)return;
        if((w.deadlineMode||"week_before_20")==="specific"&&!el.value){
          invalid=true;
          el.focus();
          return;
        }
        if(el.value)w.deadline=el.value;
      });
      if(invalid){toast("Tuần dùng “Hạn cụ thể” phải có ngày và giờ.","warn");return;}
      audit("Cập nhật tuần học","weeks");
      try{
        await saveState();
        toast("Đã lưu chế độ deadline độc lập cho từng tuần.","success");
        if(isProd)await refreshFromServer(false); else render();
      }catch{}
    });

    content.querySelectorAll(".view-week").forEach(b=>b.onclick=()=>{state.currentWeekId=b.dataset.id;saveState();renderShell();render();});
    $("#goCurrentWeek")?.addEventListener("click",()=>{
      const w=actualWeek();
      if(!w){toast("Chưa có tuần học nào.","warn");return;}
      state.currentWeekId=w.id;
      if(!isProd) saveState();
      toast(`Hôm nay thuộc/chuẩn bị vào Tuần ${w.number}.`,"success");
      renderShell();render();
    });
  }

  function weekStatus(x){return {open:"🟢 Đang mở",locked:"🔒 Đã khóa",upcoming:"🕒 Sắp tới",holiday:"🏖️ Nghỉ"}[x]||x;}

  function studentsPage(){
    const rows=state.users.filter(u=>u.role!=="teacher"&&!String(u.code||"").startsWith("__deleted__")).map(u=>`
      <tr>
        <td><b>${esc(u.code)}</b></td>
        <td><div class="person"><span class="avatar">${initials(u.name)}</span><b>${esc(u.name)}</b></div></td>
        <td>${roleLabel[u.role]||esc(u.role)}</td>
        <td>${u.active?'<span class="status approved">Hoạt động</span>':'<span class="status missing">Đã khóa</span>'}</td>
        <td>
          <div class="toolbar" style="gap:6px">
            <button class="btn btn-ghost edit-user-btn" data-id="${u.id}">✏️ Sửa tài khoản</button>
            ${isProd?`<button class="btn btn-ghost reset-password-btn" data-id="${u.id}">🔑 Đặt lại MK</button><button class="btn btn-danger delete-user-btn" data-id="${u.id}">🗑 Xóa tài khoản</button>`:`<button class="btn btn-danger delete-user-btn" data-id="${u.id}">🗑 Xóa tài khoản</button>`}
          </div>
        </td>
      </tr>`).join("");

    return head("Quản lý học sinh","Thêm mới, sửa mã đăng nhập, họ tên, vai trò, trạng thái và mật khẩu.",
      `<button class="btn btn-primary glossy-action" id="addStudentBtn">➕ Thêm học sinh</button>`)+
      `<div class="card">
        <div class="callout" style="margin-bottom:12px">
          Khi đổi <b>mã đăng nhập</b>, hệ thống sẽ đổi đồng thời định danh Auth nội bộ. Nút <b>Xóa tài khoản</b> sẽ vô hiệu hóa đăng nhập nhưng vẫn giữ lịch sử tự học của HS.
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Mã đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function bindStudents(){
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
            <input id="newStudentPassword" type="text" minlength="8" autocomplete="off" placeholder="Để trống để tự sinh">
            <small>Ít nhất 8 ký tự nếu tự nhập.</small>
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
          className:state.settings.className,
          password:$("#newStudentPassword").value.trim()
        };
        if(!/^[A-Z0-9._-]{2,32}$/.test(changes.code)){
          toast("Mã chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.","warn");return;
        }
        if(changes.password && changes.password.length<8){
          toast("Mật khẩu phải có ít nhất 8 ký tự.","warn");return;
        }

        try{
          if(isProd){
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
          }else{
            if(state.users.some(x=>x.code.toUpperCase()===changes.code)){
              toast("Mã đăng nhập đã tồn tại.","warn");return;
            }
            const id="demo-"+Date.now();
            state.users.push({id,code:changes.code,name:changes.fullName,email:`${changes.code.toLowerCase()}@demo.local`,role:changes.role,active:true});
            saveState();closeModal();toast("Đã thêm học sinh demo.","success");render();
          }
        }catch(err){
          console.error(err);toast("Không thêm được học sinh: "+(err.message||err),"warn");
        }
      };
    });

    content.querySelectorAll(".edit-user-btn").forEach(btn=>btn.addEventListener("click",()=>{
      const u=state.users.find(x=>x.id===btn.dataset.id); if(!u)return;
      openModal("Sửa tài khoản học sinh",`
        <form id="editUserForm">
          <div class="callout">Mã hiện tại: <b>${esc(u.code)}</b></div>
          <label>Mã đăng nhập *
            <input id="editUserCode" value="${esc(u.code)}" maxlength="32" required
              pattern="[A-Za-z0-9._-]{2,32}" placeholder="VD: 10A1-05">
          </label>
          <label>Họ và tên *
            <input id="editUserName" value="${esc(u.name)}" maxlength="120" required>
          </label>
          <label>Vai trò
            <select id="editUserRole">
              <option value="student" ${u.role==="student"?"selected":""}>Học sinh</option>
              <option value="monitor" ${u.role==="monitor"?"selected":""}>Cán sự lớp</option>
            </select>
          </label>
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
      $("#editUserForm").onsubmit=async e=>{
        e.preventDefault();
        const changes={
          code:$("#editUserCode").value.trim().toUpperCase(),
          fullName:$("#editUserName").value.trim(),
          role:$("#editUserRole").value,
          active:$("#editUserActive").checked
        };
        if(!/^[A-Z0-9._-]{2,32}$/.test(changes.code)){
          toast("Mã chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.","warn");return;
        }
        try{
          if(isProd){
            await prod.teacherUpdateUser(u.id,changes);
            closeModal();
            toast(`Đã cập nhật ${changes.code}.`,"success");
            await refreshFromServer(false);
          }else{
            if(state.users.some(x=>x.id!==u.id&&x.code.toUpperCase()===changes.code)){
              toast("Mã đăng nhập đã tồn tại.","warn");return;
            }
            Object.assign(u,{code:changes.code,name:changes.fullName,role:changes.role,active:changes.active});
            audit("Sửa tài khoản",u.id,changes.code);saveState();closeModal();render();
            toast("Đã cập nhật tài khoản demo.","success");
          }
        }catch(err){
          console.error(err);toast("Không cập nhật được tài khoản: "+(err.message||err),"warn");
        }
      };
    }));

    content.querySelectorAll(".delete-user-btn").forEach(btn=>btn.addEventListener("click",()=>{
      const u=state.users.find(x=>x.id===btn.dataset.id); if(!u)return;
      openModal("Xóa tài khoản học sinh",`
        <div class="danger-zone-card">
          <div class="danger-zone-icon">🗑️</div>
          <h3>${esc(u.name)}</h3>
          <p>Mã đăng nhập: <b>${esc(u.code)}</b></p>
          <div class="callout warning">
            <b>Thao tác này không thể hoàn tác.</b><br>
            Tài khoản đăng nhập sẽ bị xóa/không thể dùng lại, nhưng lịch sử đăng ký tự học của học sinh vẫn được giữ để GV tra cứu.
            Mã <b>${esc(u.code)}</b> sẽ được giải phóng để có thể cấp lại cho tài khoản mới.
          </div>
          <form id="deleteUserForm">
            <label>Nhập lại mã <b>${esc(u.code)}</b> để xác nhận
              <input id="deleteUserConfirmCode" autocomplete="off" required placeholder="${esc(u.code)}">
            </label>
            <div class="toolbar">
              <button class="btn btn-ghost" type="button" id="cancelDeleteUser">Hủy</button>
              <button class="btn btn-danger right" type="submit">Xóa tài khoản</button>
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
          if(isProd){
            await prod.teacherDeleteUser(u.id,confirmCode);
            closeModal();
            toast(`Đã xóa tài khoản ${u.code}; lịch sử được giữ lại.`,"success");
            await refreshFromServer(false);
          }else{
            const oldCode=u.code;
            u.active=false;
            u.code=`__deleted__${Date.now()}__${oldCode}`;
            audit("Xóa tài khoản demo",u.id,oldCode);
            await saveState();
            closeModal();toast("Đã xóa tài khoản demo; lịch sử được giữ.","success");render();
          }
        }catch(err){
          console.error(err);toast("Không xóa được tài khoản: "+(err.message||err),"warn");
        }
      };
    }));

    content.querySelectorAll(".reset-password-btn").forEach(btn=>btn.addEventListener("click",()=>{
      const u=state.users.find(x=>x.id===btn.dataset.id); if(!u)return;
      openModal("Đặt lại mật khẩu",`
        <div class="callout"><b>${esc(u.name)}</b> · ${esc(u.code)}</div>
        <form id="teacherResetPasswordForm">
          <label>Mật khẩu tạm mới<input id="teacherNewPassword" type="password" minlength="8" autocomplete="new-password" required></label>
          <label>Nhập lại mật khẩu<input id="teacherNewPassword2" type="password" minlength="8" autocomplete="new-password" required></label>
          <button class="btn btn-primary btn-block" type="submit">Đặt lại mật khẩu</button>
        </form>`);
      $("#teacherResetPasswordForm").onsubmit=async e=>{
        e.preventDefault();
        const p1=$("#teacherNewPassword").value,p2=$("#teacherNewPassword2").value;
        if(p1!==p2){toast("Hai mật khẩu chưa khớp.","warn");return;}
        try{
          await prod.teacherResetPassword(u.id,p1);
          closeModal();
          toast(`Đã đặt lại mật khẩu cho ${u.code}.`,"success");
        }catch(err){console.error(err);toast("Không đặt lại được mật khẩu: "+(err.message||err),"warn");}
      };
    }));
  }

  function statsPage(){
    const rows=state.weeks.slice(0,12).map(w=>{
      const old=state.currentWeekId; state.currentWeekId=w.id; const st=statsForWeek(); state.currentWeekId=old;
      return {w,rate:st.rate,submitted:st.submitted,total:st.total};
    });
    return head("Thống kê","Tỷ lệ đăng ký theo tuần.")+
      `<div class="grid grid-3" style="margin-bottom:16px">${kpi("📈",statsForWeek().rate+"%","Tuần đang xem")}${kpi("✅",statsForWeek().approved,"Đã duyệt")}${kpi("⚠️",statsForWeek().missing,"Còn thiếu")}</div>
      <div class="card"><h3>12 tuần đầu năm học</h3>${rows.map(x=>`<div class="bar-row"><span>Tuần ${x.w.number}</span><div class="bar-track"><div class="bar-fill" style="width:${x.rate}%"></div></div><b>${x.rate}%</b></div>`).join("")}
      <button id="exportCsv" class="btn btn-ghost" style="margin-top:12px">⬇ Xuất CSV tuần đang xem</button></div>`;
  }
  function bindStats(){
    $("#exportCsv")?.addEventListener("click",()=>{
      const slots=effectiveSchedule(), lines=[["Mã","Họ tên",...slots.map(s=>`${DemoData.DOW[s.dow]}-T${s.period}`)].join(",")];
      studentUsers().forEach(s=>lines.push([s.code,`"${s.name}"`,...slots.map(sl=>statusLabel[regFor(s.id,sl.dow,sl.period)?.status]||"Chưa đăng ký")].join(",")));
      const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"}), a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`so-tu-hoc-tuan-${week().number}.csv`;a.click();URL.revokeObjectURL(a.href);
      toast("Đã tạo file CSV.","success");
    });
  }

  function settingsPage(){
    return head("Cài đặt","Cấu hình lớp học, thông báo và duyệt nhanh.")+`<div class="grid grid-2">
      <div class="card"><h3>Thông tin lớp</h3><form id="settingsForm" class="form-grid">
        <label>Tên lớp<input id="setClass" value="${esc(state.settings.className)}"></label>
        <label>Năm học<input id="setYear" value="${esc(state.settings.schoolYear)}"></label>
        <label style="grid-column:1/-1">Thông báo tuần<textarea id="setAnnouncement">${esc(state.settings.announcement)}</textarea></label>
        <div class="smart-approval-setting" style="grid-column:1/-1">
          <label class="toggle-row">
            <input id="smartApprovalEnabled" type="checkbox" ${state.settings.smartApprovalEnabled!==false?"checked":""}>
            <span><b>✨ Duyệt nhanh thông minh</b><small>Tự duyệt nội dung học tập rõ ràng và việc dùng thiết bị điện tử cho mục đích học.</small></span>
          </label>
          <div class="callout" style="margin-top:10px">
            <b>Nguyên tắc:</b> nội dung học tập rõ ràng → tự duyệt; thiết bị điện tử + mục đích học rõ ràng → tự duyệt;
            giải trí/mạng xã hội, dùng thiết bị nhưng mục đích chưa rõ, hoặc nội dung mơ hồ → giữ <b>Chờ duyệt</b> và báo chuông cho GV.
          </div>
        </div>
        <button class="btn btn-primary" style="grid-column:1/-1">Lưu cài đặt</button>
      </form></div>
      <div class="card"><h3>Khung giờ chuẩn</h3><div class="table-wrap"><table class="data-table" style="min-width:0"><thead><tr><th>Tiết</th><th>Giờ học</th></tr></thead><tbody>${state.periods.map(p=>`<tr><td><b>Tiết ${p.n}</b></td><td>${p.start} – ${p.end}</td></tr>`).join("")}</tbody></table></div><div class="callout" style="margin-top:12px">Nghỉ 15 phút giữa tiết 2–3 và 7–8. Nghỉ trưa 11:30–13:15.</div></div>
      </div>`;
  }
  function bindSettings(){
    $("#settingsForm")?.addEventListener("submit",async e=>{
      e.preventDefault();
      state.settings.className=$("#setClass").value.trim();
      state.settings.schoolYear=$("#setYear").value.trim();
      state.settings.announcement=$("#setAnnouncement").value.trim();
      state.settings.smartApprovalEnabled=$("#smartApprovalEnabled").checked;
      state.audit.unshift({at:new Date().toISOString(),userId:currentUser?.id,action:"Cập nhật cài đặt",entityId:"settings",detail:""});
      try{
        await saveState();
        toast("Đã lưu cài đặt duyệt nhanh.","success");
        if(isProd)await refreshFromServer(false);else{renderShell();render();}
      }catch{}
    });
  }
  function empty(icon,text){return `<div class="empty"><img class="empty-image" src="assets/images/empty-state.svg" alt=""><div class="tiny muted">${icon}</div><b>${text}</b></div>`;}

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
      else if(route==="history")html=historyPage();
      else if(route==="comments")html=commentsPage();
      else html=classOverview();
    }else{
      if(route==="dashboard")html=teacherDashboard();
      else if(route==="approvals")html=approvalsPage();
      else if(route==="class")html=classOverview();
      else if(route==="schedule")html=schedulePage();
      else if(route==="weeks")html=weeksPage();
      else if(route==="students")html=studentsPage();
      else if(route==="stats")html=statsPage();
      else if(route==="settings")html=settingsPage();
      else html=teacherDashboard();
    }
    content.innerHTML=html;
    bindRegistrationButtons(); bindTeacherActions(); bindSchedule(); bindWeeks(); bindStudents(); bindStats(); bindSettings();
    content.querySelector("[data-route-settings]")?.addEventListener("click",()=>{route="settings";renderShell();render();});
    $("#approveAll")?.addEventListener("click",()=>{state.registrations.filter(r=>r.weekId===state.currentWeekId&&(r.status==="submitted"||r.status==="needs_revision")).forEach(r=>{r.status="approved";r.approvalSource="manual";r.approvedAt=Date.now();markLocalNotificationReadByReg(r.id);});audit("Duyệt hàng loạt","registrations");saveState();toast("Đã duyệt tất cả đăng ký đang chờ.","success");render();});
    renderShell();
  }

  async function refreshFromServer(showToast=true){
    if(!isProd) return;
    try{
      const loaded=await prod.loadState();
      if(!loaded.currentUser){ await logout(); return; }
      currentUser=loaded.currentUser; state=loaded.state; route=route||"dashboard";
      renderShell(); render();
      if(showToast) toast("Đã đồng bộ dữ liệu mới nhất.","success");
    }catch(err){ console.error(err); if(showToast) toast("Không tải được dữ liệu mới: "+(err.message||err),"warn"); }
  }
  $("#syncBtn")?.addEventListener("click",()=>refreshFromServer(true));

  if(isProd){
    try{
      await prod.init();
      const loaded=await prod.loadState();
      if(loaded.currentUser){
        currentUser=loaded.currentUser; state=loaded.state; renderShell(); render();
        const seconds=Math.max(30,Number(window.APP_CONFIG?.refreshSeconds||60));
        setInterval(()=>{ if(currentUser && !document.hidden) refreshFromServer(false); },seconds*1000);
      }else renderShell();
    }catch(err){
      console.error(err); renderShell();
      toast("Supabase chưa sẵn sàng: "+(err.message||err),"warn");
    }
    return;
  }

  // Demo cũng chọn tuần theo ngày khi vừa mở trang, thay vì cố định w1.
  const demoWeek=actualWeek(); if(demoWeek) state.currentWeekId=demoWeek.id;

  if(currentUser){
    const live=state.users.find(u=>u.id===currentUser.id&&u.active); if(live){currentUser=live;sessionStorage.setItem("soTuHocUser",JSON.stringify(live));renderShell();render();}else logout();
  }else renderShell();
})();
