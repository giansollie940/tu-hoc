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

  function owlSeenStorageKey(){
    return `wiseOwlSeenQuotes:${currentUser?.id||"guest"}`;
  }

  function readSeenOwlQuoteIds(){
    try{
      const value=JSON.parse(localStorage.getItem(owlSeenStorageKey())||"[]");
      return Array.isArray(value)?value.map(String).slice(-500):[];
    }catch{
      return [];
    }
  }

  function writeSeenOwlQuoteIds(ids){
    try{
      localStorage.setItem(
        owlSeenStorageKey(),
        JSON.stringify([...new Set((ids||[]).map(String))].slice(-500))
      );
    }catch{}
  }

  function fallbackQuoteId(q){
    const raw=`${q?.author||""}|${q?.text||""}`;
    let h=2166136261;
    for(let i=0;i<raw.length;i++){
      h^=raw.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    return `fallback-${(h>>>0).toString(16)}`;
  }

  let owlPrefetchedQuote=null;
  let owlPrefetchPromise=null;

  function rememberOnlineOwlQuote(result){
    const q=result?.quote;
    if(!q?.text)return null;

    const seen=readSeenOwlQuoteIds();
    const nextSeen=result.cycleReset?[]:[...seen];
    nextSeen.push(String(q.id||fallbackQuoteId(q)));
    writeSeenOwlQuoteIds(nextSeen);

    return {
      text:String(q.text),
      author:String(q.author||"Khuyết danh"),
      url:String(q.url||result.sourceUrl||OWL_QUOTE_SOURCE),
      online:true,
      poolSize:Number(result.poolSize||0)
    };
  }

  function prefetchWiseOwlQuote(){
    if(!isProd||!prod?.getWiseOwlQuote||owlPrefetchedQuote||owlPrefetchPromise)return;

    const seen=readSeenOwlQuoteIds();
    owlPrefetchPromise=prod.getWiseOwlQuote(seen)
      .then(result=>{
        const q=result?.quote;
        if(q?.text){
          owlPrefetchedQuote={
            result,
            preview:{
              text:String(q.text),
              author:String(q.author||"Khuyết danh"),
              url:String(q.url||result.sourceUrl||OWL_QUOTE_SOURCE),
              online:true,
              poolSize:Number(result.poolSize||0)
            }
          };
        }
      })
      .catch(err=>{
        console.warn("Không nạp trước được danh ngôn trực tuyến.",err);
      })
      .finally(()=>{owlPrefetchPromise=null;});
  }

  function nextWiseOwlQuoteInstant(){
    if(owlPrefetchedQuote){
      const cached=owlPrefetchedQuote;
      owlPrefetchedQuote=null;
      const q=rememberOnlineOwlQuote(cached.result) || cached.preview;
      // Nạp sẵn câu kế tiếp sau khi đã trả câu hiện tại.
      setTimeout(prefetchWiseOwlQuote,0);
      return q;
    }

    // Không chờ mạng: dùng kho dự phòng ngay lập tức và đồng thời nạp câu online cho lần sau.
    prefetchWiseOwlQuote();
    const q=nextOwlQuote();
    return {
      ...q,
      url:OWL_QUOTE_SOURCE,
      online:false,
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

    owlReady=true;
    prefetchWiseOwlQuote();

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
          text:`${urgency?"⏰":"📅"} Tiết ${next.sl.period} ${DemoData.DOW[next.sl.dow]} chưa đăng ký. Hạn: ${fmtDeadline(next.deadline)}.`
        });
      }else if(missing.length&&w.status==="open"){
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
    if(!isProd) sessionStorage.setItem("soTuHocUser",JSON.stringify(user));
    route="dashboard"; renderShell(); render();
  }
  async function logout(){
    if(isProd){
      try{ await prod.signOut(); }catch(err){ console.error(err); }
    }else sessionStorage.removeItem("soTuHocUser");
    currentUser=null;
    $("#wiseOwlPet")?.classList.add("hidden");
    $("#owlSpeech")?.classList.add("hidden");
    appView.classList.add("hidden"); loginView.classList.remove("hidden");
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
    if(!currentUser){
      loginView.classList.remove("hidden");
      appView.classList.add("hidden");
      $("#wiseOwlPet")?.classList.add("hidden");
      return;
    }
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

    refreshWiseOwl();
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
      <p><b>${r?esc(r.content):"Chưa đăng ký"}</b></p>${r?.note?`<p>${esc(r.note)}</p>`:""}${r?.teacherComment?`<p style="color:#7c3aed">💬 GV: ${esc(r.teacherComment)}</p>`:""}${r?.approvalSource==="auto_rule"?`<p class="tiny auto-approved-note">✨ Đã được duyệt nhanh theo quy tắc</p>`:""}
      ${r?.approvalSource==="ai"?`<p class="tiny auto-approved-note">🤖 AI đã duyệt${r.aiConfidence==null?"":` · ${Math.round(r.aiConfidence*100)}%`}</p>`:""}
      ${["pending","processing"].includes(r?.aiReviewStatus)?`<p class="tiny ai-review-badge">🤖 AI đang đánh giá...</p>`:""}
      </div>
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

        if(status==="submitted" && isProd && rr.aiReviewStatus==="pending"){
          setOwlThinking(true,"🤖 Cú Thông Thái đang nhờ Groq AI đọc ngữ cảnh đăng ký này...");
          toast("AI đang đánh giá trường hợp chưa rõ...","success");
          try{
            await prod.requestAiReview(rr.id);
            await refreshFromServer(false);
            const fresh=state.registrations.find(x=>x.id===rr.id);
            closeModal();
            setOwlThinking(false);

            if(fresh?.status==="approved"&&fresh?.approvalSource==="ai"){
              const pct=fresh.aiConfidence==null?"":` (${Math.round(fresh.aiConfidence*100)}%)`;
              toast(`AI đã duyệt${pct}: nội dung phù hợp cho tự học.`,"success");
              showOwlMessage({text:`🤖 AI đã duyệt đăng ký này${pct}. ${fresh.aiReason||"Mục đích học tập đủ rõ."}`,force:true});
            }else{
              toast("AI chưa đủ chắc chắn — đã chuyển giáo viên duyệt.","success");
              showOwlMessage({text:`🔔 AI chưa đủ chắc chắn nên Cú đã chuyển đăng ký này cho giáo viên xem.`,force:true});
            }
            render();
            return;
          }catch(aiErr){
            console.error("AI review",aiErr);
            setOwlThinking(false);
            closeModal();
            toast("Đã gửi đăng ký; AI tạm thời chưa phản hồi nên GV sẽ duyệt.","warn");
            try{await refreshFromServer(false);}catch{}
            render();
            return;
          }
        }

        closeModal();
        if(status==="draft"){
          toast("Đã lưu nháp.","success");
        }else if(rr.status==="approved"&&rr.approvalSource==="auto_rule"){
          toast("Đã gửi và được duyệt nhanh theo quy tắc.","success");
          showOwlMessage({text:"✨ Cú đã kiểm tra: nội dung học tập đủ rõ nên được duyệt nhanh theo quy tắc.",force:true});
        }else if(rr.status==="approved"&&rr.approvalSource==="ai"){
          toast("Đã gửi và được AI duyệt.","success");
        }else{
          toast("Đã gửi. Nội dung này đang chờ giáo viên duyệt.","success");
        }
        render();
      }catch(err){
        console.error(err);
        setOwlThinking(false);
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
      <span>${state.settings.smartApprovalEnabled===false
        ?"Mọi đăng ký gửi mới sẽ chờ GV duyệt."
        :state.settings.aiReviewEnabled===false
          ?"Rule rõ ràng được tự duyệt; trường hợp còn lại chuyển GV."
          :`Rule xử lý trường hợp rõ; AI đọc trường hợp mơ hồ và chỉ tự duyệt từ ${Math.round(Number(state.settings.aiAutoApproveThreshold||0.90)*100)}% tin cậy.`}</span></div>
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
      ${(r.aiReason||r.autoReviewReason)?`<div class="review-reason">🧠 <b>Lý do cần GV xem:</b> ${esc(r.aiReason||r.autoReviewReason)}${r.aiConfidence==null?"":` <b>(${Math.round(r.aiConfidence*100)}%)</b>`}</div>`:""}
      ${r.teacherComment?`<p style="color:#7c3aed">💬 ${esc(r.teacherComment)}</p>`:""}</div>
      <div class="approval-actions">${statusBadge(r.status)}<button class="btn btn-success approve-btn" data-id="${r.id}">✓ Duyệt</button><button class="btn btn-warning revise-btn" data-id="${r.id}">↩ Yêu cầu sửa</button><button class="btn btn-ghost comment-btn" data-id="${r.id}">💬 Nhận xét</button><button class="btn btn-danger delete-reg-btn" data-id="${r.id}">🗑 Xóa</button></div></div>`;
  }
  function bindTeacherActions(){
    content.querySelectorAll(".approve-btn").forEach(b=>b.onclick=()=>{const r=state.registrations.find(x=>x.id===b.dataset.id);if(r){r.status="approved";r.approvalSource="manual";r.approvedAt=Date.now();markLocalNotificationReadByReg(r.id);audit("Phê duyệt đăng ký",r.id);saveState();toast("Đã phê duyệt.","success");render();}});
    content.querySelectorAll(".revise-btn").forEach(b=>b.onclick=()=>teacherComment(b.dataset.id,true));
    content.querySelectorAll(".comment-btn").forEach(b=>b.onclick=()=>teacherComment(b.dataset.id,false));
    content.querySelectorAll(".ai-wrong-btn").forEach(b=>b.onclick=()=>{
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
          if(isProd)await refreshFromServer(false);else render();
        }catch{}
      };
    });

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
            ${isProd?`<button class="btn btn-ghost reset-password-btn" data-id="${u.id}">${uiIcon('lock')}<span>Đặt lại mật khẩu</span></button>`:""}
            ${isProd?`<button class="btn btn-ghost danger delete-user-btn" data-id="${u.id}">${uiIcon('delete')}<span>Xóa tài khoản</span></button>`:""}
          </div>
        </td>
      </tr>`).join("") || `<tr><td colspan="5" class="center muted" style="padding:18px">Không có học sinh phù hợp bộ lọc hiện tại.</td></tr>`;

    return head(
      "Quản lý học sinh",
      "Bản 8.2.3: Cú Thông Thái được vẽ lại bằng SVG chibi, menu/biểu tượng giáo viên được làm mới và đã bổ sung tăng cường bảo mật phía trình duyệt.",
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
