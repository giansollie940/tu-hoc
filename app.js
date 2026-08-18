import { renderDeviceChoice } from "./features/registration/registration-form.js";
import {
  passwordChecklistState,
  renderPasswordDialog
} from "./features/account/password-dialog.js";
import {
  renderClassOverview as renderClassOverviewV830,
  renderSessionDetails
} from "./features/class-overview/class-overview.js";
import { initOwlPet } from "./ui/owl-pet.js";
import { friendlyAppError } from "./utils/error-map.js";

(async () => {
  const prod = window.SupabaseService;
  let state = null;
  let currentUser = null;
  let route="dashboard";
  let weekSelectionTouched=false;

  const $ = s => document.querySelector(s);
  const content=$("#content"), loginView=$("#loginView"), appView=$("#appView");
  const modal=$("#modal"), modalBody=$("#modalBody"), modalTitle=$("#modalTitle");
  const safeErrorMessage=(error,fallback)=>{
    const mapped=friendlyAppError(error);
    return mapped.code==="UNKNOWN"?fallback:mapped.message;
  };

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

  const roleLabel={student:"Học sinh",monitor:"Cán sự lớp",teacher:"Giáo viên"};
  const statusLabel={approved:"Đã duyệt",submitted:"Chờ duyệt",needs_revision:"Cần chỉnh sửa",draft:"Bản nháp",missing:"Chưa đăng ký"};
  const DOW=["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6"];
  const navs={
    student:[
      ["dashboard","🌟","Trang chủ"],["register","🪄","Đăng ký tự học"],["history","📚","Lịch sử của tôi"],["comments","💎","Nhận xét của GV"]
    ],
    monitor:[
      ["dashboard","🌈","Tổng quan"],["register","✨","Đăng ký của tôi"],["class","🫶","Theo dõi cả lớp"],
      ["missing","🚨","Danh sách thiếu"],["history","📚","Lịch sử của tôi"],["comments","💎","Nhận xét của GV"]
    ],
    teacher:[
      ["dashboard","🌠","Dashboard"],["approvals","🪄","Duyệt đăng ký"],["class","🫶","Theo dõi cả lớp"],["schedule","🗓️","TKB tự học"],
      ["weeks","📆","Quản lý tuần"],["students","🧑‍🎓","Quản lý học sinh"],["stats","📈","Thống kê"],["settings","🦄","Cài đặt"]
    ]
  };


  const uiIcons={
    dashboard:`<svg viewBox="0 0 24 24" fill="none"><path d="M4 13.2 12 5l8 8.2V20a1 1 0 0 1-1 1h-4.8v-5.3H9.8V21H5a1 1 0 0 1-1-1v-6.8Z" stroke-width="2" stroke-linejoin="round"/></svg>`,
    approvals:`<svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8l4 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke-width="2" stroke-linejoin="round"/><path d="M9 13.5l2 2 4-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
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
    user:`<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke-width="2"/><path d="M5 19c1.2-2.9 4-4.7 7-4.7s5.8 1.8 7 4.7" stroke-width="2" stroke-linecap="round"/></svg>`
  };

  function uiIcon(name, extraClass=""){
    const svg=uiIcons[name]||uiIcons.dashboard;
    return `<span class="ui-icon ${extraClass||""}" aria-hidden="true">${svg}</span>`;
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
      missing:"missing"
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
  let owlReady=false, owlHideTimer=null, owlMessageCursor=0, owlLastUrgentCount=-1, owlQuoteBag=[];

  function shuffleOwlQuotes(list){
    const arr=[...list];
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function nextOwlQuote(){
    if(!owlQuoteBag.length) owlQuoteBag=shuffleOwlQuotes(OWL_QUOTES);
    const next=owlQuoteBag.shift() || OWL_QUOTES[0];
    if(owlQuoteBag.length && owlQuoteBag[0]?.text===next?.text){
      owlQuoteBag=shuffleOwlQuotes(owlQuoteBag);
    }
    return next;
  }

  function nextWiseOwlQuoteInstant(){
    const q=nextOwlQuote();
    return {
      ...q,
      url:OWL_QUOTE_SOURCE,
      poolSize:OWL_QUOTES.length
    };
  }

  function setupWiseOwl(){
    if(owlReady)return;

    const pet=$("#wiseOwlPet");
    const body=$("#owlBody");
    const speech=$("#owlSpeech");
    const closeBtn=$("#owlMuteBtn");
    if(!pet||!body||!speech)return;
    initOwlPet(document);

    owlReady=true;

    body.addEventListener("click",()=>{
      owlMessageCursor++;
      speech.classList.remove("hidden");

      pet.classList.remove("owl-flap");
      void pet.offsetWidth;
      pet.classList.add("owl-flap");
      setTimeout(()=>pet.classList.remove("owl-flap"),1350);

      showOwlMessage({
        preferQuote:owlMessageCursor%3===0,
        force:true
      });
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

  function owlContextMessages(){
    if(!currentUser||!state)return [];
    const messages=[];
    const w=week();

    if(currentUser.role==="teacher"){
      const unread=(state.notifications||[]).filter(n=>!n.isRead).length;
      const aiPending=(state.registrations||[]).filter(r=>r.aiReviewStatus==="pending"||r.aiReviewStatus==="processing").length;
      const manual=(state.registrations||[]).filter(r=>r.weekId===state.currentWeekId&&(r.status==="submitted"||r.status==="needs_revision")).length;
      if(unread)messages.push({urgent:true,text:`🔔 Thầy/cô có ${unread} thông báo mới cần xem. Cú đã đánh dấu chuông ở góc trên.`});
      if(aiPending)messages.push({text:`🤖 AI đang phân loại ${aiPending} đăng ký. Trường hợp chưa đủ chắc chắn sẽ tự chuyển sang thầy/cô.`});
      if(manual)messages.push({urgent:true,text:`📋 Tuần ${w.number} còn ${manual} đăng ký cần giáo viên xử lý.`});
    }else{
      const mine=(state.registrations||[]).filter(r=>r.studentId===currentUser.id&&r.weekId===state.currentWeekId);
      const needs=mine.filter(r=>r.status==="needs_revision").length;
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

    let urgentCount=0;
    if(currentUser.role==="teacher"){
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
  function deadlineModeLabel(mode){
    return {
      per_session_20:"20:00 tối hôm trước từng buổi",
      week_before_20:"20:00 ngày trước khi tuần bắt đầu",
      specific:"Hạn cụ thể của tuần"
    }[mode||"per_session_20"] || "Hạn đăng ký";
  }
  function deadlineForSlot(w,dow=0){
    if(!w)return "";
    const mode=w.deadlineMode||"per_session_20";
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
    const mode=w?.deadlineMode||"per_session_20";
    if(mode==="per_session_20" && dow===null){
      return `<span class="deadline-chip ok">⏰ Theo từng buổi: 20:00 tối hôm trước</span>`;
    }
    const dl=deadlineForSlot(w,dow??0);
    if(!dl)return `<span class="deadline-chip neutral">⏰ Chưa đặt deadline</span>`;
    return `<span class="deadline-chip ${deadlinePassed(w,dow??0)?"late":"ok"}">⏰ ${fmtDeadline(dl)}${deadlinePassed(w,dow??0)?" · Đã qua hạn":""}</span>`;
  }
  function deadlineSummary(w){
    const mode=w?.deadlineMode||"per_session_20";
    if(mode==="per_session_20") return "Mỗi buổi: 20:00 tối hôm trước";
    if(mode==="week_before_20") return fmtDeadline(deadlineForSlot(w,0));
    return w?.deadline ? fmtDeadline(w.deadline) : "Chưa chọn hạn cụ thể";
  }
  function markLocalNotificationReadByReg(registrationId){
    (state.notifications||[]).forEach(n=>{
      if(n.registrationId===registrationId)n.isRead=true;
    });
  }

  function week(){ return state.weeks.find(w=>w.id===state.currentWeekId)||state.weeks[0]; }
  function todayDateISO(){
    if(prod?.dateISOInTimeZone)return prod.dateISOInTimeZone(new Date());
    const now=new Date();
    const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,"0"),d=String(now.getDate()).padStart(2,"0");
    return `${y}-${m}-${d}`;
  }

  function actualWeek(){
    if(!state.weeks?.length)return null;
    const today=todayDateISO();

    // Tuần học được tính từ Thứ Hai đến Chủ nhật để cuối tuần vẫn thuộc tuần hiện tại.
    return state.weeks.find(w=>w.startDate<=today&&addDaysDateISO(w.startDate,6)>=today)
      || state.weeks.find(w=>w.startDate>today)
      || state.weeks[state.weeks.length-1];
  }

  function automaticWeekStatus(w){
    if(!w)return "upcoming";
    const today=todayDateISO();
    const anchor=state.weeks.find(x=>x.startDate<=today&&addDaysDateISO(x.startDate,6)>=today);

    if(!anchor){
      if(w.endDate<today)return "locked";
      return "upcoming";
    }
    if(w.number<anchor.number)return "locked";
    if(w.number===anchor.number||w.number===anchor.number+1)return "open";
    return "upcoming";
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
  function openModal(title,html){ modalTitle.textContent=title; modalBody.innerHTML=html; modal.classList.remove("hidden"); }
  function closeModal(){ modal.classList.add("hidden"); modalBody.innerHTML=""; }
  function audit(action,entityId,detail=""){ state.audit.unshift({at:new Date().toISOString(),userId:currentUser?.id,action,entityId,detail}); saveState(); }

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

  function recommendedStudentWeek(){
    if(!state?.weeks?.length)return null;
    const openWeeks=state.weeks
      .filter(w=>effectiveWeekStatus(w)==="open")
      .sort((a,b)=>a.number-b.number);

    for(const w of openWeeks){
      const slots=scheduleForWeek(w.id);
      if(slots.some(sl=>{
        const start=sessionStartTime(w,sl.dow,sl.period);
        return Number.isFinite(start)&&Date.now()<start;
      })){
        return w;
      }
    }

    return actualWeek()||state.weeks[0];
  }

  function alignStudentWeekToNextAction(force=false){
    if(!currentUser||!["student","monitor"].includes(currentUser.role))return false;
    if(weekSelectionTouched&&!force)return false;

    const recommended=recommendedStudentWeek();
    if(!recommended||recommended.id===state.currentWeekId)return false;

    state.currentWeekId=recommended.id;
    return true;
  }
  function regFor(studentId,dow,p,weekId=state.currentWeekId){
    return state.registrations.find(r=>r.studentId===studentId&&r.weekId===weekId&&r.dow===dow&&r.period===p);
  }
  function statsForWeek(){
    const students=studentUsers(), slots=effectiveSchedule();
    const total=students.length*slots.length;
    let submitted=0,approved=0,needs=0,autoApproved=0,aiApproved=0;
    students.forEach(s=>slots.forEach(sl=>{
      const r=regFor(s.id,sl.dow,sl.period);
      if(r && r.status!=="draft"){submitted++;}
      if(r?.status==="approved")approved++;
      if(r?.status==="approved"&&["auto_rule","ai"].includes(r?.approvalSource))autoApproved++;
      if(r?.status==="approved"&&r?.approvalSource==="ai")aiApproved++;
      if(r?.status==="needs_revision")needs++;
    }));
    return {students:students.length,slots:slots.length,total,submitted,approved,autoApproved,aiApproved,needs,missing:Math.max(0,total-submitted),rate:total?Math.round(submitted/total*100):0};
  }

  function login(user){
    currentUser=user;
    route="dashboard"; renderShell(); render();
  }
  async function logout(){
    try{ await prod.signOut(); }catch(err){ console.error(err); }
    currentUser=null;
    $("#wiseOwlPet")?.classList.add("hidden");
    $("#owlSpeech")?.classList.add("hidden");
    appView.classList.add("hidden"); loginView.classList.remove("hidden");
  }
  $("#loginForm").addEventListener("submit",async e=>{
    e.preventDefault();
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
      console.error(err); toast("Đăng nhập không thành công. Hãy kiểm tra mã và mật khẩu.","warn");
    }
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
    $("#sideNav").innerHTML=navs[currentUser.role].map(n=>`<button class="nav-btn ${route===n[0]?"active":""}" data-route="${n[0]}">${navIconFor(n[0])}<span class="nav-label">${n[2]}</span></button>`).join("");
    $("#sideNav").querySelectorAll("[data-route]").forEach(b=>b.onclick=()=>{route=b.dataset.route; setSidebarOpen(false); renderShell(); render();});
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

    refreshWiseOwl();
  }
  async function selectWeek(weekId,{announce=false}={}){
    if(!weekId)return;
    try{
      const weekData=await prod.loadWeekData(weekId);
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
    weekSelectionTouched=true;
    await selectWeek(e.target.value);
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
  const setSidebarOpen=(open)=>{
    sidebar?.classList.toggle("open",Boolean(open));
    menuBtn?.setAttribute("aria-expanded",String(Boolean(open)));
    menuBtn?.setAttribute("aria-label",open?"Đóng menu":"Mở menu");
  };
  menuBtn.onclick=()=>setSidebarOpen(!sidebar.classList.contains("open"));
  $("#modalClose").onclick=closeModal; modal.addEventListener("click",e=>{if(e.target===modal)closeModal();});
  document.addEventListener("keydown",e=>{
    if(e.key!=="Escape")return;
    closeModal();
    setSidebarOpen(false);
  });

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
      try{await prod.markNotificationsRead(unread.map(n=>n.id));}
      catch(err){console.error("markNotificationsRead",err);}
    }
  }

  function changeOwnPasswordModal(){
    openModal("Đổi mật khẩu",renderPasswordDialog());
    const newPasswordInput=$("#newOwnPassword");
    const updateChecklist=()=>{
      const rules=passwordChecklistState(newPasswordInput.value);
      modalBody.querySelector('[data-password-rule="length"]')?.classList.toggle("valid",rules.hasMinLength);
      modalBody.querySelector('[data-password-rule="mixed"]')?.classList.toggle("valid",rules.hasLetterAndNumber);
    };
    newPasswordInput.addEventListener("input",updateChecklist);
    updateChecklist();

    $("#changePasswordForm").onsubmit=async e=>{
      e.preventDefault();
      const current=$("#currentOwnPassword").value;
      const p1=newPasswordInput.value, p2=$("#newOwnPassword2").value;
      const rules=passwordChecklistState(p1);
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
    const actual=actualWeek();
    const viewingNext=actual&&week().number>actual.number;
    let html=head("Trang chủ",`Xin chào ${esc(currentUser.name)} 👋`)+weekBanner();
    if(viewingNext){
      html+=`<div class="callout next-action-week"><b>➡ Đã chuyển sang Tuần ${week().number}.</b> Các buổi còn lại của tuần trước đã bắt đầu/đã qua nên app ưu tiên tuần có buổi đăng ký tiếp theo.</div>`;
    }
    html+=`<div class="card" style="margin-bottom:16px"><div class="toolbar"><b>Tiến độ của bạn</b><span class="right"><b>${done}/${total}</b> tiết</span></div><div class="progress" style="margin-top:10px"><span style="width:${pct}%"></span></div></div>`;
    if(!slots.length) html+=empty("📅","Tuần này chưa có tiết tự học.");
    else html+=`<div class="grid">${slots.map((sl,i)=>studyCard(sl,regs[i])).join("")}</div>`;
    return html;
  }
  function studyCard(sl,r){
    const w=week();
    const pe=period(sl.period);
    const effectiveStatus=effectiveWeekStatus(w);
    const started=sessionHasStarted(w,sl.dow,sl.period);
    const pastDeadline=deadlinePassed(w,sl.dow);
    const emergency=emergencyRegistrationEligible(w,sl.dow,sl.period,r);

    const icon=r?.status==="approved"
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
    const revisionEditable=r?.status==="needs_revision";
    const ordinaryEditable=!!r&&["draft","submitted"].includes(r.status)&&effectiveStatus==="open"&&!pastDeadline&&!started;
    const editable=approvedEditable||revisionEditable||ordinaryEditable;

    let actionHtml="";
    if(r){
      const label=approvedEditable
        ?"Sửa đăng ký"
        :revisionEditable
          ?"Sửa theo yêu cầu"
          :ordinaryEditable
            ?"Xem / sửa"
            :"Xem";
      actionHtml=`<button class="btn ${editable?"btn-ghost":"btn-soft"} reg-btn" data-dow="${sl.dow}" data-period="${sl.period}">${label}</button>`;
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
        ${emergency?`<p class="tiny emergency-note">🚨 Deadline đã qua nhưng buổi học chưa bắt đầu. Chỉ còn đăng ký bổ sung khẩn cấp và giáo viên sẽ duyệt.</p>`:""}
        <p><b>${r?esc(r.content):"Chưa đăng ký"}</b></p>
        ${r?.note?`<p>${esc(r.note)}</p>`:""}
        ${r?.teacherComment?`<p style="color:#7c3aed">💬 GV: ${esc(r.teacherComment)}</p>`:""}
        ${r?.isEmergency?`<p class="tiny emergency-badge">🚨 Đăng ký bổ sung · ${esc(r.emergencyReason||"")}</p>`:""}
        ${r?.usesElectronicDevice&&r?.deviceDetectionSource==="ai"?`<p class="tiny device-ai-badge">🤖 AI phát hiện nội dung có sử dụng thiết bị điện tử${r.deviceDetectionConfidence==null?"":` · ${Math.round(r.deviceDetectionConfidence*100)}%`}</p>`:""}
        ${r?.usesElectronicDevice&&r?.deviceDetectionSource==="rule"?`<p class="tiny device-rule-badge">🔎 Hệ thống phát hiện nội dung có nhắc đến thiết bị điện tử · đang chờ AI xác nhận</p>`:""}
        ${r?.approvalSource==="auto_rule"?`<p class="tiny auto-approved-note">✨ Đã được duyệt nhanh theo quy tắc</p>`:""}
        ${r?.approvalSource==="ai"?`<p class="tiny auto-approved-note">🤖 AI đã duyệt${r.aiConfidence==null?"":` · ${Math.round(r.aiConfidence*100)}%`}</p>`:""}
        ${["pending","processing"].includes(r?.aiReviewStatus)?`<p class="tiny ai-review-badge">🤖 AI đang đánh giá...</p>`:""}
      </div>
      <div class="study-actions">
        ${statusBadge(r?.status||"missing")}
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
    const needsRevision=r?.status==="needs_revision";
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
      ${needsRevision?`<div class="callout"><b>GV đã yêu cầu chỉnh sửa.</b> Bạn vẫn được sửa và gửi duyệt lại dù deadline đã qua.</div>`:""}
      ${r?.isEmergency?`<div class="callout emergency-callout"><b>🚨 Đây là đăng ký bổ sung.</b> Lý do: ${esc(r.emergencyReason||"—")}</div>`:""}
      ${started?`<div class="callout warning"><b>Buổi tự học đã bắt đầu/đã qua.</b> Không thể tạo đăng ký mới hoặc sửa đăng ký bình thường.</div>`:""}
      ${pastDeadline&&!needsRevision?`<div class="callout warning"><b>Đã qua deadline.</b> Hạn mặc định là 20:00 tối hôm trước buổi học.</div>`:""}
      ${r?.teacherComment?`<div class="callout warning"><b>Nhận xét giáo viên:</b><br>${esc(r.teacherComment)}</div>`:""}

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
        ${r?.usesElectronicDevice&&r?.deviceDetectionSource&&r.deviceDetectionSource!=="student"
          ?`<p class="tiny device-detection-hint">🤖 Hệ thống đã nhận diện nội dung có sử dụng thiết bị điện tử dù bạn chưa bật công tắc.</p>`
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

        if(status==="submitted"&&rr.aiReviewStatus==="pending"){
          setOwlThinking(true,"🤖 Cú Thông Thái đang nhờ Groq AI đọc ngữ cảnh đăng ký này...");
          toast(wasApproved?"Đã lưu thay đổi; AI đang duyệt lại...":"AI đang đánh giá trường hợp chưa rõ...","success");
          try{
            await prod.requestAiReview(rr.id);
            await refreshFromServer(false);
            const fresh=state.registrations.find(x=>x.id===rr.id);
            closeModal();
            setOwlThinking(false);

            if(fresh?.status==="approved"&&fresh?.approvalSource==="ai"){
              const pct=fresh.aiConfidence==null?"":` (${Math.round(fresh.aiConfidence*100)}%)`;
              toast(`AI đã duyệt${pct}.`,"success");
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
        }else if(rr.status==="approved"&&rr.approvalSource==="auto_rule"){
          toast("Đã gửi và được duyệt nhanh theo quy tắc.","success");
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
        Deadline đã qua nhưng buổi tự học chưa bắt đầu. Đăng ký này <b>không tự duyệt</b>; giáo viên sẽ nhận thông báo và duyệt thủ công.
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
        await prod.emergencyRegister({
          weekId:w.id,
          dow,
          period:p,
          content:contentVal,
          note:noteVal,
          reason:reasonVal,
          usesElectronicDevice
        });
        await refreshFromServer(false);

        closeModal();
        toast("Đã gửi đăng ký bổ sung. Giáo viên sẽ duyệt thủ công.","success");
        showOwlMessage({
          text:"🚨 Cú đã chuyển đăng ký bổ sung của bạn cho giáo viên duyệt.",
          force:true
        });
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
    return head("Lịch sử của tôi","Xem lại đăng ký ở các tuần trước.")+
      (regs.length?`<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Tuần</th><th>Tiết</th><th>Nội dung</th><th>Trạng thái</th><th>Nhận xét GV</th></tr></thead><tbody>
      ${regs.map(r=>{const w=state.weeks.find(x=>x.id===r.weekId);return `<tr><td>Tuần ${w?.number||"?"}</td><td>${slotLabel(r.dow,r.period)}</td><td><b>${esc(r.content)}</b>${r.isEmergency?`<div class="tiny emergency-badge">🚨 Bổ sung khẩn cấp</div>`:""}<div class="tiny muted">${esc(r.note||"")}</div></td><td>${statusBadge(r.status)}</td><td>${esc(r.teacherComment||"—")}</td></tr>`}).join("")}
      </tbody></table></div></div>`:empty("🕘","Chưa có lịch sử đăng ký."));
  }
  function commentsPage(){
    const regs=state.registrations.filter(r=>r.studentId===currentUser.id&&r.teacherComment);
    return head("Nhận xét của giáo viên","Các phản hồi dành cho đăng ký của bạn.")+
      (regs.length?`<div class="grid">${regs.map(r=>`<div class="card"><b>${slotLabel(r.dow,r.period)}</b><p>${esc(r.content)}</p><div class="callout">💬 ${esc(r.teacherComment)}</div></div>`).join("")}</div>`:empty("💬","Chưa có nhận xét nào."));
  }

  function classOverview(){
    $("#pageTitle").textContent="Theo dõi cả lớp";
    $("#pageEyebrow").textContent=`Tuần ${week().number} · Xem theo từng buổi`;
    const sessions=effectiveSchedule().map(session=>({
      ...session,
      label:slotLabel(session.dow,session.period)
    }));
    const registrations=(state.registrations||[]).filter(registration=>
      registration.weekId===state.currentWeekId
    );
    return renderClassOverviewV830({
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
        const registrations=(state.registrations||[]).filter(registration=>
          registration.weekId===state.currentWeekId
        );

        const renderDetails=(filter="all")=>{
          modalBody.innerHTML=renderSessionDetails({
            session,
            users:state.users||[],
            registrations,
            role:currentUser.role,
            filter
          });
          modalBody.querySelectorAll("[data-session-filter]").forEach(filterButton=>{
            filterButton.addEventListener("click",()=>renderDetails(filterButton.dataset.sessionFilter));
          });
          if(currentUser.role==="teacher")bindTeacherActions(modalBody);
        };

        openModal("Nội dung · "+session.label,"");
        renderDetails();
      });
    });
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
      <span>${state.settings.smartApprovalEnabled===false
        ?"Mọi đăng ký gửi mới sẽ chờ GV duyệt."
        :state.settings.aiReviewEnabled===false
          ?"Rule rõ ràng được tự duyệt; trường hợp còn lại chuyển GV."
          :`Rule xử lý trường hợp rõ; AI đọc trường hợp mơ hồ và chỉ tự duyệt từ ${Math.round(Number(state.settings.aiAutoApproveThreshold||0.90)*100)}% tin cậy.`}</span></div>
      <button class="btn btn-ghost" data-route-settings="1">Cài đặt</button>
    </div>`;
    html+=`<div class="grid grid-2"><div class="card"><h3>🔔 Cần giáo viên xử lý</h3>${pending.length?pending.map(approvalItem).join(""):empty("✅","Không còn đăng ký chờ xử lý.")}</div>
      <div class="card"><h3>Tuần hiện tại</h3><p><b>Tuần ${week().number}</b></p><p>${fmtDate(week().startDate)} – ${fmtDate(week().endDate)}</p><p><b>Kiểu deadline:</b> ${deadlineModeLabel(week().deadlineMode)}</p><p>${deadlineChip(week())}</p><p>Trạng thái: ${weekStatus(effectiveWeekStatus(week()))}</p>
      <div class="progress"><span style="width:${st.rate}%"></span></div><p class="muted tiny">${st.submitted}/${st.total} lượt đã đăng ký</p></div></div>`;
    return html;
  }
  function kpi(icon,val,label){return `<div class="card kpi"><div class="kpi-icon">${kpiClayIcon(icon)}</div><div><div class="kpi-value">${val}</div><div class="kpi-label">${label}</div></div></div>`;}
  function approvalItem(r){
    const s=state.users.find(u=>u.id===r.studentId);
    return `<div class="approval-item manual-review-item"><div class="approval-content"><div class="person"><span class="avatar">${initials(s?.name||"?")}</span><div><b>${esc(s?.name||"")}</b><div class="tiny muted">${slotLabel(r.dow,r.period)}</div></div></div><p><b>${esc(r.content)}</b></p><p>${esc(r.note||"")}</p>${r.isEmergency?`<div class="callout emergency-callout"><b>🚨 Đăng ký bổ sung</b><br>Lý do: ${esc(r.emergencyReason||"—")}</div>`:""}
      ${(r.aiReason||r.autoReviewReason)?`<div class="review-reason">🧠 <b>Lý do cần GV xem:</b> ${esc(r.aiReason||r.autoReviewReason)}${r.aiConfidence==null?"":` <b>(${Math.round(r.aiConfidence*100)}%)</b>`}</div>`:""}
      ${r.teacherComment?`<p style="color:#7c3aed">💬 ${esc(r.teacherComment)}</p>`:""}</div>
      <div class="approval-actions">${statusBadge(r.status)}<button class="btn btn-success approve-btn" data-id="${r.id}">✓ Duyệt</button><button class="btn btn-warning revise-btn" data-id="${r.id}">↩ Yêu cầu sửa</button><button class="btn btn-ghost comment-btn" data-id="${r.id}">💬 Nhận xét</button><button class="btn btn-danger delete-reg-btn" data-id="${r.id}">🗑 Xóa</button></div></div>`;
  }
  function bindTeacherActions(root=content){
    root.querySelectorAll(".approve-btn").forEach(b=>b.onclick=()=>{const r=state.registrations.find(x=>x.id===b.dataset.id);if(r){r.status="approved";r.approvalSource="manual";r.approvedAt=Date.now();markLocalNotificationReadByReg(r.id);audit("Phê duyệt đăng ký",r.id);saveState();toast("Đã phê duyệt.","success");render();}});
    root.querySelectorAll(".revise-btn").forEach(b=>b.onclick=()=>teacherComment(b.dataset.id,true));
    root.querySelectorAll(".comment-btn").forEach(b=>b.onclick=()=>teacherComment(b.dataset.id,false));
    root.querySelectorAll(".ai-wrong-btn").forEach(b=>b.onclick=()=>{
      const r=state.registrations.find(x=>x.id===b.dataset.id);
      if(!r)return;
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
        r.teacherComment=$("#aiWrongComment").value.trim();
        r.status="needs_revision";
        r.approvalSource="manual";
        markLocalNotificationReadByReg(r.id);
        audit("GV sửa quyết định AI",r.id,r.teacherComment);
        try{
          await saveState();
          closeModal();
          toast("Đã hủy duyệt AI và yêu cầu học sinh chỉnh sửa.","success");
          await refreshFromServer(false);
        }catch{}
      };
    });

    root.querySelectorAll(".delete-reg-btn").forEach(b=>b.onclick=()=>{
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

    const sourceBadge=r=>{
      if(r.approvalSource==="ai"){
        const pct=r.aiConfidence==null?"":` ${Math.round(r.aiConfidence*100)}%`;
        return `<span class="ai-review-badge">🤖 AI${pct}</span>`;
      }
      if(r.approvalSource==="auto_rule")return '<span class="auto-review-badge">✨ Rule</span>';
      return '<span class="manual-review-badge">👤 GV</span>';
    };

    const allTable=allWeek.length?`<div class="card" style="margin-top:16px"><h3>Tất cả đăng ký tuần ${week().number}</h3>
      <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Học sinh</th><th>Tiết</th><th>Nội dung</th><th>Trạng thái</th><th>Cách duyệt</th><th>Thao tác</th></tr></thead><tbody>
      ${allWeek.map(r=>{
        const s=state.users.find(u=>u.id===r.studentId);
        return `<tr>
          <td>${esc(s?.name||"")}</td>
          <td>${slotLabel(r.dow,r.period)}</td>
          <td>
            <b>${esc(r.content)}</b>
            <div class="tiny muted">${esc(r.note||"")}</div>
            ${r.approvalSource==="ai"&&r.aiReason?`<div class="ai-review-details">🤖 ${esc(r.aiReason)}</div>`:""}
          </td>
          <td>${statusBadge(r.status)}</td>
          <td>${sourceBadge(r)}</td>
          <td>
            <div class="toolbar" style="gap:5px">
              ${r.status==="approved"&&r.approvalSource==="ai"?`<button class="btn btn-warning ai-wrong-btn" data-id="${r.id}">⚠️ AI chưa đúng</button>`:""}
              <button class="btn btn-danger delete-reg-btn" data-id="${r.id}">🗑 Xóa</button>
            </div>
          </td>
        </tr>`;
      }).join("")}
      </tbody></table></div></div>`:"";

    return head("Duyệt đăng ký",`${pending.length} đăng ký đang cần xử lý`,
      pending.length?`<button class="btn btn-success" id="approveAll">✓ Duyệt tất cả đang chờ</button>`:"")+
      `<div class="card">${pending.length?pending.map(approvalItem).join(""):empty("🎉","Không có đăng ký cần xử lý.")}</div>`+
      allTable;
  }

  function schedulePage(){
    const current=effectiveSchedule(), set=new Set(current.map(s=>`${s.dow}-${s.period}`));
    let html=head("TKB tự học","Bật/tắt tiết tự học. Mặc định áp dụng cho toàn bộ tuần.",
      `<div class="toolbar"><label style="margin:0"><input id="weekSpecific" type="checkbox" style="width:auto"> Áp dụng riêng tuần ${week().number}</label><button id="saveSchedule" class="btn btn-primary">Lưu TKB</button></div>`);
    html+=`<div class="card"><div class="callout" style="margin-bottom:14px">Mỗi tiết 40 phút · Học Thứ 2–Thứ 6 · Nghỉ trưa 11:30–13:15.</div><div class="schedule-wrap"><div class="schedule-grid">
      <div></div>${DOW.map(x=>`<div class="head">${x}</div>`).join("")}
      ${state.periods.map(p=>`<div class="period-label"><b>Tiết ${p.n}</b><span>${p.start}–${p.end}</span></div>${[0,1,2,3,4].map(d=>`<button class="slot-btn ${set.has(`${d}-${p.n}`)?"active":""}" data-slot="${d}-${p.n}" aria-label="${DOW[d]} tiết ${p.n}">${set.has(`${d}-${p.n}`)?"●":"○"}</button>`).join("")}`).join("")}
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
      const mode=w.deadlineMode||"per_session_20";
      const effective=effectiveWeekStatus(w);
      const auto=automaticWeekStatus(w);
      return `<div class="week-row v5-week-row ${w.id===state.currentWeekId?"active-week":""}" data-week-id="${w.id}">
        <div>
          <b>Tuần ${w.number}</b>
          <small>${w.id===state.currentWeekId?" · đang xem":""}</small>
        </div>
        <div>
          <b>${fmtDate(w.startDate)} – ${fmtDate(w.endDate)}</b>
          <small>${w.number===1?" · mốc tuần đầu":""}</small>
        </div>
        <div class="auto-week-status">
          <span class="status ${effective==="open"?"approved":effective==="locked"?"missing":"draft"}">${weekStatus(effective)}</span>
          <label class="week-holiday-toggle">
            <input class="week-holiday" type="checkbox" data-id="${w.id}" ${w.status==="holiday"?"checked":""}>
            <span>Tuần nghỉ</span>
          </label>
          <small>${w.status==="holiday"?"Đã đặt là tuần nghỉ.":`Tự động: ${weekStatus(auto)}.`}</small>
        </div>
        <div class="deadline-choice">
          <select class="week-deadline-mode" data-id="${w.id}" aria-label="Chế độ deadline tuần ${w.number}">
            <option value="per_session_20" ${mode==="per_session_20"?"selected":""}>🕗 Mặc định · 20:00 tối hôm trước từng buổi</option>
            <option value="specific" ${mode==="specific"?"selected":""}>🎯 Hạn cụ thể của tuần</option>
          </select>
          <input class="week-deadline" data-id="${w.id}" type="datetime-local"
            value="${w.deadline||""}" ${mode==="specific"?"":"disabled"}>
          <small class="deadline-preview">${deadlineSummary(w)}</small>
        </div>
        <button class="btn btn-ghost view-week" data-id="${w.id}">Xem tuần</button>
      </div>`;
    }).join("");

    return head(
      "Quản lý tuần",
      "Trạng thái tuần được tính tự động: tuần hiện tại và tuần kế tiếp luôn mở; các tuần cũ tự khóa. Giáo viên chỉ cần đánh dấu tuần nghỉ.",
      `<div class="toolbar"><button class="btn btn-ghost" id="goCurrentWeek">📍 Tuần theo ngày hôm nay</button><button class="btn btn-primary" id="saveWeeks">💾 Lưu cấu hình</button></div>`
    )+
      `<div class="card week-setup-card">
        <div>
          <div class="eyebrow-pill">🧭 Mốc năm học</div>
          <h3>Tuần 1 bắt đầu ngày nào?</h3>
          <p class="muted">Trạng thái mở/khóa được tự tính theo ngày. Hạn mặc định là <b>20:00 tối hôm trước từng buổi học</b>.</p>
        </div>
        <div class="week-setup-grid v5-week-setup-grid">
          <label>Ngày bắt đầu Tuần 1
            <input id="week1Start" type="date" value="${first?.startDate||""}">
            <small>Phải là ngày Thứ Hai.</small>
          </label>
          <div class="deadline-mode-guide">
            <b>Hạn đăng ký</b>
            <span>🕗 Mặc định: 20:00 tối hôm trước từng buổi.</span>
            <span>🎯 Khi thật sự cần, GV có thể đặt hạn cụ thể cho cả tuần.</span>
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
      if(!confirm(`Xếp lại lịch với Tuần 1 bắt đầu ${fmtDate(start)}? Trạng thái mở/khóa sẽ được tính tự động.`))return;

      try{
        await prod.teacherRebaseWeeks(start,"20:00");
        toast("Đã xếp lại lịch. Tuần hiện tại và tuần kế tiếp sẽ tự mở.","success");
        await refreshFromServer(false);
      }catch(err){
        console.error(err);
        toast(safeErrorMessage(err,"Không xếp lại được lịch tuần. Vui lòng thử lại."),"warn");
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
        toast("Đã lưu. Trạng thái tuần sẽ tiếp tục tự động theo ngày.","success");
        await refreshFromServer(false);
      }catch{}
    });

    content.querySelectorAll(".view-week").forEach(b=>b.onclick=async()=>{
      weekSelectionTouched=true;
      await selectWeek(b.dataset.id,{announce:true});
    });

    $("#goCurrentWeek")?.addEventListener("click",async()=>{
      const w=actualWeek();
      if(!w){toast("Chưa có tuần học nào.","warn");return;}
      weekSelectionTouched=true;
      await selectWeek(w.id,{announce:true});
    });
  }

  function weekStatus(x){return {open:"🟢 Đang mở",locked:"🔒 Đã khóa",upcoming:"🕒 Sắp tới",holiday:"🏖️ Nghỉ"}[x]||x;}

  function studentsPage(){
    state.studentsUi=state.studentsUi||{query:"",role:"all",status:"all"};
    const ui=state.studentsUi;
    const allUsers=state.users
      .filter(u=>u.role!=="teacher" && !String(u.code||"").startsWith("__deleted__"))
      .sort(compareByCode);

    const q=(ui.query||"").trim().toLowerCase();
    const filtered=allUsers.filter(u=>{
      const hitText=!q || String(u.code||"").toLowerCase().includes(q) || String(u.name||"").toLowerCase().includes(q);
      const hitRole=ui.role==="all" || u.role===ui.role;
      const hitStatus=ui.status==="all" || (ui.status==="active"?!!u.active:!u.active);
      return hitText && hitRole && hitStatus;
    });

    const countStudent=allUsers.filter(u=>u.role==="student").length;
    const countMonitor=allUsers.filter(u=>u.role==="monitor").length;
    const countLocked=allUsers.filter(u=>!u.active).length;

    const rows=filtered.map(u=>`
      <tr>
        <td>
          <div class="code-cell">
            <b class="code-badge">${esc(u.code)}</b>
            <button class="mini-icon-btn copy-code-btn" data-code="${esc(u.code)}" title="Sao chép mã đăng nhập">📋</button>
          </div>
        </td>
        <td><div class="person"><span class="avatar">${initials(u.name)}</span><b>${esc(u.name)}</b></div></td>
        <td>${roleLabel[u.role]||esc(u.role)}</td>
        <td>${u.active?'<span class="status approved">Hoạt động</span>':'<span class="status missing">Đã khóa</span>'}</td>
        <td>
          <div class="toolbar" style="gap:6px;flex-wrap:wrap">
            <button class="btn btn-ghost edit-user-btn" data-id="${u.id}">${uiIcon('edit')}<span>Sửa tài khoản</span></button>
            <button class="btn btn-ghost reset-password-btn" data-id="${u.id}">${uiIcon('lock')}<span>Đặt lại mật khẩu</span></button>
            <button class="btn btn-ghost danger delete-user-btn" data-id="${u.id}">${uiIcon('delete')}<span>Xóa tài khoản</span></button>
          </div>
        </td>
      </tr>`).join("") || `<tr><td colspan="5" class="center muted" style="padding:18px">Không có học sinh phù hợp bộ lọc hiện tại.</td></tr>`;

    return head(
      "Quản lý học sinh",
      "Bản 8.2.5: Cú Thông Thái được vẽ lại bằng SVG chibi, menu/biểu tượng giáo viên được làm mới và đã bổ sung tăng cường bảo mật phía trình duyệt.",
      `<div class="toolbar" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary glossy-action" id="addStudentBtn">${uiIcon('add')}<span>Thêm học sinh</span></button>
      </div>`
    )+
      `<div class="card">
        <div class="callout" style="margin-bottom:12px">
          <b>Mã đăng nhập</b> được tự động lấy từ hồ sơ; nếu hồ sơ cũ thiếu mã, server sẽ lấy phần trước dấu <b>@</b> của email Auth rồi tự đồng bộ lại. App không tải/hiển thị email nội bộ. Nếu chỉ đổi <b>vai trò / trạng thái / họ tên</b> thì không cần nhập lại mã.
        </div>

        <div class="summary-pills">
          <span class="summary-pill">${uiIcon("user")}Học sinh: <b>${countStudent}</b></span>
          <span class="summary-pill">${uiIcon("students")}Cán sự: <b>${countMonitor}</b></span>
          <span class="summary-pill">${uiIcon("lock")}Đã khóa: <b>${countLocked}</b></span>
          <span class="summary-pill">📋 Đang hiển thị: <b>${filtered.length}/${allUsers.length}</b></span>
        </div>

        <div class="students-toolbar">
          <label class="search-box">
            <span>🔎</span>
            <input id="studentSearch" value="${esc(ui.query||"")}" placeholder="Tìm theo mã hoặc họ tên">
          </label>
          <label>
            Vai trò
            <select id="studentRoleFilter">
              <option value="all" ${ui.role==="all"?"selected":""}>Tất cả</option>
              <option value="student" ${ui.role==="student"?"selected":""}>Học sinh</option>
              <option value="monitor" ${ui.role==="monitor"?"selected":""}>Cán sự lớp</option>
            </select>
          </label>
          <label>
            Trạng thái
            <select id="studentStatusFilter">
              <option value="all" ${ui.status==="all"?"selected":""}>Tất cả</option>
              <option value="active" ${ui.status==="active"?"selected":""}>Đang hoạt động</option>
              <option value="locked" ${ui.status==="locked"?"selected":""}>Đã khóa</option>
            </select>
          </label>
          <button class="btn btn-ghost" id="clearStudentFilters">🫧 Xóa lọc</button>
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
    state.studentsUi=state.studentsUi||{query:"",role:"all",status:"all"};

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
      state.studentsUi={query:"",role:"all",status:"all"};
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
            <input id="newStudentPassword" type="text" minlength="8" autocomplete="off" placeholder="Để trống để tự sinh">
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
          className:state.settings.className,
          password:$("#newStudentPassword").value.trim()
        };
        if(!/^[A-Z0-9._-]{2,32}$/.test(changes.code)){
          toast("Mã chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.","warn");return;
        }
        const passwordRules=passwordChecklistState(changes.password);
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
          active:$("#editUserActive").checked
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
            await prod.teacherDeleteUser(u.id,confirmCode);
            closeModal();
            toast(`Đã xóa tài khoản ${u.code}; lịch sử được giữ lại.`,"success");
            await refreshFromServer(false);
        }catch(err){
          console.error(err);toast(safeErrorMessage(err,"Không xóa được tài khoản. Vui lòng thử lại."),"warn");
        }
      };
    }));

    content.querySelectorAll(".reset-password-btn").forEach(btn=>btn.addEventListener("click",()=>{
      const u=state.users.find(x=>x.id===btn.dataset.id); if(!u)return;
      openModal("Đặt lại mật khẩu",`
        <div class="callout"><b>${esc(u.name)}</b> · ${esc(u.code)}</div>
        <form id="teacherResetPasswordForm">
          <label>Mật khẩu tạm mới<span class="password-field"><input id="teacherNewPassword" type="password" minlength="8" autocomplete="new-password" required><button class="password-toggle" type="button" data-password-target="teacherNewPassword" aria-label="Hiện mật khẩu" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="2"/></svg></button></span></label>
          <small>Ít nhất 8 ký tự và có cả chữ lẫn số.</small>
          <label>Nhập lại mật khẩu<span class="password-field"><input id="teacherNewPassword2" type="password" minlength="8" autocomplete="new-password" required><button class="password-toggle" type="button" data-password-target="teacherNewPassword2" aria-label="Hiện mật khẩu" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="2"/></svg></button></span></label>
          <button class="btn btn-primary btn-block" type="submit">Đặt lại mật khẩu</button>
        </form>`);
      $("#teacherResetPasswordForm").onsubmit=async e=>{
        e.preventDefault();
        const p1=$("#teacherNewPassword").value,p2=$("#teacherNewPassword2").value;
        const rules=passwordChecklistState(p1);
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
      const slots=effectiveSchedule(), lines=[["Mã","Họ tên",...slots.map(s=>`${DOW[s.dow]}-T${s.period}`)].join(",")];
      studentUsers().forEach(s=>lines.push([s.code,`"${s.name}"`,...slots.map(sl=>statusLabel[regFor(s.id,sl.dow,sl.period)?.status]||"Chưa đăng ký")].join(",")));
      const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"}), a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`so-tu-hoc-tuan-${week().number}.csv`;a.click();URL.revokeObjectURL(a.href);
      toast("Đã tạo file CSV.","success");
    });
  }

  function settingsPage(){
    const threshold=Math.round(Number(state.settings.aiAutoApproveThreshold||0.90)*100);
    return head("Cài đặt","Cấu hình lớp học, duyệt nhanh và AI.")+`<div class="grid grid-2">
      <div class="card"><h3>Thông tin lớp</h3><form id="settingsForm" class="form-grid">
        <label>Tên lớp<input id="setClass" value="${esc(state.settings.className)}"></label>
        <label>Năm học<input id="setYear" value="${esc(state.settings.schoolYear)}"></label>
        <label style="grid-column:1/-1">Thông báo tuần<textarea id="setAnnouncement">${esc(state.settings.announcement)}</textarea></label>

        <div class="smart-approval-setting" style="grid-column:1/-1">
          <label class="toggle-row">
            <input id="smartApprovalEnabled" type="checkbox" ${state.settings.smartApprovalEnabled!==false?"checked":""}>
            <span>
              <b>✨ Duyệt nhanh thông minh</b>
              <small>Bật luồng Rule → AI → GV. Tắt mục này thì mọi đăng ký đều chờ GV.</small>
            </span>
          </label>

          <div class="ai-settings-card">
            <label class="toggle-row">
              <input id="aiReviewEnabled" type="checkbox" ${state.settings.aiReviewEnabled!==false?"checked":""}>
              <span>
                <b>🤖 Dùng AI cho trường hợp mơ hồ</b>
                <small>Rule rõ ràng vẫn xử lý trước; AI chỉ nhận các câu mà rule chưa đủ chắc chắn.</small>
              </span>
            </label>

            <div class="ai-threshold-row">
              <span><b>Ngưỡng AI được tự duyệt</b><br><small>AI dưới ngưỡng này luôn chuyển GV.</small></span>
              <span id="aiThresholdValue" class="ai-threshold-value">${threshold}%</span>
              <input id="aiAutoApproveThreshold" type="range" min="80" max="99" step="1" value="${threshold}">
            </div>

            <div class="callout" style="margin-top:10px">
              <b>Mặc định V7:</b> rule chặn giải trí/mạng xã hội; nội dung học tập cực rõ có thể được rule duyệt;
              trường hợp còn lại gửi AI. AI chỉ tự duyệt nếu kết luận là <b>học tập</b> hoặc <b>dùng thiết bị cho học tập</b>
              và độ tin cậy đạt ngưỡng trên. Nếu AI lỗi hoặc chưa chắc → <b>GV duyệt</b>.
            </div>

            <div class="tiny muted" style="margin-top:8px">
              Model mặc định phía server: <b>openai/gpt-oss-120b trên Groq</b>. API key không nằm trong trình duyệt.
            </div>
          </div>
        </div>

        <button class="btn btn-primary" style="grid-column:1/-1">Lưu cài đặt</button>
      </form></div>

      <div class="card">
        <h3>Khung giờ chuẩn</h3>
        <div class="table-wrap"><table class="data-table" style="min-width:0">
          <thead><tr><th>Tiết</th><th>Giờ học</th></tr></thead>
          <tbody>${state.periods.map(p=>`<tr><td><b>Tiết ${p.n}</b></td><td>${p.start} – ${p.end}</td></tr>`).join("")}</tbody>
        </table></div>
        <div class="callout" style="margin-top:12px">Nghỉ 15 phút giữa tiết 2–3 và 7–8. Nghỉ trưa 11:30–13:15.</div>
        <div class="callout" style="margin-top:12px">
          🦉 <b>Cú Thông Thái</b> hoạt động cho HS, cán sự và GV: nhìn theo chuột, nhắc deadline/thông báo và đưa danh ngôn học tập.
        </div>
      </div>
    </div>`;
  }

  function bindSettings(){
    $("#aiAutoApproveThreshold")?.addEventListener("input",e=>{
      $("#aiThresholdValue").textContent=`${e.target.value}%`;
    });

    $("#settingsForm")?.addEventListener("submit",async e=>{
      e.preventDefault();
      state.settings.className=$("#setClass").value.trim();
      state.settings.schoolYear=$("#setYear").value.trim();
      state.settings.announcement=$("#setAnnouncement").value.trim();
      state.settings.smartApprovalEnabled=$("#smartApprovalEnabled").checked;
      state.settings.aiReviewEnabled=$("#aiReviewEnabled").checked;
      state.settings.aiAutoApproveThreshold=Number($("#aiAutoApproveThreshold").value)/100;

      state.audit.unshift({
        at:new Date().toISOString(),userId:currentUser?.id,
        action:"Cập nhật cài đặt",entityId:"settings",
        detail:`AI=${state.settings.aiReviewEnabled}; threshold=${state.settings.aiAutoApproveThreshold}`
      });

      try{
        await saveState();
        toast("Đã lưu cài đặt Rule + AI.","success");
        showOwlMessage({
          text:state.settings.aiReviewEnabled
            ? `🤖 AI review đang bật với ngưỡng tự duyệt ${Math.round(state.settings.aiAutoApproveThreshold*100)}%.`
            : "👤 AI review đang tắt; các trường hợp rule không tự duyệt sẽ chuyển giáo viên.",
          force:true
        });
        await refreshFromServer(false);
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
    bindRegistrationButtons(); bindTeacherActions(); bindClassOverview(); bindSchedule(); bindWeeks(); bindStudents(); bindStats(); bindSettings();
    content.querySelector("[data-route-settings]")?.addEventListener("click",()=>{route="settings";renderShell();render();});
    $("#approveAll")?.addEventListener("click",()=>{state.registrations.filter(r=>r.weekId===state.currentWeekId&&(r.status==="submitted"||r.status==="needs_revision")).forEach(r=>{r.status="approved";r.approvalSource="manual";r.approvedAt=Date.now();markLocalNotificationReadByReg(r.id);});audit("Duyệt hàng loạt","registrations");saveState();toast("Đã duyệt tất cả đăng ký đang chờ.","success");render();});
    renderShell();
  }

  async function refreshFromServer(showToast=true){
    try{
      const loaded=await prod.loadState();
      if(!loaded.currentUser){ await logout(); return; }
      currentUser=loaded.currentUser; state=loaded.state; route=route||"dashboard";
      if(!weekSelectionTouched&&["dashboard","register"].includes(route)){
        const aligned=alignStudentWeekToNextAction();
        if(aligned)await selectWeek(state.currentWeekId);
      }
      renderShell(); render();
      if(showToast) toast("Đã đồng bộ dữ liệu mới nhất.","success");
    }catch(err){ console.error(err); if(showToast) toast(safeErrorMessage(err,"Không tải được dữ liệu mới. Vui lòng thử lại."),"warn"); }
  }
  $("#syncBtn")?.addEventListener("click",()=>refreshFromServer(true));

  try{
    if(!prod?.enabled?.()) throw new Error("Thiếu URL hoặc publishable key của Supabase.");
    await prod.init();
    const loaded=await prod.loadState();
    if(loaded.currentUser){
      currentUser=loaded.currentUser;
      state=loaded.state;
      const aligned=alignStudentWeekToNextAction(true);
      if(aligned)await selectWeek(state.currentWeekId);
      renderShell();
      render();
      const seconds=Math.max(30,Number(window.APP_CONFIG?.refreshSeconds||60));
      setInterval(()=>{ if(currentUser && !document.hidden) refreshFromServer(false); },seconds*1000);
    }else renderShell();
  }catch(err){
    console.error(err); renderShell();
    toast("Supabase chưa sẵn sàng. Hãy kiểm tra cấu hình triển khai.","warn");
  }
})();
