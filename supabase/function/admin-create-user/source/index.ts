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


function randomPassword(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes=crypto.getRandomValues(new Uint8Array(12));
  let out="A1@";
  for(const b of bytes) out+=chars[b%chars.length];
  return out;
}

function emailForCode(code:string){
  const local=code.trim().toLowerCase().replace(/[^a-z0-9._-]/g,"");
  const domain=(Deno.env.get("LOGIN_DOMAIN")||"users.example.com").trim().toLowerCase();
  return `${local}@${domain}`;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json(405,{ok:false,error:"Method not allowed"});

  try{
    const url=Deno.env.get("SUPABASE_URL");
    const secretMap=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    const adminKey=secretMap["default"]||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!adminKey) return json(500,{ok:false,error:"Server secrets are missing"});

    const authHeader=req.headers.get("Authorization")||"";
    const token=authHeader.replace(/^Bearer\s+/i,"").trim();
    if(!token) return json(401,{ok:false,error:"Thiếu phiên đăng nhập"});

    const admin=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await admin.auth.getUser(token);
    const caller=userData?.user;
    if(userError||!caller) return json(401,{ok:false,error:"Phiên đăng nhập không hợp lệ"});

    const {data:callerProfile,error:callerErr}=await admin
      .from("profiles").select("role,active,class_name").eq("id",caller.id).single();
    if(callerErr||!callerProfile?.active||callerProfile.role!=="teacher"){
      return json(403,{ok:false,error:"Chỉ giáo viên được thêm học sinh"});
    }
    const rateLimit = await tryConsumeRateLimit(admin, caller.id, "teacher_create_user", 12, 600);
    if(rateLimit.ok===false) return json(rateLimit.status!, rateLimit.body);


    const body=await req.json().catch(()=>({}));
    const code=String(body?.code||"").trim().toUpperCase();
    const fullName=String(body?.fullName||"").trim();
    const role=String(body?.role||"student").trim();
    const className=String(body?.className||callerProfile.class_name||"10A1").trim();
    const requestedPassword=String(body?.password||"").trim();

    if(!/^[A-Z0-9._-]{2,32}$/.test(code)) return json(400,{ok:false,error:"Mã đăng nhập không hợp lệ"});
    if(fullName.length<2||fullName.length>120) return json(400,{ok:false,error:"Họ tên không hợp lệ"});
    if(!["student","monitor"].includes(role)) return json(400,{ok:false,error:"Vai trò không hợp lệ"});

    const {data:dup,error:dupErr}=await admin.from("profiles")
      .select("id").ilike("student_code",code).limit(1);
    if(dupErr) return json(400,{ok:false,error:"Không kiểm tra được mã đăng nhập"});
    if(dup?.length) return json(409,{ok:false,error:"Mã đăng nhập đã tồn tại"});

    const password=requestedPassword||randomPassword();
    if(password.length<8||!/\p{L}/u.test(password)||!/\d/u.test(password)){
      return json(400,{ok:false,error:"Mật khẩu cần ít nhất 8 ký tự và có cả chữ lẫn số"});
    }

    const email=emailForCode(code);
    const {data,error}=await admin.auth.admin.createUser({
      email,password,email_confirm:true,
      user_metadata:{full_name:fullName,login_code:code}
    });
    if(error||!data.user) return json(400,{ok:false,error:"Không tạo được tài khoản đăng nhập"});

    const {error:profileError}=await admin.from("profiles").update({
      student_code:code,
      full_name:fullName,
      email,
      role,
      class_name:className,
      active:true
    }).eq("id",data.user.id);

    if(profileError){
      await admin.auth.admin.deleteUser(data.user.id);
      return json(400,{ok:false,error:"Không lưu được hồ sơ học sinh"});
    }

    await admin.from("audit_logs").insert({
      actor_id:caller.id,
      action:"ADMIN_CREATE_USER",
      entity_type:"profile",
      entity_id:data.user.id,
      new_data:{student_code:code,full_name:fullName,role,class_name:className}
    });

    return json(200,{
      ok:true,
      user:{id:data.user.id,code,fullName,role,className},
      password,
      generatedPassword:!requestedPassword
    });
  }catch(err){
    console.error(err);
    return json(500,{ok:false,code:"INTERNAL_ERROR",error:"Không thể hoàn tất yêu cầu. Vui lòng thử lại."});
  }
});
