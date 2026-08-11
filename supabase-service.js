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

  function requireClient(){
    if (!enabled()) throw new Error("Supabase mode chưa được cấu hình.");
    if (!window.supabase) throw new Error("Không tải được thư viện Supabase JS.");
    if (!client) client = window.supabase.createClient(cfg.projectUrl, cfg.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
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
    if(!clean) throw new Error("Mã đăng nhập không hợp lệ.");
    const domain=String(cfg.loginDomain||"users.example.com").trim().toLowerCase();
    return `${clean}@${domain}`;
  }

  async function signInCode(code, password){
    const sb = requireClient();
    const email=codeToEmail(code);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  async function changeOwnPassword(newPassword){
    if(String(newPassword||"").length < 8) throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự.");
    const sb=requireClient();
    const { data,error }=await sb.auth.updateUser({password:newPassword});
    if(error) throw error;
    return data.user;
  }

  async function teacherResetPassword(userId,newPassword){
    if(String(newPassword||"").length < 8) throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự.");
    const sb=requireClient();
    const { data,error }=await sb.functions.invoke("admin-reset-password",{
      body:{userId,newPassword}
    });
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.error||"Không đặt lại được mật khẩu.");
    return data;
  }

  async function teacherUpdateUser(userId,changes){
    const sb=requireClient();
    const payload={
      userId,
      code:String(changes?.code||"").trim(),
      fullName:String(changes?.fullName||"").trim(),
      role:String(changes?.role||"student"),
      active:changes?.active!==false
    };
    const { data,error }=await sb.functions.invoke("admin-update-user",{body:payload});
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.error||"Không cập nhật được tài khoản.");
    return data;
  }

  async function signOut(){
    const sb = requireClient();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  async function authUser(){
    const sb = requireClient();
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data.user || null;
  }

  function mapProfile(p){
    return {
      id:p.id, code:p.student_code || "", name:p.full_name, email:p.email || "",
      role:p.role, active:p.active !== false
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
      status:w.status, deadline:toLocalInput(w.registration_deadline),
      note:w.note || ""
    };
  }
  function mapReg(r){
    return {
      id:r.id, studentId:r.student_id, weekId:r.week_id, dow:Number(r.weekday)-1,
      period:r.period_number, content:r.content, note:r.note || "", status:r.status,
      teacherComment:r.teacher_comment || "",
      updatedAt:r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
      approvedAt:r.approved_at ? new Date(r.approved_at).getTime() : null
    };
  }
  function dbReg(r){
    const out = {
      student_id:r.studentId, week_id:r.weekId, weekday:Number(r.dow)+1,
      period_number:Number(r.period), content:r.content, note:r.note || null,
      status:r.status, teacher_comment:r.teacherComment || null,
      updated_at:new Date().toISOString()
    };
    if (r.status === "submitted") out.submitted_at = new Date().toISOString();
    if (r.approvedAt) out.approved_at = new Date(r.approvedAt).toISOString();
    if (isUuid(r.id)) out.id = r.id;
    return out;
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
    if(!weeks?.length) return null;
    const today=dateISOInTimeZone();

    // Mon–Fri: đúng tuần chứa hôm nay.
    const exact=weeks.find(w=>w.startDate<=today && w.endDate>=today);
    if(exact) return exact;

    // Trước năm học hoặc cuối tuần/khoảng nghỉ: ưu tiên tuần kế tiếp.
    const next=weeks.find(w=>w.startDate>today);
    if(next) return next;

    // Sau năm học: giữ tuần cuối cùng thay vì rơi về tuần 1.
    return weeks[weeks.length-1];
  }

  async function loadState(){
    const sb = requireClient();
    const user = await authUser();
    if (!user) return { currentUser:null, state:null };

    const safeProfileColumns="id,student_code,full_name,role,class_name,active";
    const { data:profile, error:profileErr } = await sb.from("profiles").select(safeProfileColumns).eq("id",user.id).single();
    if (profileErr) throw profileErr;

    // Danh bạ an toàn: không bao giờ lấy email nội bộ về frontend.
    const membersQuery = sb.from("class_members").select("*").order("full_name");

    const [
      profilesRes, yearsRes, periodsRes, scheduleRes, overridesRes, regsRes, settingsRes
    ] = await Promise.all([
      membersQuery,
      sb.from("school_years").select("*").order("start_date",{ascending:false}),
      sb.from("periods").select("*").order("period_number"),
      sb.from("study_schedule").select("*").eq("is_study_period",true),
      sb.from("week_schedule_overrides").select("*"),
      sb.from("registrations").select("*").eq("is_deleted",false),
      sb.from("app_settings").select("*")
    ]);
    for (const r of [profilesRes,yearsRes,periodsRes,scheduleRes,overridesRes,regsRes,settingsRes]){
      if (r.error) throw r.error;
    }

    const activeYear = yearsRes.data.find(y=>y.is_active) || yearsRes.data[0];
    let weeks = [];
    if (activeYear){
      const wr = await sb.from("weeks").select("*").eq("school_year_id",activeYear.id).order("week_number");
      if (wr.error) throw wr.error;
      weeks = wr.data.map(mapWeek);
    }

    const settingsObj = {};
    (settingsRes.data || []).forEach(x=>settingsObj[x.key]=x.value);
    const currentWeek = chooseCurrentWeek(weeks);

    const state = {
      version:2,
      activeSchoolYearId: activeYear?.id || null,
      settings:{
        className: settingsObj.class_name || profile.class_name || "10A1",
        schoolYear: activeYear?.name || "",
        announcement: settingsObj.announcement || "Chuẩn bị nội dung tự học trước hạn của tuần.",
        teacherName: settingsObj.teacher_name || ""
      },
      users:(profilesRes.data || []).map(mapProfile),
      weeks,
      periods:(periodsRes.data || []).map(p=>({
        n:p.period_number,start:String(p.start_time).slice(0,5),end:String(p.end_time).slice(0,5)
      })),
      schedule:(scheduleRes.data || []).map(s=>({dow:Number(s.weekday)-1,period:s.period_number})),
      overrides:(overridesRes.data || []).map(o=>({
        id:o.id,weekId:o.week_id,dow:Number(o.weekday)-1,period:o.period_number,active:o.is_study_period,reason:o.reason||""
      })),
      registrations:(regsRes.data || []).map(mapReg),
      currentWeekId:currentWeek?.id || weeks[0]?.id || null,
      audit:[]
    };
    snapshot = deepClone(state);
    return { currentUser:mapProfile(profile), state };
  }

  async function insertAudit(entries){
    if (!entries.length) return;
    const sb=requireClient();
    const rows=entries.map(a=>({
      actor_id:a.userId || null, action:a.action || "Thay đổi",
      entity_type:"web_app", entity_id:String(a.entityId || ""),
      new_data:{detail:a.detail || ""}, created_at:a.at || new Date().toISOString()
    }));
    const { error }=await sb.from("audit_logs").insert(rows);
    if(error) throw error;
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
          const { data,error }=await sb.from("registrations").upsert(payload,{
            onConflict:"student_id,week_id,weekday,period_number"
          }).select().single();
          if(error) throw error;
          Object.assign(r,mapReg(data));
        } else {
          const payload=dbReg(r); delete payload.id; delete payload.student_id; delete payload.week_id;
          delete payload.weekday; delete payload.period_number;
          const { error }=await sb.from("registrations").update(payload).eq("id",r.id);
          if(error) throw error;
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
            status:w.status,registration_deadline:w.deadline?new Date(w.deadline).toISOString():null,note:w.note||null
          }).eq("id",w.id);
          if(error) throw error;
        }
      }

      // Thông tin tài khoản được cập nhật qua Edge Function admin-update-user.

      // App settings.
      if(stable(state.settings||{})!==stable(before.settings||{})){
        const rows=[
          {key:"class_name",value:state.settings.className},
          {key:"announcement",value:state.settings.announcement},
          {key:"teacher_name",value:state.settings.teacherName||currentUser.name}
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

  function syncState(state,currentUser){
    if(!enabled()) return Promise.resolve();
    syncQueue=syncQueue.then(()=>syncInternal(state,currentUser));
    return syncQueue;
  }

  function resetSnapshot(state){ snapshot=deepClone(state); }

  window.SupabaseService={
    enabled,init,signInCode,signOut,authUser,loadState,syncState,resetSnapshot,
    codeToEmail,changeOwnPassword,teacherResetPassword,teacherUpdateUser,
    chooseCurrentWeek,dateISOInTimeZone,
    get client(){return client;}
  };
})();
