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


function normalizeCode(code:string){
  return code.trim().toUpperCase();
}

function emailForCode(code:string){
  const local=code.toLowerCase().replace(/[^a-z0-9._-]/g,"");
  const domain=(Deno.env.get("LOGIN_DOMAIN")||"users.example.com").trim().toLowerCase();
  return `${local}@${domain}`;
}

function codeFromEmail(email:string|null|undefined){
  const value=String(email||"").trim();
  if(!value.includes("@")) return "";
  return normalizeCode(value.split("@")[0]||"");
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json(405,{ok:false,error:"Method not allowed"});

  try{
    const url=Deno.env.get("SUPABASE_URL");

    let secretMap:Record<string,string>={};
    try{
      const raw=Deno.env.get("SUPABASE_SECRET_KEYS")||"{}";
      const parsed=JSON.parse(raw);
      if(parsed&&typeof parsed==="object") secretMap=parsed;
    }catch(err){
      console.error("SUPABASE_SECRET_KEYS parse error",err);
    }

    const secretCandidates=Object.values(secretMap).filter(
      (v):v is string=>typeof v==="string"&&v.length>20
    );

    const adminKey=
      secretMap["default"] ||
      secretCandidates.find(v=>v.startsWith("sb_secret_")) ||
      secretCandidates[0] ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if(!url||!adminKey){
      console.error("admin-update-user: missing server credential",{
        hasUrl:!!url,
        secretNames:Object.keys(secretMap),
        hasLegacyServiceRole:!!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      });
      return json(500,{
        ok:false,
        stage:"server_config",
        error:"Edge Function chưa có server secret của Supabase"
      });
    }

    const token=(req.headers.get("Authorization")||"")
      .replace(/^Bearer\s+/i,"")
      .trim();

    if(!token) return json(401,{ok:false,stage:"authorization_header",error:"Thiếu phiên đăng nhập"});

    const admin=createClient(url,adminKey,{
      auth:{persistSession:false,autoRefreshToken:false}
    });

    const {data:userData,error:userError}=await admin.auth.getUser(token);
    const caller=userData?.user;

    if(userError||!caller){
      return json(401,{ok:false,stage:"validate_user_token",error:"Phiên đăng nhập không hợp lệ"});
    }

    const {data:callerProfile,error:callerProfileError}=await admin
      .from("profiles")
      .select("role,active")
      .eq("id",caller.id)
      .single();

    if(callerProfileError||!callerProfile?.active||callerProfile.role!=="teacher"){
      return json(403,{ok:false,stage:"teacher_role_check",error:"Chỉ giáo viên được sửa tài khoản học sinh"});
    }
    const rateLimit = await tryConsumeRateLimit(admin, caller.id, "teacher_update_user", 40, 600);
    if(rateLimit.ok===false) return json(rateLimit.status!, rateLimit.body);


    const body=await req.json().catch(()=>({}));
    const userId=String(body?.userId||"").trim();
    const changeCode=body?.changeCode===true;
    const requestedCode=normalizeCode(String(body?.code||""));
    const fullName=String(body?.fullName||"").trim();
    const role=String(body?.role||"student").trim();
    const active=body?.active!==false;

    if(!/^[0-9a-f-]{36}$/i.test(userId)){
      return json(400,{ok:false,stage:"validate_input",error:"userId không hợp lệ"});
    }
    if(fullName.length<2||fullName.length>120){
      return json(400,{ok:false,stage:"validate_input",error:"Họ tên không hợp lệ"});
    }
    if(!["student","monitor"].includes(role)){
      return json(400,{ok:false,stage:"validate_input",error:"Vai trò không hợp lệ"});
    }

    const {data:target,error:targetError}=await admin
      .from("profiles")
      .select("id,student_code,full_name,email,role,class_name,active")
      .eq("id",userId)
      .single();

    if(targetError||!target){
      return json(404,{ok:false,stage:"load_profile",error:"Không tìm thấy tài khoản"});
    }
    if(target.role==="teacher"){
      return json(403,{ok:false,stage:"target_role_check",error:"Không sửa tài khoản giáo viên ở màn hình học sinh"});
    }

    // Auth Users chỉ có email; login code của app nằm ở:
    // 1) profiles.student_code nếu có
    // 2) nếu thiếu thì lấy phần trước @ của email nội bộ.
    let oldCode=normalizeCode(String(target.student_code||""));
    if(!oldCode){
      oldCode=codeFromEmail(target.email);
    }

    // Nếu profile.email cũng thiếu, lấy email trực tiếp từ Auth để khôi phục code.
    let authEmailFallback="";
    if(!oldCode){
      const {data:authFallback,error:authFallbackError}=await admin.auth.admin.getUserById(userId);
      if(authFallbackError||!authFallback.user){
        return json(404,{
          ok:false,
          stage:"derive_login_code",
          error:"Không tìm thấy mã đăng nhập trong hồ sơ hoặc email Auth"
        });
      }
      authEmailFallback=authFallback.user.email||"";
      oldCode=codeFromEmail(authEmailFallback);
    }

    const code=changeCode ? requestedCode : oldCode;

    if(!/^[A-Z0-9._-]{2,32}$/.test(code)){
      return json(400,{
        ok:false,
        stage:"validate_code",
        error:"Không suy ra được mã đăng nhập hợp lệ từ email của học sinh"
      });
    }

    const codeActuallyChanges=changeCode && code!==oldCode;

    if(codeActuallyChanges){
      const {data:duplicate,error:dupError}=await admin
        .from("profiles")
        .select("id")
        .ilike("student_code",code)
        .neq("id",userId)
        .limit(1);

    if(dupError) return json(400,{ok:false,error:"Không kiểm tra được mã đăng nhập"});
      if(duplicate&&duplicate.length){
        return json(409,{ok:false,stage:"duplicate_code",error:"Mã đăng nhập đã được sử dụng"});
      }
    }

    const fullNameChanges=fullName!==String(target.full_name||"");

    let authUser:any=null;
    let oldEmail=String(target.email||"");
    let oldMeta:any={};

    // Chỉ đụng vào Supabase Auth khi thật sự cần:
    // - đổi mã -> đổi fake email + metadata
    // - đổi họ tên -> chỉ đổi metadata
    // Đổi role/active đơn thuần KHÔNG đổi email Auth.
    if(codeActuallyChanges||fullNameChanges){
      const {data:authData,error:authGetError}=await admin.auth.admin.getUserById(userId);
      if(authGetError||!authData.user){
        return json(404,{ok:false,stage:"load_auth_user",error:"Không tìm thấy Auth user"});
      }

      authUser=authData.user;
      oldEmail=authUser.email||oldEmail;
      oldMeta=authUser.user_metadata||{};

      const authPayload:any={
        user_metadata:{
          ...oldMeta,
          full_name:fullName,
          login_code:code
        }
      };

      if(codeActuallyChanges){
        authPayload.email=emailForCode(code);
        authPayload.email_confirm=true;
      }

      const {error:authUpdateError}=await admin.auth.admin.updateUserById(userId,authPayload);
      if(authUpdateError){
      return json(400,{ok:false,stage:"update_auth_user",error:"Không cập nhật được tài khoản đăng nhập"});
      }
    }

    const profilePayload:any={
      full_name:fullName,
      role,
      active
    };

    if(codeActuallyChanges){
      profilePayload.student_code=code;
      profilePayload.email=emailForCode(code);
    }else{
      // Tự chữa hồ sơ cũ: nếu student_code/email bị thiếu thì khôi phục từ Auth email.
      if(!String(target.student_code||"").trim()){
        profilePayload.student_code=code;
      }
      if(!String(target.email||"").trim()){
        profilePayload.email=authEmailFallback || emailForCode(code);
      }
    }

    const {error:profileUpdateError}=await admin
      .from("profiles")
      .update(profilePayload)
      .eq("id",userId);

    if(profileUpdateError){
      // Best-effort rollback Auth nếu trước đó đã thay đổi.
      if(authUser){
        const rollback:any={user_metadata:oldMeta};
        if(codeActuallyChanges&&oldEmail){
          rollback.email=oldEmail;
          rollback.email_confirm=true;
        }
        await admin.auth.admin.updateUserById(userId,rollback);
      }
      return json(400,{ok:false,stage:"update_profile",error:"Không cập nhật được hồ sơ học sinh"});
    }

    await admin.from("audit_logs").insert({
      actor_id:caller.id,
      action:"ADMIN_UPDATE_USER",
      entity_type:"profile",
      entity_id:userId,
      old_data:{
        student_code:target.student_code,
        full_name:target.full_name,
        role:target.role,
        active:target.active
      },
      new_data:{
        student_code:code,
        full_name:fullName,
        role,
        active,
        login_code_changed:codeActuallyChanges
      }
    });

    return json(200,{
      ok:true,
      user:{
        id:userId,
        code,
        fullName,
        role,
        active
      },
      changed:{
        loginCode:codeActuallyChanges,
        fullName:fullNameChanges,
        role:role!==target.role,
        active:active!==target.active
      }
    });

  }catch(err){
    console.error(err);
    return json(500,{
      ok:false,
      stage:"unhandled_exception",
      code:"INTERNAL_ERROR",
      error:"Không thể hoàn tất yêu cầu. Vui lòng thử lại."
    });
  }
});
