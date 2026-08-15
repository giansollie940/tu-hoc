import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigin=(Deno.env.get("ALLOWED_ORIGIN")||"https://giansollie940.github.io").trim();
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin||"https://invalid.local",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status:number,body:unknown){
  return new Response(JSON.stringify(body),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"},
  });
}


async function tryConsumeRateLimit(admin:any, actorId:string, action:string, maxCalls:number, windowSeconds:number){
  try{
    const now = new Date();
    const since = new Date(now.getTime()-windowSeconds*1000).toISOString();
    await admin.from("server_rate_limits").delete().lt("created_at", new Date(now.getTime()-86400000).toISOString());

    const { count, error:countError } = await admin
      .from("server_rate_limits")
      .select("id", { count:"exact", head:true })
      .eq("actor_id", actorId)
      .eq("action", action)
      .gte("created_at", since);

    if(countError) throw countError;
    if((count || 0) >= maxCalls){
      return {
        ok:false,
        status:429,
        body:{ ok:false, error:`Bạn thao tác quá nhanh với chức năng này. Vui lòng thử lại sau ${Math.ceil(windowSeconds/60)} phút.` }
      };
    }

    const { error:insertError } = await admin.from("server_rate_limits").insert({
      actor_id: actorId, action, created_at: now.toISOString()
    });
    if(insertError) throw insertError;
  }catch(error){
    console.warn("Rate limit soft-fail:", error);
  }
  return { ok:true };
}


Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json(405,{ok:false,error:"Method not allowed"});

  try{
    const url=Deno.env.get("SUPABASE_URL");
    const secretMap=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    const adminKey=secretMap["default"]||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!adminKey) return json(500,{ok:false,error:"Server secrets are missing"});

    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
    if(!token) return json(401,{ok:false,error:"Thiếu phiên đăng nhập"});

    const admin=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});

    const {data:callerData,error:callerError}=await admin.auth.getUser(token);
    const caller=callerData?.user;
    if(callerError||!caller) return json(401,{ok:false,error:"Phiên đăng nhập không hợp lệ"});

    const {data:callerProfile,error:callerProfileError}=await admin
      .from("profiles")
      .select("role,active")
      .eq("id",caller.id)
      .single();

    if(callerProfileError||!callerProfile?.active||callerProfile.role!=="teacher"){
      return json(403,{ok:false,error:"Chỉ giáo viên được xóa tài khoản học sinh"});
    }
    const rateLimit = await tryConsumeRateLimit(admin, caller.id, "teacher_delete_user", 12, 600);
    if(rateLimit.ok===false) return json(rateLimit.status!, rateLimit.body);


    const body=await req.json().catch(()=>({}));
    const userId=String(body?.userId||"").trim();
    const confirmCode=String(body?.confirmCode||"").trim().toUpperCase();

    if(!/^[0-9a-f-]{36}$/i.test(userId)) return json(400,{ok:false,error:"userId không hợp lệ"});
    if(userId===caller.id) return json(403,{ok:false,error:"Không thể xóa chính tài khoản giáo viên đang đăng nhập"});

    const {data:target,error:targetError}=await admin
      .from("profiles")
      .select("id,student_code,full_name,email,role,class_name,active")
      .eq("id",userId)
      .single();

    if(targetError||!target) return json(404,{ok:false,error:"Không tìm thấy tài khoản"});
    if(target.role==="teacher") return json(403,{ok:false,error:"Không thể xóa tài khoản giáo viên tại màn hình này"});
    if(!target.active) return json(409,{ok:false,error:"Tài khoản đã bị khóa/xóa"});
    if(confirmCode!==String(target.student_code||"").toUpperCase()){
      return json(400,{ok:false,error:"Mã xác nhận không khớp"});
    }

    const oldCode=String(target.student_code||"");
    const archivedCode=`__deleted__${userId.slice(0,8)}__${oldCode}`.slice(0,120);

    // Khóa quyền ứng dụng trước. Nếu JWT cũ của HS vẫn còn sống,
    // RLS V6 cũng yêu cầu profile active=true.
    const {error:archiveError}=await admin.from("profiles").update({
      active:false,
      student_code:archivedCode,
      email:null
    }).eq("id",userId);

    if(archiveError) return json(400,{ok:false,error:"Không lưu được hồ sơ trước khi xóa"});

    // Supabase Auth soft delete: không thể đăng nhập lại, nhưng giữ auth row
    // đủ để FK profile/registration không bị cascade mất lịch sử.
    const {error:deleteError}=await admin.auth.admin.deleteUser(userId,true);

    if(deleteError){
      // Best-effort rollback nếu Auth không xóa được.
      await admin.from("profiles").update({
        active:target.active,
        student_code:target.student_code,
        email:target.email
      }).eq("id",userId);
      return json(400,{ok:false,error:"Không xóa được tài khoản đăng nhập"});
    }

    await admin.from("audit_logs").insert({
      actor_id:caller.id,
      action:"ADMIN_SOFT_DELETE_USER",
      entity_type:"profile",
      entity_id:userId,
      old_data:{
        student_code:oldCode,
        full_name:target.full_name,
        role:target.role,
        class_name:target.class_name
      },
      new_data:{
        active:false,
        archived_student_code:archivedCode,
        auth_soft_deleted:true
      }
    });

    return json(200,{
      ok:true,
      deletedUser:{
        id:userId,
        code:oldCode,
        fullName:target.full_name
      },
      historyPreserved:true,
      codeReusable:true
    });
  }catch(err){
    console.error(err);
    return json(500,{ok:false,code:"INTERNAL_ERROR",error:"Không thể hoàn tất yêu cầu. Vui lòng thử lại."});
  }
});
