import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigin=(Deno.env.get("ALLOWED_ORIGIN")||"https://giansollie940.github.io").trim();
const corsHeaders={
  "Access-Control-Allow-Origin":allowedOrigin||"https://invalid.local",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};

function json(status:number,body:unknown){
  return new Response(JSON.stringify(body),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"},
  });
}

function clean(v:unknown,max:number){
  return String(v??"").replace(/\s+/g," ").trim().slice(0,max);
}

function validUuid(v:string){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function adminKey(){
  let secretMap:Record<string,string>={};
  try{
    const parsed=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    if(parsed&&typeof parsed==="object")secretMap=parsed;
  }catch{}
  const candidates=Object.values(secretMap).filter(
    (v):v is string=>typeof v==="string"&&v.length>20
  );
  return secretMap["default"]
    || candidates.find(v=>v.startsWith("sb_secret_"))
    || candidates[0]
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || "";
}

async function rateLimit(admin:any,actorId:string){
  try{
    const now=new Date();
    const since=new Date(now.getTime()-60*60*1000).toISOString();

    await admin.from("server_rate_limits")
      .delete()
      .lt("created_at",new Date(now.getTime()-86400000).toISOString());

    const {count,error}=await admin.from("server_rate_limits")
      .select("id",{count:"exact",head:true})
      .eq("actor_id",actorId)
      .eq("action","emergency_registration")
      .gte("created_at",since);

    if(error)throw error;
    if((count||0)>=4){
      return {ok:false,error:"Bạn đã dùng đăng ký bổ sung quá nhiều lần trong thời gian ngắn. Hãy báo giáo viên nếu cần hỗ trợ."};
    }

    const {error:insertError}=await admin.from("server_rate_limits").insert({
      actor_id:actorId,
      action:"emergency_registration",
      created_at:now.toISOString(),
    });
    if(insertError)throw insertError;
  }catch(error){
    console.warn("Emergency rate limit soft-fail:",error);
  }
  return {ok:true};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json(405,{ok:false,error:"Method not allowed"});

  try{
    const url=Deno.env.get("SUPABASE_URL")||"";
    const key=adminKey();
    if(!url||!key)return json(500,{ok:false,error:"Thiếu cấu hình máy chủ"});

    const token=(req.headers.get("Authorization")||"")
      .replace(/^Bearer\s+/i,"")
      .trim();
    if(!token)return json(401,{ok:false,error:"Thiếu phiên đăng nhập"});

    const admin=createClient(url,key,{
      auth:{persistSession:false,autoRefreshToken:false}
    });

    const {data:userData,error:userError}=await admin.auth.getUser(token);
    const caller=userData?.user;
    if(userError||!caller){
      return json(401,{ok:false,error:"Phiên đăng nhập không hợp lệ"});
    }

    const {data:profile,error:profileError}=await admin
      .from("profiles")
      .select("id,role,active")
      .eq("id",caller.id)
      .single();

    if(profileError||!profile?.active||!["student","monitor"].includes(profile.role)){
      return json(403,{ok:false,error:"Tài khoản không có quyền đăng ký bổ sung"});
    }

    const body=await req.json().catch(()=>({}));
    const weekId=clean(body?.weekId,80);
    const weekday=Number(body?.weekday);
    const periodNumber=Number(body?.periodNumber);
    const content=clean(body?.content,500);
    const note=clean(body?.note,800);
    const reason=clean(body?.reason,300);
    const usesElectronicDevice=body?.usesElectronicDevice;

    if(!validUuid(weekId))return json(400,{ok:false,error:"Tuần không hợp lệ"});
    if(!Number.isInteger(weekday)||weekday<1||weekday>5){
      return json(400,{ok:false,error:"Ngày học không hợp lệ"});
    }
    if(!Number.isInteger(periodNumber)||periodNumber<1||periodNumber>9){
      return json(400,{ok:false,error:"Tiết học không hợp lệ"});
    }
    if(content.length<1)return json(400,{ok:false,error:"Cần nhập nội dung tự học"});
    if(reason.length<5)return json(400,{ok:false,error:"Hãy ghi lý do cần đăng ký bổ sung"});
    if(typeof usesElectronicDevice!=="boolean"){
      return json(400,{
        ok:false,
        code:"INVALID_DEVICE_CHOICE",
        error:"Hãy chọn có hoặc không sử dụng thiết bị điện tử"
      });
    }

    const limited=await rateLimit(admin,caller.id);
    if(!limited.ok)return json(429,{ok:false,error:limited.error});

    const {data:week,error:weekError}=await admin
      .from("weeks")
      .select("id,status,start_date")
      .eq("id",weekId)
      .single();
    if(weekError||!week)return json(404,{ok:false,error:"Không tìm thấy tuần học"});
    if(week.status==="holiday")return json(403,{ok:false,error:"Tuần này là tuần nghỉ"});

    const {data:openData,error:openError}=await admin.rpc(
      "week_registration_is_open",
      {p_week_id:weekId}
    );
    if(openError||openData!==true){
      return json(403,{ok:false,error:"Tuần này không nằm trong cửa sổ đăng ký hiện tại"});
    }

    // Slot phải thực sự thuộc TKB tự học, ưu tiên override của tuần.
    const {data:override,error:overrideError}=await admin
      .from("week_schedule_overrides")
      .select("is_study_period")
      .eq("week_id",weekId)
      .eq("weekday",weekday)
      .eq("period_number",periodNumber)
      .maybeSingle();
    if(overrideError)return json(400,{ok:false,error:"Không kiểm tra được lịch riêng của tuần"});

    let activeSlot=false;
    if(override){
      activeSlot=override.is_study_period===true;
    }else{
      const {data:schedule,error:scheduleError}=await admin
        .from("study_schedule")
        .select("id")
        .eq("weekday",weekday)
        .eq("period_number",periodNumber)
        .eq("is_study_period",true)
        .maybeSingle();
    if(scheduleError)return json(400,{ok:false,error:"Không kiểm tra được thời khóa biểu"});
      activeSlot=!!schedule;
    }
    if(!activeSlot)return json(403,{ok:false,error:"Tiết này không phải tiết tự học"});

    const [{data:deadline,error:deadlineError},{data:sessionStart,error:sessionError}]=await Promise.all([
      admin.rpc("registration_deadline_for_slot",{p_week_id:weekId,p_weekday:weekday}),
      admin.rpc("study_session_start",{
        p_week_id:weekId,
        p_weekday:weekday,
        p_period_number:periodNumber
      })
    ]);

    if(deadlineError)return json(400,{ok:false,error:"Không kiểm tra được hạn đăng ký"});
    if(sessionError)return json(400,{ok:false,error:"Không kiểm tra được giờ bắt đầu buổi học"});

    const now=Date.now();
    const deadlineMs=deadline?new Date(deadline).getTime():NaN;
    const sessionMs=sessionStart?new Date(sessionStart).getTime():NaN;

    if(!Number.isFinite(sessionMs)||now>=sessionMs){
      return json(403,{ok:false,error:"Buổi tự học đã bắt đầu hoặc đã qua; không thể đăng ký bổ sung"});
    }
    if(!Number.isFinite(deadlineMs)||now<=deadlineMs){
      return json(409,{ok:false,error:"Buổi này vẫn còn trong hạn; hãy dùng nút đăng ký bình thường"});
    }

    const {data:existing,error:existingError}=await admin
      .from("registrations")
      .select("id")
      .eq("student_id",caller.id)
      .eq("week_id",weekId)
      .eq("weekday",weekday)
      .eq("period_number",periodNumber)
      .eq("is_deleted",false)
      .maybeSingle();

    if(existingError)return json(400,{ok:false,error:"Không kiểm tra được đăng ký hiện có"});
    if(existing){
      return json(409,{ok:false,error:"Buổi này đã có đăng ký đang hoạt động"});
    }

    const nowIso=new Date().toISOString();
    const {data:registration,error:insertError}=await admin
      .from("registrations")
      .insert({
        student_id:caller.id,
        week_id:weekId,
        weekday,
        period_number:periodNumber,
        content,
        note:note||null,
        status:"submitted",
        approval_source:"manual",
        is_emergency:true,
        emergency_reason:reason,
        emergency_requested_at:nowIso,
        uses_electronic_device:usesElectronicDevice,
        submitted_at:nowIso,
        updated_at:nowIso,
      })
      .select("*")
      .single();

    if(insertError)return json(400,{ok:false,error:"Không lưu được đăng ký bổ sung"});

    await admin.from("audit_logs").insert({
      actor_id:caller.id,
      action:"EMERGENCY_REGISTRATION",
      entity_type:"registration",
      entity_id:registration.id,
      new_data:{
        week_id:weekId,
        weekday,
        period_number:periodNumber,
        uses_electronic_device:usesElectronicDevice,
        reason,
      },
      created_at:nowIso,
    });

    return json(200,{ok:true,registration});
  }catch(error){
    console.error(error);
    return json(500,{
      ok:false,
      code:"INTERNAL_ERROR",
      error:"Không thể hoàn tất yêu cầu. Vui lòng thử lại."
    });
  }
});
