import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigin=(Deno.env.get("ALLOWED_ORIGIN")||"https://giansollie940.github.io").trim();
const corsHeaders={
  "Access-Control-Allow-Origin":allowedOrigin||"https://invalid.local",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};

function reply(status:number,body:unknown){
  return new Response(JSON.stringify(body),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"},
  });
}

function normalizeCode(v:unknown){
  return String(v||"").trim().toUpperCase();
}

function codeFromEmail(email:unknown){
  const v=String(email||"").trim();
  if(!v.includes("@")) return "";
  return normalizeCode(v.split("@")[0]||"");
}

function validCode(code:string){
  return /^[A-Z0-9._-]{2,32}$/.test(code);
}

function inferClassFromCode(code:string){
  const c=normalizeCode(code);
  const m=c.match(/^(.+)-\d+$/);
  return m?.[1]||"";
}

function serverKey(){
  let map:Record<string,string>={};
  try{
    const parsed=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    if(parsed&&typeof parsed==="object") map=parsed;
  }catch(err){
    console.error("SUPABASE_SECRET_KEYS parse error",err);
  }

  const values=Object.values(map).filter(
    (v):v is string=>typeof v==="string"&&v.length>20
  );

  return (
    map["default"] ||
    values.find(v=>v.startsWith("sb_secret_")) ||
    values[0] ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    ""
  );
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return reply(405,{ok:false,error:"Method not allowed"});

  try{
    const url=Deno.env.get("SUPABASE_URL")||"";
    const key=serverKey();

    if(!url||!key){
      return reply(500,{
        ok:false,
        stage:"server_config",
        error:"Edge Function chưa có server secret của Supabase"
      });
    }

    const token=(req.headers.get("Authorization")||"")
      .replace(/^Bearer\s+/i,"")
      .trim();

    if(!token){
      return reply(401,{
        ok:false,
        stage:"authorization_header",
        error:"Thiếu phiên đăng nhập"
      });
    }

    const admin=createClient(url,key,{
      auth:{persistSession:false,autoRefreshToken:false}
    });

    const {data:callerData,error:callerError}=await admin.auth.getUser(token);
    const caller=callerData?.user;

    if(callerError||!caller){
      return reply(401,{
        ok:false,
        stage:"validate_token",
        error:"Phiên đăng nhập không hợp lệ"
      });
    }
    const rateLimit = await tryConsumeRateLimit(admin, caller.id, "teacher_list_users", 60, 300);
    if(rateLimit.ok===false) return json(rateLimit.status!, rateLimit.body);


    const {data:teacher,error:teacherError}=await admin
      .from("profiles")
      .select("id,role,class_name,active")
      .eq("id",caller.id)
      .single();

    if(
      teacherError ||
      !teacher?.active ||
      teacher.role!=="teacher"
    ){
      return reply(403,{
        ok:false,
        stage:"teacher_check",
        error:"Chỉ giáo viên được đồng bộ danh sách học sinh"
      });
    }

    const teacherClass=String(teacher.class_name||"").trim().toUpperCase();

    // Existing profiles.
    const {data:profileRows,error:profileError}=await admin
      .from("profiles")
      .select("id,student_code,full_name,email,role,class_name,active");

    if(profileError){
      return reply(400,{
        ok:false,
        stage:"load_profiles",
        error:"Không tải được danh sách hồ sơ"
      });
    }

    const profileById=new Map((profileRows||[]).map(p=>[p.id,p]));
    const usedCodes=new Map<string,string>();

    for(const p of profileRows||[]){
      const code=normalizeCode(p.student_code);
      if(validCode(code)) usedCodes.set(code,p.id);
    }

    // Read all Auth users server-side.
    const authUsers:any[]=[];
    const perPage=200;

    for(let page=1;page<=20;page++){
      const {data,error}=await admin.auth.admin.listUsers({page,perPage});
      if(error){
        return reply(400,{
          ok:false,
          stage:"list_auth_users",
          error:"Không tải được danh sách tài khoản đăng nhập"
        });
      }

      const batch=data?.users||[];
      authUsers.push(...batch);
      if(batch.length<perPage) break;
    }

    let createdProfiles=0;
    let repairedProfiles=0;
    const directory:any[]=[];

    for(const authUser of authUsers){
      if(authUser.id===caller.id) continue;

      const authCode=codeFromEmail(authUser.email);
      const existing=profileById.get(authUser.id);

      const existingCode=normalizeCode(existing?.student_code);
      const profileEmailCode=codeFromEmail(existing?.email);

      const code=
        validCode(existingCode) ? existingCode :
        validCode(profileEmailCode) ? profileEmailCode :
        validCode(authCode) ? authCode : "";

      if(!validCode(code)) continue;
      if(code.startsWith("__DELETED__")) continue;
      if(code.startsWith("GV-")) continue;

      const metadata=authUser.user_metadata||{};
      const metadataRole=String(metadata.role||"").trim();
      const role=["student","monitor"].includes(existing?.role)
        ? existing.role
        : (["student","monitor"].includes(metadataRole)?metadataRole:"student");

      const inferredClass=inferClassFromCode(code);
      const className=String(
        existing?.class_name ||
        metadata.class_name ||
        inferredClass ||
        teacherClass ||
        "10A1"
      ).trim();

      // Only the teacher's class.
      if(
        teacherClass &&
        className.toUpperCase()!==teacherClass
      ) continue;

      const metadataName=String(
        metadata.full_name ||
        metadata.name ||
        ""
      ).trim();

      const existingName=String(existing?.full_name||"").trim();

      // If Auth metadata has no actual name, use code as a visible placeholder.
      // We cannot reconstruct a real human name from email alone.
      const fullName=existingName || metadataName || code;

      if(!existing){
        if(usedCodes.has(code)&&usedCodes.get(code)!==authUser.id){
          console.warn("Bỏ qua code trùng",code,authUser.id);
          continue;
        }

        const {error:createError}=await admin
          .from("profiles")
          .insert({
            id:authUser.id,
            student_code:code,
            full_name:fullName,
            email:authUser.email||null,
            role,
            class_name:className,
            active:true
          });

        if(createError){
          console.error("Không tạo được profile",authUser.id,createError.message);
          continue;
        }

        createdProfiles++;
        usedCodes.set(code,authUser.id);
      }else{
        const patch:any={};

        if(!validCode(existingCode) && !usedCodes.has(code)){
          patch.student_code=code;
        }
        if(!existingName && fullName){
          patch.full_name=fullName;
        }
        if(!String(existing.email||"").trim() && authUser.email){
          patch.email=authUser.email;
        }
        if(!String(existing.class_name||"").trim()){
          patch.class_name=className;
        }

        if(Object.keys(patch).length){
          const {error:repairError}=await admin
            .from("profiles")
            .update(patch)
            .eq("id",authUser.id);

          if(repairError){
            console.warn("Không sửa được profile",authUser.id,repairError.message);
          }else{
            repairedProfiles++;
            if(patch.student_code) usedCodes.set(code,authUser.id);
          }
        }
      }

      directory.push({
        id:authUser.id,
        code,
        fullName,
        role,
        className,
        active:existing?.active!==false,
        nameSource:existingName?"profile":(metadataName?"auth_metadata":"code_placeholder")
      });
    }

    directory.sort((a,b)=>
      String(a.code||"").localeCompare(
        String(b.code||""),
        undefined,
        {numeric:true,sensitivity:"base"}
      )
    );

    return reply(200,{
      ok:true,
      users:directory,
      createdProfiles,
      repairedProfiles
    });

  }catch(err){
    console.error(err);
    return reply(500,{
      ok:false,
      stage:"unhandled_exception",
      code:"INTERNAL_ERROR",
      error:"Không thể hoàn tất yêu cầu. Vui lòng thử lại."
    });
  }
});
