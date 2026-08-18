(() => {
  const cfg = window.APP_CONFIG || {};
  const enabled = () =>
    cfg.mode === "supabase" &&
    cfg.projectUrl &&
    cfg.publishableKey &&
    !cfg.projectUrl.includes("YOUR_PROJECT") &&
    !cfg.publishableKey.includes("YOUR_PUBLISHABLE");

  let client = null;
  let snapshot = null;
  let syncQueue = Promise.resolve();

  const deepClone = v => JSON.parse(JSON.stringify(v));
  const stable = v => JSON.stringify(v);
  const isUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v || "");
  const REGISTRATION_COLUMNS=[
    "id","student_id","week_id","weekday","period_number","content","note","status",
    "teacher_comment","approval_source","auto_review_reason","ai_review_status","ai_decision",
    "ai_category","ai_confidence","ai_reason","ai_model","ai_reviewed_at","ai_review_count",
    "is_emergency","emergency_reason","emergency_requested_at","uses_electronic_device",
    "device_detection_source","device_detection_confidence","updated_at","approved_at"
  ].join(",");
  const WEEK_OVERRIDE_COLUMNS="id,week_id,weekday,period_number,is_study_period,reason";

  const sessionAuthStorage={
    getItem:key=>window.sessionStorage.getItem(key),
    setItem:(key,value)=>window.sessionStorage.setItem(key,value),
    removeItem:key=>window.sessionStorage.removeItem(key)
  };

  function clearLegacyPersistentAuth(){
    try{
      const projectRef=new URL(cfg.projectUrl).hostname.split(".")[0];
      if(projectRef){
        localStorage.removeItem(`sb-${projectRef}-auth-token`);
      }
    }catch{}
  }

  function requireClient(){
    if(!enabled()) throw new Error("Supabase mode chưa được cấu hình.");
    if(!window.supabase) throw new Error("Không tải được thư viện Supabase JS.");

    if(!client){
      // V8.2.3: không giữ token đăng nhập trong localStorage.
      // sessionStorage sống qua F5 nhưng bị xóa khi tab/cửa sổ kết thúc.
      clearLegacyPersistentAuth();

      client=window.supabase.createClient(
        cfg.projectUrl,
        cfg.publishableKey,
        {
          auth:{
            storage:sessionAuthStorage,
            persistSession:true,
            autoRefreshToken:true,
            detectSessionInUrl:false
          }
        }
      );
    }

    return client;
  }

  async function init(){
    if (!enabled()) return null;
    return requireClient();
  }

  function normalizeLoginCode(code){
    return String(code||"").trim().toLowerCase().replace(/[^a-z0-9._-]/g,"");
  }

  function codeToEmail(code){
    const clean=normalizeLoginCode(code);
    if(!/^[a-z0-9._-]{2,32}$/.test(clean)){
      throw new Error("Mã đăng nhập không hợp lệ.");
    }
    const domain=String(cfg.loginDomain||"users.example.com").trim().toLowerCase();
    return `${clean}@${domain}`;
  }

  function assertPasswordPolicy(password,{allowEmpty=false}={}){
    const value=String(password||"");
    if(allowEmpty&&!value)return value;
    if(value.length<8||!/\p{L}/u.test(value)||!/\d/u.test(value)){
      throw new Error("Mật khẩu cần ít nhất 8 ký tự và có cả chữ lẫn số.");
    }
    return value;
  }

  async function signInCode(code, password){
    const sb = requireClient();
    const email=codeToEmail(code);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  async function changeOwnPassword(currentPassword,newPassword){
    const next=assertPasswordPolicy(newPassword);
    const sb=requireClient();
    const {data:currentData,error:currentError}=await sb.auth.getUser();
    if(currentError) throw currentError;
    const email=currentData?.user?.email;
    if(!email) throw new Error("Không xác định được tài khoản hiện tại.");
    const {error:reauthError}=await sb.auth.signInWithPassword({
      email,
      password:String(currentPassword||"")
    });
    if(reauthError){
      const error=new Error("Mật khẩu hiện tại không đúng.");
      error.code="CURRENT_PASSWORD_INVALID";
      throw error;
    }
    const { data,error }=await sb.auth.updateUser({password:next});
    if(error) throw error;
    return data.user;
  }

  async function edgeFunctionErrorMessage(error,fallback="Edge Function bị lỗi"){
    if(!error)return fallback;
    let message=String(error?.message||fallback);

    try{
      const ctx=error?.context;
      if(ctx){
        const response=typeof ctx.clone==="function"?ctx.clone():ctx;
        let body=null;

        try{
          body=await response.json();
        }catch(_){
          try{
            const text=await response.text();
            if(text)body={message:text};
          }catch(__){}
        }

        const detail=body?.error||body?.message||body?.msg||body?.code;
        if(detail)message=String(detail);

        const status=response?.status;
        const sbCode=response?.headers?.get?.("sb-error-code");
        const parts=[];
        if(status)parts.push(`HTTP ${status}`);
        if(sbCode)parts.push(sbCode);
        if(parts.length)message+=` [${parts.join(" · ")}]`;
      }
    }catch(parseError){
      console.warn("Không đọc được nội dung lỗi Edge Function",parseError);
    }

    return message;
  }

  async function invokeEdgeFunction(name,body,fallback){
    const sb=requireClient();
    const {data,error}=await sb.functions.invoke(name,{body:body||{}});

    if(error){
      const wrapped=new Error(await edgeFunctionErrorMessage(error,fallback));
      wrapped.code=String(error?.code||"EDGE_FUNCTION_ERROR");
      wrapped.status=Number(error?.context?.status||0)||undefined;
      wrapped.cause=error;
      throw wrapped;
    }

    if(!data?.ok){
      const wrapped=new Error(data?.error||data?.message||fallback);
      wrapped.code=String(data?.code||"EDGE_FUNCTION_ERROR");
      throw wrapped;
    }

    return data;
  }

  async function teacherResetPassword(userId,newPassword){
    const password=assertPasswordPolicy(newPassword);
    return invokeEdgeFunction(
      "admin-reset-password",
      {userId,newPassword:password},
      "Không đặt lại được mật khẩu."
    );
  }

  async function teacherDeleteUser(userId,confirmCode){
    return invokeEdgeFunction(
      "admin-delete-user",
      {userId,confirmCode:String(confirmCode||"").trim().toUpperCase()},
      "Không xóa được tài khoản."
    );
  }

  async function teacherListUsers(){
    return invokeEdgeFunction(
      "admin-list-users",
      {},
      "Không tải được danh sách học sinh."
    );
  }

  async function teacherUpdateUser(userId,changes){
    return invokeEdgeFunction(
      "admin-update-user",
      {
        userId,
        changeCode:changes?.changeCode===true,
        code:String(changes?.code||"").trim(),
        fullName:String(changes?.fullName||"").trim(),
        role:String(changes?.role||"student"),
        active:changes?.active!==false
      },
      "Không cập nhật được tài khoản."
    );
  }

  async function teacherCreateUser(changes){
    return invokeEdgeFunction(
      "admin-create-user",
      {
        code:String(changes?.code||"").trim().toUpperCase(),
        fullName:String(changes?.fullName||"").trim(),
        role:String(changes?.role||"student"),
        className:String(changes?.className||"").trim(),
        password:assertPasswordPolicy(changes?.password,{allowEmpty:true})
      },
      "Không tạo được tài khoản."
    );
  }

  async function teacherRebaseWeeks(firstWeekStart, deadlineTime="20:00"){
    const sb=requireClient();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(firstWeekStart||""))) throw new Error("Ngày bắt đầu tuần 1 không hợp lệ.");
    if(!/^\d{2}:\d{2}$/.test(String(deadlineTime||""))) throw new Error("Giờ deadline không hợp lệ.");

    const {data:years,error:yearErr}=await sb.from("school_years")
      .select("id,name,start_date,end_date,is_active").eq("is_active",true).limit(1);
    if(yearErr) throw yearErr;
    const year=years?.[0];
    if(!year) throw new Error("Chưa có năm học đang hoạt động.");

    const {data:weekRows,error:weekErr}=await sb.from("weeks")
      .select("*").eq("school_year_id",year.id).order("week_number");
    if(weekErr) throw weekErr;
    if(!weekRows?.length) throw new Error("Năm học chưa có tuần nào.");

    const today=dateISOInTimeZone();
    const startMs=Date.parse(`${firstWeekStart}T00:00:00Z`);
    const endMs=Date.parse(`${year.end_date}T00:00:00Z`);
    const desiredCount=Math.max(1,Math.floor((endMs-startMs)/(7*86400000))+1);
    const byNumber=new Map(weekRows.map(w=>[Number(w.week_number),w]));

    const planned=Array.from({length:desiredCount},(_,i)=>{
      const number=i+1;
      const old=byNumber.get(number)||null;
      const start=addDaysISO(firstWeekStart,i*7);
      const naturalEnd=addDaysISO(start,4);
      const end=naturalEnd>year.end_date ? year.end_date : naturalEnd;
      const deadlineDate=addDaysISO(start,-1);
      const mode=old?.deadline_mode || "per_session_20";
      return {
        id:old?.id||null,
        school_year_id:year.id,
        week_number:number,
        start_date:start,
        end_date:end,
        status:old?.status||"upcoming",
        deadline_mode:mode,
        registration_deadline:mode==="specific" && old?.registration_deadline
          ? old.registration_deadline
          : `${deadlineDate}T${deadlineTime}:00+07:00`,
        note:old?.note||null
      };
    });

    const chosen=planned.find(w=>w.start_date<=today&&addDaysISO(w.start_date,6)>=today)
      || planned.find(w=>w.start_date>today)
      || planned[planned.length-1];

    const normalized=planned.map(w=>({
      ...w,
      status:w.status==="holiday"
        ? "holiday"
        : (
            chosen && (w.week_number===chosen.week_number || w.week_number===chosen.week_number+1)
              ? "open"
              : (w.end_date<today ? "locked" : "upcoming")
          )
    }));

    let q=await sb.from("school_years").update({start_date:firstWeekStart}).eq("id",year.id);
    if(q.error) throw q.error;

    const existingRows=normalized.filter(w=>w.id).map(w=>({
      id:w.id,school_year_id:w.school_year_id,week_number:w.week_number,
      start_date:w.start_date,end_date:w.end_date,status:w.status,
      deadline_mode:w.deadline_mode,
      registration_deadline:w.registration_deadline,note:w.note
    }));
    if(existingRows.length){
      q=await sb.from("weeks").upsert(existingRows,{onConflict:"id"});
      if(q.error) throw q.error;
    }

    const newRows=normalized.filter(w=>!w.id).map(w=>({
      school_year_id:w.school_year_id,week_number:w.week_number,
      start_date:w.start_date,end_date:w.end_date,status:w.status,
      deadline_mode:w.deadline_mode,
      registration_deadline:w.registration_deadline,note:w.note
    }));
    if(newRows.length){
      q=await sb.from("weeks").insert(newRows);
      if(q.error) throw q.error;
    }

    snapshot=null;
    return {ok:true,currentWeekNumber:chosen?.week_number||1,createdWeeks:newRows.length};
  }

  async function emergencyRegister({weekId,dow,period,content,note,reason,usesElectronicDevice=false}){
    const data=await invokeEdgeFunction(
      "emergency-register",
      {
        weekId,
        weekday:Number(dow)+1,
        periodNumber:Number(period),
        content:String(content||"").trim(),
        note:String(note||"").trim(),
        reason:String(reason||"").trim(),
        usesElectronicDevice:usesElectronicDevice===true
      },
      "Không đăng ký bổ sung được."
    );
    return data.registration?mapReg(data.registration):null;
  }

  async function requestAiReview(registrationId){
    return invokeEdgeFunction(
      "ai-review-registration",
      {registrationId},
      "AI không xử lý được đăng ký."
    );
  }

  async function deleteRegistration(registrationId){
    if(!isUuid(registrationId)){
      throw new Error("Mã đăng ký không hợp lệ.");
    }

    const sb=requireClient();
    const {data,error}=await sb.rpc("delete_registration_safely",{
      p_registration_id:registrationId
    });

    if(error)throw friendlySyncError(error);
    if(data!==true){
      throw new Error("Không tìm thấy đăng ký đang hoạt động để xóa.");
    }
    return true;
  }


  async function markNotificationsRead(ids){
    const list=(ids||[]).filter(Boolean);
    if(!list.length) return;
    const sb=requireClient();
    const {error}=await sb.from("teacher_notifications").update({is_read:true}).in("id",list);
    if(error) throw error;
  }

  async function signOut(){
    const sb = requireClient();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  function isMissingAuthSession(error){
    if(!error)return false;
    const name=String(error?.name||"");
    const code=String(error?.code||"");
    const message=String(error?.message||"");
    return (
      name==="AuthSessionMissingError"
      || code==="AuthSessionMissingError"
      || /auth session missing/i.test(message)
    );
  }

  async function authUser(){
    const sb=requireClient();
    const {data:sessionData,error:sessionError}=await sb.auth.getSession();

    if(sessionError){
      if(isMissingAuthSession(sessionError))return null;
      throw sessionError;
    }
    if(!sessionData?.session)return null;

    const {data,error}=await sb.auth.getUser();
    if(error){
      if(isMissingAuthSession(error))return null;
      throw error;
    }
    return data.user||null;
  }

  function mapProfile(p){
    return {
      id:p.id,
      code:p.student_code || "",
      name:p.full_name,
      role:p.role,
      active:p.active !== false
    };
  }
  function toLocalInput(iso){
    if(!iso) return "";
    const d=new Date(iso), pad=n=>String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function mapWeek(w){
    return {
      id:w.id, number:w.week_number, startDate:w.start_date, endDate:w.end_date,
      status:w.status,
      deadlineMode:w.deadline_mode || "per_session_20",
      deadline:toLocalInput(w.registration_deadline),
      note:w.note || ""
    };
  }
  function mapReg(r){
    return {
      id:r.id, studentId:r.student_id, weekId:r.week_id, dow:Number(r.weekday)-1,
      period:r.period_number, content:r.content, note:r.note || "", status:r.status,
      teacherComment:r.teacher_comment || "",
      approvalSource:r.approval_source || "manual",
      autoReviewReason:r.auto_review_reason || "",
      aiReviewStatus:r.ai_review_status || "not_needed",
      aiDecision:r.ai_decision || "",
      aiCategory:r.ai_category || "",
      aiConfidence:r.ai_confidence==null?null:Number(r.ai_confidence),
      aiReason:r.ai_reason || "",
      aiModel:r.ai_model || "",
      aiReviewedAt:r.ai_reviewed_at || null,
      aiReviewCount:Number(r.ai_review_count||0),
      isEmergency:r.is_emergency===true,
      emergencyReason:r.emergency_reason || "",
      emergencyRequestedAt:r.emergency_requested_at || null,
      usesElectronicDevice:r.uses_electronic_device===true,
      deviceDetectionSource:r.device_detection_source || "",
      deviceDetectionConfidence:r.device_detection_confidence==null?null:Number(r.device_detection_confidence),
      updatedAt:r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
      approvedAt:r.approved_at ? new Date(r.approved_at).getTime() : null
    };
  }
  function dbReg(r){
    const out = {
      student_id:r.studentId, week_id:r.weekId, weekday:Number(r.dow)+1,
      period_number:Number(r.period), content:r.content, note:r.note || null,
      status:r.status, teacher_comment:r.teacherComment || null,
      uses_electronic_device:r.usesElectronicDevice===true,
      updated_at:new Date().toISOString()
    };
    if (r.status === "submitted") out.submitted_at = new Date().toISOString();
    if (r.approvedAt) out.approved_at = new Date(r.approvedAt).toISOString();
    if (isUuid(r.id)) out.id = r.id;
    return out;
  }

  function addDaysISO(iso,n){
    const d=new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate()+Number(n||0));
    return d.toISOString().slice(0,10);
  }

  function dateISOInTimeZone(date=new Date()){
    const timeZone=String(cfg.timeZone||"Asia/Ho_Chi_Minh");
    try{
      const parts=new Intl.DateTimeFormat("en-CA",{
        timeZone,year:"numeric",month:"2-digit",day:"2-digit"
      }).formatToParts(date);
      const get=t=>parts.find(p=>p.type===t)?.value;
      return `${get("year")}-${get("month")}-${get("day")}`;
    }catch{
      const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");
      return `${y}-${m}-${d}`;
    }
  }

  function chooseCurrentWeek(weeks){
    if(!weeks?.length)return null;
    const today=dateISOInTimeZone();

    // Tuần học được neo từ Thứ Hai đến Chủ nhật.
    const exact=weeks.find(w=>w.startDate<=today && addDaysISO(w.startDate,6)>=today);
    if(exact)return exact;

    const next=weeks.find(w=>w.startDate>today);
    if(next)return next;

    return weeks[weeks.length-1];
  }

  async function loadWeekData(weekId){
    if(!weekId) return {overrides:[],registrations:[]};
    const sb=requireClient();
    const [overridesRes,registrationsRes]=await Promise.all([
      sb.from("week_schedule_overrides")
        .select(WEEK_OVERRIDE_COLUMNS)
        .eq("week_id",weekId),
      sb.from("registrations")
        .select(REGISTRATION_COLUMNS)
        .eq("week_id",weekId)
        .eq("is_deleted",false)
    ]);
    if(overridesRes.error) throw overridesRes.error;
    if(registrationsRes.error) throw registrationsRes.error;
    return {
      overrides:(overridesRes.data||[]).map(o=>({
        id:o.id,weekId:o.week_id,dow:Number(o.weekday)-1,period:o.period_number,
        active:o.is_study_period,reason:o.reason||""
      })),
      registrations:(registrationsRes.data||[]).map(mapReg)
    };
  }

  async function loadState(){
    const sb = requireClient();
    const user = await authUser();
    if (!user) return { currentUser:null, state:null };

    const safeProfileColumns="id,student_code,full_name,role,class_name,active";
    const { data:profile, error:profileErr } = await sb.from("profiles").select(safeProfileColumns).eq("id",user.id).single();
    if (profileErr) throw profileErr;

    // V8.1.6:
    // GV đồng bộ Auth users -> profiles TRƯỚC, rồi mới đọc class_members.
    // Nhờ vậy 32 Auth users đã có từ trước schema cũng xuất hiện ngay.
    let loginCodesRes={ok:true,users:[],createdProfiles:0,repairedProfiles:0};
    if(profile.role==="teacher"){
      try{
        loginCodesRes=await teacherListUsers();
      }catch(error){
        console.warn("Không đồng bộ được Auth users sang profiles.",error);
      }
    }

    const membersQuery=sb.from("class_members")
      .select("id,student_code,full_name,role,class_name,active")
      .order("full_name");

    const [
      profilesRes, yearsRes, periodsRes, scheduleRes, settingsRes, notificationsRes
    ] = await Promise.all([
      membersQuery,
      sb.from("school_years").select("id,name,start_date,end_date,is_active").order("start_date",{ascending:false}),
      sb.from("periods").select("period_number,start_time,end_time").order("period_number"),
      sb.from("study_schedule").select("weekday,period_number").eq("is_study_period",true),
      sb.from("app_settings").select("key,value"),
      profile.role==="teacher"
        ? sb.from("teacher_notifications")
          .select("id,registration_id,student_id,week_id,notification_type,title,message,is_read,created_at")
          .order("created_at",{ascending:false}).limit(100)
        : Promise.resolve({data:[],error:null})
    ]);
    for (const r of [profilesRes,yearsRes,periodsRes,scheduleRes,settingsRes,notificationsRes]){
      if (r.error) throw r.error;
    }

    const activeYear = yearsRes.data.find(y=>y.is_active) || yearsRes.data[0];
    let weeks = [];
    if (activeYear){
      const wr = await sb.from("weeks")
        .select("id,week_number,start_date,end_date,status,deadline_mode,registration_deadline,note")
        .eq("school_year_id",activeYear.id).order("week_number");
      if (wr.error) throw wr.error;
      weeks = wr.data.map(mapWeek);
    }

    const settingsObj = {};
    (settingsRes.data || []).forEach(x=>settingsObj[x.key]=x.value);
    const currentWeek = chooseCurrentWeek(weeks);
    const weekData=await loadWeekData(currentWeek?.id);
    let registrations=weekData.registrations;

    // Lịch sử cá nhân vẫn đầy đủ; dữ liệu cả lớp chỉ tải theo tuần đang xem.
    if(["student","monitor"].includes(profile.role)){
      const ownRes=await sb.from("registrations")
        .select(REGISTRATION_COLUMNS)
        .eq("student_id",user.id)
        .eq("is_deleted",false);
      if(ownRes.error) throw ownRes.error;
      const byId=new Map(registrations.map(row=>[row.id,row]));
      (ownRes.data||[]).map(mapReg).forEach(row=>byId.set(row.id,row));
      registrations=[...byId.values()];
    }

    const state = {
      version:2,
      activeSchoolYearId: activeYear?.id || null,
      settings:{
        className: settingsObj.class_name || profile.class_name || "10A1",
        schoolYear: activeYear?.name || "",
        announcement: settingsObj.announcement || "Chuẩn bị nội dung tự học trước hạn.",
        teacherName: settingsObj.teacher_name || "",
        smartApprovalEnabled: settingsObj.smart_approval_enabled !== false,
        aiReviewEnabled: settingsObj.ai_review_enabled !== false,
        aiAutoApproveThreshold: Math.max(0.50,Math.min(0.99,Number(settingsObj.ai_auto_approve_threshold ?? 0.90)))
      },
      users:(()=>{
        const dirById=new Map(
          (loginCodesRes?.users||[])
            .filter(u=>u?.id)
            .map(u=>[u.id,u])
        );

        const rows=(profilesRes.data||[]).map(p=>{
          const mapped=mapProfile(p);
          const extra=dirById.get(p.id);
          if(!mapped.code && extra?.code) mapped.code=String(extra.code).toUpperCase();
          if(!mapped.name && extra?.fullName) mapped.name=extra.fullName;
          return mapped;
        });

        // Safety fallback: if RLS/view lags behind a just-created profile,
        // include server directory without exposing email.
        const seen=new Set(rows.map(u=>u.id));
        for(const extra of loginCodesRes?.users||[]){
          if(!seen.has(extra.id)){
            rows.push({
              id:extra.id,
              code:String(extra.code||"").toUpperCase(),
              name:extra.fullName||extra.code||"",
              role:extra.role||"student",
              active:extra.active!==false
            });
          }
        }
        return rows;
      })(),
      weeks,
      periods:(periodsRes.data || []).map(p=>({
        n:p.period_number,start:String(p.start_time).slice(0,5),end:String(p.end_time).slice(0,5)
      })),
      schedule:(scheduleRes.data || []).map(s=>({dow:Number(s.weekday)-1,period:s.period_number})),
      overrides:weekData.overrides,
      registrations,
      notifications:(notificationsRes.data || []).map(n=>({
        id:n.id,
        registrationId:n.registration_id,
        studentId:n.student_id,
        weekId:n.week_id,
        type:n.notification_type,
        title:n.title,
        message:n.message || "",
        isRead:n.is_read === true,
        createdAt:n.created_at
      })),
      currentWeekId:currentWeek?.id || weeks[0]?.id || null,
      audit:[]
    };
    snapshot = deepClone(state);
    return { currentUser:mapProfile(profile), state };
  }

  async function insertAudit(entries){
    if(!entries.length)return;

    await invokeEdgeFunction(
      "audit-log",
      {
        entries:entries.map(entry=>({
          action:entry.action||"Thay đổi",
          entityType:"web_app",
          entityId:String(entry.entityId||""),
          detail:entry.detail||"",
          createdAt:entry.at||new Date().toISOString()
        }))
      },
      "Không ghi được nhật ký hệ thống."
    );
  }

  async function syncInternal(state,currentUser){
    if (!snapshot) { snapshot=deepClone(state); return; }
    const sb=requireClient(), role=currentUser?.role;
    const before=snapshot;

    // Registrations: students sync only their own; teachers can sync any changed registration.
    const oldById=new Map((before.registrations||[]).map(r=>[r.id,r]));

    if(role === "teacher"){
      const currentIds=new Set((state.registrations||[]).map(r=>r.id));
      for(const old of before.registrations||[]){
        if(isUuid(old.id) && !currentIds.has(old.id)){
          const { error }=await sb.from("registrations").update({
            is_deleted:true,
            deleted_at:new Date().toISOString(),
            deleted_by:currentUser.id,
            updated_at:new Date().toISOString()
          }).eq("id",old.id);
          if(error) throw error;
        }
      }
    }

    for (const r of state.registrations || []){
      if (role !== "teacher" && r.studentId !== currentUser?.id) continue;
      const old=oldById.get(r.id);
      if (!old || stable(r)!==stable(old)){
        if (!isUuid(r.id)){
          const payload=dbReg(r); delete payload.id;
          const { data,error }=await sb.from("registrations")
            .insert(payload)
            .select()
            .single();
          if(error) throw error;
          Object.assign(r,mapReg(data));
        } else {
          const payload=dbReg(r); delete payload.id; delete payload.student_id; delete payload.week_id;
          delete payload.weekday; delete payload.period_number;
          const { data,error }=await sb.from("registrations").update(payload).eq("id",r.id).select().single();
          if(error) throw error;
          Object.assign(r,mapReg(data));
        }
      }
    }

    if (role === "teacher"){
      // Default schedule.
      if (stable(state.schedule||[]) !== stable(before.schedule||[])){
        let q=await sb.from("study_schedule").delete().gte("weekday",1);
        if(q.error) throw q.error;
        if ((state.schedule||[]).length){
          q=await sb.from("study_schedule").insert(state.schedule.map(s=>({
            weekday:Number(s.dow)+1,period_number:Number(s.period),is_study_period:true
          })));
          if(q.error) throw q.error;
        }
      }

      // Week-specific overrides. Small dataset: replace all teacher-managed overrides.
      if (stable(state.overrides||[]) !== stable(before.overrides||[])){
        let q=await sb.from("week_schedule_overrides").delete().not("id","is",null);
        if(q.error) throw q.error;
        if ((state.overrides||[]).length){
          q=await sb.from("week_schedule_overrides").insert(state.overrides.map(o=>({
            week_id:o.weekId,weekday:Number(o.dow)+1,period_number:Number(o.period),
            is_study_period:o.active!==false,reason:o.reason||null
          })));
          if(q.error) throw q.error;
        }
      }

      // Week status/deadlines.
      const oldWeeks=new Map((before.weeks||[]).map(w=>[w.id,w]));
      for(const w of state.weeks||[]){
        const old=oldWeeks.get(w.id);
        if(old && stable(w)!==stable(old)){
          const { error }=await sb.from("weeks").update({
            status:w.status,
            deadline_mode:w.deadlineMode || "per_session_20",
            registration_deadline:w.deadline?new Date(w.deadline).toISOString():null,
            note:w.note||null
          }).eq("id",w.id);
          if(error) throw error;
        }
      }

      // Thông tin tài khoản được cập nhật qua Edge Function admin-update-user.

      // Tên năm học nếu GV thay đổi trong Cài đặt.
      if(state.activeSchoolYearId && state.settings?.schoolYear !== before.settings?.schoolYear){
        const {error}=await sb.from("school_years").update({name:state.settings.schoolYear}).eq("id",state.activeSchoolYearId);
        if(error) throw error;
      }

      // App settings.
      if(stable(state.settings||{})!==stable(before.settings||{})){
        const rows=[
          {key:"class_name",value:state.settings.className},
          {key:"announcement",value:state.settings.announcement},
          {key:"teacher_name",value:state.settings.teacherName||currentUser.name},
          {key:"smart_approval_enabled",value:state.settings.smartApprovalEnabled!==false},
          {key:"ai_review_enabled",value:state.settings.aiReviewEnabled!==false},
          {key:"ai_auto_approve_threshold",value:Number(state.settings.aiAutoApproveThreshold||0.90)}
        ];
        const { error }=await sb.from("app_settings").upsert(rows,{onConflict:"key"});
        if(error) throw error;
      }
    }

    const oldAuditLen=(before.audit||[]).length;
    const newEntries=(state.audit||[]).slice(0,Math.max(0,(state.audit||[]).length-oldAuditLen));
    if(newEntries.length) await insertAudit(newEntries);

    snapshot=deepClone(state);
  }

  function appSyncError(code,message,cause){
    const wrapped=new Error(message);
    wrapped.code=code;
    wrapped.cause=cause;
    return wrapped;
  }

  function friendlySyncError(error){
    const message=String(error?.message||error||"");
    const code=String(error?.code||"");

    if(code==="42501"||code==="SECURITY_REGISTRATION"||/row-level security|security policy/i.test(message)){
      return appSyncError(
        "SECURITY_REGISTRATION",
        "Thao tác bị RLS từ chối vì quyền tài khoản, trạng thái tuần hoặc deadline không hợp lệ.",
        error
      );
    }

    if(code==="23505"||code==="DUPLICATE_REGISTRATION"||/duplicate key/i.test(message)){
      return appSyncError(
        "DUPLICATE_REGISTRATION",
        "Tiết này đã có đăng ký đang hoạt động.",
        error
      );
    }

    return error instanceof Error
      ? error
      : appSyncError("SYNC_ERROR",message||"Không đồng bộ được dữ liệu",error);
  }

  function syncState(state,currentUser){
    if(!enabled()) return Promise.resolve();
    syncQueue=syncQueue.then(()=>syncInternal(state,currentUser)).catch(error=>{
      syncQueue=Promise.resolve();
      throw friendlySyncError(error);
    });
    return syncQueue;
  }

  function resetSnapshot(state){ snapshot=deepClone(state); }

  window.SupabaseService=Object.freeze({
    enabled,
    init,
    signInCode,
    signOut,
    loadState,
    loadWeekData,
    syncState,
    resetSnapshot,
    changeOwnPassword,
    teacherResetPassword,
    teacherUpdateUser,
    teacherDeleteUser,
    teacherCreateUser,
    teacherRebaseWeeks,
    emergencyRegister,
    requestAiReview,
    deleteRegistration,
    markNotificationsRead,
    dateISOInTimeZone
  });
})();
