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
      prod.syncState(state,currentUser).catch(err=>{
        console.error(err);
        toast("Không đồng bộ được dữ liệu: "+(err.message||err),"warn");
      });
    }else{
      localStorage.setItem(KEY,JSON.stringify(state));
    }
  }
  function resetDemo(){
    if(isProd){ toast("Chức năng khôi phục chỉ dùng ở chế độ Demo.","warn"); return; }
    state=DemoData.defaultState(); const aw=actualWeek(); if(aw)state.currentWeekId=aw.id; saveState(); toast("Đã khôi phục dữ liệu demo.","success"); render();
  }
  function esc(v=""){ return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
  function fmtDate(s){ if(!s)return""; const [y,m,d]=s.slice(0,10).split("-"); return `${d}/${m}/${y}`; }
  function fmtDateShort(s){ if(!s)return""; const [y,m,d]=s.slice(0,10).split("-"); return `${d}/${m}`; }
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
    let submitted=0,approved=0,needs=0;
    students.forEach(s=>slots.forEach(sl=>{
      const r=regFor(s.id,sl.dow,sl.period);
      if(r && r.status!=="draft"){submitted++;}
      if(r?.status==="approved")approved++;
      if(r?.status==="needs_revision")needs++;
    }));
    return {students:students.length,slots:slots.length,total,submitted,approved,needs,missing:Math.max(0,total-submitted),rate:total?Math.round(submitted/total*100):0};
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
  $("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
  $("#modalClose").onclick=closeModal; modal.addEventListener("click",e=>{if(e.target===modal)closeModal();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});

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
    return `<div class="banner"><div><h2>Tuần ${w.number} · ${fmtDateShort(w.startDate)}–${fmtDateShort(w.endDate)}</h2>
      <p>${esc(state.settings.announcement)}</p></div><img class="banner-image" src="${image}" alt="Minh họa hoạt động tự học"></div>`;
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
    const pe=period(sl.period), icon=r?.status==="approved"?"✅":r?.status==="needs_revision"?"📝":r?"📘":"🗒️";
    return `<div class="card study-card">
      <div class="study-icon">${icon}</div>
      <div class="study-main"><h3>${DemoData.DOW[sl.dow]} · Tiết ${sl.period}</h3><p>🕘 ${pe.start} – ${pe.end}</p>
      <p><b>${r?esc(r.content):"Chưa đăng ký"}</b></p>${r?.note?`<p>${esc(r.note)}</p>`:""}${r?.teacherComment?`<p style="color:#7c3aed">💬 GV: ${esc(r.teacherComment)}</p>`:""}</div>
      <div class="study-actions">${statusBadge(r?.status||"missing")}<button class="btn ${r?"btn-ghost":"btn-primary"} reg-btn" data-dow="${sl.dow}" data-period="${sl.period}">${r?"Xem / sửa":"+ Đăng ký ngay"}</button></div>
    </div>`;
  }
  function bindRegistrationButtons(){
    content.querySelectorAll(".reg-btn").forEach(b=>b.onclick=()=>registrationModal(Number(b.dataset.dow),Number(b.dataset.period)));
  }
  function registrationModal(dow,p){
    const w=week(), r=regFor(currentUser.id,dow,p), pe=period(p);
    const locked=w.status==="locked"||w.status==="holiday"||r?.status==="approved";
    openModal(`${DemoData.DOW[dow]} · Tiết ${p}`,`
      <div class="callout">${fmtDate(w.startDate)}–${fmtDate(w.endDate)} · ${pe.start}–${pe.end}</div>
      ${r?.teacherComment?`<div class="callout warning" style="margin-top:10px"><b>Nhận xét giáo viên:</b><br>${esc(r.teacherComment)}</div>`:""}
      <form id="regForm">
        <label>Nội dung tự học *
          <input id="regContent" maxlength="180" required value="${esc(r?.content||"")}" ${locked?"disabled":""} placeholder="VD: Ôn tập phương trình bậc hai">
        </label>
        <label>Ghi chú / mục tiêu
          <textarea id="regNote" maxlength="500" ${locked?"disabled":""} placeholder="Nêu bài, trang hoặc mục tiêu cụ thể...">${esc(r?.note||"")}</textarea>
        </label>
        ${locked?`<p class="muted tiny">Đăng ký đã duyệt hoặc tuần đã khóa nên học sinh không thể chỉnh sửa.</p>`:
        `<div class="toolbar"><button type="button" id="saveDraft" class="btn btn-ghost">Lưu nháp</button><button class="btn btn-primary right" type="submit">Gửi đăng ký</button></div>`}
      </form>`);
    if(locked)return;
    const save=(status)=>{
      const contentVal=$("#regContent").value.trim(); if(!contentVal){toast("Bạn cần nhập nội dung tự học.","warn");return;}
      let rr=regFor(currentUser.id,dow,p);
      if(!rr){rr={id:"r"+Date.now(),studentId:currentUser.id,weekId:state.currentWeekId,dow,period:p,teacherComment:"",updatedAt:Date.now()};state.registrations.push(rr);}
      Object.assign(rr,{content:contentVal,note:$("#regNote").value.trim(),status,updatedAt:Date.now()});
      audit(status==="draft"?"Lưu nháp":"Gửi đăng ký",rr.id,rr.content); saveState(); closeModal(); toast(status==="draft"?"Đã lưu nháp.":"Đã gửi đăng ký.","success"); render();
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
    const st=statsForWeek(), pending=state.registrations.filter(r=>r.weekId===state.currentWeekId&&(r.status==="submitted"||r.status==="needs_revision")).slice(0,6);
    let html=head("Dashboard",`Tổng quan tuần ${week().number}`)+weekBanner();
    html+=`<div class="grid grid-5" style="margin-bottom:16px">${kpi("👥",st.students,"Thành viên")}${kpi("📨",st.submitted,"Đã gửi")}${kpi("⌛",st.missing,"Chưa gửi")}${kpi("🕒",pending.length,"Cần xử lý")}${kpi("📈",st.rate+"%","Tỷ lệ hoàn thành")}</div>`;
    html+=`<div class="grid grid-2"><div class="card"><h3>Cần xử lý</h3>${pending.length?pending.map(approvalItem).join(""):empty("✅","Không còn đăng ký chờ xử lý.")}</div>
      <div class="card"><h3>Tuần hiện tại</h3><p><b>Tuần ${week().number}</b></p><p>${fmtDate(week().startDate)} – ${fmtDate(week().endDate)}</p><p>Hạn đăng ký: ${week().deadline?fmtDate(week().deadline.slice(0,10))+" "+week().deadline.slice(11,16):"Chưa đặt"}</p><p>Trạng thái: ${weekStatus(week().status)}</p>
      <div class="progress"><span style="width:${st.rate}%"></span></div><p class="muted tiny">${st.submitted}/${st.total} lượt đã đăng ký</p></div></div>`;
    return html;
  }
  function kpi(icon,val,label){return `<div class="card kpi"><div class="kpi-icon">${icon}</div><div><div class="kpi-value">${val}</div><div class="kpi-label">${label}</div></div></div>`;}
  function approvalItem(r){
    const s=state.users.find(u=>u.id===r.studentId);
    return `<div class="approval-item"><div class="approval-content"><div class="person"><span class="avatar">${initials(s?.name||"?")}</span><div><b>${esc(s?.name||"")}</b><div class="tiny muted">${slotLabel(r.dow,r.period)}</div></div></div><p><b>${esc(r.content)}</b></p><p>${esc(r.note||"")}</p>${r.teacherComment?`<p style="color:#7c3aed">💬 ${esc(r.teacherComment)}</p>`:""}</div>
      <div class="approval-actions">${statusBadge(r.status)}<button class="btn btn-success approve-btn" data-id="${r.id}">✓ Duyệt</button><button class="btn btn-warning revise-btn" data-id="${r.id}">↩ Yêu cầu sửa</button><button class="btn btn-ghost comment-btn" data-id="${r.id}">💬 Nhận xét</button><button class="btn btn-danger delete-reg-btn" data-id="${r.id}">🗑 Xóa</button></div></div>`;
  }
  function bindTeacherActions(){
    content.querySelectorAll(".approve-btn").forEach(b=>b.onclick=()=>{const r=state.registrations.find(x=>x.id===b.dataset.id);if(r){r.status="approved";r.approvedAt=Date.now();audit("Phê duyệt đăng ký",r.id);saveState();toast("Đã phê duyệt.","success");render();}});
    content.querySelectorAll(".revise-btn").forEach(b=>b.onclick=()=>teacherComment(b.dataset.id,true));
    content.querySelectorAll(".comment-btn").forEach(b=>b.onclick=()=>teacherComment(b.dataset.id,false));
    content.querySelectorAll(".delete-reg-btn").forEach(b=>b.onclick=()=>{
      const r=state.registrations.find(x=>x.id===b.dataset.id);
      if(!r) return;
      const s=state.users.find(u=>u.id===r.studentId);
      if(!confirm(`Xóa đăng ký của ${s?.name||"học sinh"} - ${slotLabel(r.dow,r.period)}?`)) return;
      state.registrations=state.registrations.filter(x=>x.id!==r.id);
      audit("Xóa mềm đăng ký",r.id,`${s?.name||""} - ${slotLabel(r.dow,r.period)}`);
      saveState(); toast("Đã xóa đăng ký.","success"); render();
    });
  }
  function teacherComment(id,needsRevision){
    const r=state.registrations.find(x=>x.id===id); if(!r)return;
    openModal(needsRevision?"Yêu cầu chỉnh sửa":"Nhận xét đăng ký",`<form id="commentForm"><label>Nhận xét<textarea id="teacherComment" required>${esc(r.teacherComment||"")}</textarea></label><button class="btn ${needsRevision?"btn-warning":"btn-primary"} btn-block">${needsRevision?"Gửi yêu cầu sửa":"Lưu nhận xét"}</button></form>`);
    $("#commentForm").onsubmit=e=>{e.preventDefault();r.teacherComment=$("#teacherComment").value.trim();if(needsRevision)r.status="needs_revision";audit(needsRevision?"Yêu cầu chỉnh sửa":"Nhận xét",r.id,r.teacherComment);saveState();closeModal();toast("Đã lưu phản hồi.","success");render();};
  }
  function approvalsPage(){
    const pending=state.registrations.filter(r=>r.weekId===state.currentWeekId&&(r.status==="submitted"||r.status==="needs_revision"));
    const allWeek=state.registrations.filter(r=>r.weekId===state.currentWeekId);
    const allTable=allWeek.length?`<div class="card" style="margin-top:16px"><h3>Tất cả đăng ký tuần ${week().number}</h3>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Học sinh</th><th>Tiết</th><th>Nội dung</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      ${allWeek.map(r=>{const s=state.users.find(u=>u.id===r.studentId);return `<tr><td>${esc(s?.name||"")}</td><td>${slotLabel(r.dow,r.period)}</td><td><b>${esc(r.content)}</b><div class="tiny muted">${esc(r.note||"")}</div></td><td>${statusBadge(r.status)}</td><td><button class="btn btn-danger delete-reg-btn" data-id="${r.id}">🗑 Xóa</button></td></tr>`}).join("")}
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
    const rows=state.weeks.map(w=>`<div class="week-row ${w.id===state.currentWeekId?"active-week":""}">
      <div><b>Tuần ${w.number}</b><small>${w.id===state.currentWeekId?" · đang xem":""}</small></div>
      <div>${fmtDate(w.startDate)} – ${fmtDate(w.endDate)}</div>
      <select class="week-status" data-id="${w.id}">
        <option value="upcoming" ${w.status==="upcoming"?"selected":""}>Sắp tới</option>
        <option value="open" ${w.status==="open"?"selected":""}>Đang mở</option>
        <option value="locked" ${w.status==="locked"?"selected":""}>Đã khóa</option>
        <option value="holiday" ${w.status==="holiday"?"selected":""}>Nghỉ</option>
      </select>
      <input class="week-deadline" data-id="${w.id}" type="datetime-local" value="${w.deadline||""}">
      <button class="btn btn-ghost view-week" data-id="${w.id}">Xem</button>
    </div>`).join("");
    return head("Quản lý tuần","Theo dõi toàn bộ tuần trong năm học. Tuần mặc định được xác định theo ngày hiện tại.",
      `<div class="toolbar"><button class="btn btn-ghost" id="goCurrentWeek">📍 Tuần hiện tại</button><button class="btn btn-primary" id="saveWeeks">Lưu thay đổi</button></div>`)+`<div class="week-list">${rows}</div>`;
  }
  function bindWeeks(){
    $("#saveWeeks")?.addEventListener("click",()=>{
      content.querySelectorAll(".week-status").forEach(el=>{const w=state.weeks.find(x=>x.id===el.dataset.id);if(w)w.status=el.value;});
      content.querySelectorAll(".week-deadline").forEach(el=>{const w=state.weeks.find(x=>x.id===el.dataset.id);if(w)w.deadline=el.value;});
      audit("Cập nhật tuần học","weeks");saveState();toast("Đã lưu cấu hình tuần.","success");render();
    });
    content.querySelectorAll(".view-week").forEach(b=>b.onclick=()=>{state.currentWeekId=b.dataset.id;saveState();renderShell();render();});
    $("#goCurrentWeek")?.addEventListener("click",()=>{
      const w=actualWeek();
      if(!w){toast("Chưa có tuần học nào.","warn");return;}
      state.currentWeekId=w.id;
      if(!isProd) saveState();
      toast(`Đã chuyển về tuần ${w.number}.`,"success");
      renderShell();render();
    });
  }
  function weekStatus(x){return {open:"🟢 Đang mở",locked:"🔒 Đã khóa",upcoming:"🕒 Sắp tới",holiday:"🏖️ Nghỉ"}[x]||x;}

  function studentsPage(){
    const rows=state.users.filter(u=>u.role!=="teacher").map(u=>`
      <tr>
        <td><b>${esc(u.code)}</b></td>
        <td><div class="person"><span class="avatar">${initials(u.name)}</span><b>${esc(u.name)}</b></div></td>
        <td>${roleLabel[u.role]||esc(u.role)}</td>
        <td>${u.active?'<span class="status approved">Hoạt động</span>':'<span class="status missing">Đã khóa</span>'}</td>
        <td>
          <div class="toolbar" style="gap:6px">
            <button class="btn btn-ghost edit-user-btn" data-id="${u.id}">✏️ Sửa tài khoản</button>
            ${isProd?`<button class="btn btn-ghost reset-password-btn" data-id="${u.id}">🔑 Đặt lại MK</button>`:""}
          </div>
        </td>
      </tr>`).join("");

    return head("Quản lý học sinh","Sửa mã đăng nhập, họ tên, vai trò, trạng thái và mật khẩu.")+
      `<div class="card">
        <div class="callout" style="margin-bottom:12px">
          Khi đổi <b>mã đăng nhập</b>, hệ thống sẽ đổi đồng thời định danh Auth nội bộ. Học sinh dùng mã mới từ lần đăng nhập tiếp theo.
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
    return head("Cài đặt","Cấu hình lớp học và thông báo.")+`<div class="grid grid-2">
      <div class="card"><h3>Thông tin lớp</h3><form id="settingsForm" class="form-grid">
        <label>Tên lớp<input id="setClass" value="${esc(state.settings.className)}"></label>
        <label>Năm học<input id="setYear" value="${esc(state.settings.schoolYear)}"></label>
        <label style="grid-column:1/-1">Thông báo tuần<textarea id="setAnnouncement">${esc(state.settings.announcement)}</textarea></label>
        <button class="btn btn-primary" style="grid-column:1/-1">Lưu cài đặt</button>
      </form></div>
      <div class="card"><h3>Khung giờ chuẩn</h3><div class="table-wrap"><table class="data-table" style="min-width:0"><thead><tr><th>Tiết</th><th>Giờ học</th></tr></thead><tbody>${state.periods.map(p=>`<tr><td><b>Tiết ${p.n}</b></td><td>${p.start} – ${p.end}</td></tr>`).join("")}</tbody></table></div><div class="callout" style="margin-top:12px">Nghỉ 15 phút giữa tiết 2–3 và 7–8. Nghỉ trưa 11:30–13:15.</div></div>
      </div>`;
  }
  function bindSettings(){
    $("#settingsForm")?.addEventListener("submit",e=>{e.preventDefault();state.settings.className=$("#setClass").value.trim();state.settings.schoolYear=$("#setYear").value.trim();state.settings.announcement=$("#setAnnouncement").value.trim();audit("Cập nhật cài đặt","settings");saveState();toast("Đã lưu cài đặt.","success");renderShell();render();});
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
    $("#approveAll")?.addEventListener("click",()=>{state.registrations.filter(r=>r.weekId===state.currentWeekId&&r.status==="submitted").forEach(r=>{r.status="approved";r.approvedAt=Date.now();});audit("Duyệt hàng loạt","registrations");saveState();toast("Đã duyệt tất cả đăng ký đang chờ.","success");render();});
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
